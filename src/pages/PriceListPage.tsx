import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

type UserRole = "user" | "admin" | "super_admin";

type PriceItem = {
  id?: number;
  category: string;
  item_name: string;
  short_name: string;
  kg_per_bag: number;
  tp_per_bag: number;
  mrp_per_bag: number;
  status: string;
  sort_order?: number;
};

type CategoryConfig = {
  action: "increase" | "decrease";
  tpChange: string;
  mrpChange: string;
};

const categories = [
  "Broiler",
  "Layer",
  "Sonali",
  "Cattle",
  "Fish Floating",
  "Fish Sinking",
];

// Category wise soft colors for UI table
const CATEGORY_COLORS: Record<string, string> = {
  Broiler: "#fef2f2",      // halka lal
  Layer: "#fefce8",        // halka yellow
  Sonali: "#f0fdf4",       // halka sobuj
  Cattle: "#faf5ff",       // halka purple
  "Fish Floating": "#f0f9ff", // halka blue
  "Fish Sinking": "#f9fafb",  // halka gray
};

// Excel Category Colors (Hex without #)
const EXCEL_CATEGORY_COLORS: Record<string, string> = {
  Broiler: "FEE2E2",
  Layer: "FEF3C7",
  Sonali: "DCFCE7",
  Cattle: "F3E8FF",
  "Fish Floating": "E0F2FE",
  "Fish Sinking": "F3F4F6",
};

const emptyForm: PriceItem = {
  category: "Broiler",
  item_name: "",
  short_name: "",
  kg_per_bag: 50,
  tp_per_bag: 0,
  mrp_per_bag: 0,
  status: "Active",
};

