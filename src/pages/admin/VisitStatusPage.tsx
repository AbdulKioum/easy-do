import { useEffect, useState } from "react";
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

export default function VisitStatusPage() {
  const { role } = useAuth();
  const isSuperAdmin = role === "super_admin";

  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  
  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [filterPage, setFilterPage] = useState("All");

  // Popup modal state for visit details
  const [selectedDetails, setSelectedDetails] = useState<{ userName: string; pageName: string; times: string[] } | null>(null);

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
          setVisits((prevVisits) => [newVisit, ...prevVisits]);
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
      const { data: visitData, error: visitError } = await supabase
        .from("page_visits")
        .select("*")
        .order("created_at", { ascending: false });

      if (visitError) throw visitError;
      setVisits(visitData || []);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*");

      if (!profileError && profileData) {
        const map: Record<string, UserProfile> = {};
        profileData.forEach((p: UserProfile) => {
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

  const dateFilteredVisits = visits.filter((item) => {
    const itemDate = item.visit_date || item.created_at.split("T")[0];
    return itemDate === selectedDate;
  });

  const summaryMap: Record<string, SummaryItem> = {};

  dateFilteredVisits.forEach((item) => {
    const userProfile = profiles[item.user_id];
    const userName = userProfile?.full_name || userProfile?.name || "Unknown User";
    const email = userProfile?.email || "No Email";

    const key = `${item.user_id}_${item.page_name}`;

    if (!summaryMap[key]) {
      summaryMap[key] = {
        user_id: item.user_id,
        userName: userName,
        email: email,
        page_name: item.page_name,
        total_visits: 0,
        last_visited_at: item.created_at,
        all_times: [],
      };
    }
    summaryMap[key].total_visits += 1;
    summaryMap[key].all_times.push(item.created_at);
  });

  const summaryList = Object.values(summaryMap);
  const filteredSummary = summaryList.filter(
    (item) => filterPage === "All" || item.page_name === filterPage
  );

  if (!isSuperAdmin) {
    return (
      <div style={styles.accessDenied}>
        <div style={styles.accessIcon}>🔒</div>
        <div style={styles.accessTitle}>Access Denied</div>
        <div style={styles.accessText}>Only Super Admin can access this page.</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>📊 Visit & Download Status</h1>
          <p style={styles.subtitle}>Real-time tracking of user visits and downloads</p>
        </div>
        <div style={styles.liveIndicator}>
          <span style={styles.liveDot} /> Live Realtime Active
        </div>
      </div>

      <div style={styles.dateBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Select Date:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={styles.dateInput}
          />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            style={styles.quickDateBtn}
            onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
          >
            Today
          </button>
          <button
            style={styles.quickDateBtn}
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() - 1);
              setSelectedDate(d.toISOString().split("T")[0]);
            }}
          >
            Yesterday
          </button>
        </div>
      </div>

      <div style={styles.filterBox}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Filter Page:</span>
        {[
          "All",
          "Pricelist Page",
          "Pricelist Download Excel",
          "Pricelist Download PDF",
          "EasyDO Page 1",
          "Transportation Page",
          "Transportation Download Excel",
          "Transportation Download PDF",
        ].map((page) => (
          <button
            key={page}
            style={{
              ...styles.filterBtn,
              ...(filterPage === page ? styles.filterBtnActive : {}),
            }}
            onClick={() => setFilterPage(page)}
          >
            {page}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={styles.loading}>Loading visit statistics...</div>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>User Name</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Page / Action Name</th>
                <th style={{ ...styles.th, textAlign: "center" }}>Total Count</th>
                <th style={styles.th}>Last Time</th>
                <th style={{ ...styles.th, textAlign: "center" }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredSummary.map((row, index) => {
                const formattedTime = new Date(row.last_visited_at).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: true,
                });

                return (
                  <tr key={index} style={{ background: index % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                    <td style={{ ...styles.td, fontWeight: 700, color: "#1e293b" }}>{row.userName}</td>
                    <td style={{ ...styles.td, color: "#64748b", fontSize: 12 }}>{row.email}</td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.badge,
                          background: row.page_name.includes("Download") ? "#dcfce7" : "#e0f2fe",
                          color: row.page_name.includes("Download") ? "#166534" : "#0369a1",
                        }}
                      >
                        {row.page_name}
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: "center", fontWeight: 700, fontSize: 14, color: "#2563eb" }}>
                      {row.total_visits} times
                    </td>
                    <td style={{ ...styles.td, fontWeight: 600, color: "#0f172a" }}>
                      🕒 {formattedTime}
                    </td>
                    <td style={{ ...styles.td, textAlign: "center" }}>
                      <button
                        style={styles.detailsBtn}
                        onClick={() =>
                          setSelectedDetails({
                            userName: row.userName,
                            pageName: row.page_name,
                            times: row.all_times,
                          })
                        }
                      >
                        👁️ View Times
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filteredSummary.length && (
            <div style={styles.noData}>No visit or download records found for this date.</div>
          )}
        </div>
      )}

      {/* DETAILS POPUP MODAL */}
      {selectedDetails && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Visit Timestamps</h3>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>
                  {selectedDetails.userName} — <b style={{ color: "#2563eb" }}>{selectedDetails.pageName}</b>
                </p>
              </div>
              <button style={styles.closeBtn} onClick={() => setSelectedDetails(null)}>✕</button>
            </div>

            <div style={styles.modalBody}>
              {selectedDetails.times.sort().map((t, i) => (
                <div key={i} style={styles.timeRow}>
                  <span>#{i + 1} Visit</span>
                  <b>
                    {new Date(t).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: true,
                    })}
                  </b>
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
  page: { padding: 16, color: "#111827", background: "#f8fafc", minHeight: "100vh", boxSizing: "border-box" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 },
  title: { margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" },
  subtitle: { margin: "3px 0 0", fontSize: 12, color: "#6b7280" },
  liveIndicator: { display: "flex", alignItems: "center", gap: 6, background: "#dcfce7", color: "#166534", padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 },
  liveDot: { width: 8, height: 8, background: "#22c55e", borderRadius: "50%", display: "inline-block", boxShadow: "0 0 0 2px #bbf7d0" },
  dateBar: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#ffffff", padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", marginBottom: 12, flexWrap: "wrap", gap: 10 },
  dateInput: { padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 600 },
  quickDateBtn: { background: "#f1f5f9", border: "1px solid #cbd5e1", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#334155" },
  filterBox: { display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  filterBtn: { border: "1px solid #d1d5db", background: "#ffffff", color: "#374151", padding: "6px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontWeight: 600 },
  filterBtnActive: { background: "#111827", color: "#ffffff", borderColor: "#111827" },
  tableWrapper: { width: "100%", overflowX: "auto", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,.05)" },
  table: { width: "100%", minWidth: 700, borderCollapse: "collapse", fontSize: 13 },
  th: { background: "#f3f4f6", color: "#374151", fontWeight: 700, padding: "11px 12px", borderBottom: "1px solid #d1d5db", textAlign: "left" },
  td: { padding: "11px 12px", borderBottom: "1px solid #eef0f2", whiteSpace: "nowrap" },
  badge: { padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 },
  detailsBtn: { background: "#eef2ff", color: "#3730a3", border: "1px solid #c7d2fe", padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" },
  noData: { padding: 35, textAlign: "center", color: "#6b7280" },
  loading: { padding: 40, textAlign: "center", color: "#374151" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal: { width: "100%", maxWidth: 400, background: "#ffffff", borderRadius: 12, padding: 16, boxShadow: "0 10px 25px rgba(0,0,0,0.1)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, borderBottom: "1px solid #e2e8f0", paddingBottom: 8 },
  closeBtn: { border: "none", background: "#f1f5f9", width: 28, height: 28, borderRadius: "50%", cursor: "pointer", fontWeight: 700 },
  modalBody: { maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 },
  timeRow: { display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "#f8fafc", borderRadius: 6, fontSize: 12, border: "1px solid #e2e8f0" },
  modalCloseFooter: { width: "100%", border: "none", background: "#111827", color: "#ffffff", padding: "10px", borderRadius: 8, fontWeight: 700, cursor: "pointer" },
  accessDenied: { minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 20 },
  accessIcon: { fontSize: 40, marginBottom: 10 },
  accessTitle: { fontSize: 20, fontWeight: 800, color: "#111827" },
  accessText: { marginTop: 5, fontSize: 12, color: "#6b7280" },
};