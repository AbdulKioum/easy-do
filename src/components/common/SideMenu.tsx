import React, { useEffect, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { useAuth } from "../../context/AuthContext";
import {
  flushOutbox,
  getCachedProfile,
  getLastSyncTime,
  isOnline,
  isRunningInsideApp,
  logPageVisit,
  syncAllMasterDataInBackground,
} from "../../lib/offlineSync";
import {
  checkForUpdate,
  openApkDownload,
  type UpdateInfo,
} from "../../lib/appUpdate";

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
  const { user, profile, role, signOut } = useAuth();
  const [assignedPriceList, setAssignedPriceList] = useState<string>(
    (profile as any)?.assigned_price_list || "price_list_1"
  );
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [appUpdate, setAppUpdate] = useState<UpdateInfo | null>(null);
  const [appVersion, setAppVersion] = useState<string | null>(null);

  // Installed APK version, shown next to the logo (APK only — browser
  // always runs the latest web code, so no version is shown there).
  useEffect(() => {
    if (!isRunningInsideApp()) return;
    let live = true;
    void (async () => {
      try {
        const info = await CapApp.getInfo();
        const v = String(info?.version || "").trim();
        if (live && v) setAppVersion(v);
        else if (live && window.location.hostname.includes("vercel.app")) setAppVersion("1.1");
      } catch {
        if (live && window.location.hostname.includes("vercel.app")) setAppVersion("1.1");
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  // New APK available? (APK only — checkForUpdate returns null in browser.)
  useEffect(() => {
    let live = true;
    void checkForUpdate().then((info) => {
      if (live && info) setAppUpdate(info);
    });
    return () => {
      live = false;
    };
  }, [user?.id]);

  // Read the assigned price list from the cached profile instead of
  // refetching profiles on every menu open (works offline too).
  useEffect(() => {
    async function loadFromCache() {
      try {
        const cached = await getCachedProfile();
        const list =
          (cached as any)?.assigned_price_list ||
          (profile as any)?.assigned_price_list;
        if (list) {
          setAssignedPriceList(list);
        }
        setLastSync(await getLastSyncTime());
      } catch {
        /* offline cache read must never break the menu */
      }
    }
    if (open) {
      loadFromCache();
    }
  }, [user?.id, open]);

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

  function formatSyncTime(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()} ${hh}:${min}`;
  }

  // Manual master-data refresh. Offline it never blocks — it just reports
  // that the saved data is being used.
  async function handleUpdateData() {
    if (syncing) return;
    if (!isOnline()) {
      setSyncNote("No internet — using saved data");
      return;
    }
    setSyncing(true);
    setSyncNote(null);
    try {
      await syncAllMasterDataInBackground(user?.id, role === "super_admin");
      await flushOutbox();
      const ts = await getLastSyncTime();
      setLastSync(ts);
      // A fresh sync may carry a changed assigned price list.
      const cached = await getCachedProfile();
      if ((cached as any)?.assigned_price_list) {
        setAssignedPriceList((cached as any).assigned_price_list);
      }
    } catch {
      setSyncNote("Update failed — using saved data");
    } finally {
      setSyncing(false);
    }
  }

  const syncStatusText = syncing
    ? "Updating…"
    : syncNote ||
      (lastSync
        ? `Last updated: ${formatSyncTime(lastSync)}`
        : "Never updated yet");

  // Track APK download inside page_visits so it shows on VisitStatusPage.
  // Queued offline and sent when back online — never a direct insert.
  async function handleTrackAppDownload() {
    if (!user?.id) return;
    await logPageVisit("App Download APK", user.id, user.email || undefined);
  }

  const isAdminOrSuper = role === "admin" || role === "super_admin";
  const userTargetPricePage =
    assignedPriceList === "price_list_2" ? "price-list-2" : "price-list";

  const isInsideApp = isRunningInsideApp();
  const APK_DOWNLOAD_URL =
    "https://xazcbgiovvrtzrhymgsc.supabase.co/storage/v1/object/public/APK/Easy-DO.apk?download=Easy-DO.apk";

  return (
    <>
      {/* BACKDROP */}
      <div style={styles.backdrop} onClick={onClose} />

      {/* DRAWER */}
      <aside style={styles.drawer}>
        {/* HEADER */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
              {isRunningInsideApp() && appVersion && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#2563eb",
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    padding: "2px 7px",
                    borderRadius: 20,
                    whiteSpace: "nowrap",
                  }}
                >
                  v{appVersion}
                </span>
              )}
            </div>
            <div style={styles.subtitle}>Make easy your D/O with Easy-DO</div>
          </div>

          <button onClick={onClose} style={styles.closeButton}>
            ✕
          </button>
        </div>

        {/* MENU ITEMS (LEFT ALIGNED) */}
        <div style={styles.menu}>
          <MenuItem
            icon="📝"
            label="Create D/O"
            active={currentPage === "easy-do-format-1"}
            onClick={() => navigate("easy-do-format-1")}
          />

          <MenuItem
            icon="💾"
            label="Saved DO"
            active={currentPage === "saved-dos"}
            onClick={() => navigate("saved-dos")}
          />

          {isAdminOrSuper ? (
            <>
              <MenuItem
                icon="💰"
                label="Price List 1"
                active={currentPage === "price-list"}
                onClick={() => navigate("price-list")}
              />
              <MenuItem
                icon="🏷️"
                label="Price List 2"
                active={currentPage === "price-list-2"}
                onClick={() => navigate("price-list-2")}
              />
            </>
          ) : (
            <MenuItem
              icon="💰"
              label="Price List"
              active={
                currentPage === "price-list" || currentPage === "price-list-2"
              }
              onClick={() => navigate(userTargetPricePage)}
            />
          )}

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
            <>
              <MenuItem
                icon="📊"
                label="Visit Status"
                active={currentPage === "visit-status"}
                onClick={() => navigate("visit-status")}
              />
              <MenuItem
                icon="👥"
                label="Users"
                active={currentPage === "user-management"}
                onClick={() => navigate("user-management")}
              />
            </>
          )}

          {isAdminOrSuper && (
            <MenuItem
              icon="📢"
              label="Notification"
              active={currentPage === "send-notification"}
              onClick={() => navigate("send-notification")}
            />
          )}
        </div>

        {/* UPDATE DATA (APK ONLY — browser is always online, so no need) */}
        {isInsideApp && (
        <div style={{ padding: "0 16px 10px 16px" }}>
          <style>{`@keyframes easydo-spin { to { transform: rotate(360deg); } }`}</style>
          <button
            onClick={handleUpdateData}
            disabled={syncing}
            style={{
              ...styles.menuItem,
              border: "1px solid #dbeafe",
              background: "#eff6ff",
              opacity: syncing ? 0.7 : 1,
            }}
          >
            <span
              style={{
                ...styles.icon,
                display: "inline-flex",
                animation: syncing ? "easydo-spin 1s linear infinite" : undefined,
              }}
            >
              🔄
            </span>
            <span style={styles.label}>
              {syncing ? "Updating…" : "Update Data"}
            </span>
          </button>
          <div style={styles.syncStatus}>{syncStatusText}</div>
        </div>
        )}

        {/* UPDATE NOW (APK only, only when a newer version exists) */}
        {isInsideApp && appUpdate && (
          <div style={{ padding: "0 16px 10px 16px" }}>
            <button
              onClick={() => {
                void handleTrackAppDownload();
                openApkDownload(appUpdate.apkUrl);
              }}
              style={{
                ...styles.menuItem,
                border: "1px solid #bbf7d0",
                background: "#dcfce7",
              }}
            >
              <span style={styles.icon}>⬇</span>
              <span style={{ ...styles.label, color: "#166534" }}>
                Update Now ({appUpdate.latestVersionName})
              </span>
            </button>
          </div>
        )}

        {/* DOWNLOAD APP BUTTON (HIDDEN INSIDE APK AND HIDDEN FOR SUPER ADMIN) */}
        {!isInsideApp && role !== "super_admin" && (
          <div style={{ padding: "0 70px" }}>
            <a
              href={APK_DOWNLOAD_URL}
              download="Easy-DO.apk"
              onClick={(e) => {
                // Download via a hidden iframe (see openApkDownload) so the
                // DO pages' beforeunload guard never shows "Leave this page".
                e.preventDefault();
                void handleTrackAppDownload();
                openApkDownload(APK_DOWNLOAD_URL);
              }}
              style={styles.downloadAppBtn}
            >
              <span>📲</span>
              <span>Download App</span>
            </a>
          </div>
        )}

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
    justifyContent: "flex-start",
    gap: 12,
    fontSize: 14,
    fontWeight: 500,
    textAlign: "left",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  menuItemActive: {
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 600,
  },
  syncStatus: {
    marginTop: 4,
    paddingLeft: 12,
    fontSize: 11,
    color: "#64748b",
    fontWeight: 500,
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
  downloadAppBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    padding: "10px",
    borderRadius: 8,
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 700,
    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
    boxSizing: "border-box",
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