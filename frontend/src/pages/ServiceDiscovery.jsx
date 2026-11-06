import { useState } from "react";
import api from "../api/axios";
import "./ServiceDiscovery.css";

function ServiceDiscovery() {
  const [message, setMessage] = useState("");
  const [locationText, setLocationText] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const [locationRequired, setLocationRequired] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();

    setError("");
    setResult(null);
    setLoading(true);

    try {
      // Step 1: Interpret customer prompt
      const prompt = locationRequired
        ? `${message}. Service location: ${locationText}`
        : message;

      const aiResponse = await api.post("/ai/interpret", {
        message: prompt,
      });

      const intent = aiResponse.data.intent || aiResponse.data;

      const detectedLocation =
        intent.location?.trim() || locationText.trim();

      // Step 2: Ask for location if missing
      if (!detectedLocation) {
        setLocationRequired(true);
        setError(
          "Aap kis area, city ya PIN code mein service chahte hain?"
        );
        return;
      }

      // Step 3: Find vendors
      // NOTE: This endpoint currently requires latitude and longitude.
      // We will connect location-name geocoding in the next backend step.

      setLocationRequired(false);

      setResult({
        intent,
        detectedLocation,
        status: "location_detected",
      });

    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Unable to understand your request. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="discovery-page">
      <header>
        <h1>Find the right professional</h1>
        <p>
          Describe your problem in English, Hindi or Hinglish.
          We'll understand your requirements.
        </p>
      </header>

      <form onSubmit={handleSearch}>
        <label htmlFor="problem">
          What service do you need?
        </label>

        <textarea
          id="problem"
          rows={5}
          placeholder="Example: Mujhe Palghar mein electrician chahiye. Switchboard kharab hai."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
        />

        {locationRequired && (
          <div className="location-section">
            <h3>Where do you need the service?</h3>

            <p>
              Please enter your area, city or PIN code.
            </p>

            <input
              type="text"
              placeholder="Example: Palghar 401404"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              required
            />
          </div>
        )}

        {error && (
          <p className="error-message">{error}</p>
        )}

        <button type="submit" disabled={loading}>
          {loading
            ? "Understanding your request..."
            : locationRequired
              ? "Continue"
              : "Find Professionals"}
        </button>
      </form>

      {result && (
        <section className="search-results">
          <h2>AI understood your request</h2>

          <p>
            <strong>Service:</strong>{" "}
            {result.intent.service_category}
          </p>

          <p>
            <strong>Problem:</strong>{" "}
            {result.intent.problem_description}
          </p>

          <p>
            <strong>Location:</strong>{" "}
            {result.detectedLocation}
          </p>

          <p>
            Location identified. Next, we'll search nearby vendors.
          </p>
        </section>
      )}
    </div>
  );
}

export default ServiceDiscovery;