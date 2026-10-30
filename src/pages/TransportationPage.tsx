import { useEffect, useMemo, useRef, useState } from "react";
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

function parseList(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map((s) => String(s).trim()).filter(Boolean);
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map((s) => String(s).trim()).filter(Boolean);
    } catch {
      return val.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export default function TransportationPage() {
  const { user, role } = useAuth();
  const [items, setItems] = useState<Transportation[]>([]);
  const [upazilas, setUpazilas] = useState<Upazila[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [upazilaLoading, setUpazilaLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [fromFilter, setFromFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Transportation>(emptyForm);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const canManage = role === "admin" || role === "super_admin";
  const isSuperAdmin = role === "super_admin";

  useEffect(() => {
    if (user?.id) {
      loadUserProfile();
    } else {
      setProfileLoading(false);
    }
    loadTransportation();
    loadUpazilas();
  }, [user?.id]);

  async function loadUserProfile() {
    setProfileLoading(true);
    const { data } = await supabase.from("profiles").select("*").eq("id", user?.id).single();
    if (data) {
      setUserProfile(data);
      const locs = parseList(data.assigned_from_locations);
      if (locs.length > 0 && !emptyForm.from_location) {
        setForm((prev) => ({ ...prev, from_location: locs[0] }));
      }
    }
    setProfileLoading(false);
  }

  const assignedFromLocations: string[] = useMemo(() => {
    if (isSuperAdmin) {
      const dbLocs = Array.from(new Set(items.map((i) => i.from_location).filter(Boolean)));
      return dbLocs.length > 0 ? dbLocs : ["Valuka Feed Mill", "Mymensingh Depot"];
    }
    return parseList(userProfile?.assigned_from_locations);
  }, [isSuperAdmin, userProfile, items]);

  const assignedDistricts: string[] = useMemo(() => {
    if (isSuperAdmin) return [];
    return parseList(userProfile?.assigned_districts);
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
      .order("district", { ascending: true })
      .order("upazila_name", { ascending: true });

    if (error) {
      console.error(error);
      alert("Upazila load failed.");
    } else {
      setUpazilas((data || []) as Upazila[]);
    }
    setUpazilaLoading(false);
  }

  // Filter upazilas based on user's assigned districts
  const filteredUpazilaList = useMemo(() => {
    const activeUpazilas = upazilas.filter((u) => u.status === "Active");
    if (isSuperAdmin) return activeUpazilas;
    if (!assignedDistricts.length) return [];

    const lowerDistricts = assignedDistricts.map((d) => d.toLowerCase());
    return activeUpazilas.filter((u) =>
      lowerDistricts.includes((u.district || "").trim().toLowerCase())
    );
  }, [upazilas, assignedDistricts, isSuperAdmin]);

  // Allowed transportation items based on user assignments
  const visibleItems = useMemo(() => {
    if (isSuperAdmin) return items;
    if (profileLoading || upazilaLoading) return [];
    if (assignedDistricts.length === 0) return [];

    const lowerAssignedDistricts = assignedDistricts.map((d) => d.toLowerCase());
    const lowerAssignedFrom = assignedFromLocations.map((l) => l.toLowerCase());

    const allowedUpazilaSet = new Set(
      upazilas
        .filter((u) => lowerAssignedDistricts.includes((u.district || "").trim().toLowerCase()))
        .map((u) => (u.upazila_name || "").trim().toLowerCase())
    );

    return items.filter((item) => {
      const itemFrom = (item.from_location || "").trim().toLowerCase();
      const itemUpazila = (item.to_upazila || "").trim().toLowerCase();

      const matchFrom =
        lowerAssignedFrom.length === 0 || lowerAssignedFrom.includes(itemFrom);
      const matchDistrict = allowedUpazilaSet.has(itemUpazila);

      return matchFrom && matchDistrict;
    });
  }, [
    items,
    isSuperAdmin,
    profileLoading,
    upazilaLoading,
    assignedFromLocations,
    assignedDistricts,
    upazilas,
  ]);

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
      from_location: form.from_location.trim(),
      to_upazila: form.to_upazila.trim(),
      floating_cattle_rate_per_kg: Number(form.floating_cattle_rate_per_kg),
      sinking_broiler_layer_sonali_rate_per_kg: Number(form.sinking_broiler_layer_sonali_rate_per_kg),
      status: form.status,
    };

    if (editingId) {
      const { error } = await supabase.from("transportation").update(payload).eq("id", editingId);
      if (error) {
        alert("Transportation update failed.");
        return;
      }
    } else {
      // Check if already exists to avoid duplicate on manual add
      const existing = items.find(
        (i) =>
          i.from_location.trim().toLowerCase() === payload.from_location.toLowerCase() &&
          i.to_upazila.trim().toLowerCase() === payload.to_upazila.toLowerCase()
      );

      if (existing?.id) {
        const { error } = await supabase.from("transportation").update(payload).eq("id", existing.id);
        if (error) {
          alert("Transportation update failed.");
          return;
        }
      } else {
        const { error } = await supabase.from("transportation").insert([payload]);
        if (error) {
          alert("Transportation add failed.");
          return;
        }
      }
    }

    closeForm();
    await loadTransportation();
  }

  async function deleteTransportation(id?: number) {
    if (!canManage || !id) return;
    if (!window.confirm("Delete this transportation rate?")) return;

    const { error } = await supabase.from("transportation").delete().eq("id", id);
    if (error) {
      alert("Delete failed.");
      return;
    }
    await loadTransportation();
  }

  // EXCEL IMPORT: Update existing or Insert new (No Duplicates)
  function handleExcelImport(event: React.ChangeEvent<HTMLInputElement>) {
    if (!canManage) {
      event.target.value = "";
      alert("You do not have permission to import transportation data.");
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any>(sheet);

        if (!rows.length) {
          alert("Excel file is empty.");
          return;
        }

        // Deduplicate inside Excel file itself first
        const excelMap = new Map<string, Omit<Transportation, "id">>();
        rows.forEach((row) => {
          const from_location = String(row["From"] || row["from_location"] || "").trim();
          const to_upazila = String(row["Upazila"] || row["To / Upazila"] || row["to_upazila"] || "").trim();
          const floating_cattle_rate_per_kg = Number(
            row["Floating & Cattle (৳/KG)"] ?? row["floating_cattle_rate_per_kg"] ?? 0
          );
          const sinking_broiler_layer_sonali_rate_per_kg = Number(
            row["Sinking & Broiler & Layer & Sonali (৳/KG)"] ?? row["sinking_broiler_layer_sonali_rate_per_kg"] ?? 0
          );
          const status = String(row["Status"] || row["status"] || "Active").trim();

          if (from_location && to_upazila) {
            const key = `${from_location.toLowerCase()}|${to_upazila.toLowerCase()}`;
            excelMap.set(key, {
              from_location,
              to_upazila,
              floating_cattle_rate_per_kg,
              sinking_broiler_layer_sonali_rate_per_kg,
              status,
            });
          }
        });

        const uniqueImportData = Array.from(excelMap.values());
        if (!uniqueImportData.length) {
          alert("No valid transportation data found in Excel.");
          return;
        }

        // Fetch existing records from DB to match and prevent duplicates
        const { data: existingData, error: fetchError } = await supabase
          .from("transportation")
          .select("id, from_location, to_upazila");

        if (fetchError) {
          alert(`Failed to check existing data: ${fetchError.message}`);
          return;
        }

        const existingMap = new Map<string, number>();
        (existingData || []).forEach((item) => {
          const key = `${(item.from_location || "").trim().toLowerCase()}|${(item.to_upazila || "").trim().toLowerCase()}`;
          existingMap.set(key, item.id);
        });

        const toInsert: any[] = [];
        const toUpdate: any[] = [];

        uniqueImportData.forEach((item) => {
          const key = `${item.from_location.toLowerCase()}|${item.to_upazila.toLowerCase()}`;
          const existingId = existingMap.get(key);
          if (existingId) {
            toUpdate.push({ id: existingId, ...item });
          } else {
            toInsert.push(item);
          }
        });

        if (toInsert.length > 0) {
          const { error: insertErr } = await supabase.from("transportation").insert(toInsert);
          if (insertErr) {
            alert(`Insert failed: ${insertErr.message}`);
            return;
          }
        }

        if (toUpdate.length > 0) {
          const { error: updateErr } = await supabase
            .from("transportation")
            .upsert(toUpdate, { onConflict: "id" });
          if (updateErr) {
            alert(`Update failed: ${updateErr.message}`);
            return;
          }
        }

        alert(
          `Import successful! Added: ${toInsert.length}, Updated: ${toUpdate.length}`
        );
        await loadTransportation();
      } catch (error) {
        console.error(error);
        alert("Invalid Excel file.");
      }
    };

    reader.readAsArrayBuffer(file);
    event.target.value = "";
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
    const searchText = search.toLowerCase().trim();
    return visibleItems.filter((item) => {
      const matchesFrom = fromFilter === "All" || item.from_location === fromFilter;
      const matchesSearch =
        item.from_location.toLowerCase().includes(searchText) ||
        item.to_upazila.toLowerCase().includes(searchText);
      return matchesFrom && matchesSearch;
    });
  }, [visibleItems, search, fromFilter]);

  const isPageLoading = loading || upazilaLoading || profileLoading;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Transportation</h1>
          <p style={styles.subtitle}>Transport rate management based on assigned districts</p>
        </div>
        <div style={styles.headerButtons}>
          <button style={styles.exportButton} onClick={exportExcel}>
            📤 Download Transportation List
          </button>
          {canManage && (
            <>
              <button
                style={styles.importButton}
                onClick={() => fileInputRef.current?.click()}
              >
                📥 Import Excel
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: "none" }}
                onChange={handleExcelImport}
              />
              <button style={styles.addButton} onClick={openAdd}>
                + Add
              </button>
            </>
          )}
        </div>
      </div>

      <div style={styles.searchBox}>
        <span>🔍</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search upazila..."
          style={styles.searchInput}
        />
      </div>

      <div style={styles.filterRow}>
        <button
          style={{
            ...styles.filterButton,
            ...(fromFilter === "All" ? styles.filterButtonActive : {}),
          }}
          onClick={() => setFromFilter("All")}
        >
          All Assigned
        </button>
        {assignedFromLocations.map((option) => (
          <button
            key={option}
            style={{
              ...styles.filterButton,
              ...(fromFilter === option ? styles.filterButtonActive : {}),
            }}
            onClick={() => setFromFilter(option)}
          >
            {option}
          </button>
        ))}
      </div>

      {isPageLoading ? (
        <div style={styles.loading}>Loading...</div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>From</th>
                <th style={styles.th}>To / Upazila</th>
                <th style={styles.thRight}>
                  Floating & Cattle
                  <br />
                  <small>৳/KG</small>
                </th>
                <th style={styles.thRight}>
                  Sinking / Broiler / Layer / Sonali
                  <br />
                  <small>৳/KG</small>
                </th>
                <th style={styles.th}>Status</th>
                {canManage && <th style={styles.thCenter}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id}>
                  <td style={styles.td}>
                    <span style={styles.fromBadge}>{item.from_location}</span>
                  </td>
                  <td style={{ ...styles.td, fontWeight: 600 }}>{item.to_upazila}</td>
                  <td style={styles.tdRight}>
                    ৳ {Number(item.floating_cattle_rate_per_kg).toFixed(2)}
                  </td>
                  <td style={styles.tdRight}>
                    ৳ {Number(item.sinking_broiler_layer_sonali_rate_per_kg).toFixed(2)}
                  </td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.status,
                        ...(item.status === "Active"
                          ? styles.activeStatus
                          : styles.inactiveStatus),
                      }}
                    >
                      {item.status}
                    </span>
                  </td>
                  {canManage && (
                    <td style={styles.tdCenter}>
                      <div style={styles.actionGroup}>
                        <button
                          style={styles.editButton}
                          onClick={() => openEdit(item)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          style={styles.deleteButton}
                          onClick={() => deleteTransportation(item.id)}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredItems.length && (
            <div style={styles.noData}>
              No transportation data found for your assigned districts.
            </div>
          )}
        </div>
      )}

      {showForm && canManage && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {editingId ? "Edit Transportation" : "Add Transportation"}
              </h2>
              <button style={styles.closeButton} onClick={closeForm}>
                ×
              </button>
            </div>

            <label style={styles.label}>From (Assigned Mills/Depots)</label>
            <select
              value={form.from_location}
              onChange={(e) => setForm({ ...form, from_location: e.target.value })}
              style={styles.input}
            >
              {assignedFromLocations.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <label style={styles.label}>To / Upazila (Assigned Districts)</label>
            {upazilaLoading ? (
              <div style={styles.loadingSmall}>Loading Upazila...</div>
            ) : (
              <select
                value={form.to_upazila}
                onChange={(e) => setForm({ ...form, to_upazila: e.target.value })}
                style={styles.input}
              >
                <option value="">Select Upazila</option>
                {filteredUpazilaList.map((upazila) => (
                  <option key={upazila.id} value={upazila.upazila_name}>
                    {upazila.upazila_name} — {upazila.district}
                  </option>
                ))}
              </select>
            )}

            <label style={styles.label}>Floating & Cattle — ৳/KG</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.floating_cattle_rate_per_kg}
              onChange={(e) =>
                setForm({ ...form, floating_cattle_rate_per_kg: Number(e.target.value) })
              }
              style={styles.input}
            />

            <label style={styles.label}>Sinking & Broiler & Layer & Sonali — ৳/KG</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.sinking_broiler_layer_sonali_rate_per_kg}
              onChange={(e) =>
                setForm({
                  ...form,
                  sinking_broiler_layer_sonali_rate_per_kg: Number(e.target.value),
                })
              }
              style={styles.input}
            />

            <label style={styles.label}>Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              style={styles.input}
            >
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
  importButton: { border: "1px solid #d1d5db", background: "#ffffff", color: "#111827", padding: "9px 10px", borderRadius: 9, fontWeight: 600, cursor: "pointer" },
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