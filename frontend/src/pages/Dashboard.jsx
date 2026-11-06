import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import api from "../api/axios";
import "./Dashboard.css";

const suggestedServices = [
  { icon: "⚡", name: "Electrician", prompt: "I need an electrician" },
  { icon: "🔧", name: "Plumber", prompt: "I need a plumber" },
  { icon: "🪚", name: "Carpenter", prompt: "I need a carpenter" },
  { icon: "❄️", name: "AC Repair", prompt: "I need an AC repair technician" },
  { icon: "🧹", name: "Cleaning", prompt: "I need home cleaning service" },
  { icon: "🎨", name: "Painter", prompt: "I need a house painter" },
];

function Dashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [message, setMessage] = useState("");
  const [originalMessage, setOriginalMessage] = useState("");
  const [isFollowUp, setIsFollowUp] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState("");
  const [refreshingBookings, setRefreshingBookings] = useState(false);

  const fetchBookings = async (isRefresh = false) => {
  // These state updates are only needed for manual refresh.
  // They are safe because refresh is triggered by a button click.
  if (isRefresh) {
    setRefreshingBookings(true);
    setBookingsError("");
  }

  try {
    const response = await api.get("/bookings/my");

    const data = response.data;

    setBookings(
      Array.isArray(data) ? data : data.bookings || []
    );
  } catch (err) {
    const detail = err.response?.data?.detail;

    setBookingsError(
      typeof detail === "string"
        ? detail
        : "Unable to load your bookings. Please try again."
    );
  } finally {
    setBookingsLoading(false);
    setRefreshingBookings(false);
  }
};

useEffect(() => {
  let isMounted = true;

  api.get("/bookings/my")
    .then((response) => {
      if (!isMounted) return;

      const data = response.data;

      setBookings(
        Array.isArray(data) ? data : data.bookings || []
      );
    })
    .catch((err) => {
      if (!isMounted) return;

      const detail = err.response?.data?.detail;

      setBookingsError(
        typeof detail === "string"
          ? detail
          : "Unable to load your bookings. Please try again."
      );
    })
    .finally(() => {
      if (isMounted) {
        setBookingsLoading(false);
      }
    });

  return () => {
    isMounted = false;
  };
}, []);


