import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

type FeedPrice = {
  id: number;
  category: string;
  item_name: string;
  short_name?: string | null;
  kg_per_bag: number;
  tp_per_bag: number;
  mrp_per_bag: number;
  status: string;
};

type Transport = {
  id: number;
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

type BankInfo = {
  id: number;
  bankName: string;
  branch: string;
  date: string;
  amount: string;
};

const EASY_DO_STORAGE_KEY = "easydo_format1_persistent_v11";
const PRICE_CACHE_KEY_PREFIX = "easydo_format1_price_cache_";
const TRANSPORT_CACHE_KEY = "easydo_format1_transport_cache_v1";

const CATEGORY_CONFIG: Record<string, { label: string; icon: string; bg: string }> = {
  Broiler: { label: "Broiler", icon: "", bg: "#fef2f2" },
  Layer: { label: "Layer", icon: "", bg: "#fffbebe6" },
  Sonali: { label: "Sonali", icon: "", bg: "#f0fdf4" },
  Cattle: { label: "Cattle", icon: "", bg: "#faf5ff" },
  "Fish Floating": { label: "Fish (Fl)", icon: "", bg: "#f0f9ff" },
  "Fish Sinking": { label: "Fish (Snk)", icon: "", bg: "#f0fdfa" },
};

const COMPACT_CSS = `
  .edo-page { min-height: 100vh; background: #f8fafc; padding: 12px; color: #111827; box-sizing: border-box; padding-bottom: 85px; }
  .edo-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 12px; text-align: left; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
  .edo-filter-btn { padding: 6px 10px; border-radius: 20px; border: 1px solid #cbd5e1; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px; flex-shrink: 0; transition: all 0.15s ease; }
  .edo-table { width: 100%; border-collapse: collapse; min-width: 540px; font-size: 12px; }
  .edo-th { padding: 10px; text-align: left; font-weight: 700; color: #334155; white-space: nowrap; background: #f1f5f9; border-bottom: 1px solid #cbd5e1; }
  .edo-td { padding: 10px 8px; vertical-align: middle; text-align: left; border-bottom: 1px solid #e2e8f0; }
  .edo-sticky { position: sticky; left: 0; width: 42px; min-width: 42px; text-align: center; z-index: 2; box-shadow: 2px 0 5px rgba(0,0,0,0.05); }
  .edo-bag-input { width: 65px; padding: 6px 4px; border: 1px solid #cbd5e1; border-radius: 6px; text-align: center; font-size: 13px; font-weight: 700; outline: none; background: #fff; color: #0f172a; }
  .edo-label { display: block; font-size: 11px; font-weight: 650; color: #334155; margin-bottom: 4px; text-align: left; }
  .edo-input { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; font-size: 12px; background: #fff; color: #0f172a; }
  .edo-grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .edo-mode-btn { border: 1px solid #cbd5e1; background: #fff; border-radius: 8px; padding: 10px; cursor: pointer; display: flex; align-items: center; gap: 8px; text-align: left; }
  .edo-sec { margin-top: 10px; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; text-align: left; }
  .edo-btn-main { display: block; margin: 16px auto 0; width: min(100%, 380px); padding: 14px 18px; border: none; border-radius: 12px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; font-size: 14px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 12px rgba(37,99,235,0.35); }
  .edo-scroll-down-btn { position: fixed; bottom: 24px; right: 20px; width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; border: 2px solid #ffffff; font-size: 20px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 14px rgba(37,99,235,0.45); display: flex; align-items: center; justify-content: center; z-index: 999; transition: all 0.2s ease; }
  .edo-scroll-down-btn:active { transform: scale(0.92); }
  .edo-search-bar { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 10px; margin-bottom: 10px; animation: fadeIn 0.2s ease; }
  .edo-search-bar input { border: none; outline: none; width: 100%; font-size: 13px; color: #0f172a; background: transparent; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
`;

function getSavedState() {
  try {
    const raw = localStorage.getItem(EASY_DO_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function EasyDOFormat1() {
  const { user, role } = useAuth();
  const initialSaved = useMemo(() => getSavedState(), []);

  // Instant load from localStorage cache so it doesn't show loading on open
  const [priceList, setPriceList] = useState<FeedPrice[]>(() => {
    try {
      const cachedProfile = localStorage.getItem("easydo_cache_profile_v1");
      const prof = cachedProfile ? JSON.parse(cachedProfile) : null;
      const pTable = prof?.assigned_price_list === "price_list_2" ? "feed_price_list_2" : "feed_price_list";
      const cached = localStorage.getItem(`${PRICE_CACHE_KEY_PREFIX}${pTable}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [transportList, setTransportList] = useState<Transport[]>(() => {
    try {
      const cached = localStorage.getItem(TRANSPORT_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [upazilaList, setUpazilaList] = useState<Upazila[]>(() => {
    try {
      const cached = localStorage.getItem("easydo_cache_upazilas_v1");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [userProfile, setUserProfile] = useState<any>(() => {
    try {
      const cached = localStorage.getItem("easydo_cache_profile_v1");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  // If local cache exists, loading is false instantly
  const [loading, setLoading] = useState(() => priceList.length === 0);
  const [saving, setSaving] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string>(initialSaved?.selectedCategory || "All");
  const [showSearchBox, setShowSearchBox] = useState<boolean>(false);
  const [tableSearch, setTableSearch] = useState<string>("");
  const [bagQuantities, setBagQuantities] = useState<Record<number, number>>(initialSaved?.bagQuantities || {});
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>(
    Array.isArray(initialSaved?.selectedItemIds) ? initialSaved.selectedItemIds : []
  );

  const [fromLocation, setFromLocation] = useState<string>(initialSaved?.fromLocation || "");
  const [upazila, setUpazila] = useState<string>(initialSaved?.upazila || "");
  const [transportMode, setTransportMode] = useState<"with" | "without">(
    initialSaved?.transportMode === "without" ? "without" : "with"
  );

  const [showDOInformation, setShowDOInformation] = useState<boolean>(Boolean(initialSaved?.showDOInformation));
  const [agentCode, setAgentCode] = useState<string>(initialSaved?.agentCode || "");
  const [agentName, setAgentName] = useState<string>(initialSaved?.agentName || "");
  const [vehicleNo, setVehicleNo] = useState<string>(initialSaved?.vehicleNo || "");
  
  const [subAgentSpecialActive, setSubAgentSpecialActive] = useState<boolean>(initialSaved?.subAgentSpecialActive || false);
  const [subAgentRatePerKg, setSubAgentRatePerKg] = useState<string>(initialSaved?.subAgentRatePerKg || "");

  const [banks, setBanks] = useState<BankInfo[]>(() =>
    Array.isArray(initialSaved?.banks) && initialSaved.banks.length > 0
      ? initialSaved.banks
      : [{ id: Date.now(), bankName: "", branch: "", date: new Date().toISOString().split("T")[0], amount: "" }]
  );

  const [generatedMessage, setGeneratedMessage] = useState<string>(initialSaved?.generatedMessage || "");
  const [showScrollBottom, setShowScrollBottom] = useState(true);

  const isSuperAdmin = role === "super_admin";
  const allowSubAgentSpecial = Boolean(userProfile?.allow_sub_agent_special);

  // PAGE VISIT TRACKING
  const hasTrackedVisit = useRef(false);
  useEffect(() => {
    async function trackPageVisit() {
      if (!user?.id || hasTrackedVisit.current || !navigator.onLine) return;
      hasTrackedVisit.current = true;
      const today = new Date().toISOString().split("T")[0];
      await supabase.from("page_visits").insert([
        {
          user_id: user.id,
          page_name: "EasyDO Page 1",
          visit_date: today,
        },
      ]);
    }
    trackPageVisit();
  }, [user?.id]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      localStorage.removeItem(EASY_DO_STORAGE_KEY);
      event.preventDefault();
      event.returnValue = "Do you want to refresh this page?";
      return event.returnValue;
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    initPageData();
    const handleOnline = () => initPageData();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [user?.id]);

  async function initPageData() {
    if (priceList.length === 0) setLoading(true);
    if (!navigator.onLine) {
      setLoading(false);
      return;
    }

    let assignedPriceList = userProfile?.assigned_price_list || "price_list_1";

    try {
      if (user?.id) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        if (data) {
          setUserProfile(data);
          localStorage.setItem("easydo_cache_profile_v1", JSON.stringify(data));
          assignedPriceList = data.assigned_price_list || "price_list_1";
          if (
            data.assigned_from_locations &&
            data.assigned_from_locations.length > 0 &&
            !fromLocation
          ) {
            setFromLocation(data.assigned_from_locations[0]);
          }
        }
      }

      const priceTable =
        assignedPriceList === "price_list_2"
          ? "feed_price_list_2"
          : "feed_price_list";
      const cacheKey = `${PRICE_CACHE_KEY_PREFIX}${priceTable}`;

      const [priceRes, transRes, upazilaRes] = await Promise.all([
        supabase
          .from(priceTable)
          .select("id, category, item_name, short_name, kg_per_bag, tp_per_bag, mrp_per_bag, status")
          .eq("status", "Active")
          .order("sort_order", { ascending: true }) as any,
        supabase
          .from("transportation")
          .select("id, from_location, to_upazila, floating_cattle_rate_per_kg, sinking_broiler_layer_sonali_rate_per_kg, status")
          .eq("status", "Active")
          .order("to_upazila", { ascending: true }) as any,
        supabase.from("upazilas").select("*").eq("status", "Active") as any,
      ]);

      if (!priceRes.error && priceRes.data) {
        setPriceList(priceRes.data);
        localStorage.setItem(cacheKey, JSON.stringify(priceRes.data));
      }

      if (!transRes.error && transRes.data) {
        setTransportList(transRes.data);
        localStorage.setItem(TRANSPORT_CACHE_KEY, JSON.stringify(transRes.data));
      }

      if (!upazilaRes.error && upazilaRes.data) {
        setUpazilaList(upazilaRes.data);
        localStorage.setItem("easydo_cache_upazilas_v1", JSON.stringify(upazilaRes.data));
      }
    } catch (e) {
      console.warn("Using offline cached data:", e);
    } finally {
      setLoading(false);
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

  const fromLocations = useMemo(() => {
    const dbLocs = Array.from(new Set(transportList.map((i) => i.from_location).filter(Boolean)));
    if (isSuperAdmin) return dbLocs;
    return dbLocs.filter((loc) => assignedFromLocations.includes(loc));
  }, [transportList, isSuperAdmin, assignedFromLocations]);

  const upazilas = useMemo(() => {
    const filteredByMill = fromLocation ? transportList.filter((i) => i.from_location === fromLocation) : transportList;
    const allUpazilaNames = Array.from(new Set(filteredByMill.map((i) => i.to_upazila).filter(Boolean)));

    if (isSuperAdmin || !assignedDistricts.length) return allUpazilaNames;

    const allowedUpazilaNames = upazilaList
      .filter((u) => assignedDistricts.includes(u.district))
      .map((u) => u.upazila_name);

    return allUpazilaNames.filter((name) => allowedUpazilaNames.includes(name));
  }, [transportList, fromLocation, isSuperAdmin, assignedDistricts, upazilaList]);

  function toggleItemSelect(itemId: number) {
    const isSel = selectedItemIds.includes(itemId) || (bagQuantities[itemId] || 0) > 0;
    if (isSel) {
      setSelectedItemIds((prev) => prev.filter((id) => id !== itemId));
      setBagQuantities((prev) => ({ ...prev, [itemId]: 0 }));
    } else {
      setSelectedItemIds((prev) => [...prev, itemId]);
      setBagQuantities((prev) => ({ ...prev, [itemId]: prev[itemId] || 0 }));
    }
  }

  function handleBagChange(itemId: number, bags: number) {
    const valid = bags < 0 ? 0 : bags;
    setBagQuantities((prev) => ({ ...prev, [itemId]: valid }));
    if (valid > 0) {
      setSelectedItemIds((prev) => (prev.includes(itemId) ? prev : [...prev, itemId]));
    } else {
      setSelectedItemIds((prev) => prev.filter((id) => id !== itemId));
    }
  }

  const selectedTransport = useMemo(() => {
    if (!fromLocation || !upazila) return null;
    return transportList.find((t) => t.from_location === fromLocation && t.to_upazila === upazila) || null;
  }, [transportList, fromLocation, upazila]);

  function getTransportRate(category: string) {
    if (!selectedTransport) return 0;
    return category === "Fish Floating" || category === "Cattle"
      ? Number(selectedTransport.floating_cattle_rate_per_kg)
      : Number(selectedTransport.sinking_broiler_layer_sonali_rate_per_kg);
  }

  const activeOrderList = useMemo(() => {
    return priceList
      .filter((item) => selectedItemIds.includes(item.id) || (bagQuantities[item.id] || 0) > 0)
      .map((item) => {
        const bags = bagQuantities[item.id] || 0;
        const weight = Number(item.kg_per_bag) * bags;
        const rate = getTransportRate(item.category);
        const totalTransport = weight * rate;
        const tpTotal = Number(item.tp_per_bag) * bags;
        const rowTotal = transportMode === "with" ? tpTotal : tpTotal - totalTransport;
        return { item, bags, weight, rate, totalTransport, tpTotal, rowTotal };
      });
  }, [priceList, selectedItemIds, bagQuantities, selectedTransport, transportMode]);

  const displayedPriceList = useMemo(() => {
    let list = priceList;
    if (selectedCategory !== "All") {
      list = list.filter((item) => item.category.toLowerCase() === selectedCategory.toLowerCase());
    }
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.item_name.toLowerCase().includes(q) ||
          (item.short_name || "").toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [priceList, selectedCategory, tableSearch]);

  const totalWeight = useMemo(() => activeOrderList.reduce((acc, r) => acc + r.weight, 0), [activeOrderList]);
  const feedPrice = useMemo(() => activeOrderList.reduce((acc, r) => acc + r.tpTotal, 0), [activeOrderList]);
  const totalTransportAmount = useMemo(() => (!selectedTransport ? 0 : activeOrderList.reduce((acc, r) => acc + r.totalTransport, 0)), [activeOrderList, selectedTransport]);
  const rawGrandTotal = useMemo(() => activeOrderList.reduce((acc, r) => acc + r.rowTotal, 0), [activeOrderList]);

  const subAgentDiscount = useMemo(() => {
    if (!allowSubAgentSpecial || !subAgentSpecialActive) return 0;
    const rate = Number(subAgentRatePerKg) || 0;
    return totalWeight * rate;
  }, [allowSubAgentSpecial, subAgentSpecialActive, subAgentRatePerKg, totalWeight]);

  const finalGrandTotal = useMemo(() => {
    return Math.max(0, rawGrandTotal - subAgentDiscount);
  }, [rawGrandTotal, subAgentDiscount]);

  // Auto-fill bank amount with finalGrandTotal
  useEffect(() => {
    setBanks((prev) => {
      if (!prev.length) return [{ id: Date.now(), bankName: "", branch: "", date: new Date().toISOString().split("T")[0], amount: String(finalGrandTotal.toFixed(2)) }];
      return prev.map((b, idx) => (idx === 0 ? { ...b, amount: String(finalGrandTotal.toFixed(2)) } : b));
    });
  }, [finalGrandTotal]);

  useEffect(() => {
    if (loading) return;
    try {
      localStorage.setItem(
        EASY_DO_STORAGE_KEY,
        JSON.stringify({
          selectedCategory,
          bagQuantities,
          selectedItemIds,
          fromLocation,
          upazila,
          transportMode,
          agentCode,
          agentName,
          vehicleNo,
          subAgentSpecialActive,
          subAgentRatePerKg,
          banks,
          showDOInformation,
          generatedMessage,
        })
      );
    } catch (e) {
      console.error("Save state failed:", e);
    }
  }, [
    loading,
    selectedCategory,
    bagQuantities,
    selectedItemIds,
    fromLocation,
    upazila,
    transportMode,
    agentCode,
    agentName,
    vehicleNo,
    subAgentSpecialActive,
    subAgentRatePerKg,
    banks,
    showDOInformation,
    generatedMessage,
  ]);

  useEffect(() => {
    function handleScroll() {
      const scrolledToBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 120;
      setShowScrollBottom(!scrolledToBottom);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [displayedPriceList, showDOInformation, loading]);

  function scrollToBottom() {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth",
    });
  }

  function addBank() {
    setBanks((prev) => [...prev, { id: Date.now() + Math.random(), bankName: "", branch: "", date: new Date().toISOString().split("T")[0], amount: "" }]);
  }
  function removeBank(id: number) {
    setBanks((prev) => prev.filter((b) => b.id !== id));
  }
  function updateBank(id: number, field: keyof BankInfo, value: string) {
    setBanks((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  }

  function money(val: number) {
    return Number(val).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function buildDOMessage() {
    const finalAgentCode = agentCode.trim() || "[Agent Code]";
    const finalAgentName = agentName.trim() || "[Agent Name]";
    const finalVehicle = vehicleNo.trim() || "[Vehicle No]";
    const validBanks = banks.filter((b) => b.bankName.trim() || b.branch.trim() || b.date.trim() || b.amount.trim());

    const bankText = !validBanks.length
      ? `৳ ${money(finalGrandTotal)}`
      : validBanks
          .map((b) => `${b.bankName.trim() || "[Bank Name]"}\n${b.branch.trim() || "[Branch]"}\n${b.date.trim() || "[Date]"}\n${b.amount.trim() ? `৳ ${money(Number(b.amount))}` : `৳ ${money(finalGrandTotal)}`}`)
          .join("\n\n");

    const validRows = activeOrderList.filter((r) => r.bags > 0);
    const feedText = !validRows.length
      ? "[Feed Details]"
      : validRows.map((r) => `${r.item.short_name?.trim() || r.item.item_name} - ${r.bags} bag${r.bags !== 1 ? "s" : ""}`).join("\n");

    return `Code: ${finalAgentCode}, ${finalAgentName}\n\n${bankText}\n\n${feedText}\n\nVehicle No: ${finalVehicle}\nFrom: ${fromLocation.trim() || "[Feed Mill / Depot]"}`;
  }

  function openDOInformation() {
    setShowDOInformation(true);
    setGeneratedMessage(buildDOMessage());
    setTimeout(() => document.getElementById("do-information-section")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }

  useEffect(() => {
    if (showDOInformation) setGeneratedMessage(buildDOMessage());
  }, [showDOInformation, agentCode, agentName, vehicleNo, banks, activeOrderList, fromLocation, upazila, transportMode, finalGrandTotal]);

  async function copyMessage() {
    if (!generatedMessage) return;
    try {
      await navigator.clipboard.writeText(generatedMessage);
      alert("DO Message copied.");
    } catch {
      alert("Copy failed.");
    }
  }

  async function saveDO() {
    if (saving) return;
    if (!user) return alert("You are not logged in.");

    const validRows = activeOrderList.filter((r) => r.bags > 0);
    if (!validRows.length) return alert("Please select feed item and enter bags.");

    setSaving(true);
    try {
      const validBanks = banks.filter((b) => b.bankName.trim() || b.branch.trim() || b.date.trim() || b.amount.trim());
      const bankDetails = validBanks
        .map((b) => `${b.bankName || "[Bank Name]"}\n${b.branch || "[Branch]"}\n${b.date || "[Date]"}\n${b.amount ? `৳ ${money(Number(b.amount))}` : `৳ ${money(finalGrandTotal)}`}`)
        .join("\n\n");

      const orderItems = validRows.map((r) => ({
        category: r.item.category,
        item_id: r.item.id,
        item_name: r.item.item_name,
        short_name: r.item.short_name || "",
        bags: Number(r.bags),
        kg_per_bag: Number(r.item.kg_per_bag || 0),
        tp_per_bag: Number(r.item.tp_per_bag || 0),
        weight: r.weight,
        transport: r.totalTransport,
        total: r.rowTotal,
      }));

      const firstBank = validBanks[0] || null;
      const payload = {
        user_id: user.id,
        agent_info: `${agentCode.trim()}, ${agentName.trim()}`.replace(/^,\s*|\s*,\s*$/g, "") || null,
        vehicle_number: vehicleNo.trim() || null,
        bank_details: bankDetails || null,
        from_location: fromLocation || null,
        to_upazila: upazila || null,
        transport_mode: transportMode,
        total_weight: Number(totalWeight.toFixed(2)),
        total_amount: Number(finalGrandTotal.toFixed(2)),
        order_items: orderItems,
        agent_code: agentCode.trim() || null,
        agent_name: agentName.trim() || null,
        vehicle_no: vehicleNo.trim() || null,
        bank_name: firstBank?.bankName.trim() || null,
        bank_branch: firstBank?.branch.trim() || null,
        bank_amount: firstBank?.amount ? Number(firstBank.amount) : finalGrandTotal,
        banks: validBanks,
        message_text: generatedMessage || buildDOMessage(),
      };

      const { error } = await supabase.from("saved_dos").insert([payload]);
      if (error) return alert(`Save DO failed: ${error.message}`);
      alert("DO saved successfully.");
      localStorage.removeItem(EASY_DO_STORAGE_KEY);
    } catch {
      alert("Something went wrong while saving DO.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="edo-page">
      <style>{COMPACT_CSS}</style>

      {/* HEADER: CREATE D/O CENTERED WITH SEARCH & RESET ICONS ON THE RIGHT */}
      <div style={{ marginBottom: 12, display: "grid", gridTemplateColumns: "36px 1fr auto", alignItems: "center", gap: 6 }}>
        <div />
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a", textAlign: "center" }}>Create D/O</h1>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {/* RESET BUTTON */}
          <button
            onClick={() => {
              const confirmReset = window.confirm("Do you want to reset all fields?");
              if (confirmReset) {
                localStorage.removeItem("easydo_format1_persistent_v11");
                window.location.reload();
              }
            }}
            style={{
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#dc2626",
              width: 36,
              height: 36,
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
            title="Reset Data"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="1 4 1 10 7 10"></polyline>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
            </svg>
          </button>

          {/* SEARCH TOGGLE BUTTON */}
          <button
            onClick={() => setShowSearchBox(!showSearchBox)}
            style={{
              border: "1px solid #cbd5e1",
              background: showSearchBox ? "#2563eb" : "#ffffff",
              color: showSearchBox ? "#ffffff" : "#1e293b",
              width: 36,
              height: 36,
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
            title="Toggle Search"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* EXPANDABLE SEARCH BAR */}
      {showSearchBox && (
        <div className="edo-search-bar">
          <span>🔎</span>
          <input
            type="text"
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            placeholder="Search feed name or short name..."
            autoFocus
          />
          {tableSearch && (
            <button
              onClick={() => setTableSearch("")}
              style={{ border: "none", background: "#f1f5f9", borderRadius: "50%", width: 22, height: 22, cursor: "pointer", fontWeight: 700 }}
            >
              ✕
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="edo-card" style={{ padding: 40, textAlign: "center", color: "#475569" }}>Loading price list...</div>
      ) : (
        <>
          <div style={{ marginBottom: 8, overflowX: "auto", paddingBottom: 4 }}>
            <div style={{ display: "flex", gap: 6, whiteSpace: "nowrap" }}>
              <button
                onClick={() => setSelectedCategory("All")}
                className="edo-filter-btn"
                style={{
                  background: selectedCategory === "All" ? "#2563eb" : "#fff",
                  color: selectedCategory === "All" ? "#fff" : "#334155",
                  borderColor: selectedCategory === "All" ? "#2563eb" : "#cbd5e1",
                }}
              >
                <span>🌐</span> All
              </button>
              {Object.keys(CATEGORY_CONFIG).map((cat) => {
                const conf = CATEGORY_CONFIG[cat];
                const active = selectedCategory.toLowerCase() === cat.toLowerCase();
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className="edo-filter-btn"
                    style={{
                      background: active ? "#2563eb" : conf.bg,
                      color: active ? "#fff" : "#334155",
                      borderColor: active ? "#2563eb" : "#cbd5e1",
                    }}
                  >
                    <span>{conf.icon}</span> {conf.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="edo-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="edo-table">
                <thead>
                  <tr>
                    <th className="edo-th edo-sticky" style={{ zIndex: 12 }}>Select</th>
                    <th className="edo-th">Item Name</th>
                    <th className="edo-th">Bag Amount</th>
                    <th className="edo-th">Total kg</th>
                    <th className="edo-th">TP / Bag</th>
                    <th className="edo-th">Total Price</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let lastCat = "";
                    return displayedPriceList.map((item) => {
                      const showHeader = selectedCategory === "All" && !tableSearch && item.category !== lastCat;
                      lastCat = item.category;

                      const bags = bagQuantities[item.id] ?? "";
                      const numBags = Number(bags) || 0;
                      const isSel = selectedItemIds.includes(item.id) || numBags > 0;
                      const rate = getTransportRate(item.category);
                      const weight = Number(item.kg_per_bag) * numBags;
                      const tpTotal = Number(item.tp_per_bag) * numBags;
                      const transTotal = weight * rate;
                      const rowTotal = transportMode === "with" ? tpTotal : tpTotal - transTotal;
                      const rowBg = isSel ? "#dbeafe" : CATEGORY_CONFIG[item.category]?.bg || "#fff";

                      return (
                        <React.Fragment key={item.id}>
                          {showHeader && (
                            <tr>
                              <td colSpan={6} style={{ padding: "2px 12px", background: "#e2e8f0", fontWeight: 800, color: "#1e293b", fontSize: 12 }}>
                                {item.category}
                              </td>
                            </tr>
                          )}
                          <tr style={{ background: rowBg, boxShadow: isSel ? "inset 3px 0 0 #2563eb" : undefined }}>
                            <td className="edo-td edo-sticky" style={{ background: rowBg }}>
                              <input
                                type="checkbox"
                                checked={isSel}
                                onChange={() => toggleItemSelect(item.id)}
                                style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#2563eb" }}
                              />
                            </td>
                            <td className="edo-td" style={{ background: rowBg }}>
                              <div style={{ fontWeight: isSel ? 700 : 600, color: isSel ? "#1d4ed8" : "#1e293b", fontSize: 13 }}>{item.item_name}</div>
                              <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 2 }}>{item.kg_per_bag} kg</div>
                            </td>
                            <td className="edo-td">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={bags === 0 ? "" : bags}
                                onChange={(e) => handleBagChange(item.id, e.target.value === "" ? 0 : Number(e.target.value))}
                                placeholder="0"
                                className="edo-bag-input"
                                style={isSel ? { borderColor: "#2563eb", color: "#1d4ed8" } : undefined}
                              />
                            </td>
                            <td className="edo-td" style={{ fontWeight: isSel ? 700 : 600, color: isSel ? "#1d4ed8" : "#334155", whiteSpace: "nowrap" }}>
                              {numBags > 0 ? `${weight.toLocaleString("en-BD", { maximumFractionDigits: 2 })} kg` : "—"}
                            </td>
                            <td className="edo-td" style={{ fontWeight: 600, color: "#334155", whiteSpace: "nowrap" }}>
                              ৳ {money(Number(item.tp_per_bag))}
                            </td>
                            <td className="edo-td" style={{ whiteSpace: "nowrap" }}>
                              {numBags > 0 ? (
                                <div>
                                  <div style={{ fontWeight: isSel ? 800 : 700, color: isSel ? "#1d4ed8" : "#0f172a", fontSize: 13 }}>৳ {money(rowTotal)}</div>
                                  {transportMode === "without" ? (
                                    selectedTransport ? (
                                      <div style={{ fontSize: 10, fontWeight: 700, color: "#dc2626", marginTop: 2 }}>- ৳ {money(transTotal)} Transport</div>
                                    ) : (
                                      <div style={{ fontSize: 10, fontWeight: 500, color: "#d97706", marginTop: 2 }}>Select area for transport</div>
                                    )
                                  ) : (
                                    <div style={{ fontSize: 10, fontWeight: 600, color: "#059669", marginTop: 2 }}>With Transport</div>
                                  )}
                                </div>
                              ) : (
                                <strong>—</strong>
                              )}
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          <div className="edo-card">
            <div style={{ fontSize: 16, fontWeight: 750, color: "#0f172a" }}>Transportation</div>
            <div className="edo-grid2" style={{ marginTop: 10 }}>
              <div>
                <label className="edo-label">From</label>
                <select value={fromLocation} onChange={(e) => { setFromLocation(e.target.value); setUpazila(""); }} className="edo-input">
                  <option value="">Select From</option>
                  {fromLocations.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
                </select>
              </div>
              <div>
                <label className="edo-label">To / Upazila</label>
                <select value={upazila} onChange={(e) => setUpazila(e.target.value)} className="edo-input" disabled={!fromLocation}>
                  <option value="">Select Upazila</option>
                  {upazilas.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
            </div>

            <div className="edo-sec">
              <div style={{ fontSize: 12, fontWeight: 750, color: "#0f172a" }}>Transportation Rate</div>
              {selectedTransport ? (
                <>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>Floating / Cattle: <strong>৳{Number(selectedTransport.floating_cattle_rate_per_kg).toFixed(2)}/kg</strong></div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>Sinking / Broiler / Layer / Sonali: <strong>৳{Number(selectedTransport.sinking_broiler_layer_sonali_rate_per_kg).toFixed(2)}/kg</strong></div>
                </>
              ) : (
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Select From and Upazila to see rate.</div>
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <label className="edo-label">Price Type</label>
              <div className="edo-grid2">
                {(["with", "without"] as const).map((mode) => {
                  const active = transportMode === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => setTransportMode(mode)}
                      className="edo-mode-btn"
                      style={active ? { border: "2px solid #2563eb", background: "#eff6ff" } : undefined}
                    >
                      <span style={{ width: 20, height: 20, borderRadius: "50%", border: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, ...(active ? { background: "#2563eb", color: "#fff", borderColor: "#2563eb" } : {}) }}>
                        {active ? "✓" : ""}
                      </span>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 750, color: "#0f172a" }}>{mode === "with" ? "With Transportation" : "Without Transportation"}</div>
                        <div style={{ fontSize: 9, color: "#64748b" }}>{mode === "with" ? "TP price as it is" : "Transport cost deducted"}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="edo-card" style={{ background: "#0f172a", color: "#fff", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12, color: "#cbd5e1" }}>
              <span>Total Weight</span>
              <strong>{totalWeight.toLocaleString("en-BD", { maximumFractionDigits: 2 })} kg</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12, color: "#cbd5e1" }}>
              <span>Feed Price</span>
              <strong>৳ {money(feedPrice)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12, color: "#cbd5e1" }}>
              <span>Transportation</span>
              <strong>{transportMode === "with" ? "Included in TP" : selectedTransport ? `- ৳ ${money(totalTransportAmount)}` : "—"}</strong>
            </div>

            {allowSubAgentSpecial && (
              <div style={{ margin: "10px 0", padding: "10px", background: "#1e293b", borderRadius: 8, border: "1px dashed #475569" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={subAgentSpecialActive}
                      onChange={(e) => setSubAgentSpecialActive(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: "#38bdf8", cursor: "pointer" }}
                    />
                    <span>Sub-Agent Special</span>
                  </label>
                  {subAgentSpecialActive && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={subAgentRatePerKg}
                        onChange={(e) => setSubAgentRatePerKg(e.target.value)}
                        placeholder=""
                        style={{ width: 75, padding: "4px 6px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12, textAlign: "right", color: "#0f172a", fontWeight: 700 }}
                      />
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>Tk/kg</span>
                    </div>
                  )}
                </div>
                {subAgentSpecialActive && subAgentDiscount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "#f87171" }}>
                    <span>Special Deduction ({totalWeight.toLocaleString()} kg × ৳{subAgentRatePerKg})</span>
                    <strong>- ৳ {money(subAgentDiscount)}</strong>
                  </div>
                )}
              </div>
            )}

            <div style={{ height: 1, background: "#334155", margin: "8px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>Grand Total</div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 850, color: "#38bdf8" }}>৳ {money(finalGrandTotal)}</div>
            </div>
            <button className="edo-btn-main" onClick={openDOInformation}>
              📝 Generate DO Message / 💾 Save
            </button>
          </div>

          {showDOInformation && (
            <div id="do-information-section" className="edo-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: "#0f172a" }}>DO Information</div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>Enter optional information. Bank amount is editable.</div>
                </div>
                <button onClick={() => setShowDOInformation(false)} style={{ width: 30, height: 30, border: "none", borderRadius: "50%", background: "#f1f5f9", color: "#475569", fontSize: 18, cursor: "pointer" }}>
                  ×
                </button>
              </div>

              <div className="edo-sec">
                <div style={{ fontSize: 12, fontWeight: 800, color: "#334155", marginBottom: 8 }}>Agent Information</div>
                <div className="edo-grid2">
                  <div>
                    <label className="edo-label">Agent Code</label>
                    <input value={agentCode} onChange={(e) => setAgentCode(e.target.value)} placeholder="Optional" className="edo-input" />
                  </div>
                  <div>
                    <label className="edo-label">Agent Name</label>
                    <input value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="Optional" className="edo-input" />
                  </div>
                </div>
              </div>

              <div className="edo-sec">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>Bank Details</div>
                  <button onClick={addBank} style={{ border: "none", background: "#2563eb", color: "#fff", borderRadius: 6, padding: "6px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                    + Add Bank
                  </button>
                </div>
                {banks.map((bank, idx) => (
                  <div key={bank.id} style={{ marginTop: 8, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
                    <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, marginBottom: 6 }}>Button {idx + 1}</div>
                    <div className="edo-grid2" style={{ marginBottom: 8 }}>
                      <div>
                        <label className="edo-label">Bank Name</label>
                        <input value={bank.bankName} onChange={(e) => updateBank(bank.id, "bankName", e.target.value)} placeholder="Optional" className="edo-input" />
                      </div>
                      <div>
                        <label className="edo-label">Branch</label>
                        <input value={bank.branch} onChange={(e) => updateBank(bank.id, "branch", e.target.value)} placeholder="Optional" className="edo-input" />
                      </div>
                    </div>
                    <div className="edo-grid2">
                      <div>
                        <label className="edo-label">Date</label>
                        <input type="date" value={bank.date} onChange={(e) => updateBank(bank.id, "date", e.target.value)} className="edo-input" />
                      </div>
                      <div>
                        <label className="edo-label">Amount Tk</label>
                        <input type="number" min="0" step="0.01" value={bank.amount} onChange={(e) => updateBank(bank.id, "amount", e.target.value)} className="edo-input" style={{ fontWeight: 700, }} />
                      </div>
                    </div>
                    {banks.length > 1 && (
                      <div style={{ marginTop: 8, textAlign: "right" }}>
                        <button onClick={() => removeBank(bank.id)} style={{ border: "none", background: "#fef2f2", color: "#dc2626", borderRadius: 6, padding: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="edo-sec">
                <label className="edo-label">Vehicle No</label>
                <input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder="Optional" className="edo-input" />
              </div>

              <div className="edo-sec" style={{ borderColor: "#cbd5e1" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>Generated Message</div>
                  <button onClick={copyMessage} style={{ border: "none", background: "#0f172a", color: "#fff", borderRadius: 6, padding: "6px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                    📋 Copy
                  </button>
                </div>
                <textarea value={generatedMessage} onChange={(e) => setGeneratedMessage(e.target.value)} className="edo-input" style={{ minHeight: 220, lineHeight: 1.5, fontFamily: "Arial, sans-serif" }} />
              </div>

              <button onClick={saveDO} disabled={saving} style={{ width: "100%", marginTop: 12, border: "none", background: "#2563eb", color: "#fff", borderRadius: 8, padding: 12, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                {saving ? "Saving..." : "💾 Save this DO"}
              </button>
            </div>
          )}

          {showScrollBottom && (
            <button
              onClick={scrollToBottom}
              className="edo-scroll-down-btn"
              title="Scroll to bottom"
              aria-label="Scroll to bottom"
            >
              ↓
            </button>
          )}
        </>
      )}
    </div>
  );
}