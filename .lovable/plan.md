# Plan: Turn Kings Bay PMS into a multi-company SaaS (Phase A — Organizations)

## Goal
Any villa, resort, or property-management company can sign up, create its own company account, and run its own properties, rooms, staff, and bookings. Each company sees only its own data. Kings Bay becomes company #1. You (platform owner) do not manage client operations.

## What the user will see
1. **Sign up as a new business** — on the login page, "Create your business account": company name, owner name, email, password. The owner becomes that company's Admin.
2. **Onboarding wizard** (already built) runs for the new company: first property, rooms, rate plan, invite staff.
3. **Company settings tab** (Settings → Company): company name, plan (Starter / Pro / Pro+), staff list, invite staff by email.
4. **Plan badges** — Pro features (email booking import) and Pro+ features (Agent, coming later) show a lock + "Upgrade" if the company's plan doesn't include them. Starter keeps iCal sync.
5. **Platform Owner page** (only for you): list of companies, their plan, number of properties, active/suspended. No access to guest details or bookings.

## Data isolation rules
- Every property belongs to exactly one company.
- Staff belong to one company; their role (admin/manager/front desk/viewer) applies only inside that company.
- All existing property-level rules stay; on top, a user can only reach properties of their own company.
- "All Properties" for an admin = all properties of their company only.
- Existing Kings Bay data is moved into a "Kings Bay" company automatically; nothing is lost.

## Cost
Runs on the current backend; no new paid services.

## Out of scope (next phases)
- Real payments/billing for plans (plan is set manually by Platform Owner for now)
- Telegram alert bot
- Pro+ Agent (pre-arrival messages, morning briefing, dynamic pricing)

## Technical details
- New tables: `organizations` (name, plan enum starter/pro/pro_plus, status), `organization_members` (org_id, user_id, role staff_role), `platform_admins` (user_id).
- `properties.organization_id` (NOT NULL after backfill). Backfill: create "Kings Bay" org, attach all properties, copy every `user_roles` row into `organization_members`.
- Security-definer helpers: `current_org_ids()`, `is_org_member(org)`, `org_role(org)`, `is_platform_admin()`, `org_has_plan(org, min_plan)`.
- Update `properties` RLS and `user_property_access` logic so property visibility requires org membership; existing per-table `property_id` policies inherit isolation via property access helpers (update `is_staff()`/`can_access_guest` paths to include org check).
- Signup: RPC `create_organization(name)` (security definer) creates org + owner membership as admin; called after auth signup/confirm.
- Frontend: `useOrganization` hook (current org, plan, `hasFeature()`), `PlanGate` component, Settings → Company tab, `/platform` route guarded by `is_platform_admin()` (server-checked), signup form update on `/auth`.
- `useAuth` role read from `organization_members` for the current org (keep `user_roles` for compatibility during transition).
- Record architecture rule in AGENTS.md; save plan tiers to memory.

## Verification checklist
- Two test companies cannot see each other's properties, bookings, guests, or reports
- Kings Bay test admin still sees everything as before
- Viewer still read-only; deep links and refresh work
- Locked Pro feature shows upgrade prompt on Starter
