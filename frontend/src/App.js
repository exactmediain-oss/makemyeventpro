import "@/index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { CategoryThemeProvider } from "@/context/CategoryThemeContext";
import { LocationProvider } from "@/context/LocationContext";
import Home from "@/pages/Home";
import VendorList from "@/pages/VendorList";
import VendorProfile from "@/pages/VendorProfile";
import Favorites from "@/pages/Favorites";
import MyEvent from "@/pages/MyEvent";
import Notifications from "@/pages/Notifications";
import MyEnquiries from "@/pages/MyEnquiries";
import EnquiryDetail from "@/pages/EnquiryDetail";
import MyBookings from "@/pages/MyBookings";
import BookingDetail from "@/pages/BookingDetail";
import PaymentSuccess from "@/pages/PaymentSuccess";
import Profile from "@/pages/Profile";
import VendorDashboard from "@/pages/vendor/VendorDashboard";
import VendorOnboarding from "@/pages/vendor/VendorOnboarding";
import AdminDashboard from "@/pages/admin/AdminDashboard";

function App() {
  return (
    <AuthProvider>
      <LocationProvider>
        <CategoryThemeProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/search" element={<VendorList />} />
              <Route path="/category/:slug" element={<VendorList />} />
              <Route path="/vendor/:slug" element={<VendorProfile />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/my-event" element={<MyEvent />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/enquiries" element={<MyEnquiries />} />
              <Route path="/enquiries/:id" element={<EnquiryDetail />} />
              <Route path="/bookings" element={<MyBookings />} />
              <Route path="/bookings/:id" element={<BookingDetail />} />
              <Route path="/payment/success" element={<PaymentSuccess />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/vendor" element={<VendorDashboard />} />
              <Route path="/vendor/onboarding" element={<VendorOnboarding />} />
              <Route path="/vendor/bookings" element={<VendorDashboard />} />
              <Route path="/vendor/leads/:id" element={<EnquiryDetail vendorView />} />
              <Route path="/admin" element={<AdminDashboard />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="top-center" richColors />
        </CategoryThemeProvider>
      </LocationProvider>
    </AuthProvider>
  );
}

export default App;
