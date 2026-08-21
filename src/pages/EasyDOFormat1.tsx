import { useEffect, useMemo, useState } from "react";
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

type BankInfo = {
  id: number;
  bankName: string;
  branch: string;
  date: string;
  amount: string;
};

const EASY_DO_STORAGE_KEY = "easydo_format1_current_state_v1";

// Category configuration for icons, names, and background colors
const CATEGORY_CONFIG: Record<string, { label: string; icon: string; bg: string; activeBg: string }> = {
  Broiler: { label: "Broiler", icon: "", bg: "#fef2f2", activeBg: "#fee2e2" },
  Layer: { label: "Layer", icon: "", bg: "#fffbebe6", activeBg: "#fef3c7" },
  Sonali: { label: "Sonali", icon: "", bg: "#f0fdf4", activeBg: "#dcfce7" },
  Cattle: { label: "Cattle", icon: "", bg: "#faf5ff", activeBg: "#f3e8ff" },
  "Fish Floating": { label: "Fish (Fl)", icon: "", bg: "#f0f9ff", activeBg: "#e0f2fe" },
  "Fish Sinking": { label: "Fish (Snk)", icon: "", bg: "#f0fdfa", activeBg: "#ccfbf1" },
};

export default function EasyDOFormat1() {
  const { user } = useAuth();

  const [priceList, setPriceList] = useState<FeedPrice[]>([]);
  const [transportList, setTransportList] = useState<Transport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Category Filter State ("All" means show everything)
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Bag quantities mapped by item ID
  const [bagQuantities, setBagQuantities] = useState<Record<number, number>>({});
  // Explicitly checked items
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);

  const [fromLocation, setFromLocation] = useState("");
  const [upazila, setUpazila] = useState("");
  const [transportMode, setTransportMode] = useState<"with" | "without">("with");

  // DO INFORMATION
  const [showDOInformation, setShowDOInformation] = useState(false);
  const [agentCode, setAgentCode] = useState("");
  const [agentName, setAgentName] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [banks, setBanks] = useState<BankInfo[]>([
    {
      id: Date.now(),
      bankName: "",
      branch: "",
      date: new Date().toISOString().split("T")[0],
      amount: "",
    },
  ]);
  const [generatedMessage, setGeneratedMessage] = useState("");

  // INITIAL LOAD
  useEffect(() => {
    const navigationEntry = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;

    if (navigationEntry?.type === "reload") {
      sessionStorage.removeItem(EASY_DO_STORAGE_KEY);
    } else {
      restoreEasyDOState();
    }

    loadData();
  }, []);

  // RELOAD WARNING
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // RESTORE CURRENT DO STATE
  function restoreEasyDOState() {
    try {
      const saved = sessionStorage.getItem(EASY_DO_STORAGE_KEY);
      if (!saved) return;

      const state = JSON.parse(saved);
      if (state.bagQuantities) setBagQuantities(state.bagQuantities);
      if (Array.isArray(state.selectedItemIds)) setSelectedItemIds(state.selectedItemIds);
      setFromLocation(state.fromLocation || "");
      setUpazila(state.upazila || "");
      setTransportMode(state.transportMode === "without" ? "without" : "with");
      setAgentCode(state.agentCode || "");
      setAgentName(state.agentName || "");
      setVehicleNo(state.vehicleNo || "");
      if (Array.isArray(state.banks) && state.banks.length > 0) setBanks(state.banks);
      setShowDOInformation(Boolean(state.showDOInformation));
      setGeneratedMessage(state.generatedMessage || "");
    } catch (error) {
      console.error("EasyDO Format 1 restore failed:", error);
      sessionStorage.removeItem(EASY_DO_STORAGE_KEY);
    }
  }

  // AUTO SAVE CURRENT DO STATE
  useEffect(() => {
    if (loading) return;

    const state = {
      bagQuantities,
      selectedItemIds,
      fromLocation,
      upazila,
      transportMode,
      agentCode,
      agentName,
      vehicleNo,
      banks,
      showDOInformation,
      generatedMessage,
    };

    try {
      sessionStorage.setItem(EASY_DO_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("EasyDO Format 1 state save failed:", error);
    }
  }, [
    loading,
    bagQuantities,
    selectedItemIds,
    fromLocation,
    upazila,
    transportMode,
    agentCode,
    agentName,
    vehicleNo,
    banks,
    showDOInformation,
    generatedMessage,
  ]);

  // LOAD DATA FROM SUPABASE
  async function loadData() {
    setLoading(true);

    const [priceResponse, transportResponse] = await Promise.all([
      supabase
        .from("feed_price_list")
        .select("id, category, item_name, short_name, kg_per_bag, tp_per_bag, mrp_per_bag, status")
        .eq("status", "Active")
        .order("sort_order", { ascending: true }),

      supabase
        .from("transportation")
        .select("id, from_location, to_upazila, floating_cattle_rate_per_kg, sinking_broiler_layer_sonali_rate_per_kg, status")
        .eq("status", "Active")
        .order("to_upazila", { ascending: true }),
    ]);

    if (priceResponse.error) {
      console.error(priceResponse.error);
      alert("Price list load failed.");
    } else {
      setPriceList(priceResponse.data || []);
    }

    if (transportResponse.error) {
      console.error(transportResponse.error);
      alert("Transportation load failed.");
    } else {
      setTransportList(transportResponse.data || []);
    }

    setLoading(false);
  }

  // CHECKBOX HANDLER
  function toggleItemSelect(itemId: number) {
    const isCurrentlySelected = selectedItemIds.includes(itemId) || (bagQuantities[itemId] || 0) > 0;

    if (isCurrentlySelected) {
      setSelectedItemIds((prev) => prev.filter((id) => id !== itemId));
      setBagQuantities((prev) => ({
        ...prev,
        [itemId]: 0,
      }));
    } else {
      setSelectedItemIds((prev) => [...prev, itemId]);
      setBagQuantities((prev) => ({
        ...prev,
        [itemId]: prev[itemId] || 0,
      }));
    }
  }

  // BAG INPUT HANDLER
  function handleBagChange(itemId: number, bags: number) {
    const validBags = bags < 0 ? 0 : bags;
    setBagQuantities((prev) => ({
      ...prev,
      [itemId]: validBags,
    }));

    if (validBags > 0) {
      if (!selectedItemIds.includes(itemId)) {
        setSelectedItemIds((prev) => [...prev, itemId]);
      }
    } else {
      setSelectedItemIds((prev) => prev.filter((id) => id !== itemId));
    }
  }

  // SELECTED TRANSPORT
  const selectedTransport = useMemo(() => {
    if (!fromLocation || !upazila) return null;
    return (
      transportList.find(
        (t) => t.from_location === fromLocation && t.to_upazila === upazila
      ) || null
    );
  }, [transportList, fromLocation, upazila]);

  function getTransportRate(category: string) {
    if (!selectedTransport) return 0;
    if (category === "Fish Floating" || category === "Cattle") {
      return Number(selectedTransport.floating_cattle_rate_per_kg);
    }
    return Number(selectedTransport.sinking_broiler_layer_sonali_rate_per_kg);
  }

  // CALCULATIONS FOR ACTIVE ITEMS (Include all selected items regardless of filter)
  const activeOrderList = useMemo(() => {
    return priceList
      .filter((item) => selectedItemIds.includes(item.id) || (bagQuantities[item.id] || 0) > 0)
      .map((item) => {
        const bags = bagQuantities[item.id] || 0;
        const weight = Number(item.kg_per_bag) * bags;
        const rate = getTransportRate(item.category);
        const transportPerBag = Number(item.kg_per_bag) * rate;
        const totalTransport = weight * rate;
        const tpTotal = Number(item.tp_per_bag) * bags;
        const rowTotal = transportMode === "with" ? tpTotal : tpTotal - totalTransport;

        return {
          item,
          bags,
          weight,
          rate,
          transportPerBag,
          totalTransport,
          tpTotal,
          rowTotal,
        };
      });
  }, [priceList, selectedItemIds, bagQuantities, selectedTransport, transportMode]);

  // Filter items for display in table
  const displayedPriceList = useMemo(() => {
    if (selectedCategory === "All") return priceList;
    return priceList.filter(
      (item) => item.category.toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [priceList, selectedCategory]);

  const totalWeight = useMemo(() => {
    return activeOrderList.reduce((acc, row) => acc + row.weight, 0);
  }, [activeOrderList]);

  const feedPrice = useMemo(() => {
    return activeOrderList.reduce((acc, row) => acc + row.tpTotal, 0);
  }, [activeOrderList]);

  const totalTransportAmount = useMemo(() => {
    if (!selectedTransport) return 0;
    return activeOrderList.reduce((acc, row) => acc + row.totalTransport, 0);
  }, [activeOrderList, selectedTransport]);

  const totalAmount = useMemo(() => {
    return activeOrderList.reduce((acc, row) => acc + row.rowTotal, 0);
  }, [activeOrderList]);

  const fromLocations = useMemo(() => {
    return Array.from(new Set(transportList.map((item) => item.from_location).filter(Boolean)));
  }, [transportList]);

  const upazilas = useMemo(() => {
    const filtered = fromLocation
      ? transportList.filter((item) => item.from_location === fromLocation)
      : transportList;
    return Array.from(new Set(filtered.map((item) => item.to_upazila).filter(Boolean)));
  }, [transportList, fromLocation]);

  // BANK FUNCTIONS
  function addBank() {
    setBanks((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        bankName: "",
        branch: "",
        date: new Date().toISOString().split("T")[0],
        amount: "",
      },
    ]);
  }

  function removeBank(id: number) {
    setBanks((prev) => prev.filter((bank) => bank.id !== id));
  }

  function updateBank(id: number, field: keyof BankInfo, value: string) {
    setBanks((prev) =>
      prev.map((bank) => (bank.id === id ? { ...bank, [field]: value } : bank))
    );
  }

  function getFeedShortName(item: FeedPrice) {
    return item.short_name?.trim() ? item.short_name.trim() : item.item_name;
  }

  // GENERATE MESSAGE
  function buildDOMessage() {
    const finalAgentCode = agentCode.trim() || "[Agent Code]";
    const finalAgentName = agentName.trim() || "[Agent Name]";
    const finalVehicle = vehicleNo.trim() || "[Vehicle No]";

    const validBanks = banks.filter(
      (b) => b.bankName.trim() || b.branch.trim() || b.date.trim() || b.amount.trim()
    );

    let bankText = "";
    if (!validBanks.length) {
      bankText = "[Bank Details]";
    } else {
      bankText = validBanks
        .map((bank) => {
          const bankName = bank.bankName.trim() || "[Bank Name]";
          const branch = bank.branch.trim() || "[Branch]";
          const date = bank.date.trim() || "[Date]";
          const amount = bank.amount.trim()
            ? `৳ ${Number(bank.amount).toLocaleString("en-BD", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : "[Bank Amount]";
          return `${bankName}\n${branch}\n${date}\n${amount}`;
        })
        .join("\n\n");
    }

    const validRows = activeOrderList.filter((r) => r.bags > 0);
    let feedText = "";
    if (!validRows.length) {
      feedText = "[Feed Details]";
    } else {
      feedText = validRows
        .map((r) => `${getFeedShortName(r.item)} - ${r.bags} bag${r.bags !== 1 ? "s" : ""}`)
        .join("\n");
    }

    const finalFrom = fromLocation.trim() || "[Feed Mill / Depot]";

    return `Code: ${finalAgentCode}, ${finalAgentName}\n\n${bankText}\n\n${feedText}\n\nVehicle No: ${finalVehicle}\nFrom: ${finalFrom}`;
  }

  function openDOInformation() {
    setShowDOInformation(true);
    setGeneratedMessage(buildDOMessage());
    setTimeout(() => {
      const element = document.getElementById("do-information-section");
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  }

  useEffect(() => {
    if (!showDOInformation) return;
    setGeneratedMessage(buildDOMessage());
  }, [
    showDOInformation,
    agentCode,
    agentName,
    vehicleNo,
    banks,
    activeOrderList,
    fromLocation,
    upazila,
    transportMode,
  ]);

  async function copyMessage() {
    if (!generatedMessage) return;
    try {
      await navigator.clipboard.writeText(generatedMessage);
      alert("DO Message copied.");
    } catch (error) {
      console.error(error);
      alert("Copy failed.");
    }
  }

  // SAVE DO TO SUPABASE
  async function saveDO() {
    if (saving) return;
    if (!user) {
      alert("You are not logged in.");
      return;
    }

    const validRows = activeOrderList.filter((r) => r.bags > 0);
    if (validRows.length === 0) {
      alert("Please select feed item and enter bags.");
      return;
    }

    setSaving(true);

    try {
      const validBanks = banks.filter(
        (b) => b.bankName.trim() || b.branch.trim() || b.date.trim() || b.amount.trim()
      );

      const bankDetails = validBanks
        .map((b) => {
          return `${b.bankName || "[Bank Name]"}\n${b.branch || "[Branch]"}\n${
            b.date || "[Date]"
          }\n${
            b.amount
              ? `৳ ${Number(b.amount).toLocaleString("en-BD", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              : "[Bank Amount]"
          }`;
        })
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

      const firstBank = validBanks.length > 0 ? validBanks[0] : null;
      const finalMessage = generatedMessage || buildDOMessage();

      const payload = {
        user_id: user.id,
        agent_info:
          `${agentCode.trim()}, ${agentName.trim()}`.replace(/^,\s*|\s*,\s*$/g, "") || null,
        vehicle_number: vehicleNo.trim() || null,
        bank_details: bankDetails || null,
        from_location: fromLocation || null,
        to_upazila: upazila || null,
        transport_mode: transportMode,
        total_weight: Number(totalWeight.toFixed(2)),
        total_amount: Number(totalAmount.toFixed(2)),
        order_items: orderItems,
        agent_code: agentCode.trim() || null,
        agent_name: agentName.trim() || null,
        vehicle_no: vehicleNo.trim() || null,
        bank_name: firstBank?.bankName.trim() || null,
        bank_branch: firstBank?.branch.trim() || null,
        bank_amount: firstBank?.amount ? Number(firstBank.amount) : 0,
        banks: validBanks,
        message_text: finalMessage,
      };

      const { error } = await supabase.from("saved_dos").insert([payload]);

      if (error) {
        console.error("Save DO error:", error);
        alert(`Save DO failed: ${error.message}`);
        return;
      }

      alert("DO saved successfully.");
    } catch (error) {
      console.error(error);
      alert("Something went wrong while saving DO.");
    } finally {
      setSaving(false);
    }
  }

  function money(value: number) {
    return Number(value).toLocaleString("en-BD", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // Get Row color based on item category
  function getRowBgColor(category: string, isSelected: boolean) {
    if (isSelected) return "#dbeafe"; // Highlighted selection color
    const config = CATEGORY_CONFIG[category];
    return config ? config.bg : "#ffffff";
  }

  return (
    <div style={styles.page}>
      {/* HEADER (Centered) */}
      <div style={styles.header}>
        <h1 style={styles.title}>Create D/O (Format 1)</h1>
        <p style={styles.subtitle}>Direct feed order entry table</p>
      </div>

      {loading ? (
        <div style={styles.loading}>Loading price list...</div>
      ) : (
        <>
          {/* COMPACT CATEGORY FILTER BAR FOR MOBILE */}
          <div style={styles.filterBarContainer}>
            <div style={styles.filterBar}>
              <button
                onClick={() => setSelectedCategory("All")}
                style={{
                  ...styles.filterBtn,
                  ...(selectedCategory === "All" ? styles.filterBtnActive : {}),
                }}
              >
                <span>🌐</span> All
              </button>

              {Object.keys(CATEGORY_CONFIG).map((cat) => {
                const conf = CATEGORY_CONFIG[cat];
                const isActive = selectedCategory.toLowerCase() === cat.toLowerCase();
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      ...styles.filterBtn,
                      background: isActive ? "#2563eb" : conf.bg,
                      color: isActive ? "#ffffff" : "#334155",
                      borderColor: isActive ? "#2563eb" : "#cbd5e1",
                    }}
                  >
                    <span>{conf.icon}</span> {conf.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ITEM LIST TABLE CONTAINER */}
          <div style={styles.tableCard}>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.theadRow}>
                    <th style={{ ...styles.th, ...styles.stickyCol1, left: 0, zIndex: 12 }}>
                      Select
                    </th>
                    <th style={styles.th}>Item Name</th>
                    <th style={styles.th}>Bag Amount</th>
                    <th style={styles.th}>TP / Bag</th>
                    <th style={styles.th}>Transport</th>
                    <th style={styles.th}>Total Price</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedPriceList.map((item) => {
                    const bags = bagQuantities[item.id] ?? "";
                    const isSelected = selectedItemIds.includes(item.id) || Number(bags) > 0;
                    const rate = getTransportRate(item.category);
                    const transportPerBag = Number(item.kg_per_bag) * rate;
                    const itemWeight = Number(item.kg_per_bag) * (Number(bags) || 0);
                    const tpTotal = Number(item.tp_per_bag) * (Number(bags) || 0);
                    const transportTotal = itemWeight * rate;
                    const rowTotal = transportMode === "with" ? tpTotal : tpTotal - transportTotal;

                    const rowBg = getRowBgColor(item.category, isSelected);

                    return (
                      <tr
                        key={item.id}
                        style={{
                          ...styles.tr,
                          background: rowBg,
                          ...(isSelected ? styles.trActive : {}),
                        }}
                      >
                        {/* STICKY TICK MARK */}
                        <td
                          style={{
                            ...styles.td,
                            ...styles.stickyCol1,
                            left: 0,
                            background: rowBg,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleItemSelect(item.id)}
                            style={styles.checkbox}
                          />
                        </td>

                        {/* ITEM NAME */}
                        <td
                          style={{
                            ...styles.td,
                            background: rowBg,
                          }}
                        >
                          <div
                            style={{
                              ...styles.itemNameText,
                              ...(isSelected ? styles.itemNameActive : {}),
                            }}
                          >
                            {item.item_name}
                          </div>
                          <div style={styles.itemCategorySub}>
                            {item.category} • {item.kg_per_bag}kg
                          </div>
                        </td>

                        {/* BAG INPUT */}
                        <td style={styles.td}>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={bags === 0 ? "" : bags}
                            onChange={(e) =>
                              handleBagChange(
                                item.id,
                                e.target.value === "" ? 0 : Number(e.target.value)
                              )
                            }
                            placeholder="0"
                            style={{
                              ...styles.bagInput,
                              ...(isSelected ? styles.bagInputActive : {}),
                            }}
                          />
                        </td>

                        {/* TP PRICE */}
                        <td style={styles.td}>
                          <div style={styles.cellMainText}>৳ {money(Number(item.tp_per_bag))}</div>
                        </td>

                        {/* TRANSPORT */}
                        <td style={styles.td}>
                          <div style={styles.cellMainText}>
                            {selectedTransport ? `৳ ${transportPerBag.toFixed(2)}` : "—"}
                          </div>
                          {selectedTransport && (
                            <div style={styles.cellSubText}>৳ {rate.toFixed(2)}/kg</div>
                          )}
                        </td>

                        {/* ROW TOTAL */}
                        <td style={styles.td}>
                          <div
                            style={{
                              ...styles.rowTotalText,
                              ...(isSelected ? styles.rowTotalActive : {}),
                            }}
                          >
                            {Number(bags) > 0 ? `৳ ${money(rowTotal)}` : "—"}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* TRANSPORTATION SECTION */}
          <div style={styles.transportCard}>
            <div style={styles.sectionTitle}>Transportation</div>

            <div style={styles.transportGrid}>
              <div>
                <label style={styles.formLabel}>From</label>
                <select
                  value={fromLocation}
                  onChange={(e) => {
                    setFromLocation(e.target.value);
                    setUpazila("");
                  }}
                  style={styles.select}
                >
                  <option value="">Select From</option>
                  {fromLocations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={styles.formLabel}>To / Upazila</label>
                <select
                  value={upazila}
                  onChange={(e) => setUpazila(e.target.value)}
                  style={styles.select}
                  disabled={!fromLocation}
                >
                  <option value="">Select Upazila</option>
                  {upazilas.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* RATE DISPLAY */}
            <div style={styles.rateBox}>
              <div style={styles.rateTitle}>Transportation Rate</div>
              {selectedTransport ? (
                <>
                  <div style={styles.rateLine}>
                    Floating / Cattle: <strong>৳{Number(selectedTransport.floating_cattle_rate_per_kg).toFixed(2)}/kg</strong>
                  </div>
                  <div style={styles.rateLine}>
                    Sinking / Broiler / Layer / Sonali: <strong>৳{Number(selectedTransport.sinking_broiler_layer_sonali_rate_per_kg).toFixed(2)}/kg</strong>
                  </div>
                </>
              ) : (
                <div style={styles.noRate}>Select From and Upazila to see rate.</div>
              )}
            </div>

            {/* MODE SWITCH */}
            <div style={styles.modeSection}>
              <div style={styles.formLabel}>Price Type</div>
              <div style={styles.modeGrid}>
                <button
                  onClick={() => setTransportMode("with")}
                  style={{
                    ...styles.modeButton,
                    ...(transportMode === "with" ? styles.modeActive : {}),
                  }}
                >
                  <span
                    style={{
                      ...styles.radio,
                      ...(transportMode === "with" ? styles.radioActive : {}),
                    }}
                  >
                    {transportMode === "with" ? "✓" : ""}
                  </span>
                  <div>
                    <div style={styles.modeTitle}>With Transportation</div>
                    <div style={styles.modeHint}>TP price as it is</div>
                  </div>
                </button>

                <button
                  onClick={() => setTransportMode("without")}
                  style={{
                    ...styles.modeButton,
                    ...(transportMode === "without" ? styles.modeActive : {}),
                  }}
                >
                  <span
                    style={{
                      ...styles.radio,
                      ...(transportMode === "without" ? styles.radioActive : {}),
                    }}
                  >
                    {transportMode === "without" ? "✓" : ""}
                  </span>
                  <div>
                    <div style={styles.modeTitle}>Without Transportation</div>
                    <div style={styles.modeHint}>Transport cost deducted</div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* SUMMARY */}
          <div style={styles.summaryCard}>
            <div style={styles.summaryRow}>
              <span>Total Weight</span>
              <strong>{totalWeight.toLocaleString("en-BD", { maximumFractionDigits: 2 })} kg</strong>
            </div>

            <div style={styles.summaryRow}>
              <span>Feed Price</span>
              <strong>৳ {money(feedPrice)}</strong>
            </div>

            <div style={styles.summaryRow}>
              <span>Transportation</span>
              <strong>
                {transportMode === "with"
                  ? "Included in TP"
                  : selectedTransport
                  ? `- ৳ ${money(totalTransportAmount)}`
                  : "—"}
              </strong>
            </div>

            <div style={styles.divider} />

            <div style={styles.grandTotalRow}>
              <div>
                <div style={styles.grandTotalLabel}>Grand Total</div>
                <div style={styles.grandTotalHint}>
                  {transportMode === "with"
                    ? "TP includes transportation"
                    : "Transportation deducted from TP"}
                </div>
              </div>
              <div style={styles.grandTotalValue}>৳ {money(totalAmount)}</div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
              <button style={styles.generateMessageBtn} onClick={openDOInformation}>
                📝 Generate DO Message
              </button>
            </div>
          </div>

          {/* DO INFORMATION SECTION */}
          {showDOInformation && (
            <div id="do-information-section" style={styles.doInformationCard}>
              <div style={styles.doInformationHeader}>
                <div>
                  <div style={styles.doInformationTitle}>DO Information</div>
                  <div style={styles.doInformationSubtitle}>
                    Enter optional information. Message will update automatically.
                  </div>
                </div>
                <button
                  style={styles.closeDOInformationButton}
                  onClick={() => setShowDOInformation(false)}
                >
                  ×
                </button>
              </div>

              {/* AGENT */}
              <div style={styles.formSection}>
                <div style={styles.formSectionTitle}>Agent Information</div>
                <div style={styles.formGrid}>
                  <div>
                    <label style={styles.formLabel}>Agent Code</label>
                    <input
                      value={agentCode}
                      onChange={(e) => setAgentCode(e.target.value)}
                      placeholder="Optional"
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.formLabel}>Agent Name</label>
                    <input
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="Optional"
                      style={styles.input}
                    />
                  </div>
                </div>
              </div>

              {/* BANK DETAILS */}
              <div style={styles.formSection}>
                <div style={styles.bankHeader}>
                  <div style={styles.formSectionTitle}>Bank Details</div>
                  <button style={styles.addBankButton} onClick={addBank}>
                    + Add Bank
                  </button>
                </div>

                {banks.map((bank, index) => (
                  <div key={bank.id} style={styles.bankCard}>
                    <div style={styles.bankNumber}>Bank {index + 1}</div>
                    <div style={styles.formGrid}>
                      <div>
                        <label style={styles.formLabel}>Bank Name</label>
                        <input
                          value={bank.bankName}
                          onChange={(e) => updateBank(bank.id, "bankName", e.target.value)}
                          placeholder="Optional"
                          style={styles.input}
                        />
                      </div>
                      <div>
                        <label style={styles.formLabel}>Branch</label>
                        <input
                          value={bank.branch}
                          onChange={(e) => updateBank(bank.id, "branch", e.target.value)}
                          placeholder="Optional"
                          style={styles.input}
                        />
                      </div>
                    </div>

                    <div style={styles.formGrid}>
                      <div>
                        <label style={styles.formLabel}>Date</label>
                        <input
                          type="date"
                          value={bank.date}
                          onChange={(e) => updateBank(bank.id, "date", e.target.value)}
                          style={styles.input}
                        />
                      </div>
                      <div>
                        <label style={styles.formLabel}>Amount Tk</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={bank.amount}
                          onChange={(e) => updateBank(bank.id, "amount", e.target.value)}
                          placeholder="Optional"
                          style={styles.input}
                        />
                      </div>
                    </div>

                    {banks.length > 1 && (
                      <div style={{ marginTop: 9, textAlign: "right" }}>
                        <button
                          style={styles.removeBankButton}
                          onClick={() => removeBank(bank.id)}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* VEHICLE */}
              <div style={styles.formSection}>
                <label style={styles.formLabel}>Vehicle No</label>
                <input
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  placeholder="Optional"
                  style={styles.input}
                />
              </div>

              {/* GENERATED MESSAGE */}
              <div style={styles.generatedSection}>
                <div style={styles.generatedHeader}>
                  <div style={styles.formSectionTitle}>Generated Message</div>
                  <button style={styles.copyButton} onClick={copyMessage}>
                    📋 Copy
                  </button>
                </div>
                <textarea
                  value={generatedMessage}
                  onChange={(e) => setGeneratedMessage(e.target.value)}
                  style={styles.messageTextarea}
                />
              </div>

              {/* SAVE BUTTON */}
              <button
                style={{ ...styles.generateModalButton, marginTop: 12 }}
                onClick={saveDO}
                disabled={saving}
              >
                {saving ? "Saving..." : "💾 Save this DO"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* =====================================================
   STYLES
===================================================== */

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: 12,
    color: "#111827",
    boxSizing: "border-box",
  },
  header: {
    marginBottom: 12,
    textAlign: "center",
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    textAlign: "center",
    fontFamily: "'Outfit', 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif",
    letterSpacing: "-0.01em",
    lineHeight: 1.2,
    color: "#0f172a",
  },
  subtitle: {
    margin: "3px 0 0",
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
  filterBarContainer: {
    marginBottom: 8,
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
    paddingBottom: 4,
  },
  filterBar: {
    display: "flex",
    gap: 6,
    whiteSpace: "nowrap",
  },
  filterBtn: {
    padding: "6px 10px",
    borderRadius: 20,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
    transition: "all 0.15s ease",
  },
  filterBtnActive: {
    background: "#2563eb",
    color: "#ffffff",
    borderColor: "#2563eb",
  },
  tableCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    overflow: "hidden",
    marginBottom: 12,
  },
  tableWrapper: {
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 540,
    fontSize: 12,
  },
  theadRow: {
    background: "#f1f5f9",
    borderBottom: "1px solid #cbd5e1",
  },
  th: {
    padding: "10px 10px",
    textAlign: "left",
    fontWeight: 700,
    color: "#334155",
    whiteSpace: "nowrap",
  },
  tr: {
    borderBottom: "1px solid #e2e8f0",
    transition: "all 0.15s ease",
  },
  trActive: {
    boxShadow: "inset 3px 0 0 #2563eb",
  },
  td: {
    padding: "10px 8px",
    verticalAlign: "middle",
    textAlign: "left",
  },
  stickyCol1: {
    position: "sticky",
    width: 42,
    minWidth: 42,
    textAlign: "center",
    zIndex: 2,
    boxShadow: "2px 0 5px rgba(0,0,0,0.03)",
  },
  checkbox: {
    width: 18,
    height: 18,
    cursor: "pointer",
    accentColor: "#2563eb",
  },
  itemNameText: {
    fontWeight: 600,
    color: "#1e293b",
    fontSize: 13,
    lineHeight: 1.2,
    cursor: "default",
    textAlign: "left",
  },
  itemNameActive: {
    fontWeight: 700,
    color: "#1d4ed8",
  },
  itemCategorySub: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 2,
    textAlign: "left",
  },
  bagInput: {
    width: 65,
    padding: "6px 4px",
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    textAlign: "center",
    fontSize: 13,
    fontWeight: 700,
    outline: "none",
    background: "#ffffff",
    color: "#0f172a",
  },
  bagInputActive: {
    borderColor: "#2563eb",
    color: "#1d4ed8",
    background: "#ffffff",
  },
  cellMainText: {
    fontWeight: 600,
    color: "#334155",
    fontSize: 12,
    textAlign: "left",
  },
  cellSubText: {
    fontSize: 10,
    color: "#64748b",
    textAlign: "left",
  },
  rowTotalText: {
    fontWeight: 700,
    color: "#0f172a",
    fontSize: 13,
    textAlign: "left",
  },
  rowTotalActive: {
    color: "#1d4ed8",
    fontWeight: 800,
  },
  transportCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    textAlign: "left",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 750,
    color: "#0f172a",
    textAlign: "left",
  },
  transportGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
    marginTop: 10,
  },
  formLabel: {
    display: "block",
    fontSize: 11,
    fontWeight: 650,
    color: "#334155",
    marginBottom: 4,
    textAlign: "left",
  },
  select: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: "8px",
    fontSize: 12,
    background: "#ffffff",
    color: "#0f172a",
  },
  rateBox: {
    marginTop: 10,
    padding: 10,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    textAlign: "left",
  },
  rateTitle: {
    fontSize: 12,
    fontWeight: 750,
    color: "#0f172a",
  },
  rateLine: {
    fontSize: 11,
    color: "#475569",
    marginTop: 3,
  },
  noRate: {
    fontSize: 11,
    color: "#94a3b8",
  },
  modeSection: {
    marginTop: 12,
    textAlign: "left",
  },
  modeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
  },
  modeButton: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    borderRadius: 8,
    padding: 10,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
    textAlign: "left",
  },
  modeActive: {
    border: "2px solid #2563eb",
    background: "#eff6ff",
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: "50%",
    border: "1px solid #cbd5e1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 800,
  },
  radioActive: {
    background: "#2563eb",
    color: "#ffffff",
    borderColor: "#2563eb",
  },
  modeTitle: {
    fontSize: 11,
    fontWeight: 750,
    color: "#0f172a",
  },
  modeHint: {
    fontSize: 9,
    color: "#64748b",
  },
  summaryCard: {
    background: "#0f172a",
    color: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    textAlign: "left",
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "4px 0",
    fontSize: 12,
    color: "#cbd5e1",
  },
  divider: {
    height: 1,
    background: "#334155",
    margin: "8px 0",
  },
  grandTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: 800,
  },
  grandTotalHint: {
    fontSize: 9,
    color: "#94a3b8",
  },
  grandTotalValue: {
    fontSize: 20,
    fontWeight: 850,
    color: "#38bdf8",
  },
  generateMessageBtn: {
    display: "block",
    margin: "16px auto 0",
    width: "min(100%, 360px)",
    padding: "14px 20px",
    border: "none",
    borderRadius: "12px",
    background: "#2563eb",
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
  },
  doInformationCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 14,
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
    textAlign: "left",
  },
  doInformationHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  doInformationTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: "#0f172a",
  },
  doInformationSubtitle: {
    fontSize: 10,
    color: "#64748b",
  },
  closeDOInformationButton: {
    width: 30,
    height: 30,
    border: "none",
    borderRadius: "50%",
    background: "#f1f5f9",
    color: "#475569",
    fontSize: 18,
    cursor: "pointer",
  },
  formSection: {
    marginTop: 10,
    padding: 10,
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    background: "#f8fafc",
    textAlign: "left",
  },
  formSectionTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: "#334155",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
    marginTop: 8,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    padding: 8,
    fontSize: 12,
    background: "#ffffff",
    color: "#0f172a",
  },
  bankHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  addBankButton: {
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    borderRadius: 6,
    padding: "6px 8px",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  },
  bankCard: {
    marginTop: 8,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 8,
  },
  bankNumber: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: 700,
  },
  removeBankButton: {
    border: "none",
    background: "#fef2f2",
    color: "#dc2626",
    borderRadius: 6,
    padding: 6,
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  },
  generatedSection: {
    marginTop: 10,
    padding: 10,
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    background: "#f8fafc",
    textAlign: "left",
  },
  generatedHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  copyButton: {
    border: "none",
    background: "#0f172a",
    color: "#ffffff",
    borderRadius: 6,
    padding: "6px 8px",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  },
  messageTextarea: {
    width: "100%",
    minHeight: 220,
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    padding: 8,
    fontSize: 12,
    lineHeight: 1.5,
    fontFamily: "Arial, sans-serif",
    background: "#ffffff",
    color: "#0f172a",
  },
  generateModalButton: {
    width: "100%",
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
  loading: {
    background: "#ffffff",
    borderRadius: 12,
    padding: 40,
    textAlign: "center",
    color: "#475569",
  },
};