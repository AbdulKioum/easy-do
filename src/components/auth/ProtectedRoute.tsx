import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import {
  useAuth,
  type UserRole,
} from "../../context/AuthContext";
import AppSplashLoader from "../common/AppSplashLoader";


type ProtectedRouteProps = {
  allowedRoles?: UserRole[];
};


export default function ProtectedRoute({
  allowedRoles,
}: ProtectedRouteProps) {

  const {
    user,
    profile,
    role,
    loading,
  } = useAuth();

  const location = useLocation();


  // ==========================================
  // AUTH / PROFILE LOADING
  // ==========================================

  if (loading) {
    return <AppSplashLoader />;
  }


  // ==========================================
  // NOT LOGGED IN
  // ==========================================

  if (!user) {

    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
        }}
      />
    );
  }


  // ==========================================
  // USER EXISTS BUT PROFILE IS NOT AVAILABLE
  // (e.g. first launch with no cached profile yet and no network)
  // This is now recoverable instead of a dead end: retry, or sign in again.
  // ==========================================

  if (!profile) {

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 10,
          background: "#f3f4f6",
          color: "#374151",
          padding: 20,
          textAlign: "center",
        }}
      >

        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
          }}
        >
          Profile not found
        </div>

        <div
          style={{
            fontSize: 12,
            color: "#6b7280",
            maxWidth: 300,
          }}
        >
          Your account is logged in, but your user
          profile could not be loaded. Please check
          your internet connection and try again.
        </div>

        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: 8,
            padding: "10px 22px",
            borderRadius: 9,
            border: "none",
            background: "#111827",
            color: "#fff",
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Retry
        </button>

        <button
          type="button"
          onClick={() => {
            window.location.href = "/login";
          }}
          style={{
            padding: "10px 22px",
            borderRadius: 9,
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#374151",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Go to Login
        </button>

      </div>
    );
  }


  // ==========================================
  // ROLE NOT FOUND
  // ==========================================

  if (!role) {

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 8,
          background: "#f3f4f6",
          color: "#374151",
        }}
      >

        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          User role not found
        </div>

        <div
          style={{
            fontSize: 12,
            color: "#6b7280",
          }}
        >
          Please contact Super Admin.
        </div>

      </div>
    );
  }


  // ==========================================
  // ROLE CHECK
  // ==========================================

  if (
    allowedRoles &&
    !allowedRoles.includes(role)
  ) {

    return (
      <Navigate
        to="/"
        replace
      />
    );
  }


  // ==========================================
  // ACCESS GRANTED
  // ==========================================

  return <Outlet />;
}