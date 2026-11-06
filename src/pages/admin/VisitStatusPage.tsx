import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

type VisitRecord = {
  id: number;
  user_id: string;
  page_name: string;
  visit_date: string;
  created_at: string;
};

type UserProfile = {
  id: string;
  full_name?: string;
  name?: string;
  email?: string;
  role?: string;
};

type SummaryItem = {
  user_id: string;
  userName: string;
  email: string;
  page_name: string;
  total_visits: number;
  last_visited_at: string;
  all_times: string[];
};

const COMPACT_CSS = `
  .vsp-wrap {
    min-height: calc(100vh - 60px);
    background: #f8fafc;
    padding: 10px 10px 60px;
    box-sizing: border-box;
    font-family: system-ui, -apple-system, sans-serif;
    color: #1e293b;
  }
  .vsp-box {
    max-width: 920px;
    margin: 0 auto;
  }

  /* Compact Top Bar: Title + Mini Stat Pills */
  .vsp-topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
    background: #ffffff;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
  }
  .vsp-title-area {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .vsp-title {
    margin: 0;
    font-size: 15px;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.2px;
  }
  .vsp-live-dot {
    width: 7px;
    height: 7px;
    background: #10b981;
    border-radius: 50%;
    display: inline-block;
    box-shadow: 0 0 0 2px #d1fae5;
  }

  /* Mini Stat Pills */
  .vsp-pills {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .vsp-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    color: #475569;
  }
  .vsp-pill b {
    color: #0f172a;
    font-size: 11.5px;
    font-weight: 800;
  }
  .vsp-pill-apk {
    background: #eff6ff;
    border-color: #bfdbfe;
    color: #1d4ed8;
    cursor: pointer;
  }
  .vsp-pill-apk b {
    color: #1e40af;
  }

  /* Compact Filter Toolbar */
  .vsp-toolbar {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 8px;
    margin-bottom: 8px;
    display: grid;
    grid-template-columns: auto 1fr 1fr;
    gap: 6px;
    align-items: center;
  }
  @media (max-width: 640px) {
    .vsp-toolbar {
      grid-template-columns: 1fr 1fr;
    }
    .vsp-date-group {
      grid-column: 1 / -1;
    }
  }

  .vsp-date-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .vsp-input, .vsp-select {
    width: 100%;
    box-sizing: border-box;
    height: 32px;
    padding: 0 8px;
    border-radius: 7px;
    border: 1px solid #cbd5e1;
    background: #f8fafc;
    font-size: 12px;
    font-weight: 600;
    color: #1e293b;
    outline: none;
  }
  .vsp-input:focus, .vsp-select:focus {
    background: #ffffff;
    border-color: #3b82f6;
  }

  .vsp-day-btn {
    height: 32px;
    padding: 0 8px;
    border-radius: 7px;
    border: 1px solid #cbd5e1;
    background: #f8fafc;
    color: #475569;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
  }
  .vsp-day-btn.active {
    background: #eff6ff;
    border-color: #93c5fd;
    color: #1d4ed8;
  }

  .vsp-search-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }
  .vsp-search-icon {
    position: absolute;
    left: 8px;
    color: #94a3b8;
    pointer-events: none;
    display: flex;
    align-items: center;
  }
  .vsp-search-input {
    padding-left: 26px !important;
    padding-right: 22px !important;
  }
  .vsp-clear-btn {
    position: absolute;
    right: 6px;
    border: none;
    background: transparent;
    color: #94a3b8;
    font-size: 11px;
    cursor: pointer;
    padding: 2px;
  }

  /* Table Card */
  .vsp-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
  }
  .vsp-scroll {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .vsp-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 12.5px;
  }
  .vsp-th {
    background: #f8fafc;
    color: #64748b;
    font-weight: 700;
    font-size: 11px;
    padding: 9px 10px;
    border-bottom: 1px solid #e2e8f0;
    white-space: nowrap;
  }
  .vsp-td {
    padding: 8px 10px;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
  }
  .vsp-tr:last-child .vsp-td {
    border-bottom: none;
  }
  .vsp-tr:hover {
    background: #f8fafc;
  }

  .vsp-user-name {
    font-weight: 700;
    color: #0f172a;
    font-size: 12.5px;
    line-height: 1.2;
  }
  .vsp-user-email {
    font-size: 10.5px;
    color: #64748b;
    margin-top: 2px;
    line-height: 1.1;
  }

  .vsp-tag {
    display: inline-block;
    padding: 3px 7px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
  }
  .vsp-count {
    display: inline-block;
    background: #f1f5f9;
    color: #0f172a;
    font-weight: 700;
    font-size: 11.5px;
    padding: 2px 7px;
    border-radius: 5px;
  }
  .vsp-time-btn {
    border: 1px solid #e2e8f0;
    background: #ffffff;
    color: #3b82f6;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
  }
  .vsp-time-btn:hover {
    background: #eff6ff;
    border-color: #bfdbfe;
  }
`;

