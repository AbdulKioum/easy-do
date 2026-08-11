import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type FeedPrice = {
  id: number;
  category: string;
  item_name: string;
  short_name?: string | null;
  kg_per_bag: number;
  tp_per_bag: number;
  mrp_per_bag: number;
  status: string;
  sort_order?: number;
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
  amount: string;
  date: string;
};

type SavedDO = {
  id: number;
  do_date: string | null;
  agent_code: string | null;
  agent_name: string | null;
  vehicle_no: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  bank_amount: number | null;
  do_amount: number | null;
  from_location: string | null;
  to_upazila: string | null;
  transport_mode: string | null;
  total_weight: number | null;
  total_amount: number | null;
  order_items: any;
  banks: any;
  message_text: string | null;
  created_at: string | null;
};

type EditRow = {
  id: number;
  category: string;
  item: FeedPrice | null;
  bags: number;
};

const categories = [
  "Broiler",
  "Layer",
  "Sonali",
  "Cattle",
  "Fish Floating",
  "Fish Sinking",
];

export default function SavedDOPage() {
  const [dos, setDos] = useState<SavedDO[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [selectedDO, setSelectedDO] =
    useState<SavedDO | null>(null);

  const [showView, setShowView] =
    useState(false);

  // =========================
  // EDIT DATA
  // =========================

  const [showEdit, setShowEdit] =
    useState(false);

  const [editingDO, setEditingDO] =
    useState<SavedDO | null>(null);

  const [priceList, setPriceList] =
    useState<FeedPrice[]>([]);

  const [transportList, setTransportList] =
    useState<Transport[]>([]);

  const [editRows, setEditRows] =
    useState<EditRow[]>([]);

  const [editAgentCode, setEditAgentCode] =
    useState("");

  const [editAgentName, setEditAgentName] =
    useState("");

  const [editVehicleNo, setEditVehicleNo] =
    useState("");

  const [editFromLocation, setEditFromLocation] =
    useState("");

  const [editUpazila, setEditUpazila] =
    useState("");

  const [editTransportMode, setEditTransportMode] =
    useState<"with" | "without">("with");

  const [editBanks, setEditBanks] =
    useState<BankInfo[]>([]);

  const [editGeneratedMessage, setEditGeneratedMessage] =
    useState("");

  const [savingEdit, setSavingEdit] =
    useState(false);

  // =========================
  // LOAD SAVED DOS
  // =========================

  async function loadDOs() {
    setLoading(true);

    const { data, error } = await supabase
      .from("saved_dos")
      .select("*")
      .order("id", {
        ascending: false,
      });

    if (error) {
      console.error(error);

      alert(
        `Saved DO load failed: ${error.message}`
      );
    } else {
      setDos(data || []);
    }

    setLoading(false);
  }

  // =========================
  // LOAD PRICE + TRANSPORT
  // =========================

  async function loadEditData() {
    const [priceResponse, transportResponse] =
      await Promise.all([
        supabase
          .from("feed_price_list")
          .select(
            "id, category, item_name, short_name, kg_per_bag, tp_per_bag, mrp_per_bag, status, sort_order"
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
      setPriceList(
        priceResponse.data || []
      );
    }

    if (transportResponse.error) {
      console.error(
        transportResponse.error
      );

      alert(
        "Transportation load failed."
      );
    } else {
      setTransportList(
        transportResponse.data || []
      );
    }
  }

  useEffect(() => {
    loadDOs();
    loadEditData();
  }, []);

  // =========================
  // DELETE
  // =========================

  async function deleteDO(id: number) {
    const confirmDelete =
      window.confirm(
        "Are you sure you want to delete this DO?"
      );

    if (!confirmDelete) {
      return;
    }

    const { error } =
      await supabase
        .from("saved_dos")
        .delete()
        .eq("id", id);

    if (error) {
      console.error(error);

      alert(
        `Delete failed: ${error.message}`
      );

      return;
    }

    setDos((prev) =>
      prev.filter(
        (item) => item.id !== id
      )
    );
  }

  // =========================
  // SEARCH
  // =========================

  const filteredDOs = dos.filter((item) => {
    const text = `
      ${item.agent_code || ""}
      ${item.agent_name || ""}
      ${item.vehicle_no || ""}
      ${item.from_location || ""}
      ${item.to_upazila || ""}
    `.toLowerCase();

    return text.includes(
      search.toLowerCase()
    );
  });

  // =========================
  // MONEY
  // =========================

  function money(
    value: number | null
  ) {
    return Number(value || 0).toLocaleString(
      "en-BD",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  }

  // =========================
  // ORDER ITEMS NORMALIZER
  // =========================

  function getOrderItems(
    orderItems: any
  ) {
    if (!orderItems) {
      return [];
    }

    let items = orderItems;

    if (typeof items === "string") {
      try {
        items = JSON.parse(items);
      } catch {
        return [];
      }
    }

    if (!Array.isArray(items)) {
      return [];
    }

    return items;
  }

  // =========================
  // ITEM NAME
  // =========================

  function getItemName(item: any) {
    return (
      item?.item_name ||
      item?.item ||
      item?.product_name ||
      item?.product ||
      item?.name ||
      item?.feed_name ||
      item?.description ||
      "Unknown Item"
    );
  }

  // =========================
  // QUANTITY / BAGS
  // =========================

  function getItemQuantity(item: any) {
    const bags = Number(item?.bags);

    if (!Number.isNaN(bags) && bags > 0) {
      return bags;
    }

    const quantity = Number(item?.quantity);

    if (!Number.isNaN(quantity) && quantity > 0) {
      return quantity;
    }

    const qty = Number(item?.qty);

    if (!Number.isNaN(qty) && qty > 0) {
      return qty;
    }

    const orderQuantity = Number(
      item?.order_quantity
    );

    if (
      !Number.isNaN(orderQuantity) &&
      orderQuantity > 0
    ) {
      return orderQuantity;
    }

    return 0;
  }

  // =========================
  // GET SHORT NAME
  // =========================

  function getFeedShortName(
    item: FeedPrice
  ) {
    if (item.short_name?.trim()) {
      return item.short_name.trim();
    }

    return item.item_name;
  }

  // =========================
  // EDIT ROW
  // =========================

  function addEditCategory(
    category: string
  ) {
    const newRow: EditRow = {
      id:
        Date.now() +
        Math.random(),

      category,

      item: null,

      bags: 0,
    };

    setEditRows((prev) => [
      ...prev,
      newRow,
    ]);
  }

  function removeEditRow(
    rowId: number
  ) {
    setEditRows((prev) =>
      prev.filter(
        (row) =>
          row.id !== rowId
      )
    );
  }

  function updateEditItem(
    rowId: number,
    itemId: string
  ) {
    const item =
      priceList.find(
        (price) =>
          String(price.id) ===
          itemId
      ) || null;

    setEditRows((prev) =>
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

  function updateEditBags(
    rowId: number,
    bags: number
  ) {
    setEditRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              bags:
                bags < 0
                  ? 0
                  : bags,
            }
          : row
      )
    );
  }

  // =========================
  // TRANSPORT
  // =========================

  const selectedEditTransport =
    useMemo(() => {
      if (
        !editFromLocation ||
        !editUpazila
      ) {
        return null;
      }

      return (
        transportList.find(
          (transport) =>
            transport.from_location ===
              editFromLocation &&
            transport.to_upazila ===
              editUpazila
        ) || null
      );
    }, [
      transportList,
      editFromLocation,
      editUpazila,
    ]);

  function getEditTransportRate(
    category: string
  ) {
    if (!selectedEditTransport) {
      return 0;
    }

    if (
      category ===
        "Fish Floating" ||
      category === "Cattle"
    ) {
      return Number(
        selectedEditTransport
          .floating_cattle_rate_per_kg
      );
    }

    return Number(
      selectedEditTransport
        .sinking_broiler_layer_sonali_rate_per_kg
    );
  }

  function getEditRowWeight(
    row: EditRow
  ) {
    if (
      !row.item ||
      !row.bags
    ) {
      return 0;
    }

    return (
      Number(
        row.item.kg_per_bag
      ) *
      Number(row.bags)
    );
  }

  function getEditRowTransport(
    row: EditRow
  ) {
    if (
      editTransportMode !==
        "without" ||
      !row.item ||
      !row.bags ||
      !selectedEditTransport
    ) {
      return 0;
    }

    const weight =
      getEditRowWeight(row);

    const rate =
      getEditTransportRate(
        row.category
      );

    return weight * rate;
  }

  function getEditRowTotal(
    row: EditRow
  ) {
    if (
      !row.item ||
      !row.bags
    ) {
      return 0;
    }

    const tpTotal =
      Number(
        row.item.tp_per_bag
      ) *
      Number(row.bags);

    if (
      editTransportMode ===
      "with"
    ) {
      return tpTotal;
    }

    return (
      tpTotal -
      getEditRowTransport(row)
    );
  }

  const editTotalWeight =
    useMemo(() => {
      return editRows.reduce(
        (total, row) =>
          total +
          getEditRowWeight(row),
        0
      );
    }, [editRows]);

  const editFeedPrice =
    useMemo(() => {
      return editRows.reduce(
        (total, row) =>
          total +
          (row.item
            ? Number(
                row.item.tp_per_bag
              ) *
              Number(row.bags)
            : 0),
        0
      );
    }, [editRows]);

  const editTotalTransport =
    useMemo(() => {
      if (
        !selectedEditTransport
      ) {
        return 0;
      }

      return editRows.reduce(
        (total, row) =>
          total +
          getEditRowWeight(
            row
          ) *
            getEditTransportRate(
              row.category
            ),
        0
      );
    }, [
      editRows,
      selectedEditTransport,
    ]);

  const editTotalAmount =
    useMemo(() => {
      return editRows.reduce(
        (total, row) =>
          total +
          getEditRowTotal(row),
        0
      );
    }, [
      editRows,
      editTransportMode,
      selectedEditTransport,
    ]);

  // =========================
  // FROM LOCATIONS
  // =========================

  const editFromLocations =
    useMemo(() => {
      return Array.from(
        new Set(
          transportList
            .map(
              (item) =>
                item.from_location
            )
            .filter(Boolean)
        )
      );
    }, [transportList]);

  // =========================
  // UPAZILA
  // =========================

  const editUpazilas =
    useMemo(() => {
      const filtered =
        editFromLocation
          ? transportList.filter(
              (item) =>
                item.from_location ===
                editFromLocation
            )
          : transportList;

      return Array.from(
        new Set(
          filtered
            .map(
              (item) =>
                item.to_upazila
            )
            .filter(Boolean)
        )
      );
    }, [
      transportList,
      editFromLocation,
    ]);

  // =========================
  // BANK
  // =========================

  function addEditBank() {
    setEditBanks((prev) => [
      ...prev,
      {
        id:
          Date.now() +
          Math.random(),

        bankName: "",

        branch: "",

        amount: "",

        date:
          new Date()
            .toISOString()
            .split("T")[0],
      },
    ]);
  }

  function removeEditBank(
    id: number
  ) {
    setEditBanks((prev) =>
      prev.filter(
        (bank) =>
          bank.id !== id
      )
    );
  }

  function updateEditBank(
    id: number,
    field: keyof BankInfo,
    value: string
  ) {
    setEditBanks((prev) =>
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
  // BUILD MESSAGE
  // =========================

  function buildEditMessage() {
    const finalAgentCode =
      editAgentCode.trim() ||
      "[Agent Code]";

    const finalAgentName =
      editAgentName.trim() ||
      "[Agent Name]";

    const finalVehicle =
      editVehicleNo.trim() ||
      "[Vehicle No]";

    const validBanks =
      editBanks.filter(
        (bank) =>
          bank.bankName.trim() ||
          bank.branch.trim() ||
          bank.amount.trim() ||
          bank.date.trim()
      );

    let bankText = "";

    if (!validBanks.length) {
      bankText =
        "[Bank Details]";
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
                ).toLocaleString(
                  "en-BD",
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }
                )}`
              : "[Bank Amount]";

          const date =
            bank.date.trim() ||
            "[Date]";

          return `${bankName}
${branch}
${amount}
${date}`;
        })
        .join("\n\n");
    }

    const validRows =
      editRows.filter(
        (row) =>
          row.item &&
          row.bags > 0
      );

    let feedText = "";

    if (!validRows.length) {
      feedText =
        "[Feed Details]";
    } else {
      feedText = validRows
        .map((row) => {
          const name =
            getFeedShortName(
              row.item as FeedPrice
            );

          return `${name} - ${row.bags} bag${
            row.bags !== 1
              ? "s"
              : ""
          }`;
        })
        .join("\n");
    }

    const finalFrom =
      editFromLocation.trim() ||
      "[Feed Mill / Depot]";

    return `Code: ${finalAgentCode}, ${finalAgentName}

${bankText}

${feedText}

Vehicle No: ${finalVehicle}
From: ${finalFrom}`;
  }

  // =========================
  // OPEN EDIT
  // =========================

  function openEditDO(
    item: SavedDO
  ) {
    setEditingDO(item);

    setShowView(false);

    setEditAgentCode(
      item.agent_code || ""
    );

    setEditAgentName(
      item.agent_name || ""
    );

    setEditVehicleNo(
      item.vehicle_no || ""
    );

    setEditFromLocation(
      item.from_location || ""
    );

    setEditUpazila(
      item.to_upazila || ""
    );

    setEditTransportMode(
      item.transport_mode ===
        "without"
        ? "without"
        : "with"
    );

    // =========================
    // BANK DATA
    // =========================

    let savedBanks =
      item.banks;

    if (
      typeof savedBanks ===
      "string"
    ) {
      try {
        savedBanks =
          JSON.parse(
            savedBanks
          );
      } catch {
        savedBanks = [];
      }
    }

    if (
      Array.isArray(
        savedBanks
      ) &&
      savedBanks.length > 0
    ) {
      setEditBanks(
        savedBanks.map(
          (
            bank: any,
            index: number
          ) => ({
            id:
              Date.now() +
              index +
              Math.random(),

            bankName:
              bank.bankName ||
              bank.bank_name ||
              "",

            branch:
              bank.branch ||
              bank.bank_branch ||
              "",

            amount:
              bank.amount != null
                ? String(
                    bank.amount
                  )
                : "",

            date:
              bank.date ||
              bank.do_date ||
              item.do_date ||
              new Date()
                .toISOString()
                .split("T")[0],
          })
        )
      );
    } else {
      setEditBanks([
        {
          id:
            Date.now(),

          bankName:
            item.bank_name ||
            "",

          branch:
            item.bank_branch ||
            "",

          amount:
            item.bank_amount !=
            null
              ? String(
                  item.bank_amount
                )
              : "",

          date:
            item.do_date ||
            new Date()
              .toISOString()
              .split("T")[0],
        },
      ]);
    }

    // =========================
    // ORDER ITEMS
    // =========================

    const savedItems =
      getOrderItems(
        item.order_items
      );

    const convertedRows: EditRow[] =
      savedItems.map(
        (
          savedItem: any,
          index: number
        ) => {
          const category =
            savedItem?.category ||
            "";

          const itemId =
            savedItem?.item_id;

          let matchedItem =
            null;

          if (itemId != null) {
            matchedItem =
              priceList.find(
                (price) =>
                  String(
                    price.id
                  ) ===
                  String(itemId)
              ) || null;
          }

          if (
            !matchedItem &&
            savedItem?.item_name
          ) {
            matchedItem =
              priceList.find(
                (price) =>
                  price.item_name ===
                  savedItem.item_name
              ) || null;
          }

          return {
            id:
              Date.now() +
              index +
              Math.random(),

            category,

            item:
              matchedItem,

            bags: Number(
              savedItem?.bags ??
                savedItem?.quantity ??
                savedItem?.qty ??
                savedItem?.order_quantity ??
                0
            ),
          };
        }
      );

    setEditRows(
      convertedRows
    );

    setEditGeneratedMessage(
      item.message_text ||
        ""
    );

    setShowEdit(true);
  }

  // =========================
  // AUTO MESSAGE UPDATE
  // =========================

  useEffect(() => {
    if (!showEdit) {
      return;
    }

    setEditGeneratedMessage(
      buildEditMessage()
    );
  }, [
    showEdit,
    editAgentCode,
    editAgentName,
    editVehicleNo,
    editBanks,
    editRows,
    editFromLocation,
    editUpazila,
    editTransportMode,
  ]);

  // =========================
  // SAVE EDIT
  // =========================

  async function updateSavedDO() {
    if (
      savingEdit ||
      !editingDO
    ) {
      return;
    }

    const validRows =
      editRows.filter(
        (row) =>
          row.item &&
          row.bags > 0
      );

    if (
      validRows.length === 0
    ) {
      alert(
        "Please select feed item and enter bags."
      );
      return;
    }

    setSavingEdit(true);

    try {
      const validBanks =
        editBanks.filter(
          (bank) =>
            bank.bankName.trim() ||
            bank.branch.trim() ||
            bank.amount.trim() ||
            bank.date.trim()
        );

      const bankDetails =
        validBanks
          .map((bank) => {
            return `${bank.bankName || "[Bank Name]"}\n${
              bank.branch ||
              "[Branch]"
            }\n${
              bank.amount
                ? `৳ ${Number(
                    bank.amount
                  ).toLocaleString(
                    "en-BD",
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }
                  )}`
                : "[Bank Amount]"
            }\n${
              bank.date ||
              "[Date]"
            }`;
          })
          .join("\n\n");

      const orderItems =
        validRows.map(
          (row) => ({
            category:
              row.category,

            item_id:
              row.item?.id ||
              null,

            item_name:
              row.item?.item_name ||
              "",

            short_name:
              row.item?.short_name ||
              "",

            bags:
              Number(row.bags),

            kg_per_bag:
              Number(
                row.item?.kg_per_bag ||
                  0
              ),

            tp_per_bag:
              Number(
                row.item?.tp_per_bag ||
                  0
              ),

            weight:
              getEditRowWeight(
                row
              ),

            transport:
              getEditRowTransport(
                row
              ),

            total:
              getEditRowTotal(
                row
              ),
          })
        );

      const firstBank =
        validBanks.length > 0
          ? validBanks[0]
          : null;

      const firstBankDate =
        firstBank?.date ||
        null;

      const finalMessage =
        editGeneratedMessage ||
        buildEditMessage();

      const payload = {
        // Keep old DB field compatible.
        // First bank date is used as do_date.
        do_date:
          firstBankDate,

        agent_info:
          `${editAgentCode.trim()}, ${editAgentName.trim()}`.replace(
            /^,\s*|\s*,\s*$/g,
            ""
          ) || null,

        vehicle_number:
          editVehicleNo.trim() ||
          null,

        bank_details:
          bankDetails || null,

        // DO Amount is no longer used.
        // Keep field as 0 for old DB compatibility.
        do_amount: 0,

        from_location:
          editFromLocation ||
          null,

        to_upazila:
          editUpazila ||
          null,

        transport_mode:
          editTransportMode,

        total_weight:
          Number(
            editTotalWeight.toFixed(
              2
            )
          ),

        total_amount:
          Number(
            editTotalAmount.toFixed(
              2
            )
          ),

        order_items:
          orderItems,

        agent_code:
          editAgentCode.trim() ||
          null,

        agent_name:
          editAgentName.trim() ||
          null,

        vehicle_no:
          editVehicleNo.trim() ||
          null,

        bank_name:
          firstBank?.bankName.trim() ||
          null,

        bank_branch:
          firstBank?.branch.trim() ||
          null,

        bank_amount:
          firstBank?.amount
            ? Number(
                firstBank.amount
              )
            : 0,

        banks:
          validBanks,

        message_text:
          finalMessage,
      };

      console.log(
        "Updating DO:",
        payload
      );

      const { error } =
        await supabase
          .from("saved_dos")
          .update(payload)
          .eq(
            "id",
            editingDO.id
          );

      if (error) {
        console.error(
          "Update DO error:",
          error
        );

        alert(
          `Update DO failed: ${error.message}`
        );

        return;
      }

      alert(
        "DO updated successfully."
      );

      setShowEdit(false);
      setEditingDO(null);

      await loadDOs();
    } catch (error) {
      console.error(error);

      alert(
        "Something went wrong while updating DO."
      );
    } finally {
      setSavingEdit(false);
    }
  }

  // =========================
  // COPY EDIT MESSAGE
  // =========================

  async function copyEditMessage() {
    if (
      !editGeneratedMessage
    ) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        editGeneratedMessage
      );

      alert(
        "DO Message copied."
      );
    } catch (error) {
      console.error(error);

      alert(
        "Copy failed."
      );
    }
  }

  return (
    <div style={styles.page}>

      {/* HEADER */}

      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            Saved DO
          </h1>

          <p style={styles.subtitle}>
            Manage saved delivery orders
          </p>
        </div>

        <div style={styles.count}>
          {filteredDOs.length} DO
          {filteredDOs.length !== 1
            ? "s"
            : ""}
        </div>
      </div>

      {/* SEARCH */}

      <div style={styles.searchCard}>
        <input
          value={search}
          onChange={(e) =>
            setSearch(
              e.target.value
            )
          }
          placeholder="Search agent, vehicle, location..."
          style={styles.search}
        />
      </div>

      {/* LIST */}

      {loading ? (
        <div style={styles.empty}>
          Loading...
        </div>
      ) : filteredDOs.length ===
        0 ? (
        <div style={styles.empty}>
          <strong>
            No Saved DO Found
          </strong>

          <span>
            Saved DOs will appear here.
          </span>
        </div>
      ) : (
        <div style={styles.list}>
          {filteredDOs.map(
            (item) => (
              <div
                key={item.id}
                style={styles.card}
              >

                {/* CARD TOP */}

                <div
                  style={
                    styles.cardTop
                  }
                >
                  <div>
                    <div
                      style={
                        styles.doNumber
                      }
                    >
                      DO #{item.id}
                    </div>

                    <div
                      style={
                        styles.date
                      }
                    >
                      {item.do_date ||
                        "No date"}
                    </div>
                  </div>

                  <div
                    style={
                      styles.amount
                    }
                  >
                    ৳{" "}
                    {money(
                      item.total_amount
                    )}
                  </div>
                </div>

                {/* INFO */}

                <div
                  style={
                    styles.info
                  }
                >
                  <div>
                    <span
                      style={
                        styles.infoLabel
                      }
                    >
                      Agent
                    </span>

                    <strong
                      style={
                        styles.infoValue
                      }
                    >
                      {item.agent_name ||
                        item.agent_code ||
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span
                      style={
                        styles.infoLabel
                      }
                    >
                      Vehicle
                    </span>

                    <strong
                      style={
                        styles.infoValue
                      }
                    >
                      {item.vehicle_no ||
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span
                      style={
                        styles.infoLabel
                      }
                    >
                      Route
                    </span>

                    <strong
                      style={
                        styles.infoValue
                      }
                    >
                      {item.from_location ||
                        "—"}{" "}
                      →{" "}
                      {item.to_upazila ||
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span
                      style={
                        styles.infoLabel
                      }
                    >
                      Total
                    </span>

                    <strong
                      style={
                        styles.infoValue
                      }
                    >
                      ৳{" "}
                      {money(
                        item.total_amount
                      )}
                    </strong>
                  </div>
                </div>

                {/* ACTIONS */}

                <div
                  style={
                    styles.actions
                  }
                >
                  <button
                    style={
                      styles.viewButton
                    }
                    onClick={() => {
                      setSelectedDO(
                        item
                      );

                      setShowView(
                        true
                      );
                    }}
                  >
                    👁 View
                  </button>

                  <button
                    style={
                      styles.editButton
                    }
                    onClick={() =>
                      openEditDO(
                        item
                      )
                    }
                  >
                    ✏ Edit
                  </button>

                  <button
                    style={
                      styles.deleteButton
                    }
                    onClick={() =>
                      deleteDO(
                        item.id
                      )
                    }
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* =========================
          VIEW POPUP
      ========================= */}

      {showView &&
        selectedDO && (
          <div
            style={
              styles.overlay
            }
            onClick={() =>
              setShowView(false)
            }
          >
            <div
              style={
                styles.modal
              }
              onClick={(e) =>
                e.stopPropagation()
              }
            >

              {/* MODAL HEADER */}

              <div
                style={
                  styles.modalHeader
                }
              >
                <div>
                  <h2
                    style={
                      styles.modalTitle
                    }
                  >
                    DO #
                    {
                      selectedDO.id
                    }
                  </h2>

                  <div
                    style={
                      styles.date
                    }
                  >
                    {selectedDO.do_date ||
                      "No date"}
                  </div>
                </div>

                <button
                  style={
                    styles.close
                  }
                  onClick={() =>
                    setShowView(
                      false
                    )
                  }
                >
                  ×
                </button>
              </div>

              {/* BASIC DETAILS */}

              <div
                style={
                  styles.details
                }
              >
                <Detail
                  label="Agent Code"
                  value={
                    selectedDO.agent_code
                  }
                />

                <Detail
                  label="Agent Name"
                  value={
                    selectedDO.agent_name
                  }
                />

                <Detail
                  label="Vehicle No"
                  value={
                    selectedDO.vehicle_no
                  }
                />

                <Detail
                  label="From"
                  value={
                    selectedDO.from_location
                  }
                />

                <Detail
                  label="To / Upazila"
                  value={
                    selectedDO.to_upazila
                  }
                />

                <Detail
                  label="Transport Mode"
                  value={
                    selectedDO.transport_mode
                  }
                />

                <Detail
                  label="Total Weight"
                  value={`${selectedDO.total_weight || 0} kg`}
                />
              </div>

              {/* ORDERED ITEMS */}

              <div
                style={
                  styles.itemsSection
                }
              >
                <div
                  style={
                    styles.sectionTitle
                  }
                >
                  📦 Ordered Items
                </div>

                {getOrderItems(
                  selectedDO.order_items
                ).length === 0 ? (
                  <div
                    style={
                      styles.noItems
                    }
                  >
                    No ordered items
                    found.
                  </div>
                ) : (
                  <div
                    style={
                      styles.itemsTable
                    }
                  >
                    <div
                      style={
                        styles.itemHeader
                      }
                    >
                      <div>
                        Item
                      </div>

                      <div
                        style={
                          styles.qtyHeader
                        }
                      >
                        Bags
                      </div>
                    </div>

                    {getOrderItems(
                      selectedDO.order_items
                    ).map(
                      (
                        orderItem: any,
                        index: number
                      ) => (
                        <div
                          key={index}
                          style={
                            styles.itemRow
                          }
                        >
                          <div
                            style={
                              styles.itemName
                            }
                          >
                            {getItemName(
                              orderItem
                            )}
                          </div>

                          <div
                            style={
                              styles.itemQuantity
                            }
                          >
                            {getItemQuantity(
                              orderItem
                            )}{" "}
                            bag
                            {Number(
                              getItemQuantity(
                                orderItem
                              )
                            ) !== 1
                              ? "s"
                              : ""}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* AMOUNTS */}

              <div
                style={
                  styles.amountSection
                }
              >
                <Detail
                  label="Total Amount"
                  value={`৳ ${money(
                    selectedDO.total_amount
                  )}`}
                />

                <Detail
                  label="Bank Amount"
                  value={`৳ ${money(
                    selectedDO.bank_amount
                  )}`}
                />
              </div>

              {/* BANK */}

              <div
                style={
                  styles.bankSection
                }
              >
                <div
                  style={
                    styles.sectionTitle
                  }
                >
                  🏦 Bank Information
                </div>

                <Detail
                  label="Bank"
                  value={
                    selectedDO.bank_name
                  }
                />

                <Detail
                  label="Branch"
                  value={
                    selectedDO.bank_branch
                  }
                />
              </div>

              {/* DO MESSAGE */}

              <div
                style={
                  styles.messageBox
                }
              >
                <strong>
                  DO Message
                </strong>

                <textarea
                  readOnly
                  value={
                    selectedDO.message_text ||
                    ""
                  }
                  style={
                    styles.message
                  }
                />

                <button
                  style={
                    styles.copyButton
                  }
                  onClick={async () => {
                    await navigator.clipboard.writeText(
                      selectedDO.message_text ||
                        ""
                    );

                    alert(
                      "Message copied."
                    );
                  }}
                >
                  📋 Copy Message
                </button>
              </div>

            </div>
          </div>
        )}

      {/* =========================
          EDIT POPUP
      ========================= */}

      {showEdit &&
        editingDO && (
          <div
            style={
              styles.overlay
            }
          >
            <div
              style={
                styles.editModal
              }
            >

              {/* EDIT HEADER */}

              <div
                style={
                  styles.modalHeader
                }
              >
                <div
                  style={
                    styles.editHeaderContent
                  }
                >
                  <h2
                    style={
                      styles.modalTitle
                    }
                  >
                    ✏ Edit DO #
                    {
                      editingDO.id
                    }
                  </h2>

                  <div
                    style={
                      styles.editHeaderSubtitle
                    }
                  >
                    Update delivery
                    order information
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="Close Edit DO"
                  style={
                    styles.close
                  }
                  onClick={() => {
                    setShowEdit(
                      false
                    );

                    setEditingDO(
                      null
                    );
                  }}
                >
                  ×
                </button>
              </div>

              {/* FEED ITEMS */}

              <div
                style={
                  styles.editSection
                }
              >
                <div
                  style={
                    styles.editSectionHeader
                  }
                >
                  <div
                    style={
                      styles.editSectionTitle
                    }
                  >
                    Feed Items
                  </div>

                  <span
                    style={
                      styles.itemCount
                    }
                  >
                    {
                      editRows.length
                    }{" "}
                    item
                    {editRows.length !==
                    1
                      ? "s"
                      : ""}
                  </span>
                </div>

                {editRows.map(
                  (
                    row,
                    index
                  ) => {
                    const items =
                      priceList.filter(
                        (item) =>
                          item.category ===
                          row.category
                      );

                    const rowTotal =
                      getEditRowTotal(
                        row
                      );

                    return (
                      <div
                        key={
                          row.id
                        }
                        style={
                          styles.editRow
                        }
                      >
                        <div
                          style={
                            styles.editRowNumber
                          }
                        >
                          {index +
                            1}
                        </div>

                        <div
                          style={
                            styles.editRowMain
                          }
                        >
                          <div
                            style={
                              styles.smallLabel
                            }
                          >
                            {
                              row.category
                            }
                          </div>

                          <select
                            value={
                              row.item
                                ? String(
                                    row
                                      .item
                                      .id
                                  )
                                : ""
                            }
                            onChange={(
                              e
                            ) =>
                              updateEditItem(
                                row.id,
                                e.target
                                  .value
                              )
                            }
                            style={
                              styles.input
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
                              (
                                feedItem
                              ) => (
                                <option
                                  key={
                                    feedItem.id
                                  }
                                  value={
                                    feedItem.id
                                  }
                                >
                                  {
                                    feedItem.item_name
                                  }
                                </option>
                              )
                            )}
                          </select>
                        </div>

                        <div
                          style={
                            styles.editBags
                          }
                        >
                          <div
                            style={
                              styles.smallLabel
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
                            onChange={(
                              e
                            ) =>
                              updateEditBags(
                                row.id,
                                Number(
                                  e
                                    .target
                                    .value
                                )
                              )
                            }
                            style={
                              styles.input
                            }
                          />
                        </div>

                        <div
                          style={
                            styles.editRowTotal
                          }
                        >
                          ৳{" "}
                          {money(
                            rowTotal
                          )}
                        </div>

                        <button
                          type="button"
                          style={
                            styles.removeButton
                          }
                          onClick={() =>
                            removeEditRow(
                              row.id
                            )
                          }
                        >
                          ×
                        </button>
                      </div>
                    );
                  }
                )}

                {/* ADD ITEM */}

                <div
                  style={
                    styles.addItemBox
                  }
                >
                  <div
                    style={
                      styles.smallLabel
                    }
                  >
                    Add another item
                  </div>

                  <div
                    style={
                      styles.categoryGrid
                    }
                  >
                    {categories.map(
                      (
                        category
                      ) => (
                        <button
                          type="button"
                          key={
                            category
                          }
                          style={
                            styles.addCategoryButton
                          }
                          onClick={() =>
                            addEditCategory(
                              category
                            )
                          }
                        >
                          +{" "}
                          {category}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* TRANSPORT */}

              <div
                style={
                  styles.editSection
                }
              >
                <div
                  style={
                    styles.editSectionTitle
                  }
                >
                  Transportation
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
                      From
                    </label>

                    <select
                      value={
                        editFromLocation
                      }
                      onChange={(
                        e
                      ) => {
                        setEditFromLocation(
                          e.target
                            .value
                        );

                        setEditUpazila(
                          ""
                        );
                      }}
                      style={
                        styles.input
                      }
                    >
                      <option value="">
                        Select From
                      </option>

                      {editFromLocations.map(
                        (
                          location
                        ) => (
                          <option
                            key={
                              location
                            }
                            value={
                              location
                            }
                          >
                            {
                              location
                            }
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
                      value={
                        editUpazila
                      }
                      onChange={(
                        e
                      ) =>
                        setEditUpazila(
                          e.target
                            .value
                        )
                      }
                      style={
                        styles.input
                      }
                      disabled={
                        !editFromLocation
                      }
                    >
                      <option value="">
                        Select Upazila
                      </option>

                      {editUpazilas.map(
                        (
                          name
                        ) => (
                          <option
                            key={
                              name
                            }
                            value={
                              name
                            }
                          >
                            {name}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>

                <div
                  style={
                    styles.modeGrid
                  }
                >
                  <button
                    type="button"
                    onClick={() =>
                      setEditTransportMode(
                        "with"
                      )
                    }
                    style={{
                      ...styles.modeButton,
                      ...(editTransportMode ===
                      "with"
                        ? styles.modeActive
                        : {}),
                    }}
                  >
                    <span
                      style={{
                        ...styles.radio,
                        ...(editTransportMode ===
                        "with"
                          ? styles.radioActive
                          : {}),
                      }}
                    >
                      {editTransportMode ===
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
                        With
                        Transportation
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
                    type="button"
                    onClick={() =>
                      setEditTransportMode(
                        "without"
                      )
                    }
                    style={{
                      ...styles.modeButton,
                      ...(editTransportMode ===
                      "without"
                        ? styles.modeActive
                        : {}),
                    }}
                  >
                    <span
                      style={{
                        ...styles.radio,
                        ...(editTransportMode ===
                        "without"
                          ? styles.radioActive
                          : {}),
                      }}
                    >
                      {editTransportMode ===
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
                        Without
                        Transportation
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

                {selectedEditTransport && (
                  <div
                    style={
                      styles.rateBox
                    }
                  >
                    <div
                      style={
                        styles.rateLine
                      }
                    >
                      Floating /
                      Cattle:{" "}
                      <strong>
                        ৳
                        {Number(
                          selectedEditTransport
                            .floating_cattle_rate_per_kg
                        ).toFixed(
                          2
                        )}
                        /kg
                      </strong>
                    </div>

                    <div
                      style={
                        styles.rateLine
                      }
                    >
                      Sinking /
                      Broiler /
                      Layer /
                      Sonali:{" "}
                      <strong>
                        ৳
                        {Number(
                          selectedEditTransport
                            .sinking_broiler_layer_sonali_rate_per_kg
                        ).toFixed(
                          2
                        )}
                        /kg
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              

              {/* SUMMARY */}

              <div
                style={
                  styles.editSummary
                }
              >
                <Detail
                  label="Total Weight"
                  value={`${editTotalWeight.toLocaleString(
                    "en-BD",
                    {
                      maximumFractionDigits: 2,
                    }
                  )} kg`}
                />

                <Detail
                  label="Feed Price"
                  value={`৳ ${money(
                    editFeedPrice
                  )}`}
                />

                <Detail
                  label="Transportation"
                  value={
                    editTransportMode ===
                    "with"
                      ? "Included in TP"
                      : `- ৳ ${money(
                          editTotalTransport
                        )}`
                  }
                />

                <div
                  style={
                    styles.editGrandTotal
                  }
                >
                  <span>
                    Grand Total
                  </span>

                  <strong>
                    ৳{" "}
                    {money(
                      editTotalAmount
                    )}
                  </strong>
                </div>
              </div>

              {/* AGENT */}

              <div
                style={
                  styles.editSection
                }
              >
                <div
                  style={
                    styles.editSectionTitle
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
                        editAgentCode
                      }
                      onChange={(e) =>
                        setEditAgentCode(
                          e.target
                            .value
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
                      Agent Name
                    </label>

                    <input
                      value={
                        editAgentName
                      }
                      onChange={(e) =>
                        setEditAgentName(
                          e.target
                            .value
                        )
                      }
                      style={
                        styles.input
                      }
                    />
                  </div>
                </div>
              </div>



              {/* BANK INFORMATION */}

              <div
                style={
                  styles.editSection
                }
              >
                <div
                  style={
                    styles.editSectionHeader
                  }
                >
                  <div
                    style={
                      styles.editSectionTitle
                    }
                  >
                    🏦 Bank Information
                  </div>

                  <button
                    type="button"
                    style={
                      styles.addBankButton
                    }
                    onClick={
                      addEditBank
                    }
                  >
                    + Add Bank
                  </button>
                </div>

                {editBanks.map(
                  (
                    bank,
                    index
                  ) => (
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
                        Bank{" "}
                        {index + 1}
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
                              updateEditBank(
                                bank.id,
                                "bankName",
                                e.target
                                  .value
                              )
                            }
                            placeholder="Bank Name"
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
                              updateEditBank(
                                bank.id,
                                "branch",
                                e.target
                                  .value
                              )
                            }
                            placeholder="Branch"
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
                            Amount
                          </label>

                          <input
                            type="number"
                            min="0"
                            value={
                              bank.amount
                            }
                            onChange={(
                              e
                            ) =>
                              updateEditBank(
                                bank.id,
                                "amount",
                                e.target
                                  .value
                              )
                            }
                            placeholder="Amount"
                            style={
                              styles.input
                            }
                          />
                        </div>

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
                            Date
                          </label>

                          <input
                            type="date"
                            value={
                              bank.date
                            }
                            onChange={(
                              e
                            ) =>
                              updateEditBank(
                                bank.id,
                                "date",
                                e.target
                                  .value
                              )
                            }
                            style={
                              styles.input
                            }
                          />
                        </div>

                        <button
                          type="button"
                          style={
                            styles.removeBankButton
                          }
                          onClick={() =>
                            removeEditBank(
                              bank.id
                            )
                          }
                        >
                          🗑 Remove
                        </button>
                      </div>
                    </div>
                  )
                )}

                {editBanks.length ===
                  0 && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: 10,
                      background:
                        "#ffffff",
                      border:
                        "1px dashed #cbd5e1",
                      borderRadius: 8,
                      textAlign:
                        "center",
                      fontSize: 11,
                      color:
                        "#6b7280",
                    }}
                  >
                    No bank added.
                    Click "+ Add Bank"
                    to add bank
                    information.
                  </div>
                )}
              </div>


              {/* VEHICLE */}

              <div
                style={
                  styles.editSection
                }
              >
                <div
                  style={
                    styles.editSectionTitle
                  }
                >
                  Vehicle Information
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
                      Vehicle No
                    </label>

                    <input
                      value={
                        editVehicleNo
                      }
                      onChange={(e) =>
                        setEditVehicleNo(
                          e.target
                            .value
                        )
                      }
                      placeholder="Vehicle No"
                      style={
                        styles.input
                      }
                    />
                  </div>
                </div>
              </div>

              {/* GENERATED MESSAGE */}

              <div
                style={
                  styles.messageBox
                }
              >
                <div
                  style={
                    styles.editSectionHeader
                  }
                >
                  <strong>
                    Generated Message
                  </strong>

                  <button
                    type="button"
                    style={
                      styles.copySmallButton
                    }
                    onClick={
                      copyEditMessage
                    }
                  >
                    📋 Copy
                  </button>
                </div>

                <textarea
                  value={
                    editGeneratedMessage
                  }
                  onChange={(e) =>
                    setEditGeneratedMessage(
                      e.target
                        .value
                    )
                  }
                  style={
                    styles.message
                  }
                />
              </div>

              {/* SAVE / CANCEL */}

              <div
                style={
                  styles.editActions
                }
              >
                <button
                  type="button"
                  style={
                    styles.cancelEditButton
                  }
                  onClick={() => {
                    setShowEdit(
                      false
                    );

                    setEditingDO(
                      null
                    );
                  }}
                  disabled={
                    savingEdit
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  style={
                    styles.saveEditButton
                  }
                  onClick={
                    updateSavedDO
                  }
                  disabled={
                    savingEdit
                  }
                >
                  {savingEdit
                    ? "Saving..."
                    : "💾 Save Changes"}
                </button>
              </div>

            </div>
          </div>
        )}
    </div>
  );
}


/* DETAIL COMPONENT */

function Detail({
  label,
  value,
}: {
  label: string;
  value: any;
}) {
  return (
    <div style={styles.detail}>
      <span
        style={
          styles.detailLabel
        }
      >
        {label}
      </span>

      <strong
        style={
          styles.detailValue
        }
      >
        {value || "—"}
      </strong>
    </div>
  );
}


/* STYLES */

const styles: Record<
  string,
  React.CSSProperties
> = {
  page: {
    minHeight: "100vh",
    background: "#f3f4f6",
    padding: 12,
    boxSizing: "border-box",
    color: "#111827",
  },

  header: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
  },

  subtitle: {
    margin: "3px 0 0",
    fontSize: 11,
    color: "#6b7280",
  },

  count: {
    background: "#111827",
    color: "#ffffff",
    borderRadius: 8,
    padding: "7px 10px",
    fontSize: 10,
    fontWeight: 700,
  },

  searchCard: {
    background: "#ffffff",
    border:
      "1px solid #e5e7eb",
    borderRadius: 11,
    padding: 10,
    marginBottom: 10,
  },

  search: {
    width: "100%",
    boxSizing:
      "border-box",
    border:
      "1px solid #cbd5e1",
    borderRadius: 8,
    padding: 11,
    fontSize: 12,
    outline: "none",
  },

  list: {
    display: "flex",
    flexDirection:
      "column",
    gap: 9,
  },

  card: {
    background: "#ffffff",
    border:
      "1px solid #e5e7eb",
    borderRadius: 11,
    padding: 12,
  },

  cardTop: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
  },

  doNumber: {
    fontSize: 13,
    fontWeight: 800,
  },

  date: {
    marginTop: 3,
    fontSize: 10,
    color: "#6b7280",
  },

  amount: {
    fontSize: 15,
    fontWeight: 800,
  },

  info: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: 8,
    marginTop: 12,
  },

  infoLabel: {
    display: "block",
    fontSize: 9,
    color: "#9ca3af",
    marginBottom: 3,
  },

  infoValue: {
    display: "block",
    fontSize: 11,
    color: "#111827",
  },

  actions: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3, 1fr)",
    gap: 7,
    marginTop: 12,
  },

  viewButton: {
    border: "none",
    background: "#111827",
    color: "#ffffff",
    borderRadius: 7,
    padding: 9,
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  },

  editButton: {
    border:
      "1px solid #111827",
    background: "#ffffff",
    color: "#111827",
    borderRadius: 7,
    padding: 9,
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  },

  deleteButton: {
    border: "none",
    background: "#fee2e2",
    color: "#991b1b",
    borderRadius: 7,
    padding: 9,
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  },

  empty: {
    background: "#ffffff",
    borderRadius: 11,
    padding: 40,
    textAlign: "center",
    display: "flex",
    flexDirection:
      "column",
    gap: 5,
    color: "#6b7280",
    fontSize: 12,
  },

  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background:
      "rgba(0,0,0,.55)",
    display: "flex",
    alignItems: "center",
    justifyContent:
      "center",
    padding: 12,
  },

  modal: {
    width: "100%",
    maxWidth: 600,
    maxHeight: "92vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: 15,
    padding: 14,
    boxSizing:
      "border-box",
  },

  editModal: {
    width: "100%",
    maxWidth: 760,
    maxHeight: "94vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: 15,
    padding: 14,
    boxSizing:
      "border-box",
  },

  modalHeader: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems:
      "flex-start",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottom:
      "1px solid #e5e7eb",
  },

  modalTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: "#111827",
    lineHeight: 1.25,
  },

  editHeaderContent: {
    minWidth: 0,
  },

  editHeaderSubtitle: {
    marginTop: 5,
    fontSize: 10,
    color: "#6b7280",
    fontWeight: 500,
  },

  close: {
    width: 36,
    height: 36,
    minWidth: 36,
    border:
      "1px solid #cbd5e1",
    borderRadius:
      "50%",
    background:
      "#111827",
    color: "#ffffff",
    fontSize: 25,
    fontWeight: 700,
    lineHeight: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
    boxShadow:
      "0 2px 6px rgba(0,0,0,.15)",
  },

  details: {
    display: "flex",
    flexDirection:
      "column",
    gap: 7,
  },

  detail: {
    display: "flex",
    justifyContent:
      "space-between",
    gap: 12,
    padding: "8px 0",
    borderBottom:
      "1px solid #f1f5f9",
    fontSize: 11,
  },

  detailLabel: {
    color: "#6b7280",
  },

  detailValue: {
    textAlign:
      "right",
    color: "#111827",
  },

  itemsSection: {
    marginTop: 16,
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: 800,
    marginBottom: 8,
  },

  itemsTable: {
    border:
      "1px solid #e5e7eb",
    borderRadius: 10,
    overflow: "hidden",
  },

  itemHeader: {
    display: "grid",
    gridTemplateColumns:
      "1fr 120px",
    gap: 10,
    padding: "9px 10px",
    background:
      "#f3f4f6",
    fontSize: 10,
    fontWeight: 800,
    color: "#374151",
  },

  qtyHeader: {
    textAlign:
      "right",
  },

  itemRow: {
    display: "grid",
    gridTemplateColumns:
      "1fr 120px",
    gap: 10,
    padding: 10,
    borderTop:
      "1px solid #f1f5f9",
    fontSize: 11,
  },

  itemName: {
    fontWeight: 600,
  },

  itemQuantity: {
    textAlign:
      "right",
    fontWeight: 800,
  },

  noItems: {
    background:
      "#f9fafb",
    border:
      "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 12,
    textAlign:
      "center",
    color: "#6b7280",
    fontSize: 11,
  },

  amountSection: {
    marginTop: 14,
  },

  bankSection: {
    marginTop: 14,
  },

  messageBox: {
    marginTop: 14,
  },

  message: {
    width: "100%",
    minHeight: 220,
    boxSizing:
      "border-box",
    marginTop: 8,
    border:
      "1px solid #cbd5e1",
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    lineHeight: 1.5,
    resize:
      "vertical",
  },

  copyButton: {
    width: "100%",
    marginTop: 8,
    border: "none",
    background:
      "#111827",
    color: "#ffffff",
    borderRadius: 8,
    padding: 11,
    fontWeight: 800,
    cursor: "pointer",
  },

  // =========================
  // EDIT STYLES
  // =========================

  editSection: {
    marginTop: 12,
    padding: 12,
    border:
      "1px solid #e5e7eb",
    borderRadius: 10,
    background:
      "#fafafa",
  },

  editSectionHeader: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems:
      "center",
    gap: 10,
    marginBottom: 8,
  },

  editSectionTitle: {
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

  formLabel: {
    display: "block",
    fontSize: 11,
    fontWeight: 650,
    color: "#374151",
    marginBottom: 5,
  },

  input: {
    width: "100%",
    boxSizing:
      "border-box",
    border:
      "1px solid #cbd5e1",
    background:
      "#ffffff",
    color: "#111827",
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    outline: "none",
  },

  editRow: {
    position: "relative",
    display: "grid",
    gridTemplateColumns:
      "30px minmax(0, 1fr) 100px 110px 30px",
    gap: 8,
    alignItems:
      "end",
    padding: 9,
    marginTop: 8,
    background:
      "#ffffff",
    border:
      "1px solid #e5e7eb",
    borderRadius: 9,
  },

  editRowNumber: {
    width: 27,
    height: 27,
    borderRadius: 7,
    background:
      "#f3f4f6",
    color: "#374151",
    display: "flex",
    alignItems:
      "center",
    justifyContent:
      "center",
    fontSize: 11,
    fontWeight: 700,
  },

  editRowMain: {
    minWidth: 0,
  },

  editBags: {
    minWidth: 0,
  },

  editRowTotal: {
    paddingBottom: 10,
    fontSize: 12,
    fontWeight: 800,
    whiteSpace:
      "nowrap",
  },

  smallLabel: {
    fontSize: 9,
    color: "#6b7280",
    fontWeight: 650,
    marginBottom: 4,
  },

  removeButton: {
    border: "none",
    background:
      "#fee2e2",
    color: "#991b1b",
    width: 30,
    height: 30,
    borderRadius: 7,
    fontSize: 20,
    lineHeight: 1,
    cursor: "pointer",
  },

  addItemBox: {
    marginTop: 10,
    padding: 10,
    border:
      "1px dashed #cbd5e1",
    borderRadius: 9,
    background:
      "#ffffff",
  },

  categoryGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3, minmax(0, 1fr))",
    gap: 7,
  },

  addCategoryButton: {
    border:
      "1px solid #e5e7eb",
    background:
      "#fafafa",
    color: "#374151",
    borderRadius: 8,
    padding:
      "8px 6px",
    fontSize: 10,
    cursor: "pointer",
  },

  modeGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: 9,
    marginTop: 12,
  },

  modeButton: {
    border:
      "1px solid #d1d5db",
    background:
      "#ffffff",
    color: "#111827",
    borderRadius: 10,
    padding: 12,
    cursor: "pointer",
    display: "flex",
    alignItems:
      "center",
    gap: 9,
    textAlign:
      "left",
  },

  modeActive: {
    border:
      "2px solid #111827",
    background:
      "#f9fafb",
  },

  radio: {
    width: 23,
    height: 23,
    borderRadius:
      "50%",
    border:
      "1px solid #9ca3af",
    display: "flex",
    alignItems:
      "center",
    justifyContent:
      "center",
    flexShrink: 0,
    fontSize: 12,
    fontWeight: 800,
  },

  radioActive: {
    background:
      "#111827",
    color: "#ffffff",
    borderColor:
      "#111827",
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

  rateBox: {
    marginTop: 12,
    padding: 12,
    background:
      "#f8fafc",
    border:
      "1px solid #e2e8f0",
    borderRadius: 9,
  },

  rateLine: {
    fontSize: 11,
    color: "#475569",
    marginTop: 4,
  },

  bankCard: {
    marginTop: 9,
    background:
      "#ffffff",
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
    alignItems:
      "flex-end",
    gap: 8,
    marginTop: 9,
  },

  addBankButton: {
    border: "none",
    background:
      "#111827",
    color: "#ffffff",
    borderRadius: 7,
    padding:
      "7px 9px",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  },

  removeBankButton: {
    border: "none",
    background:
      "#fee2e2",
    color: "#991b1b",
    borderRadius: 7,
    padding: 10,
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  },

  editSummary: {
    marginTop: 12,
    background:
      "#111827",
    color: "#ffffff",
    borderRadius: 10,
    padding: 12,
  },

  editGrandTotal: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems:
      "center",
    marginTop: 8,
    paddingTop: 10,
    borderTop:
      "1px solid #374151",
    fontSize: 15,
  },

  copySmallButton: {
    border: "none",
    background:
      "#111827",
    color: "#ffffff",
    borderRadius: 7,
    padding:
      "7px 10px",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  },

  editActions: {
    display: "grid",
    gridTemplateColumns:
      "1fr 2fr",
    gap: 9,
    marginTop: 12,
  },

  cancelEditButton: {
    border:
      "1px solid #d1d5db",
    background:
      "#ffffff",
    color: "#374151",
    borderRadius: 9,
    padding: 13,
    fontSize: 12,
    fontWeight: 750,
    cursor: "pointer",
  },

  saveEditButton: {
    border: "none",
    background:
      "#111827",
    color: "#ffffff",
    borderRadius: 9,
    padding: 13,
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },

  itemCount: {
    background:
      "#f3f4f6",
    color: "#374151",
    padding:
      "5px 9px",
    borderRadius: 7,
    fontSize: 10,
    fontWeight: 650,
  },
};