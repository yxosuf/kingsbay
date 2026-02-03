

# King's Bay Villa – Hotel Management System 

This is **whole structure** of the King's Bay Villa Hotel Management System, built on your original plan with added structure, clear button flows, database relationships, and integration-ready architecture.

---

## 🎯 Goals

* Improve operational flow clarity (front desk friendly)
* Clearly define **what each button does**
* Establish a **clean database schema** with relationships
* Prepare for **future integrations** (Booking.com, Airbnb, accounting, POS)
* Maintain simplicity for small/boutique hotels

---

## 🧭 SYSTEM-WIDE USER FLOW (HIGH LEVEL)

**Login → Dashboard → Daily Operations → Billing → Reports → Logout**

Staff always return to **Dashboard** as the control center.

---

## 🏠 DASHBOARD (CONTROL CENTER)

### Buttons & Actions Flow

* **Active Guests Card**
  → Click → Guest List (Checked-in only)

* **Total Revenue Card**
  → Click → Monthly Revenue Report

* **Arrivals Today Card**
  → Click → Today’s Bookings List

* **Available Rooms Card**
  → Click → Room Status Board

---

### Recent Bookings Table

**Buttons per row:**

* View → Booking Details Page
* Check-in → Status update → Room becomes Occupied
* Check-out → Invoice generation → Room becomes Available

---

## 📅 BOOKING MANAGEMENT FLOW

### New Booking Flow

1. New Booking Button
2. Enter Guest Details
3. Select Dates
4. System checks room availability
5. Select Room
6. Select Payment Method
7. Save Booking

**Status:** Pending / Confirmed

---

### Booking Status Lifecycle

Pending → Confirmed → Checked-in → Checked-out → Archived

Cancelled can occur before check-in

---

## 🛏️ ROOM MANAGEMENT FLOW

### Room Status Board

* Click Room Card
  → View Room Details
  → Change Status (Available / Occupied / Reserved / Maintenance)

* Auto-updates triggered by:

  * Check-in
  * Check-out
  * Maintenance toggle

---

## 🛎️ SERVICES MANAGEMENT FLOW

### Adding a Service to Guest

1. Open Guest Profile
2. Go to Services Tab
3. Select Service
4. Add Quantity
5. Save

→ Charge added to Guest Invoice

---

## 👤 GUEST MANAGEMENT FLOW

### Guest Profile Actions

* View Personal Info
* View Booking History
* View Current Stay
* Add Services
* Open Invoice

---

## 💰 BILLING & PAYMENTS FLOW

### Invoice Generation Flow

Checked-out → Auto Invoice Created

Invoice Includes:

* Room Charges
* Services Charges
* Taxes
* Total

---

### Payment Flow

* Select Payment Method
* Mark as Paid / Partial / Pending
* Update Outstanding Balance

---

## 📈 REPORTS FLOW

* Select Report Type
* Select Date Range
* Generate Report
* Export to Excel / CSV

---

## 🔐 AUTHENTICATION FLOW

Login → Role Check → Page Access

Roles:

* Admin
* Front Desk
* Manager

---

## 🗄️ DATABASE DESIGN (SUPABASE)

### Core Tables

#### guests

* id (PK)
* name
* phone
* email
* id_passport

#### rooms

* id (PK)
* room_number
* room_type
* price
* status

#### bookings

* id (PK)
* guest_id (FK)
* room_id (FK)
* check_in
* check_out
* status

#### services

* id (PK)
* name
* category
* price

#### guest_services

* id (PK)
* guest_id (FK)
* service_id (FK)
* quantity

#### invoices

* id (PK)
* booking_id (FK)
* total_amount
* payment_status

#### payments

* id (PK)
* invoice_id (FK)
* method
* amount
* date

#### staff

* id (PK)
* role
* email

---

## 🔗 DATABASE RELATIONSHIPS (TEXT FLOW)

* Guest → has many → Bookings
* Booking → belongs to → Room
* Booking → generates → Invoice
* Invoice → has many → Payments
* Guest → uses many → Services (via guest_services)

---

## 🔌 EXTERNAL & FUTURE INTEGRATIONS (V2 READY)

### Channel Manager (Future)

* Booking.com
* Airbnb
* Agoda

Flow:
External Booking → Sync → Bookings Table → Room Status Update

---

### Accounting Software (Future)

Invoice Data → Export → Accounting System (QuickBooks / Xero)

---

## 📦 OFFLINE & BACKUP STRATEGY

* Manual Excel Export (Bookings, Guests, Payments)
* Daily Auto Backup Option
* Local CSV Download

---

## 🚀 V2 → V3 ROADMAP (OPTIONAL)

* Multi-property support
* Cleaning & housekeeping module
* POS integration
* Mobile tablet UI
* AI demand pricing (advanced)

---

## ✅ FINAL NOTE

This V2 plan is:

* Realistic
* Buildable
* Hotel-staff friendly
* Scalable

It is **strong enough to sell** and **simple enough to run daily**.