const DEFAULT_PAGES = [
  "All",
  "App Download APK",
  "EasyDO Page 1",
  "Pricelist Page",
  "Pricelist Download Excel",
  "Pricelist Download PDF",
  "Transportation Page",
  "Transportation Download Excel",
  "Transportation Download PDF",
];

export default function VisitStatusPage() {
  const { role } = useAuth();
  const isSuperAdmin = role === "super_admin";

  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});

  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [filterPage, setFilterPage] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedDetails, setSelectedDetails] = useState<{
    userName: string;
    pageName: string;
    times: string[];
  } | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }

    loadData();

    const channel = supabase
      .channel("public:page_visits")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "page_visits",
        },
        (payload) => {
          const newVisit = payload.new as VisitRecord;
          setVisits((prev) => [newVisit, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isSuperAdmin]);

  async function loadData() {
    setLoading(true);
    try {
      const [visitRes, profileRes] = await Promise.all([
        supabase.from("page_visits").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("*"),
      ]);

      if (!visitRes.error && visitRes.data) {
        setVisits(visitRes.data);
      }

      if (!profileRes.error && profileRes.data) {
        const map: Record<string, UserProfile> = {};
        profileRes.data.forEach((p: UserProfile) => {
          map[p.id] = p;
        });
        setProfiles(map);
      }
    } catch (err: any) {
      console.error("Error loading visit status:", err.message);
    } finally {
      setLoading(false);
    }
  }

  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }, []);

  const dateFilteredVisits = useMemo(() => {
    return visits.filter((item) => {
      const itemDate = item.visit_date || item.created_at.split("T")[0];
      return itemDate === selectedDate;
    });
  }, [visits, selectedDate]);

  const pageOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_PAGES);
    visits.forEach((v) => {
      if (v.page_name) set.add(v.page_name);
    });
    return Array.from(set);
  }, [visits]);

  const summaryList = useMemo(() => {
    const summaryMap: Record<string, SummaryItem> = {};

    dateFilteredVisits.forEach((item) => {
      const userProfile = profiles[item.user_id];
      const userName = userProfile?.full_name || userProfile?.name || "Unknown User";
      const email = userProfile?.email || "";

      const key = `${item.user_id}_${item.page_name}`;

      if (!summaryMap[key]) {
        summaryMap[key] = {
          user_id: item.user_id,
          userName,
          email,
          page_name: item.page_name,
          total_visits: 0,
          last_visited_at: item.created_at,
          all_times: [],
        };
      }
      summaryMap[key].total_visits += 1;
      summaryMap[key].all_times.push(item.created_at);

      if (new Date(item.created_at) > new Date(summaryMap[key].last_visited_at)) {
        summaryMap[key].last_visited_at = item.created_at;
      }
    });

    return Object.values(summaryMap);
  }, [dateFilteredVisits, profiles]);

  const filteredSummary = useMemo(() => {
    return summaryList.filter((item) => {
      const matchesPage = filterPage === "All" || item.page_name === filterPage;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.userName.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.page_name.toLowerCase().includes(q);
      return matchesPage && matchesSearch;
    });
  }, [summaryList, filterPage, searchQuery]);

  const stats = useMemo(() => {
    const uniqueUsers = new Set(dateFilteredVisits.map((v) => v.user_id)).size;
    const totalActions = dateFilteredVisits.length;
    const appDownloads = dateFilteredVisits.filter((v) =>
      v.page_name.toLowerCase().includes("app download")
    ).length;
    const fileDownloads = dateFilteredVisits.filter(
      (v) =>
        v.page_name.toLowerCase().includes("download") &&
        !v.page_name.toLowerCase().includes("app download")
    ).length;

    return { uniqueUsers, totalActions, appDownloads, fileDownloads };
  }, [dateFilteredVisits]);

  function getTagStyle(pageName: string) {
    const lower = pageName.toLowerCase();
    if (lower.includes("app download")) {
      return { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" };
    }
    if (lower.includes("download")) {
      return { background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0" };
    }
    return { background: "#f1f5f9", color: "#334155", border: "1px solid #e2e8f0" };
  }

  if (!isSuperAdmin) {
    return (
      <div style={styles.accessDenied}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Access Denied</div>
        <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>
          Only Super Admin can access this page.
        </div>
      </div>
    );
  }

  return (
    <div className="vsp-wrap">
      <style>{COMPACT_CSS}</style>

      <div className="vsp-box">
        {/* COMPACT TOP BAR: TITLE + SMALL PILLS */}
        <div className="vsp-topbar">
          <div className="vsp-title-area">
            <span className="vsp-live-dot" title="Live Realtime Active" />
            <h1 className="vsp-title">Visit Status</h1>
          </div>

          <div className="vsp-pills">
            <span className="vsp-pill">
              Users: <b>{stats.uniqueUsers}</b>
            </span>
            <span className="vsp-pill">
              Visits: <b>{stats.totalActions}</b>
            </span>
            <span className="vsp-pill">
              Files: <b>{stats.fileDownloads}</b>
            </span>
            <span
              className="vsp-pill vsp-pill-apk"
              onClick={() =>
                setFilterPage(filterPage === "App Download APK" ? "All" : "App Download APK")
              }
              title="Filter APK Downloads"
            >
              APK: <b>{stats.appDownloads}</b>
            </span>
          </div>
        </div>

        {/* COMPACT TOOLBAR: DATE + DROPDOWN + ICON SEARCH */}
        <div className="vsp-toolbar">
          <div className="vsp-date-group">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="vsp-input"
              style={{ width: 125 }}
            />
            <button
              type="button"
              className={`vsp-day-btn ${selectedDate === todayStr ? "active" : ""}`}
              onClick={() => setSelectedDate(todayStr)}
            >
              Today
            </button>
            <button
              type="button"
              className={`vsp-day-btn ${selectedDate === yesterdayStr ? "active" : ""}`}
              onClick={() => setSelectedDate(yesterdayStr)}
            >
              Yest
            </button>
          </div>

          {/* PAGE FILTER DROPDOWN */}
          <div>
            <select
              value={filterPage}
              onChange={(e) => setFilterPage(e.target.value)}
              className="vsp-select"
            >
              {pageOptions.map((page) => (
                <option key={page} value={page}>
                  {page === "All" ? "All Pages & Actions" : page}
                </option>
              ))}
            </select>
          </div>

          {/* SEARCH INPUT WITH ICON ONLY */}
          <div className="vsp-search-wrap">
            <span className="vsp-search-icon">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user..."
              className="vsp-input vsp-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="vsp-clear-btn"
                onClick={() => setSearchQuery("")}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* MAIN TRACKING TABLE */}
        {loading ? (
          <div
            className="vsp-card"
            style={{ padding: 30, textAlign: "center", color: "#64748b", fontSize: 12.5 }}
          >
            Loading records...
          </div>
        ) : (
          <div className="vsp-card">
            <div className="vsp-scroll">
              <table className="vsp-table">
                <thead>
                  <tr>
                    <th className="vsp-th">User</th>
                    <th className="vsp-th">Page / Action</th>
                    <th className="vsp-th" style={{ textAlign: "center" }}>
                      Count
                    </th>
                    <th className="vsp-th">Last Time</th>
                    <th className="vsp-th" style={{ textAlign: "right" }}>
                      History
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummary.map((row, index) => {
                    const formattedTime = new Date(row.last_visited_at).toLocaleTimeString(
                      "en-US",
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      }
                    );
                    const tagStyle = getTagStyle(row.page_name);

                    return (
                      <tr
                        key={`${row.user_id}_${row.page_name}_${index}`}
                        className="vsp-tr"
                      >
                        {/* USER NAME + SMALL EMAIL UNDERNEATH */}
                        <td className="vsp-td">
                          <div className="vsp-user-name">{row.userName}</div>
                          {row.email && <div className="vsp-user-email">{row.email}</div>}
                        </td>

                        {/* PAGE / ACTION */}
                        <td className="vsp-td">
                          <span className="vsp-tag" style={tagStyle}>
                            {row.page_name}
                          </span>
                        </td>

                        {/* COUNT */}
                        <td className="vsp-td" style={{ textAlign: "center" }}>
                          <span className="vsp-count">{row.total_visits}</span>
                        </td>

                        {/* LAST TIME */}
                        <td
                          className="vsp-td"
                          style={{
                            whiteSpace: "nowrap",
                            color: "#475569",
                            fontWeight: 600,
                            fontSize: 11.5,
                          }}
                        >
                          {formattedTime}
                        </td>

                        {/* VIEW TIMES BUTTON */}
                        <td className="vsp-td" style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="vsp-time-btn"
                            onClick={() =>
                              setSelectedDetails({
                                userName: row.userName,
                                pageName: row.page_name,
                                times: row.all_times,
                              })
                            }
                          >
                            Times
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!filteredSummary.length && (
              <div
                style={{
                  padding: 28,
                  textAlign: "center",
                  color: "#94a3b8",
                  fontSize: 12.5,
                }}
              >
                No activity found for this date.
              </div>
            )}
          </div>
        )}
      </div>

      {/* TIMESTAMPS POPUP MODAL */}
      {selectedDetails && (
        <div style={styles.overlay} onClick={() => setSelectedDetails(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                  {selectedDetails.userName}
                </div>
                <div style={{ fontSize: 11.5, color: "#3b82f6", fontWeight: 600, marginTop: 2 }}>
                  {selectedDetails.pageName} ({selectedDetails.times.length})
                </div>
              </div>
              <button style={styles.closeBtn} onClick={() => setSelectedDetails(null)}>
                ✕
              </button>
            </div>

            <div style={styles.modalBody}>
              {[...selectedDetails.times]
                .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
                .map((t, i) => (
                  <div key={i} style={styles.timeRow}>
                    <span style={{ color: "#64748b", fontWeight: 600 }}>
                      #{selectedDetails.times.length - i}
                    </span>
                    <span style={{ color: "#0f172a", fontWeight: 700 }}>
                      {new Date(t).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: true,
                      })}
                    </span>
                  </div>
                ))}
            </div>

            <button style={styles.modalCloseFooter} onClick={() => setSelectedDetails(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 14,
  },
  modal: {
    width: "100%",
    maxWidth: 340,
    background: "#ffffff",
    borderRadius: 12,
    padding: 14,
    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.15)",
    textAlign: "left",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    borderBottom: "1px solid #f1f5f9",
    paddingBottom: 8,
  },
  closeBtn: {
    border: "none",
    background: "#f1f5f9",
    color: "#475569",
    width: 26,
    height: 26,
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
  },
  modalBody: {
    maxHeight: 220,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 5,
    marginBottom: 12,
  },
  timeRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "6px 10px",
    background: "#f8fafc",
    borderRadius: 6,
    fontSize: 12,
    border: "1px solid #e2e8f0",
  },
  modalCloseFooter: {
    width: "100%",
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#1e293b",
    padding: "8px",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  },
  accessDenied: {
    minHeight: "50vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 20,
  },
};