# Kings Bay PMS — Property Management System

A production-grade, multi-property Hotel Property Management System built for hospitality teams to manage bookings, guests, rooms, housekeeping, channels, and revenue — all from one dashboard.

---

## 🏨 Core Features

### Dashboard
- Real-time overview of occupancy, arrivals, departures, and revenue
- Today's check-ins and check-outs with quick-action buttons
- Revenue summary in LKR with live USD conversion
- Recent guest feedback widget

### Bookings
- Create, edit, and manage bookings with full lifecycle tracking
- Statuses: Pending → Confirmed → Checked In → Checked Out (+ Cancelled, No Show, Archived)
- Booking source tracking (Direct, Airbnb, Booking.com, Agoda, Expedia)
- OTA commission and bank fee tracking
- Overlap prevention with real-time availability checks
- Extend stay and room move capabilities
- Booking timeline view for visual date tracking
- Automated confirmation emails via Resend

### Front Desk
- Live board of today's arrivals, in-house guests, and departures
- One-click check-in / check-out
- Payment recording with multiple methods (Cash, Card, Bank Transfer, Online)
- Room move dialog for reassigning guests
- Payment status badges and balance tracking

### Rooms
- Room inventory management by property
- Room types, floor assignments, amenities, and pricing
- Room status tracking: Available, Occupied, Reserved, Maintenance
- Max guest capacity per room

### Availability Calendar
- Visual month-view calendar showing room availability across all rooms
- Color-coded cells: Available, Booked, Check-in, Check-out, Blocked
- Per-property filtering
- Booking date logic: blocks `[check_in, check_out)` — never blocks checkout date

### Housekeeping
- Kanban-style board with columns: Dirty → Cleaning → Clean → Inspected
- Drag-and-drop room transitions (desktop)
- Staff assignment per room
- Auto-cleaning timer with configurable duration
- Real-time updates via database subscriptions

### Guest Management
- Full guest profiles: name, phone, email, nationality, address, ID/passport
- Guest types: Local and International
- VIP and Blacklist flags with reasons
- Passport/ID photo upload with secure storage
- NIC and passport number fields
- Total stays and total spent tracking
- Guest view audit logs
- Duplicate guest detection and merge tool (Admin only)
- Lifecycle: Active → Archived (after 1 month) → Soft Deleted (after 13 months)
- Restore capability for archived/deleted guests

### Guest Services
- Add services to active bookings (Room Service, Transport, Facilities, Special Requests)
- Service catalog management with pricing
- Per-booking service history with totals

### Invoices & Payments
- Auto-generated invoice numbers (INV-000001)
- Room charges + service charges + tax breakdown
- Payment status: Pending, Partial, Paid
- Printable invoice view
- Transaction ledger with double-entry accounting

### Channel Manager
- Connect OTA channels: Airbnb, Booking.com, Agoda, Expedia
- iCal import/export for calendar sync
- Email-based booking import (parse inbound OTA emails)
- Room mapping: map external room types to internal rooms
- Sync logs and error tracking
- Commission rate configuration per channel
- Needs Review queue for imported bookings requiring attention

### Reports
- **Occupancy Report**: Daily/monthly occupancy rates by property
- **Revenue Report**: Income breakdown by source, room, and period
- **Financial Summary**: Revenue vs expenses with ledger integration
- **Feedback Report**: Guest satisfaction trends and category analysis

### Notifications
- In-app notification center with real-time updates
- Role-based notification targeting (Admin, Manager, Front Desk)
- Categories: Booking, Check-in/Check-out, Maintenance, Channel Sync, General
- Priority levels: Low, Medium, High
- Browser push notification support
- Auto-cleanup of expired notifications

### Guest Feedback
- Post-checkout feedback collection
- 1–5 star rating system
- Category-based ratings (Cleanliness, Service, Comfort, etc.)
- Comment field for detailed feedback
- Feedback displayed on guest profiles and booking details

---

## 🏢 Multi-Property Support

- Manage multiple properties from a single account
- Property types: Hotel, Villa, Resort, Apartment, Guesthouse
- Property selector in the header with "All Properties" aggregate view
- Strict data isolation — every query respects `property_id`
- Per-property inventory settings (check-in/check-out times, hold timeouts, FX rates)

---

## 👥 Role-Based Access Control

| Role | Permissions |
|------|------------|
| **Admin** | Full access — create/edit/delete everything, manage users, danger zone |
| **Manager** | Read/write access to bookings, guests, rooms, reports |
| **Front Desk** | Operational access — check-in/out, payments, housekeeping, guest management |
| **Viewer** | Read-only access — no create, edit, or delete capabilities |

---

## 💰 Currency System

- All monetary values stored in **LKR** (Sri Lankan Rupee)
- USD displayed as a computed conversion
- FX rate (`fx_usd_lkr_rate`) stored per property and updated automatically
- Dashboard always fetches the latest FX rate

---

## ⚙️ Settings

| Section | What You Can Configure |
|---------|----------------------|
| **Hotel** | Property details, contact info, check-in/check-out times |
| **Guests** | Guest list management, duplicate detection, archive/restore |
| **Services** | Service catalog with categories and pricing |
| **Channels** | OTA connections, iCal sync, email import settings |
| **Notifications** | Category preferences, delivery channels, priority thresholds |
| **Reports** | Report configuration and export options |
| **System Health** | Database status, edge function monitoring |
| **Danger Zone** | Admin-only property data purge with double confirmation |
| **Other** | Theme (Light/Dark/System), default landing page, hidden pages |

---

## 🔒 Security

- Row-Level Security (RLS) on all database tables
- Role-based access enforced at both backend (RLS) and frontend (UI)
- Passport photos stored in private storage bucket with signed URLs
- Audit logs for sensitive actions
- Password verification required for danger zone operations
- No anonymous signups — email verification required

---

## 📱 Responsive Design

- Fully responsive across Desktop, Tablet, and Mobile
- Mobile-optimized card views for bookings, guests, and rooms
- Bottom navigation bar on mobile devices
- Touch-friendly housekeeping board with action buttons
- Collapsible sidebar on desktop

---

## 🛠 Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **UI Components**: shadcn/ui, Radix UI
- **Backend**: Lovable Cloud (PostgreSQL + Edge Functions)
- **Auth**: Email-based authentication with role management
- **Email**: Resend API for transactional emails
- **Charts**: Recharts
- **PWA**: Progressive Web App support

---

## 📋 Quick Start

1. Sign up or log in at the login page
2. An admin must assign your role and property access
3. Select your property from the header dropdown
4. Start managing bookings, guests, and rooms from the sidebar

---

*Built with ❤️ by Kings Bay*
