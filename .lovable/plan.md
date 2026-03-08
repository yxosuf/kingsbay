

# Create `flows.md` Documentation File

## What

Create a single `flows.md` file at the project root documenting the full application flow architecture with Mermaid diagrams, code snippets, tables, and step-by-step interaction guides -- all reflecting the actual codebase.

## Content Outline

The file will include YAML frontmatter and these sections:

1. **Project Overview Flow** -- Login to dashboard journey, auth guard logic, role-gating
2. **Sidebar Navigation Flow** -- `collapsible="icon"` states, active item indicator, user popover, hidden pages filtering via `useUserSettings`
3. **Responsive Behavior Flow** -- Desktop sidebar (`hidden md:flex`) vs mobile BottomNav with Sheet "More" menu, decision tree
4. **Component Integration Flow** -- `DashboardLayout` wrapping `SidebarProvider` > `AppSidebar` + `SidebarInset` > `AppHeader` + `main` + `BottomNav`
5. **Error States Flow** -- Auth loading, no-role "Access Pending", redirect to `/auth`, lazy-load fallback spinner

Each section gets a Mermaid diagram plus relevant code snippets and tables pulled from the actual components.

## File

| File | Action |
|------|--------|
| `flows.md` | Create new |

No code changes to any source files.

