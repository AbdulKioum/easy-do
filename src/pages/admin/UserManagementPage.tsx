import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

type UserRole = "user" | "admin" | "super_admin";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  status: string;
  assigned_districts?: string[];
  assigned_from_locations?: string[];
  assigned_price_list?: string;
  created_at?: string;
  updated_at?: string;
};

export default function UserManagementPage() {
  const { profile: currentProfile, role: currentRole } = useAuth();

  const [users, setUsers] = useState<Profile[]>([]);
  const [allDistricts, setAllDistricts] = useState<string[]>([]);
  const [allLocations, setAllLocations] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ADD USER FORM
  const [showAddUser, setShowAddUser] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("user");
  const [newStatus, setNewStatus] = useState("Active");
  const [newAssignedPriceList, setNewAssignedPriceList] = useState("price_list_1");
  const [newAssignedDistricts, setNewAssignedDistricts] = useState<string[]>([]);
  const [newAssignedLocations, setNewAssignedLocations] = useState<string[]>([]);
  const [creatingUser, setCreatingUser] = useState(false);

  // Editable fields per user state for assignments
  const [userInputs, setUserInputs] = useState<
    Record<string, { districts: string[]; locations: string[]; priceList: string }>
  >({});

  useEffect(() => {
    if (currentRole === "super_admin") {
      loadUsers();
      loadMetadata();
    } else {
      setLoading(false);
    }
  }, [currentRole]);

  async function loadMetadata() {
    try {
      const { data: upazilaData } = await supabase.from("upazilas").select("district");
      if (upazilaData) {
        const uniqueDistricts = Array.from(
          new Set(upazilaData.map((u) => u.district).filter(Boolean))
        ).sort();
        setAllDistricts(uniqueDistricts);
      }

      const { data: transData } = await supabase
        .from("transportation")
        .select("from_location");
      if (transData) {
        const uniqueLocs = Array.from(
          new Set(transData.map((t) => t.from_location).filter(Boolean))
        ).sort();
        setAllLocations(uniqueLocs);
      }
    } catch (err) {
      console.error("Metadata load error:", err);
    }
  }

  async function loadUsers() {
    setLoading(true);
    setError("");
    setSuccess("");

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setError(`Failed to load users: ${error.message}`);
      setLoading(false);
      return;
    }

    const fetchedUsers = (data || []) as Profile[];
    setUsers(fetchedUsers);

    const initialInputs: Record<
      string,
      { districts: string[]; locations: string[]; priceList: string }
    > = {};
    fetchedUsers.forEach((u) => {
      initialInputs[u.id] = {
        districts: u.assigned_districts || [],
        locations: u.assigned_from_locations || [],
        priceList: u.assigned_price_list || "price_list_1",
      };
    });
    setUserInputs(initialInputs);

    setLoading(false);
  }

  function handleMultiSelectToggle(currentList: string[], item: string): string[] {
    if (currentList.includes(item)) {
      return currentList.filter((i) => i !== item);
    } else {
      return [...currentList, item];
    }
  }

  async function handleCreateUser() {
    if (currentRole !== "super_admin") {
      setError("Only Super Admin can create users.");
      return;
    }

    setError("");
    setSuccess("");

    const fullName = newFullName.trim();
    const email = newEmail.trim().toLowerCase();
    const password = newPassword;

    if (!fullName || !email || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setCreatingUser(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          full_name: fullName,
          email,
          password,
          role: newRole,
          status: newStatus,
          assigned_districts: newAssignedDistricts,
          assigned_from_locations: newAssignedLocations,
          assigned_price_list: newAssignedPriceList,
        },
      });

      if (error || !data?.success) {
        setError(`Create user failed: ${error?.message || data?.error}`);
        setCreatingUser(false);
        return;
      }

      // Ensure assigned_price_list is saved in profiles even if edge function doesn't handle it directly
      if (data?.user?.id) {
        await supabase
          .from("profiles")
          .update({ assigned_price_list: newAssignedPriceList })
          .eq("id", data.user.id);
      } else {
        await supabase
          .from("profiles")
          .update({ assigned_price_list: newAssignedPriceList })
          .eq("email", email);
      }

      setSuccess("User created successfully.");
      setNewFullName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("user");
      setNewStatus("Active");
      setNewAssignedPriceList("price_list_1");
      setNewAssignedDistricts([]);
      setNewAssignedLocations([]);
      setShowAddUser(false);

      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user.");
    }

    setCreatingUser(false);
  }

  async function handleRoleChange(userId: string, selectedRole: UserRole) {
    if (userId === currentProfile?.id) {
      setError("You cannot change your own role.");
      return;
    }

    setSavingId(userId);
    const { error } = await supabase
      .from("profiles")
      .update({ role: selectedRole, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) {
      setError(`Role update failed: ${error.message}`);
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: selectedRole } : u))
      );
      setSuccess("User role updated successfully.");
    }
    setSavingId(null);
  }

  async function handleStatusChange(userId: string, selectedStatus: string) {
    if (userId === currentProfile?.id) {
      setError("You cannot change your own status.");
      return;
    }

    setSavingId(userId);
    const { error } = await supabase
      .from("profiles")
      .update({ status: selectedStatus, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) {
      setError(`Status update failed: ${error.message}`);
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: selectedStatus } : u))
      );
      setSuccess("User status updated successfully.");
    }
    setSavingId(null);
  }

  async function handleAssignmentsUpdate(userId: string) {
    setSavingId(userId);
    const currentInput = userInputs[userId] || {
      districts: [],
      locations: [],
      priceList: "price_list_1",
    };
    const assigned_districts = currentInput.districts;
    const assigned_from_locations = currentInput.locations;
    const assigned_price_list = currentInput.priceList;

    const { error } = await supabase
      .from("profiles")
      .update({
        assigned_districts,
        assigned_from_locations,
        assigned_price_list,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      setError(`Assignment update failed: ${error.message}`);
    } else {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                assigned_districts,
                assigned_from_locations,
                assigned_price_list,
              }
            : u
        )
      );
      setSuccess("User assignments & price list updated successfully.");
    }
    setSavingId(null);
  }

  async function handleDeleteUser(userId: string, userName: string) {
    if (userId === currentProfile?.id) {
      setError("You cannot delete your own account.");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete "${userName}"?`)) return;

    setSavingId(userId);
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: userId },
      });
      if (error || !data?.success) {
        setError(`Delete user failed: ${error?.message || data?.error}`);
      } else {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        setSuccess("User deleted successfully.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete user failed.");
    }
    setSavingId(null);
  }

  if (currentRole !== "super_admin") {
    return (
      <div style={styles.accessDenied}>
        <div style={styles.accessIcon}>🔒</div>
        <div style={styles.accessTitle}>Access Denied</div>
        <div style={styles.accessText}>
          Only Super Admin can access User Management.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>User Management</h1>
          <p style={styles.subtitle}>
            Create users, manage roles, and assign Price Lists, districts & Depots
          </p>
        </div>
        <button
          onClick={() => {
            loadUsers();
            loadMetadata();
          }}
          style={styles.refreshButton}
          disabled={loading}
        >
          ↻ Refresh
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <div style={styles.addUserBox}>
        <div style={styles.addUserHeader}>
          <div>
            <div style={styles.addUserTitle}>➕ Add User</div>
            <div style={styles.addUserSubtitle}>
              Create new users with Price List, district & Depot restrictions.
            </div>
          </div>
          <button
            onClick={() => setShowAddUser(!showAddUser)}
            style={styles.addUserToggle}
          >
            {showAddUser ? "✕ Close" : "＋ Add User"}
          </button>
        </div>

        {showAddUser && (
          <div style={styles.addUserForm}>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Full Name</label>
              <input
                type="text"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="Full name"
                style={styles.input}
                disabled={creatingUser}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Email address"
                style={styles.input}
                disabled={creatingUser}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 chars"
                style={styles.input}
                disabled={creatingUser}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                style={styles.input}
                disabled={creatingUser}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                style={styles.input}
                disabled={creatingUser}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Assigned Price List</label>
              <select
                value={newAssignedPriceList}
                onChange={(e) => setNewAssignedPriceList(e.target.value)}
                style={styles.input}
                disabled={creatingUser}
              >
                <option value="price_list_1">Price List 1</option>
                <option value="price_list_2">Price List 2</option>
              </select>
            </div>

            {/* ASSIGNED DISTRICTS CHECKBOX LIST */}
            <div style={{ ...styles.formGroup, gridColumn: "1 / -1" }}>
              <label style={styles.formLabel}>Assigned Districts</label>
              <div style={styles.checkboxContainer}>
                {allDistricts.map((dist) => {
                  const checked = newAssignedDistricts.includes(dist);
                  return (
                    <label
                      key={dist}
                      style={{
                        ...styles.checkboxLabel,
                        background: checked ? "#eff6ff" : "#fff",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setNewAssignedDistricts(
                            handleMultiSelectToggle(newAssignedDistricts, dist)
                          )
                        }
                        disabled={creatingUser}
                      />
                      <span>{dist}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* ASSIGNED FROM LOCATIONS CHECKBOX LIST */}
            <div style={{ ...styles.formGroup, gridColumn: "1 / -1" }}>
              <label style={styles.formLabel}>
                Assigned Transport From Locations (Mills / Depots)
              </label>
              <div style={styles.checkboxContainer}>
                {allLocations.map((loc) => {
                  const checked = newAssignedLocations.includes(loc);
                  return (
                    <label
                      key={loc}
                      style={{
                        ...styles.checkboxLabel,
                        background: checked ? "#eff6ff" : "#fff",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setNewAssignedLocations(
                            handleMultiSelectToggle(newAssignedLocations, loc)
                          )
                        }
                        disabled={creatingUser}
                      />
                      <span>{loc}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleCreateUser}
              disabled={creatingUser}
              style={styles.createButton}
            >
              {creatingUser ? "Creating..." : "Create User"}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div style={styles.loading}>Loading users...</div>
      ) : users.length === 0 ? (
        <div style={styles.empty}>No users found.</div>
      ) : (
        <div style={styles.userList}>
          {users.map((user) => {
            const isCurrentUser = user.id === currentProfile?.id;
            const isSaving = savingId === user.id;
            const currentInput = userInputs[user.id] || {
              districts: [],
              locations: [],
              priceList: "price_list_1",
            };

            return (
              <div key={user.id} style={styles.userCard}>
                <div style={styles.userInfo}>
                  <div style={styles.avatar}>
                    {(user.full_name || user.email || "U")
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <div style={styles.userDetails}>
                    <div style={styles.userName}>
                      {user.full_name || "No Name"}
                    </div>
                    <div style={styles.email}>{user.email || "No Email"}</div>
                    {isCurrentUser && <div style={styles.youBadge}>YOU</div>}
                  </div>
                </div>

                <div style={styles.controlGroup}>
                  <label style={styles.label}>Role</label>
                  <select
                    value={user.role}
                    disabled={isSaving || isCurrentUser}
                    onChange={(e) =>
                      handleRoleChange(user.id, e.target.value as UserRole)
                    }
                    style={styles.select}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>

                <div style={styles.controlGroup}>
                  <label style={styles.label}>Status</label>
                  <select
                    value={user.status || "Active"}
                    disabled={isSaving || isCurrentUser}
                    onChange={(e) =>
                      handleStatusChange(user.id, e.target.value)
                    }
                    style={styles.select}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                {/* EDITING ASSIGNMENTS */}
                <div style={{ ...styles.controlGroup, flex: "1 1 320px" }}>
                  <div style={{ marginBottom: 8 }}>
                    <label style={styles.label}>Assigned Price List</label>
                    <select
                      value={currentInput.priceList}
                      disabled={isSaving}
                      onChange={(e) =>
                        setUserInputs({
                          ...userInputs,
                          [user.id]: {
                            ...currentInput,
                            priceList: e.target.value,
                          },
                        })
                      }
                      style={styles.select}
                    >
                      <option value="price_list_1">Price List 1</option>
                      <option value="price_list_2">Price List 2</option>
                    </select>
                  </div>

                  <label style={styles.label}>Assigned Districts</label>
                  <div style={styles.miniCheckboxContainer}>
                    {allDistricts.map((dist) => {
                      const checked = currentInput.districts.includes(dist);
                      return (
                        <label
                          key={dist}
                          style={{
                            ...styles.miniCheckboxLabel,
                            background: checked ? "#dbeafe" : "#f8fafc",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isSaving}
                            onChange={() => {
                              const updated = handleMultiSelectToggle(
                                currentInput.districts,
                                dist
                              );
                              setUserInputs({
                                ...userInputs,
                                [user.id]: {
                                  ...currentInput,
                                  districts: updated,
                                },
                              });
                            }}
                          />
                          <span>{dist}</span>
                        </label>
                      );
                    })}
                  </div>

                  <label style={{ ...styles.label, marginTop: 8 }}>
                    Assigned From Locations
                  </label>
                  <div style={styles.miniCheckboxContainer}>
                    {allLocations.map((loc) => {
                      const checked = currentInput.locations.includes(loc);
                      return (
                        <label
                          key={loc}
                          style={{
                            ...styles.miniCheckboxLabel,
                            background: checked ? "#dbeafe" : "#f8fafc",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isSaving}
                            onChange={() => {
                              const updated = handleMultiSelectToggle(
                                currentInput.locations,
                                loc
                              );
                              setUserInputs({
                                ...userInputs,
                                [user.id]: {
                                  ...currentInput,
                                  locations: updated,
                                },
                              });
                            }}
                          />
                          <span>{loc}</span>
                        </label>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => handleAssignmentsUpdate(user.id)}
                    disabled={isSaving}
                    style={styles.smallSaveBtn}
                  >
                    {isSaving ? "Saving..." : "Save Assignments"}
                  </button>
                </div>

                {!isCurrentUser && (
                  <div style={styles.deleteGroup}>
                    <label style={styles.label}>Action</label>
                    <button
                      onClick={() =>
                        handleDeleteUser(
                          user.id,
                          user.full_name || user.email || "this user"
                        )
                      }
                      disabled={isSaving}
                      style={styles.deleteButton}
                      title="Delete User"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { width: "100%", maxWidth: 1250, margin: "0 auto", padding: 16, boxSizing: "border-box" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" },
  subtitle: { margin: "4px 0 0", fontSize: 12, color: "#6b7280" },
  refreshButton: { border: "1px solid #d1d5db", background: "#ffffff", color: "#111827", borderRadius: 9, padding: "9px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  error: { marginBottom: 12, padding: 11, borderRadius: 9, background: "#fee2e2", color: "#991b1b", fontSize: 12, fontWeight: 600 },
  success: { marginBottom: 12, padding: 11, borderRadius: 9, background: "#dcfce7", color: "#166534", fontSize: 12, fontWeight: 600 },
  addUserBox: { marginBottom: 18, padding: 14, borderRadius: 13, background: "#ffffff", border: "1px solid #e5e7eb" },
  addUserHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  addUserTitle: { fontSize: 15, fontWeight: 800, color: "#111827" },
  addUserSubtitle: { marginTop: 3, fontSize: 11, color: "#6b7280" },
  addUserToggle: { border: "none", background: "#111827", color: "#ffffff", borderRadius: 9, padding: "9px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  addUserForm: { marginTop: 16, paddingTop: 16, borderTop: "1px solid #e5e7eb", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 },
  formGroup: { minWidth: 0 },
  formLabel: { display: "block", marginBottom: 5, fontSize: 11, fontWeight: 700, color: "#374151" },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 11px", background: "#ffffff", color: "#111827", fontSize: 12, outline: "none" },
  checkboxContainer: { display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 120, overflowY: "auto", border: "1px solid #e2e8f0", padding: 8, borderRadius: 8, background: "#f8fafc" },
  checkboxLabel: { display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 11, cursor: "pointer" },
  miniCheckboxContainer: { display: "flex", flexWrap: "wrap", gap: 4, maxHeight: 90, overflowY: "auto", border: "1px solid #e2e8f0", padding: 4, borderRadius: 6, background: "#fff", marginBottom: 6 },
  miniCheckboxLabel: { display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 6px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 10, cursor: "pointer" },
  createButton: { gridColumn: "1 / -1", border: "none", background: "#16a34a", color: "#ffffff", borderRadius: 8, padding: "12px", fontSize: 13, fontWeight: 800, cursor: "pointer" },
  loading: { padding: 30, textAlign: "center", color: "#6b7280", fontSize: 13 },
  empty: { padding: 30, textAlign: "center", background: "#ffffff", borderRadius: 12, color: "#6b7280", fontSize: 13 },
  userList: { display: "flex", flexDirection: "column", gap: 10 },
  userCard: { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 13, padding: 13, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" },
  userInfo: { flex: "1 1 200px", display: "flex", alignItems: "center", gap: 10 },
  avatar: { width: 42, height: 42, borderRadius: "50%", background: "#111827", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, flexShrink: 0 },
  userDetails: { minWidth: 0 },
  userName: { fontSize: 14, fontWeight: 800, color: "#111827" },
  email: { marginTop: 2, fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  youBadge: { display: "inline-block", marginTop: 4, padding: "2px 6px", borderRadius: 5, background: "#dbeafe", color: "#1d4ed8", fontSize: 8, fontWeight: 800 },
  controlGroup: { minWidth: 140 },
  deleteGroup: { minWidth: 55 },
  label: { display: "block", marginBottom: 4, fontSize: 10, fontWeight: 700, color: "#6b7280" },
  select: { width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 10px", background: "#ffffff", color: "#111827", fontSize: 12, fontWeight: 600, outline: "none" },
  smallSaveBtn: { border: "none", background: "#2563eb", color: "#fff", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", width: "100%", marginTop: 4 },
  deleteButton: { width: 40, height: 38, border: "none", borderRadius: 8, background: "#fee2e2", color: "#991b1b", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" },
  accessDenied: { minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 20 },
  accessIcon: { fontSize: 40, marginBottom: 10 },
  accessTitle: { fontSize: 20, fontWeight: 800, color: "#111827" },
  accessText: { marginTop: 5, fontSize: 12, color: "#6b7280" },
};