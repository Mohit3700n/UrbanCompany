
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import "./VendorOnboarding.css";

function VendorOnboarding() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);

  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  const [loadingCategories, setLoadingCategories] = useState(true);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get("/services/categories");
        setCategories(response.data);
      } catch (err) {
        setError(
          err.response?.data?.detail ||
          "Unable to load service categories."
        );
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  const toggleCategory = (categoryId) => {
    setSelectedCategories((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId]
    );
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setGettingLocation(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(String(position.coords.latitude));
        setLongitude(String(position.coords.longitude));
        setGettingLocation(false);
      },
      (err) => {
        setError(
          err.code === 1
            ? "Location permission denied. Allow location access or enter coordinates manually."
            : "Unable to get your location. Please try again."
        );
        setGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (selectedCategories.length === 0) {
      setError("Please select at least one service.");
      return;
    }

    if (!latitude || !longitude) {
      setError("Please provide your business location.");
      return;
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      setError("Please enter valid latitude and longitude.");
      return;
    }

    try {
      setSubmitting(true);

      await api.post("/vendors/profile", {
        business_name: businessName.trim(),
        description: description.trim() || null,
        phone: phone.trim() || null,
        latitude: lat,
        longitude: lng,
        address_label: address.trim(),
        category_ids: selectedCategories,
      });

      navigate("/vendor-pending-approval", { replace: true });

    } catch (err) {
      const detail = err.response?.data?.detail;

      setError(
        typeof detail === "string"
          ? detail
          : "Unable to submit your vendor application."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="vo-page">
      <div className="vo-container">

        <header className="vo-header">
          <div className="vo-logo">
            <span>D</span>
            DailyDrill
          </div>

          <span className="vo-step">VENDOR ONBOARDING</span>
        </header>

        <div className="vo-heading">
          <span className="vo-eyebrow">BECOME A SERVICE PARTNER</span>
          <h1>Set up your business profile</h1>
          <p>
            Tell us about your business and the services you provide.
            Your application will be reviewed by our admin team.
          </p>
        </div>

        <form className="vo-form" onSubmit={handleSubmit}>

          {/* BUSINESS DETAILS */}
          <section className="vo-section">
            <h2>Business information</h2>
            <p className="vo-section-description">
              Provide your professional or business details.
            </p>

            <div className="vo-field">
              <label>Business name *</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Rahul Electrical Services"
                minLength={2}
                maxLength={150}
                required
              />
            </div>

            <div className="vo-field">
              <label>Phone number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter business contact number"
                maxLength={20}
              />
            </div>

            <div className="vo-field">
              <label>Business description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your experience and services..."
                rows={4}
              />
            </div>
          </section>

          {/* SERVICE CATEGORIES */}
          <section className="vo-section">
            <h2>Services you provide *</h2>
            <p className="vo-section-description">
              Select all the services you are qualified to provide.
            </p>

            {loadingCategories ? (
              <p className="vo-muted">Loading services...</p>
            ) : categories.length === 0 ? (
              <p className="vo-muted">
                No active service categories are available.
              </p>
            ) : (
              <div className="vo-category-grid">
                {categories.map((category) => {
                  const selected = selectedCategories.includes(category.id);

                  return (
                    <label
                      key={category.id}
                      className={`vo-category ${
                        selected ? "selected" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleCategory(category.id)}
                      />

                      <span className="vo-category-check">
                        {selected ? "✓" : ""}
                      </span>

                      <span className="vo-category-name">
                        {category.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            <p className="vo-selected-count">
              {selectedCategories.length} service(s) selected
            </p>
          </section>

          {/* LOCATION */}
          <section className="vo-section">
            <h2>Business location</h2>
            <p className="vo-section-description">
              Your location helps DailyDrill find nearby customers.
            </p>

            <div className="vo-field">
              <label>Business address *</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter your complete business address, area and city"
                rows={3}
                minLength={3}
                maxLength={300}
                required
              />
            </div>

            <button
              type="button"
              className="vo-location-btn"
              onClick={getCurrentLocation}
              disabled={gettingLocation}
            >
              {gettingLocation
                ? "Getting location..."
                : "◎ Use my current location"}
            </button>

            <div className="vo-coordinate-grid">
              <div className="vo-field">
                <label>Latitude *</label>
                <input
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="e.g. 19.6967"
                  required
                />
              </div>

              <div className="vo-field">
                <label>Longitude *</label>
                <input
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="e.g. 72.7699"
                  required
                />
              </div>
            </div>

            <p className="vo-location-note">
              Allow browser location permission to fill coordinates
              automatically. Verify that the pin represents your actual
              service location.
            </p>
          </section>

          {error && (
            <div className="vo-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="vo-submit"
            disabled={
              submitting ||
              loadingCategories ||
              categories.length === 0
            }
          >
            {submitting
              ? "Submitting application..."
              : "Submit for admin approval →"}
          </button>

          <p className="vo-disclaimer">
            Your profile will remain unavailable to customers until
            the admin team approves your application.
          </p>

        </form>

      </div>
    </div>
  );
}

export default VendorOnboarding;
