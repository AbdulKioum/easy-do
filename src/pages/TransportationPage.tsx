import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

type Transportation = {
  id?: number;
  from_location: string;
  to_upazila: string;
  floating_cattle_rate_per_kg: number;
  sinking_broiler_layer_sonali_rate_per_kg: number;
  status: string;
};

type Upazila = {
  id: number;
  district: string;
  upazila_name: string;
  status: string;
};


const emptyForm: Transportation = {
  from_location: "",
  to_upazila: "",
  floating_cattle_rate_per_kg: 0,
  sinking_broiler_layer_sonali_rate_per_kg: 0,
  status: "Active",
};

export default function TransportationPage() {
  const { user, role } = useAuth();
  const [items, setItems] = useState<Transportation[]>([]);
  const [upazilas, setUpazilas] = useState<Upazila[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [upazilaLoading, setUpazilaLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [fromFilter, setFromFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Transportation>(emptyForm);

 

  const canManage = role === "admin" || role === "super_admin";
  const isSuperAdmin = role === "super_admin";

  useEffect(() => {
    if (user?.id) {
      loadUserProfile();
    }
    loadTransportation();
    loadUpazilas();
  }, [user?.id]);

  async function loadUserProfile() {
    const { data } = await supabase.from("profiles").select("*").eq("id", user?.id).single();
    if (data) {
      setUserProfile(data);
      if (data.assigned_from_locations && data.assigned_from_locations.length > 0 && !emptyForm.from_location) {
        setForm(prev => ({ ...prev, from_location: data.assigned_from_locations[0] }));
      }
    }
  }

  const assignedFromLocations: string[] = useMemo(() => {
    if (isSuperAdmin) return ["Valuka Feed Mill", "Mymensingh Depot"];
    return userProfile?.assigned_from_locations || [];
  }, [isSuperAdmin, userProfile]);

  const assignedDistricts: string[] = useMemo(() => {
    if (isSuperAdmin) return [];
    return userProfile?.assigned_districts || [];
  }, [isSuperAdmin, userProfile]);

  async function loadTransportation() {
    setLoading(true);
    const { data, error } = await supabase
      .from("transportation")
      .select("*")
      .order("from_location", { ascending: true })
      .order("to_upazila", { ascending: true });

    if (error) {
      console.error(error);
      alert("Transportation load failed.");
    } else {
      setItems((data || []) as Transportation[]);
    }
    setLoading(false);
  }

  async function loadUpazilas() {
    setUpazilaLoading(true);
    const { data, error } = await supabase
      .from("upazilas")
      .select("*")
      .eq("status", "Active")
      .order("district", { ascending: true })
      .order("upazila_name", { ascending: true });

    if (error) {
      console.error(error);
      alert("Upazila load failed.");
    } else {
      setUpazilas((data || []) as Upazila[] );
    }
    setUpazilaLoading(false);
  }

  // Filter upazilas based on user's assigned districts
  const filteredUpazilaList = useMemo(() => {
    if (isSuperAdmin || !assignedDistricts.length) return upazilas;
    return upazilas.filter(u => assignedDistricts.includes(u.district));
  }, [upazilas, assignedDistricts, isSuperAdmin]);

  // Allowed transportation items based on user assignments
  const visibleItems = useMemo(() => {
    return items.filter(item => {
      const matchFrom = isSuperAdmin || assignedFromLocations.includes(item.from_location);
      
      // Check district match
      let matchDistrict = true;
      if (!isSuperAdmin && assignedDistricts.length > 0) {
        const upazilaObj = upazilas.find(u => u.upazila_name === item.to_upazila);
        matchDistrict = upazilaObj ? assignedDistricts.includes(upazilaObj.district) : false;
      }
      return matchFrom && matchDistrict;
    });
  }, [items, isSuperAdmin, assignedFromLocations, assignedDistricts, upazilas]);

  function openAdd() {
    if (!canManage) return;
    setEditingId(null);
    setForm({
      ...emptyForm,
      from_location: assignedFromLocations[0] || "Valuka Feed Mill",
      to_upazila: "",
    });
    setShowForm(true);
  }

  function openEdit(item: Transportation) {
    if (!canManage) return;
    setEditingId(item.id || null);
    setForm({
      from_location: item.from_location,
      to_upazila: item.to_upazila,
      floating_cattle_rate_per_kg: Number(item.floating_cattle_rate_per_kg || 0),
      sinking_broiler_layer_sonali_rate_per_kg: Number(item.sinking_broiler_layer_sonali_rate_per_kg || 0),
      status: item.status,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm, from_location: assignedFromLocations[0] || "Valuka Feed Mill" });
  }

  async function saveTransportation() {
    if (!canManage) return;
    if (!form.to_upazila.trim()) {
      alert("Please select an Upazila.");
      return;
    }

    const payload = {
      from_location: form.from_location,
      to_upazila: form.to_upazila,
      floating_cattle_rate_per_kg: Number(form.floating_cattle_rate_per_kg),
      sinking_broiler_layer_sonali_rate_per_kg: Number(form.sinking_broiler_layer_sonali_rate_per_kg),
      status: form.status,
    };

    if (editingId) {
      const { error } = await supabase.from("transportation").update(payload).eq("id", editingId);
      if (error) { alert("Transportation update failed."); return; }
    } else {
      const { error } = await supabase.from("transportation").insert([payload]);
      if (error) { alert("Transportation add failed."); return; }
    }

    closeForm();
    await loadTransportation();
  }

  async function deleteTransportation(id?: number) {
    if (!canManage || !id) return;
    if (!window.confirm("Delete this transportation rate?")) return;

    const { error } = await supabase.from("transportation").delete().eq("id", id);
    if (error) { alert("Delete failed."); return; }
    await loadTransportation();
  }

  function exportExcel() {
    if (!filteredItems.length) {
      alert("No transportation data available to export.");
      return;
    }
    const exportData = filteredItems.map((item) => ({
      From: item.from_location,
      Upazila: item.to_upazila,
      "Floating & Cattle (৳/KG)": Number(item.floating_cattle_rate_per_kg),
      "Sinking & Broiler & Layer & Sonali (৳/KG)": Number(item.sinking_broiler_layer_sonali_rate_per_kg),
      Status: item.status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transportation");
    XLSX.writeFile(workbook, "Transportation_Rates.xlsx");
  }

  const filteredItems = useMemo(() => {
    const searchText = search.toLowerCase();
    return visibleItems.filter((item) => {
      const matchesFrom = fromFilter === "All" || item.from_location === fromFilter;
      const matchesSearch = item.from_location.toLowerCase().includes(searchText) || item.to_upazila.toLowerCase().includes(searchText);
      return matchesFrom && matchesSearch;
    });
  }, [visibleItems, search, fromFilter]);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Transportation</h1>
          <p style={styles.subtitle}>Transport rate management based on assignments</p>
        </div>
        <div style={styles.headerButtons}>
          <button style={styles.exportButton} onClick={exportExcel}>📤 Download Transportation List</button>
          {canManage && (
            <button style={styles.addButton} onClick={openAdd}>+ Add</button>
          )}
        </div>
      </div>

      <div style={styles.searchBox}>
        <span>🔍</span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search upazila..." style={styles.searchInput} />
      </div>

      <div style={styles.filterRow}>
        <button style={{ ...styles.filterButton, ...(fromFilter === "All" ? styles.filterButtonActive : {}) }} onClick={() => setFromFilter("All")}>All Assigned</button>
        {assignedFromLocations.map((option) => (
          <button key={option} style={{ ...styles.filterButton, ...(fromFilter === option ? styles.filterButtonActive : {}) }} onClick={() => setFromFilter(option)}>{option}</button>
        ))}
      </div>

      {loading ? (
        <div style={styles.loading}>Loading...</div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>From</th>
                <th style={styles.th}>To / Upazila</th>
                <th style={styles.thRight}>Floating & Cattle<br /><small>৳/KG</small></th>
                <th style={styles.thRight}>Sinking / Broiler / Layer / Sonali<br /><small>৳/KG</small></th>
                <th style={styles.th}>Status</th>
                {canManage && <th style={styles.thCenter}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id}>
                  <td style={styles.td}><span style={styles.fromBadge}>{item.from_location}</span></td>
                  <td style={{ ...styles.td, fontWeight: 600 }}>{item.to_upazila}</td>
                  <td style={styles.tdRight}>৳ {Number(item.floating_cattle_rate_per_kg).toFixed(2)}</td>
                  <td style={styles.tdRight}>৳ {Number(item.sinking_broiler_layer_sonali_rate_per_kg).toFixed(2)}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.status, ...(item.status === "Active" ? styles.activeStatus : styles.inactiveStatus) }}>{item.status}</span>
                  </td>
                  {canManage && (
                    <td style={styles.tdCenter}>
                      <div style={styles.actionGroup}>
                        <button style={styles.editButton} onClick={() => openEdit(item)} title="Edit">✏️</button>
                        <button style={styles.deleteButton} onClick={() => deleteTransportation(item.id)} title="Delete">🗑️</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredItems.length && <div style={styles.noData}>No transportation data found for your assignments.</div>}
        </div>
      )}

      {showForm && canManage && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{editingId ? "Edit Transportation" : "Add Transportation"}</h2>
              <button style={styles.closeButton} onClick={closeForm}>×</button>
            </div>

            <label style={styles.label}>From (Assigned Mills/Depots)</label>
            <select value={form.from_location} onChange={(e) => setForm({ ...form, from_location: e.target.value })} style={styles.input}>
              {assignedFromLocations.map((option) => (<option key={option} value={option}>{option}</option>))}
            </select>

            <label style={styles.label}>To / Upazila (Assigned Districts)</label>
            {upazilaLoading ? (
              <div style={styles.loadingSmall}>Loading Upazila...</div>
            ) : (
              <select value={form.to_upazila} onChange={(e) => setForm({ ...form, to_upazila: e.target.value })} style={styles.input}>
                <option value="">Select Upazila</option>
                {filteredUpazilaList.map((upazila) => (
                  <option key={upazila.id} value={upazila.upazila_name}>{upazila.upazila_name} — {upazila.district}</option>
                ))}
              </select>
            )}

            <label style={styles.label}>Floating & Cattle — ৳/KG</label>
            <input type="number" min="0" step="0.01" value={form.floating_cattle_rate_per_kg} onChange={(e) => setForm({ ...form, floating_cattle_rate_per_kg: Number(e.target.value) })} style={styles.input} />

            <label style={styles.label}>Sinking & Broiler & Layer & Sonali — ৳/KG</label>
            <input type="number" min="0" step="0.01" value={form.sinking_broiler_layer_sonali_rate_per_kg} onChange={(e) => setForm({ ...form, sinking_broiler_layer_sonali_rate_per_kg: Number(e.target.value) })} style={styles.input} />

            <label style={styles.label}>Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={styles.input}>
              <option>Active</option>
              <option>Inactive</option>
            </select>

            <button style={styles.saveButton} onClick={saveTransportation}>
              {editingId ? "Update Transportation" : "Save Transportation"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f3f4f6", padding: 14, color: "#111827", boxSizing: "border-box" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" },
  title: { margin: 0, fontSize: 23, fontWeight: 800, color: "#111827" },
  subtitle: { margin: "3px 0 0", fontSize: 12, color: "#6b7280" },
  headerButtons: { display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" },
  exportButton: { border: "1px solid #d1d5db", background: "#ffffff", color: "#111827", padding: "9px 10px", borderRadius: 9, fontWeight: 600, cursor: "pointer" },
  addButton: { border: "none", background: "#111827", color: "#ffffff", padding: "9px 11px", borderRadius: 9, fontWeight: 600, cursor: "pointer" },
  searchBox: { display: "flex", alignItems: "center", gap: 8, background: "#ffffff", border: "1px solid #e5e7eb", padding: "11px 13px", borderRadius: 10, marginBottom: 10 },
  searchInput: { border: "none", outline: "none", background: "#ffffff", color: "#111827", width: "100%", fontSize: 14 },
  filterRow: { display: "flex", gap: 7, overflowX: "auto", paddingBottom: 10 },
  filterButton: { flexShrink: 0, border: "1px solid #d1d5db", background: "#ffffff", color: "#374151", padding: "7px 13px", borderRadius: 20, fontSize: 12, cursor: "pointer" },
  filterButtonActive: { background: "#111827", color: "#ffffff", borderColor: "#111827" },
  tableContainer: { width: "100%", overflowX: "auto", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
  table: { width: "100%", minWidth: 850, borderCollapse: "collapse", color: "#111827", fontSize: 13 },
  th: { background: "#f3f4f6", color: "#374151", fontWeight: 700, padding: "11px 10px", borderBottom: "1px solid #d1d5db", textAlign: "left", whiteSpace: "nowrap" },
  thRight: { background: "#f3f4f6", color: "#374151", fontWeight: 700, padding: "11px 10px", borderBottom: "1px solid #d1d5db", textAlign: "right", whiteSpace: "nowrap" },
  thCenter: { background: "#f3f4f6", color: "#374151", fontWeight: 700, padding: "11px 10px", borderBottom: "1px solid #d1d5db", textAlign: "center", whiteSpace: "nowrap" },
  td: { padding: "11px 10px", borderBottom: "1px solid #eef0f2", whiteSpace: "nowrap", color: "#111827", background: "#ffffff" },
  tdRight: { padding: "11px 10px", borderBottom: "1px solid #eef0f2", whiteSpace: "nowrap", color: "#111827", background: "#ffffff", textAlign: "right", fontWeight: 600 },
  tdCenter: { padding: "11px 10px", borderBottom: "1px solid #eef0f2", whiteSpace: "nowrap", color: "#111827", background: "#ffffff", textAlign: "center" },
  fromBadge: { background: "#eef2ff", color: "#3730a3", padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 },
  status: { display: "inline-block", padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 },
  activeStatus: { background: "#dcfce7", color: "#166534" },
  inactiveStatus: { background: "#fee2e2", color: "#991b1b" },
  actionGroup: { display: "flex", justifyContent: "center", gap: 5 },
  editButton: { border: "none", background: "#eef2ff", width: 34, height: 34, borderRadius: 7, cursor: "pointer" },
  deleteButton: { border: "none", background: "#fee2e2", width: 34, height: 34, borderRadius: 7, cursor: "pointer" },
  loading: { padding: 40, textAlign: "center", color: "#374151" },
  noData: { padding: 35, textAlign: "center", color: "#6b7280" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000 },
  modal: { width: "100%", maxWidth: 600, background: "#ffffff", color: "#111827", borderRadius: "20px 20px 0 0", padding: 20, maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  modalTitle: { margin: 0, color: "#111827", fontSize: 20 },
  closeButton: { border: "none", background: "#f3f4f6", color: "#111827", width: 35, height: 35, borderRadius: "50%", fontSize: 22, cursor: "pointer" },
  label: { display: "block", fontSize: 13, fontWeight: 600, marginTop: 13, marginBottom: 6, color: "#374151" },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", background: "#ffffff", color: "#111827", borderRadius: 9, padding: 11, fontSize: 14, outline: "none" },
  loadingSmall: { background: "#f3f4f6", color: "#374151", padding: 11, borderRadius: 9, fontSize: 13 },
  saveButton: { width: "100%", border: "none", background: "#111827", color: "#ffffff", padding: 13, borderRadius: 10, marginTop: 20, fontWeight: 700, cursor: "pointer" },
};