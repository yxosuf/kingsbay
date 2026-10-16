
## Multi-tenant (companies)
- Every staff user belongs to one company via `organization_members`; it is the only source of staff roles (`user_roles` is deprecated, never read or write it). Why: two role sources caused drift and cross-company leaks.
- Every property has `organization_id`; company isolation is enforced by RESTRICTIVE "Company isolation" RLS policies using `can_reach_property()` / `is_org_member()`. New property-scoped tables must get the same restrictive policy. Why: permissive role policies alone let admins of one company see another.
- Edge functions using the service role must check the caller's `organization_members.org_id` against the target property's company, and gated features must check `org_has_plan()` server-side. Why: service role bypasses RLS; UI plan locks are cosmetic.
- Plan order comes from `plan_rank()`, never enum order.
