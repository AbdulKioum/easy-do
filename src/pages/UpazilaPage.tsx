import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

type Upazila = {
  id?: number;
  district: string;
  upazila_name: string;
  status: string;
};

const emptyForm: Upazila = {
  district: "",
  upazila_name: "",
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

const COMPACT_UZ_CSS = `
  .uz-page { min-height: calc(100vh - 60px); background: #f8fafc; padding: 10px; box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; color: #0f172a; }
  .uz-container { max-width: 920px; margin: 0 auto; }
  
  .uz-topbar { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
  .uz-title { margin: 0; font-size: 15px; font-weight: 800; color: #0f172a; letter-spacing: -0.2px; }
  .uz-btn-group { display: flex; gap: 5px; flex-wrap: wrap; }
  
  .uz-action-btn { border: 1px solid #cbd5e1; background: #ffffff; color: #334155; padding: 5px 9px; border-radius: 6px; font-size: 11.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s ease; }
  .uz-action-btn:hover { background: #f1f5f9; border-color: #94a3b8; }
  .uz-primary-btn { background: #0f172a; color: #ffffff; border-color: #0f172a; }
  .uz-primary-btn:hover { background: #1e293b; }
  .uz-excel-btn { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }

  .uz-toolbar { display: flex; gap: 6px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
  .uz-search-bar { flex: 1; min-width: 200px; display: flex; align-items: center; gap: 6px; background: #ffffff; border: 1px solid #e2e8f0; padding: 6px 10px; border-radius: 8px; }
  .uz-search-input { border: none; outline: none; background: transparent; width: 100%; font-size: 12.5px; font-weight: 600; color: #0f172a; }

  .uz-filters { display: flex; gap: 4px; }
  .uz-filter-pill { border: 1px solid #cbd5e1; background: #ffffff; color: #475569; padding: 5px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 700; cursor: pointer; }
  .uz-filter-pill.active { background: #0f172a; color: #ffffff; border-color: #0f172a; }

  .uz-table-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03); }
  .uz-scroll-wrap { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .uz-table { width: 100%; min-width: 600px; border-collapse: collapse; font-size: 12px; text-align: left; }
  .uz-th { background: #f8fafc; color: #475569; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
  .uz-td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; color: #0f172a; white-space: nowrap; }
  .uz-tr:hover { background: #f8fafc !important; }

  .uz-district-badge { display: inline-block; background: #eef2ff; color: #3730a3; padding: 2px 7px; border-radius: 5px; font-size: 10.5px; font-weight: 700; border: 1px solid #c7d2fe; }
  .uz-status { padding: 2px 5px; border-radius: 4px; font-size: 10px; font-weight: 800; }
  .uz-active { background: #dcfce7; color: #166534; }
  .uz-inactive { background: #fee2e2; color: #991b1b; }
  
  .uz-icon-btn { border: 1px solid #e2e8f0; background: #f8fafc; width: 26px; height: 26px; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; justifyContent: center; font-size: 11px; }
  .uz-icon-btn:hover { background: #eff6ff; border-color: #bfdbfe; }
`;

export default function UpazilaPage() {
  const { user, role } = useAuth();

  const canManage = role === "admin" || role === "super_admin";
  const isSuperAdmin = role === "super_admin";

  const [items, setItems] = useState<Upazila[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Upazila>(emptyForm);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.id) {
      loadUserProfile();
    } else {
      setProfileLoading(false);
    }
    loadUpazilas();
  }, [user?.id]);

  async function loadUserProfile() {
    setProfileLoading(true);
    const { data } = await supabase.from("profiles").select("*").eq("id", user?.id).single();
    if (data) {
      setUserProfile(data);
    }
    setProfileLoading(false);
  }

  const assignedDistricts: string[] = useMemo(() => {
    if (isSuperAdmin) return [];
    return parseList(userProfile?.assigned_districts);
  }, [isSuperAdmin, userProfile]);

  async function loadUpazilas() {
    setLoading(true);

    const { data, error } = await supabase
      .from("upazilas")
      .select("*")
      .order("district", { ascending: true })
      .order("upazila_name", { ascending: true });

    if (error) {
      console.error(error);
      alert("Upazila load failed.");
    } else {
      setItems(data || []);
    }

    setLoading(false);
  }

  const visibleItems = useMemo(() => {
    if (isSuperAdmin) return items;
    if (profileLoading) return [];
    if (assignedDistricts.length === 0) return [];

    const lowerDistricts = assignedDistricts.map((d) => d.toLowerCase());
    return items.filter((item) =>
      lowerDistricts.includes((item.district || "").trim().toLowerCase())
    );
  }, [items, isSuperAdmin, profileLoading, assignedDistricts]);

  function openAdd() {
    if (!canManage) return;

    setEditingId(null);
    setForm({
      district: assignedDistricts[0] || "",
      upazila_name: "",
      status: "Active",
    });

    setShowForm(true);
  }

  function openEdit(item: Upazila) {
    if (!canManage) return;

    setEditingId(item.id || null);
    setForm({
      district: item.district,
      upazila_name: item.upazila_name,
      status: item.status,
    });

    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({
      district: "",
      upazila_name: "",
      status: "Active",
    });
  }

  async function saveUpazila() {
    if (!canManage) {
      alert("You do not have permission to manage Upazila.");
      return;
    }

    if (!form.district.trim()) {
      alert("District is required.");
      return;
    }

    if (!form.upazila_name.trim()) {
      alert("Upazila name is required.");
      return;
    }

    const payload = {
      district: form.district.trim(),
      upazila_name: form.upazila_name.trim(),
      status: form.status,
    };

    if (editingId) {
      const { error } = await supabase.from("upazilas").update(payload).eq("id", editingId);
      if (error) {
        console.error(error);
        alert("Update failed.");
        return;
      }
    } else {
      const existing = items.find(
        (i) =>
          i.district.trim().toLowerCase() === payload.district.toLowerCase() &&
          i.upazila_name.trim().toLowerCase() === payload.upazila_name.toLowerCase()
      );

      if (existing?.id) {
        const { error } = await supabase.from("upazilas").update(payload).eq("id", existing.id);
        if (error) {
          alert("Update failed.");
          return;
        }
      } else {
        const { error } = await supabase.from("upazilas").insert([payload]);
        if (error) {
          console.error(error);
          alert("Add failed.");
          return;
        }
      }
    }

    closeForm();
    loadUpazilas();
  }

  async function deleteUpazila(id?: number) {
    if (!canManage) {
      alert("You do not have permission to delete Upazila.");
      return;
    }

    if (!id) return;
    const confirmed = window.confirm("Delete this Upazila?");
    if (!confirmed) return;

    const { error } = await supabase.from("upazilas").delete().eq("id", id);
    if (error) {
      console.error(error);
      alert("Delete failed.");
      return;
    }

    loadUpazilas();
  }

  function handleExcelImport(event: React.ChangeEvent<HTMLInputElement>) {
    if (!canManage) {
      event.target.value = "";
      alert("You do not have permission to import Upazila.");
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

        const excelMap = new Map<string, Omit<Upazila, "id">>();
        rows.forEach((row) => {
          const district = String(row["District"] || row["district"] || "").trim();
          const upazila_name = String(row["Upazila"] || row["upazila_name"] || "").trim();
          const status = String(row["Status"] || row["status"] || "Active").trim();

          if (district && upazila_name) {
            const key = `${district.toLowerCase()}|${upazila_name.toLowerCase()}`;
            excelMap.set(key, { district, upazila_name, status });
          }
        });

        const uniqueImportData = Array.from(excelMap.values());
        if (!uniqueImportData.length) {
          alert("No valid data found.");
          return;
        }

        const { data: existingData, error: fetchError } = await supabase
          .from("upazilas")
          .select("id, district, upazila_name");

        if (fetchError) {
          alert(`Failed to check existing data: ${fetchError.message}`);
          return;
        }

        const existingMap = new Map<string, number>();
        (existingData || []).forEach((item) => {
          const key = `${(item.district || "").trim().toLowerCase()}|${(item.upazila_name || "").trim().toLowerCase()}`;
          existingMap.set(key, item.id);
        });

        const toInsert: any[] = [];
        const toUpdate: any[] = [];

        uniqueImportData.forEach((item) => {
          const key = `${item.district.toLowerCase()}|${item.upazila_name.toLowerCase()}`;
          const existingId = existingMap.get(key);
          if (existingId) {
            toUpdate.push({ id: existingId, ...item });
          } else {
            toInsert.push(item);
          }
        });

        if (toInsert.length > 0) {
          const { error: insertErr } = await supabase.from("upazilas").insert(toInsert);
          if (insertErr) {
            alert(`Insert failed: ${insertErr.message}`);
            return;
          }
        }

        if (toUpdate.length > 0) {
          const { error: updateErr } = await supabase
            .from("upazilas")
            .upsert(toUpdate, { onConflict: "id" });
          if (updateErr) {
            alert(`Update failed: ${updateErr.message}`);
            return;
          }
        }

        alert(
          `Import successful! Added: ${toInsert.length}, Updated: ${toUpdate.length}`
        );
        loadUpazilas();
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
      alert("No Upazila data available to export.");
      return;
    }

    const exportData = filteredItems.map((item, index) => ({
      SL: index + 1,
      District: item.district,
      Upazila: item.upazila_name,
      Status: item.status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet["!cols"] = [{ wch: 8 }, { wch: 25 }, { wch: 30 }, { wch: 14 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Upazila List");
    XLSX.writeFile(workbook, "Upazila_List.xlsx");
  }

  const filteredItems = useMemo(() => {
    const text = search.toLowerCase().trim();

    return visibleItems.filter((item) => {
      const matchesSearch =
        item.district.toLowerCase().includes(text) ||
        item.upazila_name.toLowerCase().includes(text);

      const matchesStatus = statusFilter === "All" || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [visibleItems, search, statusFilter]);

  const isPageLoading = loading || profileLoading;

  return (
    <div className="uz-page">
      <style>{COMPACT_UZ_CSS}</style>

      <div className="uz-container">
        {/* COMPACT TOP BAR */}
        <div className="uz-topbar">
          <h1 className="uz-title">Upazilas</h1>

          <div className="uz-btn-group">
            <button className="uz-action-btn uz-excel-btn" onClick={exportExcel} title="Download Excel">
              📥 Download Excel
            </button>

            {canManage && (
              <>
                <button
                  className="uz-action-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Import Excel"
                >
                  📥 Import
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: "none" }}
                  onChange={handleExcelImport}
                />
                <button className="uz-action-btn uz-primary-btn" onClick={openAdd}>
                  ＋ Add Upazila
                </button>
              </>
            )}
          </div>
        </div>

        {/* TOOLBAR: SEARCH & STATUS FILTER */}
        <div className="uz-toolbar">
          <div className="uz-search-bar">
            <span>🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search district or Upazila..."
              className="uz-search-input"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{ border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 12 }}
              >
                ✕
              </button>
            )}
          </div>

          <div className="uz-filters">
            {["All", "Active", "Inactive"].map((status) => (
              <button
                key={status}
                className={`uz-filter-pill ${statusFilter === status ? "active" : ""}`}
                onClick={() => setStatusFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* TABLE CARD */}
        {isPageLoading ? (
          <div style={{ padding: 30, textAlign: "center", color: "#64748b", fontSize: 12.5 }}>
            Loading Upazila list...
          </div>
        ) : (
          <div className="uz-table-card">
            <div style={{ padding: "8px 12px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", fontSize: 11.5, fontWeight: 700, color: "#475569", display: "flex", justifyContent: "space-between" }}>
              <span>Upazila List</span>
              <span>{filteredItems.length} records</span>
            </div>

            <div className="uz-scroll-wrap">
              <table className="uz-table">
                <thead>
                  <tr>
                    <th className="uz-th" style={{ width: 35, textAlign: "center" }}>SL</th>
                    <th className="uz-th">District</th>
                    <th className="uz-th">Upazila Name</th>
                    <th className="uz-th" style={{ textAlign: "center" }}>Status</th>
                    {canManage && <th className="uz-th" style={{ textAlign: "center" }}>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, index) => {
                    const rowBg = index % 2 === 0 ? "#ffffff" : "#f8fafc";
                    return (
                      <tr key={item.id} className="uz-tr" style={{ background: rowBg }}>
                        <td className="uz-td" style={{ textAlign: "center", color: "#64748b", fontWeight: 600 }}>
                          {index + 1}
                        </td>
                        <td className="uz-td">
                          <span className="uz-district-badge">{item.district}</span>
                        </td>
                        <td className="uz-td" style={{ fontWeight: 750, color: "#0f172a" }}>
                          {item.upazila_name}
                        </td>
                        <td className="uz-td" style={{ textAlign: "center" }}>
                          <span
                            className={`uz-status ${
                              item.status === "Active" ? "uz-active" : "uz-inactive"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        {canManage && (
                          <td className="uz-td" style={{ textAlign: "center" }}>
                            <div style={{ display: "inline-flex", gap: 4 }}>
                              <button className="uz-icon-btn" onClick={() => openEdit(item)} title="Edit">
                                ✏️
                              </button>
                              <button
                                className="uz-icon-btn"
                                style={{ background: "#fef2f2", borderColor: "#fecaca" }}
                                onClick={() => deleteUpazila(item.id)}
                                title="Delete"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {!filteredItems.length && (
                <div style={{ padding: 30, textAlign: "center", color: "#64748b", fontSize: 12.5 }}>
                  No Upazila found.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ADD / EDIT MODAL */}
      {showForm && canManage && (
        <div style={modalStyles.overlay}>
          <div style={modalStyles.modal}>
            <div style={modalStyles.header}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
                {editingId ? "Edit Upazila" : "Add Upazila"}
              </h3>
              <button style={modalStyles.closeBtn} onClick={closeForm}>×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "72vh", overflowY: "auto", paddingRight: 4 }}>
              <div>
                <label style={modalStyles.label}>District</label>
                {!isSuperAdmin && assignedDistricts.length > 0 ? (
                  <select
                    value={form.district}
                    onChange={(e) => setForm({ ...form, district: e.target.value })}
                    style={modalStyles.input}
                  >
                    {assignedDistricts.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={form.district}
                    onChange={(e) => setForm({ ...form, district: e.target.value })}
                    placeholder="Example: Mymensingh"
                    style={modalStyles.input}
                  />
                )}
              </div>

              <div>
                <label style={modalStyles.label}>Upazila Name</label>
                <input
                  value={form.upazila_name}
                  onChange={(e) => setForm({ ...form, upazila_name: e.target.value })}
                  placeholder="Example: Trishal"
                  style={modalStyles.input}
                />
              </div>

              <div>
                <label style={modalStyles.label}>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  style={modalStyles.input}
                >
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, marginTop: 12, justifyContent: "flex-end" }}>
              <button onClick={closeForm} style={modalStyles.cancelBtn}>Cancel</button>
              <button onClick={saveUpazila} style={modalStyles.saveBtn}>
                {editingId ? "Update Upazila" : "Save Upazila"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const modalStyles: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 12 },
  modal: { width: "100%", maxWidth: 420, background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 15px 30px rgba(15, 23, 42, 0.15)", boxSizing: "border-box", textAlign: "left" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, borderBottom: "1px solid #f1f5f9", paddingBottom: 8 },
  closeBtn: { border: "none", background: "#f1f5f9", width: 26, height: 26, borderRadius: "50%", cursor: "pointer", fontWeight: 700, color: "#475569", fontSize: 11.5 },
  label: { display: "block", marginBottom: 3, fontSize: 11, fontWeight: 700, color: "#475569" },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 7, padding: "7px 9px", background: "#ffffff", color: "#0f172a", fontSize: 12, outline: "none" },
  cancelBtn: { border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 7, padding: "7px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" },
  saveBtn: { border: "none", background: "#2563eb", color: "#fff", borderRadius: 7, padding: "7px 14px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" },
};