import React from "react";

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
  if (!open) return null;

  function navigate(page: string) {
    onNavigate(page);
    onClose();
  }

  return (
    <>
      {/* BACKDROP */}
      <div
        style={styles.backdrop}
        onClick={onClose}
      />

      {/* DRAWER */}
      <aside style={styles.drawer}>
        <div style={styles.header}>
          <div>
            <div style={styles.logo}>
              <img
              src="/easy_do_logo.png"
              alt="Easy D/O"
              style={{
                width: "100px",
                height: "auto",
                objectFit: "contain",
                display: "block",
              }}
            />
            </div>

            <div style={styles.subtitle}>
              Feed Order Management
            </div>
          </div>

          <button
            onClick={onClose}
            style={styles.closeButton}
          >
            ×
          </button>
        </div>

        <div style={styles.menu}>
          {/* CREATE D/O */}
          <MenuItem
            icon="📝"
            label="Create D/O"
            active={
              currentPage === "easy-do"
            }
            onClick={() =>
              navigate("easy-do")
            }
          />

          {/* SAVED DO */}
          <MenuItem
            icon="💾"
            label="Saved DO"
            active={
              currentPage === "saved-dos"
            }
            onClick={() =>
              navigate("saved-dos")
            }
          />

          {/* PRICE LIST */}
          <MenuItem
            icon="💰"
            label="Price List"
            active={
              currentPage === "price-list"
            }
            onClick={() =>
              navigate("price-list")
            }
          />

          {/* TRANSPORTATION */}
          <MenuItem
            icon="🚚"
            label="Transportation"
            active={
              currentPage ===
              "transportation"
            }
            onClick={() =>
              navigate("transportation")
            }
          />

          {/* UPAZILA */}
          <MenuItem
            icon="📍"
            label="Upazila"
            active={
              currentPage === "upazila"
            }
            onClick={() =>
              navigate("upazila")
            }
          />
        </div>

        <div style={styles.footer}>
          Easy D/O

          <span style={styles.footerSpan}>
            Feed Order System
          </span>
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
        ...(active
          ? styles.menuItemActive
          : {}),
      }}
    >
      <span style={styles.icon}>
        {icon}
      </span>

      <span>{label}</span>
    </button>
  );
}

const styles: Record<
  string,
  React.CSSProperties
> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background:
      "rgba(0, 0, 0, 0.45)",
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
    boxShadow:
      "4px 0 20px rgba(0,0,0,.15)",
    display: "flex",
    flexDirection: "column",
  },

  header: {
    padding: "22px 18px",
    borderBottom:
      "1px solid #e5e7eb",
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
  },

  logo: {
    fontSize: 21,
    fontWeight: 800,
    color: "#111827",
  },

  subtitle: {
    marginTop: 3,
    fontSize: 11,
    color: "#6b7280",
  },

  closeButton: {
    border: "none",
    background: "#f3f4f6",
    color: "#111827",
    width: 36,
    height: 36,
    borderRadius: 10,
    fontSize: 24,
    cursor: "pointer",
  },

  menu: {
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },

  menuItem: {
    width: "100%",
    border: "none",
    background: "transparent",
    color: "#374151",
    padding: "13px 14px",
    borderRadius: 11,
    display: "flex",
    alignItems: "center",
    gap: 13,
    fontSize: 15,
    fontWeight: 600,
    textAlign: "left",
    cursor: "pointer",
  },

  menuItemActive: {
    background: "#111827",
    color: "#ffffff",
  },

  icon: {
    width: 24,
    textAlign: "center",
    fontSize: 19,
  },

  footer: {
    marginTop: "auto",
    padding: 18,
    borderTop:
      "1px solid #e5e7eb",
    fontSize: 12,
    fontWeight: 700,
    color: "#374151",
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },

  footerSpan: {
    color: "#9ca3af",
    fontWeight: 400,
  },
};