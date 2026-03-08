

## Plan: Feedback Analytics Report + Automated Guest Emails + Testing

This covers all four requested items. Items 1-2 are implementation; items 3-4 are testing tasks to run after.

---

### 1. Feedback Analytics Report (Reports Page)

**New file**: `src/components/reports/FeedbackReport.tsx`

Following the same pattern as `RevenueReport` and `OccupancyReport` (same props interface, same card/chart layout):

- **KPI Cards**: Total reviews, average rating, response rate (feedback count / checked-out bookings)
- **Rating Trend Chart** (LineChart): Average rating per day/week over the date range
- **Rating Distribution** (BarChart): Count of 1-5 star ratings
- **Category Breakdown** (RadarChart or horizontal BarChart): Average score per category (Cleanliness, Comfort, Service, Location, Value)
- **CSV Export** button matching existing report patterns
- Property-scoped queries using the same `propertyId`/`showAllProperties` pattern

**Edit**: `src/pages/Reports.tsx`
- Add a 4th tab "Feedback" to the TabsList
- Import and render `FeedbackReport` with the same props

---

### 2. Automated Guest Emails

This requires sending transactional emails to guests (booking confirmation, pre-arrival, checkout summary). These are **not** auth emails — they are transactional emails to external guests.

**Approach**: Create an edge function that composes and sends emails. This requires an email sending service.

**Before building**: We need to determine the email delivery method. Options:
- **Lovable email domain setup** for transactional emails (if supported)
- **Third-party service** like Resend with an API key

I will ask the user about this before proceeding, as it requires API key setup.

---

### 3 & 4. Testing (Post-Implementation)

After implementing item 1, I will:
- Test feedback flow end-to-end on a checked-out booking
- Check mobile responsiveness of dashboard feedback widget and calendar

---

### Implementation Order

1. Build `FeedbackReport.tsx` and add tab to Reports page
2. Clarify email sending approach with user before building Automated Guest Emails
3. Run mobile and E2E tests

