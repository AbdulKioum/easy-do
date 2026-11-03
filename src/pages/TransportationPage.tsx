import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
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

type MatrixDistrictGroup = {
  districtIndex: number;
  district: string;
  stations: {
    stationIndex: number;
    upazila: string;
    rates: Record<string, { sinking?: number; floating?: number }>;
  }[];
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

const PROFESSIONAL_CSS = `
  .tp-page { min-height: 100vh; background: #f8fafc; padding: 16px; color: #0f172a; box-sizing: border-box; font-family: 'Inter', system-ui, -apple-system, sans-serif; }
  .tp-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; background: #ffffff; padding: 16px 20px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
  .tp-title { margin: 0; font-size: 21px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
  .tp-subtitle { margin: 4px 0 0; font-size: 12.5px; color: #64748b; font-weight: 500; }
  .tp-btn-group { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .tp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 14px; border-radius: 8px; font-size: 12.5px; font-weight: 700; cursor: pointer; transition: all 0.15s ease; white-space: nowrap; border: 1px solid #cbd5e1; background: #ffffff; color: #1e293b; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
  .tp-btn:hover { background: #f1f5f9; border-color: #94a3b8; }
  .tp-btn:active { transform: scale(0.97); }
  .tp-btn-excel { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
  .tp-btn-excel:hover { background: #dcfce7; }
  .tp-btn-pdf { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
  .tp-btn-pdf:hover { background: #fee2e2; }
  .tp-btn-import { background: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; }
  .tp-btn-import:hover { background: #dbeafe; }
  .tp-btn-add { background: #0f172a; border-color: #0f172a; color: #ffffff; }
  .tp-btn-add:hover { background: #1e293b; }
  .tp-toolbar { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
  .tp-search { display: flex; align-items: center; gap: 10px; background: #ffffff; border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
  .tp-search input { border: none; outline: none; background: transparent; color: #0f172a; width: 100%; font-size: 13.5px; font-weight: 500; }
  .tp-filters { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
  .tp-filter-pill { flex-shrink: 0; border: 1px solid #cbd5e1; background: #ffffff; color: #475569; padding: 7px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; }
  .tp-filter-pill.active { background: #0f172a; color: #ffffff; border-color: #0f172a; box-shadow: 0 2px 5px rgba(15,23,42,0.2); }
  .tp-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.03); }
  .tp-card-top { padding: 12px 16px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; font-size: 12.5px; font-weight: 700; color: #334155; }
  .tp-table-scroll { width: 100%; overflow-x: auto; }
  .tp-table { width: 100%; min-width: 720px; border-collapse: collapse; font-size: 13px; color: #0f172a; }
  .tp-th { background: #f1f5f9; color: #334155; font-weight: 700; padding: 11px 12px; border-bottom: 1px solid #cbd5e1; text-align: left; white-space: nowrap; font-size: 12px; letter-spacing: 0.01em; }
  .tp-td { padding: 11px 12px; border-bottom: 1px solid #f1f5f9; white-space: nowrap; vertical-align: middle; }
  .tp-sticky-col { position: sticky; left: 0; z-index: 2; box-shadow: 2px 0 4px -2px rgba(0,0,0,0.06); }
  
  @media (max-width: 640px) {
    .tp-page { padding: 10px; }
    .tp-header { padding: 12px; flex-direction: column; align-items: stretch; }
    .tp-btn-group { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; width: 100%; }
    .tp-btn { width: 100%; padding: 9px 8px; font-size: 11.5px; }
  }
`;

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

  const upazilaDistrictMap = useMemo(() => {
    const map = new Map<string, string>();
    upazilas.forEach((u) => {
      if (u.upazila_name) {
        map.set(u.upazila_name.trim().toLowerCase(), u.district || "Other");
      }
    });
    return map;
  }, [upazilas]);

  function getDistrictName(upazilaName: string) {
    return upazilaDistrictMap.get((upazilaName || "").trim().toLowerCase()) || "Other";
  }

  const filteredUpazilaList = useMemo(() => {
    const activeUpazilas = upazilas.filter((u) => u.status === "Active");
    if (isSuperAdmin) return activeUpazilas;
    if (!assignedDistricts.length) return [];

    const lowerDistricts = assignedDistricts.map((d) => d.toLowerCase());
    return activeUpazilas.filter((u) =>
      lowerDistricts.includes((u.district || "").trim().toLowerCase())
    );
  }, [upazilas, assignedDistricts, isSuperAdmin]);

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

        const excelMap = new Map<string, Omit<Transportation, "id">>();
        rows.forEach((row) => {
          const from_location = String(row["From"] || row["from_location"] || "").trim();
          const to_upazila = String(row["Upazila"] || row["To / Upazila"] || row["to_upazila"] || "").trim();
          const floating_cattle_rate_per_kg = Number(
            row["Floating & Cattle (৳/KG)"] ?? row["floating_cattle_rate_per_kg"] ?? 0
          );
          const sinking_broiler_layer_sonali_rate_per_kg = Number(
            row["Sinking & Broiler & Layer & Sonali (৳/KG)"] ??
              row["sinking_broiler_layer_sonali_rate_per_kg"] ??
              0
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

  const filteredItems = useMemo(() => {
    const searchText = search.toLowerCase().trim();
    return visibleItems.filter((item) => {
      const dist = getDistrictName(item.to_upazila).toLowerCase();
      const matchesFrom = fromFilter === "All" || item.from_location === fromFilter;
      const matchesSearch =
        item.from_location.toLowerCase().includes(searchText) ||
        item.to_upazila.toLowerCase().includes(searchText) ||
        dist.includes(searchText);
      return matchesFrom && matchesSearch;
    });
  }, [visibleItems, search, fromFilter, upazilaDistrictMap]);

  // BUILD MATRIX DATA STRUCTURE
  function buildMatrixData(): {
    fromCols: string[];
    groups: MatrixDistrictGroup[];
    totalStationRows: number;
  } {
    const fromCols = Array.from(
      new Set(filteredItems.map((i) => i.from_location).filter(Boolean))
    );

    const distMap = new Map<
      string,
      Map<string, Record<string, { sinking?: number; floating?: number }>>
    >();

    filteredItems.forEach((item) => {
      const dist = getDistrictName(item.to_upazila);
      if (!distMap.has(dist)) {
        distMap.set(dist, new Map());
      }
      const upzMap = distMap.get(dist)!;
      const upzName = item.to_upazila.trim();
      if (!upzMap.has(upzName)) {
        upzMap.set(upzName, {});
      }
      const rateObj = upzMap.get(upzName)!;
      rateObj[item.from_location] = {
        sinking: Number(item.sinking_broiler_layer_sonali_rate_per_kg),
        floating: Number(item.floating_cattle_rate_per_kg),
      };
    });

    const sortedDistricts = Array.from(distMap.keys()).sort((a, b) =>
      a.localeCompare(b)
    );

    let totalStationRows = 0;
    const groups: MatrixDistrictGroup[] = sortedDistricts.map((dist, dIdx) => {
      const upzMap = distMap.get(dist)!;
      const sortedUpazilas = Array.from(upzMap.keys()).sort((a, b) =>
        a.localeCompare(b)
      );

      const stations = sortedUpazilas.map((upz, sIdx) => {
        totalStationRows++;
        return {
          stationIndex: sIdx + 1,
          upazila: upz,
          rates: upzMap.get(upz)!,
        };
      });

      return {
        districtIndex: dIdx + 1,
        district: dist,
        stations,
      };
    });

    return { fromCols, groups, totalStationRows };
  }

  // PROFESSIONAL PASTEL THEMES
  const MILL_THEMES = [
    { header: "DBEAFE", subSink: "EFF6FF", subFloat: "E0F2FE", cellSink: "F8FAFC", cellFloat: "F0F9FF" },
    { header: "DCFCE7", subSink: "F0FDF4", subFloat: "ECFDF5", cellSink: "F7FEE7", cellFloat: "F0FDF4" },
    { header: "FEF3C7", subSink: "FFFBEB", subFloat: "FEF9C3", cellSink: "FFFBEB", cellFloat: "FEFCE8" },
    { header: "F3E8FF", subSink: "FAF5FF", subFloat: "F5F3FF", cellSink: "FAF5FF", cellFloat: "F5F3FF" },
    { header: "FFE4E6", subSink: "FFF1F2", subFloat: "FCE7F3", cellSink: "FFF1F2", cellFloat: "FDF2F8" },
  ];

  const DISTRICT_PASTELS = ["F1F5F9", "EFF6FF", "F0FDF4", "FFFBEB", "FAF5FF", "ECFEFF"];

  // PROFESSIONAL FORMATTED EXCEL EXPORT
  async function exportExcel() {
    if (!filteredItems.length) {
      alert("No transportation data available to export.");
      return;
    }

    const { fromCols, groups } = buildMatrixData();
    const aoa: any[][] = [];
    const merges: XLSX.Range[] = [];
    const rowDistrictMap: Record<number, number> = {};

    const totalCols = 4 + fromCols.length * 2;

    const titleRow = new Array(totalCols).fill("");
    titleRow[0] = "NOURISH POULTRY & HATCHERY LTD. — TRANSPORTATION RATE CHART";
    aoa.push(titleRow);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });

    const headerRow1 = ["Sl. No.", "District", "Sl. No.", "Station"];
    const headerRow2 = ["", "", "", ""];

    merges.push({ s: { r: 1, c: 0 }, e: { r: 2, c: 0 } });
    merges.push({ s: { r: 1, c: 1 }, e: { r: 2, c: 1 } });
    merges.push({ s: { r: 1, c: 2 }, e: { r: 2, c: 2 } });
    merges.push({ s: { r: 1, c: 3 }, e: { r: 2, c: 3 } });

    fromCols.forEach((loc, idx) => {
      const startCol = 4 + idx * 2;
      headerRow1.push(loc, "");
      headerRow2.push("Poultry/\nSinking", "Floating/\nCattle");
      merges.push({ s: { r: 1, c: startCol }, e: { r: 1, c: startCol + 1 } });
    });

    aoa.push(headerRow1);
    aoa.push(headerRow2);

    let currentRow = 3;
    groups.forEach((grp, gIdx) => {
      const startRow = currentRow;
      grp.stations.forEach((st, sIdx) => {
        rowDistrictMap[currentRow] = gIdx;

        const row: any[] = [
          sIdx === 0 ? grp.districtIndex : "",
          sIdx === 0 ? grp.district : "",
          st.stationIndex,
          st.upazila,
        ];

        fromCols.forEach((loc) => {
          const r = st.rates[loc];
          row.push(
            r?.sinking !== undefined ? Number(r.sinking.toFixed(2)) : "",
            r?.floating !== undefined ? Number(r.floating.toFixed(2)) : ""
          );
        });

        aoa.push(row);
        currentRow++;
      });

      const endRow = currentRow - 1;
      if (endRow > startRow) {
        merges.push({ s: { r: startRow, c: 0 }, e: { r: endRow, c: 0 } });
        merges.push({ s: { r: startRow, c: 1 }, e: { r: endRow, c: 1 } });
      }
    });

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    worksheet["!merges"] = merges;

    const colsConfig = [{ wch: 8 }, { wch: 18 }, { wch: 8 }, { wch: 22 }];
    fromCols.forEach(() => {
      colsConfig.push({ wch: 13 }, { wch: 13 });
    });
    worksheet["!cols"] = colsConfig;

    const borderAll = {
      top: { style: "thin", color: { rgb: "94A3B8" } },
      bottom: { style: "thin", color: { rgb: "94A3B8" } },
      left: { style: "thin", color: { rgb: "94A3B8" } },
      right: { style: "thin", color: { rgb: "94A3B8" } },
    };

    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (!worksheet[addr]) worksheet[addr] = { t: "s", v: "" };

        if (R === 0) {
          worksheet[addr].s = {
            font: { name: "Arial", bold: true, sz: 13, color: { rgb: "FFFFFF" } },
            fill: { patternType: "solid", fgColor: { rgb: "0F172A" } },
            alignment: { horizontal: "center", vertical: "center" },
          };
        } else if (R === 1) {
          const isLeftHeader = C < 4;
          const millIdx = Math.floor((C - 4) / 2);
          const theme = MILL_THEMES[millIdx % MILL_THEMES.length];

          worksheet[addr].s = {
            font: { name: "Arial", bold: true, sz: 10.5, color: { rgb: "0F172A" } },
            fill: { patternType: "solid", fgColor: { rgb: isLeftHeader ? "E2E8F0" : theme.header } },
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            border: borderAll,
          };
        } else if (R === 2) {
          const isLeftHeader = C < 4;
          const millIdx = Math.floor((C - 4) / 2);
          const isFloatingCol = (C - 4) % 2 === 1;
          const theme = MILL_THEMES[millIdx % MILL_THEMES.length];

          worksheet[addr].s = {
            font: {
              name: "Arial",
              bold: true,
              sz: 9.5,
              color: { rgb: isLeftHeader ? "0F172A" : isFloatingCol ? "1D4ED8" : "047857" },
            },
            fill: {
              patternType: "solid",
              fgColor: { rgb: isLeftHeader ? "E2E8F0" : isFloatingCol ? theme.subFloat : theme.subSink },
            },
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            border: borderAll,
          };
        } else {
          const dIdx = rowDistrictMap[R] ?? 0;
          const distBg = DISTRICT_PASTELS[dIdx % DISTRICT_PASTELS.length];
          const isEvenStation = R % 2 === 0;

          let cellBg = isEvenStation ? "FFFFFF" : "F8FAFC";
          let fontColor = "0F172A";

          if (C === 0 || C === 1) cellBg = distBg;
          else if (C >= 4) {
            const millIdx = Math.floor((C - 4) / 2);
            const isFloatingCol = (C - 4) % 2 === 1;
            const theme = MILL_THEMES[millIdx % MILL_THEMES.length];
            cellBg = isFloatingCol ? theme.cellFloat : theme.cellSink;
            fontColor = isFloatingCol ? "1E40AF" : "065F46";
          }

          const isRateCol = C >= 4;
          const isStationCol = C === 3;

          worksheet[addr].s = {
            font: {
              name: "Arial",
              sz: 10,
              bold: C === 1 || isStationCol || isRateCol,
              color: { rgb: fontColor },
            },
            fill: { patternType: "solid", fgColor: { rgb: cellBg } },
            alignment: { horizontal: isStationCol ? "left" : "center", vertical: "center" },
            border: borderAll,
            ...(isRateCol && typeof worksheet[addr].v === "number" ? { numFmt: "0.00" } : {}),
          };
        }
      }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transport Chart");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array", cellStyles: true });
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    saveAs(blob, `Transportation_Chart_${timestamp}.xlsx`);
  }

  // PROFESSIONAL LANDSCAPE PDF EXPORT
  async function exportPDF() {
    if (!filteredItems.length) {
      alert("No transportation data available to export.");
      return;
    }

    const html2pdf: any = (await import("html2pdf.js")).default;
    const { fromCols, groups, totalStationRows } = buildMatrixData();

    const fontSize = totalStationRows > 45 ? "7px" : totalStationRows > 34 ? "8px" : totalStationRows > 24 ? "9px" : "10px";
    const cellPad = totalStationRows > 45 ? "2px 3px" : totalStationRows > 34 ? "2.5px 4px" : "3.5px 5px";

    let millHeadersHtml = "";
    let subHeadersHtml = "";

    fromCols.forEach((loc, idx) => {
      const theme = MILL_THEMES[idx % MILL_THEMES.length];
      millHeadersHtml += `
        <th colspan="2" style="border: 1px solid #64748b; padding: ${cellPad}; text-align: center; font-weight: 800; background: #${theme.header}; color: #0f172a; font-family: Arial, sans-serif;">
          ${loc}
        </th>
      `;
      subHeadersHtml += `
        <th style="border: 1px solid #64748b; padding: ${cellPad}; text-align: center; font-weight: 700; background: #${theme.subSink}; color: #065f46; font-family: Arial, sans-serif;">
          Poultry/<br/>Sinking
        </th>
        <th style="border: 1px solid #64748b; padding: ${cellPad}; text-align: center; font-weight: 700; background: #${theme.subFloat}; color: #1e40af; font-family: Arial, sans-serif;">
          Floating/<br/>Cattle
        </th>
      `;
    });

    let bodyRowsHtml = "";
    groups.forEach((grp, gIdx) => {
      const span = grp.stations.length;
      const distBg = DISTRICT_PASTELS[gIdx % DISTRICT_PASTELS.length];

      grp.stations.forEach((st, sIdx) => {
        const stationBg = sIdx % 2 === 0 ? "#ffffff" : "#f8fafc";

        let rateCells = "";
        fromCols.forEach((loc, mIdx) => {
          const theme = MILL_THEMES[mIdx % MILL_THEMES.length];
          const r = st.rates[loc];
          const sinkTxt = r?.sinking !== undefined ? r.sinking.toFixed(2) : "—";
          const floatTxt = r?.floating !== undefined ? r.floating.toFixed(2) : "—";

          rateCells += `
            <td style="border: 1px solid #94a3b8; padding: ${cellPad}; text-align: center; font-weight: 700; background: #${theme.cellSink}; color: #065f46; font-family: Arial, sans-serif;">
              ${sinkTxt}
            </td>
            <td style="border: 1px solid #94a3b8; padding: ${cellPad}; text-align: center; font-weight: 700; background: #${theme.cellFloat}; color: #1e40af; font-family: Arial, sans-serif;">
              ${floatTxt}
            </td>
          `;
        });

        bodyRowsHtml += `
          <tr>
            ${
              sIdx === 0
                ? `<td rowspan="${span}" style="border: 1px solid #64748b; padding: ${cellPad}; text-align: center; vertical-align: middle; font-weight: 700; background: #${distBg}; color: #334155; font-family: Arial, sans-serif;">
                     ${grp.districtIndex}
                   </td>
                   <td rowspan="${span}" style="border: 1px solid #64748b; padding: ${cellPad}; text-align: center; vertical-align: middle; font-weight: 800; background: #${distBg}; color: #0f172a; font-family: Arial, sans-serif;">
                     ${grp.district}
                   </td>`
                : ""
            }
            <td style="border: 1px solid #94a3b8; padding: ${cellPad}; text-align: center; background: ${stationBg}; color: #475569; font-family: Arial, sans-serif;">
              ${st.stationIndex}
            </td>
            <td style="border: 1px solid #94a3b8; padding: ${cellPad}; text-align: left; font-weight: 700; white-space: nowrap; background: ${stationBg}; color: #0f172a; font-family: Arial, sans-serif;">
              ${st.upazila}
            </td>
            ${rateCells}
          </tr>
        `;
      });
    });

    const regionTitle = assignedDistricts.length > 0
      ? `${assignedDistricts.join(" / ").toUpperCase()} REGION`
      : "ALL REGIONS — TRANSPORTATION RATE CHART";

    const container = document.createElement("div");
    container.style.padding = "6px 10px";
    container.style.fontFamily = "Arial, sans-serif";
    container.style.color = "#0f172a";
    container.style.backgroundColor = "#ffffff";
    container.style.width = "100%";
    container.style.boxSizing = "border-box";

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 6px 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px;">
        <div style="font-size: 16px; font-weight: 900; letter-spacing: 1px; color: #166534; font-family: Arial, sans-serif;">
          NOURISH
        </div>
        <div style="font-size: 13px; font-weight: 800; text-align: center; color: #0f172a; text-transform: uppercase; font-family: Arial, sans-serif;">
          ${regionTitle}
        </div>
        <div style="font-size: 9.5px; color: #475569; text-align: right; font-weight: 600; font-family: Arial, sans-serif;">
          Date: ${new Date().toLocaleDateString("en-GB")}
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #475569; font-size: ${fontSize};">
        <thead>
          <tr>
            <th rowspan="2" style="border: 1px solid #64748b; padding: ${cellPad}; text-align: center; width: 34px; background: #e2e8f0; color: #0f172a; font-family: Arial, sans-serif;">Sl. No.</th>
            <th rowspan="2" style="border: 1px solid #64748b; padding: ${cellPad}; text-align: center; width: 95px; background: #e2e8f0; color: #0f172a; font-family: Arial, sans-serif;">District</th>
            <th rowspan="2" style="border: 1px solid #64748b; padding: ${cellPad}; text-align: center; width: 34px; background: #e2e8f0; color: #0f172a; font-family: Arial, sans-serif;">Sl. No.</th>
            <th rowspan="2" style="border: 1px solid #64748b; padding: ${cellPad}; text-align: left; width: 130px; background: #e2e8f0; color: #0f172a; font-family: Arial, sans-serif;">Station</th>
            ${millHeadersHtml}
          </tr>
          <tr>
            ${subHeadersHtml}
          </tr>
        </thead>
        <tbody>
          ${bodyRowsHtml}
        </tbody>
      </table>
    `;

    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const options = {
      margin: 5,
      filename: `Transportation_Chart_${timestamp}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
    };

    html2pdf().from(container).set(options).save();
  }

  const isPageLoading = loading || upazilaLoading || profileLoading;

  return (
    <div className="tp-page">
      <style>{PROFESSIONAL_CSS}</style>

      {/* HEADER */}
      <div className="tp-header">
        <div>
          <h1 className="tp-title">🚚 Transportation Rates</h1>
          <p className="tp-subtitle">
            {isSuperAdmin
              ? "Manage all mill & depot transport rates"
              : `Assigned Districts: ${assignedDistricts.join(", ") || "None"}`}
          </p>
        </div>

        <div className="tp-btn-group">
          <button className="tp-btn tp-btn-excel" onClick={exportExcel}>
            📊 Download Excel
          </button>
          <button className="tp-btn tp-btn-pdf" onClick={exportPDF}>
            📄 Download PDF
          </button>

          {canManage && (
            <>
              <button
                className="tp-btn tp-btn-import"
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
              <button className="tp-btn tp-btn-add" onClick={openAdd}>
                + Add Rate
              </button>
            </>
          )}
        </div>
      </div>

      {/* SEARCH & FILTERS */}
      <div className="tp-toolbar">
        <div className="tp-search">
          <span>🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Upazila, District, or Mill/Depot..."
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{
                border: "none",
                background: "#f1f5f9",
                color: "#64748b",
                borderRadius: "50%",
                width: 22,
                height: 22,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          )}
        </div>

        <div className="tp-filters">
          <button
            className={`tp-filter-pill ${fromFilter === "All" ? "active" : ""}`}
            onClick={() => setFromFilter("All")}
          >
            🌐 All Assigned ({visibleItems.length})
          </button>
          {assignedFromLocations.map((option) => {
            const count = visibleItems.filter((i) => i.from_location === option).length;
            return (
              <button
                key={option}
                className={`tp-filter-pill ${fromFilter === option ? "active" : ""}`}
                onClick={() => setFromFilter(option)}
              >
                🏭 {option} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* DATA TABLE */}
      {isPageLoading ? (
        <div style={styles.loading}>Loading transportation rates...</div>
      ) : (
        <div className="tp-card">
          <div className="tp-card-top">
            <span>Transportation Rate List</span>
            <span
              style={{
                background: "#e0e7ff",
                color: "#1d4ed8",
                padding: "3px 9px",
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {filteredItems.length} Records
            </span>
          </div>

          <div className="tp-table-scroll">
            <table className="tp-table">
              <thead>
                <tr>
                  <th className="tp-th" style={{ width: 42, textAlign: "center" }}>
                    SL
                  </th>
                  <th className="tp-th tp-sticky-col" style={{ background: "#f1f5f9" }}>
                    Station / Upazila
                  </th>
                  <th className="tp-th">District</th>
                  <th className="tp-th">From (Mill/Depot)</th>
                  <th className="tp-th" style={{ textAlign: "right" }}>
                    Poultry / Sinking
                    <br />
                    <small style={{ color: "#64748b", fontWeight: 600 }}>৳ / KG</small>
                  </th>
                  <th className="tp-th" style={{ textAlign: "right" }}>
                    Floating / Cattle
                    <br />
                    <small style={{ color: "#64748b", fontWeight: 600 }}>৳ / KG</small>
                  </th>
                  <th className="tp-th" style={{ textAlign: "center" }}>
                    Status
                  </th>
                  {canManage && (
                    <th className="tp-th" style={{ textAlign: "center" }}>
                      Action
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => {
                  const rowBg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
                  const districtName = getDistrictName(item.to_upazila);

                  return (
                    <tr
                      key={item.id || `${item.from_location}-${item.to_upazila}`}
                      style={{ background: rowBg }}
                    >
                      <td
                        className="tp-td"
                        style={{ textAlign: "center", color: "#64748b", fontWeight: 600 }}
                      >
                        {idx + 1}
                      </td>
                      <td
                        className="tp-td tp-sticky-col"
                        style={{ background: rowBg, fontWeight: 800, color: "#0f172a" }}
                      >
                        {item.to_upazila}
                      </td>
                      <td className="tp-td">
                        <span style={styles.districtBadge}>{districtName}</span>
                      </td>
                      <td className="tp-td">
                        <span style={styles.fromBadge}>{item.from_location}</span>
                      </td>
                      <td
                        className="tp-td"
                        style={{ textAlign: "right", fontWeight: 800, color: "#047857" }}
                      >
                        ৳ {Number(item.sinking_broiler_layer_sonali_rate_per_kg).toFixed(2)}
                      </td>
                      <td
                        className="tp-td"
                        style={{ textAlign: "right", fontWeight: 800, color: "#1d4ed8" }}
                      >
                        ৳ {Number(item.floating_cattle_rate_per_kg).toFixed(2)}
                      </td>
                      <td className="tp-td" style={{ textAlign: "center" }}>
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
                        <td className="tp-td" style={{ textAlign: "center" }}>
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
                  );
                })}
              </tbody>
            </table>

            {!filteredItems.length && (
              <div style={styles.noData}>
                No transportation data found for your assigned districts.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      {showForm && canManage && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {editingId ? "Edit Transportation Rate" : "Add Transportation Rate"}
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={styles.label}>Poultry / Sinking (৳/KG)</label>
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
              </div>

              <div>
                <label style={styles.label}>Floating / Cattle (৳/KG)</label>
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
              </div>
            </div>

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
              {editingId ? "Update Transportation Rate" : "Save Transportation Rate"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  fromBadge: {
    background: "#eff6ff",
    color: "#1e40af",
    border: "1px solid #bfdbfe",
    padding: "3px 8px",
    borderRadius: 6,
    fontSize: 11.5,
    fontWeight: 700,
  },
  districtBadge: {
    background: "#f1f5f9",
    color: "#334155",
    padding: "3px 8px",
    borderRadius: 6,
    fontSize: 11.5,
    fontWeight: 600,
  },
  status: {
    display: "inline-block",
    padding: "3px 8px",
    borderRadius: 6,
    fontSize: 11.5,
    fontWeight: 700,
  },
  activeStatus: { background: "#dcfce7", color: "#166534" },
  inactiveStatus: { background: "#fee2e2", color: "#991b1b" },
  actionGroup: { display: "flex", justifyContent: "center", gap: 5 },
  editButton: {
    border: "none",
    background: "#eef2ff",
    width: 32,
    height: 32,
    borderRadius: 7,
    cursor: "pointer",
  },
  deleteButton: {
    border: "none",
    background: "#fee2e2",
    width: 32,
    height: 32,
    borderRadius: 7,
    cursor: "pointer",
  },
  loading: {
    padding: 40,
    textAlign: "center",
    color: "#475569",
    background: "#ffffff",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    fontSize: 13.5,
    fontWeight: 600,
  },
  noData: { padding: 35, textAlign: "center", color: "#64748b", fontSize: 13 },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.45)",
    backdropFilter: "blur(2px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 14,
  },
  modal: {
    width: "100%",
    maxWidth: 520,
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 16,
    padding: 20,
    maxHeight: "90vh",
    overflowY: "auto",
    boxSizing: "border-box",
    boxShadow: "0 20px 25px -5px rgba(0,0,0,0.15)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: { margin: 0, color: "#0f172a", fontSize: 18, fontWeight: 800 },
  closeButton: {
    border: "none",
    background: "#f1f5f9",
    color: "#0f172a",
    width: 32,
    height: 32,
    borderRadius: "50%",
    fontSize: 20,
    cursor: "pointer",
  },
  label: {
    display: "block",
    fontSize: 12.5,
    fontWeight: 700,
    marginTop: 12,
    marginBottom: 5,
    color: "#334155",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 9,
    padding: "10px 11px",
    fontSize: 13.5,
    outline: "none",
  },
  loadingSmall: {
    background: "#f1f5f9",
    color: "#334155",
    padding: 10,
    borderRadius: 9,
    fontSize: 12.5,
  },
  saveButton: {
    width: "100%",
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    padding: 13,
    borderRadius: 10,
    marginTop: 20,
    fontSize: 13.5,
    fontWeight: 800,
    cursor: "pointer",
  },
};