import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
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

const categories = [
  "Broiler",
  "Layer",
  "Sonali",
  "Cattle",
  "Fish Floating",
  "Fish Sinking",
];

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
  // ==========================================
  // AUTH / ROLE
  // ==========================================

  const { role } = useAuth();

  const currentRole = role as UserRole | null;

  const canManage =
    currentRole === "admin" ||
    currentRole === "super_admin";

  const canView =
    currentRole === "user" ||
    currentRole === "admin" ||
    currentRole === "super_admin";

  // ==========================================
  // STATE
  // ==========================================

  const [items, setItems] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [categoryFilter, setCategoryFilter] =
    useState("All");

  const [showForm, setShowForm] =
    useState(false);

  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [form, setForm] =
    useState<PriceItem>(emptyForm);

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  // ==========================================
  // LOAD PRICE LIST
  // ==========================================

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
      console.error(
        "Price list load error:",
        error
      );

      alert(
        `Price list load failed: ${error.message}`
      );
    } else {
      setItems(
        (data || []) as PriceItem[]
      );
    }

    setLoading(false);
  }

  // ==========================================
  // ADD
  // ==========================================

  function openAdd() {
    if (!canManage) {
      alert(
        "Only Admin or Super Admin can add price items."
      );
      return;
    }

    setEditingId(null);

    setForm({
      ...emptyForm,
    });

    setShowForm(true);
  }

  // ==========================================
  // EDIT
  // ==========================================

  function openEdit(item: PriceItem) {
    if (!canManage) {
      alert(
        "Only Admin or Super Admin can edit price items."
      );
      return;
    }

    setEditingId(item.id || null);

    setForm({
      category: item.category,
      item_name: item.item_name,
      short_name: item.short_name || "",
      kg_per_bag: Number(
        item.kg_per_bag || 0
      ),
      tp_per_bag: Number(
        item.tp_per_bag || 0
      ),
      mrp_per_bag: Number(
        item.mrp_per_bag || 0
      ),
      status: item.status,
      sort_order: item.sort_order,
    });

    setShowForm(true);
  }

  // ==========================================
  // CLOSE FORM
  // ==========================================

  function closeForm() {
    setShowForm(false);
    setEditingId(null);

    setForm({
      ...emptyForm,
    });
  }

  // ==========================================
  // SAVE PRICE ITEM
  // ==========================================

  async function savePriceItem() {
    if (!canManage) {
      alert(
        "Only Admin or Super Admin can manage price items."
      );
      return;
    }

    if (!form.item_name.trim()) {
      alert("Item name is required.");
      return;
    }

    if (Number(form.kg_per_bag) <= 0) {
      alert(
        "KG/Bag must be greater than 0."
      );
      return;
    }

    const payload = {
      category: form.category,
      item_name: form.item_name.trim(),
      short_name:
        form.short_name.trim(),
      kg_per_bag:
        Number(form.kg_per_bag),
      tp_per_bag:
        Number(form.tp_per_bag),
      mrp_per_bag:
        Number(form.mrp_per_bag),
      status: form.status,
    };

    // ========================================
    // UPDATE
    // ========================================

    if (editingId) {
      const { error } =
        await supabase
          .from("feed_price_list")
          .update(payload)
          .eq("id", editingId);

      if (error) {
        console.error(
          "Price update error:",
          error
        );

        alert(
          `Update failed: ${error.message}`
        );

        return;
      }
    }

    // ========================================
    // INSERT
    // ========================================

    else {
      const { error } =
        await supabase
          .from("feed_price_list")
          .upsert(
            [payload],
            {
              onConflict:
                "category,item_name",
            }
          );

      if (error) {
        console.error(
          "Price insert error:",
          error
        );

        alert(
          `Add failed: ${error.message}`
        );

        return;
      }
    }

    closeForm();

    await loadPriceList();
  }

  // ==========================================
  // DELETE
  // ==========================================

  async function deleteItem(
    id?: number
  ) {
    if (!canManage) {
      alert(
        "Only Admin or Super Admin can delete price items."
      );
      return;
    }

    if (!id) return;

    const confirmed =
      window.confirm(
        "Delete this price item?"
      );

    if (!confirmed) return;

    const { error } =
      await supabase
        .from("feed_price_list")
        .delete()
        .eq("id", id);

    if (error) {
      console.error(
        "Price delete error:",
        error
      );

      alert(
        `Delete failed: ${error.message}`
      );

      return;
    }

    await loadPriceList();
  }

  // ==========================================
  // EXCEL IMPORT
  // ADMIN + SUPER ADMIN ONLY
  // ==========================================

  function handleExcelImport(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    if (!canManage) {
      alert(
        "Only Admin or Super Admin can import price list."
      );

      event.target.value = "";

      return;
    }

    const file =
      event.target.files?.[0];

    if (!file) return;

    const reader =
      new FileReader();

    reader.onload = async (e) => {
      try {
        const data =
          new Uint8Array(
            e.target?.result as ArrayBuffer
          );

        const workbook =
          XLSX.read(data, {
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
          alert(
            "Excel file is empty."
          );
          return;
        }

        const importData =
          rows
            .map(
              (
                row,
                index
              ) => ({
                category:
                  String(
                    row["Category"] ||
                      ""
                  ).trim(),

                item_name:
                  String(
                    row["Item Name"] ||
                      ""
                  ).trim(),

                short_name:
                  String(
                    row["Short Name"] ||
                      ""
                  ).trim(),

                kg_per_bag:
                  Number(
                    row["KG/Bag"] ||
                      0
                  ),

                tp_per_bag:
                  Number(
                    row["TP/Bag"] ||
                      0
                  ),

                mrp_per_bag:
                  Number(
                    row["MRP/Bag"] ||
                      0
                  ),

                status:
                  String(
                    row["Status"] ||
                      "Active"
                  ).trim(),

                sort_order:
                  index + 1,
              })
            )
            .filter(
              (item) =>
                item.category &&
                item.item_name &&
                item.kg_per_bag > 0
            );

        if (!importData.length) {
          alert(
            "No valid price list data found."
          );
          return;
        }

        const { error } =
          await supabase
            .from(
              "feed_price_list"
            )
            .upsert(
              importData,
              {
                onConflict:
                  "category,item_name",
                ignoreDuplicates:
                  false,
              }
            );

        if (error) {
          console.error(
            "Excel import error:",
            error
          );

          alert(
            `Excel import/update failed: ${error.message}`
          );

          return;
        }

        alert(
          `${importData.length} items imported/updated successfully.`
        );

        await loadPriceList();
      } catch (error) {
        console.error(
          "Excel processing error:",
          error
        );

        alert(
          "Invalid Excel file."
        );
      }
    };

    reader.readAsArrayBuffer(
      file
    );

    event.target.value = "";
  }

  // ==========================================
  // FILTER
  // ==========================================

  const filteredItems =
    useMemo(() => {
      const searchText =
        search.toLowerCase();

      return items.filter(
        (item) => {
          const categoryMatch =
            categoryFilter ===
              "All" ||
            item.category ===
              categoryFilter;

          const searchMatch =
            item.category
              .toLowerCase()
              .includes(
                searchText
              ) ||
            item.item_name
              .toLowerCase()
              .includes(
                searchText
              ) ||
            (
              item.short_name ||
              ""
            )
              .toLowerCase()
              .includes(
                searchText
              );

          return (
            categoryMatch &&
            searchMatch
          );
        }
      );
    }, [
      items,
      search,
      categoryFilter,
    ]);

  // ==========================================
  // EXCEL EXPORT
  // ALL ROLES
  // ==========================================

  function exportExcel() {
    if (!filteredItems.length) {
      alert(
        "No data available to export."
      );

      return;
    }

    const exportData =
      filteredItems.map(
        (item) => ({
          Category:
            item.category,

          "Item Name":
            item.item_name,

          "Short Name":
            item.short_name ||
            "",

          "KG/Bag":
            Number(
              item.kg_per_bag
            ),

          "TP/Bag":
            Number(
              item.tp_per_bag
            ),

          "TP/KG":
            Number(
              item.kg_per_bag
            ) > 0
              ? Number(
                  item.tp_per_bag
                ) /
                Number(
                  item.kg_per_bag
                )
              : 0,

          "MRP/Bag":
            Number(
              item.mrp_per_bag
            ),

          "MRP/KG":
            Number(
              item.kg_per_bag
            ) > 0
              ? Number(
                  item.mrp_per_bag
                ) /
                Number(
                  item.kg_per_bag
                )
              : 0,

          Status:
            item.status,
        })
      );

    const worksheet =
      XLSX.utils.json_to_sheet(
        exportData
      );

    worksheet["!cols"] = [
      { wch: 16 },
      { wch: 28 },
      { wch: 16 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
    ];

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Price List"
    );

    const excelBuffer =
      XLSX.write(
        workbook,
        {
          bookType: "xlsx",
          type: "array",
        }
      );

    const blob =
      new Blob(
        [excelBuffer],
        {
          type:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
      );

    saveAs(
      blob,
      "Feed_Price_List.xlsx"
    );
  }

  // ==========================================
  // ACCESS CHECK
  // ==========================================

  if (!canView) {
    return (
      <div
        style={
          styles.accessDenied
        }
      >
        <div
          style={
            styles.accessIcon
          }
        >
          🔒
        </div>

        <div
          style={
            styles.accessTitle
          }
        >
          Access Denied
        </div>

        <div
          style={
            styles.accessText
          }
        >
          You do not have permission
          to view the Price List.
        </div>
      </div>
    );
  }

  // ==========================================
  // PAGE
  // ==========================================

  return (
    <div style={styles.page}>
      {/* HEADER */}

      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            Price List
          </h1>

          <p
            style={
              styles.subtitle
            }
          >
            Feed price management
          </p>
        </div>

        <div
          style={
            styles.headerButtons
          }
        >
          {/* EXPORT - EVERYONE */}

          <button
            style={
              styles.exportButton
            }
            onClick={
              exportExcel
            }
          >
            📤 Export Excel
          </button>

          {/* IMPORT - ADMIN / SUPER ADMIN */}

          {canManage && (
            <>
              <button
                style={
                  styles.importButton
                }
                onClick={() =>
                  fileInputRef.current?.click()
                }
              >
                📥 Import Excel
              </button>

              <input
                ref={
                  fileInputRef
                }
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{
                  display:
                    "none",
                }}
                onChange={
                  handleExcelImport
                }
              />

              {/* ADD - ADMIN / SUPER ADMIN */}

              <button
                style={
                  styles.addButton
                }
                onClick={
                  openAdd
                }
              >
                + Add
              </button>
            </>
          )}
        </div>
      </div>


      {/* SEARCH */}

      <div
        style={
          styles.searchBox
        }
      >
        <span>🔍</span>

        <input
          value={search}
          onChange={(e) =>
            setSearch(
              e.target.value
            )
          }
          placeholder="Search item or short name..."
          style={
            styles.searchInput
          }
        />
      </div>

      {/* CATEGORY FILTER */}

      <div
        style={
          styles.categoryScroll
        }
      >
        <button
          style={{
            ...styles.categoryButton,
            ...(categoryFilter ===
            "All"
              ? styles.categoryActive
              : {}),
          }}
          onClick={() =>
            setCategoryFilter(
              "All"
            )
          }
        >
          All
        </button>

        {categories.map(
          (category) => (
            <button
              key={category}
              style={{
                ...styles.categoryButton,
                ...(categoryFilter ===
                category
                  ? styles.categoryActive
                  : {}),
              }}
              onClick={() =>
                setCategoryFilter(
                  category
                )
              }
            >
              {category}
            </button>
          )
        )}
      </div>

      {/* TABLE */}

      {loading ? (
        <div
          style={
            styles.loading
          }
        >
          Loading...
        </div>
      ) : (
        <div
          style={
            styles.tableWrapper
          }
        >
          <table
            style={
              styles.table
            }
          >
            <thead>
              <tr>
                <th
                  style={
                    styles.th
                  }
                >
                  Category
                </th>

                <th
                  style={
                    styles.th
                  }
                >
                  Item
                </th>

                <th
                  style={
                    styles.th
                  }
                >
                  Short Name
                </th>

                <th
                  style={{
                    ...styles.th,
                    textAlign:
                      "right",
                  }}
                >
                  KG/Bag
                </th>

                <th
                  style={{
                    ...styles.th,
                    textAlign:
                      "right",
                  }}
                >
                  TP/Bag
                </th>

                <th
                  style={{
                    ...styles.th,
                    textAlign:
                      "right",
                  }}
                >
                  TP/KG
                </th>

                <th
                  style={{
                    ...styles.th,
                    textAlign:
                      "right",
                  }}
                >
                  MRP/Bag
                </th>

                <th
                  style={{
                    ...styles.th,
                    textAlign:
                      "right",
                  }}
                >
                  MRP/KG
                </th>

                <th
                  style={
                    styles.th
                  }
                >
                  Status
                </th>

                {/* ACTION ONLY FOR ADMIN */}

                {canManage && (
                  <th
                    style={{
                      ...styles.th,
                      textAlign:
                        "center",
                    }}
                  >
                    Action
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {filteredItems.map(
                (item) => {
                  const kgPerBag =
                    Number(
                      item.kg_per_bag
                    );

                  const tpPerBag =
                    Number(
                      item.tp_per_bag
                    );

                  const mrpPerBag =
                    Number(
                      item.mrp_per_bag
                    );

                  const tpKg =
                    kgPerBag > 0
                      ? tpPerBag /
                        kgPerBag
                      : 0;

                  const mrpKg =
                    kgPerBag > 0
                      ? mrpPerBag /
                        kgPerBag
                      : 0;

                  return (
                    <tr
                      key={
                        item.id
                      }
                      style={
                        styles.tr
                      }
                    >
                      <td
                        style={
                          styles.td
                        }
                      >
                        <span
                          style={
                            styles.categoryTag
                          }
                        >
                          {
                            item.category
                          }
                        </span>
                      </td>

                      <td
                        style={{
                          ...styles.td,
                          fontWeight: 600,
                        }}
                      >
                        {
                          item.item_name
                        }
                      </td>

                      <td
                        style={{
                          ...styles.td,
                          fontWeight: 700,
                          color:
                            "#2563eb",
                        }}
                      >
                        {item.short_name ||
                          "-"}
                      </td>

                      <td
                        style={{
                          ...styles.td,
                          textAlign:
                            "right",
                        }}
                      >
                        {
                          item.kg_per_bag
                        }
                      </td>

                      <td
                        style={{
                          ...styles.td,
                          textAlign:
                            "right",
                        }}
                      >
                        ৳
                        {tpPerBag.toLocaleString()}
                      </td>

                      <td
                        style={{
                          ...styles.td,
                          textAlign:
                            "right",
                        }}
                      >
                        ৳
                        {tpKg.toFixed(
                          2
                        )}
                      </td>

                      <td
                        style={{
                          ...styles.td,
                          textAlign:
                            "right",
                        }}
                      >
                        ৳
                        {mrpPerBag.toLocaleString()}
                      </td>

                      <td
                        style={{
                          ...styles.td,
                          textAlign:
                            "right",
                        }}
                      >
                        ৳
                        {mrpKg.toFixed(
                          2
                        )}
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
                          {
                            item.status
                          }
                        </span>
                      </td>

                      {/* ACTION */}

                      {canManage && (
                        <td
                          style={{
                            ...styles.td,
                            textAlign:
                              "center",
                          }}
                        >
                          <div
                            style={
                              styles.actionGroup
                            }
                          >
                            <button
                              style={
                                styles.editButton
                              }
                              onClick={() =>
                                openEdit(
                                  item
                                )
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
                                deleteItem(
                                  item.id
                                )
                              }
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>

          {!filteredItems.length && (
            <div
              style={
                styles.noData
              }
            >
              No price items found.
            </div>
          )}
        </div>
      )}

      {/* ======================================
          ADD / EDIT MODAL
          ADMIN + SUPER ADMIN ONLY
      ====================================== */}

      {showForm &&
        canManage && (
          <div
            style={
              styles.overlay
            }
          >
            <div
              style={
                styles.modal
              }
            >
              <div
                style={
                  styles.modalHeader
                }
              >
                <h2
                  style={{
                    margin: 0,
                  }}
                >
                  {editingId
                    ? "Edit Price"
                    : "Add Price"}
                </h2>

                <button
                  style={
                    styles.closeButton
                  }
                  onClick={
                    closeForm
                  }
                >
                  ×
                </button>
              </div>

              {/* CATEGORY */}

              <label
                style={
                  styles.label
                }
              >
                Category
              </label>

              <select
                value={
                  form.category
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    category:
                      e.target
                        .value,
                  })
                }
                style={
                  styles.input
                }
              >
                {categories.map(
                  (category) => (
                    <option
                      key={
                        category
                      }
                      value={
                        category
                      }
                    >
                      {category}
                    </option>
                  )
                )}
              </select>

              {/* ITEM NAME */}

              <label
                style={
                  styles.label
                }
              >
                Item Name
              </label>

              <input
                value={
                  form.item_name
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    item_name:
                      e.target
                        .value,
                  })
                }
                placeholder="Feed item name"
                style={
                  styles.input
                }
              />

              {/* SHORT NAME */}

              <label
                style={
                  styles.label
                }
              >
                Short Name
              </label>

              <input
                value={
                  form.short_name
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    short_name:
                      e.target
                        .value,
                  })
                }
                placeholder="Example: BR-S"
                style={
                  styles.input
                }
              />

              <div
                style={
                  styles.helperText
                }
              >
                This short name will
                be used in the DO
                Message.
              </div>

              {/* KG / BAG */}

              <label
                style={
                  styles.label
                }
              >
                KG / Bag
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  form.kg_per_bag
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    kg_per_bag:
                      Number(
                        e.target
                          .value
                      ),
                  })
                }
                style={
                  styles.input
                }
              />

              {/* TP / BAG */}

              <label
                style={
                  styles.label
                }
              >
                TP / Bag
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  form.tp_per_bag
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    tp_per_bag:
                      Number(
                        e.target
                          .value
                      ),
                  })
                }
                style={
                  styles.input
                }
              />

              {/* TP / KG */}

              <div
                style={
                  styles.calculated
                }
              >
                TP / KG: ৳
                {form.kg_per_bag >
                0
                  ? (
                      Number(
                        form.tp_per_bag
                      ) /
                      Number(
                        form.kg_per_bag
                      )
                    ).toFixed(
                      2
                    )
                  : "0.00"}
              </div>

              {/* MRP / BAG */}

              <label
                style={
                  styles.label
                }
              >
                MRP / Bag
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  form.mrp_per_bag
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    mrp_per_bag:
                      Number(
                        e.target
                          .value
                      ),
                  })
                }
                style={
                  styles.input
                }
              />

              {/* MRP / KG */}

              <div
                style={
                  styles.calculated
                }
              >
                MRP / KG: ৳
                {form.kg_per_bag >
                0
                  ? (
                      Number(
                        form.mrp_per_bag
                      ) /
                      Number(
                        form.kg_per_bag
                      )
                    ).toFixed(
                      2
                    )
                  : "0.00"}
              </div>

              {/* STATUS */}

              <label
                style={
                  styles.label
                }
              >
                Status
              </label>

              <select
                value={
                  form.status
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    status:
                      e.target
                        .value,
                  })
                }
                style={
                  styles.input
                }
              >
                <option value="Active">
                  Active
                </option>

                <option value="Inactive">
                  Inactive
                </option>
              </select>

              {/* SAVE */}

              <button
                style={
                  styles.saveButton
                }
                onClick={
                  savePriceItem
                }
              >
                {editingId
                  ? "Update Price"
                  : "Save Price"}
              </button>
            </div>
          </div>
        )}
    </div>
  );
}

