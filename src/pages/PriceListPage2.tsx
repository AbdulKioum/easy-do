import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import "jspdf-autotable";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

type UserRole = "user" | "admin" | "super_admin";

type PriceItem = {
  id?: number;
  category: string;
  item_name: string;
  short_name: string;
  protein_percentage: number;
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

const TABLE_NAME = "feed_price_list_2";

const categories = [
  "Broiler",
  "Layer",
  "Sonali",
  "Cattle",
  "Fish Floating",
  "Fish Sinking",
];

const CATEGORY_COLORS: Record<string, string> = {
  Broiler: "#fef2f2",
  Layer: "#fefce8",
  Sonali: "#f0fdf4",
  Cattle: "#faf5ff",
  "Fish Floating": "#f0f9ff",
  "Fish Sinking": "#f9fafb",
};

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
  protein_percentage: 0,
  kg_per_bag: 50,
  tp_per_bag: 0,
  mrp_per_bag: 0,
  status: "Active",
};

const COMPACT_PL_CSS = `
  .pl-page { min-height: calc(100vh - 60px); background: #f8fafc; padding: 10px; box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; color: #0f172a; }
  .pl-container { max-width: 1100px; margin: 0 auto; }
  .pl-topbar { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
  .pl-title { margin: 0; font-size: 15px; font-weight: 800; color: #0f172a; letter-spacing: -0.2px; }
  .pl-btn-group { display: flex; gap: 5px; flex-wrap: wrap; }
  
  .pl-action-btn { border: 1px solid #cbd5e1; background: #ffffff; color: #334155; padding: 5px 9px; border-radius: 6px; font-size: 11.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s ease; }
  .pl-action-btn:hover { background: #f1f5f9; border-color: #94a3b8; }
  .pl-primary-btn { background: #0f172a; color: #ffffff; border-color: #0f172a; }
  .pl-primary-btn:hover { background: #1e293b; }
  .pl-bulk-btn { background: #2563eb; color: #ffffff; border-color: #2563eb; }
  .pl-bulk-btn:hover { background: #1d4ed8; }

  .pl-search-bar { display: flex; align-items: center; gap: 6px; background: #ffffff; border: 1px solid #e2e8f0; padding: 6px 10px; border-radius: 8px; margin-bottom: 8px; }
  .pl-search-input { border: none; outline: none; background: transparent; width: 100%; font-size: 12.5px; font-weight: 600; color: #0f172a; }

  .pl-cat-scroll { display: flex; gap: 5px; overflow-x: auto; padding-bottom: 6px; margin-bottom: 8px; scrollbar-width: none; }
  .pl-cat-scroll::-webkit-scrollbar { display: none; }
  .pl-cat-pill { flex-shrink: 0; border: 1px solid #cbd5e1; background: #ffffff; color: #475569; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.15s ease; }
  .pl-cat-pill.active { background: #0f172a; color: #ffffff; border-color: #0f172a; }

  .pl-table-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03); }
  .pl-scroll-wrap { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .pl-table { width: 100%; min-width: 900px; border-collapse: collapse; font-size: 12px; text-align: left; }
  .pl-th { background: #f8fafc; color: #475569; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; padding: 8px 9px; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
  .pl-td { padding: 7px 9px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; color: #0f172a; }
  .pl-tr:hover { background: #f8fafc !important; }

  .pl-tag { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10.5px; font-weight: 700; background: #f1f5f9; color: #334155; white-space: nowrap; }
  .pl-status { padding: 2px 5px; border-radius: 4px; font-size: 10px; font-weight: 800; white-space: nowrap; }
  .pl-status-active { background: #dcfce7; color: #166534; }
  .pl-status-inactive { background: #fee2e2; color: #991b1b; }
  
  .pl-icon-btn { border: 1px solid #e2e8f0; background: #f8fafc; width: 26px; height: 26px; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; justifyContent: center; font-size: 11px; }
  .pl-icon-btn:hover { background: #eff6ff; border-color: #bfdbfe; }
`;

