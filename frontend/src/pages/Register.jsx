import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import "./Register.css";

function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [role, setRole] = useState("customer");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const loggedInUser = await register(
        fullName.trim(),
        email.trim(),
        password,
        role
      );
      if (loggedInUser.role === "vendor") {
        navigate("/vendor-dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      const detail = err.response?.data?.detail;

      setError(
        typeof detail === "string"
          ? detail
          : "Registration failed. Please check your details."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="register-page">
      {/* Left Branding Section */}
      <section className="register-brand">
        <Link to="/" className="register-logo">
          <span className="register-logo-icon">D</span>
          <span>DailyDrill</span>
        </Link>

        <div className="register-brand-content">
          <span className="register-eyebrow">YOUR LOCAL SERVICE PARTNER</span>

          <h1>
            Good service.
            <br />
            <span>Starts here.</span>
          </h1>

          <p>
            Create your account and connect with trusted local professionals
            for everyday services.
          </p>

          <div className="register-benefits">
            <div className="register-benefit">
              <span className="register-benefit-icon">✓</span>
              <span>Discover nearby service professionals</span>
            </div>

            <div className="register-benefit">
              <span className="register-benefit-icon">✓</span>
              <span>Compare profiles and reviews</span>
            </div>

            <div className="register-benefit">
              <span className="register-benefit-icon">✓</span>
              <span>Manage your service bookings</span>
            </div>
          </div>
        </div>

        <div className="register-brand-footer">
          Making everyday services simpler.
        </div>
      </section>

      {/* Right Registration Section */}
      <section className="register-form-section">
        <div className="register-form-container">
          <div className="register-mobile-logo">
            <span className="register-logo-icon">D</span>
            <span>DailyDrill</span>
          </div>

          <div className="register-heading">
            <span className="register-step-label">GET STARTED</span>
            <h2>Create your account</h2>
            <p>Enter your details to get started with DailyDrill.</p>
          </div>

          <form onSubmit={handleSubmit} className="register-form">
            <div className="register-field">
              <label htmlFor="fullName">Full name</label>
              <input
                id="fullName"
                type="text"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>

            <div className="register-field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="register-field">
              <label htmlFor="role">I want to register as</label>

              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
              >
                <option value="customer">Customer</option>
                <option value="vendor">Service Provider (Vendor)</option>
              </select>
            </div>

            <div className="register-field">
              <label htmlFor="password">Password</label>

              <div className="register-password-wrapper">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />

                <button
                  type="button"
                  className="register-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="register-field">
              <label htmlFor="confirmPassword">Confirm password</label>

              <div className="register-password-wrapper">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />

                <button
                  type="button"
                  className="register-password-toggle"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && (
              <div className="register-error">
                <span>!</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="register-submit"
              disabled={submitting}
            >
              {submitting ? "Creating account..." : "Create account"}
              {!submitting && <span>→</span>}
            </button>
          </form>

          <div className="register-login-link">
            Already have an account?
            <Link to="/login">Log in</Link>
          </div>

          <p className="register-terms">
            By creating an account, you agree to use DailyDrill responsibly.
          </p>
        </div>
      </section>
    </div>
  );
}

export default Register;