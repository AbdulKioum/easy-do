import { useState } from "react";

import SideMenu from "./components/common/SideMenu";

import EasyDOPage from "./pages/EasyDOPage";
import SavedDOPage from "./pages/do/SavedDOPage";
import PriceListPage from "./pages/PriceListPage";
import TransportationPage from "./pages/TransportationPage";
import UpazilaPage from "./pages/UpazilaPage";

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  const [currentPage, setCurrentPage] =
    useState("easy-do");

  function renderPage() {
    switch (currentPage) {
      case "price-list":
        return <PriceListPage />;

      case "transportation":
        return <TransportationPage />;

      case "upazila":
        return <UpazilaPage />;

      case "saved-dos":
        return <SavedDOPage />;

      case "easy-do":
      default:
        return <EasyDOPage />;
    }
  }

  return (
    <div style={styles.app}>
      {/* TOP BAR */}

      <header style={styles.topBar}>
        <button
          onClick={() => setMenuOpen(true)}
          style={styles.menuButton}
        >
          ☰
        </button>

        <div style={styles.topTitle}>
          <img
  src="/favicon_do.png"
  alt="Easy D/O"
  style={{
    width: "80px",
    height: "auto",
    objectFit: "contain",
    display: "block",
    margin: "0 auto",
  }}
/>
        </div>

        <div style={styles.topRight}>
          {currentPage === "easy-do" && (
            <span style={styles.statusDot} />
          )}
        </div>
      </header>

      {/* PAGE */}

      <main style={styles.content}>
        {renderPage()}
      </main>

      {/* SIDE MENU */}

      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        currentPage={currentPage}
        onNavigate={setCurrentPage}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: "100vh",
    background: "#f3f4f6",
    color: "#111827",
  },

  topBar: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    height: 58,
    background: "#ffffff",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    alignItems: "center",
    padding: "0 14px",
  },

  menuButton: {
    border: "none",
    background: "#f3f4f6",
    color: "#111827",
    width: 38,
    height: 38,
    borderRadius: 10,
    fontSize: 20,
    cursor: "pointer",
  },

  topTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: 800,
  },

  topRight: {
    width: 38,
    display: "flex",
    justifyContent: "flex-end",
  },

  statusDot: {
    width: 8,
    height: 8,
    background: "#22c55e",
    borderRadius: "50%",
  },

  content: {
    width: "100%",
    minHeight: "calc(100vh - 58px)",
  },
};
