import {
  useEffect,
  useState,
} from "react";

import type { FormEvent } from "react";

import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";


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

      <div style={styles.card}>

        {/* LOGO */}

        <div style={styles.logo}>

          <img
            src="/easy_do_logo.png"
            alt="Easy D/O"
            style={{
              width: "100px",
              height: "auto",
              objectFit: "contain",
              display: "block",
              margin: "0 auto",
            }}
          />

        </div>


        {/* TITLE */}

        <h2 style={styles.title}>
          Sign in to continue
        </h2>


        {/* FORM */}

        <form
          onSubmit={handleSubmit}
        >

          {/* LOGIN ID */}

          <div style={styles.field}>

            <label style={styles.label}>
              Login ID
            </label>


            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
              placeholder="Enter your login ID"
              autoComplete="email"
              style={styles.input}
              disabled={loading}
            />

          </div>


          {/* PASSWORD */}

          <div style={styles.field}>

            <label style={styles.label}>
              Password
            </label>


            <div style={styles.passwordWrapper}>

              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
                placeholder="Enter your password"
                autoComplete="current-password"
                style={styles.passwordInput}
                disabled={loading}
              />


              {/* PASSWORD SHOW / HIDE */}

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    !showPassword
                  )
                }
                style={styles.eyeButton}
                disabled={loading}
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
                title={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
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

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}


          {/* LOGIN BUTTON */}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              ...(loading
                ? styles.buttonDisabled
                : {}),
            }}
          >

            {loading
              ? "Logging in..."
              : "Login"}

          </button>

        </form>

      </div>

    </div>
  );
}


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
    background: "#f3f4f6",
    boxSizing: "border-box",
  },


  card: {
    width: "100%",
    maxWidth: 390,
    background: "#ffffff",
    borderRadius: 16,
    padding: 25,
    boxSizing: "border-box",
    boxShadow:
      "0 10px 30px rgba(0,0,0,.08)",
  },


  logo: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: 800,
    color: "#111827",
    marginBottom: 15,
  },


  title: {
    margin: 0,
    textAlign: "center",
    fontSize: 16,
    fontWeight: 800,
    color: "#111827",
    marginBottom: 22,
  },


  subtitle: {
    margin: "5px 0 22px",
    textAlign: "center",
    fontSize: 12,
    color: "#6b7280",
  },


  field: {
    marginBottom: 14,
  },


  label: {
    display: "block",
    marginBottom: 5,
    fontSize: 11,
    fontWeight: 700,
    color: "#374151",
    marginTop: 10,
  },


  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: 12,
    border:
      "1px solid #cbd5e1",
    borderRadius: 9,
    outline: "none",
    fontSize: 13,
    color: "#111827",
    background: "#ffffff",
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
    padding: "12px 44px 12px 12px",
    border:
      "1px solid #cbd5e1",
    borderRadius: 9,
    outline: "none",
    fontSize: 13,
    color: "#111827",
    background: "#ffffff",
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
    color: "#6b7280",
    cursor: "pointer",
    borderRadius: 7,
    padding: 0,
  },


  error: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 8,
    background: "#fee2e2",
    color: "#991b1b",
    fontSize: 11,
    fontWeight: 600,
  },


  button: {
    width: "100%",
    border: "none",
    borderRadius: 9,
    padding: 13,
    background: "#111827",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },


  buttonDisabled: {
    opacity: 0.7,
    cursor: "not-allowed",
  },

};