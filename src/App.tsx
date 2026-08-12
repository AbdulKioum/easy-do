import { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import SideMenu from "./components/common/SideMenu";

import EasyDOPage from "./pages/EasyDOPage";
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

        {/* =========================
            LOGIN
        ========================= */}

        <Route
          path="/login"
          element={<LoginPage />}
        />


        {/* =========================
            PROTECTED APP
        ========================= */}

        <Route element={<ProtectedRoute />}>
          <Route
            path="/*"
            element={<MainApp />}
          />
        </Route>


        {/* =========================
            FALLBACK
        ========================= */}

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


  /* =========================
     USER MANAGEMENT
     SUPER ADMIN ONLY
  ========================= */

  if (
    page === "user-management"
  ) {
    return role === "super_admin";
  }


  /* =========================
     EASY DO
     ALL USERS
  ========================= */

  if (
    page === "easy-do"
  ) {
    return true;
  }


  /* =========================
     SAVED DO
     ALL USERS
  ========================= */

  if (
    page === "saved-dos"
  ) {
    return (
      role === "user" ||
      role === "admin" ||
      role === "super_admin"
    );
  }


  /* =========================
     PRICE LIST
     ALL USERS CAN VIEW
  ========================= */

  if (
    page === "price-list"
  ) {
    return (
      role === "user" ||
      role === "admin" ||
      role === "super_admin"
    );
  }


  /* =========================
     TRANSPORTATION
     ALL USERS CAN VIEW
  ========================= */

  if (
    page === "transportation"
  ) {
    return (
      role === "user" ||
      role === "admin" ||
      role === "super_admin"
    );
  }


  /* =========================
     UPAZILA
     ALL USERS CAN VIEW
  ========================= */

  if (
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

  const {
    role,
  } = useAuth();


  const [menuOpen, setMenuOpen] =
    useState(false);


  const [currentPage, setCurrentPage] =
    useState("easy-do");


  /* =====================================================
     NAVIGATION WITH ROLE CHECK
  ===================================================== */

  function handleNavigate(
    page: string
  ) {

    /* =========================
       CHECK PERMISSION
    ========================= */

    if (
      !canAccessPage(
        page,
        role
      )
    ) {

      console.warn(
        `Access denied for page "${page}"`,
        {
          role,
          page,
        }
      );

      // Unauthorized page হলে
      // Easy DO-তে নিয়ে যাবে

      setCurrentPage("easy-do");

      setMenuOpen(false);

      return;
    }


    /* =========================
       ACCESS GRANTED
    ========================= */

    setCurrentPage(page);

    setMenuOpen(false);
  }


  /* =====================================================
     PAGE RENDER
  ===================================================== */

  function renderPage() {

    /* =========================
       EXTRA SECURITY CHECK
    ========================= */

    if (
      !canAccessPage(
        currentPage,
        role
      )
    ) {

      return <EasyDOPage />;
    }


    /* =========================
       PAGE SWITCH
    ========================= */

    switch (
      currentPage
    ) {

      /* =========================
         EASY DO
      ========================= */

      case "easy-do":

        return (
          <EasyDOPage />
        );


      /* =========================
         SAVED DO
      ========================= */

      case "saved-dos":

        return (
          <SavedDOPage />
        );


      /* =========================
         PRICE LIST
      ========================= */

      case "price-list":

        return (
          <PriceListPage />
        );


      /* =========================
         TRANSPORTATION
      ========================= */

      case "transportation":

        return (
          <TransportationPage />
        );


      /* =========================
         UPAZILA
      ========================= */

      case "upazila":

        return (
          <UpazilaPage />
        );


      /* =========================
         USER MANAGEMENT
         SUPER ADMIN ONLY
      ========================= */

      case "user-management":

        if (
          role !== "super_admin"
        ) {

          return (
            <EasyDOPage />
          );
        }

        return (
          <UserManagementPage />
        );


      /* =========================
         DEFAULT
      ========================= */

      default:

        return (
          <EasyDOPage />
        );
    }
  }


  return (
    <div
      style={styles.app}
    >

      {/* =================================================
          TOP BAR
      ================================================= */}

      <header
        style={styles.topBar}
      >

        {/* MENU BUTTON */}

        <button
          onClick={() =>
            setMenuOpen(true)
          }
          style={
            styles.menuButton
          }
          aria-label="Open menu"
        >
          ☰
        </button>


        {/* LOGO */}

        <div
          style={
            styles.topTitle
          }
        >

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


        {/* RIGHT SIDE */}

        <div
          style={
            styles.topRight
          }
        >

          {currentPage ===
            "easy-do" && (
            <span
              style={
                styles.statusDot
              }
            />
          )}

        </div>

      </header>


      {/* =================================================
          PAGE
      ================================================= */}

      <main
        style={
          styles.content
        }
      >

        {renderPage()}

      </main>


      {/* =================================================
          SIDE MENU
      ================================================= */}

      <SideMenu
        open={menuOpen}
        onClose={() =>
          setMenuOpen(false)
        }
        currentPage={
          currentPage
        }
        onNavigate={
          handleNavigate
        }
      />

    </div>
  );
}


/* =====================================================
   STYLES
===================================================== */

const styles: Record<
  string,
  React.CSSProperties
> = {

  app: {
    minHeight: "100vh",
    background:
      "#f3f4f6",
    color:
      "#111827",
  },


  topBar: {
    position:
      "sticky",
    top: 0,
    zIndex: 100,
    height: 58,
    background:
      "#ffffff",
    borderBottom:
      "1px solid #e5e7eb",
    display:
      "flex",
    alignItems:
      "center",
    padding:
      "0 14px",
  },


  menuButton: {
    border:
      "none",
    background:
      "#f3f4f6",
    color:
      "#111827",
    width: 38,
    height: 38,
    borderRadius: 10,
    fontSize: 20,
    cursor:
      "pointer",
  },


  topTitle: {
    flex: 1,
    textAlign:
      "center",
    fontSize: 18,
    fontWeight: 800,
  },


  topRight: {
    width: 38,
    display:
      "flex",
    justifyContent:
      "flex-end",
  },


  statusDot: {
    width: 8,
    height: 8,
    background:
      "#22c55e",
    borderRadius:
      "50%",
  },


  content: {
    width:
      "100%",
    minHeight:
      "calc(100vh - 58px)",
  },
};