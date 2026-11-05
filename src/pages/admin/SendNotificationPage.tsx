import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

type ProfileUser = {
  id: string;
  name?: string;
  full_name?: string;
  username?: string;
  email?: string;
  phone?: string;
  role?: string;
  district?: string;
  upazila?: string;
  assigned_districts?: string[] | null;
  assigned_upazilas?: string[] | null;
};

type UpazilaRow = {
  id: number;
  district: string;
  upazila_name: string;
  status: string;
};

type SentNotification = {
  id: number;
  user_id: string | null;
  sender_id?: string | null;
  sender_name?: string | null;
  title: string;
  message: string;
  is_read: boolean;
  is_reply?: boolean;
  reply_to_id?: number | null;
  created_at: string;
};

const PAGE_CSS = `
  .snp-page { min-height: calc(100vh - 60px); background: #f1f5f9; padding: 14px 12px 90px; box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; color: #0f172a; }
  .snp-container { max-width: 780px; margin: 0 auto; }
  .snp-hero { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #3b82f6 100%); border-radius: 18px; padding: 18px; color: #fff; box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.35); margin-bottom: 14px; }
  .snp-title { margin: 0; font-size: 19px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
  .snp-subtitle { margin: 4px 0 0; font-size: 12px; color: #dbeafe; font-weight: 500; }
  .snp-tabs { display: grid; grid-template-columns: repeat(3, 1fr); background: rgba(15, 23, 42, 0.28); padding: 4px; border-radius: 12px; margin-top: 14px; gap: 4px; }
  .snp-tab-btn { border: none; padding: 10px 8px; border-radius: 9px; font-size: 11.5px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.2s ease; white-space: nowrap; }
  .snp-card { background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 16px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04); margin-bottom: 14px; }
  .snp-label { display: block; font-size: 12px; font-weight: 800; color: #334155; margin-bottom: 8px; text-align: left; }
  .snp-audience-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .snp-aud-card { border-radius: 12px; padding: 12px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: all 0.18s ease; text-align: left; }
  .snp-filter-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; margin-top: 14px; }
  .snp-filter-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  @media (max-width: 520px) {
    .snp-filter-grid { grid-template-columns: 1fr; }
  }
  .snp-select, .snp-input, .snp-textarea { width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 13px; background: #ffffff; color: #0f172a; outline: none; font-family: inherit; }
  .snp-user-list { max-height: 250px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; padding: 6px; margin-top: 8px; }
  .snp-user-item { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 10px; cursor: pointer; border-bottom: 1px solid #f1f5f9; text-align: left; }
  .snp-avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; flex-shrink: 0; }
  .snp-chip { display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 20px; font-size: 10px; font-weight: 700; background: #e0f2fe; color: #0369a1; margin-right: 4px; margin-top: 3px; }
  .snp-btn-primary { width: 100%; padding: 14px 18px; border: none; border-radius: 12px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; font-size: 14px; font-weight: 800; cursor: pointer; box-shadow: 0 6px 16px rgba(37, 99, 235, 0.32); display: flex; align-items: center; justify-content: center; gap: 8px; }
  .snp-reset-btn { border: 1px solid #fecaca; background: #fef2f2; color: #dc2626; border-radius: 8px; padding: 5px 10px; font-size: 11px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; }
  .snp-history-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; margin-bottom: 10px; text-align: left; box-shadow: 0 2px 6px rgba(15, 23, 42, 0.03); }
  .snp-action-btn { border: none; padding: 6px 11px; border-radius: 8px; font-size: 11.5px; font-weight: 750; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }
`;

