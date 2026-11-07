import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx-js-style";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { universalFileDownload } from "../lib/downloadHelper";

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

const COMPACT_TP_CSS = `
  .tp-page { min-height: calc(100vh - 60px); background: #f8fafc; padding: 10px; box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; color: #0f172a; }
  .tp-container { max-width: 1100px; margin: 0 auto; }
  
  .tp-topbar { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
  .tp-title { margin: 0; font-size: 15px; font-weight: 800; color: #0f172a; letter-spacing: -0.2px; }
  .tp-btn-group { display: flex; gap: 5px; flex-wrap: wrap; }
  
  .tp-action-btn { border: 1px solid #cbd5e1; background: #ffffff; color: #334155; padding: 5px 9px; border-radius: 6px; font-size: 11.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s ease; }
  .tp-action-btn:hover { background: #f1f5f9; border-color: #94a3b8; }
  .tp-primary-btn { background: #0f172a; color: #ffffff; border-color: #0f172a; }
  .tp-primary-btn:hover { background: #1e293b; }
  .tp-excel-btn { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
  .tp-pdf-btn { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }

  .tp-search-bar { display: flex; align-items: center; gap: 6px; background: #ffffff; border: 1px solid #e2e8f0; padding: 6px 10px; border-radius: 8px; margin-bottom: 8px; }
  .tp-search-input { border: none; outline: none; background: transparent; width: 100%; font-size: 12.5px; font-weight: 600; color: #0f172a; }

  .tp-cat-scroll { display: flex; gap: 5px; overflow-x: auto; padding-bottom: 6px; margin-bottom: 8px; scrollbar-width: none; }
  .tp-cat-scroll::-webkit-scrollbar { display: none; }
  .tp-cat-pill { flex-shrink: 0; border: 1px solid #cbd5e1; background: #ffffff; color: #475569; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.15s ease; }
  .tp-cat-pill.active { background: #0f172a; color: #ffffff; border-color: #0f172a; }

  .tp-table-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03); }
  .tp-scroll-wrap { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .tp-table { width: 100%; min-width: 850px; border-collapse: collapse; font-size: 12px; text-align: left; }
  .tp-th { background: #f8fafc; color: #475569; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; padding: 8px 9px; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
  .tp-td { padding: 7px 9px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; color: #0f172a; white-space: nowrap; }
  .tp-tr:hover { background: #f8fafc !important; }

  .tp-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10.5px; font-weight: 700; background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
  .tp-dist-badge { background: #f1f5f9; color: #334155; padding: 2px 6px; border-radius: 4px; font-size: 10.5px; font-weight: 600; }
  .tp-status { padding: 2px 5px; border-radius: 4px; font-size: 10px; font-weight: 800; }
  .tp-status-active { background: #dcfce7; color: #166534; }
  .tp-status-inactive { background: #fee2e2; color: #991b1b; }
  
  .tp-icon-btn { border: 1px solid #e2e8f0; background: #f8fafc; width: 26px; height: 26px; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; justifyContent: center; font-size: 11px; }
  .tp-icon-btn:hover { background: #eff6ff; border-color: #bfdbfe; }
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

  const hasTrackedVisit = useRef(false);

  useEffect(() => {
    async function trackVisit() {
      if (!user?.id || hasTrackedVisit.current) return;
      hasTrackedVisit.current = true;

      const today = new Date().toISOString().split("T")[0];
      await supabase.from("page_visits").insert([
        {
          user_id: user.id,
          page_name: "Transportation Page",
          visit_date: today,
        },
      ]);
    }
    trackVisit();
  }, [user?.id]);

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

  const MILL_THEMES = [
    { header: "DBEAFE", subSink: "EFF6FF", subFloat: "E0F2FE", cellSink: "F8FAFC", cellFloat: "F0F9FF" },
    { header: "DCFCE7", subSink: "F0FDF4", subFloat: "ECFDF5", cellSink: "F7FEE7", cellFloat: "F0FDF4" },
    { header: "FEF3C7", subSink: "FFFBEB", subFloat: "FEF9C3", cellSink: "FFFBEB", cellFloat: "FEFCE8" },
    { header: "F3E8FF", subSink: "FAF5FF", subFloat: "F5F3FF", cellSink: "FAF5FF", cellFloat: "F5F3FF" },
    { header: "FFE4E6", subSink: "FFF1F2", subFloat: "FCE7F3", cellSink: "FFF1F2", cellFloat: "FDF2F8" },
  ];

  const DISTRICT_PASTELS = ["F1F5F9", "EFF6FF", "F0FDF4", "FFFBEB", "FAF5FF", "ECFEFF"];
async function exportExcel() {
    if (!filteredItems.length) {
      alert("No transportation data available to export.");
      return;
    }

    if (user?.id) {
      const today = new Date().toISOString().split("T")[0];
      await supabase.from("page_visits").insert([
        { user_id: user.id, page_name: "Transportation Download Excel", visit_date: today },
      ]);
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
    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const fileName = `Transportation_Chart_${timestamp}.xlsx`;

    // ব্রাউজার এবং অ্যাপ উভয় জায়গায় ডাউনলোডের জন্য:
    await universalFileDownload(blob, fileName, blob.type);
  }

  async function exportPDF() {
    if (!filteredItems.length) {
      alert("No transportation data available to export.");
      return;
    }

    if (user?.id) {
      const today = new Date().toISOString().split("T")[0];
      await supabase.from("page_visits").insert([
        { user_id: user.id, page_name: "Transportation Download PDF", visit_date: today },
      ]);
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
    const fileName = `Transportation_Chart_${timestamp}.pdf`;

    const options = {
      margin: 5,
      filename: fileName,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
    };

    // html2pdf থেকে সরাসরি Blob তৈরি করে universalFileDownload-এ পাঠানো হচ্ছে:
    const pdfBlob: Blob = await html2pdf().from(container).set(options).outputPdf("blob");
    await universalFileDownload(pdfBlob, fileName, "application/pdf");
  }
  const isPageLoading = loading || upazilaLoading || profileLoading;

  return (
    <div className="tp-page">
      <style>{COMPACT_TP_CSS}</style>

      <div className="tp-container">
        {/* COMPACT TOP BAR */}
        <div className="tp-topbar">
          <h1 className="tp-title">Transportation Rates</h1>

          <div className="tp-btn-group">
            <button className="tp-action-btn tp-excel-btn" onClick={exportExcel} title="Download Excel">
              📥 Download Excel
            </button>
            <button className="tp-action-btn tp-pdf-btn" onClick={exportPDF} title="Download PDF">
              📄 Download PDF
            </button>

            {canManage && (
              <>
                <button
                  className="tp-action-btn"
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
                <button className="tp-action-btn tp-primary-btn" onClick={openAdd}>
                  ＋ Add Rate
                </button>
              </>
            )}
          </div>
        </div>

        {/* COMPACT SEARCH BAR */}
        <div className="tp-search-bar">
          <span>🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Upazila, District, or Mill/Depot..."
            className="tp-search-input"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{
                border: "none",
                background: "transparent",
                color: "#94a3b8",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* COMPACT CATEGORY PILLS */}
        <div className="tp-cat-scroll">
          <button
            className={`tp-cat-pill ${fromFilter === "All" ? "active" : ""}`}
            onClick={() => setFromFilter("All")}
          >
            All Locations ({visibleItems.length})
          </button>
          {assignedFromLocations.map((option) => {
            const count = visibleItems.filter((i) => i.from_location === option).length;
            return (
              <button
                key={option}
                className={`tp-cat-pill ${fromFilter === option ? "active" : ""}`}
                onClick={() => setFromFilter(option)}
              >
                {option} ({count})
              </button>
            );
          })}
        </div>

        {/* COMPACT TABLE */}
        {isPageLoading ? (
          <div style={{ padding: 30, textAlign: "center", color: "#64748b", fontSize: 12.5 }}>
            Loading transportation rates...
          </div>
        ) : (
          <div className="tp-table-card">
            <div className="tp-scroll-wrap">
              <table className="tp-table">
                <thead>
                  <tr>
                    <th className="tp-th" style={{ width: 35, textAlign: "center" }}>SL</th>
                    <th className="tp-th">Station / Upazila</th>
                    <th className="tp-th">District</th>
                    <th className="tp-th">From (Mill/Depot)</th>
                    <th className="tp-th" style={{ textAlign: "right" }}>Poultry / Sinking</th>
                    <th className="tp-th" style={{ textAlign: "right" }}>Floating / Cattle</th>
                    <th className="tp-th" style={{ textAlign: "center" }}>Status</th>
                    {canManage && <th className="tp-th" style={{ textAlign: "center" }}>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, idx) => {
                    const rowBg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
                    const districtName = getDistrictName(item.to_upazila);

                    return (
                      <tr key={item.id || `${item.from_location}-${item.to_upazila}`} className="tp-tr" style={{ background: rowBg }}>
                        <td className="tp-td" style={{ textAlign: "center", color: "#64748b", fontWeight: 600 }}>
                          {idx + 1}
                        </td>
                        <td className="tp-td" style={{ fontWeight: 750, color: "#0f172a" }}>
                          {item.to_upazila}
                        </td>
                        <td className="tp-td">
                          <span className="tp-dist-badge">{districtName}</span>
                        </td>
                        <td className="tp-td">
                          <span className="tp-badge">{item.from_location}</span>
                        </td>
                        <td className="tp-td" style={{ textAlign: "right", fontWeight: 750, color: "#047857" }}>
                          ৳ {Number(item.sinking_broiler_layer_sonali_rate_per_kg).toFixed(2)}
                        </td>
                        <td className="tp-td" style={{ textAlign: "right", fontWeight: 750, color: "#1d4ed8" }}>
                          ৳ {Number(item.floating_cattle_rate_per_kg).toFixed(2)}
                        </td>
                        <td className="tp-td" style={{ textAlign: "center" }}>
                          <span
                            className={`tp-status ${
                              item.status === "Active" ? "tp-status-active" : "tp-status-inactive"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        {canManage && (
                          <td className="tp-td" style={{ textAlign: "center" }}>
                            <div style={{ display: "inline-flex", gap: 4 }}>
                              <button className="tp-icon-btn" onClick={() => openEdit(item)} title="Edit">
                                ✏️
                              </button>
                              <button
                                className="tp-icon-btn"
                                style={{ background: "#fef2f2", borderColor: "#fecaca" }}
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
                <div style={{ padding: 30, textAlign: "center", color: "#64748b", fontSize: 12.5 }}>
                  No transportation data found.
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
                {editingId ? "Edit Transportation Rate" : "Add Transportation Rate"}
              </h3>
              <button style={modalStyles.closeBtn} onClick={closeForm}>×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "72vh", overflowY: "auto", paddingRight: 4 }}>
              <div>
                <label style={modalStyles.label}>From (Assigned Mills/Depots)</label>
                <select
                  value={form.from_location}
                  onChange={(e) => setForm({ ...form, from_location: e.target.value })}
                  style={modalStyles.input}
                >
                  {assignedFromLocations.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={modalStyles.label}>To / Upazila (Assigned Districts)</label>
                {upazilaLoading ? (
                  <div style={{ fontSize: 11.5, color: "#64748b" }}>Loading Upazilas...</div>
                ) : (
                  <select
                    value={form.to_upazila}
                    onChange={(e) => setForm({ ...form, to_upazila: e.target.value })}
                    style={modalStyles.input}
                  >
                    <option value="">Select Upazila</option>
                    {filteredUpazilaList.map((upazila) => (
                      <option key={upazila.id} value={upazila.upazila_name}>
                        {upazila.upazila_name} — {upazila.district}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={modalStyles.label}>Poultry / Sinking (৳/KG)</label>
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
                    style={modalStyles.input}
                  />
                </div>
                <div>
                  <label style={modalStyles.label}>Floating / Cattle (৳/KG)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.floating_cattle_rate_per_kg}
                    onChange={(e) =>
                      setForm({ ...form, floating_cattle_rate_per_kg: Number(e.target.value) })
                    }
                    style={modalStyles.input}
                  />
                </div>
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
              <button onClick={saveTransportation} style={modalStyles.saveBtn}>
                {editingId ? "Update Rate" : "Save Rate"}
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