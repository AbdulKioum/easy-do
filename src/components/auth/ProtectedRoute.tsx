import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import {
  useAuth,
  type UserRole,
} from "../../context/AuthContext";


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

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          color: "#6b7280",
          background: "#f3f4f6",
        }}
      >
        Loading...
      </div>
    );
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
          profile could not be found.
        </div>

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