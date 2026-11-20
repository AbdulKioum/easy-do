import {
  useEffect,
  useState,
} from "react";

import type { FormEvent } from "react";

import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

import { supabase } from "../../lib/supabase";

import { syncAllMasterDataInBackground } from "../../lib/offlineSync";


export default function LoginPage() {

  const navigate =
    useNavigate();


  const {
    signIn,
    user,
    profile,
    loading: authLoading,
  } = useAuth();


  const [email, setEmail] =
    useState("");


  const [password, setPassword] =
    useState("");


  const [showPassword, setShowPassword] =
    useState(false);


  const [loading, setLoading] =
    useState(false);


  const [error, setError] =
    useState("");


  // ==========================================
  // ALREADY LOGGED IN
  // ==========================================

  useEffect(() => {

    if (
      !authLoading &&
      user &&
      profile
    ) {

      navigate("/", {
        replace: true,
      });

    }

  }, [
    authLoading,
    user,
    profile,
    navigate,
  ]);


  // ==========================================
  // LOGIN
  // ==========================================

  async function handleSubmit(
    event: FormEvent
  ) {

    event.preventDefault();

    setError("");


    if (!email.trim()) {

      setError(
        "Please enter your Login ID."
      );

      return;
    }


    if (!password) {

      setError(
        "Please enter your password."
      );

      return;
    }


    setLoading(true);


    try {

      const result =
        await signIn(
          email,
          password
        );


      if (result.error) {

        setError(
          result.error.message ||
          "Login failed."
        );

        return;
      }


      // Login is online-only, so seed the offline cache right now:
      // item prices, transport, upazilas, saved DOs and notifications.
      // Fire-and-forget: navigation must NOT wait for it — the home
      // page re-applies the cache when the sync finishes, so the data
      // appears on its own. Waiting here was the post-login lag.
      void (async () => {
        try {
          const { data: { user: signedInUser } } = await supabase.auth.getUser();
          if (signedInUser) {
            let isSuperAdmin = false;
            try {
              const { data: prof } = await supabase.from("profiles").select("role").eq("id", signedInUser.id).maybeSingle();
              isSuperAdmin = (prof as any)?.role === "super_admin";
            } catch {
              /* fall back to own-DO scope */
            }
            await syncAllMasterDataInBackground(signedInUser.id, isSuperAdmin);
          }
        } catch {
          /* cache seeding is best-effort — login already succeeded */
        }
      })();


      navigate("/", {
        replace: true,
      });


    } catch (error: any) {

      console.error(error);


      setError(
        error?.message ||
        "Something went wrong."
      );

    } finally {

      setLoading(false);

    }

  }


  return (
    <div style={styles.page}>
      <style>{LOGIN_CSS}</style>

      {/* BACKGROUND GRAPHICS — soft light sky, peach and blue glows */}
      <div
        className="login-blob"
        style={{
          width: 360,
          height: 360,
          top: -120,
          right: -100,
          background:
            "radial-gradient(circle, #fdba74 0%, rgba(253,186,116,0) 70%)",
        }}
      />
      <div
        className="login-blob"
        style={{
          width: 400,
          height: 400,
          bottom: -150,
          left: -120,
          background:
            "radial-gradient(circle, #93c5fd 0%, rgba(147,197,253,0) 70%)",
          animationDelay: "1.4s",
        }}
      />
      <div
        className="login-blob"
        style={{
          width: 240,
          height: 240,
          top: "30%",
          left: "4%",
          background:
            "radial-gradient(circle, #5eead4 0%, rgba(94,234,212,0) 70%)",
          animationDelay: "2.6s",
        }}
      />
      <div
        className="login-blob"
        style={{
          width: 200,
          height: 200,
          bottom: "8%",
          right: "8%",
          background:
            "radial-gradient(circle, #fda4af 0%, rgba(253,164,175,0) 70%)",
          animationDelay: "3.4s",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 460,
          height: 460,
          borderRadius: "50%",
          border: "1px solid rgba(37,99,235,0.12)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />

      <div style={styles.cardWrap}>
        <div style={styles.card} className="login-card">
          {/* LOGO */}
          <div style={styles.logo}>
            <img
              src="/easy_do_logo.png"
              alt="Easy D/O"
              style={{
                width: "120px",
                height: "auto",
                objectFit: "contain",
                display: "block",
                margin: "0 auto",
              }}
            />
            <div style={styles.accentBar} />
            <div style={styles.courtesy}>Courtesy: Team Mymensingh</div>
          </div>

          {/* TITLE */}
          <h2 style={styles.title}>Welcome</h2>

          {/* FORM */}
          <form onSubmit={handleSubmit}>
            {/* LOGIN ID */}
            <div style={styles.field}>
              <label style={styles.label}>Login ID</label>
              <div style={styles.inputWrapper}>
                <span style={styles.inputIcon}>
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect
                      x="3"
                      y="5"
                      width="18"
                      height="14"
                      rx="2.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M3.5 7L12 13L20.5 7"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your login ID"
                  autoComplete="email"
                  className="login-input"
                  style={styles.input}
                  disabled={loading}
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <div style={styles.passwordWrapper}>
                <span style={styles.inputIcon}>
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect
                      x="4.5"
                      y="10.5"
                      width="15"
                      height="10"
                      rx="2.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M8 10.5V8C8 5.8 9.8 4 12 4C14.2 4 16 5.8 16 8V10.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <circle cx="12" cy="15.5" r="1.4" fill="currentColor" />
                  </svg>
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="login-input"
                  style={styles.passwordInput}
                  disabled={loading}
                />

                {/* PASSWORD SHOW / HIDE */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  disabled={loading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    /* EYE */
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M2.5 12C2.5 12 6 5.5 12 5.5C18 5.5 21.5 12 21.5 12C21.5 12 18 18.5 12 18.5C6 18.5 2.5 12 2.5 12Z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="3"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                    </svg>
                  ) : (
                    /* EYE WITH SLASH */
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M3 3L21 21"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M10.6 5.7C11.05 5.57 11.52 5.5 12 5.5C18 5.5 21.5 12 21.5 12C21.5 12 20.35 14.14 18.35 16.05"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M6.15 6.15C3.75 8.05 2.5 12 2.5 12C2.5 12 6 18.5 12 18.5C13.5 18.5 14.85 18.05 16.05 17.35"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9.9 9.9C9.35 10.45 9 11.2 9 12C9 13.66 10.34 15 12 15C12.8 15 13.55 14.65 14.1 14.1"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* ERROR */}
            {error && <div style={styles.error}>{error}</div>}

            {/* LOGIN BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="login-btn"
              style={{
                ...styles.button,
                ...(loading ? styles.buttonDisabled : {}),
              }}
            >
              {loading ? (
                <>
                  <span className="login-spinner" />
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </button>
          </form>
        </div>

        <div style={styles.footer}>
          Make easy your D/O with Easy-DO
        </div>
      </div>
    </div>
  );
}

// ==================================================
// LOGIN PAGE CSS (animations, input focus, button hover)
// ==================================================

const LOGIN_CSS = `
  .login-blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(55px);
    opacity: 0.55;
    pointer-events: none;
    animation: loginFloat 7s ease-in-out infinite;
  }
  .login-card {
    animation: loginFadeUp 0.45s ease-out both;
  }
  .login-input {
    transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  }
  .login-input:focus {
    border-color: #2563eb !important;
    background: #ffffff !important;
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.15);
    outline: none;
  }
  .login-input:disabled {
    opacity: 0.6;
  }
  .login-btn {
    transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
  }
  .login-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    filter: brightness(1.06);
  }
  .login-btn:active:not(:disabled) {
    transform: translateY(0);
  }
  .login-spinner {
    width: 15px;
    height: 15px;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-top-color: #ffffff;
    border-radius: 50%;
    display: inline-block;
    vertical-align: -2px;
    margin-right: 8px;
    animation: loginSpin 0.7s linear infinite;
  }
  @keyframes loginFloat {
    0%, 100% { transform: translateY(0) scale(1); }
    50% { transform: translateY(-14px) scale(1.05); }
  }
  @keyframes loginFadeUp {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes loginSpin {
    to { transform: rotate(360deg); }
  }
`;


// ==================================================
// STYLES
// ==================================================

const styles: Record<
  string,
  React.CSSProperties
> = {

  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    boxSizing: "border-box",
    position: "relative",
    overflow: "hidden",
    // Light and airy: white -> soft sky -> hint of peach, no heavy blue
    background:
      "linear-gradient(160deg, #ffffff 0%, #eef4ff 42%, #e0f2fe 68%, #ffedd5 100%)",
  },

  cardWrap: {
    position: "relative",
    zIndex: 2,
    width: "100%",
    maxWidth: 400,
  },

  card: {
    width: "100%",
    background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
    border: "1px solid #e6eefc",
    borderRadius: 24,
    padding: "32px 28px 26px",
    boxSizing: "border-box",
    boxShadow:
      "0 24px 60px rgba(37, 99, 235, 0.14), 0 2px 8px rgba(15, 23, 42, 0.05)",
  },

  logo: {
    textAlign: "center",
    marginBottom: 20,
  },

  accentBar: {
    width: 56,
    height: 5,
    borderRadius: 99,
    margin: "14px auto 10px",
    background: "linear-gradient(90deg, #2563eb, #38bdf8 55%, #f59e0b)",
  },

  courtesy: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.4,
    color: "#94a3b8",
  },

  title: {
    margin: "0 0 24px",
    textAlign: "center",
    fontSize: 22,
    fontWeight: 800,
    color: "#0f172a",
    letterSpacing: -0.3,
  },

  field: {
    marginBottom: 16,
  },

  label: {
    display: "block",
    marginBottom: 6,
    fontSize: 12,
    fontWeight: 700,
    color: "#334155",
  },

  inputWrapper: {
    position: "relative",
    width: "100%",
  },

  inputIcon: {
    position: "absolute",
    left: 13,
    top: "50%",
    transform: "translateY(-50%)",
    display: "flex",
    alignItems: "center",
    color: "#2563eb",
    pointerEvents: "none",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 14px 13px 40px",
    border: "1px solid #dbe7fb",
    borderRadius: 12,
    outline: "none",
    fontSize: 14,
    color: "#0f172a",
    background: "#f4f8ff",
  },

  // ==========================================
  // PASSWORD INPUT
  // ==========================================

  passwordWrapper: {
    position: "relative",
    width: "100%",
  },

  passwordInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 44px 13px 40px",
    border: "1px solid #dbe7fb",
    borderRadius: 12,
    outline: "none",
    fontSize: 14,
    color: "#0f172a",
    background: "#f4f8ff",
  },

  eyeButton: {
    position: "absolute",
    right: 5,
    top: "50%",
    transform: "translateY(-50%)",
    width: 34,
    height: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    background: "transparent",
    color: "#64748b",
    cursor: "pointer",
    borderRadius: 7,
    padding: 0,
  },

  error: {
    marginBottom: 14,
    padding: "11px 12px",
    borderRadius: 10,
    background: "#fee2e2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    fontSize: 12,
    fontWeight: 600,
  },

  button: {
    width: "100%",
    border: "none",
    borderRadius: 12,
    padding: 14,
    background: "linear-gradient(90deg, #1d4ed8, #2563eb 55%, #0ea5e9)",
    boxShadow: "0 12px 24px rgba(37, 99, 235, 0.35)",
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: 0.3,
    cursor: "pointer",
  },

  buttonDisabled: {
    opacity: 0.75,
    cursor: "not-allowed",
  },

  footer: {
    marginTop: 18,
    textAlign: "center",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.3,
    color: "#64748b",
  },

};
