import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

type ProfileRow = {
  id: string;
  full_name?: string;
  name?: string;
  username?: string;
  email?: string;
  phone?: string;
  role?: string;
  district?: string;
  upazila?: string;
  assigned_districts?: string[] | string | null;
  assigned_upazilas?: string[] | string | null;
};

type NotificationRow = {
  id: number;
  user_id: string | null;
  sender_id?: string | null;
  sender_name?: string | null;
  title?: string | null;
  message: string;
  is_read: boolean;
  is_reply?: boolean;
  reply_to_id?: number | null;
  created_at: string;
};

const MINIMAL_NOTIF_CSS = `
  .snp-wrap {
    min-height: calc(100vh - 60px);
    background: #f8fafc;
    padding: 10px 10px 60px;
    box-sizing: border-box;
    font-family: system-ui, -apple-system, sans-serif;
    color: #1e293b;
  }
  .snp-box {
    max-width: 820px;
    margin: 0 auto;
  }

  /* Compact Top Header */
  .snp-topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 8px 12px;
    margin-bottom: 8px;
  }
  .snp-title {
    margin: 0;
    font-size: 15px;
    font-weight: 800;
    color: #0f172a;
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .snp-dot {
    width: 7px;
    height: 7px;
    background: #10b981;
    border-radius: 50%;
    box-shadow: 0 0 0 2px #d1fae5;
  }
  .snp-tabs {
    display: flex;
    gap: 4px;
    background: #f1f5f9;
    padding: 3px;
    border-radius: 8px;
  }
  .snp-tab {
    border: none;
    background: transparent;
    color: #64748b;
    font-size: 11.5px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 6px;
    cursor: pointer;
  }
  .snp-tab.active {
    background: #ffffff;
    color: #0f172a;
    box-shadow: 0 1px 2px rgba(0,0,0,0.06);
  }

  /* Compact Card */
  .snp-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 10px 12px;
    margin-bottom: 8px;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.02);
  }

  /* Target & Title Row */
  .snp-row-top {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
  }
  @media (max-width: 520px) {
    .snp-row-top {
      grid-template-columns: 1fr;
    }
  }

  .snp-seg {
    display: inline-flex;
    background: #f1f5f9;
    padding: 3px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }
  .snp-seg-btn {
    border: none;
    background: transparent;
    color: #475569;
    font-size: 11.5px;
    font-weight: 700;
    padding: 5px 10px;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
  }
  .snp-seg-btn.active {
    background: #ffffff;
    color: #2563eb;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  }

  .snp-input, .snp-select, .snp-textarea {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #cbd5e1;
    background: #f8fafc;
    border-radius: 7px;
    font-size: 12.5px;
    font-weight: 600;
    color: #0f172a;
    outline: none;
    font-family: inherit;
    transition: all 0.15s ease;
  }
  .snp-input, .snp-select {
    height: 32px;
    padding: 0 9px;
  }
  .snp-textarea {
    padding: 8px 9px;
    resize: vertical;
    min-height: 54px;
    line-height: 1.4;
  }
  .snp-input:focus, .snp-select:focus, .snp-textarea:focus {
    background: #ffffff;
    border-color: #3b82f6;
  }

  /* Compact Specific User Selector */
  .snp-specific-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 8px;
    margin-bottom: 8px;
  }
  .snp-filter-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1.2fr auto;
    gap: 6px;
    margin-bottom: 6px;
  }
  @media (max-width: 640px) {
    .snp-filter-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
  .snp-user-list {
    max-height: 125px;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(175px, 1fr));
    gap: 4px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 6px;
  }
  .snp-user-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    border-radius: 5px;
    font-size: 11.5px;
    cursor: pointer;
    border: 1px solid transparent;
    text-align: left;
  }
  .snp-user-item:hover {
    background: #f1f5f9;
  }
  .snp-user-item.selected {
    background: #eff6ff;
    border-color: #bfdbfe;
    color: #1e40af;
    font-weight: 700;
  }

  .snp-send-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }
  .snp-btn-primary {
    border: none;
    background: #2563eb;
    color: #ffffff;
    font-size: 12px;
    font-weight: 700;
    padding: 7px 14px;
    border-radius: 7px;
    cursor: pointer;
    white-space: nowrap;
  }
  .snp-btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .snp-btn-ghost {
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #475569;
    font-size: 11px;
    font-weight: 700;
    padding: 4px 8px;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
  }

  /* Logs & Replies List */
  .snp-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .snp-item {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 8px 10px;
    text-align: left;
  }
  .snp-item-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    margin-bottom: 3px;
  }
  .snp-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    background: #f1f5f9;
    color: #475569;
  }
  .snp-msg {
    font-size: 12.5px;
    color: #0f172a;
    line-height: 1.35;
    white-space: pre-wrap;
    margin: 3px 0 6px;
  }
  .snp-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10.5px;
    color: #64748b;
  }
  .snp-actions {
    display: flex;
    gap: 5px;
  }
  .snp-act-btn {
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    color: #334155;
    font-size: 10.5px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 5px;
    cursor: pointer;
  }
  .snp-act-del {
    color: #dc2626;
    border-color: #fecaca;
    background: #fef2f2;
  }
`;