// ============================================
// STYLES
// ============================================

const styles: Record<
  string,
  React.CSSProperties
> = {
  page: {
    padding: 14,
    color: "#111827",
    background: "#f8fafc",
    minHeight: "100vh",
    boxSizing: "border-box",
  },

  header: {
    display: "flex",
    justifyContent:
      "space-between",
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
    border:
      "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    padding: "9px 10px",
    borderRadius: 9,
    fontWeight: 600,
    cursor: "pointer",
  },

  importButton: {
    border:
      "1px solid #d1d5db",
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

  roleInfo: {
    display: "inline-block",
    marginBottom: 10,
    padding:
      "5px 9px",
    borderRadius: 7,
    background: "#eef2ff",
    color: "#3730a3",
    fontSize: 10,
    fontWeight: 700,
  },

  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#ffffff",
    border:
      "1px solid #e5e7eb",
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
    border:
      "1px solid #d1d5db",
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
    border:
      "1px solid #e5e7eb",
    borderRadius: 12,
    boxShadow:
      "0 1px 3px rgba(0,0,0,.05)",
  },

  table: {
    width: "100%",
    minWidth: 1050,
    borderCollapse:
      "collapse",
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
    borderBottom:
      "1px solid #d1d5db",
    textAlign: "left",
    whiteSpace: "nowrap",
  },

  tr: {
    background: "#ffffff",
  },

  td: {
    padding: "11px 10px",
    borderBottom:
      "1px solid #eef0f2",
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
    justifyContent:
      "center",
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
    background:
      "rgba(0,0,0,.45)",
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
    justifyContent:
      "space-between",
    alignItems: "center",
    marginBottom: 8,
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
    border:
      "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#111827",
    borderRadius: 9,
    padding: 11,
    fontSize: 14,
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