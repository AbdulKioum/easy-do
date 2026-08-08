import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabase";

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

export default function UpazilaPage() {
  const [items, setItems] = useState<Upazila[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] =
    useState<Upazila>(emptyForm);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadUpazilas();
  }, []);

  async function loadUpazilas() {
    setLoading(true);

    const { data, error } = await supabase
      .from("upazilas")
      .select("*")
      .order("district", {
        ascending: true,
      })
      .order("upazila_name", {
        ascending: true,
      });

    if (error) {
      console.error(error);
      alert("Upazila load failed.");
    } else {
      setItems(data || []);
    }

    setLoading(false);
  }

  function openAdd() {
    setEditingId(null);

    setForm({
      district: "",
      upazila_name: "",
      status: "Active",
    });

    setShowForm(true);
  }

  function openEdit(item: Upazila) {
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
      const { error } = await supabase
        .from("upazilas")
        .update(payload)
        .eq("id", editingId);

      if (error) {
        console.error(error);
        alert("Update failed.");
        return;
      }
    } else {
      const { error } = await supabase
        .from("upazilas")
        .insert([payload]);

      if (error) {
        console.error(error);
        alert("Add failed.");
        return;
      }
    }

    closeForm();
    loadUpazilas();
  }

  async function deleteUpazila(id?: number) {
    if (!id) return;

    const confirmed = window.confirm(
      "Delete this Upazila?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("upazilas")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Delete failed.");
      return;
    }

    loadUpazilas();
  }

  function handleExcelImport(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(
          e.target?.result as ArrayBuffer
        );

        const workbook = XLSX.read(data, {
          type: "array",
        });

        const sheet =
          workbook.Sheets[
            workbook.SheetNames[0]
          ];

        const rows =
          XLSX.utils.sheet_to_json<any>(
            sheet
          );

        if (!rows.length) {
          alert("Excel file is empty.");
          return;
        }

        const importData = rows
          .map((row) => ({
            district: String(
              row["District"] || ""
            ).trim(),

            upazila_name: String(
              row["Upazila"] || ""
            ).trim(),

            status: String(
              row["Status"] || "Active"
            ).trim(),
          }))
          .filter(
            (item) =>
              item.district &&
              item.upazila_name
          );

        if (!importData.length) {
          alert("No valid data found.");
          return;
        }

        const { error } = await supabase
          .from("upazilas")
          .insert(importData);

        if (error) {
          console.error(error);
          alert("Excel import failed.");
          return;
        }

        alert(
          `${importData.length} Upazila imported successfully.`
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

    const exportData = filteredItems.map(
      (item, index) => ({
        SL: index + 1,
        District: item.district,
        Upazila: item.upazila_name,
        Status: item.status,
      })
    );

    const worksheet =
      XLSX.utils.json_to_sheet(exportData);

    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 25 },
      { wch: 30 },
      { wch: 14 },
    ];

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Upazila List"
    );

    XLSX.writeFile(
      workbook,
      "Upazila_List.xlsx"
    );
  }

  const filteredItems = useMemo(() => {
    const text = search
      .toLowerCase()
      .trim();

    return items.filter((item) => {
      const matchesSearch =
        item.district
          .toLowerCase()
          .includes(text) ||
        item.upazila_name
          .toLowerCase()
          .includes(text);

      const matchesStatus =
        statusFilter === "All" ||
        item.status === statusFilter;

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [
    items,
    search,
    statusFilter,
  ]);

  return (
    <div style={styles.page}>
      {/* HEADER */}

      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            Upazila
          </h1>

          <p style={styles.subtitle}>
            Manage district and Upazila list
          </p>
        </div>

        <div style={styles.headerButtons}>
          <button
            style={styles.exportButton}
            onClick={exportExcel}
          >
            📤 Export
          </button>

          <button
            style={styles.importButton}
            onClick={() =>
              fileInputRef.current?.click()
            }
          >
            📥 Import
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{
              display: "none",
            }}
            onChange={handleExcelImport}
          />

          <button
            style={styles.addButton}
            onClick={openAdd}
          >
            + Add
          </button>
        </div>
      </div>

      {/* SEARCH + FILTER */}

      <div style={styles.toolbar}>
        <div style={styles.searchBox}>
          <span>🔍</span>

          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search district or Upazila..."
            style={styles.searchInput}
          />
        </div>

        <div style={styles.filterRow}>
          <button
            style={{
              ...styles.filterButton,
              ...(statusFilter === "All"
                ? styles.filterActive
                : {}),
            }}
            onClick={() =>
              setStatusFilter("All")
            }
          >
            All
          </button>

          <button
            style={{
              ...styles.filterButton,
              ...(statusFilter === "Active"
                ? styles.filterActive
                : {}),
            }}
            onClick={() =>
              setStatusFilter("Active")
            }
          >
            Active
          </button>

          <button
            style={{
              ...styles.filterButton,
              ...(statusFilter === "Inactive"
                ? styles.filterActive
                : {}),
            }}
            onClick={() =>
              setStatusFilter("Inactive")
            }
          >
            Inactive
          </button>
        </div>
      </div>

      {/* TABLE */}

      {loading ? (
        <div style={styles.loading}>
          Loading Upazila...
        </div>
      ) : (
        <div style={styles.tableCard}>
          <div style={styles.tableTop}>
            <div>
              <strong>
                Upazila List
              </strong>

              <span style={styles.count}>
                {filteredItems.length} records
              </span>
            </div>
          </div>

          <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.thSl}>
                    SL
                  </th>

                  <th style={styles.th}>
                    District
                  </th>

                  <th style={styles.th}>
                    Upazila
                  </th>

                  <th style={styles.th}>
                    Status
                  </th>

                  <th style={styles.thCenter}>
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredItems.map(
                  (item, index) => (
                    <tr key={item.id}>
                      <td
                        style={
                          styles.tdSl
                        }
                      >
                        {index + 1}
                      </td>

                      <td
                        style={
                          styles.td
                        }
                      >
                        <span
                          style={
                            styles.districtBadge
                          }
                        >
                          {item.district}
                        </span>
                      </td>

                      <td
                        style={{
                          ...styles.td,
                          fontWeight: 600,
                        }}
                      >
                        {item.upazila_name}
                      </td>

                      <td
                        style={
                          styles.td
                        }
                      >
                        <span
                          style={{
                            ...styles.status,
                            ...(item.status ===
                            "Active"
                              ? styles.activeStatus
                              : styles.inactiveStatus),
                          }}
                        >
                          {item.status}
                        </span>
                      </td>

                      <td
                        style={
                          styles.tdCenter
                        }
                      >
                        <div
                          style={
                            styles.actions
                          }
                        >
                          <button
                            style={
                              styles.editButton
                            }
                            onClick={() =>
                              openEdit(item)
                            }
                            title="Edit"
                          >
                            ✏️
                          </button>

                          <button
                            style={
                              styles.deleteButton
                            }
                            onClick={() =>
                              deleteUpazila(
                                item.id
                              )
                            }
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>

            {!filteredItems.length && (
              <div style={styles.noData}>
                No Upazila found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD / EDIT MODAL */}

      {showForm && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div
              style={
                styles.modalHeader
              }
            >
              <h2
                style={
                  styles.modalTitle
                }
              >
                {editingId
                  ? "Edit Upazila"
                  : "Add Upazila"}
              </h2>

              <button
                style={
                  styles.closeButton
                }
                onClick={closeForm}
              >
                ×
              </button>
            </div>

            <label
              style={styles.label}
            >
              District
            </label>

            <input
              value={form.district}
              onChange={(e) =>
                setForm({
                  ...form,
                  district:
                    e.target.value,
                })
              }
              placeholder="Example: Mymensingh"
              style={styles.input}
            />

            <label
              style={styles.label}
            >
              Upazila
            </label>

            <input
              value={
                form.upazila_name
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  upazila_name:
                    e.target.value,
                })
              }
              placeholder="Example: Trishal"
              style={styles.input}
            />

            <label
              style={styles.label}
            >
              Status
            </label>

            <select
              value={form.status}
              onChange={(e) =>
                setForm({
                  ...form,
                  status:
                    e.target.value,
                })
              }
              style={styles.input}
            >
              <option>
                Active
              </option>

              <option>
                Inactive
              </option>
            </select>

            <button
              style={
                styles.saveButton
              }
              onClick={
                saveUpazila
              }
            >
              {editingId
                ? "Update Upazila"
                : "Save Upazila"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<
  string,
  React.CSSProperties
> = {
  page: {
    minHeight: "100vh",
    background: "#f3f4f6",
    padding: 14,
    color: "#111827",
    boxSizing: "border-box",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },

  title: {
    margin: 0,
    fontSize: 23,
    fontWeight: 800,
    color: "#111827",
  },

  subtitle: {
    margin: "3px 0 0",
    fontSize: 12,
    color: "#6b7280",
  },

  headerButtons: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  exportButton: {
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    padding: "9px 10px",
    borderRadius: 9,
    fontWeight: 600,
    cursor: "pointer",
  },

  importButton: {
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    padding: "9px 10px",
    borderRadius: 9,
    fontWeight: 600,
    cursor: "pointer",
  },

  addButton: {
    border: "none",
    background: "#111827",
    color: "#ffffff",
    padding: "9px 11px",
    borderRadius: 9,
    fontWeight: 600,
    cursor: "pointer",
  },

  toolbar: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    marginBottom: 12,
  },

  searchBox: {
    flex: 1,
    minWidth: 200,
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    padding: "11px 13px",
    borderRadius: 10,
  },

  searchInput: {
    border: "none",
    outline: "none",
    background: "#ffffff",
    color: "#111827",
    width: "100%",
    fontSize: 14,
  },

  filterRow: {
    display: "flex",
    gap: 6,
  },

  filterButton: {
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#374151",
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 12,
    cursor: "pointer",
  },

  filterActive: {
    background: "#111827",
    color: "#ffffff",
    borderColor: "#111827",
  },

  tableCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
    boxShadow:
      "0 1px 3px rgba(0,0,0,0.05)",
  },

  tableTop: {
    padding: "13px 15px",
    borderBottom:
      "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#111827",
  },

  count: {
    marginLeft: 8,
    fontSize: 12,
    color: "#6b7280",
    fontWeight: 400,
  },

  tableScroll: {
    width: "100%",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    minWidth: 650,
    borderCollapse: "collapse",
    color: "#111827",
    fontSize: 13,
  },

  thSl: {
    background: "#f3f4f6",
    color: "#374151",
    fontWeight: 700,
    padding: "11px 10px",
    borderBottom:
      "1px solid #d1d5db",
    textAlign: "center",
    width: 55,
  },

  th: {
    background: "#f3f4f6",
    color: "#374151",
    fontWeight: 700,
    padding: "11px 10px",
    borderBottom:
      "1px solid #d1d5db",
    textAlign: "left",
    whiteSpace: "nowrap",
  },

  thCenter: {
    background: "#f3f4f6",
    color: "#374151",
    fontWeight: 700,
    padding: "11px 10px",
    borderBottom:
      "1px solid #d1d5db",
    textAlign: "center",
    whiteSpace: "nowrap",
  },

  tdSl: {
    padding: "11px 10px",
    borderBottom:
      "1px solid #eef0f2",
    textAlign: "center",
    color: "#6b7280",
    background: "#ffffff",
  },

  td: {
    padding: "11px 10px",
    borderBottom:
      "1px solid #eef0f2",
    whiteSpace: "nowrap",
    color: "#111827",
    background: "#ffffff",
  },

  tdCenter: {
    padding: "11px 10px",
    borderBottom:
      "1px solid #eef0f2",
    whiteSpace: "nowrap",
    color: "#111827",
    background: "#ffffff",
    textAlign: "center",
  },

  districtBadge: {
    display: "inline-block",
    background: "#eef2ff",
    color: "#3730a3",
    padding: "4px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
  },

  status: {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
  },

  activeStatus: {
    background: "#dcfce7",
    color: "#166534",
  },

  inactiveStatus: {
    background: "#fee2e2",
    color: "#991b1b",
  },

  actions: {
    display: "flex",
    justifyContent: "center",
    gap: 5,
  },

  editButton: {
    border: "none",
    background: "#eef2ff",
    width: 34,
    height: 34,
    borderRadius: 7,
    cursor: "pointer",
  },

  deleteButton: {
    border: "none",
    background: "#fee2e2",
    width: 34,
    height: 34,
    borderRadius: 7,
    cursor: "pointer",
  },

  loading: {
    padding: 40,
    textAlign: "center",
    color: "#374151",
  },

  noData: {
    padding: 35,
    textAlign: "center",
    color: "#6b7280",
  },

  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.45)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 1000,
  },

  modal: {
    width: "100%",
    maxWidth: 600,
    background: "#ffffff",
    color: "#111827",
    borderRadius:
      "20px 20px 0 0",
    padding: 20,
    maxHeight: "90vh",
    overflowY: "auto",
    boxSizing: "border-box",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  modalTitle: {
    margin: 0,
    color: "#111827",
    fontSize: 20,
  },

  closeButton: {
    border: "none",
    background: "#f3f4f6",
    color: "#111827",
    width: 35,
    height: 35,
    borderRadius: "50%",
    fontSize: 22,
    cursor: "pointer",
  },

  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    marginTop: 13,
    marginBottom: 6,
    color: "#374151",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#111827",
    borderRadius: 9,
    padding: 11,
    fontSize: 14,
    outline: "none",
  },

  saveButton: {
    width: "100%",
    border: "none",
    background: "#111827",
    color: "#ffffff",
    padding: 13,
    borderRadius: 10,
    marginTop: 20,
    fontWeight: 700,
    cursor: "pointer",
  },
};