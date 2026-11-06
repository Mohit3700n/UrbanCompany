import { useEffect, useState } from "react";
import api from "../api/axios";
import "./AdminDashboard.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminDashboard() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState(null);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/admin/vendors/pending");
      setApplications(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Unable to load vendor applications.",
      );
    } finally {
      setLoading(false);
    }
  };

  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    let cancelled = false;

    const loadApplications = async () => {
      try {
        const response = await api.get("/admin/vendors/pending");

        if (!cancelled) {
          setApplications(response.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.detail || "Unable to load vendor applications.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadApplications();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleDecision = async (vendorId, action) => {
    const confirmed = window.confirm(
      `Are you sure you want to ${action} this vendor application?`,
    );

    if (!confirmed) return;

    try {
      setProcessingId(vendorId);
      setError("");

      await api.post(`/admin/vendors/${vendorId}/${action}`);

      setApplications((previous) =>
        previous.filter((vendor) => vendor.vendor_id !== vendorId),
      );
    } catch (err) {
      setError(
        err.response?.data?.detail || `Unable to ${action} this application.`,
      );
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <p className="admin-loading">Loading applications...</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <p className="admin-eyebrow">DAILYDRILL ADMINISTRATION</p>
          <h1>Vendor Applications</h1>
          <p>Review and manage vendor onboarding requests.</p>
        </div>

        <div className="admin-header-actions">
          <button className="admin-refresh-btn" onClick={fetchApplications}>
            Refresh
          </button>

          <button className="admin-logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="admin-stats">
        <div className="admin-stat-card">
          <span>Pending Applications</span>
          <strong>{applications.length}</strong>
        </div>
      </div>

      {error && <div className="admin-error">{error}</div>}

      {applications.length === 0 ? (
        <div className="admin-empty">
          <h3>No pending applications</h3>
          <p>New vendor applications will appear here.</p>
        </div>
      ) : (
        <div className="admin-application-list">
          {applications.map((vendor) => (
            <div className="admin-application-card" key={vendor.vendor_id}>
              <div className="admin-card-header">
                <div>
                  <h2>{vendor.business_name}</h2>
                  <span className="admin-pending-badge">Pending Review</span>
                </div>

                <span className="admin-id">ID: #{vendor.vendor_id}</span>
              </div>

              <div className="admin-card-section">
                <h3>Owner Information</h3>
                <p>
                  <strong>Name:</strong> {vendor.owner_name || "Not provided"}
                </p>
                <p>
                  <strong>Email:</strong> {vendor.owner_email || "Not provided"}
                </p>
                <p>
                  <strong>Phone:</strong> {vendor.phone || "Not provided"}
                </p>
              </div>

              <div className="admin-card-section">
                <h3>Business Information</h3>
                <p>
                  {vendor.description || "No business description provided."}
                </p>
              </div>

              <div className="admin-card-section">
                <h3>Selected Services</h3>
                <div className="admin-service-list">
                  {vendor.services?.length > 0 ? (
                    vendor.services.map((service) => (
                      <span key={service.id}>{service.name}</span>
                    ))
                  ) : (
                    <p>No services selected.</p>
                  )}
                </div>
              </div>

              <div className="admin-card-section">
                <h3>Business Location</h3>
                <p>{vendor.address_label || "Address not provided"}</p>

                {vendor.latitude != null && vendor.longitude != null && (
                  <a
                    href={`https://www.google.com/maps?q=${vendor.latitude},${vendor.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="admin-map-link"
                  >
                    View on Google Maps
                  </a>
                )}
              </div>

              <div className="admin-card-actions">
                <button
                  className="admin-reject-btn"
                  disabled={processingId === vendor.vendor_id}
                  onClick={() => handleDecision(vendor.vendor_id, "reject")}
                >
                  Reject
                </button>

                <button
                  className="admin-approve-btn"
                  disabled={processingId === vendor.vendor_id}
                  onClick={() => handleDecision(vendor.vendor_id, "approve")}
                >
                  {processingId === vendor.vendor_id
                    ? "Processing..."
                    : "Approve Vendor"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