export default function PriceListPage() {
  const { user, role } = useAuth();
  const currentRole = role as UserRole | null;

  const canManage =
    currentRole === "admin" ||
    currentRole === "super_admin";

  const canView =
    currentRole === "user" ||
    currentRole === "admin" ||
    currentRole === "super_admin";

  const [items, setItems] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PriceItem>(emptyForm);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedBulkCategories, setSelectedBulkCategories] = useState<string[]>([]);
  const [categoryConfigs, setCategoryConfigs] = useState<Record<string, CategoryConfig>>({});

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  // Page Visit Tracking
  useEffect(() => {
    async function trackPageVisit() {
      if (!user?.id) return;
      const today = new Date().toISOString().split("T")[0];
      await supabase.from("page_visits").insert([
        {
          user_id: user.id,
          page_name: "Pricelist Page",
          visit_date: today,
        },
      ]);
    }
    if (canView) {
      trackPageVisit();
    }
  }, [user?.id, canView]);

  useEffect(() => {
    if (canView) {
      loadPriceList();
    } else {
      setLoading(false);
    }
  }, [canView]);

  async function loadPriceList() {
    setLoading(true);

    const { data, error } = await supabase
      .from("feed_price_list")
      .select("*")
      .order("sort_order", {
        ascending: true,
      });

    if (error) {
      console.error("Price list load error:", error);
      alert(`Price list load failed: ${error.message}`);
    } else {
      setItems((data || []) as PriceItem[]);
    }

    setLoading(false);
  }

  function openAdd() {
    if (!canManage) {
      alert("Only Admin or Super Admin can add price items.");
      return;
    }
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  }

  function openEdit(item: PriceItem) {
    if (!canManage) {
      alert("Only Admin or Super Admin can edit price items.");
      return;
    }
    setEditingId(item.id || null);
    setForm({
      category: item.category,
      item_name: item.item_name,
      short_name: item.short_name || "",
      kg_per_bag: Number(item.kg_per_bag || 0),
      tp_per_bag: Number(item.tp_per_bag || 0),
      mrp_per_bag: Number(item.mrp_per_bag || 0),
      status: item.status,
      sort_order: item.sort_order,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  async function savePriceItem() {
    if (!canManage) {
      alert("Only Admin or Super Admin can manage price items.");
      return;
    }
    if (!form.item_name.trim()) {
      alert("Item name is required.");
      return;
    }
    if (Number(form.kg_per_bag) <= 0) {
      alert("KG/Bag must be greater than 0.");
      return;
    }

    const payload = {
      category: form.category,
      item_name: form.item_name.trim(),
      short_name: form.short_name.trim(),
      kg_per_bag: Number(form.kg_per_bag),
      tp_per_bag: Number(form.tp_per_bag),
      mrp_per_bag: Number(form.mrp_per_bag),
      status: form.status,
    };

    if (editingId) {
      const { error } = await supabase
        .from("feed_price_list")
        .update(payload)
        .eq("id", editingId);

      if (error) {
        console.error("Price update error:", error);
        alert(`Update failed: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase
        .from("feed_price_list")
        .upsert([payload], { onConflict: "category,item_name" });

      if (error) {
        console.error("Price insert error:", error);
        alert(`Add failed: ${error.message}`);
        return;
      }
    }

    closeForm();
    await loadPriceList();
  }

  async function deleteItem(id?: number) {
    if (!canManage) {
      alert("Only Admin or Super Admin can delete price items.");
      return;
    }
    if (!id) return;

    if (!window.confirm("Delete this price item?")) return;

    const { error } = await supabase
      .from("feed_price_list")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Price delete error:", error);
      alert(`Delete failed: ${error.message}`);
      return;
    }

    await loadPriceList();
  }

  function handleExcelImport(event: React.ChangeEvent<HTMLInputElement>) {
    if (!canManage) {
      alert("Only Admin or Super Admin can import price list.");
      event.target.value = "";
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

        const importData = rows
          .map((row, index) => ({
            category: String(row["Category"] || "").trim(),
            item_name: String(row["Item Name"] || "").trim(),
            short_name: String(row["Short Name"] || "").trim(),
            kg_per_bag: Number(row["KG/Bag"] || 0),
            tp_per_bag: Number(row["TP/Bag"] || 0),
            mrp_per_bag: Number(row["MRP/Bag"] || 0),
            status: String(row["Status"] || "Active").trim(),
            sort_order: index + 1,
          }))
          .filter(
            (item) =>
              item.category && item.item_name && item.kg_per_bag > 0
          );

        if (!importData.length) {
          alert("No valid price list data found.");
          return;
        }

        const { error } = await supabase
          .from("feed_price_list")
          .upsert(importData, {
            onConflict: "category,item_name",
            ignoreDuplicates: false,
          });

        if (error) {
          console.error("Excel import error:", error);
          alert(`Excel import/update failed: ${error.message}`);
          return;
        }

        alert(`${importData.length} items imported/updated successfully.`);
        await loadPriceList();
      } catch (error) {
        console.error("Excel processing error:", error);
        alert("Invalid Excel file.");
      }
    };

    reader.readAsArrayBuffer(file);
    event.target.value = "";
  }


  
   async function exportExcel() {
  if (!filteredItems.length) {
    alert("No data available to export.");
    return;
  }

  if (user?.id) {
    const today = new Date().toISOString().split("T")[0];
    await supabase.from("page_visits").insert([
      {
        user_id: user.id,
        page_name: "Pricelist Download",
        visit_date: today,
      },
    ]);
  }

  const exportData = filteredItems.map((item) => ({
    Category: item.category,
    "Item Name": item.item_name,
    "KG/Bag": Number(item.kg_per_bag),
    "TP/Bag": Number(item.tp_per_bag),
    "TP/KG": Number(item.kg_per_bag) > 0 ? Number(item.tp_per_bag) / Number(item.kg_per_bag) : 0,
    "MRP/Bag": Number(item.mrp_per_bag),
    "MRP/KG": Number(item.kg_per_bag) > 0 ? Number(item.mrp_per_bag) / Number(item.kg_per_bag) : 0,
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  worksheet["!cols"] = [
    { wch: 16 }, { wch: 28 }, { wch: 10 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
  ];

  // Common thin border styling for excel cells
  const thinBorder = {
    top: { style: "thin", color: { rgb: "D1D5DB" } },
    bottom: { style: "thin", color: { rgb: "D1D5DB" } },
    left: { style: "thin", color: { rgb: "D1D5DB" } },
    right: { style: "thin", color: { rgb: "D1D5DB" } },
  };

  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      if (!worksheet[cellAddress]) continue;

      if (R === 0) {
        // Header Row Style with Border
        worksheet[cellAddress].s = {
          font: { bold: true, color: { rgb: "111827" } },
          fill: { patternType: "solid", fgColor: { rgb: "E5E7EB" } },
          alignment: { horizontal: "center", vertical: "center" },
          border: thinBorder,
        };
      } else {
        const item = filteredItems[R - 1];
        if (item) {
          // Full category color for the entire row (No alternating)
          const hexColor = EXCEL_CATEGORY_COLORS[item.category] || "FFFFFF";

          worksheet[cellAddress].s = {
            fill: { patternType: "solid", fgColor: { rgb: hexColor } },
            font: { color: { rgb: "111827" } },
            alignment: { vertical: "center" },
            border: thinBorder,
          };
        }
      }
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Price List");
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array", cellStyles: true });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  // Generate unique timestamp filename (Date + Time)
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  const timestamp = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  saveAs(blob, `Feed_Price_List_${timestamp}.xlsx`);
}



  const toggleBulkCategory = (cat: string) => {
    setSelectedBulkCategories((prev) => {
      const exists = prev.includes(cat);
      if (exists) {
        const updated = prev.filter((c) => c !== cat);
        const copy = { ...categoryConfigs };
        delete copy[cat];
        setCategoryConfigs(copy);
        return updated;
      } else {
        setCategoryConfigs((prevCfg) => ({
          ...prevCfg,
          [cat]: { action: "increase", tpChange: "", mrpChange: "" },
        }));
        return [...prev, cat];
      }
    });
  };

  const handleConfigChange = (cat: string, field: keyof CategoryConfig, value: string) => {
    setCategoryConfigs((prev) => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        [field]: value,
      },
    }));
  };

  const targetBulkItems = useMemo(() => {
    return items.filter((item) => selectedBulkCategories.includes(item.category));
  }, [items, selectedBulkCategories]);

  const handleApplyBulkChanges = () => {
    if (selectedBulkCategories.length === 0) {
      alert("Please select at least one category to update.");
      return;
    }

    let hasAnyValue = false;
    for (const cat of selectedBulkCategories) {
      const cfg = categoryConfigs[cat];
      const tp = parseFloat(cfg?.tpChange || "0");
      const mrp = parseFloat(cfg?.mrpChange || "0");
      if (tp !== 0 || mrp !== 0) {
        hasAnyValue = true;
        break;
      }
    }

    if (!hasAnyValue) {
      alert("Please enter TP or MRP change values (Tk/kg) for selected categories.");
      return;
    }

    const calculations = targetBulkItems.map((item) => {
      const cfg = categoryConfigs[item.category] || { action: "increase", tpChange: "0", mrpChange: "0" };
      const multiplier = cfg.action === "increase" ? 1 : -1;

      const tpChangeKg = parseFloat(cfg.tpChange || "0");
      const mrpChangeKg = parseFloat(cfg.mrpChange || "0");

      const tpBagDiff = tpChangeKg * item.kg_per_bag * multiplier;
      const mrpBagDiff = mrpChangeKg * item.kg_per_bag * multiplier;

      const newTpBag = Math.max(0, Number(item.tp_per_bag) + tpBagDiff);
      const newMrpBag = Math.max(0, Number(item.mrp_per_bag) + mrpBagDiff);

      return {
        ...item,
        cfg,
        tpChangeKg,
        mrpChangeKg,
        tpBagDiff,
        mrpBagDiff,
        newTpBag,
        newMrpBag,
      };
    });

    setPreviewItems(calculations);
    setShowConfirmModal(true);
  };

  const executeBulkUpdate = async () => {
    setIsUpdating(true);
    try {
      const updates = previewItems.map((item) =>
        supabase
          .from("feed_price_list")
          .update({
            tp_per_bag: item.newTpBag,
            mrp_per_bag: item.newMrpBag,
          })
          .eq("id", item.id)
      );

      const results = await Promise.all(updates);
      const errors = results.filter((r) => r.error);

      if (errors.length > 0) {
        throw new Error("Failed to update some price items.");
      }

      alert("Bulk prices updated successfully!");
      setShowConfirmModal(false);
      setShowBulkModal(false);
      setSelectedBulkCategories([]);
      setCategoryConfigs({});
      await loadPriceList();
    } catch (err: any) {
      console.error("Bulk update error:", err);
      alert(err.message || "An error occurred during bulk update.");
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredItems = useMemo(() => {
    const searchText = search.toLowerCase();
    return items.filter((item) => {
      const categoryMatch = categoryFilter === "All" || item.category === categoryFilter;
      const searchMatch =
        item.category.toLowerCase().includes(searchText) ||
        item.item_name.toLowerCase().includes(searchText) ||
        (item.short_name || "").toLowerCase().includes(searchText);

      return categoryMatch && searchMatch;
    });
  }, [items, search, categoryFilter]);

  if (!canView) {
    return (
      <div style={styles.accessDenied}>
        <div style={styles.accessIcon}>🔒</div>
        <div style={styles.accessTitle}>Access Denied</div>
        <div style={styles.accessText}>You do not have permission to view the Price List.</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Price List</h1>
          <p style={styles.subtitle}>Feed price management</p>
        </div>

        <div style={styles.headerButtons}>
          <button style={styles.exportButton} onClick={exportExcel}>
            📤 Download Price List
          </button>

          {canManage && (
            <>
              <button
                style={styles.bulkHeaderButton}
                onClick={() => setShowBulkModal(true)}
              >
                ⚡ Bulk Update Price
              </button>

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
          placeholder="Search item or short name..."
          style={styles.searchInput}
        />
      </div>

      <div style={styles.categoryScroll}>
        <button
          style={{
            ...styles.categoryButton,
            ...(categoryFilter === "All" ? styles.categoryActive : {}),
          }}
          onClick={() => setCategoryFilter("All")}
        >
          All
        </button>

        {categories.map((category) => (
          <button
            key={category}
            style={{
              ...styles.categoryButton,
              ...(categoryFilter === category ? styles.categoryActive : {}),
            }}
            onClick={() => setCategoryFilter(category)}
          >
            {category}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={styles.loading}>Loading...</div>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Item</th>
                <th style={styles.th}>Short Name</th>
                <th style={{ ...styles.th, textAlign: "right" }}>KG/Bag</th>
                <th style={{ ...styles.th, textAlign: "right" }}>TP/Bag</th>
                <th style={{ ...styles.th, textAlign: "right" }}>TP/KG</th>
                <th style={{ ...styles.th, textAlign: "right" }}>MRP/Bag</th>
                <th style={{ ...styles.th, textAlign: "right" }}>MRP/KG</th>
                <th style={styles.th}>Status</th>
                {canManage && <th style={{ ...styles.th, textAlign: "center" }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, index) => {
                const kgPerBag = Number(item.kg_per_bag);
                const tpPerBag = Number(item.tp_per_bag);
                const mrpPerBag = Number(item.mrp_per_bag);
                const tpKg = kgPerBag > 0 ? tpPerBag / kgPerBag : 0;
                const mrpKg = kgPerBag > 0 ? mrpPerBag / kgPerBag : 0;

                // Alternating row color: Even index -> category soft color, Odd index -> white
                const rowBg = index % 2 === 0 ? (CATEGORY_COLORS[item.category] || "#ffffff") : "#ffffff";

                return (
                  <tr key={item.id} style={{ ...styles.tr, background: rowBg }}>
                    <td style={styles.td}>
                      <span style={styles.categoryTag}>{item.category}</span>
                    </td>
                    <td style={{ ...styles.td, fontWeight: 600 }}>{item.item_name}</td>
                    <td style={{ ...styles.td, fontWeight: 700, color: "#2563eb" }}>
                      {item.short_name || "-"}
                    </td>
                    <td style={{ ...styles.td, textAlign: "right" }}>{item.kg_per_bag}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>৳{tpPerBag.toLocaleString()}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>৳{tpKg.toFixed(2)}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>৳{mrpPerBag.toLocaleString()}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>৳{mrpKg.toFixed(2)}</td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.status,
                          ...(item.status === "Active" ? styles.activeStatus : styles.inactiveStatus),
                        }}
                      >
                        {item.status}
                      </span>
                    </td>
                    {canManage && (
                      <td style={{ ...styles.td, textAlign: "center" }}>
                        <div style={styles.actionGroup}>
                          <button style={styles.editButton} onClick={() => openEdit(item)} title="Edit">
                            ✏️
                          </button>
                          <button style={styles.deleteButton} onClick={() => deleteItem(item.id)} title="Delete">
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
          {!filteredItems.length && <div style={styles.noData}>No price items found.</div>}
        </div>
      )}

      {showForm && canManage && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={{ margin: 0 }}>{editingId ? "Edit Price" : "Add Price"}</h2>
              <button style={styles.closeButton} onClick={closeForm}>×</button>
            </div>

            <label style={styles.label}>Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              style={styles.input}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <label style={styles.label}>Item Name</label>
            <input
              value={form.item_name}
              onChange={(e) => setForm({ ...form, item_name: e.target.value })}
              placeholder="Feed item name"
              style={styles.input}
            />

            <label style={styles.label}>Short Name</label>
            <input
              value={form.short_name}
              onChange={(e) => setForm({ ...form, short_name: e.target.value })}
              placeholder="Example: BR-S"
              style={styles.input}
            />
            <div style={styles.helperText}>This short name will be used in the DO Message.</div>

            <label style={styles.label}>KG / Bag</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.kg_per_bag}
              onChange={(e) => setForm({ ...form, kg_per_bag: Number(e.target.value) })}
              style={styles.input}
            />

            <label style={styles.label}>TP / Bag</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.tp_per_bag}
              onChange={(e) => setForm({ ...form, tp_per_bag: Number(e.target.value) })}
              style={styles.input}
            />

            <div style={styles.calculated}>
              TP / KG: ৳{form.kg_per_bag > 0 ? (Number(form.tp_per_bag) / Number(form.kg_per_bag)).toFixed(2) : "0.00"}
            </div>

            <label style={styles.label}>MRP / Bag</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.mrp_per_bag}
              onChange={(e) => setForm({ ...form, mrp_per_bag: Number(e.target.value) })}
              style={styles.input}
            />

            <div style={styles.calculated}>
              MRP / KG: ৳{form.kg_per_bag > 0 ? (Number(form.mrp_per_bag) / Number(form.kg_per_bag)).toFixed(2) : "0.00"}
            </div>

            <label style={styles.label}>Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              style={styles.input}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>

            <button style={styles.saveButton} onClick={savePriceItem}>
              {editingId ? "Update Price" : "Save Price"}
            </button>
          </div>
        </div>
      )}

      {showBulkModal && canManage && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, maxWidth: 680 }}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>⚡ Bulk Price Adjustment</h2>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}>
                  Adjust feed prices per KG across multiple categories
                </p>
              </div>
              <button style={styles.closeButton} onClick={() => setShowBulkModal(false)}>×</button>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={styles.label}>1. Select Categories:</label>
              <div style={styles.checkboxGrid}>
                {categories.map((cat) => {
                  const isChecked = selectedBulkCategories.includes(cat);
                  return (
                    <label
                      key={cat}
                      style={{
                        ...styles.checkboxTile,
                        ...(isChecked ? styles.checkboxTileActive : {}),
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleBulkCategory(cat)}
                        style={{ accentColor: "#111827" }}
                      />
                      <span>{cat}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {selectedBulkCategories.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <label style={styles.label}>2. Category-Wise Rate Adjustments (Tk/kg):</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {selectedBulkCategories.map((cat) => {
                    const cfg = categoryConfigs[cat] || { action: "increase", tpChange: "", mrpChange: "" };
                    return (
                      <div key={cat} style={styles.categoryCard}>
                        <div style={styles.categoryCardHeader}>
                          <span style={styles.categoryCardTitle}>{cat}</span>
                          <select
                            value={cfg.action}
                            onChange={(e) => handleConfigChange(cat, "action", e.target.value)}
                            style={styles.actionSelect}
                          >
                            <option value="increase">📈 Price Increase (+)</option>
                            <option value="decrease">📉 Price Decrease (-)</option>
                          </select>
                        </div>

                        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                          <div style={{ flex: 1 }}>
                            <span style={styles.subInputLabel}>TP Change (Tk/kg):</span>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="e.g. 1.50"
                              value={cfg.tpChange}
                              onChange={(e) => handleConfigChange(cat, "tpChange", e.target.value)}
                              style={styles.input}
                            />
                          </div>

                          <div style={{ flex: 1 }}>
                            <span style={styles.subInputLabel}>MRP Change (Tk/kg):</span>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="e.g. 2.00"
                              value={cfg.mrpChange}
                              onChange={(e) => handleConfigChange(cat, "mrpChange", e.target.value)}
                              style={styles.input}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={styles.label}>Items Selected ({targetBulkItems.length}):</label>
              </div>

              <div style={styles.previewBox}>
                {targetBulkItems.length === 0 ? (
                  <p style={{ color: "#9ca3af", fontSize: 12, margin: 0 }}>
                    No category selected yet. Please check categories above.
                  </p>
                ) : (
                  targetBulkItems.map((item) => (
                    <div key={item.id} style={styles.previewItemRow}>
                      <span style={{ fontWeight: 600 }}>{item.item_name}</span>
                      <span style={{ color: "#4b5563", fontSize: 11 }}>
                        {item.category} • {item.kg_per_bag} kg/bag
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button style={styles.saveButton} onClick={handleApplyBulkChanges}>
              Apply Changes & Preview
            </button>
          </div>
        </div>
      )}

      {showConfirmModal && canManage && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, maxWidth: 750 }}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, color: "#111827", fontWeight: 800 }}>
                  📋 Confirm Bulk Price Update
                </h2>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6b7280" }}>
                  Please review the calculated bag price adjustments before applying to the database.
                </p>
              </div>
              <button style={styles.closeButton} onClick={() => setShowConfirmModal(false)}>×</button>
            </div>

            <div style={{ maxHeight: 360, overflowY: "auto", margin: "14px 0", border: "1px solid #e5e7eb", borderRadius: 8 }}>
              <table style={{ ...styles.table, fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={styles.th}>Item</th>
                    <th style={styles.th}>KG/Bag</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Old TP</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>New TP (Bag)</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Old MRP</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>New MRP (Bag)</th>
                  </tr>
                </thead>
                <tbody>
                  {previewItems.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={styles.td}>
                        <strong>{item.item_name}</strong>
                        <br />
                        <small style={{ color: "#6b7280" }}>{item.category}</small>
                      </td>
                      <td style={styles.td}>{item.kg_per_bag} kg</td>
                      <td style={{ ...styles.td, textAlign: "right", color: "#6b7280" }}>
                        ৳{Number(item.tp_per_bag).toLocaleString()}
                      </td>
                      <td style={{ ...styles.td, textAlign: "right", color: "#2563eb", fontWeight: 700 }}>
                        ৳{item.newTpBag.toLocaleString()}
                        <div style={{ fontSize: 10, color: item.tpBagDiff >= 0 ? "#166534" : "#991b1b" }}>
                          ({item.tpBagDiff >= 0 ? `+৳${item.tpBagDiff}` : `-৳${Math.abs(item.tpBagDiff)}`})
                        </div>
                      </td>
                      <td style={{ ...styles.td, textAlign: "right", color: "#6b7280" }}>
                        ৳{Number(item.mrp_per_bag).toLocaleString()}
                      </td>
                      <td style={{ ...styles.td, textAlign: "right", color: "#16a34a", fontWeight: 700 }}>
                        ৳{item.newMrpBag.toLocaleString()}
                        <div style={{ fontSize: 10, color: item.mrpBagDiff >= 0 ? "#166534" : "#991b1b" }}>
                          ({item.mrpBagDiff >= 0 ? `+৳${item.mrpBagDiff}` : `-৳${Math.abs(item.mrpBagDiff)}`})
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
              <button
                style={{ ...styles.exportButton, padding: "10px 18px" }}
                onClick={() => setShowConfirmModal(false)}
                disabled={isUpdating}
              >
                Back to Edit
              </button>
              <button
                style={{ ...styles.addButton, padding: "10px 22px", background: "#16a34a" }}
                onClick={executeBulkUpdate}
                disabled={isUpdating}
              >
                {isUpdating ? "Updating Prices..." : "✓ Confirm & Save Prices"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 14,
    color: "#111827",
    background: "#f8fafc",
    minHeight: "100vh",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: 23,
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
  bulkHeaderButton: {
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    padding: "9px 12px",
    borderRadius: 9,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(37,99,235,0.2)",
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
  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    padding: "11px 13px",
    borderRadius: 10,
    marginBottom: 10,
  },
  searchInput: {
    border: "none",
    outline: "none",
    background: "#ffffff",
    color: "#111827",
    width: "100%",
    fontSize: 14,
  },
  categoryScroll: {
    display: "flex",
    gap: 7,
    overflowX: "auto",
    paddingBottom: 10,
  },
  categoryButton: {
    flexShrink: 0,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#374151",
    padding: "7px 12px",
    borderRadius: 20,
    fontSize: 12,
    cursor: "pointer",
  },
  categoryActive: {
    background: "#111827",
    color: "#ffffff",
    borderColor: "#111827",
  },
  tableWrapper: {
    width: "100%",
    overflowX: "auto",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,.05)",
  },
  table: {
    width: "100%",
    minWidth: 1050,
    borderCollapse: "collapse",
    fontSize: 13,
    color: "#111827",
  },
  th: {
    position: "sticky",
    top: 0,
    background: "#f3f4f6",
    color: "#374151",
    fontWeight: 700,
    padding: "11px 10px",
    borderBottom: "1px solid #d1d5db",
    textAlign: "left",
    whiteSpace: "nowrap",
  },
  tr: {
    background: "#ffffff",
  },
  td: {
    padding: "11px 10px",
    borderBottom: "1px solid #eef0f2",
    whiteSpace: "nowrap",
    color: "#111827",
  },
  categoryTag: {
    background: "#eef2ff",
    color: "#3730a3",
    padding: "4px 7px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
  },
  status: {
    padding: "4px 7px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
  },
  activeStatus: {
    background: "#dcfce7",
    color: "#166534",
  },
  inactiveStatus: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  actionGroup: {
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
  noData: {
    padding: 35,
    textAlign: "center",
    color: "#6b7280",
  },
  loading: {
    padding: 40,
    textAlign: "center",
    color: "#374151",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.45)",
    backdropFilter: "blur(3px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 16,
  },
  modal: {
    width: "100%",
    maxWidth: 600,
    background: "#ffffff",
    color: "#111827",
    borderRadius: 16,
    padding: 20,
    maxHeight: "90vh",
    overflowY: "auto",
    boxSizing: "border-box",
    boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  closeButton: {
    border: "none",
    background: "#f3f4f6",
    color: "#111827",
    width: 32,
    height: 32,
    borderRadius: "50%",
    fontSize: 20,
    cursor: "pointer",
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 700,
    marginTop: 10,
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
    padding: "9px 11px",
    fontSize: 13,
    outline: "none",
  },
  helperText: {
    marginTop: 5,
    fontSize: 11,
    color: "#6b7280",
  },
  calculated: {
    marginTop: 6,
    background: "#f3f4f6",
    color: "#111827",
    padding: "8px 10px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
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
  checkboxGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
    gap: 8,
    marginTop: 6,
  },
  checkboxTile: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    fontSize: 12,
    cursor: "pointer",
    userSelect: "none",
  },
  checkboxTileActive: {
    background: "#f0fdf4",
    borderColor: "#86efac",
    fontWeight: 600,
  },
  categoryCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: 12,
  },
  categoryCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryCardTitle: {
    fontWeight: 700,
    fontSize: 13,
    color: "#1e293b",
  },
  actionSelect: {
    padding: "4px 8px",
    borderRadius: 6,
    border: "1px solid #cbd5e1",
    fontSize: 12,
    background: "#ffffff",
    color: "#1e293b",
    fontWeight: 600,
  },
  subInputLabel: {
    fontSize: 11,
    color: "#64748b",
    display: "block",
    marginBottom: 4,
  },
  previewBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 10,
    maxHeight: 120,
    overflowY: "auto",
    marginTop: 6,
  },
  previewItemRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    padding: "4px 0",
    borderBottom: "1px dashed #e2e8f0",
  },
  accessDenied: {
    minHeight: "60vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 20,
  },
  accessIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  accessTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: "#111827",
  },
  accessText: {
    marginTop: 5,
    fontSize: 12,
    color: "#6b7280",
  },
};