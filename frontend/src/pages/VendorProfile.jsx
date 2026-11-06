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

  const [reviews, setReviews] = useState([]);
  const [ratingSummary, setRatingSummary] = useState(null);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState("");

  useEffect(() => {
    const fetchVendor = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get(`/vendors/${vendorId}`);
        setVendor(response.data);
      } catch (err) {
        setError(
          err.response?.data?.detail || "Unable to load vendor profile.",
        );
      } finally {
        setLoading(false);
      }
    };

    const fetchReviews = async () => {
      try {
        setReviewsLoading(true);
        setReviewsError("");

        const [reviewsResponse, summaryResponse] = await Promise.all([
          api.get(`/reviews/vendor/${vendorId}`, {
            params: { skip: 0, limit: 20 },
          }),
          api.get(`/reviews/vendor/${vendorId}/summary`),
        ]);

        setReviews(reviewsResponse.data);
        setRatingSummary(summaryResponse.data);
      } catch (err) {
        console.error("Failed to load vendor reviews:", err);

        setReviewsError(
          err.response?.data?.detail || "Unable to load customer reviews.",
        );
      } finally {
        setReviewsLoading(false);
      }
    };

    fetchVendor();
    fetchReviews();
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
          <button className="vp-brand" onClick={() => navigate("/dashboard")}>
            <span className="vp-brand-icon">D</span>
            <span>DailyDrill</span>
          </button>

          <button className="vp-back-btn" onClick={() => navigate(-1)}>
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
            <div className="vp-avatar">{initials || "V"}</div>

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

              <p className="vp-subtitle">Local home service professional</p>
            </div>
          </div>

          <div className="vp-hero-actions">
            <button
              className="book-service-btn"
              onClick={() => navigate(`/booking/${vendorId}`)}
            >
              Book Service <span aria-hidden="true">→</span>
            </button>

            <div className="vp-profile-id">
              <span>PROFILE ID</span>
              <strong>#{vendor.vendor_id}</strong>
            </div>
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
                    <div
                      className="vp-service-item"
                      key={`${category}-${index}`}
                    >
                      <span className="vp-service-check">✓</span>
                      <span>{category}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="vp-muted">No services have been listed.</p>
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
            {/* CUSTOMER REVIEWS */}
            <section className="vp-section vp-reviews-section">
              <div className="vp-section-heading">
                <div>
                  <span className="vp-eyebrow">CUSTOMER FEEDBACK</span>
                  <h2>Ratings & Reviews</h2>
                </div>

                <span className="vp-section-icon">★</span>
              </div>

              {reviewsLoading ? (
                <div className="vp-reviews-loading">
                  <div className="vp-loader" />
                  <p>Loading customer reviews...</p>
                </div>
              ) : reviewsError ? (
                <p className="vp-muted">{reviewsError}</p>
              ) : (
                <>
                  {/* RATING SUMMARY */}
                  <div className="vp-rating-summary">
                    <div className="vp-rating-score">
                      <strong>
                        {Number(ratingSummary?.average_rating || 0).toFixed(1)}
                      </strong>

                      <div className="vp-stars">
                        {Array.from({ length: 5 }, (_, index) => (
                          <span
                            key={index}
                            className={
                              index <
                              Math.round(ratingSummary?.average_rating || 0)
                                ? "vp-star active"
                                : "vp-star"
                            }
                          >
                            ★
                          </span>
                        ))}
                      </div>

                      <span className="vp-rating-count">
                        {ratingSummary?.total_reviews || 0} customer reviews
                      </span>
                    </div>
                  </div>

                  {/* INDIVIDUAL REVIEWS */}
                  {reviews.length > 0 ? (
                    <div className="vp-review-list">
                      {reviews.map((review) => (
                        <article className="vp-review-card" key={review.id}>
                          <div className="vp-review-top">
                            <div className="vp-review-customer">
                              <div className="vp-review-avatar">
                                {review.customer_name
                                  ?.charAt(0)
                                  ?.toUpperCase() || "C"}
                              </div>

                              <div>
                                <h3>{review.customer_name}</h3>

                                <span>
                                  {review.created_at
                                    ? new Date(
                                        review.created_at,
                                      ).toLocaleDateString("en-IN", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      })
                                    : ""}
                                </span>
                              </div>
                            </div>

                            <div className="vp-review-rating">
                              {Array.from({ length: 5 }, (_, index) => (
                                <span
                                  key={index}
                                  className={
                                    index < review.rating
                                      ? "vp-star active"
                                      : "vp-star"
                                  }
                                >
                                  ★
                                </span>
                              ))}
                            </div>
                          </div>

                          {review.comment ? (
                            <p className="vp-review-comment">
                              {review.comment}
                            </p>
                          ) : (
                            <p className="vp-review-no-comment">
                              Customer left a rating without a comment.
                            </p>
                          )}

                          <div className="vp-review-verified">
                            ✓ Review from a completed booking
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="vp-no-reviews">
                      <span>☆</span>
                      <h3>No reviews yet</h3>
                      <p>
                        Customer ratings and feedback will appear here after
                        completed bookings.
                      </p>
                    </div>
                  )}
                </>
              )}
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
