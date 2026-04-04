import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { PropertyProvider } from "@/hooks/useProperty";
import { UserSettingsProvider } from "@/hooks/useUserSettings";
import { ThemeProvider } from "next-themes";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Lazy-loaded pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Bookings = lazy(() => import("./pages/Bookings"));
const NewBooking = lazy(() => import("./pages/NewBooking"));
const BookingDetails = lazy(() => import("./pages/BookingDetails"));
const Rooms = lazy(() => import("./pages/Rooms"));
const Services = lazy(() => import("./pages/Services"));
const Guests = lazy(() => import("./pages/Guests"));
const GuestDetails = lazy(() => import("./pages/GuestDetails"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const Properties = lazy(() => import("./pages/Properties"));
const ChannelManager = lazy(() => import("./pages/ChannelManager"));
const AvailabilityCalendar = lazy(() => import("./pages/AvailabilityCalendar"));
const FrontDesk = lazy(() => import("./pages/FrontDesk"));
const Housekeeping = lazy(() => import("./pages/Housekeeping"));
const Notifications = lazy(() => import("./pages/Notifications"));
const RateCalendar = lazy(() => import("./pages/RateCalendar"));
const GuestLogin = lazy(() => import("./pages/guest/GuestLogin"));
const GuestRegister = lazy(() => import("./pages/guest/GuestRegister"));
const GuestDashboard = lazy(() => import("./pages/guest/GuestDashboard"));
const GuestBooking = lazy(() => import("./pages/guest/GuestBooking"));
const GuestBookingDetails = lazy(() => import("./pages/guest/GuestBookingDetails"));
const GuestResetPassword = lazy(() => import("./pages/guest/GuestResetPassword"));
const GuestCheckin = lazy(() => import("./pages/guest/GuestCheckin"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 minutes — cached data reused instantly on navigation
      gcTime: 10 * 60 * 1000,     // 10 minutes — keep unused cache longer
      refetchOnWindowFocus: false, // Don't refetch on tab switch
      retry: 1,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <PropertyProvider>
          <UserSettingsProvider>
            <TooltipProvider>
              <Sonner />
              <BrowserRouter>
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/auth/reset-password" element={<ResetPassword />} />
                    <Route path="/bookings" element={<Bookings />} />
                    <Route path="/bookings/new" element={<NewBooking />} />
                    <Route path="/bookings/:id" element={<BookingDetails />} />
                    <Route path="/bookings/:id/checkout" element={<BookingDetails />} />
                    <Route path="/rooms" element={<Rooms />} />
                    <Route path="/services" element={<Services />} />
                    <Route path="/guests" element={<Guests />} />
                    <Route path="/guests/:id" element={<GuestDetails />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/properties" element={<Properties />} />
                    <Route path="/channels" element={<ChannelManager />} />
                    <Route path="/availability" element={<AvailabilityCalendar />} />
                    <Route path="/front-desk" element={<FrontDesk />} />
                    <Route path="/housekeeping" element={<Housekeeping />} />
                    <Route path="/notifications" element={<Notifications />} />
                    <Route path="/rate-calendar" element={<RateCalendar />} />
                    <Route path="/guest/login" element={<GuestLogin />} />
                    <Route path="/guest/register" element={<GuestRegister />} />
                    <Route path="/guest/dashboard" element={<GuestDashboard />} />
                    <Route path="/guest/book" element={<GuestBooking />} />
                    <Route path="/guest/bookings/:id" element={<GuestBookingDetails />} />
                    <Route path="/guest/reset-password" element={<GuestResetPassword />} />
                    <Route path="/guest/checkin/:bookingId" element={<GuestCheckin />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
              </BrowserRouter>
            </TooltipProvider>
          </UserSettingsProvider>
        </PropertyProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
