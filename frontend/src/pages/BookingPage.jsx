import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import "./BookingPage.css";

const INDIA_OFFSET = "+05:30";

function getIndiaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());
}

function createIndiaDateTime(date, time) {
  return `${date}T${time}:00${INDIA_OFFSET}`;
}

function getValidRequestedDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";

  const [year, month, day] = value.split("-").map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  const isValidDate =
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day;

  return isValidDate && value >= getIndiaDate() ? value : "";
}

export default function BookingPage() {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [selectedDate, setSelectedDate] = useState(
    () => getValidRequestedDate(searchParams.get("date")) || getIndiaDate(),
  );
  const [selectedSlot, setSelectedSlot] = useState(null);
  const requestedSlot = useRef({
    start: searchParams.get("start") || "",
    end: searchParams.get("end") || "",
  });
  const [problemDescription, setProblemDescription] = useState(
    () => searchParams.get("problem") || "",
  );

  const [slots, setSlots] = useState([]);
  const [vendorName, setVendorName] = useState("Selected Vendor");

  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchSlots() {
      setLoadingSlots(true);
      setError("");
      setSlots([]);
      setSelectedSlot(null);

      try {
        const response = await api.get("/availability/slots", {
          params: {
            vendor_id: Number(vendorId),
            requested_date: selectedDate,
            duration_minutes: 60,
            slot_interval_minutes: 30,
          },
        });

        if (cancelled) return;

        const result = response.data;

        setSlots(result.slots || []);
        const matchingRequestedSlot = (result.slots || []).find(
          (slot) =>
            slot.start_time === requestedSlot.current.start &&
            (!requestedSlot.current.end ||
              slot.end_time === requestedSlot.current.end),
        );
        if (matchingRequestedSlot) {
          setSelectedSlot(matchingRequestedSlot);
        }
        requestedSlot.current = { start: "", end: "" };

        if (result.business_name) {
          setVendorName(result.business_name);
        }

        if (result.status === "unavailable" || result.status === "closed") {
          setError(result.message || "Vendor is unavailable on this date.");
        } else if (result.status === "no_slots") {
          setError("No available time slots for this date. Please select another date.");
        }
      } catch (err) {
        if (cancelled) return;

        setError(
          err.response?.data?.detail ||
            "Unable to load available slots. Please try again."
        );
      } finally {
        if (!cancelled) {
          setLoadingSlots(false);
        }
      }
    }

    if (vendorId && selectedDate) {
      fetchSlots();
    }

    return () => {
      cancelled = true;
    };
  }, [vendorId, selectedDate, refreshKey]);

  async function handleBooking() {
    if (!selectedSlot) {
      setError("Please select a time slot.");
      return;
    }

    if (problemDescription.trim().length < 5) {
      setError("Please describe your problem in at least 5 characters.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        vendor_id: Number(vendorId),
        problem_description: problemDescription.trim(),
        start_at: createIndiaDateTime(selectedDate, selectedSlot.start_time),
        end_at: createIndiaDateTime(selectedDate, selectedSlot.end_time),
      };

      const response = await api.post("/bookings/", payload);

      setSuccess(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Booking could not be created. Please try again."
      );

      // Refresh slots if the selected slot was booked by someone else.
      if (err.response?.status === 409) {
        setSelectedSlot(null);
        setRefreshKey((current) => current + 1);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="booking-page">
        <div className="booking-success">
          <div className="success-icon">✓</div>
          <h1>Booking Request Sent!</h1>
          <p>
            Your booking request has been sent to{" "}
            <strong>{vendorName}</strong>.
          </p>

          <div className="booking-success-details">
            <div>
              <span>Booking ID</span>
              <strong>#{success.id}</strong>
            </div>
            <div>
              <span>Date</span>
              <strong>{selectedDate}</strong>
            </div>
            <div>
              <span>Time</span>
              <strong>
                {selectedSlot.start_time} – {selectedSlot.end_time}
              </strong>
            </div>
            <div>
              <span>Status</span>
              <strong className="pending-status">Pending</strong>
            </div>
          </div>

          <p className="success-note">
            Your booking is not confirmed until the vendor accepts your request.
          </p>

          <button
            className="booking-primary-btn"
            onClick={() => navigate("/dashboard")}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="booking-page">
      <div className="booking-container">
        <button className="booking-back-btn" onClick={() => navigate(-1)}>
          ← Back to Vendor Profile
        </button>

        <div className="booking-heading">
          <span className="booking-eyebrow">DAILYDRILL BOOKING</span>
          <h1>Schedule Your Service</h1>
          <p>Choose a convenient date and time for your service.</p>
        </div>

        <div className="booking-layout">
          <main className="booking-main-card">
            <section className="booking-section">
              <div className="booking-section-heading">
                <span className="booking-step">01</span>
                <div>
                  <h2>Select a Date</h2>
                  <p>Choose when you need the service.</p>
                </div>
              </div>

              <input
                className="booking-date-input"
                type="date"
                value={selectedDate}
                min={getIndiaDate()}
                onChange={(e) => {
                  requestedSlot.current = { start: "", end: "" };
                  setSelectedDate(e.target.value);
                }}
              />
            </section>

            <div className="booking-divider" />

            <section className="booking-section">
              <div className="booking-section-heading">
                <span className="booking-step">02</span>
                <div>
                  <h2>Available Time Slots</h2>
                  <p>Each appointment is 60 minutes.</p>
                </div>
              </div>

              {loadingSlots ? (
                <div className="booking-message">
                  Loading available slots...
                </div>
              ) : slots.length > 0 ? (
                <div className="booking-slots">
                  {slots.map((slot, index) => {
                    const isSelected =
                      selectedSlot?.start_time === slot.start_time &&
                      selectedSlot?.end_time === slot.end_time;

                    return (
                      <button
                        key={`${slot.start_time}-${index}`}
                        type="button"
                        className={`booking-slot ${isSelected ? "selected" : ""}`}
                        onClick={() => setSelectedSlot(slot)}
                      >
                        {slot.start_time} – {slot.end_time}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="booking-message">
                  {error || "No available slots for this date."}
                </div>
              )}
            </section>

            <div className="booking-divider" />

            <section className="booking-section">
              <div className="booking-section-heading">
                <span className="booking-step">03</span>
                <div>
                  <h2>Describe Your Problem</h2>
                  <p>Help the vendor understand what service you need.</p>
                </div>
              </div>

              <textarea
                className="booking-description"
                rows={5}
                maxLength={2000}
                placeholder="Example: My kitchen tap is leaking and needs repair..."
                value={problemDescription}
                onChange={(e) => setProblemDescription(e.target.value)}
              />

              <div className="booking-character-count">
                {problemDescription.length}/2000 characters
              </div>
            </section>

            {error && (
              <div className="booking-error" role="alert">
                {error}
              </div>
            )}

            <button
              className="booking-primary-btn"
              onClick={handleBooking}
              disabled={submitting || loadingSlots || !selectedSlot}
            >
              {submitting ? "Submitting Request..." : "Confirm Booking Request"}
            </button>

            <p className="booking-disclaimer">
              Your request will remain pending until the vendor accepts it.
            </p>
          </main>

          <aside className="booking-summary-card">
            <span className="booking-summary-label">BOOKING SUMMARY</span>
            <h2>{vendorName}</h2>

            <div className="booking-summary-item">
              <span>Date</span>
              <strong>{selectedDate}</strong>
            </div>

            <div className="booking-summary-item">
              <span>Time</span>
              <strong>
                {selectedSlot
                  ? `${selectedSlot.start_time} – ${selectedSlot.end_time}`
                  : "Not selected"}
              </strong>
            </div>

            <div className="booking-summary-item">
              <span>Duration</span>
              <strong>60 minutes</strong>
            </div>

            <div className="booking-summary-note">
              <strong>What happens next?</strong>
              <p>
                The vendor receives your request and can accept or reject it.
                You can check the booking status from your bookings section.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}