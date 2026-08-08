import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

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

export default function SavedDOPage() {
  const [dos, setDos] = useState<SavedDO[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [selectedDO, setSelectedDO] =
    useState<SavedDO | null>(null);

  const [showView, setShowView] =
    useState(false);

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

  useEffect(() => {
    loadDOs();
  }, []);

  async function deleteDO(id: number) {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this DO?"
    );

    if (!confirmDelete) {
      return;
    }

    const { error } = await supabase
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

  function money(value: number | null) {
    return Number(value || 0).toLocaleString(
      "en-BD",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  }

  /*
   * ORDER ITEMS NORMALIZER
   *
   * order_items যদি array হয় তাহলে সরাসরি নেবে।
   * যদি JSON string হয় তাহলে parse করবে।
   */
  function getOrderItems(orderItems: any) {
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

  /*
   * ITEM NAME
   *
   * বিভিন্ন possible field support করবে।
   */
  function getItemName(item: any) {
    return (
      item?.item ||
      item?.item_name ||
      item?.product_name ||
      item?.product ||
      item?.name ||
      item?.feed_name ||
      item?.description ||
      "Unknown Item"
    );
  }

  /*
   * QUANTITY
   */
  function getItemQuantity(item: any) {
    return (
      item?.quantity ??
      item?.qty ??
      item?.order_quantity ??
      0
    );
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
            setSearch(e.target.value)
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
      ) : filteredDOs.length === 0 ? (
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
          {filteredDOs.map((item) => (
            <div
              key={item.id}
              style={styles.card}
            >

              {/* CARD TOP */}

              <div style={styles.cardTop}>
                <div>
                  <div
                    style={styles.doNumber}
                  >
                    DO #{item.id}
                  </div>

                  <div style={styles.date}>
                    {item.do_date ||
                      "No date"}
                  </div>
                </div>

                <div style={styles.amount}>
                  ৳{" "}
                  {money(
                    item.do_amount
                  )}
                </div>
              </div>

              {/* INFO */}

              <div style={styles.info}>

                <div>
                  <span style={styles.infoLabel}>
                    Agent
                  </span>

                  <strong style={styles.infoValue}>
                    {item.agent_name ||
                      item.agent_code ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span style={styles.infoLabel}>
                    Vehicle
                  </span>

                  <strong style={styles.infoValue}>
                    {item.vehicle_no ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span style={styles.infoLabel}>
                    Route
                  </span>

                  <strong style={styles.infoValue}>
                    {item.from_location ||
                      "—"}{" "}
                    →{" "}
                    {item.to_upazila ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span style={styles.infoLabel}>
                    Total
                  </span>

                  <strong style={styles.infoValue}>
                    ৳{" "}
                    {money(
                      item.total_amount
                    )}
                  </strong>
                </div>

              </div>

              {/* ACTIONS */}

              <div style={styles.actions}>

                <button
                  style={styles.viewButton}
                  onClick={() => {
                    setSelectedDO(item);
                    setShowView(true);
                  }}
                >
                  👁 View
                </button>

                <button
                  style={styles.editButton}
                  onClick={() =>
                    alert(
                      "Edit feature will open this DO in Easy D/O."
                    )
                  }
                >
                  ✏ Edit
                </button>

                <button
                  style={styles.deleteButton}
                  onClick={() =>
                    deleteDO(item.id)
                  }
                >
                  🗑 Delete
                </button>

              </div>
            </div>
          ))}
        </div>
      )}

      {/* VIEW POPUP */}

      {showView && selectedDO && (
        <div
          style={styles.overlay}
          onClick={() =>
            setShowView(false)
          }
        >
          <div
            style={styles.modal}
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* MODAL HEADER */}

            <div style={styles.modalHeader}>

              <div>
                <h2
                  style={styles.modalTitle}
                >
                  DO #{selectedDO.id}
                </h2>

                <div style={styles.date}>
                  {selectedDO.do_date ||
                    "No date"}
                </div>
              </div>

              <button
                style={styles.close}
                onClick={() =>
                  setShowView(false)
                }
              >
                ×
              </button>

            </div>

            {/* BASIC DETAILS */}

            <div style={styles.details}>

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

            <div style={styles.itemsSection}>

              <div style={styles.sectionTitle}>
                📦 Ordered Items
              </div>

              {getOrderItems(
                selectedDO.order_items
              ).length === 0 ? (

                <div style={styles.noItems}>
                  No ordered items found.
                </div>

              ) : (

                <div style={styles.itemsTable}>

                  {/* TABLE HEADER */}

                  <div
                    style={
                      styles.itemHeader
                    }
                  >
                    <div>
                      Item
                    </div>

                    <div style={styles.qtyHeader}>
                      Quantity
                    </div>
                  </div>

                  {/* ITEMS */}

                  {getOrderItems(
                    selectedDO.order_items
                  ).map(
                    (
                      item: any,
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
                            item
                          )}
                        </div>

                        <div
                          style={
                            styles.itemQuantity
                          }
                        >
                          {getItemQuantity(
                            item
                          )}
                        </div>
                      </div>
                    )
                  )}

                </div>
              )}

            </div>

            {/* AMOUNTS */}

            <div style={styles.amountSection}>

              <Detail
                label="Total Amount"
                value={`৳ ${money(
                  selectedDO.total_amount
                )}`}
              />

              <Detail
                label="DO Amount"
                value={`৳ ${money(
                  selectedDO.do_amount
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

            <div style={styles.bankSection}>

              <div style={styles.sectionTitle}>
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

            <div style={styles.messageBox}>

              <strong>
                DO Message
              </strong>

              <textarea
                readOnly
                value={
                  selectedDO.message_text ||
                  ""
                }
                style={styles.message}
              />

              <button
                style={styles.copyButton}
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
      <span style={styles.detailLabel}>
        {label}
      </span>

      <strong style={styles.detailValue}>
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
    justifyContent: "space-between",
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
    border: "1px solid #e5e7eb",
    borderRadius: 11,
    padding: 10,
    marginBottom: 10,
  },

  search: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: 11,
    fontSize: 12,
    outline: "none",
  },

  list: {
    display: "flex",
    flexDirection: "column",
    gap: 9,
  },

  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 11,
    padding: 12,
  },

  cardTop: {
    display: "flex",
    justifyContent: "space-between",
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
    border: "1px solid #d1d5db",
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
    flexDirection: "column",
    gap: 5,
    color: "#6b7280",
    fontSize: 12,
  },

  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "rgba(0,0,0,.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
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
    boxSizing: "border-box",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },

  modalTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
  },

  close: {
    width: 32,
    height: 32,
    border: "none",
    borderRadius: "50%",
    background: "#f3f4f6",
    fontSize: 21,
    cursor: "pointer",
  },

  details: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },

  detail: {
    display: "flex",
    justifyContent: "space-between",
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
    textAlign: "right",
    color: "#111827",
  },

  /* ORDER ITEMS */

  itemsSection: {
    marginTop: 16,
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: 800,
    marginBottom: 8,
  },

  itemsTable: {
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    overflow: "hidden",
  },

  itemHeader: {
    display: "grid",
    gridTemplateColumns:
      "1fr 120px",
    gap: 10,
    padding: "9px 10px",
    background: "#f3f4f6",
    fontSize: 10,
    fontWeight: 800,
    color: "#374151",
  },

  qtyHeader: {
    textAlign: "right",
  },

  itemRow: {
    display: "grid",
    gridTemplateColumns:
      "1fr 120px",
    gap: 10,
    padding: "10px",
    borderTop:
      "1px solid #f1f5f9",
    fontSize: 11,
  },

  itemName: {
    fontWeight: 600,
  },

  itemQuantity: {
    textAlign: "right",
    fontWeight: 800,
  },

  noItems: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 12,
    textAlign: "center",
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
    boxSizing: "border-box",
    marginTop: 8,
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    lineHeight: 1.5,
    resize: "vertical",
  },

  copyButton: {
    width: "100%",
    marginTop: 8,
    border: "none",
    background: "#111827",
    color: "#ffffff",
    borderRadius: 8,
    padding: 11,
    fontWeight: 800,
    cursor: "pointer",
  },
};