import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { PropertyProvider } from "@/hooks/useProperty";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Bookings from "./pages/Bookings";
import NewBooking from "./pages/NewBooking";
import BookingDetails from "./pages/BookingDetails";
import Rooms from "./pages/Rooms";
import Services from "./pages/Services";
import Guests from "./pages/Guests";
import GuestDetails from "./pages/GuestDetails";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Properties from "./pages/Properties";
import ChannelManager from "./pages/ChannelManager";
import AvailabilityCalendar from "./pages/AvailabilityCalendar";
import FrontDesk from "./pages/FrontDesk";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <PropertyProvider>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
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
              <Route path="/notifications" element={<Notifications />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </PropertyProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
