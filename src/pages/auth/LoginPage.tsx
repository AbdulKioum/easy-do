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
        "Please enter your email."
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


        <h2 style={styles.title}>
          Sign in to continue
        </h2>




        <form
          onSubmit={handleSubmit}
        >

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
              placeholder="Enter your email"
              autoComplete="email"
              style={styles.input}
              disabled={loading}
            />

          </div>


          <div style={styles.field}>

            <label style={styles.label}>
              Password
            </label>


            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
              placeholder="Enter your password"
              autoComplete="current-password"
              style={styles.input}
              disabled={loading}
            />

          </div>


          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}


          <button
            type="submit"
            disabled={loading}
            style={styles.button}
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
};