# Plan: Turn Kings Bay PMS into a Multi-Company SaaS

## Phase A — Organizations, Isolation, and Plan Foundation

**Status:** Ready to execute

**Scope:** Multi-tenant foundation only. No billing, no Agent, no Telegram.

**Success condition:** Two companies can use the same deployment and never see each other's data — proven by test, not by assumption.

---

## 1. Goal

Any villa, resort, or property-management company can sign up, create its own company account, and run its own properties, rooms, staff, and bookings. Each company sees only its own data.

Kings Bay becomes **company #1** and the flagship showcase. You are the software vendor — you do not manage client operations.

---

## 2. What the user sees

1. **Signup as a new business** — `/auth` gets a "Create your business account" flow: company name, owner name, email, password. The owner becomes that company's Admin. Signup + org creation is **one atomic flow**, not two replayable calls.

2. **Onboarding wizard** runs for the new company: first property → rooms → rate plan → invite staff. Guarded by `organizations.onboarding_completed_at`.

3. **Settings → Company tab** — company name, plan badge, staff list, invite-by-email, plan usage summary.

4. **Plan badges** — Pro and Pro+ features show a lock + "Upgrade" when the company's plan doesn't include them. Starter keeps iCal sync.

5. **Platform Owner page** `/platform`) — companies list with name, plan, property count, status, usage. **No guest details, no bookings, no revenue.** Support access is time-boxed, reason-required, and logged.

---

## 3. Data isolation rules (the contract)

- Every property belongs to **exactly one** organization.

- Every staff member belongs to **exactly one** organization (v1 limitation; multi-org is a later phase).

- Role (admin / manager / front_desk / housekeeping / viewer) applies **only inside that org**.

- All existing property-level rules stay. On top of them: a user can only reach properties of their own org.

- "All Properties" for an admin = all properties of their company only.

- Existing Kings Bay data moves into a **Kings Bay** organization automatically. Zero data loss. Zero behavior change for Kings Bay staff.

- **Two sources of truth are forbidden.** `organization_members` is the only authority after this phase. `user_roles` dies here.

---

## 4. Non-goals (deferred)

- Real payments / Stripe / PayHere billing

- Telegram alert bot

- Pro+ Agent (pre-arrival, morning briefing, dynamic pricing)

- Multi-org staff (accountants, cross-company consultants)

- Aggregator bridge (Channex / Beds24)

These are Phase B+.

---

## 5. The 6 fixes folded in

These were the holes in the original plan. They are now requirements, not notes.

### 5.1 `create_organization(name)` is atomic and rate-limited

- Single RPC that **also creates the owner's `organization_members` row as admin** — cannot be called twice in a loop.

- Rate limit: 1 org per user per 24h unless the user is a platform admin or already a member of a multi-org allowlist.

- Every creation logs: `user_id`, `org_id`, IP, user agent, timestamp → `organization_creation_log`.

- Signup flow: `auth.signUp` → confirm email → `create_organization_with_owner(...)` in one server-side call.

### 5.2 `user_roles` is removed in this phase

- `useAuth` reads role **only** from `organization_members` for the current org.

- Every edge function that references `user_roles` is rewritten in the same PR. Grep gate: `rg "user_roles"` must return zero hits (except the legacy migration file) before merge.

- `user_roles` table dropped after backfill verification passes on staging for 48h.

- If rollback is needed: keep a frozen snapshot table `user_roles_backup_2026_10` for 30 days, no app reads.

### 5.3 Per-table RLS migration is explicit, not "inherits"

Every table with `property_id` gets the same pattern:

```sql

is_org_member(property_org(property_id))

AND org_role(property_org(property_id)) IN (<roles allowed for this table>)

```

Tables **without** `property_id` (profile, users, notifications, audit, storage metadata) each get their own policy written out — no hand-waving.

Full table list is in §7. Full edge function list is in §8. Full storage bucket list is in §9.

### 5.4 Plan ranking is by function, not enum order

```sql

CREATE FUNCTION plan_rank(p plan_tier) RETURNS int IMMUTABLE AS $$

  SELECT CASE p

    WHEN 'starter'  THEN 1

    WHEN 'pro'      THEN 2

    WHEN 'pro_plus' THEN 3

  END

$$ LANGUAGE sql;

```

`org_has_plan(org, 'pro')` becomes `plan_rank(current_plan) >= plan_rank('pro')`. Never cast the enum for ordering.

### 5.5 Plan gating is enforced server-side, not just in UI

Every gated edge function starts with:

```ts

await assertPlan(org_id, 'pro');   // throws 402 if under-tier

```

UI `PlanGate` is UX only. Server is the boundary. List of gated functions in §8.

