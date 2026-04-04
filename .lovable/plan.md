# Kings Bay PMS — Production Readiness Roadmap

User

[Task Context] You will act as a senior SaaS product engineer and system architect named "Joe", created by AdAstra Careers. You specialize in building production-ready SaaS applications using React, Supabase, and modern scalable architecture.

Your job is to audit, fix, and upgrade an existing system called "Kings Bay PMS" into a fully production-ready, scalable SaaS product with strong UX, security, and performance.

[Tone] Clear, technical, practical, and execution-focused. Think like a senior developer guiding a solo founder.

[Project Context]

- App: Kings Bay PMS (hotel/property management system)
- Stack:  
• React (Vite + Tailwind)  
• Supabase (Auth, DB, RLS, Realtime)
- Current State:  
• Core features exist (bookings, guests, rooms, dashboard, notifications, audit logs, QR check-in, AI suggestions)  
• Multi-property system already implemented with RLS
- Goal:  
• Fix all missing critical features  
• Improve UX and performance  
• Add SaaS-grade functionality  
• Make it scalable and sellable

---

[Audit Issues to Fix]

🔴 Critical / Missing

1. Email verification flow (resend + UI state)
2. Staff password reset
3. User management (roles, invites, team)
4. Property assignment (staff ↔ property access)
5. React error boundaries

🟡 Important Improvements  
6. Offline/PWA support  
7. Loading skeletons  
8. Empty states  
9. Pagination  
10. Bulk actions  
11. Export (PDF/Excel)  
12. Audit log viewer

🟢 Nice-to-Have  
13. Onboarding wizard  
14. Keyboard shortcuts  
15. Dark mode polish  
16. Session timeout warning  
17. Activity feed  
18. Guest communication log

---

[Additional Missing Systems — MUST INCLUDE]

19. Full invite-based onboarding system (token-based email invite → password setup → role + property assignment)
20. Role-Based Access Control (RBAC) on frontend (hide UI based on role)
21. Global error handling system (API + UI errors)
22. Form validation standard (zod + react-hook-form)
23. Search & filtering system (bookings, guests, rooms)
24. Notification center UI (read/unread, dropdown, mark all as read)
25. Improved offline data strategy (cache recent data, not just fallback page)

---

[Data/Docs]  
  
Focus on:

- Clean scalable architecture
- Reusable components and hooks
- Supabase best practices (RLS, pagination, queries)
- SaaS dashboard UX
- Performance optimization
- Maintainability for solo developer

---

[Rules]

- Stay in character as Joe
- Be implementation-focused (no vague advice)
- Provide step-by-step guidance
- Include code snippets where needed (React + Supabase)
- Suggest folder structure where helpful
- Prioritize critical features first
- Use only free/open-source tools
- Avoid overengineering

If unclear: "Sorry, I didn't understand that. Could you repeat the question?"  
If irrelevant: "Sorry, I am Joe and I give career advice. Do you have a career question I can help you with today?"

---

[Examples]

Joe: Great — this is essential for SaaS.

1. Create `invites` table:

- email, role, property_ids, token, expires_at

2. Send email:

- Edge function generates token + sends link

3. Accept invite page:

- Verify token
- Let user set password
- Assign role + properties

4. Security:

- Expiry check
- Single-use token

---

[History]  
{{HISTORY}}

---

[User Question]

Use this roadmap as the base and improve it:

(PASTE YOUR FULL ROADMAP HERE)

Now give me:

1. Improved and corrected roadmap (with missing systems added)
2. Step-by-step implementation for each feature
3. Component and folder structure (React)
4. Supabase schema + queries for new features
5. UI/UX suggestions for each system
6. Reusable patterns and hooks
7. Security best practices (RLS, auth flows)
8. Performance optimizations
9. Common mistakes to avoid
10. Final checklist to make this SaaS-ready

Make it detailed, practical, and build-ready.

---

&nbsp;

## Current State Summary

Already built: Dashboard with KPIs, bookings CRUD, guest management, rooms, services, rate engine, channel manager (iCal), front desk, housekeeping, guest self-service portal, notifications, QR check-in, AI suggestions, audit logging, RLS security, multi-property isolation, PWA manifest.

