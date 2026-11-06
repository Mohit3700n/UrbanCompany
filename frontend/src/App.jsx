import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "./context/AuthProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/useAuth";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ServiceDiscovery from "./pages/ServiceDiscovery";
import VendorProfile from "./pages/VendorProfile";
import BookingPage from "./pages/BookingPage";
import VendorDashboard from "./pages/VendorDashboard";
import VendorOnboarding from "./pages/VendorOnboarding";
import VendorPendingApproval from "./pages/VendorPendingApproval";
import AdminDashboard from "./pages/AdminDashboard";

function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) return <p>Loading...</p>;

  if (!user) return <Navigate to="/login" replace />;

  return (
    <Navigate
      to={user.role === "vendor" ? "/vendor-dashboard" : "/dashboard"}
      replace
    />
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />

          <Route path="/login" element={<Login />} />

          <Route path="/register" element={<Register />} />
          <Route path="/discovery" element={<ServiceDiscovery />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={["customer"]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/find-services"
            element={
              <ProtectedRoute allowedRoles={["customer"]}>
                <ServiceDiscovery />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendors/:vendorId"
            element={
              <ProtectedRoute allowedRoles={["customer"]}>
                <VendorProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/booking/:vendorId"
            element={
              <ProtectedRoute allowedRoles={["customer"]}>
                <BookingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendor-dashboard"
            element={
              <ProtectedRoute allowedRoles={["vendor"]}>
                <VendorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendor-onboarding"
            element={
              <ProtectedRoute allowedRoles={["vendor"]}>
                <VendorOnboarding />
              </ProtectedRoute>
            }
          />

          <Route
            path="/vendor-pending-approval"
            element={
              <ProtectedRoute allowedRoles={["vendor"]}>
                <VendorPendingApproval />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