function parseArrayField(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return val.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function getUserDisplayName(u?: ProfileRow | null): string {
  if (!u) return "User";
  const raw = u.full_name || u.name || u.username || u.email?.split("@")[0] || "User";
  return raw.replace(/\s*\(.*?\)/g, "").trim();
}

export default function SendNotificationPage() {
  const { user, role } = useAuth();
  const isAuthorized = role === "admin" || role === "super_admin";

  // Default Title is "Notice"
  const [title, setTitle] = useState("Notice");
  const [message, setMessage] = useState("");
  const [targetMode, setTargetMode] = useState<"all" | "specific">("all");
  const [sending, setSending] = useState(false);

  // Users & Location Filters
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [upazilaRows, setUpazilaRows] = useState<{ district: string; upazila: string }[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState("All");
  const [selectedUpazila, setSelectedUpazila] = useState("All");
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Logs & Replies
  const [logs, setLogs] = useState<NotificationRow[]>([]);
  const [activeTab, setActiveTab] = useState<"sent" | "replies">("sent");

  // Edit & Admin Reply state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [adminReplyText, setAdminReplyText] = useState("");

  useEffect(() => {
    if (!isAuthorized) return;
    loadInitialData();

    const channel = supabase
      .channel("admin:notifications:live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => {
          fetchLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthorized]);

  async function loadInitialData() {
    await Promise.all([fetchUsersAndLocations(), fetchLogs()]);
  }

  async function fetchUsersAndLocations() {
    const [profRes, upzRes] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("upazilas").select("district, upazila, name, district_name"),
    ]);

    if (!profRes.error && profRes.data) {
      setUsers(profRes.data as ProfileRow[]);
    }

    if (!upzRes.error && upzRes.data) {
      const mapped = upzRes.data
        .map((r: any) => ({
          district: r.district || r.district_name || "",
          upazila: r.upazila || r.name || "",
        }))
        .filter((r: any) => r.district || r.upazila);
      setUpazilaRows(mapped);
    }
  }

  async function fetchLogs() {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(150);

    if (!error && data) {
      setLogs(data as NotificationRow[]);
    }
  }

  const currentSenderLabel = useMemo(() => {
    const me = users.find((u) => u.id === user?.id);
    const myName = me ? getUserDisplayName(me) : user?.email?.split("@")[0] || "Admin";
    return myName.replace(/\s*\(.*?\)/g, "").trim();
  }, [users, user?.id]);

  const userMap = useMemo(() => {
    const map: Record<string, ProfileRow> = {};
    users.forEach((u) => {
      map[u.id] = u;
    });
    return map;
  }, [users]);

  const districts = useMemo(() => {
    const set = new Set<string>();
    upazilaRows.forEach((r) => r.district && set.add(r.district));
    users.forEach((u) => {
      if (u.district) set.add(u.district);
      parseArrayField(u.assigned_districts).forEach((d) => set.add(d));
    });
    return ["All", ...Array.from(set).sort()];
  }, [upazilaRows, users]);

  const upazilas = useMemo(() => {
    const set = new Set<string>();
    upazilaRows.forEach((r) => {
      if (selectedDistrict === "All" || r.district === selectedDistrict) {
        if (r.upazila) set.add(r.upazila);
      }
    });
    users.forEach((u) => {
      if (u.upazila) set.add(u.upazila);
      parseArrayField(u.assigned_upazilas).forEach((upz) => set.add(upz));
    });
    return ["All", ...Array.from(set).sort()];
  }, [upazilaRows, users, selectedDistrict]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (u.id === user?.id) return false;
      const uDistricts = [
        ...(u.district ? [u.district] : []),
        ...parseArrayField(u.assigned_districts),
      ].map((s) => s.toLowerCase());

      const uUpazilas = [
        ...(u.upazila ? [u.upazila] : []),
        ...parseArrayField(u.assigned_upazilas),
      ].map((s) => s.toLowerCase());

      const matchDist =
        selectedDistrict === "All" ||
        uDistricts.includes(selectedDistrict.toLowerCase());
      const matchUpz =
        selectedUpazila === "All" ||
        uUpazilas.includes(selectedUpazila.toLowerCase());

      const q = userSearch.toLowerCase().trim();
      const name = getUserDisplayName(u).toLowerCase();
      const email = (u.email || "").toLowerCase();
      const matchSearch = !q || name.includes(q) || email.includes(q);

      return matchDist && matchUpz && matchSearch;
    });
  }, [users, user?.id, selectedDistrict, selectedUpazila, userSearch]);

  function toggleUser(id: string) {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleSelectAllFiltered() {
    const filteredIds = filteredUsers.map((u) => u.id);
    const allSelected =
      filteredIds.length > 0 &&
      filteredIds.every((id) => selectedUserIds.includes(id));

    if (allSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  }

  async function handleSendNotification(e: React.FormEvent) {
    e.preventDefault();
    const cleanTitle = title.trim() || "Notice";
    const cleanMsg = message.trim();

    if (!cleanMsg) return alert("Write a message first.");
    if (targetMode === "specific" && selectedUserIds.length === 0) {
      return alert("Select at least one user.");
    }

    setSending(true);
    try {
      const payloads =
        targetMode === "all"
          ? [
              {
                user_id: null,
                sender_id: user?.id || null,
                sender_name: currentSenderLabel,
                title: cleanTitle,
                message: cleanMsg,
                is_read: false,
                is_reply: false,
              },
            ]
          : selectedUserIds.map((uid) => ({
              user_id: uid,
              sender_id: user?.id || null,
              sender_name: currentSenderLabel,
              title: cleanTitle,
              message: cleanMsg,
              is_read: false,
              is_reply: false,
            }));

      const { error } = await supabase.from("notifications").insert(payloads as any);
      if (error) throw error;

      setTitle("Notice");
      setMessage("");
      setSelectedUserIds([]);
      await fetchLogs();
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally {
      setSending(false);
    }
  }

  async function handleSaveEdit(id: number) {
    if (!editMessage.trim()) return;
    const { error } = await supabase
      .from("notifications")
      .update({
        title: editTitle.trim() || "Notice",
        message: editMessage.trim(),
      })
      .eq("id", id);

    if (!error) {
      setEditingId(null);
      fetchLogs();
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this notification?")) return;
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (!error) {
      setLogs((prev) => prev.filter((l) => l.id !== id));
    }
  }

  async function handleAdminReply(replyRow: NotificationRow) {
    const text = adminReplyText.trim();
    if (!text) return;
    const targetUserId = replyRow.sender_id || replyRow.user_id;
    if (!targetUserId) return alert("User ID not found.");

    const { error } = await supabase.from("notifications").insert([
      {
        user_id: targetUserId,
        sender_id: user?.id || null,
        sender_name: currentSenderLabel,
        title: `↩ Reply: ${(replyRow.title || "Notice").replace(/^↩ Reply:\s*/i, "")}`,
        message: text,
        is_read: false,
        is_reply: true,
        reply_to_id: replyRow.id,
      },
    ]);

    if (!error) {
      if (!replyRow.is_read) {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", replyRow.id);
      }
      setAdminReplyText("");
      setReplyingToId(null);
      fetchLogs();
    }
  }

  const sentLogs = useMemo(() => logs.filter((l) => !l.is_reply), [logs]);
  const replyLogs = useMemo(() => logs.filter((l) => l.is_reply), [logs]);

  if (!isAuthorized) {
    return (
      <div style={{ padding: 30, textAlign: "center", color: "#64748b", fontSize: 13 }}>
        Access Denied
      </div>
    );
  }

  return (
    <div className="snp-wrap">
      <style>{MINIMAL_NOTIF_CSS}</style>

      <div className="snp-box">
        {/* COMPACT TOP BAR */}
        <div className="snp-topbar">
          <h1 className="snp-title">
            <span className="snp-dot" />
            <span>Notifications</span>
          </h1>

          <div className="snp-tabs">
            <button
              type="button"
              className={`snp-tab ${activeTab === "sent" ? "active" : ""}`}
              onClick={() => setActiveTab("sent")}
            >
              Sent ({sentLogs.length})
            </button>
            <button
              type="button"
              className={`snp-tab ${activeTab === "replies" ? "active" : ""}`}
              onClick={() => setActiveTab("replies")}
            >
              Replies ({replyLogs.length})
            </button>
          </div>
        </div>

        {/* COMPACT COMPOSE CARD */}
        <form className="snp-card" onSubmit={handleSendNotification}>
          <div className="snp-row-top">
            {/* Small Audience Toggle */}
            <div className="snp-seg">
              <button
                type="button"
                className={`snp-seg-btn ${targetMode === "all" ? "active" : ""}`}
                onClick={() => setTargetMode("all")}
              >
                To All Users
              </button>
              <button
                type="button"
                className={`snp-seg-btn ${targetMode === "specific" ? "active" : ""}`}
                onClick={() => setTargetMode("specific")}
              >
                Specific ({selectedUserIds.length})
              </button>
            </div>

            {/* Default Notice Title Input */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Notice Title"
              className="snp-input"
            />
          </div>

          {/* Compact Specific User Picker */}
          {targetMode === "specific" && (
            <div className="snp-specific-box">
              <div className="snp-filter-grid">
                <select
                  value={selectedDistrict}
                  onChange={(e) => {
                    setSelectedDistrict(e.target.value);
                    setSelectedUpazila("All");
                  }}
                  className="snp-select"
                >
                  {districts.map((d) => (
                    <option key={d} value={d}>
                      {d === "All" ? "All Districts" : d}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedUpazila}
                  onChange={(e) => setSelectedUpazila(e.target.value)}
                  className="snp-select"
                >
                  {upazilas.map((u) => (
                    <option key={u} value={u}>
                      {u === "All" ? "All Upazilas" : u}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search user..."
                  className="snp-input"
                />

                <button
                  type="button"
                  onClick={toggleSelectAllFiltered}
                  className="snp-btn-ghost"
                >
                  Select All
                </button>
              </div>

              <div className="snp-user-list">
                {filteredUsers.map((u) => {
                  const checked = selectedUserIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className={`snp-user-item ${checked ? "selected" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleUser(u.id)}
                        style={{ margin: 0 }}
                      />
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {getUserDisplayName(u)}
                      </span>
                    </label>
                  );
                })}
                {!filteredUsers.length && (
                  <div style={{ fontSize: 11, color: "#94a3b8", padding: 4 }}>
                    No users found
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Message Input */}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write notification message..."
            className="snp-textarea"
          />

          <div className="snp-send-bar">
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
              From: <b style={{ color: "#0f172a" }}>{currentSenderLabel}</b>
            </span>

            <button type="submit" disabled={sending} className="snp-btn-primary">
              {sending ? "Sending..." : "Send Notice"}
            </button>
          </div>
        </form>

        {/* SENT / REPLIES LIST */}
        <div className="snp-list">
          {(activeTab === "sent" ? sentLogs : replyLogs).map((item) => {
            const isEditing = editingId === item.id;
            const isReplying = replyingToId === item.id;
            const recipientName = item.user_id
              ? getUserDisplayName(userMap[item.user_id])
              : "All Users";
            const cleanSender = (item.sender_name || "Admin")
              .replace(/\s*\(.*?\)/g, "")
              .trim();

            return (
              <div key={item.id} className="snp-item">
                <div className="snp-item-head">
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>
                      {item.title || "Notice"}
                    </span>
                    <span className="snp-badge">
                      {item.is_reply
                        ? `${cleanSender} → ${recipientName}`
                        : `To: ${recipientName}`}
                    </span>
                  </div>

                  <div className="snp-actions">
                    {activeTab === "replies" && (
                      <button
                        type="button"
                        className="snp-act-btn"
                        onClick={() => {
                          setReplyingToId(isReplying ? null : item.id);
                          setAdminReplyText("");
                        }}
                      >
                        {isReplying ? "Cancel" : "Reply"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="snp-act-btn"
                      onClick={() => {
                        if (isEditing) {
                          setEditingId(null);
                        } else {
                          setEditingId(item.id);
                          setEditTitle(item.title || "Notice");
                          setEditMessage(item.message);
                        }
                      }}
                    >
                      {isEditing ? "Cancel" : "Edit"}
                    </button>
                    <button
                      type="button"
                      className="snp-act-btn snp-act-del"
                      onClick={() => handleDelete(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="snp-input"
                    />
                    <textarea
                      value={editMessage}
                      onChange={(e) => setEditMessage(e.target.value)}
                      className="snp-textarea"
                    />
                    <div>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(item.id)}
                        className="snp-btn-primary"
                        style={{ padding: "5px 12px", fontSize: 11.5 }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="snp-msg">{item.message}</div>
                )}

                <div className="snp-meta">
                  <span>From: {cleanSender}</span>
                  <span>
                    {new Date(item.created_at).toLocaleString("en-BD", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Inline Admin Reply Box */}
                {isReplying && (
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <input
                      type="text"
                      value={adminReplyText}
                      onChange={(e) => setAdminReplyText(e.target.value)}
                      placeholder={`Reply to ${cleanSender}...`}
                      className="snp-input"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAdminReply(item);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleAdminReply(item)}
                      className="snp-btn-primary"
                    >
                      Send
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {!(activeTab === "sent" ? sentLogs : replyLogs).length && (
            <div
              className="snp-card"
              style={{ textAlign: "center", color: "#94a3b8", fontSize: 12, padding: 24 }}
            >
              No notifications found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}