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

const searchResultStorageKey = "dailydrill:dashboard-search-result";
const persistableSearchStatuses = [
  "vendors_found",
  "no_vendors_found",
  "category_not_found",
];

const getStoredSearchResult = () => {
  try {
    const storedResult = window.sessionStorage.getItem(searchResultStorageKey);
    if (!storedResult) return null;

    const parsedResult = JSON.parse(storedResult);
    return persistableSearchStatuses.includes(parsedResult?.status)
      ? parsedResult
      : null;
  } catch (err) {
    console.error("Unable to restore dashboard search results.", err);
    return null;
  }
};

const storeSearchResult = (searchResult) => {
  try {
    window.sessionStorage.setItem(
      searchResultStorageKey,
      JSON.stringify(searchResult),
    );
  } catch (err) {
    console.error("Unable to save dashboard search results.", err);
  }
};

const clearStoredSearchResult = () => {
  try {
    window.sessionStorage.removeItem(searchResultStorageKey);
  } catch (err) {
    console.error("Unable to clear dashboard search results.", err);
  }
};

function Dashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [message, setMessage] = useState("");
  const [originalMessage, setOriginalMessage] = useState("");
  const [isFollowUp, setIsFollowUp] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(getStoredSearchResult);
  const [selectedVendorId, setSelectedVendorId] = useState(null);
  const [availabilityDate, setAvailabilityDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [vendorAvailability, setVendorAvailability] = useState({});
  const [availabilityLoadedKey, setAvailabilityLoadedKey] = useState("");
  const [availabilityError, setAvailabilityError] = useState("");
  const [comparisonPreference, setComparisonPreference] = useState("");
  const [refinementMessage, setRefinementMessage] = useState("");

  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState("");
  const [refreshingBookings, setRefreshingBookings] = useState(false);
  const [bookingOtps, setBookingOtps] = useState({});
  const [otpLoading, setOtpLoading] = useState({});
  const [bookingActionError, setBookingActionError] = useState("");
  const [cancellingBookingId, setCancellingBookingId] = useState(null);

  const [bookingReviews, setBookingReviews] = useState({});
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [reviewSubmitting, setReviewSubmitting] = useState({});
  const [reviewErrors, setReviewErrors] = useState({});

  const loadBookingReviews = async (bookingList) => {
    const completedBookings = bookingList.filter(
      (booking) => booking.status?.toLowerCase() === "completed",
    );

    const results = await Promise.all(
      completedBookings.map(async (booking) => {
        try {
          const response = await api.get(`/reviews/booking/${booking.id}`);

          return [booking.id, response.data];
        } catch (err) {
          console.error(`Unable to load review for booking ${booking.id}`, err);
          return [booking.id, undefined];
        }
      }),
    );

    setBookingReviews((previous) => ({
      ...previous,
      ...Object.fromEntries(results),
    }));
  };

  const handleSubmitReview = async (bookingId) => {
    const draft = reviewDrafts[bookingId] || {
      rating: 0,
      comment: "",
    };

    if (!draft.rating) {
      setReviewErrors((prev) => ({
        ...prev,
        [bookingId]: "Please select a star rating.",
      }));
      return;
    }

    setReviewSubmitting((prev) => ({
      ...prev,
      [bookingId]: true,
    }));

    setReviewErrors((prev) => ({
      ...prev,
      [bookingId]: "",
    }));

    try {
      const response = await api.post(`/reviews/booking/${bookingId}`, {
        rating: draft.rating,
        comment: draft.comment.trim() || null,
      });

      setBookingReviews((prev) => ({
        ...prev,
        [bookingId]: response.data,
      }));
    } catch (err) {
      const detail = err.response?.data?.detail;

      setReviewErrors((prev) => ({
        ...prev,
        [bookingId]:
          typeof detail === "string"
            ? detail
            : "Unable to submit your review. Please try again.",
      }));
    } finally {
      setReviewSubmitting((prev) => ({
        ...prev,
        [bookingId]: false,
      }));
    }
  };

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

      setBookings(Array.isArray(data) ? data : data.bookings || []);
      await loadBookingReviews(
        Array.isArray(data) ? data : data.bookings || [],
      );
    } catch (err) {
      const detail = err.response?.data?.detail;

      setBookingsError(
        typeof detail === "string"
          ? detail
          : "Unable to load your bookings. Please try again.",
      );
    } finally {
      setBookingsLoading(false);
      setRefreshingBookings(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    api
      .get("/bookings/my")
      .then((response) => {
        if (!isMounted) return;

        const data = response.data;

        setBookings(Array.isArray(data) ? data : data.bookings || []);
        loadBookingReviews(Array.isArray(data) ? data : data.bookings || []);
      })
      .catch((err) => {
        if (!isMounted) return;

        const detail = err.response?.data?.detail;

        setBookingsError(
          typeof detail === "string"
            ? detail
            : "Unable to load your bookings. Please try again.",
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

  const getBookingNextStep = (status) => {
    const nextSteps = {
      pending:
        "Your request is waiting for the vendor’s response. Check back here for updates.",
      accepted:
        "Your booking is confirmed. Generate an arrival OTP only when the vendor reaches you.",
      in_progress:
        "The service is underway. Generate a completion OTP only after you confirm the work is finished.",
      completed:
        "The service is complete. You can leave a review below if you haven’t already.",
      rejected:
        "This request was not accepted. You can find another available professional.",
      cancelled:
        "This booking is cancelled. Create a new request whenever you’re ready.",
    };

    return nextSteps[status] || "Refresh your bookings for the latest status.";
  };

  const handleGenerateOtp = async (bookingId, type) => {
    const endpoint = type === "arrival" ? "arrival-otp" : "completion-otp";
    const key = `${bookingId}-${type}`;

    setBookingActionError("");
    setOtpLoading((previous) => ({ ...previous, [key]: true }));

    try {
      const response = await api.post(`/bookings/${bookingId}/${endpoint}`);
      const generatedOtp = response.data?.otp;

      if (!generatedOtp) {
        throw new Error("The server did not return an OTP.");
      }

      setBookingOtps((previous) => ({
        ...previous,
        [key]: {
          otp: String(generatedOtp),
          expiresAt: response.data?.expires_at || null,
        },
      }));
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      setBookingActionError(
        typeof detail === "string"
          ? detail
          : "Unable to generate OTP. Please try again.",
      );
    } finally {
      setOtpLoading((previous) => ({ ...previous, [key]: false }));
    }
  };

  const handleCancelBooking = async (bookingId) => {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this booking?",
    );
    if (!confirmed) return;

    setBookingActionError("");
    setCancellingBookingId(bookingId);

    try {
      await api.patch(`/bookings/${bookingId}/cancel`);
      setBookingOtps((previous) => {
        const next = { ...previous };
        delete next[`${bookingId}-arrival`];
        delete next[`${bookingId}-completion`];
        return next;
      });
      await fetchBookings(true);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setBookingActionError(
        typeof detail === "string"
          ? detail
          : "Unable to cancel this booking. Please try again.",
      );
    } finally {
      setCancellingBookingId(null);
    }
  };

  const executeSearch = async (currentMessage, baseMessage = "") => {
    if (!currentMessage || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    setSelectedVendorId(null);
    setComparisonPreference("");
    setVendorAvailability({});
    setAvailabilityLoadedKey("");
    setAvailabilityError("");
    clearStoredSearchResult();

    const searchMessage = baseMessage
      ? `${baseMessage}\nAdditional information: ${currentMessage}`
      : currentMessage;

    try {
      const response = await api.post("/ai/find-vendors", {
        message: searchMessage,
        max_radius_km: 100,
        limit: 20,
      });

      const data = { ...response.data, search_message: searchMessage };
      setResult(data);
      setSelectedVendorId(null);
      if (persistableSearchStatuses.includes(data.status)) {
        storeSearchResult(data);
      }

      if (data.status === "needs_clarification") {
        setIsFollowUp(true);
        setOriginalMessage(searchMessage);
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
          : "Unable to find services right now. Please try again.",
      );
      setIsFollowUp(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();

    const currentMessage = message.trim();
    if (!currentMessage || loading) return;

    await executeSearch(currentMessage, isFollowUp ? originalMessage : "");
  };

  const handleAgentFollowUp = async (e) => {
    e.preventDefault();

    const additionalDetails = refinementMessage.trim();
    if (!additionalDetails || loading) return;

    const baseMessage =
      result?.search_message ||
      [
        result?.intent?.service_category,
        result?.intent?.problem_description,
        result?.intent?.location,
      ]
        .filter(Boolean)
        .join(". ");

    await executeSearch(additionalDetails, baseMessage);
    setRefinementMessage("");
  };

  const handleSuggestion = (prompt) => {
    setMessage(prompt);
    setResult(null);
    setSelectedVendorId(null);
    setVendorAvailability({});
    setAvailabilityLoadedKey("");
    setAvailabilityError("");
    clearStoredSearchResult();
    setError("");
    setIsFollowUp(false);
    setOriginalMessage("");
  };

  const handleLogout = async () => {
    try {
      await logout();
      clearStoredSearchResult();
      navigate("/login");
    } catch {
      setError("Unable to log out. Please try again.");
    }
  };

  const vendors = result?.vendors || [];
  const displayVendors = [...vendors].sort((first, second) => {
    if (availabilityDate && preferredTime) {
      const firstHasSlot = vendorAvailability[first.vendor_id]?.slots?.some(
        (slot) => slot.start_time === preferredTime,
      );
      const secondHasSlot = vendorAvailability[second.vendor_id]?.slots?.some(
        (slot) => slot.start_time === preferredTime,
      );
      if (firstHasSlot !== secondHasSlot) return firstHasSlot ? -1 : 1;
    }

    if (comparisonPreference === "closest") {
      const firstDistance = Number(first.distance_km ?? Number.POSITIVE_INFINITY);
      const secondDistance = Number(
        second.distance_km ?? Number.POSITIVE_INFINITY,
      );
      return firstDistance === secondDistance
        ? 0
        : firstDistance - secondDistance;
    }
    if (comparisonPreference === "rated") {
      return (
        (Number(second.average_rating) || 0) -
          (Number(first.average_rating) || 0) ||
        (Number(second.total_reviews) || 0) -
          (Number(first.total_reviews) || 0)
      );
    }
    if (comparisonPreference === "experienced") {
      return (
        (Number(second.completed_jobs) || 0) -
        (Number(first.completed_jobs) || 0)
      );
    }

    return 0;
  });
  const selectedVendor = vendors.find(
    (vendor) => vendor.vendor_id === selectedVendorId,
  );
  const availabilityRequestKey =
    result?.status === "vendors_found" && availabilityDate
      ? `${availabilityDate}:${vendors
          .map((vendor) => vendor.vendor_id)
          .join(",")}:${result.search_message || ""}`
      : "";
  const availabilityLoading = Boolean(
    availabilityRequestKey && availabilityLoadedKey !== availabilityRequestKey,
  );

  useEffect(() => {
    if (!availabilityRequestKey) {
      return undefined;
    }

    let cancelled = false;

    api
      .post("/availability/slots/batch", {
        vendor_ids: result.vendors.map((vendor) => vendor.vendor_id),
        requested_date: availabilityDate,
        duration_minutes: 60,
        slot_interval_minutes: 30,
      })
      .then((response) => {
        if (cancelled) return;
        setVendorAvailability(
          Object.fromEntries(
            response.data.vendors.map((availability) => [
              availability.vendor_id,
              availability,
            ]),
          ),
        );
        setAvailabilityLoadedKey(availabilityRequestKey);
      })
      .catch((err) => {
        if (cancelled) return;
        setAvailabilityError(
          err.response?.data?.detail ||
            "Unable to check vendor availability. Please try again.",
        );
        setVendorAvailability({});
        setAvailabilityLoadedKey(availabilityRequestKey);
      });

    return () => {
      cancelled = true;
    };
  }, [availabilityRequestKey, availabilityDate, result]);

  useEffect(() => {
    if (!result || result.status === "needs_clarification") return;

    document.getElementById("search-results")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [result]);

  return (
    <div className="dashboard-page">
      {/* NAVBAR */}
      <header className="dashboard-navbar">
        <div className="dashboard-nav-left">
          <div className="dashboard-brand-icon">D</div>
          <span className="dashboard-brand-name">DailyDrill</span>
        </div>

        <nav className="dashboard-nav-links">
          <a href="#home" className="dashboard-nav-active">
            Home
          </a>
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
        <section className={`dashboard-hero ${loading ? "is-searching" : ""}`}>
          <div className="dashboard-hero-content">
            <div className="dashboard-agent-badge">
              <span className="dashboard-agent-status-dot"></span>
              AI SERVICE CONCIERGE
            </div>

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
                {loading ? (
                  <span className="search-button-spinner" aria-hidden="true" />
                ) : (
                  <span>→</span>
                )}
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

            {error && <div className="dashboard-error">{error}</div>}
          </div>

          <div
            className={`dashboard-hero-visual ${loading ? "is-searching" : ""}`}
          >
            <div className="dashboard-agent-panel-head">
              <span className="dashboard-agent-panel-icon">✦</span>
              <span className="dashboard-agent-panel-title">
                <strong>Service concierge</strong>
                <small>DAILYDRILL AI</small>
              </span>
              <span className="dashboard-agent-panel-status">
                <span className="dashboard-agent-status-dot"></span>
                {loading ? "WORKING" : "READY"}
              </span>
            </div>
            {loading ? (
              <>
                <div className="dashboard-agent-orbit" aria-hidden="true">
                  <div className="agent-orbit-sweep"></div>
                  <div className="agent-orbit-ring orbit-ring-one"></div>
                  <div className="agent-orbit-ring orbit-ring-two"></div>
                  <div className="agent-orbit-ring orbit-ring-three"></div>
                  <div className="agent-orbit-core">✦</div>
                  <span className="agent-orbit-node node-one">🔧</span>
                  <span className="agent-orbit-node node-two">✦</span>
                  <span className="agent-orbit-node node-three">⌖</span>
                </div>
                <div className="dashboard-visual-caption">
                  <span className="dashboard-agent-status-dot"></span>
                  Scanning for the right match
                </div>
              </>
            ) : (
              <>
                <div className="dashboard-visual-circle">
                  <div className="dashboard-visual-center">D</div>
                  <span className="dashboard-floating-icon icon-one">🔧</span>
                  <span className="dashboard-floating-icon icon-two">⚡</span>
                  <span className="dashboard-floating-icon icon-three">🧹</span>
                  <span className="dashboard-floating-icon icon-four">🎨</span>
                </div>
                <div className="dashboard-visual-caption">
                  <span className="dashboard-online-dot"></span>
                  Tell us what you need. We’ll find the right help.
                </div>
              </>
            )}
          </div>
        </section>

        {loading && (
          <section
            className="dashboard-agent-loading"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="agent-loading-heading">
              <span className="agent-loading-label">
                <span className="dashboard-agent-status-dot"></span>
                YOUR AI AGENT IS ON IT
              </span>
              <h2>Finding the right professionals</h2>
              <p>
                Matching your request with local service providers. Your results
                will appear here.
              </p>
            </div>
            <div className="agent-loading-indicator" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div className="agent-loading-skeletons" aria-hidden="true">
              {[1, 2, 3].map((item) => (
                <div className="agent-skeleton-card" key={item}>
                  <span className="agent-skeleton-avatar"></span>
                  <span className="agent-skeleton-line"></span>
                  <span className="agent-skeleton-line short"></span>
                  <span className="agent-skeleton-footer"></span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SEARCH RESULTS */}
        {result && result.status !== "needs_clarification" && (
          <section
            id="search-results"
            className="dashboard-results"
            aria-live="polite"
            aria-busy="false"
          >
            <div className="dashboard-results-heading">
              <div className="dashboard-results-title">
                <span className="dashboard-section-label">
                  <span aria-hidden="true">✦</span>
                  YOUR MATCHES
                </span>
                <h2>
                  {result.status === "vendors_found"
                    ? "Professionals for your service"
                    : result.status === "no_vendors_found"
                      ? "No professionals found"
                      : result.status === "category_not_found"
                        ? "Service category not available"
                        : "A little more information"}
                </h2>
                <p>
                  {result.status === "vendors_found"
                    ? "Explore verified local providers matched to your request."
                    : result.status === "no_vendors_found"
                      ? "Try adjusting your request to discover more local options."
                      : result.status === "category_not_found"
                        ? "This service is not currently listed in our local directory."
                        : "Review the information below to continue your search."}
                </p>
              </div>

              {result.status === "vendors_found" && (
                <span className="dashboard-result-count">
                  <span className="result-count-sparkle">✦</span>
                  {vendors.length} {vendors.length === 1 ? "match" : "matches"}
                </span>
              )}
            </div>

            {result.status === "vendors_found" && (
              <>
                <div className="dashboard-agent-guide">
                  <div className="dashboard-agent-guide-icon">✦</div>
                  <div>
                    <strong>Your AI service guide</strong>
                    <p>
                      I compared these Palghar professionals using the service
                      match and distance. Ratings and completed jobs shown here
                      come from DailyDrill records. Select the one you prefer;
                      I’ll take you to booking.
                    </p>
                  </div>
                </div>

                <form
                  className="dashboard-agent-refinement"
                  onSubmit={handleAgentFollowUp}
                >
                  <label htmlFor="agent-follow-up">
                    <strong>Want a more tailored recommendation?</strong>
                    <span>
                      Add details or tell me what matters most; I’ll search the
                      Palghar vendor records again.
                    </span>
                  </label>
                  <div className="dashboard-agent-refinement-controls">
                    <input
                      id="agent-follow-up"
                      type="text"
                      value={refinementMessage}
                      onChange={(event) =>
                        setRefinementMessage(event.target.value)
                      }
                      maxLength={500}
                      placeholder="e.g. The leak is under the sink; I prefer the earliest available slot."
                    />
                    <button
                      type="submit"
                      disabled={loading || !refinementMessage.trim()}
                    >
                      {loading ? "Updating..." : "Ask the agent"}
                    </button>
                  </div>
                </form>

                <div className="dashboard-agent-choice-grid">
                  <div className="dashboard-agent-preferences">
                    <label htmlFor="agent-availability-date">
                      <span className="dashboard-choice-heading">
                        <span className="dashboard-choice-step">01</span>
                        <strong>When would you like the service?</strong>
                      </span>
                      <span className="dashboard-choice-description">
                        Check real availability for these vendors.
                      </span>
                    </label>
                    <div className="dashboard-preference-controls">
                      <input
                        id="agent-availability-date"
                        type="date"
                        min={new Intl.DateTimeFormat("en-CA", {
                          timeZone: "Asia/Kolkata",
                        }).format(new Date())}
                        value={availabilityDate}
                        onChange={(event) => {
                          setAvailabilityDate(event.target.value);
                          setPreferredTime("");
                          setVendorAvailability({});
                          setAvailabilityLoadedKey("");
                          setAvailabilityError("");
                        }}
                      />
                      {availabilityDate && (
                        <select
                          aria-label="Preferred start time"
                          value={preferredTime}
                          onChange={(event) =>
                            setPreferredTime(event.target.value)
                          }
                          disabled={availabilityLoading}
                        >
                          <option value="">Any available time</option>
                          {[...new Set(
                            Object.values(vendorAvailability).flatMap(
                              (availability) =>
                                (availability.slots || []).map(
                                  (slot) => slot.start_time,
                                ),
                            ),
                          )]
                            .sort()
                            .map((startTime) => (
                              <option key={startTime} value={startTime}>
                                From {startTime}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>
                    {availabilityLoading && (
                      <p
                        className="dashboard-preference-feedback"
                        role="status"
                      >
                        Checking each vendor’s live schedule…
                      </p>
                    )}
                    {availabilityError && (
                      <p className="dashboard-preference-error" role="alert">
                        {availabilityError}
                      </p>
                    )}
                    {availabilityDate &&
                      !availabilityLoading &&
                      !availabilityError && (
                        <p className="dashboard-preference-feedback">
                          Based on vendor working hours and existing bookings.
                        </p>
                      )}
                  </div>

                  <div className="dashboard-agent-question">
                    <div className="dashboard-choice-heading">
                      <span className="dashboard-choice-step">02</span>
                      <strong>What matters most to you?</strong>
                    </div>
                    <div className="dashboard-preference-chips">
                      {[
                        ["closest", "Closest to Palghar"],
                        ["rated", "Top customer ratings"],
                        ["experienced", "Most completed jobs"],
                        ["", "Best overall match"],
                      ].map(([value, label]) => (
                        <button
                          type="button"
                          key={label}
                          className={
                            comparisonPreference === value ? "active" : ""
                          }
                          aria-pressed={comparisonPreference === value}
                          onClick={() => setComparisonPreference(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p>
                      I’ll compare distance, reviews, job history and
                      availability recorded for these Palghar vendors.
                    </p>
                  </div>
                </div>

                {result.location_resolution?.display_name && (
                  <p className="dashboard-location-note">
                    <span>📍</span>
                    Searching around {result.location_resolution.display_name}
                  </p>
                )}

                <div className="dashboard-vendor-grid">
                  {displayVendors.map((vendor, index) => {
                    const availability = vendorAvailability[vendor.vendor_id];
                    const matchingSlot = availability?.slots?.find(
                      (slot) => slot.start_time === preferredTime,
                    );

                    return (
                    <article
                      className={`dashboard-vendor-card ${
                        vendor.is_recommended ? "is-recommended" : ""
                      } ${
                        selectedVendorId === vendor.vendor_id
                          ? "is-selected"
                          : ""
                      }`}
                      key={vendor.vendor_id || index}
                    >
                      <div className="dashboard-vendor-top">
                        <div className="dashboard-vendor-avatar">
                          {(vendor.business_name || "V")
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        <div className="dashboard-vendor-badges">
                          {vendor.is_recommended && (
                            <span className="dashboard-recommended-badge">
                              ✦ Best match
                            </span>
                          )}
                          <span className="dashboard-vendor-distance">
                            {vendor.distance_km != null
                              ? `${Number(vendor.distance_km).toFixed(1)} km away`
                              : "Nearby"}
                          </span>
                          {availabilityDate && (
                            <span
                              className={`dashboard-availability-badge ${
                                availability?.slots?.length
                                  ? "is-available"
                                  : "is-unavailable"
                              }`}
                            >
                              {availabilityLoading
                                ? "Checking schedule"
                                : availabilityError ||
                                    availability?.status === "error"
                                  ? "Could not check availability"
                                : preferredTime
                                  ? matchingSlot
                                    ? `Available ${matchingSlot.start_time}–${matchingSlot.end_time}`
                                    : "Not free at this time"
                                  : availability?.slots?.length
                                    ? `${availability.slots.length} open slots`
                                    : "No open slots"}
                            </span>
                          )}
                        </div>
                      </div>

                      <h3>{vendor.business_name || "Service professional"}</h3>

                      <p className="dashboard-vendor-description">
                        {vendor.description || "Local service professional"}
                      </p>

                      {(vendor.total_reviews > 0 ||
                        vendor.completed_jobs > 0) && (
                        <div className="dashboard-vendor-proof">
                          {vendor.total_reviews > 0 && (
                            <span>
                              <strong>★</strong>{" "}
                              {Number(vendor.average_rating).toFixed(1)}
                              <small>({vendor.total_reviews})</small>
                            </span>
                          )}
                          {vendor.completed_jobs > 0 && (
                            <span>
                              <strong>✓</strong> {vendor.completed_jobs}{" "}
                              completed
                            </span>
                          )}
                        </div>
                      )}

                      {vendor.is_recommended &&
                        vendor.recommendation_reasons?.length > 0 && (
                          <div className="dashboard-recommendation-reasons">
                            <strong>Why this match</strong>
                            {vendor.recommendation_reasons.map((reason) => (
                              <span key={reason}>✓ {reason}</span>
                            ))}
                          </div>
                        )}

                      {vendor.address_label && (
                        <p className="dashboard-vendor-address">
                          📍 {vendor.address_label}
                        </p>
                      )}

                      <div className="dashboard-vendor-footer">
                        <span className="dashboard-vendor-status">
                          <span className="dashboard-online-dot"></span>
                          {availabilityDate && preferredTime
                            ? matchingSlot
                              ? "Available at preferred time"
                              : "Try another time"
                            : vendor.accepting_requests
                              ? "Accepting requests"
                              : "Availability not confirmed"}
                        </span>
                      </div>

                      <div className="dashboard-vendor-actions">
                        <button
                          type="button"
                          className="dashboard-vendor-select"
                          aria-pressed={
                            selectedVendorId === vendor.vendor_id
                          }
                          onClick={() =>
                            setSelectedVendorId(vendor.vendor_id)
                          }
                        >
                          {selectedVendorId === vendor.vendor_id
                            ? "✓ Selected"
                            : "Choose this professional"}
                        </button>
                        <button
                          type="button"
                          className="dashboard-vendor-view"
                          onClick={() =>
                            navigate(`/vendors/${vendor.vendor_id}`)
                          }
                        >
                          View profile
                        </button>
                      </div>
                    </article>
                    );
                  })}
                </div>

                {selectedVendor && (
                  <div className="dashboard-selection-confirm">
                    <div>
                      <span>YOUR SELECTION</span>
                      <strong>{selectedVendor.business_name}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const params = new URLSearchParams();
                        const matchingSlot = vendorAvailability[
                          selectedVendor.vendor_id
                        ]?.slots?.find(
                          (slot) => slot.start_time === preferredTime,
                        );
                        if (availabilityDate) {
                          params.set("date", availabilityDate);
                        }
                        if (matchingSlot) {
                          params.set("start", matchingSlot.start_time);
                          params.set("end", matchingSlot.end_time);
                        }
                        const problemDescription = (
                          result?.intent?.problem_description ||
                          result?.search_message ||
                          ""
                        ).slice(0, 2000);
                        if (problemDescription) {
                          params.set("problem", problemDescription);
                        }
                        const query = params.toString();
                        navigate(
                          `/booking/${selectedVendor.vendor_id}${
                            query ? `?${query}` : ""
                          }`,
                        );
                      }}
                    >
                      Continue to booking <span aria-hidden="true">→</span>
                    </button>
                  </div>
                )}
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

          {bookingActionError && (
            <div className="bookings-error" role="alert">
              {bookingActionError}
            </div>
          )}

          {bookingsLoading ? (
            <div className="bookings-empty">Loading your bookings...</div>
          ) : bookingsError ? (
            <div className="bookings-error">
              <p>{bookingsError}</p>
              <button onClick={() => fetchBookings(true)}>Try Again</button>
            </div>
          ) : bookings.length === 0 ? (
            <div className="bookings-empty">
              <div className="bookings-empty-icon">📋</div>
              <h3>No bookings yet</h3>
              <p>
                Your service bookings will appear here once you book a
                professional.
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

                    <div className={`booking-next-step ${status || ""}`}>
                      <strong>Next step</strong>
                      <p>{getBookingNextStep(status)}</p>
                    </div>

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

                    {status === "accepted" && (
                      <div className="customer-otp-panel">
                        <h4>Vendor arrival verification</h4>
                        <p>
                          Generate this OTP when the vendor arrives. Share it
                          with the vendor only after confirming they are at your
                          location.
                        </p>
                        {bookingOtps[`${booking.id}-arrival`] ? (
                          <div className="customer-otp-display">
                            <span>Arrival OTP</span>
                            <strong>
                              {bookingOtps[`${booking.id}-arrival`].otp}
                            </strong>
                            <small>
                              Valid for 5 minutes. Generate a new one if it
                              expires.
                            </small>
                            <button
                              type="button"
                              className="customer-otp-regenerate"
                              onClick={() =>
                                handleGenerateOtp(booking.id, "arrival")
                              }
                              disabled={Boolean(
                                otpLoading[`${booking.id}-arrival`],
                              )}
                            >
                              {otpLoading[`${booking.id}-arrival`]
                                ? "Generating..."
                                : "Generate new OTP"}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="customer-otp-button"
                            onClick={() =>
                              handleGenerateOtp(booking.id, "arrival")
                            }
                            disabled={Boolean(
                              otpLoading[`${booking.id}-arrival`],
                            )}
                          >
                            {otpLoading[`${booking.id}-arrival`]
                              ? "Generating..."
                              : "Generate Arrival OTP"}
                          </button>
                        )}
                      </div>
                    )}

                    {status === "in_progress" && (
                      <div className="customer-otp-panel">
                        <h4>Service completion verification</h4>
                        <p>
                          Generate this OTP only after you have checked that the
                          service is complete. Share it with the vendor to
                          confirm completion.
                        </p>
                        {bookingOtps[`${booking.id}-completion`] ? (
                          <div className="customer-otp-display">
                            <span>Completion OTP</span>
                            <strong>
                              {bookingOtps[`${booking.id}-completion`].otp}
                            </strong>
                            <small>
                              Valid for 5 minutes. Generate a new one if it
                              expires.
                            </small>
                            <button
                              type="button"
                              className="customer-otp-regenerate"
                              onClick={() =>
                                handleGenerateOtp(booking.id, "completion")
                              }
                              disabled={Boolean(
                                otpLoading[`${booking.id}-completion`],
                              )}
                            >
                              {otpLoading[`${booking.id}-completion`]
                                ? "Generating..."
                                : "Generate new OTP"}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="customer-otp-button"
                            onClick={() =>
                              handleGenerateOtp(booking.id, "completion")
                            }
                            disabled={Boolean(
                              otpLoading[`${booking.id}-completion`],
                            )}
                          >
                            {otpLoading[`${booking.id}-completion`]
                              ? "Generating..."
                              : "Generate Completion OTP"}
                          </button>
                        )}
                      </div>
                    )}

                    {["pending", "accepted"].includes(status) && (
                      <div className="booking-cancel-row">
                        <button
                          type="button"
                          className="booking-cancel-button"
                          onClick={() => handleCancelBooking(booking.id)}
                          disabled={cancellingBookingId === booking.id}
                        >
                          {cancellingBookingId === booking.id
                            ? "Cancelling..."
                            : "Cancel booking"}
                        </button>
                      </div>
                    )}

                    {status === "completed" && (
                      <section className="customer-review-section">
                        {bookingReviews[booking.id] ? (
                          <div className="customer-review-submitted">
                            <div className="customer-review-heading">
                              <strong>Your review</strong>
                              <span>✓ Submitted</span>
                            </div>

                            <div className="customer-review-stars">
                              {"★".repeat(bookingReviews[booking.id].rating)}
                              {"☆".repeat(
                                5 - bookingReviews[booking.id].rating,
                              )}
                            </div>

                            {bookingReviews[booking.id].comment && (
                              <p>{bookingReviews[booking.id].comment}</p>
                            )}
                          </div>
                        ) : bookingReviews[booking.id] === null ? (
                          <div className="customer-review-form">
                            <div>
                              <strong>How was your experience?</strong>
                              <p>Share your feedback about this service.</p>
                            </div>

                            <div className="customer-review-rating">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  className={
                                    star <=
                                    (reviewDrafts[booking.id]?.rating || 0)
                                      ? "selected"
                                      : ""
                                  }
                                  onClick={() =>
                                    setReviewDrafts((prev) => ({
                                      ...prev,
                                      [booking.id]: {
                                        ...prev[booking.id],
                                        rating: star,
                                        comment:
                                          prev[booking.id]?.comment || "",
                                      },
                                    }))
                                  }
                                  aria-label={`Rate ${star} out of 5`}
                                >
                                  ★
                                </button>
                              ))}
                            </div>

                            <textarea
                              value={reviewDrafts[booking.id]?.comment || ""}
                              onChange={(e) =>
                                setReviewDrafts((prev) => ({
                                  ...prev,
                                  [booking.id]: {
                                    rating: prev[booking.id]?.rating || 0,
                                    comment: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Write about your experience (optional)..."
                              maxLength={1000}
                              rows={3}
                            />

                            {reviewErrors[booking.id] && (
                              <p className="customer-review-error">
                                {reviewErrors[booking.id]}
                              </p>
                            )}

                            <button
                              type="button"
                              className="customer-review-submit"
                              disabled={!!reviewSubmitting[booking.id]}
                              onClick={() => handleSubmitReview(booking.id)}
                            >
                              {reviewSubmitting[booking.id]
                                ? "Submitting..."
                                : "Submit review"}
                            </button>
                          </div>
                        ) : (
                          <div className="customer-review-loading">
                            Checking review status...
                          </div>
                        )}
                      </section>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

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
