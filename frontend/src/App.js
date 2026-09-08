import "@/index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { CategoryThemeProvider } from "@/context/CategoryThemeContext";
import Home from "@/pages/Home";
import VendorList from "@/pages/VendorList";
import VendorProfile from "@/pages/VendorProfile";
import Favorites from "@/pages/Favorites";
import MyEvent from "@/pages/MyEvent";
import Notifications from "@/pages/Notifications";
import VendorDashboard from "@/pages/vendor/VendorDashboard";
import AdminDashboard from "@/pages/admin/AdminDashboard";

function App() {
  return (
    <AuthProvider>
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
            <Route path="/vendor" element={<VendorDashboard />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors />
      </CategoryThemeProvider>
    </AuthProvider>
  );
}

export default App;