export default function SendNotificationPage() {
  const { user, role } = useAuth();
  const [activeTab, setActiveTab] = useState<"send" | "history" | "replies">("send");
  const [sendType, setSendType] = useState<"all" | "specific">("all");

  const [users, setUsers] = useState<ProfileUser[]>([]);
  const [upazilaRows, setUpazilaRows] = useState<UpazilaRow[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [selectedUpazila, setSelectedUpazila] = useState<string>("");
  const [userSearch, setUserSearch] = useState<string>("");

  const [title, setTitle] = useState<string>("Admin Announcement");
  const [message, setMessage] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);

  const [allLogs, setAllLogs] = useState<SentNotification[]>([]);
  const [historySearch, setHistorySearch] = useState<string>("");
  const [editingNotif, setEditingNotif] = useState<SentNotification | null>(null);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  // SendNotificationPage.tsx er vitore real-time listener add kora
  useEffect(() => {
    loadInitialData();

    const channel = supabase
      .channel("admin:notifications:realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => {
          fetchLogs(); // Konota insert, update ba delete hole sathe sathe list refresh hobe
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadInitialData() {
    setLoadingData(true);
    try {
      const [profRes, upzRes, notifRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("upazilas").select("*").eq("status", "Active"),
        supabase.from("notifications").select("*").order("created_at", { ascending: false }),
      ]);

      if (!profRes.error && profRes.data) setUsers(profRes.data);
      if (!upzRes.error && upzRes.data) setUpazilaRows(upzRes.data);
      if (!notifRes.error && notifRes.data) setAllLogs(notifRes.data);
    } finally {
      setLoadingData(false);
    }
  }

  async function fetchLogs() {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setAllLogs(data);
  }

  function getUserDistricts(u: ProfileUser): string[] {
    const list: string[] = [];
    if (Array.isArray(u.assigned_districts)) list.push(...u.assigned_districts.filter(Boolean));
    if (u.district && !list.includes(u.district)) list.push(u.district);
    return list;
  }

  function getUserUpazilas(u: ProfileUser): string[] {
    const list: string[] = [];
    if (Array.isArray(u.assigned_upazilas)) list.push(...u.assigned_upazilas.filter(Boolean));
    if (u.upazila && !list.includes(u.upazila)) list.push(u.upazila);
    const userDists = getUserDistricts(u);
    if (userDists.length > 0 && upazilaRows.length > 0) {
      upazilaRows.forEach((row) => {
        if (userDists.includes(row.district) && !list.includes(row.upazila_name)) {
          list.push(row.upazila_name);
        }
      });
    }
    return list;
  }

  const districts = useMemo(() => {
    const set = new Set<string>();
    upazilaRows.forEach((r) => r.district && set.add(r.district));
    users.forEach((u) => getUserDistricts(u).forEach((d) => set.add(d)));
    return Array.from(set).sort();
  }, [upazilaRows, users]);

  const upazilas = useMemo(() => {
    const set = new Set<string>();
    upazilaRows.forEach((r) => {
      if (!selectedDistrict || r.district === selectedDistrict) {
        if (r.upazila_name) set.add(r.upazila_name);
      }
    });
    return Array.from(set).sort();
  }, [upazilaRows, selectedDistrict]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const uDists = getUserDistricts(u);
      const uUpzs = getUserUpazilas(u);

      if (selectedDistrict && !uDists.includes(selectedDistrict)) return false;

      if (selectedUpazila) {
        const upzObj = upazilaRows.find((r) => r.upazila_name === selectedUpazila);
        const matchesUpz = uUpzs.includes(selectedUpazila);
        const matchesDist = upzObj ? uDists.includes(upzObj.district) : false;
        if (!matchesUpz && !matchesDist) return false;
      }

      if (userSearch.trim()) {
        const q = userSearch.toLowerCase().trim();
        const nameStr = (u.name || u.full_name || u.username || u.email || "").toLowerCase();
        const phoneStr = (u.phone || "").toLowerCase();
        const distStr = uDists.join(" ").toLowerCase();
        if (!nameStr.includes(q) && !phoneStr.includes(q) && !distStr.includes(q)) return false;
      }

      return true;
    });
  }, [users, upazilaRows, selectedDistrict, selectedUpazila, userSearch]);

  function getUserDisplayName(u?: ProfileUser | null) {
    if (!u) return "Unknown User";
    return u.name || u.full_name || u.username || u.email?.split("@")[0] || "User";
  }

  const currentSenderLabel = useMemo(() => {
    const me = users.find((u) => u.id === user?.id);
    const myName = me ? getUserDisplayName(me) : user?.email?.split("@")[0] || "Admin";
    return myName.replace(/\s*\(.*?\)/g, "").trim();
  }, [users, user?.id]);

  function resetFilters() {
    setSelectedDistrict("");
    setSelectedUpazila("");
    setUserSearch("");
  }

  function toggleAllFiltered() {
    const filteredIds = filteredUsers.map((u) => u.id);
    const allSelected = filteredIds.every((id) => selectedUserIds.includes(id));
    if (allSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedUserIds(Array.from(new Set([...selectedUserIds, ...filteredIds])));
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return alert("Please enter a notification message.");
    if (!editingNotif && sendType === "specific" && selectedUserIds.length === 0) {
      return alert("Please select at least one recipient.");
    }

    setSending(true);
    try {
      if (editingNotif) {
        const { error } = await supabase
          .from("notifications")
          .update({
            title: title.trim() || "Admin Announcement",
            message: message.trim(),
          })
          .eq("id", editingNotif.id);
        if (error) throw error;
        alert("Notification updated!");
        setEditingNotif(null);
      } else {
        if (sendType === "all") {
          const { error } = await supabase.from("notifications").insert([
            {
              user_id: null,
              sender_id: user?.id || null,
              sender_name: currentSenderLabel,
              title: title.trim() || "Admin Announcement",
              message: message.trim(),
              is_read: false,
              is_reply: false,
            },
          ]);
          if (error) throw error;
        } else {
          const payloads = selectedUserIds.map((uid) => ({
            user_id: uid,
            sender_id: user?.id || null,
            sender_name: currentSenderLabel,
            title: title.trim() || "Admin Announcement",
            message: message.trim(),
            is_read: false,
            is_reply: false,
          }));
          const { error } = await supabase.from("notifications").insert(payloads);
          if (error) throw error;
        }
        alert("Notification sent successfully!");
      }

      setMessage("");
      setTitle("Admin Announcement");
      setSelectedUserIds([]);
      fetchLogs();
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this notification permanently?")) return;
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (!error) setAllLogs((prev) => prev.filter((n) => n.id !== id));
  }

  function handleEdit(n: SentNotification) {
    setEditingNotif(n);
    setTitle(n.title || "Admin Announcement");
    setMessage(n.message || "");
    setActiveTab("send");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const sentHistory = useMemo(() => allLogs.filter((n) => !n.is_reply), [allLogs]);

  // Unique user replies (deduplicated by sender_id + created_at + message so admin sees one clean card per reply)
  const userReplies = useMemo(() => {
    const rawReplies = allLogs.filter((n) => n.is_reply);
    const seen = new Set<string>();
    return rawReplies.filter((r) => {
      const key = `${r.sender_id}_${r.reply_to_id}_${r.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [allLogs]);

  const displayedHistory = useMemo(() => {
    if (!historySearch.trim()) return sentHistory;
    const q = historySearch.toLowerCase().trim();
    return sentHistory.filter((n) => {
      const targetUser = users.find((u) => u.id === n.user_id);
      const uName = getUserDisplayName(targetUser).toLowerCase();
      return (
        (n.title || "").toLowerCase().includes(q) ||
        (n.message || "").toLowerCase().includes(q) ||
        uName.includes(q)
      );
    });
  }, [sentHistory, historySearch, users]);

  if (role !== "super_admin" && role !== "admin") {
    return <div style={{ padding: 40, textAlign: "center", color: "#dc2626", fontWeight: 800 }}>⛔ Access Denied</div>;
  }

  return (
    <div className="snp-page">
      <style>{PAGE_CSS}</style>

      <div className="snp-container">
        <div className="snp-hero">
          <h1 className="snp-title">
            <span>📢</span> Notification Center
          </h1>
          <p className="snp-subtitle">
            Broadcast messages, manage sent logs, and view user replies
          </p>

          <div className="snp-tabs">
            <button
              type="button"
              onClick={() => setActiveTab("send")}
              className="snp-tab-btn"
              style={{
                background: activeTab === "send" ? "#ffffff" : "transparent",
                color: activeTab === "send" ? "#1d4ed8" : "#e2e8f0",
              }}
            >
              <span>{editingNotif ? "✏️" : "🚀"}</span>
              <span>{editingNotif ? "Edit" : "Compose"}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className="snp-tab-btn"
              style={{
                background: activeTab === "history" ? "#ffffff" : "transparent",
                color: activeTab === "history" ? "#1d4ed8" : "#e2e8f0",
              }}
            >
              <span>📋</span>
              <span>Sent ({sentHistory.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("replies")}
              className="snp-tab-btn"
              style={{
                background: activeTab === "replies" ? "#ffffff" : "transparent",
                color: activeTab === "replies" ? "#1d4ed8" : "#e2e8f0",
              }}
            >
              <span>💬</span>
              <span>Replies ({userReplies.length})</span>
            </button>
          </div>
        </div>

        {/* TAB 1: COMPOSE */}
        {activeTab === "send" && (
          <form onSubmit={handleSend}>
            {!editingNotif && (
              <div className="snp-card">
                <label className="snp-label">1. Choose Target Audience</label>
                <div className="snp-audience-grid">
                  <div
                    onClick={() => setSendType("all")}
                    className="snp-aud-card"
                    style={{
                      border: sendType === "all" ? "2px solid #2563eb" : "1px solid #cbd5e1",
                      background: sendType === "all" ? "#eff6ff" : "#f8fafc",
                    }}
                  >
                    <span style={{ fontSize: 20 }}>🌐</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>To All Users</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>Everyone gets alert</div>
                    </div>
                  </div>

                  <div
                    onClick={() => setSendType("specific")}
                    className="snp-aud-card"
                    style={{
                      border: sendType === "specific" ? "2px solid #2563eb" : "1px solid #cbd5e1",
                      background: sendType === "specific" ? "#eff6ff" : "#f8fafc",
                    }}
                  >
                    <span style={{ fontSize: 20 }}>🎯</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>Specific Users</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>Filter by Area / Name</div>
                    </div>
                  </div>
                </div>

                {sendType === "specific" && (
                  <div className="snp-filter-box">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 800 }}>🔍 Filter by Assigned District & Upazila</span>
                      {(selectedDistrict || selectedUpazila || userSearch) && (
                        <button type="button" onClick={resetFilters} className="snp-reset-btn">
                          🔄 Reset Filter
                        </button>
                      )}
                    </div>

                    <div className="snp-filter-grid">
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, display: "block", marginBottom: 4 }}>
                          District ({districts.length})
                        </label>
                        <select
                          value={selectedDistrict}
                          onChange={(e) => {
                            setSelectedDistrict(e.target.value);
                            setSelectedUpazila("");
                          }}
                          className="snp-select"
                        >
                          <option value="">All Districts</option>
                          {districts.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, display: "block", marginBottom: 4 }}>
                          Upazila ({upazilas.length})
                        </label>
                        <select
                          value={selectedUpazila}
                          onChange={(e) => setSelectedUpazila(e.target.value)}
                          className="snp-select"
                        >
                          <option value="">All Upazilas</option>
                          {upazilas.map((upz) => <option key={upz} value={upz}>{upz}</option>)}
                        </select>
                      </div>
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <input
                        type="text"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="🔎 Search user by name, phone, or district..."
                        className="snp-input"
                      />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 800 }}>
                        Selected: <span style={{ color: "#2563eb" }}>{selectedUserIds.length}</span> / {filteredUsers.length}
                      </span>
                      <button
                        type="button"
                        onClick={toggleAllFiltered}
                        style={{ background: "none", border: "none", color: "#2563eb", fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}
                      >
                        ✓ Select All Filtered
                      </button>
                    </div>

                    <div className="snp-user-list">
                      {loadingData ? (
                        <div style={{ padding: 20, textAlign: "center", fontSize: 12 }}>Loading users...</div>
                      ) : filteredUsers.map((u) => {
                        const isChecked = selectedUserIds.includes(u.id);
                        const displayName = getUserDisplayName(u);
                        const uDists = getUserDistricts(u);
                        return (
                          <label key={u.id} className="snp-user-item" style={{ background: isChecked ? "#eff6ff" : "transparent" }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedUserIds((prev) => [...prev, u.id]);
                                else setSelectedUserIds((prev) => prev.filter((id) => id !== u.id));
                              }}
                              style={{ width: 17, height: 17, accentColor: "#2563eb" }}
                            />
                            <div className="snp-avatar" style={{ background: isChecked ? "#2563eb" : "#e2e8f0", color: isChecked ? "#fff" : "#334155" }}>
                              {displayName.substring(0, 2).toUpperCase()}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 800 }}>{displayName}</div>
                              {u.phone && <div style={{ fontSize: 11, color: "#64748b" }}>📞 {u.phone}</div>}
                              <div>
                                {uDists.map((d) => <span key={d} className="snp-chip">📍 {d}</span>)}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="snp-card">
              <label className="snp-label">2. Notification Content (Sending From: {currentSenderLabel})</label>
              <div style={{ marginBottom: 12 }}>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Notice Title"
                  className="snp-input"
                />
              </div>
              <div>
                <textarea
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your announcement message here..."
                  className="snp-textarea"
                  required
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <button type="submit" disabled={sending} className="snp-btn-primary">
                  <span>🚀</span>
                  <span>{sending ? "Sending..." : editingNotif ? "Update Notification" : "Send Notification"}</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: SENT LOGS */}
        {activeTab === "history" && (
          <div>
            <div className="snp-card" style={{ padding: 12 }}>
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="🔎 Search sent notifications..."
                className="snp-input"
              />
            </div>

            {displayedHistory.map((n) => {
              const targetUser = users.find((u) => u.id === n.user_id);
              const isGlobal = n.user_id === null;
              return (
                <div key={n.id} className="snp-history-card">
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, background: isGlobal ? "#dbeafe" : "#fef3c7", color: isGlobal ? "#1e40af" : "#92400e", padding: "3px 9px", borderRadius: 20 }}>
                      {isGlobal ? "🌐 To All Users" : `🎯 To: ${getUserDisplayName(targetUser)}`}
                    </span>
                    <span style={{ fontSize: 10.5, color: "#64748b", fontWeight: 700 }}>
                      From: {n.sender_name || "Admin"} • {new Date(n.created_at).toLocaleString("en-BD", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 4 }}>{n.title}</div>
                  <div style={{ fontSize: 12.5, background: "#f8fafc", padding: 10, borderRadius: 8, whiteSpace: "pre-wrap" }}>{n.message}</div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                    <button type="button" onClick={() => handleEdit(n)} className="snp-action-btn" style={{ background: "#eff6ff", color: "#1d4ed8" }}>✏️ Edit</button>
                    <button type="button" onClick={() => handleDelete(n.id)} className="snp-action-btn" style={{ background: "#fef2f2", color: "#dc2626" }}>🗑️ Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: USER REPLIES */}
        {activeTab === "replies" && (
          <div>
            {userReplies.length === 0 ? (
              <div className="snp-card" style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
                💬 No user replies yet.
              </div>
            ) : (
              userReplies.map((r) => {
                const senderUser = users.find((u) => u.id === r.sender_id);
                const senderDists = senderUser ? getUserDistricts(senderUser) : [];
                return (
                  <div key={r.id} className="snp-history-card" style={{ borderLeft: "4px solid #f59e0b" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11.5, fontWeight: 800, background: "#fef3c7", color: "#92400e", padding: "3px 9px", borderRadius: 20 }}>
                          👤 From: {r.sender_name || getUserDisplayName(senderUser)}
                        </span>
                        {senderDists.map((d) => (
                          <span key={d} className="snp-chip" style={{ marginTop: 0 }}>📍 {d}</span>
                        ))}
                      </div>
                      <span style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 600 }}>
                        {new Date(r.created_at).toLocaleString("en-BD", { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 4 }}>
                      {r.title}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", background: "#fffbeb", padding: "10px 12px", borderRadius: 8, border: "1px solid #fde68a", whiteSpace: "pre-wrap" }}>
                      {r.message}
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                      <button type="button" onClick={() => handleDelete(r.id)} className="snp-action-btn" style={{ background: "#fef2f2", color: "#dc2626" }}>
                        🗑️ Delete Reply
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}