const bookingStages = [
  { key: "pending", label: "Request Sent" },
  { key: "accepted", label: "Accepted" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
];

const getBookingStage = (status) => {
  return bookingStages.findIndex((stage) => stage.key === status);
};

const formatBookingDate = (value) => {
  if (!value) return "Date unavailable";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
};

const formatBookingTime = (value) => {
  if (!value) return "Time unavailable";

  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
};

const getBookingStatusLabel = (status) => {
  const labels = {
    pending: "Waiting for vendor",
    accepted: "Booking accepted",
    in_progress: "Service in progress",
    completed: "Service completed",
    rejected: "Request rejected",
    cancelled: "Booking cancelled",
  };

  return labels[status] || status;
};

  const handleSearch = async (e) => {
    e.preventDefault();

    const currentMessage = message.trim();
    if (!currentMessage || loading) return;

    setLoading(true);
    setError("");
    setResult(null);

    const searchMessage = isFollowUp
      ? `${originalMessage}\nAdditional information: ${currentMessage}`
      : currentMessage;

    if (!isFollowUp) {
      setOriginalMessage(currentMessage);
    }

    try {
      const response = await api.post("/ai/find-vendors", {
        message: searchMessage,
        max_radius_km: 20,
        limit: 20,
      });

      const data = response.data;
      setResult(data);

      if (data.status === "needs_clarification") {
        setIsFollowUp(true);
        setMessage("");
      } else {
        setIsFollowUp(false);
        setOriginalMessage("");
        setMessage("");
      }
    } catch (err) {
      const detail = err.response?.data?.detail;

      setError(
        typeof detail === "string"
          ? detail
          : "Unable to find services right now. Please try again."
      );
      setIsFollowUp(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestion = (prompt) => {
    setMessage(prompt);
    setResult(null);
    setError("");
    setIsFollowUp(false);
    setOriginalMessage("");
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch {
      setError("Unable to log out. Please try again.");
    }
  };

  const vendors = result?.vendors || [];

  return (
    <div className="dashboard-page">
      {/* NAVBAR */}
      <header className="dashboard-navbar">
        <div className="dashboard-nav-left">
          <div className="dashboard-brand-icon">D</div>
          <span className="dashboard-brand-name">DailyDrill</span>
        </div>

        <nav className="dashboard-nav-links">
          <a href="#home" className="dashboard-nav-active">Home</a>
          <a href="#services">Explore Services</a>
          <a href="#my-bookings">My Bookings</a>
        </nav>

        
        <div className="dashboard-nav-right">
          <span className="dashboard-user-label">Customer</span>
          <button onClick={handleLogout} className="dashboard-logout">
            Log out
          </button>
        </div>
      </header>

      <main id="home" className="dashboard-main">
        {/* HERO + SEARCH */}
        <section className="dashboard-hero">
          <div className="dashboard-hero-content">
            <span className="dashboard-eyebrow">
              LOCAL SERVICES. MADE SIMPLE.
            </span>

            <h1>
              What do you need
              <br />
              <span>help with today?</span>
            </h1>

            <p>
              Describe your problem in your own words. We'll help you discover
              relevant service professionals nearby.
            </p>

            <form className="dashboard-search-form" onSubmit={handleSearch}>
              <div className="dashboard-search-input-wrap">
                <span className="dashboard-search-icon">⌕</span>
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    isFollowUp
                      ? "Enter the additional details..."
                      : "e.g. My kitchen tap is leaking. I need a plumber in Palghar."
                  }
                  aria-label="Describe the service you need"
                />
                {message && (
                  <button
                    type="button"
                    className="dashboard-clear-search"
                    onClick={() => setMessage("")}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>

              <button
                type="submit"
                className="dashboard-search-button"
                disabled={loading || !message.trim()}
              >
                {loading ? "Searching..." : "Find services"}
                {!loading && <span>→</span>}
              </button>
            </form>

            <div className="dashboard-search-hint">
              <span>✦</span>
              You can describe your problem in English, Hindi or Hinglish.
            </div>

            {isFollowUp && result?.clarification_question && (
              <div className="dashboard-clarification">
                <strong>One more detail needed</strong>
                <p>{result.clarification_question}</p>
              </div>
            )}

            {error && (
              <div className="dashboard-error">
                {error}
              </div>
            )}
          </div>

          <div className="dashboard-hero-visual">
            <div className="dashboard-visual-circle">
              <div className="dashboard-visual-center">D</div>
              <span className="dashboard-floating-icon icon-one">🔧</span>
              <span className="dashboard-floating-icon icon-two">⚡</span>
              <span className="dashboard-floating-icon icon-three">🧹</span>
              <span className="dashboard-floating-icon icon-four">🎨</span>
            </div>
            <div className="dashboard-visual-caption">
              <span className="dashboard-online-dot"></span>
              Find the right professional for the job
            </div>
          </div>
        </section>

        {/* SUGGESTED SERVICES */}
        <section id="services" className="dashboard-services">
          <div className="dashboard-section-heading">
            <div>
              <span className="dashboard-section-label">QUICK DISCOVERY</span>
              <h2>Popular services</h2>
              <p>Choose a service or describe exactly what you need above.</p>
            </div>
          </div>

          <div className="dashboard-service-grid">
            {suggestedServices.map((service) => (
              <button
                key={service.name}
                className="dashboard-service-card"
                onClick={() => handleSuggestion(service.prompt)}
                type="button"
              >
                <span className="dashboard-service-icon">{service.icon}</span>
                <span className="dashboard-service-name">{service.name}</span>
                <span className="dashboard-service-arrow">↗</span>
              </button>
            ))}
          </div>
        </section>

        {/* MY BOOKINGS */}
<section id="my-bookings" className="dashboard-bookings">
  <div className="dashboard-section-heading bookings-heading">
    <div>
      <span className="dashboard-section-label">YOUR ACTIVITY</span>
      <h2>My Bookings</h2>
      <p>Track your service requests and booking progress.</p>
    </div>

    <button
      className="bookings-refresh-btn"
      onClick={() => fetchBookings(true)}
      disabled={refreshingBookings}
    >
      {refreshingBookings ? "Refreshing..." : "↻ Refresh"}
    </button>
  </div>

  {bookingsLoading ? (
    <div className="bookings-empty">
      Loading your bookings...
    </div>
  ) : bookingsError ? (
    <div className="bookings-error">
      <p>{bookingsError}</p>
      <button onClick={() => fetchBookings(true)}>
        Try Again
      </button>
    </div>
  ) : bookings.length === 0 ? (
    <div className="bookings-empty">
      <div className="bookings-empty-icon">📋</div>
      <h3>No bookings yet</h3>
      <p>
        Your service bookings will appear here once you book a professional.
      </p>
      <button
        onClick={() =>
          document.getElementById("services")?.scrollIntoView({
            behavior: "smooth",
          })
        }
      >
        Explore Services
      </button>
    </div>
  ) : (
    <div className="dashboard-booking-list">
      {bookings.map((booking) => {
        const status = booking.status?.toLowerCase();
        const currentStage = getBookingStage(status);

        const isTerminal = ["rejected", "cancelled"].includes(status);

        return (
          <article className="dashboard-booking-card" key={booking.id}>
            <div className="booking-card-top">
              <div>
                <span className="booking-id">
                  BOOKING #{booking.id}
                </span>

                <h3>{booking.vendor_business_name}</h3>
              </div>

              <span className={`booking-status-badge ${status}`}>
                {getBookingStatusLabel(status)}
              </span>
            </div>

            <p className="booking-problem">
              {booking.problem_description}
            </p>

            <div className="booking-info-grid">
              <div>
                <span>Service Date</span>
                <strong>{formatBookingDate(booking.start_at)}</strong>
              </div>

              <div>
                <span>Scheduled Time</span>
                <strong>
                  {formatBookingTime(booking.start_at)} –{" "}
                  {formatBookingTime(booking.end_at)}
                </strong>
              </div>
            </div>

            {isTerminal ? (
              <div className={`booking-terminal-state ${status}`}>
                {status === "rejected"
                  ? "The vendor rejected this booking request."
                  : "This booking has been cancelled."}
              </div>
            ) : (
              <div className="booking-progress">
                <div className="booking-progress-heading">
                  <strong>Service Progress</strong>
                  <span>
                    {Math.max(currentStage + 1, 1)} / 4 stages
                  </span>
                </div>

                <div className="booking-progress-track">
                  {bookingStages.map((stage, index) => {
                    const isCompleted = index < currentStage;
                    const isCurrent = index === currentStage;

                    return (
                      <div
                        className={`booking-progress-step ${
                          isCompleted ? "completed" : ""
                        } ${isCurrent ? "current" : ""}`}
                        key={stage.key}
                      >
                        <div className="booking-progress-dot">
                          {isCompleted ? "✓" : index + 1}
                        </div>

                        <span>{stage.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  )}
</section>

        {/* SEARCH RESULTS */}
        {result && (
          <section className="dashboard-results">
            <div className="dashboard-results-heading">
              <div>
                <span className="dashboard-section-label">SEARCH RESULTS</span>
                <h2>
                  {result.status === "vendors_found"
                    ? "Professionals for your service"
                    : result.status === "no_vendors_found"
                    ? "No professionals found"
                    : result.status === "category_not_found"
                    ? "Service category not available"
                    : "A little more information"}
                </h2>
              </div>

              {result.status === "vendors_found" && (
                <span className="dashboard-result-count">
                  {vendors.length} found
                </span>
              )}
            </div>

            {result.status === "vendors_found" && (
              <>
                {result.location_resolution?.display_name && (
                  <p className="dashboard-location-note">
                    <span>📍</span>
                    Searching around {result.location_resolution.display_name}
                  </p>
                )}

                <div className="dashboard-vendor-grid">
                  {vendors.map((vendor, index) => (
                    <article
                      className="dashboard-vendor-card"
                      key={vendor.vendor_id || index}
                      onClick={() => navigate(`/vendors/${vendor.vendor_id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/vendors/${vendor.vendor_id}`);
                        }
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <div className="dashboard-vendor-top">
                        <div className="dashboard-vendor-avatar">
                          {(vendor.business_name || "V").charAt(0).toUpperCase()}
                        </div>
                        <span className="dashboard-vendor-distance">
                          {vendor.distance_km != null
                            ? `${Number(vendor.distance_km).toFixed(1)} km away`
                            : "Nearby"}
                        </span>
                      </div>

                      <h3>{vendor.business_name || "Service professional"}</h3>

                      <p className="dashboard-vendor-description">
                        {vendor.description || "Local service professional"}
                      </p>

                      {vendor.address_label && (
                        <p className="dashboard-vendor-address">
                          📍 {vendor.address_label}
                        </p>
                      )}

                      <div className="dashboard-vendor-footer">
                        <span className="dashboard-vendor-status">
                          <span className="dashboard-online-dot"></span>
                          {vendor.accepting_requests
                            ? "Accepting requests"
                            : "Availability not confirmed"}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}

            {result.status === "no_vendors_found" && (
              <div className="dashboard-empty-results">
                <span>🔎</span>
                <p>
                  We couldn't find matching professionals in the searched area.
                  Try a broader location or a different service description.
                </p>
              </div>
            )}

            {result.status === "category_not_found" && (
              <div className="dashboard-empty-results">
                <p>
                  {result.message ||
                    "We couldn't identify this service category. Try describing it differently."}
                </p>
              </div>
            )}
          </section>
        )}

        {/* FOOTER */}
        <footer className="dashboard-footer">
          <span>© {new Date().getFullYear()} DailyDrill</span>
          <span>Everyday services, made easier.</span>
        </footer>
      </main>
    </div>
  );
}

export default Dashboard;