### 5.6 Backfill edge cases are decided, not discovered

- **Role mapping:** explicit table `user_roles → staff_role` mapping. Defaults: `admin → admin`, `manager → manager`, `front_desk → front_desk`, `viewer → viewer`. Unmapped → `viewer` and flagged for review.

- **Users with zero properties:** still attached to Kings Bay org with their existing role. They belong to a company even if they aren't property-scoped.

- **Writes during migration window:** freeze property/booking creation for 15 minutes, backfill, verify counts match, unfreeze. Documented in the migration runbook.

- **Anything created with NULL `organization_id` post-migration:** blocked by making the column `NOT NULL` and defaulting to nothing — inserts must supply it. No silent fallback to Kings Bay.

---

## 6. Two additions worth 5 minutes

### 6.1 Platform admin access logging is built now

`support_access_log` table: `platform_admin_id`, `org_id`, `action`, `reason`, `started_at`, `ended_at`, `ip`.

`/platform` starts logging on day one, even before any sensitive view exists. Retrofitting logs later means the first months of platform actions are unlogged forever.

### 6.2 `AGENTS.md` rule is specific

```

Every new table MUST have organization_id NOT NULL (or a documented reason it can't).

Every RLS policy MUST route through is_org_member() / org_role().

Every gated edge function MUST call assertPlan() before any write.

CI check: rg "user_roles" must return zero. rg "organization_id" must appear on every CREATE TABLE.

```

Vague rules get ignored. This one fails builds.

---

## 7. Database changes

### 7.1 New tables

| Table | Key columns |

|---|---|

| `organizations` | id, name, slug (unique), owner_user_id, plan `plan_tier`), status `activesuspendedcancelled`), base_currency, timezone, onboarding_completed_at, created_at |

| `organization_members` | id, org_id, user_id, role `staff_role`), status `invitedactivesuspended`), invited_by, joined_at — unique(org_id, user_id) |

| `property_access` | member_id, property_id — optional scoping inside an org |

| `platform_admins` | user_id, level `supportbillingsuperuser`), created_at |

| `support_access_log` | id, platform_admin_id, org_id, action, reason, started_at, ended_at, ip |

| `organization_creation_log` | id, user_id, org_id, ip, user_agent, created_at |

| `usage_counters` | org_id, period_start, period_end, emails_ingested, ai_actions, whatsapp_messages, properties_count, rooms_count |

### 7.2 Enums

- `plan_tier` — starter / pro / pro_plus

- `staff_role` — admin / manager / front_desk / housekeeping / viewer

- `org_status` — active / suspended / cancelled

### 7.3 Column additions

- `properties.organization_id UUID NOT NULL` (nullable during migration, NOT NULL after backfill verification)

### 7.4 Helper functions (all `SECURITY DEFINER`, `STABLE`)

```sql

current_org_ids()              -- SETOF uuid for auth.uid()

is_org_member(org uuid)        -- bool

org_role(org uuid)             -- staff_role

is_platform_admin()            -- bool

org_has_plan(org uuid, min plan_tier) -- bool, uses plan_rank()

property_org(prop uuid)        -- uuid, cached lookup

plan_rank(p plan_tier)         -- int

assert_plan(org uuid, min plan_tier) -- throws if false

```

### 7.5 Backfill sequence (runbook)

1. Freeze new property/booking creation (feature flag).

2. Create Kings Bay org.

3. `UPDATE properties SET organization_id = <kings_bay>`.

4. Copy every `user_roles` row → `organization_members` with role mapping.

5. Attach zero-property users to Kings Bay org.

6. Verify: property count match, member count match, no NULLs.

7. `ALTER COLUMN organization_id SET NOT NULL`.

8. Drop `user_roles` (after snapshot).

9. Unfreeze.

---

## 8. Per-table + per-edge-function migration checklist

### 8.1 Tables — rewrite RLS using org helper

`bookings`, `guests`, `rooms`, `room_types`, `invoices`, `invoice_items`, `transactions`, `services`, `service_catalog`, `housekeeping_tasks`, `housekeeping_assignments`, `channels`, `channel_room_mappings`, `sync_logs`, `needs_review_bookings`, `feedback`, `notifications`, `booking_services`, `pricing_rules`, `inventory_items`, `inventory_movements`

For each: `is_org_member(property_org(property_id)) AND org_role(...) IN (...)`.

### 8.2 Tables without `property_id` — custom policies

- `profiles` — user reads own; org admin reads members of own org only

- `audit_logs` — org admin reads own org

- `organization_members` — self + org admin

- `organizations` — members see own org; platform admin sees list

