import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

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

type OrderRow = {
  id: number;
  category: string;
  item: FeedPrice | null;
  bags: number;
};

type BankInfo = {
  id: number;
  bankName: string;
  branch: string;
  amount: string;
};

const categories = [
  "Broiler",
  "Layer",
  "Sonali",
  "Cattle",
  "Fish Floating",
  "Fish Sinking",
];

export default function EasyDOPage() {
  const [priceList, setPriceList] = useState<FeedPrice[]>([]);
  const [transportList, setTransportList] = useState<Transport[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rows, setRows] = useState<OrderRow[]>([]);

  const [fromLocation, setFromLocation] = useState("");
  const [upazila, setUpazila] = useState("");

  const [transportMode, setTransportMode] =
    useState<"with" | "without">("with");

  // =========================
  // DO INFORMATION
  // =========================

  const [showDOInformation, setShowDOInformation] = useState(false);

  const [agentCode, setAgentCode] = useState("");
  const [agentName, setAgentName] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");

  const [doDate, setDoDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [banks, setBanks] = useState<BankInfo[]>([
    {
      id: Date.now(),
      bankName: "",
      branch: "",
      amount: "",
    },
  ]);

  const [generatedMessage, setGeneratedMessage] = useState("");

  // DO Amount is separate from Grand Total.
  const [doAmount, setDoAmount] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const [priceResponse, transportResponse] = await Promise.all([
      supabase
        .from("feed_price_list")
        .select(
          "id, category, item_name, short_name, kg_per_bag, tp_per_bag, mrp_per_bag, status"
        )
        .eq("status", "Active")
        .order("sort_order", {
          ascending: true,
        }),

      supabase
        .from("transportation")
        .select(
          "id, from_location, to_upazila, floating_cattle_rate_per_kg, sinking_broiler_layer_sonali_rate_per_kg, status"
        )
        .eq("status", "Active")
        .order("to_upazila", {
          ascending: true,
        }),
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

  // =========================
  // CATEGORY
  // =========================

  function addCategory(category: string) {
    const newRow: OrderRow = {
      id: Date.now() + Math.random(),
      category,
      item: null,
      bags: 0,
    };

    setRows((prev) => [...prev, newRow]);
  }

  function removeRow(rowId: number) {
    setRows((prev) => prev.filter((row) => row.id !== rowId));
  }

  function updateItem(rowId: number, itemId: string) {
    const item =
      priceList.find((price) => String(price.id) === itemId) || null;

    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              item,
            }
          : row
      )
    );
  }

  function updateBags(rowId: number, bags: number) {
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              bags: bags < 0 ? 0 : bags,
            }
          : row
      )
    );
  }

  // =========================
  // SELECTED TRANSPORT
  // =========================

  const selectedTransport = useMemo(() => {
    if (!fromLocation || !upazila) {
      return null;
    }

    return (
      transportList.find(
        (transport) =>
          transport.from_location === fromLocation &&
          transport.to_upazila === upazila
      ) || null
    );
  }, [transportList, fromLocation, upazila]);

  // =========================
  // TRANSPORT RATE
  // =========================

  function getTransportRate(category: string) {
    if (!selectedTransport) {
      return 0;
    }

    if (
      category === "Fish Floating" ||
      category === "Cattle"
    ) {
      return Number(
        selectedTransport.floating_cattle_rate_per_kg
      );
    }

    return Number(
      selectedTransport.sinking_broiler_layer_sonali_rate_per_kg
    );
  }

  function getRowWeight(row: OrderRow) {
    if (!row.item || !row.bags) {
      return 0;
    }

    return Number(row.item.kg_per_bag) * Number(row.bags);
  }

  function getRowTransport(row: OrderRow) {
    if (
      transportMode !== "without" ||
      !row.item ||
      !row.bags ||
      !selectedTransport
    ) {
      return 0;
    }

    const weight = getRowWeight(row);
    const rate = getTransportRate(row.category);

    return weight * rate;
  }

  // =========================
  // ROW TOTAL
  // =========================

  function getRowTotal(row: OrderRow) {
    if (!row.item || !row.bags) {
      return 0;
    }

    const tpTotal =
      Number(row.item.tp_per_bag) * Number(row.bags);

    if (transportMode === "with") {
      return tpTotal;
    }

    return tpTotal - getRowTransport(row);
  }

  // =========================
  // TOTAL TRANSPORT
  // =========================

  const totalTransportAmount = useMemo(() => {
    if (!selectedTransport) {
      return 0;
    }

    return rows.reduce((total, row) => {
      if (!row.item || !row.bags) {
        return total;
      }

      return (
        total +
        getRowWeight(row) *
          getTransportRate(row.category)
      );
    }, 0);
  }, [rows, selectedTransport]);

  // =========================
  // TOTAL WEIGHT
  // =========================

  const totalWeight = useMemo(() => {
    return rows.reduce(
      (total, row) => total + getRowWeight(row),
      0
    );
  }, [rows]);

  // =========================
  // FEED PRICE
  // =========================

  const feedPrice = useMemo(() => {
    return rows.reduce(
      (total, row) =>
        total +
        (row.item
          ? Number(row.item.tp_per_bag) *
            Number(row.bags)
          : 0),
      0
    );
  }, [rows]);

  // =========================
  // GRAND TOTAL
  // =========================

  const totalAmount = useMemo(() => {
    return rows.reduce(
      (total, row) => total + getRowTotal(row),
      0
    );
  }, [
    rows,
    transportMode,
    selectedTransport,
  ]);

  // =========================
  // AUTOMATIC DO AMOUNT
  // =========================

  useEffect(() => {
    if (rows.length === 0) {
      setDoAmount("");
      return;
    }

    setDoAmount(
      totalAmount > 0
        ? totalAmount.toFixed(2)
        : ""
    );
  }, [totalAmount]);

  // =========================
  // FROM LOCATIONS
  // =========================

  const fromLocations = useMemo(() => {
    return Array.from(
      new Set(
        transportList
          .map((item) => item.from_location)
          .filter(Boolean)
      )
    );
  }, [transportList]);

  // =========================
  // UPAZILA
  // =========================

  const upazilas = useMemo(() => {
    const filtered = fromLocation
      ? transportList.filter(
          (item) =>
            item.from_location === fromLocation
        )
      : transportList;

    return Array.from(
      new Set(
        filtered
          .map((item) => item.to_upazila)
          .filter(Boolean)
      )
    );
  }, [transportList, fromLocation]);

  // =========================
  // BANK FUNCTIONS
  // =========================

  function addBank() {
    setBanks((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        bankName: "",
        branch: "",
        amount: "",
      },
    ]);
  }

  function removeBank(id: number) {
    setBanks((prev) =>
      prev.filter((bank) => bank.id !== id)
    );
  }

  function updateBank(
    id: number,
    field: keyof BankInfo,
    value: string
  ) {
    setBanks((prev) =>
      prev.map((bank) =>
        bank.id === id
          ? {
              ...bank,
              [field]: value,
            }
          : bank
      )
    );
  }

  // =========================
  // SHORT FEED NAME
  // =========================

  function getFeedShortName(item: FeedPrice) {
    if (item.short_name?.trim()) {
      return item.short_name.trim();
    }

    return item.item_name;
  }

  // =========================
  // GENERATE MESSAGE
  // =========================

  function buildDOMessage() {
    const finalAgentCode =
      agentCode.trim() || "[Agent Code]";

    const finalAgentName =
      agentName.trim() || "[Agent Name]";

    const finalDate =
      doDate || "[Date]";

    const finalVehicle =
      vehicleNo.trim() || "[Vehicle No]";

    const amountNumber = Number(doAmount);

    const finalAmount =
      doAmount.trim() !== "" &&
      !Number.isNaN(amountNumber)
        ? `৳ ${amountNumber.toLocaleString(
            "en-BD",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }
          )}`
        : "[DO Amount]";

    // =========================
    // BANK MESSAGE
    // =========================

    const validBanks = banks.filter(
      (bank) =>
        bank.bankName.trim() ||
        bank.branch.trim() ||
        bank.amount.trim()
    );

    let bankText = "";

    if (!validBanks.length) {
      bankText = "[Bank Details]";
    } else {
      bankText = validBanks
        .map((bank) => {
          const bankName =
            bank.bankName.trim() ||
            "[Bank Name]";

          const branch =
            bank.branch.trim() ||
            "[Branch]";

          const amount =
            bank.amount.trim()
              ? `৳ ${Number(
                  bank.amount
                ).toLocaleString("en-BD", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              : "[Bank Amount]";

          return `${bankName}
${branch}
${amount}`;
        })
        .join("\n\n");
    }

    // =========================
    // FEED MESSAGE
    // =========================

    const validRows = rows.filter(
      (row) =>
        row.item &&
        row.bags > 0
    );

    let feedText = "";

    if (!validRows.length) {
      feedText = "[Feed Details]";
    } else {
      feedText = validRows
        .map((row) => {
          const name = getFeedShortName(
            row.item as FeedPrice
          );

          return `${name} - ${row.bags} bag${
            row.bags !== 1 ? "s" : ""
          }`;
        })
        .join("\n");
    }

    const finalFrom =
      fromLocation.trim() ||
      "[Feed Mill / Depot]";

    return `Code: ${finalAgentCode}, ${finalAgentName}

${bankText}

${finalDate}
Amount: ${finalAmount}

${feedText}

Vehicle No: ${finalVehicle}
From: ${finalFrom}`;
  }

  // =========================
  // GENERATE BUTTON
  // =========================

  function openDOInformation() {
    setShowDOInformation(true);

    // Generate immediately.
    setGeneratedMessage(buildDOMessage());

    setTimeout(() => {
      const element =
        document.getElementById(
          "do-information-section"
        );

      if (element) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 100);
  }

  // =========================
  // AUTO UPDATE MESSAGE
  // =========================

  useEffect(() => {
    if (!showDOInformation) {
      return;
    }

    setGeneratedMessage(
      buildDOMessage()
    );
  }, [
    showDOInformation,
    agentCode,
    agentName,
    vehicleNo,
    doDate,
    banks,
    doAmount,
    rows,
    fromLocation,
    upazila,
    transportMode,
  ]);

  // =========================
  // COPY MESSAGE
  // =========================

  async function copyMessage() {
    if (!generatedMessage) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        generatedMessage
      );

      alert("DO Message copied.");
    } catch (error) {
      console.error(error);
      alert("Copy failed.");
    }
  }

  // =========================
  // SAVE DO
  // =========================

  async function saveDO() {
    if (saving) {
      return;
    }

    if (rows.length === 0) {
      alert("Please add at least one feed item.");
      return;
    }

    const validRows = rows.filter(
      (row) =>
        row.item &&
        row.bags > 0
    );

    if (validRows.length === 0) {
      alert("Please select feed item and enter bags.");
      return;
    }

    setSaving(true);

    try {
      const validBanks = banks.filter(
        (bank) =>
          bank.bankName.trim() ||
          bank.branch.trim() ||
          bank.amount.trim()
      );

      const bankDetails = validBanks
        .map((bank) => {
          return `${bank.bankName || "[Bank Name]"}\n${
            bank.branch || "[Branch]"
          }\n${
            bank.amount
              ? `৳ ${Number(bank.amount).toLocaleString(
                  "en-BD",
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }
                )}`
              : "[Bank Amount]"
          }`;
        })
        .join("\n\n");

      const orderItems = validRows.map(
        (row) => ({
          category: row.category,
          item_id: row.item?.id || null,
          item_name: row.item?.item_name || "",
          short_name:
            row.item?.short_name || "",
          bags: Number(row.bags),
          kg_per_bag:
            Number(row.item?.kg_per_bag || 0),
          tp_per_bag:
            Number(row.item?.tp_per_bag || 0),
          weight:
            getRowWeight(row),
          transport:
            getRowTransport(row),
          total:
            getRowTotal(row),
        })
      );

      const firstBank =
        validBanks.length > 0
          ? validBanks[0]
          : null;

      const finalMessage =
        generatedMessage ||
        buildDOMessage();

      const payload = {
        do_date:
          doDate || null,

        agent_info:
          `${agentCode.trim()}, ${agentName.trim()}`.replace(
            /^,\s*|\s*,\s*$/g,
            ""
          ) || null,

        vehicle_number:
          vehicleNo.trim() || null,

        bank_details:
          bankDetails || null,

        do_amount:
          doAmount !== ""
            ? Number(doAmount)
            : 0,

        from_location:
          fromLocation || null,

        to_upazila:
          upazila || null,

        transport_mode:
          transportMode,

        total_weight:
          Number(totalWeight.toFixed(2)),

        total_amount:
          Number(totalAmount.toFixed(2)),

        order_items:
          orderItems,

        agent_code:
          agentCode.trim() || null,

        agent_name:
          agentName.trim() || null,

        vehicle_no:
          vehicleNo.trim() || null,

        bank_name:
          firstBank?.bankName.trim() || null,

        bank_branch:
          firstBank?.branch.trim() || null,

        bank_amount:
          firstBank?.amount
            ? Number(firstBank.amount)
            : 0,

        banks:
          validBanks,

        message_text:
          finalMessage,
      };

      console.log(
        "Saving DO:",
        payload
      );

      const { error } =
        await supabase
          .from("saved_dos")
          .insert([payload]);

      if (error) {
        console.error(
          "Save DO error:",
          error
        );

        alert(
          `Save DO failed: ${error.message}`
        );

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

  // =========================
  // FORMAT NUMBER
  // =========================

  function money(value: number) {
    return Number(value).toLocaleString(
      "en-BD",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  }

  return (
    <div style={styles.page}>

      {/* =========================
          HEADER
      ========================= */}

      <div style={styles.header}>
        <div>
          <img
  src="/favicon_do.png"
  alt="Easy D/O"
  style={{
    width: "70px",
    height: "auto",
    objectFit: "contain",
    display: "block",
    margin: "0 auto",
  }}
/>

          <p style={styles.subtitle}>
            Feed order entry
          </p>
        </div>
      </div>

      {loading ? (
        <div style={styles.loading}>
          Loading...
        </div>
      ) : (
        <>
          {/* =========================
              FEED CATEGORY
          ========================= */}

          <div style={styles.categoryCard}>
            <div style={styles.sectionTitle}>
              Add Feed Item
            </div>

            <div style={styles.categoryGrid}>
              {categories.map(
                (category) => (
                  <button
                    key={category}
                    style={
                      styles.categoryButton
                    }
                    onClick={() =>
                      addCategory(
                        category
                      )
                    }
                  >
                    <span
                      style={
                        styles.categoryIcon
                      }
                    >
                      +
                    </span>

                    {category}
                  </button>
                )
              )}
            </div>
          </div>

          {/* =========================
              ORDER ITEMS
          ========================= */}

          <div style={styles.orderCard}>
            <div
              style={
                styles.sectionHeader
              }
            >
              <div>
                <div
                  style={
                    styles.sectionTitle
                  }
                >
                  Order Items
                </div>

                <div
                  style={
                    styles.sectionHint
                  }
                >
                  Select item and enter
                  number of bags
                </div>
              </div>

              <div
                style={styles.itemCount}
              >
                {rows.length} item
                {rows.length !== 1
                  ? "s"
                  : ""}
              </div>
            </div>

            {rows.length === 0 ? (
              <div
                style={
                  styles.emptyState
                }
              >
                <div
                  style={
                    styles.emptyIcon
                  }
                >
                  +
                </div>

                <div
                  style={
                    styles.emptyTitle
                  }
                >
                  No items added
                </div>

                <div
                  style={
                    styles.emptyText
                  }
                >
                  Select a feed category
                  above to add an item.
                </div>
              </div>
            ) : (
              <div style={styles.rows}>
                {rows.map(
                  (row, index) => {
                    const items =
                      priceList.filter(
                        (item) =>
                          item.category ===
                          row.category
                      );

                    const rowWeight =
                      getRowWeight(row);

                    const rate =
                      getTransportRate(
                        row.category
                      );

                    const transportPerBag =
                      row.item
                        ? Number(
                            row.item
                              .kg_per_bag
                          ) * rate
                        : 0;

                    const currentTotal =
                      getRowTotal(row);

                    return (
                     <div
                          key={row.id}
                          style={{
                            ...styles.orderRow,
                            background:
                              index % 2 === 0
                                ? "#ffffff"
                                : "#f1f5f9",
                          }}
                          className="easy-do-order-row"
                        >
                        <div
                          style={
                            styles.rowNumber
                          }
                        >
                          {index + 1}
                        </div>

                        {/* ITEM */}

                        <div
                          style={
                            styles.categoryColumn
                          }
                        >
                          <div
                            style={
                              styles.categoryLabel
                            }
                          >
                            {row.category}
                          </div>

                          <select
                            value={
                              row.item
                                ? String(
                                    row.item
                                      .id
                                  )
                                : ""
                            }
                            onChange={(e) =>
                              updateItem(
                                row.id,
                                e.target
                                  .value
                              )
                            }
                            style={
                              styles.select
                            }
                          >
                            <option value="">
                              Select{" "}
                              {
                                row.category
                              }{" "}
                              item
                            </option>

                            {items.map(
                              (item) => (
                                <option
                                  key={
                                    item.id
                                  }
                                  value={
                                    item.id
                                  }
                                >
                                  {
                                    item.item_name
                                  }
                                </option>
                              )
                            )}
                          </select>
                        </div>

                        {/* PRICE */}

                        <div
                          style={
                            styles.priceColumn
                          }
                        >
                          <div
                            style={
                              styles.fieldLabel
                            }
                          >
                            TP / Bag
                          </div>

                          <div
                            style={
                              styles.priceValue
                            }
                          >
                            {row.item
                              ? `৳ ${money(
                                  Number(
                                    row.item
                                      .tp_per_bag
                                  )
                                )}`
                              : "—"}
                          </div>

                          {row.item && (
                            <div
                              style={
                                styles.kgText
                              }
                            >
                              {
                                row.item
                                  .kg_per_bag
                              }{" "}
                              kg/bag
                            </div>
                          )}
                        </div>

                        {/* BAGS */}

                        <div
                          style={
                            styles.bagColumn
                          }
                        >
                          <div
                            style={
                              styles.fieldLabel
                            }
                          >
                            Bags
                          </div>

                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={
                              row.bags ||
                              ""
                            }
                            onChange={(e) =>
                              updateBags(
                                row.id,
                                Number(
                                  e.target
                                    .value
                                )
                              )
                            }
                            placeholder="0"
                            style={
                              styles.bagInput
                            }
                          />
                        </div>

                        {/* TRANSPORT */}

                        <div
                          style={
                            styles.transportColumn
                          }
                        >
                          <div
                            style={
                              styles.fieldLabel
                            }
                          >
                            Transport
                          </div>

                          <div
                            style={
                              styles.transportValue
                            }
                          >
                            {selectedTransport &&
                            row.item
                              ? `৳ ${transportPerBag.toFixed(
                                  2
                                )}/bag`
                              : "—"}
                          </div>

                          {row.item &&
                            selectedTransport && (
                              <div
                                style={
                                  styles.kgText
                                }
                              >
                                ৳{" "}
                                {rate.toFixed(
                                  2
                                )}
                                /kg
                              </div>
                            )}
                        </div>

                        {/* TOTAL */}

                        <div
                          style={
                            styles.totalColumn
                          }
                        >
                          <div
                            style={
                              styles.fieldLabel
                            }
                          >
                            Total
                          </div>

                          <div
                            style={
                              styles.rowTotal
                            }
                          >
                            ৳{" "}
                            {money(
                              currentTotal
                            )}
                          </div>

                          {transportMode ===
                            "without" &&
                            row.item &&
                            selectedTransport && (
                              <div
                                style={
                                  styles.withoutText
                                }
                              >
                                Transport
                                deducted
                              </div>
                            )}
                        </div>

                        {/* REMOVE */}

                        <button
                          style={
                            styles.removeButton
                          }
                          onClick={() =>
                            removeRow(
                              row.id
                            )
                          }
                        >
                          ×
                        </button>

                        {row.item &&
                          row.bags > 0 && (
                            <div
                              style={
                                styles.weightInfo
                              }
                            >
                              Total weight:{" "}
                              {rowWeight.toLocaleString(
                                "en-BD",
                                {
                                  maximumFractionDigits: 2,
                                }
                              )}{" "}
                              kg
                            </div>
                          )}
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>

          {/* =========================
              ADD ANOTHER
          ========================= */}

          {rows.length > 0 && (
            <div
              style={
                styles.addAnotherCard
              }
            >
              <div
                style={
                  styles.addAnotherTitle
                }
              >
                Add another item
              </div>

              <div
                style={
                  styles.addAnotherGrid
                }
              >
                {categories.map(
                  (category) => (
                    <button
                      key={category}
                      style={
                        styles.addAnotherButton
                      }
                      onClick={() =>
                        addCategory(
                          category
                        )
                      }
                    >
                      + {category}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {/* =========================
              TRANSPORTATION
          ========================= */}

          <div
            style={
              styles.transportCard
            }
          >
            <div
              style={
                styles.sectionTitle
              }
            >
              Transportation
            </div>

            <div
              style={
                styles.transportGrid
              }
            >
              <div>
                <label
                  style={
                    styles.formLabel
                  }
                >
                  From
                </label>

                <select
                  value={
                    fromLocation
                  }
                  onChange={(e) => {
                    setFromLocation(
                      e.target.value
                    );
                    setUpazila("");
                  }}
                  style={
                    styles.select
                  }
                >
                  <option value="">
                    Select From
                  </option>

                  {fromLocations.map(
                    (location) => (
                      <option
                        key={
                          location
                        }
                        value={
                          location
                        }
                      >
                        {location}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label
                  style={
                    styles.formLabel
                  }
                >
                  To / Upazila
                </label>

                <select
                  value={upazila}
                  onChange={(e) =>
                    setUpazila(
                      e.target.value
                    )
                  }
                  style={
                    styles.select
                  }
                  disabled={
                    !fromLocation
                  }
                >
                  <option value="">
                    Select Upazila
                  </option>

                  {upazilas.map(
                    (name) => (
                      <option
                        key={name}
                        value={name}
                      >
                        {name}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            {/* RATE */}

            <div
              style={
                styles.rateBox
              }
            >
              <div
                style={
                  styles.rateTitle
                }
              >
                Transportation Rate
              </div>

              {selectedTransport ? (
                <>
                  <div
                    style={
                      styles.rateLine
                    }
                  >
                    Floating / Cattle:{" "}
                    <strong>
                      ৳
                      {Number(
                        selectedTransport
                          .floating_cattle_rate_per_kg
                      ).toFixed(2)}
                      /kg
                    </strong>
                  </div>

                  <div
                    style={
                      styles.rateLine
                    }
                  >
                    Sinking / Broiler /
                    Layer / Sonali:{" "}
                    <strong>
                      ৳
                      {Number(
                        selectedTransport
                          .sinking_broiler_layer_sonali_rate_per_kg
                      ).toFixed(2)}
                      /kg
                    </strong>
                  </div>
                </>
              ) : (
                <div
                  style={
                    styles.noRate
                  }
                >
                  Select From and
                  Upazila to see rate.
                </div>
              )}
            </div>

            {/* WITH / WITHOUT */}

            <div
              style={
                styles.modeSection
              }
            >
              <div
                style={
                  styles.formLabel
                }
              >
                Price Type
              </div>

              <div
                style={
                  styles.modeGrid
                }
              >
                <button
                  onClick={() =>
                    setTransportMode(
                      "with"
                    )
                  }
                  style={{
                    ...styles.modeButton,
                    ...(transportMode ===
                    "with"
                      ? styles.modeActive
                      : {}),
                  }}
                >
                  <span
                    style={{
                      ...styles.radio,
                      ...(transportMode ===
                      "with"
                        ? styles.radioActive
                        : {}),
                    }}
                  >
                    {transportMode ===
                    "with"
                      ? "✓"
                      : ""}
                  </span>

                  <div>
                    <div
                      style={
                        styles.modeTitle
                      }
                    >
                      With Transportation
                    </div>

                    <div
                      style={
                        styles.modeHint
                      }
                    >
                      TP price as it is
                    </div>
                  </div>
                </button>

                <button
                  onClick={() =>
                    setTransportMode(
                      "without"
                    )
                  }
                  style={{
                    ...styles.modeButton,
                    ...(transportMode ===
                    "without"
                      ? styles.modeActive
                      : {}),
                  }}
                >
                  <span
                    style={{
                      ...styles.radio,
                      ...(transportMode ===
                      "without"
                        ? styles.radioActive
                        : {}),
                    }}
                  >
                    {transportMode ===
                    "without"
                      ? "✓"
                      : ""}
                  </span>

                  <div>
                    <div
                      style={
                        styles.modeTitle
                      }
                    >
                      Without Transportation
                    </div>

                    <div
                      style={
                        styles.modeHint
                      }
                    >
                      Transport cost deducted
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* =========================
              SUMMARY
          ========================= */}

          <div
            style={
              styles.summaryCard
            }
          >
            <div
              style={
                styles.summaryRow
              }
            >
              <span>
                Total Weight
              </span>

              <strong>
                {totalWeight.toLocaleString(
                  "en-BD",
                  {
                    maximumFractionDigits: 2,
                  }
                )}{" "}
                kg
              </strong>
            </div>

            <div
              style={
                styles.summaryRow
              }
            >
              <span>
                Feed Price
              </span>

              <strong>
                ৳ {money(feedPrice)}
              </strong>
            </div>

            <div
              style={
                styles.summaryRow
              }
            >
              <span>
                Transportation
              </span>

              <strong>
                {transportMode ===
                "with"
                  ? "Included in TP"
                  : selectedTransport
                  ? `- ৳ ${money(
                      totalTransportAmount
                    )}`
                  : "—"}
              </strong>
            </div>

            <div
              style={
                styles.divider
              }
            />

            {/* GRAND TOTAL */}

            <div
              style={
                styles.grandTotalRow
              }
            >
              <div>
                <div
                  style={
                    styles.grandTotalLabel
                  }
                >
                  Grand Total
                </div>

                <div
                  style={
                    styles.grandTotalHint
                  }
                >
                  {transportMode ===
                  "with"
                    ? "TP includes transportation"
                    : "Transportation deducted from TP"}
                </div>
              </div>

              <div
                style={
                  styles.grandTotalValue
                }
              >
                ৳ {money(totalAmount)}
              </div>
            </div>



            {/* =========================
                ACTION BUTTONS
            ========================= */}

            <div
              style={
                styles.actionButtons
              }
            >

              <button
  style={{
    display: "block",
    margin: "20px auto",
    width: "min(100%, 360px)",
    padding: "16px 24px",
    border: "none",
    borderRadius: "14px",
    background:
      "#374151",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: 800,
    letterSpacing: "0.2px",
    cursor: "pointer",
    boxShadow:
      "0 7px 20px rgba(17, 24, 39, 0.25)",
  }}
  onClick={openDOInformation}
>
  📝 Generate DO Message
</button>
            </div>
          </div>

          {/* =================================================
              DO INFORMATION
              CALCULATION SECTION-এর পরে
          ================================================= */}

          {showDOInformation && (
            <div
              id="do-information-section"
              style={
                styles.doInformationCard
              }
            >
              <div
                style={
                  styles.doInformationHeader
                }
              >
                <div>
                  <div
                    style={
                      styles.doInformationTitle
                    }
                  >
                    DO Information
                  </div>

                  <div
                    style={
                      styles.doInformationSubtitle
                    }
                  >
                    Enter optional information.
                    Message will update automatically.
                  </div>
                </div>

                <button
                  style={
                    styles.closeDOInformationButton
                  }
                  onClick={() => {
                    setShowDOInformation(
                      false
                    );
                  }}
                >
                  ×
                </button>
              </div>

              {/* =========================
                  AGENT INFORMATION
              ========================= */}

              <div
                style={
                  styles.formSection
                }
              >
                <div
                  style={
                    styles.formSectionTitle
                  }
                >
                  Agent Information
                </div>

                <div
                  style={
                    styles.formGrid
                  }
                >
                  <div>
                    <label
                      style={
                        styles.formLabel
                      }
                    >
                      Agent Code
                    </label>

                    <input
                      value={
                        agentCode
                      }
                      onChange={(e) =>
                        setAgentCode(
                          e.target.value
                        )
                      }
                      placeholder="Optional"
                      style={
                        styles.input
                      }
                    />
                  </div>

                  <div>
                    <label
                      style={
                        styles.formLabel
                      }
                    >
                      Agent Name
                    </label>

                    <input
                      value={
                        agentName
                      }
                      onChange={(e) =>
                        setAgentName(
                          e.target.value
                        )
                      }
                      placeholder="Optional"
                      style={
                        styles.input
                      }
                    />
                  </div>
                </div>
              </div>

              {/* =========================
                  BANK DETAILS
              ========================= */}

              <div
                style={
                  styles.formSection
                }
              >
                <div
                  style={
                    styles.bankHeader
                  }
                >
                  <div
                    style={
                      styles.formSectionTitle
                    }
                  >
                    Bank Details
                  </div>

                  <button
                    style={
                      styles.addBankButton
                    }
                    onClick={
                      addBank
                    }
                  >
                    + Add Bank
                  </button>
                </div>

                {banks.map(
                  (bank, index) => (
                    <div
                      key={
                        bank.id
                      }
                      style={
                        styles.bankCard
                      }
                    >
                      <div
                        style={
                          styles.bankNumber
                        }
                      >
                        Bank {index + 1}
                      </div>

                      <div
                        style={
                          styles.formGrid
                        }
                      >
                        <div>
                          <label
                            style={
                              styles.formLabel
                            }
                          >
                            Bank Name
                          </label>

                          <input
                            value={
                              bank.bankName
                            }
                            onChange={(
                              e
                            ) =>
                              updateBank(
                                bank.id,
                                "bankName",
                                e.target
                                  .value
                              )
                            }
                            placeholder="Optional"
                            style={
                              styles.input
                            }
                          />
                        </div>

                        <div>
                          <label
                            style={
                              styles.formLabel
                            }
                          >
                            Branch
                          </label>

                          <input
                            value={
                              bank.branch
                            }
                            onChange={(
                              e
                            ) =>
                              updateBank(
                                bank.id,
                                "branch",
                                e.target
                                  .value
                              )
                            }
                            placeholder="Optional"
                            style={
                              styles.input
                            }
                          />
                        </div>
                      </div>

                      <div
                        style={
                          styles.bankAmountRow
                        }
                      >
                        <div
                          style={{
                            flex: 1,
                          }}
                        >
                          <label
                            style={
                              styles.formLabel
                            }
                          >
                            Amount Tk
                          </label>

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              bank.amount
                            }
                            onChange={(
                              e
                            ) =>
                              updateBank(
                                bank.id,
                                "amount",
                                e.target
                                  .value
                              )
                            }
                            placeholder="Optional"
                            style={
                              styles.input
                            }
                          />
                        </div>

                        {banks.length >
                          1 && (
                          <button
                            style={
                              styles.removeBankButton
                            }
                            onClick={() =>
                              removeBank(
                                bank.id
                              )
                            }
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* =========================
                  DATE / AMOUNT / VEHICLE
              ========================= */}

              <div
                style={
                  styles.formSection
                }
              >
                <div
                  style={
                    styles.formGrid
                  }
                >
                  <div>
                    <label
                      style={
                        styles.formLabel
                      }
                    >
                      Date
                    </label>

                    <input
                      type="date"
                      value={
                        doDate
                      }
                      onChange={(e) =>
                        setDoDate(
                          e.target.value
                        )
                      }
                      style={
                        styles.input
                      }
                    />
                  </div>

                  <div>
                    <label
                      style={
                        styles.formLabel
                      }
                    >
                      DO Amount Tk
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        doAmount
                      }
                      onChange={(e) =>
                        setDoAmount(
                          e.target.value
                        )
                      }
                      style={
                        styles.input
                      }
                    />
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 10,
                  }}
                >
                  <label
                    style={
                      styles.formLabel
                    }
                  >
                    Vehicle No
                  </label>

                  <input
                    value={
                      vehicleNo
                    }
                    onChange={(e) =>
                      setVehicleNo(
                        e.target.value
                      )
                    }
                    placeholder="Optional"
                    style={
                      styles.input
                    }
                  />
                </div>
              </div>

              {/* =========================
                  GENERATED MESSAGE
              ========================= */}

              <div
                style={
                  styles.generatedSection
                }
              >
                <div
                  style={
                    styles.generatedHeader
                  }
                >
                  <div
                    style={
                      styles.formSectionTitle
                    }
                  >
                    Generated Message
                  </div>

                  <button
                    style={
                      styles.copyButton
                    }
                    onClick={
                      copyMessage
                    }
                  >
                    📋 Copy
                  </button>
                </div>

                <textarea
                  value={
                    generatedMessage
                  }
                  onChange={(e) =>
                    setGeneratedMessage(
                      e.target.value
                    )
                  }
                  style={
                    styles.messageTextarea
                  }
                />
              </div>

              {/* SAVE AGAIN */}

              <button
                style={{
                  ...styles.generateModalButton,
                  marginTop: 12,
                }}
                onClick={saveDO}
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : "💾 Save this DO"}
              </button>
            </div>
          )}
        </>
      )}

      {/* =========================
          MOBILE RESPONSIVE
      ========================= */}

      <style>
        {`
          @media (max-width: 700px) {

            .easy-do-order-row {
              grid-template-columns: 32px 1fr 32px !important;
              gap: 9px !important;
              align-items: start !important;
            }

            .easy-do-order-row > div:nth-child(2) {
              grid-column: 2;
            }

            .easy-do-order-row > div:nth-child(3),
            .easy-do-order-row > div:nth-child(4),
            .easy-do-order-row > div:nth-child(5),
            .easy-do-order-row > div:nth-child(6) {
              grid-column: 2;
            }

            .easy-do-order-row > button {
              grid-column: 3;
              grid-row: 1;
            }

            .easy-do-order-row > div:last-child {
              grid-column: 2 / -1;
            }
          }

          @media (max-width: 480px) {

            .easy-do-order-row {
              padding: 9px !important;
            }

            input,
            select,
            button {
              touch-action: manipulation;
            }
          }
        `}
      </style>
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
    marginBottom: 14,
  },

  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
    color: "#111827",
  },

  subtitle: {
    margin: "3px 0 0",
    fontSize: 12,
    color: "#6b7280",
  },

  categoryCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    boxShadow:
      "0 1px 3px rgba(0,0,0,.05)",
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: 750,
    color: "#111827",
  },

  categoryGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: 8,
    marginTop: 12,
  },

  categoryButton: {
    border:
      "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    borderRadius: 9,
    padding: "11px 9px",
    fontSize: 12,
    fontWeight: 650,
    cursor: "pointer",
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    gap: 7,
  },

  categoryIcon: {
    width: 21,
    height: 21,
    borderRadius: 6,
    background: "#111827",
    color: "#ffffff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    flexShrink: 0,
  },

  orderCard: {
    background: "#ffffff",
    border:
      "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 14,
    boxShadow:
      "0 1px 3px rgba(0,0,0,.05)",
  },

  sectionHeader: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },

  sectionHint: {
    marginTop: 3,
    fontSize: 11,
    color: "#6b7280",
  },

  itemCount: {
    background: "#f3f4f6",
    color: "#374151",
    padding: "5px 9px",
    borderRadius: 7,
    fontSize: 11,
    fontWeight: 650,
    whiteSpace: "nowrap",
  },

  emptyState: {
    border:
      "1px dashed #d1d5db",
    borderRadius: 10,
    padding: "35px 15px",
    textAlign: "center",
    background: "#fafafa",
  },

  emptyIcon: {
    margin: "0 auto 8px",
    width: 35,
    height: 35,
    borderRadius: 10,
    background: "#111827",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
  },

  emptyTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#374151",
  },

  emptyText: {
    marginTop: 3,
    fontSize: 11,
    color: "#9ca3af",
  },

  rows: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  orderRow: {
    position: "relative",
    display: "grid",
    gridTemplateColumns:
      "32px minmax(180px, 1.8fr) minmax(110px, .9fr) 85px minmax(125px, 1fr) minmax(120px, 1fr) 32px",
    gap: 9,
    alignItems: "center",
    border:
      "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 10,
    background: "#ffffff",
  },

  rowNumber: {
    width: 27,
    height: 27,
    borderRadius: 7,
    background: "#f3f4f6",
    color: "#374151",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 700,
  },

  categoryColumn: {
    minWidth: 0,
  },

  categoryLabel: {
    fontSize: 10,
    color: "#6b7280",
    marginBottom: 4,
    fontWeight: 600,
  },

  select: {
    width: "100%",
    boxSizing: "border-box",
    border:
      "1px solid #cbd5e1",
    borderRadius: 8,
    background: "#ffffff",
    color: "#111827",
    padding: "9px 8px",
    fontSize: 12,
    outline: "none",
  },

  priceColumn: {
    minWidth: 0,
  },

  fieldLabel: {
    fontSize: 10,
    color: "#6b7280",
    marginBottom: 4,
    fontWeight: 600,
  },

  priceValue: {
    fontSize: 14,
    fontWeight: 750,
    color: "#111827",
  },

  kgText: {
    marginTop: 2,
    fontSize: 9,
    color: "#9ca3af",
  },

  bagColumn: {
    minWidth: 0,
  },

  bagInput: {
    width: "100%",
    boxSizing: "border-box",
    border:
      "1px solid #cbd5e1",
    borderRadius: 8,
    background: "#ffffff",
    color: "#111827",
    padding: "9px 7px",
    fontSize: 13,
    textAlign: "center",
    outline: "none",
  },

  transportColumn: {
    minWidth: 0,
  },

  transportValue: {
    fontSize: 12,
    fontWeight: 750,
    color: "#374151",
    whiteSpace: "nowrap",
  },

  totalColumn: {
    minWidth: 0,
  },

  rowTotal: {
    fontSize: 14,
    fontWeight: 800,
    color: "#111827",
    whiteSpace: "nowrap",
  },

  withoutText: {
    marginTop: 2,
    fontSize: 8,
    color: "#b45309",
  },

  removeButton: {
    border: "none",
    background: "#fee2e2",
    color: "#991b1b",
    width: 30,
    height: 30,
    borderRadius: 7,
    fontSize: 20,
    lineHeight: 1,
    cursor: "pointer",
  },

  weightInfo: {
    gridColumn: "2 / -1",
    fontSize: 9,
    color: "#9ca3af",
    marginTop: -2,
  },

  addAnotherCard: {
    marginTop: 10,
    background: "#ffffff",
    border:
      "1px dashed #cbd5e1",
    borderRadius: 12,
    padding: 12,
  },

  addAnotherTitle: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: 650,
    marginBottom: 8,
  },

  addAnotherGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3, minmax(0, 1fr))",
    gap: 7,
  },

  addAnotherButton: {
    border:
      "1px solid #e5e7eb",
    background: "#fafafa",
    color: "#374151",
    borderRadius: 8,
    padding: "8px 6px",
    fontSize: 10,
    cursor: "pointer",
  },

  transportCard: {
    marginTop: 12,
    background: "#ffffff",
    border:
      "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 14,
    boxShadow:
      "0 1px 3px rgba(0,0,0,.05)",
  },

  transportGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: 10,
    marginTop: 12,
  },

  formLabel: {
    display: "block",
    fontSize: 11,
    fontWeight: 650,
    color: "#374151",
    marginBottom: 5,
  },

  rateBox: {
    marginTop: 12,
    padding: 12,
    background: "#f8fafc",
    border:
      "1px solid #e2e8f0",
    borderRadius: 9,
  },

  rateTitle: {
    fontSize: 12,
    fontWeight: 750,
    color: "#111827",
    marginBottom: 7,
  },

  rateLine: {
    fontSize: 11,
    color: "#475569",
    marginTop: 4,
  },

  noRate: {
    fontSize: 11,
    color: "#9ca3af",
  },

  modeSection: {
    marginTop: 14,
  },

  modeGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: 9,
  },

  modeButton: {
    border:
      "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    borderRadius: 10,
    padding: 12,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 9,
    textAlign: "left",
  },

  modeActive: {
    border:
      "2px solid #111827",
    background: "#f9fafb",
  },

  radio: {
    width: 23,
    height: 23,
    borderRadius: "50%",
    border:
      "1px solid #9ca3af",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: 12,
    fontWeight: 800,
  },

  radioActive: {
    background: "#111827",
    color: "#ffffff",
    borderColor: "#111827",
  },

  modeTitle: {
    fontSize: 12,
    fontWeight: 750,
  },

  modeHint: {
    marginTop: 2,
    fontSize: 9,
    color: "#6b7280",
  },

  summaryCard: {
    marginTop: 12,
    background: "#111827",
    color: "#ffffff",
    borderRadius: 12,
    padding: 16,
  },

  summaryRow: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 15,
    padding: "6px 0",
    fontSize: 12,
    color: "#e5e7eb",
  },

  divider: {
    height: 1,
    background: "#374151",
    margin: "8px 0",
  },

  grandTotalRow: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 15,
  },

  grandTotalLabel: {
    fontSize: 15,
    fontWeight: 800,
  },

  grandTotalHint: {
    marginTop: 3,
    fontSize: 9,
    color: "#9ca3af",
  },

  grandTotalValue: {
    fontSize: 22,
    fontWeight: 850,
    whiteSpace: "nowrap",
  },

  // =========================
  // DO AMOUNT
  // =========================

  doAmountBox: {
    marginTop: 16,
    background: "#ffffff",
    border:
      "1px solid #d1d5db",
    borderRadius: 11,
    padding: 13,
  },

  doAmountLabel: {
    display: "block",
    color: "#111827",
    fontSize: 13,
    fontWeight: 800,
    marginBottom: 4,
  },

  doAmountHint: {
    fontSize: 10,
    lineHeight: 1.4,
    color: "#6b7280",
    marginBottom: 9,
  },

  doAmountInputWrapper: {
    display: "flex",
    alignItems: "center",
    border:
      "2px solid #111827",
    borderRadius: 9,
    background: "#ffffff",
    overflow: "hidden",
  },

  currencySymbol: {
    paddingLeft: 12,
    fontSize: 17,
    fontWeight: 800,
    color: "#111827",
  },

  doAmountInput: {
    flex: 1,
    border: "none",
    outline: "none",
    background: "#ffffff",
    color: "#111827",
    padding: "11px 10px",
    fontSize: 17,
    fontWeight: 800,
  },

  customAmountWarning: {
    marginTop: 7,
    background: "#fff7ed",
    color: "#9a3412",
    padding: "7px 9px",
    borderRadius: 7,
    fontSize: 10,
    fontWeight: 700,
  },

  // =========================
  // ACTION BUTTONS
  // =========================

  actionButtons: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: 9,
    marginTop: 13,
  },

  saveDOButton: {
    border:
      "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    borderRadius: 9,
    padding: "12px 10px",
    fontSize: 12,
    fontWeight: 750,
    cursor: "pointer",
  },

  generateButton: {
    border: "none",
    background: "#111827",
    color: "#ffffff",
    borderRadius: 9,
    padding: "12px 10px",
    fontSize: 12,
    fontWeight: 750,
    cursor: "pointer",
  },

  // =========================
  // DO INFORMATION
  // =========================

  doInformationCard: {
    marginTop: 12,
    background: "#ffffff",
    border:
      "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 14,
    boxShadow:
      "0 1px 3px rgba(0,0,0,.05)",
    scrollMarginTop: 15,
  },

  doInformationHeader: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },

  doInformationTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: "#111827",
  },

  doInformationSubtitle: {
    marginTop: 3,
    fontSize: 10,
    color: "#6b7280",
  },

  closeDOInformationButton: {
    width: 32,
    height: 32,
    border: "none",
    borderRadius: "50%",
    background: "#f3f4f6",
    color: "#111827",
    fontSize: 21,
    cursor: "pointer",
    flexShrink: 0,
  },

  formSection: {
    marginTop: 12,
    padding: 12,
    border:
      "1px solid #e5e7eb",
    borderRadius: 10,
    background: "#fafafa",
  },

  formSectionTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#111827",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: 9,
    marginTop: 10,
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    border:
      "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#111827",
    borderRadius: 8,
    padding: "10px",
    fontSize: 12,
    outline: "none",
  },

  bankHeader: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 10,
  },

  addBankButton: {
    border: "none",
    background: "#111827",
    color: "#ffffff",
    borderRadius: 7,
    padding: "7px 9px",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  },

  bankCard: {
    marginTop: 9,
    background: "#ffffff",
    border:
      "1px solid #e5e7eb",
    borderRadius: 9,
    padding: 10,
  },

  bankNumber: {
    fontSize: 10,
    color: "#6b7280",
    fontWeight: 700,
    marginBottom: 4,
  },

  bankAmountRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 9,
  },

  removeBankButton: {
    border: "none",
    background: "#fee2e2",
    color: "#991b1b",
    borderRadius: 7,
    padding: "10px",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  },

  generatedSection: {
    marginTop: 13,
    padding: 12,
    border:
      "1px solid #d1d5db",
    borderRadius: 10,
    background: "#f9fafb",
  },

  generatedHeader: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },

  copyButton: {
    border: "none",
    background: "#111827",
    color: "#ffffff",
    borderRadius: 7,
    padding: "7px 10px",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  },

  messageTextarea: {
    width: "100%",
    minHeight: 260,
    boxSizing: "border-box",
    border:
      "1px solid #cbd5e1",
    borderRadius: 8,
    background: "#ffffff",
    color: "#111827",
    padding: 11,
    fontSize: 13,
    lineHeight: 1.6,
    outline: "none",
    resize: "vertical",
    fontFamily:
      "Arial, sans-serif",
  },

  generateModalButton: {
    width: "100%",
    border: "none",
    background: "#111827",
    color: "#ffffff",
    borderRadius: 9,
    padding: 13,
    marginTop: 13,
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },

  loading: {
    background: "#ffffff",
    borderRadius: 12,
    padding: 40,
    textAlign: "center",
    color: "#374151",
  },
};
