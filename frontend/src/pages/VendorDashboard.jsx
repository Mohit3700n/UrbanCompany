
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import api from "../api/axios";
import "./VendorDashboard.css";

function VendorDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");

  const fetchBookings = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
      setError("");
    }

    try {
      const response = await api.get("/bookings/vendor/requests");
      const data = response.data;

      setBookings(
        Array.isArray(data)
          ? data
          : data.bookings || data.requests || []
      );
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : "Unable to load booking requests. Please try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    api.get("/bookings/vendor/requests")
      .then((response) => {
        if (!active) return;

        const data = response.data;
        setBookings(
          Array.isArray(data)
            ? data
            : data.bookings || data.requests || []
        );
      })
      .catch((err) => {
        if (!active) return;

        const detail = err.response?.data?.detail;
        setError(
          typeof detail === "string"
            ? detail
            : "Unable to load booking requests. Please try again."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleBookingAction = async (bookingId, action) => {
    setActionLoading(`${bookingId}-${action}`);
    setError("");

    try {
      await api.patch(`/bookings/${bookingId}/${action}`);
      await fetchBookings(true);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : `Unable to ${action} this booking. Please try again.`
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const filteredBookings = useMemo(() => {
    if (activeFilter === "all") return bookings;

    return bookings.filter(
      (booking) => booking.status?.toLowerCase() === activeFilter
    );
  }, [bookings, activeFilter]);

  const pendingCount = bookings.filter(
    (booking) => booking.status?.toLowerCase() === "pending"
  ).length;

  const acceptedCount = bookings.filter(
    (booking) => booking.status?.toLowerCase() === "accepted"
  ).length;

  const completedCount = bookings.filter(
    (booking) => booking.status?.toLowerCase() === "completed"
  ).length;

  const formatDate = (value) => {
    if (!value) return "Date not available";

    return new Date(value).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  };

  const formatTime = (value) => {
    if (!value) return "";

    return new Date(value).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });
  };

  const statusLabel = (status) => {
    const labels = {
      pending: "New Request",
      accepted: "Accepted",
      rejected: "Rejected",
      cancelled: "Cancelled",
      in_progress: "In Progress",
      completed: "Completed",
    };

    return labels[status?.toLowerCase()] || status || "Unknown";
  };

  return (
    <div className="vendor-dashboard">
      <header className="vendor-navbar">
        <div className="vendor-brand">
          <div className="vendor-brand-icon">D</div>
          <span>DailyDrill</span>
          <span className="vendor-brand-tag">PARTNER</span>
        </div>

        <div className="vendor-nav-right">
          <div className="vendor-user-info">
            <div className="vendor-user-avatar">
              {user?.full_name?.charAt(0)?.toUpperCase() || "V"}
            </div>
            <div>
              <strong>{user?.full_name || "Vendor"}</strong>
              <span>Service Provider</span>
            </div>
          </div>

          <button className="vendor-logout" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <main className="vendor-main">
        <section className="vendor-welcome">
          <div>
            <span className="vendor-eyebrow">VENDOR WORKSPACE</span>
            <h1>Welcome back, {user?.full_name?.split(" ")[0] || "Partner"}.</h1>
            <p>Manage your service requests and keep your bookings on track.</p>
          </div>

          <button
            className="vendor-refresh"
            onClick={() => fetchBookings(true)}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "↻ Refresh"}
          </button>
        </section>

        <section className="vendor-stats">
          <article className="vendor-stat-card">
            <span className="vendor-stat-icon">▤</span>
            <div>
              <p>Total requests</p>
              <h2>{bookings.length}</h2>
            </div>
          </article>

          <article className="vendor-stat-card">
            <span className="vendor-stat-icon pending-icon">◷</span>
            <div>
              <p>Pending requests</p>
              <h2>{pendingCount}</h2>
            </div>
          </article>

          <article className="vendor-stat-card">
            <span className="vendor-stat-icon accepted-icon">✓</span>
            <div>
              <p>Accepted bookings</p>
              <h2>{acceptedCount}</h2>
            </div>
          </article>

          <article className="vendor-stat-card">
            <span className="vendor-stat-icon completed-icon">★</span>
            <div>
              <p>Completed services</p>
              <h2>{completedCount}</h2>
            </div>
          </article>
        </section>

        <section className="vendor-bookings-section">
          <div className="vendor-section-heading">
            <div>
              <span className="vendor-eyebrow">BOOKING MANAGEMENT</span>
              <h2>Service requests</h2>
              <p>Review customer requests and manage your bookings.</p>
            </div>
          </div>

          <div className="vendor-filters">
            {[
              { value: "all", label: "All requests" },
              { value: "pending", label: "Pending" },
              { value: "accepted", label: "Accepted" },
              { value: "in_progress", label: "In progress" },
              { value: "completed", label: "Completed" },
            ].map((filter) => (
              <button
                key={filter.value}
                className={
                  activeFilter === filter.value ? "active" : ""
                }
                onClick={() => setActiveFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="vendor-error" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <div className="vendor-empty-state">
              Loading booking requests...
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="vendor-empty-state">
              <div className="vendor-empty-icon">▤</div>
              <h3>No bookings found</h3>
              <p>
                {activeFilter === "all"
                  ? "New customer booking requests will appear here."
                  : `You don't have any ${activeFilter.replace("_", " ")} bookings.`}
              </p>
            </div>
          ) : (
            <div className="vendor-booking-list">
              {filteredBookings.map((booking) => {
                const status = booking.status?.toLowerCase();
                const isPending = status === "pending";

                return (
                  <article className="vendor-booking-card" key={booking.id}>
                    <div className="vendor-booking-top">
                      <div>
                        <span className="vendor-booking-id">
                          BOOKING #{booking.id}
                        </span>
                        <h3>{booking.customer_name || "Customer"}</h3>
                      </div>

                      <span className={`vendor-status status-${status}`}>
                        {statusLabel(status)}
                      </span>
                    </div>

                    <div className="vendor-booking-description">
                      <span>Service requirement</span>
                      <p>{booking.problem_description}</p>
                    </div>

                    <div className="vendor-booking-meta">
                      <div>
                        <span>Appointment date</span>
                        <strong>{formatDate(booking.start_at)}</strong>
                      </div>

                      <div>
                        <span>Time</span>
                        <strong>
                          {formatTime(booking.start_at)} –{" "}
                          {formatTime(booking.end_at)}
                        </strong>
                      </div>

                      <div>
                        <span>Request received</span>
                        <strong>{formatDate(booking.created_at)}</strong>
                      </div>
                    </div>

                    {isPending && (
                      <div className="vendor-booking-actions">
                        <button
                          className="vendor-reject-btn"
                          disabled={actionLoading !== null}
                          onClick={() =>
                            handleBookingAction(booking.id, "reject")
                          }
                        >
                          {actionLoading === `${booking.id}-reject`
                            ? "Rejecting..."
                            : "Reject"}
                        </button>

                        <button
                          className="vendor-accept-btn"
                          disabled={actionLoading !== null}
                          onClick={() =>
                            handleBookingAction(booking.id, "accept")
                          }
                        >
                          {actionLoading === `${booking.id}-accept`
                            ? "Accepting..."
                            : "Accept booking"}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default VendorDashboard;