export default function PriceListPage2() {
  const { user, role } = useAuth();
  const currentRole = role as UserRole | null;

  const canManage = currentRole === "admin" || currentRole === "super_admin";
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

  useEffect(() => {
    async function trackPageVisit() {
      if (!user?.id) return;
      const today = new Date().toISOString().split("T")[0];
      await supabase.from("page_visits").insert([
        {
          user_id: user.id,
          page_name: "Pricelist Page 2",
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
      .from(TABLE_NAME)
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Price list 2 load error:", error);
      alert(`Price list 2 load failed: ${error.message}`);
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
      protein_percentage: Number(item.protein_percentage || 0),
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
      protein_percentage: Number(form.protein_percentage),
      kg_per_bag: Number(form.kg_per_bag),
      tp_per_bag: Number(form.tp_per_bag),
      mrp_per_bag: Number(form.mrp_per_bag),
      status: form.status,
    };

    if (editingId) {
      const { error } = await supabase
        .from(TABLE_NAME)
        .update(payload)
        .eq("id", editingId);

      if (error) {
        console.error("Price update error:", error);
        alert(`Update failed: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase
        .from(TABLE_NAME)
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

    const { error } = await supabase.from(TABLE_NAME).delete().eq("id", id);

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
            protein_percentage: Number(row["Protein %"] || 0),
            kg_per_bag: Number(row["KG/Bag"] || 0),
            tp_per_bag: Number(row["TP/Bag"] || 0),
            mrp_per_bag: Number(row["MRP/Bag"] || 0),
            status: String(row["Status"] || "Active").trim(),
            sort_order: index + 1,
          }))
          .filter(
            (item) => item.category && item.item_name && item.kg_per_bag > 0
          );

        if (!importData.length) {
          alert("No valid price list data found.");
          return;
        }

        const { error } = await supabase.from(TABLE_NAME).upsert(importData, {
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
          page_name: "Pricelist 2 Download Excel",
          visit_date: today,
        },
      ]);
    }

    const exportData = filteredItems.map((item) => ({
      Category: item.category,
      "Item Name": item.item_name,
      "Protein %": item.protein_percentage ? Number(item.protein_percentage) : "-",
      "KG/Bag": Number(item.kg_per_bag),
      "TP/Bag": Number(item.tp_per_bag),
      "TP/KG": Number(item.kg_per_bag) > 0 ? Number(item.tp_per_bag) / Number(item.kg_per_bag) : 0,
      "MRP/Bag": Number(item.mrp_per_bag),
      "MRP/KG": Number(item.kg_per_bag) > 0 ? Number(item.mrp_per_bag) / Number(item.kg_per_bag) : 0,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet["!cols"] = [
      { wch: 16 }, { wch: 28 }, { wch: 12 }, { wch: 10 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    ];

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
          worksheet[cellAddress].s = {
            font: { bold: true, color: { rgb: "111827" } },
            fill: { patternType: "solid", fgColor: { rgb: "E5E7EB" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: thinBorder,
          };
        } else {
          const item = filteredItems[R - 1];
          if (item) {
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Price List 2");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array", cellStyles: true });
    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
    saveAs(blob, `Feed_Price_List_2_${timestamp}.xlsx`);
  }

  async function exportPDF() {
    if (!filteredItems.length) {
      alert("No data available to export.");
      return;
    }

    if (user?.id) {
      const today = new Date().toISOString().split("T")[0];
      await supabase.from("page_visits").insert([
        {
          user_id: user.id,
          page_name: "Pricelist 2 Download PDF",
          visit_date: today,
        },
      ]);
    }

    const html2pdf: any = (await import("html2pdf.js")).default;

    const container = document.createElement("div");
    container.style.padding = "5px 8px";
    container.style.fontFamily = "Arial, sans-serif";
    container.style.color = "#111827";
    container.style.backgroundColor = "#ffffff";

    let rowsHtml = "";
    filteredItems.forEach((item) => {
      const kgPerBag = Number(item.kg_per_bag);
      const tpPerBag = Number(item.tp_per_bag);
      const mrpPerBag = Number(item.mrp_per_bag);
      const tpKg = kgPerBag > 0 ? (tpPerBag / kgPerBag).toFixed(2) : "0.00";
      const mrpKg = kgPerBag > 0 ? (mrpPerBag / kgPerBag).toFixed(2) : "0.00";
      const proteinVal = item.protein_percentage ? `${item.protein_percentage}%` : "-";
      const bgHex = EXCEL_CATEGORY_COLORS[item.category] || "ffffff";

      rowsHtml += `
        <tr style="background-color: #${bgHex}; page-break-inside: avoid; break-inside: avoid;">
          <td style="border: 1px solid #cbd5e1; padding: 5px; white-space: nowrap;"><b>${item.category}</b></td>
          <td style="border: 1px solid #cbd5e1; padding: 5px;"><b>${item.item_name}</b></td>
          <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: right; white-space: nowrap;">${proteinVal}</td>
          <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: right; white-space: nowrap;">${item.kg_per_bag}</td>
          <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: right; white-space: nowrap;">${tpPerBag.toLocaleString()}</td>
          <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: right; white-space: nowrap;">${tpKg}</td>
          <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: right; white-space: nowrap;">${mrpPerBag.toLocaleString()}</td>
          <td style="border: 1px solid #cbd5e1; padding: 5px; text-align: right; white-space: nowrap;">${mrpKg}</td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div style="margin-bottom: 8px; border-bottom: 2px solid #111827; padding-bottom: 5px;">
        <h2 style="margin: 0 0 2px 0; font-size: 18px; color: #111827; font-weight: bold;">Feed Price List 2</h2>
        <p style="margin: 0; font-size: 11px; color: #4b5563;">Generated on: ${new Date().toLocaleDateString()}</p>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
        <thead>
          <tr style="background-color: #f1f5f9; color: #111827; page-break-inside: avoid; break-inside: avoid;">
            <th style="border: 1px solid #cbd5e1; padding: 5px; text-align: center; font-weight: bold; font-size: 12px;">Category</th>
            <th style="border: 1px solid #cbd5e1; padding: 5px; text-align: center; font-weight: bold; font-size: 12px;">Item Name</th>
            <th style="border: 1px solid #cbd5e1; padding: 5px; text-align: center; font-weight: bold; font-size: 12px;">Protein %</th>
            <th style="border: 1px solid #cbd5e1; padding: 5px; text-align: center; font-weight: bold; font-size: 12px;">KG/Bag</th>
            <th style="border: 1px solid #cbd5e1; padding: 5px; text-align: center; font-weight: bold; font-size: 12px;">TP/Bag</th>
            <th style="border: 1px solid #cbd5e1; padding: 5px; text-align: center; font-weight: bold; font-size: 12px;">TP/KG</th>
            <th style="border: 1px solid #cbd5e1; padding: 5px; text-align: center; font-weight: bold; font-size: 12px;">MRP/Bag</th>
            <th style="border: 1px solid #cbd5e1; padding: 5px; text-align: center; font-weight: bold; font-size: 12px;">MRP/KG</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;

    const options = {
      margin: 4,
      filename: `Feed_Price_List_2_${timestamp}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    };

    html2pdf().from(container).set(options).save();
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
          .from(TABLE_NAME)
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

      alert("Bulk prices updated successfully in Price List 2!");
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
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 32 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}>Access Denied</div>
      </div>
    );
  }

  return (
    <div className="pl-page">
      <style>{COMPACT_PL_CSS}</style>

      <div className="pl-container">
        {/* COMPACT TOP BAR */}
        <div className="pl-topbar">
          <h1 className="pl-title">Price List 2</h1>

          <div className="pl-btn-group">
            <button className="pl-action-btn" onClick={exportExcel} title="Download Excel">
              📥 Download Excel
            </button>
            <button className="pl-action-btn" onClick={exportPDF} title="Download PDF">
              📄 Download PDF
            </button>

            {canManage && (
              <>
                <button className="pl-action-btn pl-bulk-btn" onClick={() => setShowBulkModal(true)}>
                  ⚡ Adjust Price
                </button>
                <button className="pl-action-btn" onClick={() => fileInputRef.current?.click()}>
                  📤 Import
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: "none" }}
                  onChange={handleExcelImport}
                />
                <button className="pl-action-btn pl-primary-btn" onClick={openAdd}>
                  ＋ Add
                </button>
              </>
            )}
          </div>
        </div>

        {/* COMPACT SEARCH BAR */}
        <div className="pl-search-bar">
          <span>🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item or short name..."
            className="pl-search-input"
          />
        </div>

        {/* COMPACT CATEGORY PILLS */}
        <div className="pl-cat-scroll">
          <button
            className={`pl-cat-pill ${categoryFilter === "All" ? "active" : ""}`}
            onClick={() => setCategoryFilter("All")}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category}
              className={`pl-cat-pill ${categoryFilter === category ? "active" : ""}`}
              onClick={() => setCategoryFilter(category)}
            >
              {category}
            </button>
          ))}
        </div>

        {/* COMPACT TABLE */}
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "#64748b", fontSize: 12.5 }}>
            Loading price list 2...
          </div>
        ) : (
          <div className="pl-table-card">
            <div className="pl-scroll-wrap">
              <table className="pl-table">
                <thead>
                  <tr>
                    <th className="pl-th" style={{ width: "110px" }}>Category</th>
                    <th className="pl-th" style={{ minWidth: "220px" }}>Item Name</th>
                    <th className="pl-th" style={{ textAlign: "right", width: "70px" }}>Protein</th>
                    <th className="pl-th" style={{ width: "70px" }}>Short</th>
                    <th className="pl-th" style={{ textAlign: "right", width: "70px" }}>Bag(KG)</th>
                    <th className="pl-th" style={{ textAlign: "right", width: "80px" }}>TP/Bag</th>
                    <th className="pl-th" style={{ textAlign: "right", width: "75px" }}>TP/KG</th>
                    <th className="pl-th" style={{ textAlign: "right", width: "80px" }}>MRP/Bag</th>
                    <th className="pl-th" style={{ textAlign: "right", width: "75px" }}>MRP/KG</th>
                    <th className="pl-th" style={{ width: "70px" }}>Status</th>
                    {canManage && <th className="pl-th" style={{ textAlign: "center", width: "70px" }}>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, index) => {
                    const kgPerBag = Number(item.kg_per_bag);
                    const tpPerBag = Number(item.tp_per_bag);
                    const mrpPerBag = Number(item.mrp_per_bag);
                    const tpKg = kgPerBag > 0 ? tpPerBag / kgPerBag : 0;
                    const mrpKg = kgPerBag > 0 ? mrpPerBag / kgPerBag : 0;

                    const rowBg = index % 2 === 0 ? (CATEGORY_COLORS[item.category] || "#ffffff") : "#ffffff";

                    return (
                      <tr key={item.id} className="pl-tr" style={{ background: rowBg }}>
                        <td className="pl-td" style={{ whiteSpace: "nowrap" }}>
                          <span className="pl-tag">{item.category}</span>
                        </td>
                        <td className="pl-td" style={{ fontWeight: 700, whiteSpace: "normal", wordBreak: "break-word" }}>
                          {item.item_name}
                        </td>
                        <td className="pl-td" style={{ textAlign: "right", color: "#475569", whiteSpace: "nowrap" }}>
                          {item.protein_percentage ? `${item.protein_percentage}%` : "-"}
                        </td>
                        <td className="pl-td" style={{ fontWeight: 700, color: "#2563eb", whiteSpace: "nowrap" }}>
                          {item.short_name || "-"}
                        </td>
                        <td className="pl-td" style={{ textAlign: "right", whiteSpace: "nowrap" }}>{item.kg_per_bag}</td>
                        <td className="pl-td" style={{ textAlign: "right", fontWeight: 750, whiteSpace: "nowrap" }}>৳{tpPerBag.toLocaleString()}</td>
                        <td className="pl-td" style={{ textAlign: "right", color: "#64748b", whiteSpace: "nowrap" }}>৳{tpKg.toFixed(2)}</td>
                        <td className="pl-td" style={{ textAlign: "right", fontWeight: 750, color: "#16a34a", whiteSpace: "nowrap" }}>৳{mrpPerBag.toLocaleString()}</td>
                        <td className="pl-td" style={{ textAlign: "right", color: "#64748b", whiteSpace: "nowrap" }}>৳{mrpKg.toFixed(2)}</td>
                        <td className="pl-td" style={{ whiteSpace: "nowrap" }}>
                          <span
                            className={`pl-status ${item.status === "Active" ? "pl-status-active" : "pl-status-inactive"}`}
                          >
                            {item.status}
                          </span>
                        </td>
                        {canManage && (
                          <td className="pl-td" style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                            <div style={{ display: "inline-flex", gap: 4 }}>
                              <button className="pl-icon-btn" onClick={() => openEdit(item)} title="Edit">
                                ✏️
                              </button>
                              <button className="pl-icon-btn" style={{ background: "#fef2f2", borderColor: "#fecaca" }} onClick={() => deleteItem(item.id)} title="Delete">
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
                  No price items found.
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
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{editingId ? "Edit Price (List 2)" : "Add Price (List 2)"}</h3>
              <button style={modalStyles.closeBtn} onClick={closeForm}>×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "72vh", overflowY: "auto", paddingRight: 4 }}>
              <div>
                <label style={modalStyles.label}>Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  style={modalStyles.input}
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={modalStyles.label}>Item Name</label>
                <input
                  value={form.item_name}
                  onChange={(e) => setForm({ ...form, item_name: e.target.value })}
                  placeholder="Feed item name"
                  style={modalStyles.input}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={modalStyles.label}>Protein %</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.protein_percentage}
                    onChange={(e) => setForm({ ...form, protein_percentage: Number(e.target.value) })}
                    placeholder="e.g. 20.5"
                    style={modalStyles.input}
                  />
                </div>
                <div>
                  <label style={modalStyles.label}>Short Name</label>
                  <input
                    value={form.short_name}
                    onChange={(e) => setForm({ ...form, short_name: e.target.value })}
                    placeholder="e.g. BR-S"
                    style={modalStyles.input}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={modalStyles.label}>KG / Bag</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.kg_per_bag}
                    onChange={(e) => setForm({ ...form, kg_per_bag: Number(e.target.value) })}
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
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={modalStyles.label}>TP / Bag (৳)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.tp_per_bag}
                    onChange={(e) => setForm({ ...form, tp_per_bag: Number(e.target.value) })}
                    style={modalStyles.input}
                  />
                  <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 2 }}>
                    TP/KG: ৳{form.kg_per_bag > 0 ? (Number(form.tp_per_bag) / Number(form.kg_per_bag)).toFixed(2) : "0.00"}
                  </div>
                </div>
                <div>
                  <label style={modalStyles.label}>MRP / Bag (৳)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.mrp_per_bag}
                    onChange={(e) => setForm({ ...form, mrp_per_bag: Number(e.target.value) })}
                    style={modalStyles.input}
                  />
                  <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 2 }}>
                    MRP/KG: ৳{form.kg_per_bag > 0 ? (Number(form.mrp_per_bag) / Number(form.kg_per_bag)).toFixed(2) : "0.00"}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, marginTop: 12, justifyContent: "flex-end" }}>
              <button onClick={closeForm} style={modalStyles.cancelBtn}>Cancel</button>
              <button onClick={savePriceItem} style={modalStyles.saveBtn}>
                {editingId ? "Update Price" : "Save Price"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK ADJUST MODAL */}
      {showBulkModal && canManage && (
        <div style={modalStyles.overlay}>
          <div style={{ ...modalStyles.modal, maxWidth: 540 }}>
            <div style={modalStyles.header}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>⚡ Price Adjustment (List 2)</h3>
              <button style={modalStyles.closeBtn} onClick={() => setShowBulkModal(false)}>×</button>
            </div>

            <div style={{ maxHeight: "72vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 4 }}>
              <div>
                <label style={modalStyles.label}>1. Select Categories</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 5, marginTop: 4 }}>
                  {categories.map((cat) => {
                    const isChecked = selectedBulkCategories.includes(cat);
                    return (
                      <label
                        key={cat}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: `1px solid ${isChecked ? "#93c5fd" : "#cbd5e1"}`,
                          background: isChecked ? "#eff6ff" : "#ffffff",
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleBulkCategory(cat)}
                          style={{ accentColor: "#2563eb" }}
                        />
                        <span>{cat}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {selectedBulkCategories.length > 0 && (
                <div>
                  <label style={modalStyles.label}>2. Rate Adjustments (Tk/kg)</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                    {selectedBulkCategories.map((cat) => {
                      const cfg = categoryConfigs[cat] || { action: "increase", tpChange: "", mrpChange: "" };
                      return (
                        <div key={cat} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{cat}</span>
                            <select
                              value={cfg.action}
                              onChange={(e) => handleConfigChange(cat, "action", e.target.value)}
                              style={{ ...modalStyles.input, width: 130, height: 28, fontSize: 11 }}
                            >
                              <option value="increase">Increase (+)</option>
                              <option value="decrease">Decrease (-)</option>
                            </select>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="TP change Tk/kg"
                              value={cfg.tpChange}
                              onChange={(e) => handleConfigChange(cat, "tpChange", e.target.value)}
                              style={modalStyles.input}
                            />
                            <input
                              type="number"
                              step="0.01"
                              placeholder="MRP change Tk/kg"
                              value={cfg.mrpChange}
                              onChange={(e) => handleConfigChange(cat, "mrpChange", e.target.value)}
                              style={modalStyles.input}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 6, marginTop: 12, justifyContent: "flex-end" }}>
              <button style={modalStyles.cancelBtn} onClick={() => setShowBulkModal(false)}>Cancel</button>
              <button style={modalStyles.saveBtn} onClick={handleApplyBulkChanges}>Preview Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM BULK MODAL */}
      {showConfirmModal && canManage && (
        <div style={modalStyles.overlay}>
          <div style={{ ...modalStyles.modal, maxWidth: 600 }}>
            <div style={modalStyles.header}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>📋 Confirm Bulk Price Update (List 2)</h3>
              <button style={modalStyles.closeBtn} onClick={() => setShowConfirmModal(false)}>×</button>
            </div>

            <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8, margin: "8px 0" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: 6 }}>Item</th>
                    <th style={{ padding: 6, textAlign: "right" }}>Old TP</th>
                    <th style={{ padding: 6, textAlign: "right" }}>New TP (Bag)</th>
                    <th style={{ padding: 6, textAlign: "right" }}>Old MRP</th>
                    <th style={{ padding: 6, textAlign: "right" }}>New MRP (Bag)</th>
                  </tr>
                </thead>
                <tbody>
                  {previewItems.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: 6 }}>
                        <b>{item.item_name}</b> <small style={{ color: "#64748b" }}>({item.category})</small>
                      </td>
                      <td style={{ padding: 6, textAlign: "right", color: "#64748b" }}>৳{Number(item.tp_per_bag).toLocaleString()}</td>
                      <td style={{ padding: 6, textAlign: "right", fontWeight: 700, color: "#2563eb" }}>
                        ৳{item.newTpBag.toLocaleString()}
                      </td>
                      <td style={{ padding: 6, textAlign: "right", color: "#64748b" }}>৳{Number(item.mrp_per_bag).toLocaleString()}</td>
                      <td style={{ padding: 6, textAlign: "right", fontWeight: 700, color: "#16a34a" }}>
                        ৳{item.newMrpBag.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button style={modalStyles.cancelBtn} onClick={() => setShowConfirmModal(false)} disabled={isUpdating}>
                Back
              </button>
              <button style={modalStyles.saveBtn} onClick={executeBulkUpdate} disabled={isUpdating}>
                {isUpdating ? "Updating..." : "✓ Confirm & Save"}
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