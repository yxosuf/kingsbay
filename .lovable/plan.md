# Mobile-First PWA Plan (Merged & Optimized)

## Goal

Transform the PMS into a **mobile-first Progressive Web App** that:

- installs like a mobile app
- uses **bottom navigation instead of sidebar**
- converts tables into **mobile cards**
- keeps **desktop UI unchanged**
- optimizes workflows for **front desk staff**

---

# 1️⃣ PWA Setup

Install:

```
npm install vite-plugin-pwa
```

Configure in `vite.config.ts`:

```
VitePWA({
  registerType: "autoUpdate",
  manifest: {
    name: "King's Bay PMS",
    short_name: "KingsBay",
    display: "standalone",
    theme_color: "#0f172a",
    background_color: "#ffffff",
    icons: [
      { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
      { src: "/pwa-512.png", sizes: "512x512", type: "image/png" }
    ]
  },
  workbox: {
    navigateFallbackDenylist: [/^\/~oauth/]
  }
})
```

### Add to `index.html`

```
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0f172a">
<meta name="apple-mobile-web-app-capable" content="yes">
<link rel="manifest" href="/manifest.json">
```

What is this?

### Create PWA assets

```
public/
manifest.json
pwa-192.png
pwa-512.png
```

Result:

Users can **Add to Home Screen** and open your PMS like a native app.

---

# 2️⃣ Mobile Navigation (Bottom Tab Bar)

On mobile the **sidebar disappears** and is replaced with a bottom tab bar.

Create:

```
src/components/layout/BottomNav.tsx
```

### Navigation Structure

```
Dashboard
Availability
Bookings
New Booking (+)
More
```

### Layout

```
┌────────────────────────────┐
│        Page Content        │
│                            │
│                            │
├────────────────────────────┤
│ 🏠  📅  📖  ➕  ☰          │
│Home Cal Book New More      │
└────────────────────────────┘
```

### Behavior

Dashboard → main overview  
  
Availability → calendar grid  
  
Bookings → booking list  
  
➕ → quick booking modal  
  
More → opens sheet menu

### UX rules

- 44px minimum tap targets
- Safe-area padding for iPhone notch
- Active tab indicator
- Fixed bottom position

---

# 3️⃣ “More” Menu Sheet

The **More tab** opens a bottom sheet with secondary pages.

Menu:

```
Rooms
Room Status
Channel Manager
Properties
Settings
Sign Out
```

This keeps the bottom navigation **clean and focused on daily operations**.

---

# 4️⃣ Layout Changes

### `DashboardLayout.tsx`

Add bottom nav.

```
<BottomNav />
```

Add mobile padding:

```
pb-20 md:pb-0
```

This prevents content from hiding behind the nav.

---

### `AppSidebar.tsx`

No change for desktop.

Add:

```
hidden md:flex
```

Sidebar disappears on mobile.

---

### `AppHeader.tsx`

Remove sidebar toggle on mobile.

Keep:

- property selector
- notification bell
- current time

---

# 5️⃣ Mobile Dashboard Layout

Mobile dashboard should be **action-focused**, not data-heavy.

Structure:

```
Today

Arrivals: 5
Departures: 3
Occupied: 21

Rooms Needing Cleaning
Room 203
Room 305

Quick Actions
[ New Booking ]
[ Check In ]
[ Check Out ]
```

Use large buttons and cards.

Avoid:

❌ large tables  
  
❌ heavy charts

---

# 6️⃣ Convert Tables → Mobile Cards

Tables are difficult on small screens.

Use responsive layout switching.

Example:

### Desktop

```
Room | Guest | Status | Dates
```

### Mobile

```
Room 201
John Smith

May 10 → May 13
Status: Confirmed

[View Booking]
```

---

### Files to update

```
BookingTable.tsx
ActivityTable.tsx
Dashboard tables
```

Render:

```
table (desktop)
cards (mobile)
```

---

# 7️⃣ Booking Cards Behavior

Each card shows:

```
Guest Name
Room Number
Check-in → Check-out
Status badge
```

Tap → booking details page.

---

# 8️⃣ Mobile Availability Calendar

Calendar must support **horizontal scrolling**.

Example:

```
Room 101 | ■ ■ □ □ □
Room 102 | ■ ■ ■ □ □
Room 103 | □ □ □ □ □
```

Rules:

- sticky room column
- horizontal scroll
- tap cell → booking popup

---

# 9️⃣ Floating Quick Booking Button

Add a floating button:

```
+
```

Tap opens quick actions:

```
New Booking
Walk-in
Check-in
Check-out
```

This saves receptionists time.

---

# 🔟 CSS Improvements

Update `index.css`.

Add safe-area support:

```
padding-bottom: env(safe-area-inset-bottom);
```

Bottom nav styling:

```
position: fixed;
bottom: 0;
backdrop-filter: blur(10px);
```

Add mobile card spacing.

---

# Files to Create

```
src/components/layout/BottomNav.tsx
src/components/mobile/BookingCard.tsx
```

---

# Files to Modify

```
vite.config.ts
index.html
DashboardLayout.tsx
AppSidebar.tsx
AppHeader.tsx
BookingTable.tsx
Index.tsx (dashboard)
index.css
package.json
```

---

# What Will NOT Change

Desktop experience stays exactly the same.

Sidebar remains for large screens.

No backend logic changes.

---

# Final Mobile Navigation Structure

```
🏠 Dashboard
📅 Availability
📖 Bookings
➕ New Booking
☰ More
```

---

# Result After Implementation

Your PMS becomes:

- installable mobile app 📱
- fast for reception staff
- touch-friendly
- modern SaaS UI
- works offline partially

Very similar UX style used by apps from:

- Airbnb
- Stripe
- Notion

---

# Next Upgrade (After Mobile UI)

Once this is done, the **next big upgrade** should be:

**Drag-and-drop booking calendar**

Example:

```
Room 101  ███
Room 102
```

Drag booking to change room or dates.

This is how professional hotel systems operate.