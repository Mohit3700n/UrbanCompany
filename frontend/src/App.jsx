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
          <Route
            path="/"
            element={
              <HomeRedirect />
            }
          />

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
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;