### 8.3 Edge functions — audit and rewrite

Enumerate every function, tag with: **allowed roles**, **required plan**, **org check**, **usage counter**.

Minimum set that needs `assertPlan`:

- `booking-email-inbound` → Pro

- `ical-import` → Starter

- `ical-export` → Starter

- `send-invoice-email` → Pro

- `generate-invoice-pdf` → Pro

- `channel-sync-worker` → Pro

- Anything AI/WhatsApp/vision → Pro+

Every one of these also gets: `assertOrgMember(user, org_id)` before anything else. No exceptions.

### 8.4 Storage buckets — the scariest leak surface

- `passport-photos` — path **must** be `org_id/property_id/guest_id/file`. Policy checks `is_org_member(<first path segment>)`.

- `housekeeping-photos` — same pattern.

- `invoice-pdfs` — same pattern.

- **Public/signed URLs** — every signed URL is generated server-side after an org check. No client-generated storage paths, ever.

Guest portal and public invoice links: token includes `org_id`, verified server-side on every hit.

---

## 9. Frontend changes

- `useOrganization()` — current org, plan, `hasFeature(name)`, `usage`

- `useAuth()` — role from `organization_members` **only**

- `<PlanGate feature="email_ingestion">` wrapper for gated UI

- `Settings → Company` tab

- `/platform` route — server-checked `is_platform_admin()`, logs every view to `support_access_log`

- `/auth` signup updated: single flow creating user + org + owner membership

- Onboarding wizard gated by `onboarding_completed_at`

- Org switcher in header only if user belongs to >1 org (rare in v1, but wire it)

---

## 10. Verification checklist (must all pass before Phase A is "done")

**Isolation**

- [ ] Two test companies cannot see each other's properties, bookings, guests, rooms, invoices, reports, notifications, audit logs

- [ ] Storage buckets: `passport-photos`, `housekeeping-photos`, `invoice-pdfs` — cross-org signed URL attempt fails

- [ ] Edge functions: cross-org call with valid JWT returns 403

- [ ] Guest portal / public invoice link with mismatched org token returns 404

**Kings Bay continuity**

- [ ] Kings Bay test admin still sees everything as before

- [ ] No count drift in properties, users, bookings, guests after backfill

- [ ] Zero `user_roles` references in codebase `rg "user_roles"` returns empty)

**Roles**

- [ ] Viewer still read-only across all tabs

- [ ] Deep links and refresh preserve role and org context

- [ ] Front desk cannot access admin-only routes

- [ ] Housekeeping cannot see guest billing

**Plan gating**

- [ ] Starter sees iCal sync, Pro features locked with upgrade CTA

- [ ] Starter calling Pro edge function directly → 402

- [ ] Pro plan unlocks email ingestion, branded invoice

- [ ] `org_has_plan` correct across all three tiers, including edge case where enum is reordered in a test migration

**Platform admin**

- [ ] `/platform` shows companies list only

- [ ] Every view writes to `support_access_log`

- [ ] Non-platform-admin hitting `/platform` gets 403

**Signup**

- [ ] New user can create one org, cannot create a second within 24h

- [ ] Owner is admin of their org

- [ ] Onboarding wizard completes for a fresh org with zero assistance

---

## 11. Cost

Runs entirely on the current backend. No new paid services. `usage_counters` is populated but not yet billed — it exists now so Phase B billing can read from a clean table instead of a retrofitted one.

---

## 12. Rollout

1. **Staging** — full migration + all verification checks. 48h soak.

2. **Production** — 15-minute freeze window, run runbook, verify counts, unfreeze, monitor for 24h.

3. **Kings Bay** confirms no behavior change.

4. **First external test org** created manually (dogfood signup). If it works cold, onboarding works.

5. **Phase A declared done.** Phase B (billing + self-serve Pro) starts.

---

## 13. Definition of done

Phase A is complete when:

- Two real companies can coexist on one deployment with proven data isolation across tables, edge functions, and storage.

- Kings Bay is company #1 with zero data loss and zero UX regression.

- Signup → onboarding → first booking works end-to-end without you touching anything.

- Plan gating is enforced at both UI and server.

- `user_roles` is gone.

- `AGENTS.md` rules are in place and CI enforces them.

- Every line in §10 is checked.

Nothing in Phase B starts until every box is ticked.

---

This is the combined plan. It merges your original Phase A scope with the six fixes and two additions, keeps your structure, and replaces every vague sentence with an executable one.

Next concrete artifact to produce: **the actual SQL migration file** — new tables, enums, helper functions, and the per-table RLS rewrite for the first batch (properties, bookings, guests, rooms). Want me to write that now?