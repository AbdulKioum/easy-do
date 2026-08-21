import React from "react";
import { useAuth } from "../../context/AuthContext";

type SideMenuProps = {
  open: boolean;
  onClose: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
};

export default function SideMenu({
  open,
  onClose,
  currentPage,
  onNavigate,
}: SideMenuProps) {

  const { profile, role, signOut } = useAuth();

  if (!open) {
    return null;
  }

  function navigate(page: string) {
    onNavigate(page);
    onClose();
  }

  async function handleLogout() {
    await signOut();
    onClose();
  }

  return (
    <>
      {/* BACKDROP */}
      <div style={styles.backdrop} onClick={onClose} />

      {/* DRAWER */}
      <aside style={styles.drawer}>

        {/* HEADER */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <img
              src="/easy_do_logo.png"
              alt="Easy D/O"
              style={{
                width: "90px",
                height: "auto",
                objectFit: "contain",
                display: "block",
              }}
            />
            <div style={styles.subtitle}>Feed Order Management</div>
          </div>

          <button onClick={onClose} style={styles.closeButton}>
            ✕
          </button>
        </div>

        

        {/* MENU ITEMS (LEFT ALIGNED) */}
        <div style={styles.menu}>

          <MenuItem
            icon="📄"
            label="Create D/O Format 1"
            active={currentPage === "easy-do-format-1"}
            onClick={() => navigate("easy-do-format-1")}
          />

          <MenuItem
            icon="📝"
            label="Create D/O Format 2"
            active={currentPage === "easy-do"}
            onClick={() => navigate("easy-do")}
          />

          <MenuItem
            icon="💾"
            label="Saved DO"
            active={currentPage === "saved-dos"}
            onClick={() => navigate("saved-dos")}
          />

          <MenuItem
            icon="💰"
            label="Price List"
            active={currentPage === "price-list"}
            onClick={() => navigate("price-list")}
          />

          <MenuItem
            icon="🚚"
            label="Transportation"
            active={currentPage === "transportation"}
            onClick={() => navigate("transportation")}
          />

          <MenuItem
            icon="📍"
            label="Upazila"
            active={currentPage === "upazila"}
            onClick={() => navigate("upazila")}
          />

          {role === "super_admin" && (
            <MenuItem
              icon="👥"
              label="User Management"
              active={currentPage === "user-management"}
              onClick={() => navigate("user-management")}
            />
          )}

        </div>

        {/* USER INFO */}
        <div style={styles.userBox}>
          <div style={styles.userName}>
            {profile?.full_name || profile?.email || "User"}
          </div>
          <div style={styles.roleBadge}>
            {role === "super_admin"
              ? "SUPER ADMIN"
              : role === "admin"
              ? "ADMIN"
              : "USER"}
          </div>
        </div>

        {/* FOOTER */}
        <div style={styles.footer}>
          <button onClick={handleLogout} style={styles.logoutButton}>
            🚪 Logout
          </button>
        </div>

      </aside>
    </>
  );
}

function MenuItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.menuItem,
        ...(active ? styles.menuItemActive : {}),
      }}
    >
      <span style={styles.icon}>{icon}</span>
      <span style={styles.label}>{label}</span>
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.4)",
    backdropFilter: "blur(2px)",
    zIndex: 999,
  },

  drawer: {
    position: "fixed",
    top: 0,
    left: 0,
    bottom: 0,
    width: 280,
    maxWidth: "82vw",
    background: "#ffffff",
    zIndex: 1000,
    boxShadow: "4px 0 24px rgba(0, 0, 0, 0.08)",
    display: "flex",
    flexDirection: "column",
  },

  header: {
    padding: "18px 16px",
    borderBottom: "1px solid #f1f5f9",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  headerLeft: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
  },

  subtitle: {
    marginTop: 4,
    fontSize: 11,
    color: "#64748b",
    fontWeight: 500,
  },

  closeButton: {
    border: "none",
    background: "#f1f5f9",
    color: "#475569",
    width: 32,
    height: 32,
    borderRadius: 8,
    fontSize: 14,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  userBox: {
    margin: "12px 16px 4px 16px",
    padding: "10px 12px",
    borderRadius: 8,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  userName: {
    fontSize: 13,
    fontWeight: 600,
    color: "#1e293b",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "150px",
  },

  roleBadge: {
    padding: "2px 6px",
    borderRadius: 4,
    background: "#0f172a",
    color: "#ffffff",
    fontSize: 9,
    fontWeight: 700,
  },

  menu: {
    padding: "12px 10px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    flex: 1,
    overflowY: "auto",
  },

  menuItem: {
    width: "100%",
    border: "none",
    background: "transparent",
    color: "#334155",
    padding: "10px 12px",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start", // Left Aligned
    gap: 12,
    fontSize: 14,
    fontWeight: 500,
    textAlign: "left",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },

  menuItemActive: {
    background: "#2563eb", // Professional Blue Accent
    color: "#ffffff",
    fontWeight: 600,
  },

  icon: {
    width: 20,
    textAlign: "left",
    fontSize: 16,
    display: "flex",
    alignItems: "center",
  },

  label: {
    flex: 1,
    textAlign: "left",
  },

  footer: {
    padding: 16,
    borderTop: "1px solid #f1f5f9",
    flexShrink: 0,
    background: "#ffffff",
  },

  logoutButton: {
    width: "100%",
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#dc2626",
    borderRadius: 8,
    padding: "10px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
};