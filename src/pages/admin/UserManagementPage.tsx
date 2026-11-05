import { useEffect, useMemo, useState } from "react";
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
  allow_sub_agent_special?: boolean;
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

  // SEARCH & DROPDOWN FILTER STATES
  const [showSearchBox, setShowSearchBox] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserDropdown, setSelectedUserDropdown] = useState("All");

  // ADD USER FORM STATES
  const [showAddUser, setShowAddUser] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("user");
  const [newStatus, setNewStatus] = useState("Active");
  const [newAssignedPriceList, setNewAssignedPriceList] = useState("price_list_1");
  const [newAllowSubAgentSpecial, setNewAllowSubAgentSpecial] = useState(false);
  const [newAssignedDistricts, setNewAssignedDistricts] = useState<string[]>([]);
  const [newAssignedLocations, setNewAssignedLocations] = useState<string[]>([]);
  const [creatingUser, setCreatingUser] = useState(false);

  // EDIT MODAL STATES (Full Form Layout Like Add User)
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("user");
  const [editStatus, setEditStatus] = useState("Active");
  const [editPriceList, setEditPriceList] = useState("price_list_1");
  const [editAllowSubAgent, setEditAllowSubAgent] = useState(false);
  const [editDistricts, setEditDistricts] = useState<string[]>([]);
  const [editLocations, setEditLocations] = useState<string[]>([]);
  const [updatingUser, setUpdatingUser] = useState(false);

  // PASSWORD RECOVERY STATES
  const [resetModalUser, setResetModalUser] = useState<Profile | null>(null);
  const [newManualPassword, setNewManualPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

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

      const { data: transData } = await supabase.from("transportation").select("from_location");
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

    setUsers((data || []) as Profile[]);
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
          allow_sub_agent_special: newAllowSubAgentSpecial,
        },
      });

      if (error || !data?.success) {
        setError(`Create user failed: ${error?.message || data?.error}`);
        setCreatingUser(false);
        return;
      }

      if (data?.user?.id) {
        await supabase
          .from("profiles")
          .update({
            assigned_price_list: newAssignedPriceList,
            allow_sub_agent_special: newAllowSubAgentSpecial,
          })
          .eq("id", data.user.id);
      } else {
        await supabase
          .from("profiles")
          .update({
            assigned_price_list: newAssignedPriceList,
            allow_sub_agent_special: newAllowSubAgentSpecial,
          })
          .eq("email", email);
      }

      setSuccess("User created successfully.");
      setNewFullName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("user");
      setNewStatus("Active");
      setNewAssignedPriceList("price_list_1");
      setNewAllowSubAgentSpecial(false);
      setNewAssignedDistricts([]);
      setNewAssignedLocations([]);
      setShowAddUser(false);

      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user.");
    }

    setCreatingUser(false);
  }

  function openEditModal(user: Profile) {
    setEditingUser(user);
    setEditFullName(user.full_name || "");
    setEditRole(user.role);
    setEditStatus(user.status || "Active");
    setEditPriceList(user.assigned_price_list || "price_list_1");
    setEditAllowSubAgent(Boolean(user.allow_sub_agent_special));
    setEditDistricts(user.assigned_districts || []);
    setEditLocations(user.assigned_from_locations || []);
  }

  async function handleUpdateUser() {
    if (!editingUser) return;
    const fullName = editFullName.trim();
    if (!fullName) {
      alert("Full name cannot be empty.");
      return;
    }

    setUpdatingUser(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        role: editRole,
        status: editStatus,
        assigned_price_list: editPriceList,
        allow_sub_agent_special: editAllowSubAgent,
        assigned_districts: editDistricts,
        assigned_from_locations: editLocations,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingUser.id);

    if (error) {
      alert(`Update failed: ${error.message}`);
    } else {
      setSuccess("User updated successfully.");
      setEditingUser(null);
      await loadUsers();
    }
    setUpdatingUser(false);
  }

  async function handleSendResetEmail(email: string | null) {
    if (!email) {
      alert("This user does not have a valid email address.");
      return;
    }

    setResettingPassword(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });

    if (error) {
      alert(`Password reset email failed: ${error.message}`);
    } else {
      alert(`Password reset link successfully sent to ${email}`);
    }
    setResettingPassword(false);
  }

  async function handleAdminSetPassword() {
    if (!resetModalUser || !newManualPassword) {
      alert("Please enter a new password.");
      return;
    }
    if (newManualPassword.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    setResettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-user-password", {
        body: { user_id: resetModalUser.id, new_password: newManualPassword },
      });

      if (error || !data?.success) {
        alert(`Password update failed: ${error?.message || data?.error}`);
      } else {
        alert(`Password successfully updated for ${resetModalUser.full_name || resetModalUser.email}`);
        setResetModalUser(null);
        setNewManualPassword("");
      }
    } catch (err: any) {
      alert(`Password update error: ${err.message}`);
    }
    setResettingPassword(false);
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

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const name = (u.full_name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = name.includes(query) || email.includes(query);

      const matchesDropdown =
        selectedUserDropdown === "All" || u.id === selectedUserDropdown;

      return matchesSearch && matchesDropdown;
    });
  }, [users, searchQuery, selectedUserDropdown]);

  if (currentRole !== "super_admin") {
    return (
      <div style={styles.accessDenied}>
        <div style={styles.accessIcon}>🔒</div>
        <div style={styles.accessTitle}>Access Denied</div>
        <div style={styles.accessText}>Only Super Admin can access User Management.</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <style>{MODERN_CSS}</style>

      {/* HEADER WITH CENTERED TITLE & SEARCH ICON */}
      <div style={styles.header}>
        <div />
        <div style={{ textAlign: "center" }}>
          <h1 style={styles.title}>User Management</h1>
          <p style={styles.subtitle}>Manage system users and permissions</p>
        </div>
        <button
          onClick={() => setShowSearchBox(!showSearchBox)}
          style={{
            ...styles.iconBtn,
            background: showSearchBox ? "#2563eb" : "#ffffff",
            color: showSearchBox ? "#ffffff" : "#1e293b",
          }}
          title="Toggle Search"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      {/* EXPANDABLE SEARCH BAR */}
      {showSearchBox && (
        <div className="edo-search-bar" style={styles.searchBar}>
          <span>🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search user by name or email..."
            autoFocus
            style={styles.searchInput}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} style={styles.clearSearchBtn}>
              ✕
            </button>
          )}
        </div>
      )}

      {/* STATS & USER SELECT DROPDOWN BAR */}
      <div style={styles.topControlRow}>
        <div style={styles.statsCard}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#64748b" }}>Total Users:</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#2563eb" }}>{users.length}</span>
        </div>

        <div style={{ flex: "1 1 240px", minWidth: 200 }}>
          <select
            value={selectedUserDropdown}
            onChange={(e) => setSelectedUserDropdown(e.target.value)}
            style={styles.input}
          >
            <option value="All">📂 All Users ({users.length})</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                👤 {u.full_name || u.email} ({u.role})
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => {
            loadUsers();
            loadMetadata();
          }}
          style={styles.refreshBtn}
        >
          ↻ Refresh
        </button>
      </div>

      {/* ADD USER SECTION */}
      <div style={styles.addUserCard}>
        <div style={styles.addUserHeader}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>➕ Add New User</div>
            <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>Create account with role and district access.</div>
          </div>
          <button onClick={() => setShowAddUser(!showAddUser)} style={styles.addUserToggleBtn}>
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
                placeholder="Min 6 characters"
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
              <label style={styles.formLabel}>Price List</label>
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

            <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
              <input
                type="checkbox"
                id="newSubAgent"
                checked={newAllowSubAgentSpecial}
                onChange={(e) => setNewAllowSubAgentSpecial(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "#2563eb", cursor: "pointer" }}
                disabled={creatingUser}
              />
              <label htmlFor="newSubAgent" style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", cursor: "pointer" }}>
                Allow Sub-Agent Special Option
              </label>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={styles.formLabel}>Assigned Districts</label>
              <div style={styles.checkboxContainer}>
                {allDistricts.map((dist) => {
                  const checked = newAssignedDistricts.includes(dist);
                  return (
                    <label key={dist} style={{ ...styles.checkboxLabel, background: checked ? "#eff6ff" : "#fff" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setNewAssignedDistricts(handleMultiSelectToggle(newAssignedDistricts, dist))}
                        disabled={creatingUser}
                      />
                      <span>{dist}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={styles.formLabel}>Assigned Transport From Locations (Mills / Depots)</label>
              <div style={styles.checkboxContainer}>
                {allLocations.map((loc) => {
                  const checked = newAssignedLocations.includes(loc);
                  return (
                    <label key={loc} style={{ ...styles.checkboxLabel, background: checked ? "#eff6ff" : "#fff" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setNewAssignedLocations(handleMultiSelectToggle(newAssignedLocations, loc))}
                        disabled={creatingUser}
                      />
                      <span>{loc}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <button onClick={handleCreateUser} disabled={creatingUser} style={styles.createButton}>
              {creatingUser ? "Creating..." : "Create User Account"}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div style={styles.loading}>Loading users...</div>
      ) : filteredUsers.length === 0 ? (
        <div style={styles.empty}>No users found.</div>
      ) : (
        <div style={styles.userList}>
          {filteredUsers.map((user) => {
            const isCurrentUser = user.id === currentProfile?.id;
            const isSaving = savingId === user.id;

            return (
              <div key={user.id} style={styles.userCard}>
                <div style={{ width: "100%" }}>
                  <div style={styles.userInfo}>
                    <div style={styles.avatar}>
                      {(user.full_name || user.email || "U").charAt(0).toUpperCase()}
                    </div>
                    <div style={styles.userDetails}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <div style={styles.userName}>{user.full_name || "No Name"}</div>
                        <span style={{ ...styles.badge, background: user.role === "super_admin" ? "#fef3c7" : user.role === "admin" ? "#e0f2fe" : "#f1f5f9", color: user.role === "super_admin" ? "#92400e" : user.role === "admin" ? "#0369a1" : "#475569" }}>
                          {user.role}
                        </span>
                        <span style={{ ...styles.badge, background: user.status === "Inactive" ? "#fee2e2" : "#dcfce7", color: user.status === "Inactive" ? "#991b1b" : "#166534" }}>
                          {user.status || "Active"}
                        </span>
                      </div>
                      <div style={styles.email}>{user.email || "No Email"}</div>
                      {isCurrentUser && <div style={styles.youBadge}>YOU</div>}
                    </div>
                  </div>

                  {/* ASSIGNED INFO SHOWN CLEARLY ON TOP OF CARD */}
                  <div style={styles.assignedInfoBox}>
                    <div style={{ fontSize: 11.5, color: "#334155", marginBottom: 4 }}>
                      <b>Price List:</b> {user.assigned_price_list || "price_list_1"} &nbsp;|&nbsp; 
                      <b>Sub-Agent Special:</b>{" "}
                      <span style={{ color: user.allow_sub_agent_special ? "#16a34a" : "#dc2626", fontWeight: 700 }}>
                        {user.allow_sub_agent_special ? "Allowed" : "Not Allowed"}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "#334155", marginBottom: 4 }}>
                      <b>Districts:</b> {user.assigned_districts && user.assigned_districts.length > 0 ? user.assigned_districts.join(", ") : "None"}
                    </div>
                    <div style={{ fontSize: 11.5, color: "#334155" }}>
                      <b>Depots/Mills:</b> {user.assigned_from_locations && user.assigned_from_locations.length > 0 ? user.assigned_from_locations.join(", ") : "None"}
                    </div>
                  </div>
                </div>

                <div style={styles.actionRow}>
                  <button
                    onClick={() => setResetModalUser(user)}
                    style={styles.keyBtn}
                    title="Password Reset / Recovery"
                  >
                    🔑 Password
                  </button>

                  <button
                    onClick={() => openEditModal(user)}
                    style={styles.editBtn}
                    title="Full Edit Details"
                  >
                    ✏️ Edit
                  </button>

                  {!isCurrentUser && (
                    <button
                      onClick={() => handleDeleteUser(user.id, user.full_name || user.email || "this user")}
                      disabled={isSaving}
                      style={styles.deleteButton}
                      title="Delete User"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FULL EDIT MODAL (Like Add User Form Layout) */}
      {editingUser && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}>Edit User Details</h3>
              <button onClick={() => setEditingUser(null)} style={styles.modalCloseBtn}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "75vh", overflowY: "auto", paddingRight: 4 }}>
              <div>
                <label style={styles.formLabel}>Full Name</label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  style={styles.input}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  style={styles.input}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Assigned Price List</label>
                <select
                  value={editPriceList}
                  onChange={(e) => setEditPriceList(e.target.value)}
                  style={styles.input}
                >
                  <option value="price_list_1">Price List 1</option>
                  <option value="price_list_2">Price List 2</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                <input
                  type="checkbox"
                  id="editSubAgent"
                  checked={editAllowSubAgent}
                  onChange={(e) => setEditAllowSubAgent(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "#2563eb", cursor: "pointer" }}
                />
                <label htmlFor="editSubAgent" style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", cursor: "pointer" }}>
                  Allow Sub-Agent Special Option
                </label>
              </div>

              <div>
                <label style={styles.formLabel}>Assigned Districts</label>
                <div style={styles.checkboxContainer}>
                  {allDistricts.map((dist) => {
                    const checked = editDistricts.includes(dist);
                    return (
                      <label key={dist} style={{ ...styles.checkboxLabel, background: checked ? "#eff6ff" : "#fff" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setEditDistricts(handleMultiSelectToggle(editDistricts, dist))}
                        />
                        <span>{dist}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={styles.formLabel}>Assigned From Locations (Mills / Depots)</label>
                <div style={styles.checkboxContainer}>
                  {allLocations.map((loc) => {
                    const checked = editLocations.includes(loc);
                    return (
                      <label key={loc} style={{ ...styles.checkboxLabel, background: checked ? "#eff6ff" : "#fff" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setEditLocations(handleMultiSelectToggle(editLocations, loc))}
                        />
                        <span>{loc}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button onClick={() => setEditingUser(null)} style={styles.cancelModalBtn}>Cancel</button>
              <button onClick={handleUpdateUser} disabled={updatingUser} style={styles.saveModalBtn}>
                {updatingUser ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PASSWORD RECOVERY MODAL */}
      {resetModalUser && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Password Recovery</h3>
              <button onClick={() => setResetModalUser(null)} style={styles.modalCloseBtn}>✕</button>
            </div>
            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>
              User: <b>{resetModalUser.full_name || resetModalUser.email}</b>
            </p>

            <div style={{ marginBottom: 14, background: "#f8fafc", padding: 12, borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>Option 1: Send Reset Email Link</div>
              <button
                onClick={() => handleSendResetEmail(resetModalUser.email)}
                disabled={resettingPassword}
                style={styles.resetEmailBtn}
              >
                📤 Send Password Reset Email
              </button>
            </div>

            <div style={{ background: "#f8fafc", padding: 12, borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>Option 2: Set New Password Directly</div>
              <input
                type="password"
                value={newManualPassword}
                onChange={(e) => setNewManualPassword(e.target.value)}
                placeholder="Enter new password (min 6 chars)"
                style={{ ...styles.input, marginBottom: 8 }}
              />
              <button
                onClick={handleAdminSetPassword}
                disabled={resettingPassword || !newManualPassword}
                style={styles.saveModalBtn}
              >
                {resettingPassword ? "Updating..." : "Set New Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const MODERN_CSS = `
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
`;

const styles: Record<string, React.CSSProperties> = {
  page: { width: "100%", maxWidth: 1250, margin: "0 auto", padding: 16, boxSizing: "border-box", fontFamily: "'Inter', sans-serif" },
  header: { display: "grid", gridTemplateColumns: "36px 1fr 36px", alignItems: "center", marginBottom: 16 },
  title: { margin: 0, fontSize: 21, fontWeight: 800, color: "#0f172a" },
  subtitle: { margin: "3px 0 0", fontSize: 12, color: "#64748b" },
  iconBtn: { border: "1px solid #cbd5e1", width: 36, height: 36, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", justifySelf: "end" },
  error: { marginBottom: 12, padding: 11, borderRadius: 10, background: "#fee2e2", color: "#991b1b", fontSize: 12, fontWeight: 600 },
  success: { marginBottom: 12, padding: 11, borderRadius: 10, background: "#dcfce7", color: "#166534", fontSize: 12, fontWeight: 600 },
  searchBar: { display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1.5px solid #2563eb", padding: "10px 14px", borderRadius: 12, marginBottom: 14, boxShadow: "0 4px 15px rgba(37,99,235,0.08)", animation: "fadeIn 0.2s ease" },
  searchInput: { border: "none", outline: "none", width: "100%", fontSize: 13.5, background: "transparent", fontWeight: 500 },
  clearSearchBtn: { border: "none", background: "#f1f5f9", borderRadius: "50%", width: 22, height: 22, cursor: "pointer", fontWeight: 700 },
  topControlRow: { display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" },
  statsCard: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 },
  refreshBtn: { border: "1px solid #cbd5e1", background: "#fff", color: "#1e293b", borderRadius: 10, padding: "10px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  addUserCard: { marginBottom: 18, padding: 16, borderRadius: 16, background: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" },
  addUserHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  addUserToggleBtn: { border: "none", background: "#0f172a", color: "#ffffff", borderRadius: 10, padding: "9px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  addUserForm: { marginTop: 16, paddingTop: 16, borderTop: "1px solid #e2e8f0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
  formGroup: { minWidth: 0 },
  formLabel: { display: "block", marginBottom: 5, fontSize: 11.5, fontWeight: 750, color: "#334155" },
  input: { width: "100%", boxSizing: "border-box", border: "1.5px solid #cbd5e1", borderRadius: 10, padding: "10px 12px", background: "#ffffff", color: "#0f172a", fontSize: 13, outline: "none" },
  checkboxContainer: { display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 130, overflowY: "auto", border: "1px solid #e2e8f0", padding: 8, borderRadius: 10, background: "#f8fafc" },
  checkboxLabel: { display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 11.5, cursor: "pointer", fontWeight: 600 },
  createButton: { gridColumn: "1 / -1", border: "none", background: "#16a34a", color: "#ffffff", borderRadius: 12, padding: "13px", fontSize: 13.5, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 12px rgba(22,163,74,0.25)" },
  loading: { padding: 40, textAlign: "center", color: "#64748b", fontSize: 13, fontWeight: 600 },
  empty: { padding: 40, textAlign: "center", background: "#ffffff", borderRadius: 16, color: "#64748b", fontSize: 13 },
  userList: { display: "flex", flexDirection: "column", gap: 12 },
  userCard: { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.02)" },
  userInfo: { display: "flex", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: "50%", background: "#0f172a", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, flexShrink: 0 },
  userDetails: { minWidth: 0 },
  userName: { fontSize: 14.5, fontWeight: 800, color: "#0f172a" },
  badge: { padding: "2px 8px", borderRadius: 6, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" },
  email: { marginTop: 2, fontSize: 12, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  youBadge: { display: "inline-block", marginTop: 4, padding: "2px 6px", borderRadius: 6, background: "#dbeafe", color: "#1d4ed8", fontSize: 9, fontWeight: 800 },
  assignedInfoBox: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", marginTop: 8 },
  actionRow: { display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", borderTop: "1px solid #f1f5f9", paddingTop: 10 },
  keyBtn: { border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", borderRadius: 9, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  editBtn: { border: "none", background: "#e0f2fe", color: "#0369a1", borderRadius: 9, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  deleteButton: { width: 38, height: 38, border: "none", borderRadius: 9, background: "#fee2e2", color: "#991b1b", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" },
  overlay: { position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 },
  modal: { width: "100%", maxWidth: 500, background: "#fff", borderRadius: 20, padding: 20, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.15)", boxSizing: "border-box" },
  modalCloseBtn: { border: "none", background: "#f1f5f9", width: 28, height: 28, borderRadius: "50%", cursor: "pointer", fontWeight: 700, color: "#475569" },
  cancelModalBtn: { border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" },
  saveModalBtn: { border: "none", background: "#2563eb", color: "#fff", borderRadius: 10, padding: "10px 18px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" },
  resetEmailBtn: { width: "100%", border: "none", background: "#0f172a", color: "#fff", borderRadius: 8, padding: "10px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  accessDenied: { minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 20 },
  accessIcon: { fontSize: 40, marginBottom: 10 },
  accessTitle: { fontSize: 20, fontWeight: 800, color: "#111827" },
  accessText: { marginTop: 5, fontSize: 12, color: "#6b7280" },
};