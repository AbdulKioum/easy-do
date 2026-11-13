import React, { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { supabase } from "./lib/supabase";

import SideMenu from "./components/common/SideMenu";

import EasyDOPage from "./pages/EasyDOFormat2";
import EasyDOFormat1 from "./pages/EasyDOFormat1";
import SavedDOPage from "./pages/do/SavedDOPage";
import PriceListPage from "./pages/PriceListPage";
import PriceListPage2 from "./pages/PriceListPage2";
import TransportationPage from "./pages/TransportationPage";
import UpazilaPage from "./pages/UpazilaPage";
import VisitStatusPage from "./pages/admin/VisitStatusPage";

import LoginPage from "./pages/auth/LoginPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import UserManagementPage from "./pages/admin/UserManagementPage";
import SendNotificationPage from "./pages/admin/SendNotificationPage";

import {
  useAuth,
  type UserRole,
} from "./context/AuthContext";

/* =====================================================
   LINKIFY HELPER (মেসেজের ভেতরের লিংক ক্লিকেবল করার জন্য)
===================================================== */
export function renderMessageWithLinks(text: string) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#2563eb",
            textDecoration: "underline",
            fontWeight: 700,
            wordBreak: "break-all",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

/* =====================================================
   FORMAT NOTIFICATION PAYLOAD (আপনার দেওয়া ফরম্যাট অনুযায়ী)
===================================================== */
function formatNotificationText(notif: any) {
  const sender = (notif.sender_name || (notif.is_reply ? "User" : "Admin"))
    .replace(/\s*\(.*?\)/g, "")
    .trim();
  const rawTitle = (notif.title || "Notice").trim();
  const msg = notif.message || "";

  if (!notif.is_reply) {
    // ১. সাধারণ নোটিশ:
    // Title: Notice (বা অ্যাডমিনের দেওয়া টাইটেল)
    // Body: [Admin Name] Send a Notice:\n[Message]
    return {
      title: rawTitle,
      body: `${sender} Send a Notice:\n${msg}`,
    };
  } else {
    const isAdminReply = rawTitle.toLowerCase().includes("admin reply");
    if (isAdminReply) {
      // ২. অ্যাডমিন যখন ইউজারের মেসেজের রিপ্লাই দেবে:
      return {
        title: rawTitle,
        body: `${sender} replied your message:\n${msg}`,
      };
    } else {
      // ৩. ইউজার যখন অ্যাডমিনের নোটিশের রিপ্লাই দেবে (অ্যাডমিনের ফোনে):
      const originalTitle = rawTitle
        .replace(/^Replied\s*/i, "")
        .replace(/^User Reply\s*/i, "")
        .trim() || "Notice";
      return {
        title: `${sender} Replied ${originalTitle} :`,
        body: msg,
      };
    }
  }
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* LOGIN */}
        <Route path="/login" element={<LoginPage />} />

        {/* PROTECTED APP */}
        <Route element={<ProtectedRoute />}>
          <Route path="/*" element={<MainApp />} />
        </Route>

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

/* =====================================================
   PAGE ACCESS CHECK
===================================================== */
function canAccessPage(page: string, role: UserRole | null): boolean {
  if (!role) return false;

  if (page === "user-management" || page === "visit-status") {
    return role === "super_admin";
  }

  if (page === "easy-do" || page === "easy-do-format-1") {
    return true;
  }

  if (page === "send-notification") {
    return role === "super_admin" || role === "admin";
  }

  if (
    page === "saved-dos" ||
    page === "price-list" ||
    page === "price-list-2" ||
    page === "transportation" ||
    page === "upazila"
  ) {
    return role === "user" || role === "admin" || role === "super_admin";
  }

  return false;
}

/* =====================================================
   MAIN APP
===================================================== */
function MainApp() {
  const { user, role } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState("easy-do-format-1");

  // NOTIFICATION STATES
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifPopup, setShowNotifPopup] = useState(false);

  // REPLY STATES
  const [replyOpenId, setReplyOpenId] = useState<number | null>(null);
  const [replyTextMap, setReplyTextMap] = useState<Record<number, string>>({});
  const [replySendingId, setReplySendingId] = useState<number | null>(null);

  // ফোনের স্ট্যাটাস বারে নোটিফিকেশন পুশ করা (অ্যাপ খোলা থাকা অবস্থায়)
  // ফোনের স্ট্যাটাস বারে ও স্ক্রিনের ওপরে Floating নোটিফিকেশন পুশ করা (অ্যাপ খোলা থাকা অবস্থায়)
  async function triggerPhoneStatusNotification(notif: any) {
    if (notif.sender_id && notif.sender_id === user?.id) return;

    const { title, body } = formatNotificationText(notif);

    // ১. যদি Android/iOS নেটিভ অ্যাপে থাকে
    if (Capacitor.isNativePlatform()) {
      try {
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== "granted") {
          await LocalNotifications.requestPermissions();
        }
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Number(String(notif.id || Date.now()).slice(-7)),
              title,
              body,
              channelId: "easydo_high_channel", // High Importance Channel (Floating Banner-এর জন্য)
              smallIcon: "ic_launcher",         // 'i' আইকনের বদলে অ্যাপের আসল লোগো দেখাবে
              largeIcon: "ic_launcher",
              schedule: { at: new Date(Date.now() + 100) },
              extra: {
                notifId: notif.id,
                isReply: Boolean(notif.is_reply),
              },
            },
          ],
        });
        return;
      } catch (e) {
        console.warn("Local notification failed:", e);
      }
    }

    // ২. যদি ওয়েব ব্রাউজারে থাকে
    if ("Notification" in window && Notification.permission === "granted") {
      const webNotif = new Notification(title, {
        body,
        icon: "/easy_do_logo.png",
      });
      webNotif.onclick = () => {
        window.focus();
        openNotificationSection(Boolean(notif.is_reply));
      };
    }
  }

  // নোটিফিকেশনে ক্লিক করলে অ্যাপের ভেতরে নোটিফিকেশন পপআপ বা অ্যাডমিন পেজ ওপেন করা
  function openNotificationSection(isReply?: boolean) {
    setShowNotifPopup(true);
    if ((role === "admin" || role === "super_admin") && isReply) {
      setCurrentPage("send-notification");
    }
  }

  // CAPACITOR PUSH & LOCAL NOTIFICATION SETUP (FCM Token Save & Click Listener)
  useEffect(() => {
    if (!user?.id) return;

    if (!Capacitor.isNativePlatform()) {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
      return;
    }

    let pushRegListener: any;
    let pushActionListener: any;
    let localActionListener: any;

    const setupNativeNotifications = async () => {
      try {
        await LocalNotifications.requestPermissions();

        // অ্যান্ড্রয়েডে Floating (Heads-up) পপ-আপের জন্য High Importance Channel তৈরি করা
        await LocalNotifications.createChannel({
          id: "easydo_high_channel",
          name: "Easy DO Alerts",
          description: "High priority notifications for Easy DO",
          importance: 5, // 5 = Max/High importance (স্ক্রিনের ওপরে ভেসে উঠবে)
          visibility: 1, // Public
          sound: "default",
          vibration: true,
          lights: true,
        });

        await PushNotifications.createChannel({
          id: "easydo_high_channel",
          name: "Easy DO Alerts",
          description: "High priority notifications for Easy DO",
          importance: 5,
          visibility: 1,
          sound: "default",
          vibration: true,
          lights: true,
        });

        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === "prompt") {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive === "granted") {
          await PushNotifications.register();
        }

        pushRegListener = await PushNotifications.addListener(
          "registration",
          async (token) => {
            console.log("FCM Token:", token.value);
            await supabase
              .from("profiles")
              .update({ fcm_token: token.value })
              .eq("id", user.id);
          }
        );

        pushActionListener = await PushNotifications.addListener(
          "pushNotificationActionPerformed",
          (action) => {
            const data = action.notification.data;
            openNotificationSection(data?.is_reply === "true" || data?.is_reply === true);
          }
        );

        localActionListener = await LocalNotifications.addListener(
          "localNotificationActionPerformed",
          (action) => {
            const extra = action.notification.extra;
            openNotificationSection(Boolean(extra?.isReply));
          }
        );
      } catch (err) {
        console.warn("Push notification setup error:", err);
      }
    };

    setupNativeNotifications();

    return () => {
      pushRegListener?.remove();
      pushActionListener?.remove();
      localActionListener?.remove();
    };
  }, [user?.id, role]);

  // FETCH NOTIFICATIONS & REALTIME
  useEffect(() => {
    if (!user?.id) return;

    async function fetchNotifications() {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .or(`user_id.eq.${user?.id},user_id.is.null`)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setNotifications(data);
      }
    }

    fetchNotifications();

    const channel = supabase
      .channel("public:notifications")
      // 1. নতুন নোটিফিকেশন আসলে সাথে সাথে লিস্টে যোগ হবে এবং ফোনের ওপরে নোটিফিকেশন পুশ হবে
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const newNotif = payload.new as any;
          if (!newNotif.user_id || newNotif.user_id === user?.id) {
            setNotifications((prev) => [newNotif, ...prev]);
            triggerPhoneStatusNotification(newNotif);
          }
        }
      )
      // 2. অ্যাডমিন নোটিফিকেশন এডিট করলে সাথে সাথে আপডেট হবে
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        (payload) => {
          const updated = payload.new as any;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n))
          );
        }
      )
      // 3. অ্যাডমিন ডিলিট করলে সাথে সাথে মুছে যাবে
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications" },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (deletedId) {
            setNotifications((prev) => prev.filter((n) => n.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  async function markAsRead(id: number) {
    const nowTime = new Date().toISOString();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: nowTime })
      .eq("id", id);

    if (!error) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: nowTime } : n))
      );
    }
  }

  async function handleReplyToAdmin(notif: any) {
    const text = (replyTextMap[notif.id] || "").trim();
    if (!text) return alert("Please write a reply first.");
    if (!user?.id) return;

    setReplySendingId(notif.id);
    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, name, username")
        .eq("id", user.id)
        .single();

      const authUserMeta = user.user_metadata;
      const realName =
        profileData?.full_name ||
        profileData?.name ||
        profileData?.username ||
        authUserMeta?.full_name ||
        authUserMeta?.name ||
        user.email?.split("@")[0] ||
        "User";

      const cleanSenderName = String(realName).replace(/\s*\(.*?\)/g, "").trim();

      const { data: admins } = await supabase
        .from("profiles")
        .select("id")
        .in("role", ["admin", "super_admin"]);

      let targetAdminIds: string[] = [];
      if (admins && admins.length > 0) {
        targetAdminIds = admins.map((a: any) => a.id);
      } else if (notif.sender_id) {
        targetAdminIds = [notif.sender_id];
      }

      if (targetAdminIds.length === 0) {
        alert("Could not find admin to send reply.");
        return;
      }

      const originalTitle = (notif.title || "Notice").trim();

      const payloads = targetAdminIds.map((adminId) => ({
        user_id: adminId,
        sender_id: user.id,
        sender_name: cleanSenderName,
        title: `Replied ${originalTitle}`, // যাতে অ্যাডমিনের কাছে "[User Name] Replied [Title] :" ফরম্যাটে যায়
        message: text,
        is_read: false,
        is_reply: true,
        reply_to_id: notif.id,
      }));
      const { error } = await supabase.from("notifications").insert(payloads);
      if (error) throw error;

      if (!notif.is_read) {
        await markAsRead(notif.id);
      }

      alert("Reply sent to Admin!");
      setReplyTextMap((prev) => ({ ...prev, [notif.id]: "" }));
      setReplyOpenId(null);
    } catch (err: any) {
      alert(`Reply failed: ${err.message}`);
    } finally {
      setReplySendingId(null);
    }
  }

  // ANDROID CAPACITOR PHYSICAL BACK BUTTON LISTENER
  useEffect(() => {
    const setupBackButton = async () => {
      const backButtonListener = await CapApp.addListener("backButton", (event: any) => {
        if (showNotifPopup) {
          setShowNotifPopup(false);
        } else if (currentPage !== "easy-do-format-1") {
          setCurrentPage("easy-do-format-1");
        } else if (!event?.canGoBack || currentPage === "easy-do-format-1") {
          const confirmExit = window.confirm("Do you want to exit the app?");
          if (confirmExit) {
            CapApp.exitApp();
          }
        } else {
          window.history.back();
        }
      });
      return backButtonListener;
    };

    let listenerPromise = setupBackButton();

    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, [currentPage, showNotifPopup]);

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
      case "price-list-2":
        return <PriceListPage2 />;
      case "transportation":
        return <TransportationPage />;
      case "upazila":
        return <UpazilaPage />;
      case "visit-status":
        if (role !== "super_admin") return <EasyDOFormat1 />;
        return <VisitStatusPage />;
      case "user-management":
        if (role !== "super_admin") return <EasyDOFormat1 />;
        return <UserManagementPage />;
      case "send-notification":
        if (role !== "super_admin" && role !== "admin") return <EasyDOFormat1 />;
        return <SendNotificationPage />;
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
          <h2 style={styles.titlecourtesy}>By Team Mymensingh</h2>
        </div>

        {/* RIGHT SIDE: MODERN NOTIFICATION ICON */}
        <div style={styles.topRight}>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowNotifPopup(!showNotifPopup)}
              style={{
                ...styles.notifButton,
                background: showNotifPopup
                  ? "linear-gradient(135deg, #2563eb, #1d4ed8)"
                  : unreadCount > 0
                  ? "#eff6ff"
                  : "#f8fafc",
                color: showNotifPopup ? "#ffffff" : unreadCount > 0 ? "#2563eb" : "#334155",
                borderColor: showNotifPopup ? "#2563eb" : unreadCount > 0 ? "#bfdbfe" : "#e2e8f0",
              }}
              aria-label="Notifications"
            >
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill={unreadCount > 0 && !showNotifPopup ? "rgba(37,99,235,0.15)" : "none"}
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>

              {unreadCount > 0 && (
                <span style={styles.badge}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {/* NOTIFICATION DROPDOWN POPUP */}
            {showNotifPopup && (
              <div style={styles.popupDropdown}>
                <div style={styles.popupHeader}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <span
                        style={{
                          background: "#dbeafe",
                          color: "#1d4ed8",
                          fontSize: 10,
                          padding: "2px 7px",
                          borderRadius: 12,
                          fontWeight: 800,
                        }}
                      >
                        {unreadCount} New
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowNotifPopup(false)}
                    style={{
                      border: "none",
                      background: "#f1f5f9",
                      borderRadius: "50%",
                      width: 24,
                      height: 24,
                      cursor: "pointer",
                      fontWeight: 800,
                      color: "#475569",
                      fontSize: 11,
                    }}
                  >
                    ✕
                  </button>
                </div>

                <div style={styles.popupBody}>
                  {notifications.length === 0 ? (
                    <div
                      style={{
                        padding: 28,
                        textAlign: "center",
                        color: "#64748b",
                        fontSize: 12,
                      }}
                    >
                      🔕 No notifications yet.
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const isReplying = replyOpenId === n.id;
                      const senderText = n.sender_name
                        ? n.sender_name.replace(/\s*\(.*?\)/g, "").trim()
                        : n.is_reply
                        ? "User"
                        : "Admin";

                      const isAdminReply = (n.title || "").toLowerCase().includes("admin reply");
                      const headerLine = !n.is_reply
                        ? `${senderText} Send a Notice:`
                        : isAdminReply
                        ? `${senderText} replied your message:`
                        : `${senderText} ${n.title || "Replied Notice"} :`;

                      return (
                        <div
                          key={n.id}
                          style={{
                            ...styles.notifItem,
                            background: n.is_read ? "#ffffff" : "#eff6ff",
                            borderLeft: n.is_read
                              ? "1px solid #e2e8f0"
                              : n.is_reply
                              ? "4px solid #f59e0b"
                              : "4px solid #2563eb",
                          }}
                        >
                          {/* TITLE */}
                          {n.title && (
                            <div
                              style={{
                                fontSize: 11.5,
                                fontWeight: 800,
                                color: n.is_reply ? "#b45309" : "#1d4ed8",
                                marginBottom: 2,
                              }}
                            >
                              {n.title}
                            </div>
                          )}

                          {/* FORMATTED SUB-HEADER */}
                          <div
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              color: "#475569",
                              marginBottom: 4,
                            }}
                          >
                            {headerLine}
                          </div>

                          {/* MESSAGE WITH CLICKABLE LINKS */}
                          <div
                            style={{
                              fontSize: 12.5,
                              fontWeight: n.is_read ? 500 : 750,
                              color: "#0f172a",
                              lineHeight: 1.4,
                              marginBottom: 6,
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {renderMessageWithLinks(n.message)}
                          </div>

                          {/* SENDER & TIME META */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: 6,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: "#475569",
                                background: "#f1f5f9",
                                padding: "2px 6px",
                                borderRadius: 4,
                              }}
                            >
                              From: {senderText}
                            </span>

                            <span
                              style={{
                                fontSize: 9.5,
                                color: "#94a3b8",
                                fontWeight: 600,
                              }}
                            >
                              {new Date(n.created_at).toLocaleString("en-BD", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>

                          {/* ACTION BUTTONS: REPLY & MARK READ */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 6,
                              borderTop: "1px dashed #e2e8f0",
                              paddingTop: 6,
                            }}
                          >
                            {!n.is_reply ? (
                              <button
                                type="button"
                                onClick={() => setReplyOpenId(isReplying ? null : n.id)}
                                style={styles.replyToggleBtn}
                              >
                                {isReplying ? "✕ Cancel" : "↩ Reply"}
                              </button>
                            ) : (
                              <span />
                            )}

                            {!n.is_read && (
                              <button
                                type="button"
                                onClick={() => markAsRead(n.id)}
                                style={styles.markReadBtn}
                              >
                                ✓ Mark Read
                              </button>
                            )}
                          </div>

                          {/* INLINE REPLY INPUT BOX */}
                          {isReplying && (
                            <div
                              style={{
                                marginTop: 8,
                                background: "#f8fafc",
                                padding: 6,
                                borderRadius: 6,
                                border: "1px solid #cbd5e1",
                              }}
                            >
                              <input
                                type="text"
                                value={replyTextMap[n.id] || ""}
                                onChange={(e) =>
                                  setReplyTextMap((prev) => ({
                                    ...prev,
                                    [n.id]: e.target.value,
                                  }))
                                }
                                placeholder="Write a short reply..."
                                style={styles.replyInput}
                              />
                              <button
                                type="button"
                                disabled={replySendingId === n.id}
                                onClick={() => handleReplyToAdmin(n)}
                                style={styles.replySendBtn}
                              >
                                {replySendingId === n.id ? "Sending..." : "➤ Reply to Admin"}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* PAGE CONTENT */}
      <main style={styles.content}>{renderPage()}</main>

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
  notifButton: {
    border: "1px solid #e2e8f0",
    width: 40,
    height: 40,
    borderRadius: 12,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    transition: "all 0.2s ease",
    boxShadow: "0 2px 6px rgba(15, 23, 42, 0.05)",
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -5,
    background: "linear-gradient(135deg, #ef4444, #dc2626)",
    color: "#ffffff",
    borderRadius: 20,
    padding: "2px 5.5px",
    fontSize: 9.5,
    fontWeight: 800,
    border: "2px solid #ffffff",
    boxShadow: "0 2px 4px rgba(220, 38, 38, 0.4)",
  },
  popupDropdown: {
    position: "absolute",
    right: 0,
    top: 48,
    width: 315,
    maxHeight: 420,
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    boxShadow:
      "0 14px 30px -5px rgba(15, 23, 42, 0.16), 0 8px 12px -6px rgba(15, 23, 42, 0.08)",
    zIndex: 1000,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  popupHeader: {
    padding: "12px 14px",
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
    fontWeight: 800,
    fontSize: 13.5,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#0f172a",
  },
  popupBody: {
    overflowY: "auto",
    maxHeight: 365,
    padding: 10,
  },
  notifItem: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    border: "1px solid #e2e8f0",
    textAlign: "left",
  },
  markReadBtn: {
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    fontSize: 10,
    fontWeight: 700,
    padding: "4px 9px",
    borderRadius: 6,
    cursor: "pointer",
  },
  replyToggleBtn: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    fontSize: 10,
    fontWeight: 700,
    padding: "3px 20px",
    borderRadius: 6,
    cursor: "pointer",
  },
  replyInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "6px 8px",
    fontSize: 11.5,
    borderRadius: 5,
    border: "1px solid #cbd5e1",
    marginBottom: 6,
    outline: "none",
    background: "#ffffff",
    color: "#0f172a",
  },
  replySendBtn: {
    width: "100%",
    border: "none",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 800,
    padding: "6px 10px",
    borderRadius: 5,
    cursor: "pointer",
  },
  content: {
    width: "100%",
    minHeight: "calc(100vh - 60px)",
  },
};