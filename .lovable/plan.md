

# Settings Page Redesign Plan

## Overview

Replace the current flat 11-tab settings page with a grouped, searchable dashboard layout using 5 collapsible category groups, a global search bar, and favorites pinning.

## Architecture

The existing settings components (`HotelSettings`, `RateManagementSettings`, `ServicesSettings`, etc.) remain **unchanged**. Only `Settings.tsx` is rewritten to group and present them differently.

### New Layout Structure

```text
┌─────────────────────────────────────────────────┐
│ ← Back   Settings              ⌘K Search...    │
├─────────────────────────────────────────────────┤
│ ★ Favorites: [Rate Management] [Security]       │
├────────────┬────────────────────────────────────┤
│ Sidebar    │ Content Area                       │
│            │                                    │
│ ▼ Basics   │  [Active section component]        │
│   Property │                                    │
│   Other    │                                    │
│            │                                    │
│ ▸ Operations                                    │
│ ▸ People   │                                    │
│ ▸ Comms    │                                    │
│ ▸ Advanced │                                    │
└────────────┴────────────────────────────────────┘
```

Mobile: Sidebar collapses to vertical accordion. Search stays sticky.

### 5 Category Groups

| Group | Sections |
|-------|----------|
| Basics | Property, Other Settings |
| Operations | Rate Management*, Services, Channel Manager |
| People | Access & Roles, Guest Settings |
| Comms & Insights | Notifications, Reports |
| Advanced | Security & Data*, System Health* |

*admin-only sections

### Key Features

1. **Global Search** — Full-width input with 300ms debounce. Matches against section labels, descriptions, and keywords. Filters sidebar to show only matching sections. Cmd+K shortcut opens/focuses search.

2. **Collapsible Groups** — Each category is an accordion in the sidebar. Clicking a section within loads it in the content area. Active section's group auto-expands.

3. **Favorites** — Users can pin/unpin sections. Stored in `user_settings.favorite_settings` (add jsonb column). Pinned sections appear as a horizontal row above the sidebar.

4. **Completion Badges** — Each group shows a simple section count badge (e.g., "2 sections"). No fake completion percentages since settings don't have a "complete" state.

5. **Breadcrumbs** — `Settings > [Group Name] > [Section Name]` displayed above content.

6. **URL Persistence** — Existing `?tab=` deep linking preserved. All old tab aliases still work.

### Database Change

Add `favorite_settings` column to `user_settings`:

```sql
ALTER TABLE user_settings 
ADD COLUMN favorite_settings jsonb NOT NULL DEFAULT '[]'::jsonb;
```

### Files Modified

| File | Change |
|------|--------|
| `src/pages/Settings.tsx` | Full rewrite — grouped sidebar, search, favorites, breadcrumbs |
| `src/hooks/useUserSettings.tsx` | Add `favorite_settings` to the interface and fetch/save logic |
| Migration SQL | Add `favorite_settings` column |

### Implementation Details

- No new dependencies needed — uses existing Radix Accordion, Input, Badge components
- Search uses simple string matching against section label + description + keyword array
- Keyboard shortcut (Cmd+K / Ctrl+K) via `useEffect` keydown listener
- Mobile: groups render as full-width accordions, search is sticky top
- All 11 existing section components render exactly as before — zero changes to child components

