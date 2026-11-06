import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import "./Login.css";

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const loggedInUser = await login(email.trim(), password);

      if (loggedInUser.role === "admin") {
        navigate("/admin-dashboard");
      } else if (loggedInUser.role === "vendor") {
        navigate("/vendor-dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      const detail = err.response?.data?.detail;

      setError(
        typeof detail === "string"
          ? detail
          : "Unable to login. Please check your credentials and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-layout">
        {/* Left Branding Section */}
        <div className="auth-visual">
          <div className="auth-brand">
            <div className="brand-icon">D</div>
            <span>DailyDrill</span>
          </div>

          <div className="visual-content">
            <span className="visual-tag">YOUR LOCAL SERVICE PARTNER</span>

            <h1>
              Your everyday
              <br />
              needs, <span>handled.</span>
            </h1>

            <p>
              Find trusted local professionals for your home. From repairs to
              everyday services, get the right help when you need it.
            </p>

            <div className="visual-features">
              <div className="visual-feature">
                <span className="feature-check">✓</span>
                Trusted local professionals
              </div>

              <div className="visual-feature">
                <span className="feature-check">✓</span>
                Easy service discovery
              </div>

              <div className="visual-feature">
                <span className="feature-check">✓</span>
                Simple booking experience
              </div>
            </div>
          </div>

          <div className="visual-footer">Making everyday services easier.</div>
        </div>

        {/* Right Login Section */}
        <div className="auth-form-section">
          <div className="auth-form-container">
            <div className="mobile-brand">
              <div className="brand-icon">D</div>
              <span>DailyDrill</span>
            </div>

            <div className="form-heading">
              <span className="form-eyebrow">WELCOME BACK</span>
              <h2>Sign in to your account</h2>
              <p>Enter your details to access your DailyDrill account.</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
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

              <div className="form-group">
                <div className="password-label">
                  <label htmlFor="password">Password</label>
                </div>

                <div className="password-input-wrapper">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {error && (
                <div className="auth-error" role="alert">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="auth-submit"
                disabled={submitting}
              >
                {submitting ? "Signing in..." : "Sign in"}
                {!submitting && <span>→</span>}
              </button>
            </form>

            <div className="auth-switch">
              Don't have an account?
              <Link to="/register">Create an account</Link>
            </div>

            <p className="auth-terms">
              By continuing, you agree to use DailyDrill responsibly.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Login;