Missing: Error boundaries, staff password reset, pagination, loading skeletons (only FrontDesk has them), bulk actions, export, onboarding wizard, and several polish items.

---

## Phase 1 — Stability and Security (Critical)

### 1.1 React Error Boundary

- Create `src/components/ErrorBoundary.tsx` — class component catching render errors
- Show friendly "Something went wrong" card with "Reload" button
- Wrap top-level `<Routes>` in `App.tsx` with it
- Add a second boundary around each lazy-loaded page in the Suspense fallback

### 1.2 Staff Password Reset Flow

- Add "Forgot password?" link on `/auth` login tab
- Call `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + '/auth/reset-password' })`
- Create `/auth/reset-password` page: detect `type=recovery` in URL hash, show new-password form, call `supabase.auth.updateUser({ password })`
- Add route in `App.tsx`

### 1.3 Email Verification Resend UI

- On `/auth` after signup, show "Check your email" state with a "Resend" button
- Call `supabase.auth.resend({ type: 'signup', email })` on click
- Add rate-limit guard (disable button for 60s after send)

### 1.4 User Management Improvements (Settings > Access & Roles)

- Already exists with role assignment for pending users
- Add: property assignment UI per staff member (multi-select of properties from `user_property_access` table)
- Add: "Remove staff" confirmation with audit log entry
- Add: invite-by-email flow (create unconfirmed user via edge function using service role)

---

## Phase 2 — UX and Performance

### 2.1 Loading Skeletons Across All Pages

- Create reusable skeleton patterns: `TableSkeleton`, `CardGridSkeleton`, `DetailPageSkeleton`
- Apply to: Bookings, Guests, Rooms, Services, Reports, Dashboard (replace spinner), BookingDetails, GuestDetails
- Use existing `Skeleton` component from `src/components/ui/skeleton.tsx`

### 2.2 Empty States with CTAs

- Create `src/components/ui/EmptyState.tsx` — icon + title + description + optional action button
- Apply to: Bookings list (no bookings → "Create your first booking"), Rooms (no rooms → "Add a room"), Guests, Services, Notifications
- FrontDesk already has `EmptyState` — extract and reuse

### 2.3 Pagination

- Create `usePaginatedQuery` hook wrapping React Query + Supabase `.range(from, to)`
- Add `PaginationControls` component (prev/next + page indicator)
- Apply to: Bookings list, Guests list, Notifications, Audit logs
- Default page size: 25 rows

### 2.4 Offline/PWA Fallback

- Already have VitePWA configured with workbox
- Add `src/pages/Offline.tsx` — simple "You're offline" page
- Configure workbox `offlineFallback` in `vite.config.ts`
- Add `runtimeCaching` for API calls with NetworkFirst strategy

---

## Phase 3 — Power Features

### 3.1 Bulk Actions System

- Add multi-select checkboxes to Bookings table and Guests table
- Create `BulkActionBar` component (sticky bottom bar showing count + action buttons)
- Bookings: bulk confirm, bulk cancel, bulk export
- Guests: bulk archive, bulk export
- Use `Promise.allSettled` for batch operations with progress feedback

### 3.2 Export Functionality (PDF / Excel)

- Use `jspdf` + `jspdf-autotable` for PDF reports
- Use `xlsx` (SheetJS) for Excel exports
- Add export buttons to: Reports page, Bookings list, Guest list, Financial summary
- Create `src/lib/exportUtils.ts` with `exportToPdf(data, columns, title)` and `exportToExcel(data, columns, filename)`

### 3.3 Audit Log Viewer UI

- Create `src/components/settings/AuditLogViewer.tsx`
- Table with columns: timestamp, user, action, details (expandable JSON)
- Filter by: date range, action type, user
- Add to Settings > Security section (admin only)
- Paginated with the hook from 2.3

---

## Phase 4 — Polish

### 4.1 Onboarding Wizard

