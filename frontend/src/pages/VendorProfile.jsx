
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import "./VendorProfile.css";

function VendorProfile() {
  const { vendorId } = useParams();
  const navigate = useNavigate();

  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchVendor = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get(`/vendors/${vendorId}`);
        setVendor(response.data);
      } catch (err) {
        setError(
          err.response?.data?.detail ||
          "Unable to load vendor profile."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchVendor();
  }, [vendorId]);

  if (loading) {
    return (
      <div className="vp-state">
        <div className="vp-loader" />
        <p>Loading professional profile...</p>
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="vp-state">
        <div className="vp-error-icon">!</div>
        <h2>Profile unavailable</h2>
        <p>{error || "This vendor profile could not be found."}</p>
        <button className="vp-primary-btn" onClick={() => navigate(-1)}>
          Go back
        </button>
      </div>
    );
  }

  const initials = vendor.business_name
    ?.split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <div className="vp-page">

      {/* NAVBAR */}
      <header className="vp-navbar">
        <div className="vp-nav-inner">
          <button
            className="vp-brand"
            onClick={() => navigate("/dashboard")}
          >
            <span className="vp-brand-icon">D</span>
            <span>DailyDrill</span>
          </button>

          <button
            className="vp-back-btn"
            onClick={() => navigate(-1)}
          >
            ← Back to results
          </button>

          <span className="vp-nav-label">Professional Profile</span>
        </div>
      </header>

      <main className="vp-container">

        {/* BREADCRUMB */}
        <div className="vp-breadcrumb">
          <span onClick={() => navigate("/dashboard")}>Home</span>
          <span>/</span>
          <span>Professionals</span>
          <span>/</span>
          <strong>{vendor.business_name}</strong>
        </div>

        {/* PROFILE HERO */}
        <section className="vp-hero">

          <div className="vp-hero-main">

            <div className="vp-avatar">
              {initials || "V"}
            </div>

            <div className="vp-hero-info">
              <div className="vp-badges">
                <span className="vp-verified">
                  <span>✓</span> Verified professional
                </span>

                <span
                  className={`vp-availability ${
                    vendor.accepting_requests
                      ? "is-available"
                      : "is-unavailable"
                  }`}
                >
                  <span className="vp-status-dot" />
                  {vendor.accepting_requests
                    ? "Accepting requests"
                    : "Currently unavailable"}
                </span>
              </div>

              <h1>{vendor.business_name}</h1>

              <p className="vp-location">
                <span>⌖</span>
                {vendor.address_label}
              </p>

              <p className="vp-subtitle">
                Local home service professional
              </p>
            </div>

          </div>

          <div className="vp-profile-id">
            <span>PROFILE ID</span>
            <strong>#{vendor.vendor_id}</strong>
          </div>

        </section>

        {/* MAIN CONTENT */}
        <div className="vp-layout">

          <div className="vp-content">

            {/* ABOUT */}
            <section className="vp-section">
              <div className="vp-section-heading">
                <div>
                  <span className="vp-eyebrow">GET TO KNOW THEM</span>
                  <h2>About this professional</h2>
                </div>
                <span className="vp-section-icon">✦</span>
              </div>

              <p className="vp-about-text">
                {vendor.description ||
                  "This professional has not added a business description yet."}
              </p>
            </section>

            {/* SERVICES */}
            <section className="vp-section">
              <div className="vp-section-heading">
                <div>
                  <span className="vp-eyebrow">WHAT THEY OFFER</span>
                  <h2>Services provided</h2>
                </div>
                <span className="vp-section-icon">⌘</span>
              </div>

              {vendor.categories?.length > 0 ? (
                <div className="vp-service-list">
                  {vendor.categories.map((category, index) => (
                    <div className="vp-service-item" key={`${category}-${index}`}>
                      <span className="vp-service-check">✓</span>
                      <span>{category}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="vp-muted">
                  No services have been listed.
                </p>
              )}
            </section>

            {/* LOCATION */}
            <section className="vp-section">
              <div className="vp-section-heading">
                <div>
                  <span className="vp-eyebrow">WHERE THEY OPERATE</span>
                  <h2>Service location</h2>
                </div>
                <span className="vp-section-icon">⌖</span>
              </div>

              <div className="vp-location-card">
                <div className="vp-map-icon">⌖</div>
                <div>
                  <strong>Business location</strong>
                  <p>{vendor.address_label}</p>
                </div>
              </div>
            </section>

          </div>

          {/* RIGHT SIDEBAR */}
          <aside className="vp-sidebar">

            <div className="vp-contact-card">
              <span className="vp-eyebrow">PROFESSIONAL STATUS</span>

              <h3>
                {vendor.accepting_requests
                  ? "Ready to receive requests"
                  : "Not accepting requests"}
              </h3>

              <p>
                {vendor.accepting_requests
                  ? "This professional is currently accepting new service requests."
                  : "This professional is currently unavailable for new requests."}
              </p>

              <div className="vp-divider" />

              <div className="vp-info-row">
                <span>Account status</span>
                <strong className="vp-approved">Approved</strong>
              </div>

              <div className="vp-info-row">
                <span>Availability</span>
                <strong>
                  {vendor.accepting_requests ? "Available" : "Unavailable"}
                </strong>
              </div>

                  <button
                    className="book-service-btn"
                    onClick={() => navigate(`/booking/${vendorId}`)}
                  >
                    Book Service
                  </button>

              <div className="vp-info-row">
                <span>Services listed</span>
                <strong>{vendor.categories?.length || 0}</strong>
              </div>

              <div className="vp-divider" />

              <div className="vp-trust-note">
                <span>✓</span>
                <p>
                  This profile belongs to an approved DailyDrill professional.
                </p>
              </div>
            </div>

            <div className="vp-help-card">
              <span>Need help?</span>
              <p>
                Explore other local professionals if this provider is
                unavailable.
              </p>
              <button onClick={() => navigate(-1)}>
                Explore professionals →
              </button>
            </div>

          </aside>

        </div>

        {/* FOOTER */}
        <footer className="vp-footer">
          <span>© {new Date().getFullYear()} DailyDrill</span>
          <span>Everyday services, made easier.</span>
        </footer>

      </main>
    </div>
  );
}

export default VendorProfile;
