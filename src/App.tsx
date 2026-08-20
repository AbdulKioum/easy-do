import { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import SideMenu from "./components/common/SideMenu";

import EasyDOPage from "./pages/EasyDOPage";
import EasyDOFormat1 from "./pages/EasyDOFormat1";
import SavedDOPage from "./pages/do/SavedDOPage";
import PriceListPage from "./pages/PriceListPage";
import TransportationPage from "./pages/TransportationPage";
import UpazilaPage from "./pages/UpazilaPage";

import LoginPage from "./pages/auth/LoginPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import UserManagementPage from "./pages/admin/UserManagementPage";

import {
  useAuth,
  type UserRole,
} from "./context/AuthContext";


export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* LOGIN */}
        <Route
          path="/login"
          element={<LoginPage />}
        />

        {/* PROTECTED APP */}
        <Route element={<ProtectedRoute />}>
          <Route
            path="/*"
            element={<MainApp />}
          />
        </Route>

        {/* FALLBACK */}
        <Route
          path="*"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />

      </Routes>
    </BrowserRouter>
  );
}


/* =====================================================
   PAGE ACCESS CHECK
===================================================== */

function canAccessPage(
  page: string,
  role: UserRole | null
): boolean {

  if (!role) {
    return false;
  }

  if (page === "user-management") {
    return role === "super_admin";
  }

  if (page === "easy-do" || page === "easy-do-format-1") {
    return true;
  }

  if (
    page === "saved-dos" ||
    page === "price-list" ||
    page === "transportation" ||
    page === "upazila"
  ) {
    return (
      role === "user" ||
      role === "admin" ||
      role === "super_admin"
    );
  }

  return false;
}


/* =====================================================
   MAIN APP
===================================================== */

function MainApp() {

  const { role } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // সাইটে ঢুকলেই যেন ১ম পেজ হিসেবে Easy DO Format 1 আসে
  const [currentPage, setCurrentPage] = useState("easy-do-format-1");

  function handleNavigate(page: string) {

    if (!canAccessPage(page, role)) {
      console.warn(`Access denied for page "${page}"`, { role, page });
      setCurrentPage("easy-do-format-1");
      setMenuOpen(false);
      return;
    }

    setCurrentPage(page);
    setMenuOpen(false);
  }

  function renderPage() {

    if (!canAccessPage(currentPage, role)) {
      return <EasyDOFormat1 />;
    }

    switch (currentPage) {
      case "easy-do-format-1":
        return <EasyDOFormat1 />;

      case "easy-do":
        return <EasyDOPage />;

      case "saved-dos":
        return <SavedDOPage />;

      case "price-list":
        return <PriceListPage />;

      case "transportation":
        return <TransportationPage />;

      case "upazila":
        return <UpazilaPage />;

      case "user-management":
        if (role !== "super_admin") {
          return <EasyDOFormat1 />;
        }
        return <UserManagementPage />;

      default:
        return <EasyDOFormat1 />;
    }
  }

  return (
    <div style={styles.app}>

      {/* TOP BAR */}
      <header style={styles.topBar}>

        <button
          onClick={() => setMenuOpen(true)}
          style={styles.menuButton}
          aria-label="Open menu"
        >
          ☰
        </button>

        <div style={styles.topTitle}>
          <img
            src="/easy_do_logo.png"
            alt="Easy D/O"
            style={{
              width: "90px",
              height: "auto",
              objectFit: "contain",
              display: "block",
              margin: "0 auto",
            }}
          />
          <h2 style={styles.titlecourtesy}>
            By Team Mymensingh
          </h2>
        </div>

        <div style={styles.topRight}>
          {(currentPage === "easy-do" || currentPage === "easy-do-format-1") && (
            <span style={styles.statusDot} />
          )}
        </div>

      </header>

      {/* PAGE CONTENT */}
      <main style={styles.content}>
        {renderPage()}
      </main>

      {/* SIDE MENU */}
      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        currentPage={currentPage}
        onNavigate={handleNavigate}
      />

    </div>
  );
}


/* =====================================================
   STYLES
===================================================== */

const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: "100vh",
    background: "#f8fafc",
    color: "#0f172a",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },

  topBar: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    height: 60,
    background: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    padding: "0 16px",
    boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
  },

  menuButton: {
    border: "1px solid #e2e8f0",
    background: "#f1f5f9",
    color: "#1e293b",
    width: 38,
    height: 38,
    borderRadius: 8,
    fontSize: 18,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  topTitle: {
    flex: 1,
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  titlecourtesy: {
    margin: "2px 0 0 0",
    textAlign: "center",
    fontSize: 10,
    fontWeight: 700,
    color: "#64748b",
    letterSpacing: "0.5px",
  },

  topRight: {
    width: 38,
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
  },

  statusDot: {
    width: 9,
    height: 9,
    background: "#10b981",
    borderRadius: "50%",
    boxShadow: "0 0 0 2px #d1fae5",
  },

  content: {
    width: "100%",
    minHeight: "calc(100vh - 60px)",
  },
};