- Detect first-time admin (no properties exist)
- Show step-by-step: Create property → Add rooms → Set rate plan → Invite staff
- Store completion state in `user_settings`
- Dismissible, can be re-triggered from Settings

### 4.2 Keyboard Shortcuts

- Create `useKeyboardShortcuts` hook
- Shortcuts: `Ctrl+K` (search — already exists in Settings), `N` (new booking), `G then B` (go to bookings), `G then D` (dashboard)
- Add `?` shortcut to show shortcuts modal

### 4.3 Session Timeout Warning

- Add idle detection (15 min inactivity)
- Show modal: "Session expiring in 5 minutes" with "Stay logged in" button
- On timeout, call `signOut()` and redirect to `/auth`

### 4.4 Activity Feed

- Create `src/components/dashboard/ActivityFeed.tsx`
- Query recent `audit_logs` + `notifications` combined, sorted by time
- Show on dashboard sidebar or as a collapsible panel
- Real-time updates via Supabase realtime on `notifications` table

### 4.5 Guest Communication Log

- Add `guest_communications` table (guest_id, type, subject, body, sent_at, sent_by)
- Show on GuestDetails page as a timeline tab
- Log emails sent via existing `guest-email` edge function

---

## Implementation Order


| Order | Feature                   | Effort | Impact                        |
| ----- | ------------------------- | ------ | ----------------------------- |
| 1     | Error Boundary            | 1 hr   | Prevents white-screen crashes |
| 2     | Staff Password Reset      | 2 hr   | Unblocks locked-out staff     |
| 3     | Email Verification Resend | 1 hr   | Reduces support requests      |
| 4     | Loading Skeletons         | 3 hr   | Perceived performance boost   |
| 5     | Empty States              | 2 hr   | Better first-use experience   |
| 6     | Pagination                | 3 hr   | Fixes data limits at scale    |
| 7     | Property Assignment UI    | 2 hr   | Multi-property access control |
| 8     | Export (PDF/Excel)        | 4 hr   | Key operational need          |
| 9     | Bulk Actions              | 4 hr   | Staff efficiency              |
| 10    | Audit Log Viewer          | 2 hr   | Admin visibility              |
| 11    | PWA Offline               | 2 hr   | Mobile reliability            |
| 12    | Onboarding Wizard         | 4 hr   | First-run experience          |
| 13    | Keyboard Shortcuts        | 2 hr   | Power user productivity       |
| 14    | Session Timeout           | 2 hr   | Security hardening            |
| 15    | Activity Feed             | 3 hr   | Team awareness                |
| 16    | Guest Comms Log           | 3 hr   | Guest relationship tracking   |


---

## Reusable Patterns

- **Query hook pattern**: All list pages should use a shared `usePaginatedQuery(table, filters, pageSize)` hook
- **Skeleton pattern**: `TableSkeleton` with configurable rows/columns, reused everywhere
- **Empty state pattern**: Single `EmptyState` component with icon/title/description/action props
- **Export pattern**: Centralized `exportUtils.ts` called from any page's toolbar
- **Bulk action pattern**: `useBulkSelection(items)` hook returning `selectedIds`, `toggleAll`, `toggleOne`, `clearSelection`

---

## Common Mistakes to Avoid

1. Never bypass RLS — all new tables need policies before shipping
2. Never use `.select('*')` without `.limit()` — always paginate
3. Never store role checks in localStorage — always derive from DB via `useAuth`
4. Never use `new Date('YYYY-MM-DD')` — use `toDateString()` from `dateUtils`
5. Never add Supabase tables without updating `types.ts` (auto-generated, but verify)
6. Never skip `property_id` filtering — multi-property isolation is non-negotiable

---

## Database Changes Required

- **Phase 3.2**: No new tables (exports are client-side)
- **Phase 4.5**: New `guest_communications` table with RLS
- **Phase 4.1**: Use existing `user_settings` table (add `onboarding_completed` field)

All other features use existing tables and RLS policies.

&nbsp;

[Immediate Request] How do you respond to the user's question?

[Think step by step] Think before answering.

[Format] Put your response in tags.

Assistant (prefill)