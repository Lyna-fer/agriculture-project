import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LeafyGreen } from "lucide-react";
import "./LoginPage.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canSubmit = mode === "login"
    ? username.trim().length > 0 && password.length > 0
    : email.trim().length > 0 && username.trim().length > 0 && password.length >= 6;

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError("");
    setSuccess("");
    setPassword("");
    setShowPass(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": mode === "login"
            ? "application/x-www-form-urlencoded"
            : "application/json"
        },
        body: mode === "login"
          ? new URLSearchParams({ username, password })
          : JSON.stringify({ username, email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Request failed");
      }

      if (mode === "login") {
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("user", JSON.stringify({
          id: data.user_id,
          username: data.username
        }));
        navigate("/map");
        return;
      }

      setSuccess("Account created successfully. Sign in with your new details.");
      setMode("login");
      setEmail("");
      setPassword("");
      setShowPass(false);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.body.className = "page-login";
    return () => {
      document.body.className = "";
    };
  }, []);

  return (
    <>
      <div className="bg-map" />
      <div className="page">
        <div className="card">
          <div className="card-logo">
            <LeafyGreen size={22} color="#3a7d44" strokeWidth={2.5} />
            <span className="card-logo-text">AGRIC</span>
          </div>

          <div className="card-copy">
            <h1 className="card-title">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="card-subtitle">
              {mode === "login"
                ? "Sign in to continue to your soil analysis workspace and map dashboard."
                : "Register to start exploring farmland insights, diagnostics, and planning tools."}
            </p>
          </div>

          <div className="toggle-row" role="tablist" aria-label="Authentication mode">
            <button
              className={`toggle-btn ${mode === "login" ? "active" : ""}`}
              onClick={() => switchMode("login")}
              type="button"
              disabled={loading}
            >
              Sign In
            </button>
            <button
              className={`toggle-btn ${mode === "register" ? "active" : ""}`}
              onClick={() => switchMode("register")}
              type="button"
              disabled={loading}
            >
              Sign Up
            </button>
          </div>

          {error && <div className="status-box status-box-error">{error}</div>}
          {success && <div className="status-box status-box-success">{success}</div>}

          <form onSubmit={handleSubmit} noValidate>
            {mode === "register" && (
              <div className="field">
                <label className="field-label" htmlFor="lp-email">
                  Email Address *
                </label>
                <div className="input-wrap">
                  <input
                    id="lp-email"
                    className="input"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                  <button
                    type="button"
                    className={`input-clear ${email ? "" : "hidden"}`}
                    onClick={() => setEmail("")}
                    tabIndex={-1}
                    aria-label="Clear email"
                  >
                    x
                  </button>
                </div>
              </div>
            )}

            <div className="field">
              <label className="field-label" htmlFor="lp-username">
                {mode === "login" ? "Username" : "Username *"}
              </label>
              <div className="input-wrap">
                <input
                  id="lp-username"
                  className="input"
                  type="text"
                  placeholder={mode === "login" ? "Enter your username" : "farmer123"}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
                <button
                  type="button"
                  className={`input-clear ${username ? "" : "hidden"}`}
                  onClick={() => setUsername("")}
                  tabIndex={-1}
                  aria-label="Clear username"
                >
                  x
                </button>
              </div>
            </div>

            <div className="field">
              <div className="field-header">
                <label className="field-label" htmlFor="lp-password" style={{ margin: 0 }}>
                  Password {mode === "register" && "*"}
                </label>
              </div>
              <div className="input-wrap">
                <input
                  id="lp-password"
                  className="input"
                  type={showPass ? "text" : "password"}
                  placeholder={mode === "login" ? "Enter password" : "Minimum 6 characters"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={mode === "register" ? 6 : undefined}
                  required
                />
                {password && (
                  <button
                    type="button"
                    className="input-clear input-toggle"
                    onClick={() => setShowPass((value) => !value)}
                    tabIndex={-1}
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? "Hide" : "Show"}
                  </button>
                )}
              </div>
              {mode === "register" && (
                <p className="field-help">
                  Choose at least 6 characters so your account stays secure.
                </p>
              )}
            </div>

            <button
              type="submit"
              className="btn-submit"
              disabled={!canSubmit || loading}
            >
              {loading ? "Processing..." : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
