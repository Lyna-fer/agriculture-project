import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LeafyGreen } from "lucide-react";
import "./LoginPage.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4"/>
      <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4205 9 14.4205C6.65591 14.4205 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
      <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957275C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
      <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState(""); // ✅ Added for registration
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = mode === "login"
    ? username.trim().length > 0 && password.length > 0  // ✅ Login uses username
    : email.trim().length > 0 && username.trim().length > 0 && password.length >= 6;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError("");

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
          ? new URLSearchParams({ username, password })  // ✅ Login: form-urlencoded
          : JSON.stringify({ username, email, password })  // ✅ Register: JSON
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Request failed");
      }

      if (mode === "login") {
        // ✅ Save token + user info
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("user", JSON.stringify({
          id: data.user_id,
          username: data.username
        }));
        navigate("/map");
      } else {
        // ✅ Registration successful → switch to login
        alert("✅ Account created successfully! Sign in now.");
        setMode("login");
        setPassword("");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.body.className = "page-login";
    return () => { document.body.className = ""; };
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

          <div className="toggle-row" role="tablist">
            <button
              className={`toggle-btn ${mode === "login" ? "active" : ""}`}
              onClick={() => setMode("login")}
              type="button"
              disabled={loading}
            >
              Sign In
            </button>
            <button
              className={`toggle-btn ${mode === "register" ? "active" : ""}`}
              onClick={() => setMode("register")}
              type="button"
              disabled={loading}
            >
              Sign Up
            </button>
          </div>

          {/* ✅ Show error message */}
          {error && (
            <div style={{
              background: "#fee",
              color: "#c00",
              padding: "0.75rem",
              borderRadius: "8px",
              marginBottom: "1rem",
              fontSize: "0.9rem",
              borderLeft: "4px solid #c00"
            }}>
              ❌ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* ✅ Show email field only for registration */}
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
                    tabIndex={1}
                    required
                  />
                  <button
                    type="button"
                    className={`input-clear ${email ? "" : "hidden"}`}
                    onClick={() => setEmail("")}
                    tabIndex={-1}
                    aria-label="Clear"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

            {/* ✅ Username field (used for both login & register) */}
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
                  tabIndex={1}
                  required
                />
                <button
                  type="button"
                  className={`input-clear ${username ? "" : "hidden"}`}
                  onClick={() => setUsername("")}
                  tabIndex={-1}
                  aria-label="Clear"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="field">
              <div className="field-header">
                <label className="field-label" htmlFor="lp-password" style={{ margin: 0 }}>
                  Password {mode === "register" && "*"}
                </label>
                {mode === "login" && (
                  <a className="field-label-forgot" href="/auth/forgot" tabIndex={-1}>
                    Forgot password?
                  </a>
                )}
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
                  tabIndex={1}
                  minLength={mode === "register" ? 6 : undefined}
                  required
                />
                {password && (
                  <button
                    type="button"
                    className="input-clear"
                    onClick={() => setShowPass((v) => !v)}
                    tabIndex={-1}
                    style={{ fontSize: "0.75rem", color: "#999" }}
                  >
                    {showPass ? "🙈" : "👁"}
                  </button>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="btn-submit"
              disabled={!canSubmit || loading}
              tabIndex={1}
            >
              {loading ? "⏳ Processing..." : (mode === "login" ? "Sign In" : "Create Account")}
            </button>
          </form>

          <div className="divider"><span>or continue with</span></div>

          <div className="socials">
            <button type="button" className="btn-social" disabled={loading}>
              <span className="social-icon"><GoogleIcon /></span>
              Google
            </button>
          </div>
        </div>
      </div>
    </>
  );
}