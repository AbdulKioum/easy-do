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
  created_at?: string;
  updated_at?: string;
};

export default function UserManagementPage() {
  const {
    profile: currentProfile,
    role: currentRole,
  } = useAuth();

  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ==========================================
  // ADD USER FORM
  // ==========================================

  const [showAddUser, setShowAddUser] = useState(false);

  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] =
    useState<UserRole>("user");
  const [newStatus, setNewStatus] =
    useState("Active");

  const [creatingUser, setCreatingUser] =
    useState(false);

  // ==========================================
  // LOAD USERS
  // ==========================================

  async function loadUsers() {
    if (currentRole !== "super_admin") {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    const {
      data,
      error,
    } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Load users error:",
        error
      );

      setError(
        `Failed to load users: ${error.message}`
      );

      setLoading(false);
      return;
    }

    setUsers(
      (data || []) as Profile[]
    );

    setLoading(false);
  }

  // ==========================================
  // INITIAL LOAD
  // ==========================================

  useEffect(() => {
    if (
      currentRole ===
      "super_admin"
    ) {
      loadUsers();
    } else {
      setLoading(false);
    }
  }, [currentRole]);

  // ==========================================
  // CREATE USER
  // ==========================================

  async function handleCreateUser() {
    if (currentRole !== "super_admin") {
      setError(
        "Only Super Admin can create users."
      );
      return;
    }

    setError("");
    setSuccess("");

    const fullName =
      newFullName.trim();

    const email =
      newEmail.trim().toLowerCase();

    const password =
      newPassword;

    if (!fullName) {
      setError(
        "Please enter full name."
      );
      return;
    }

    if (!email) {
      setError(
        "Please enter email."
      );
      return;
    }

    if (!password) {
      setError(
        "Please enter password."
      );
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must be at least 6 characters."
      );
      return;
    }

    setCreatingUser(true);

    try {
      const {
        data,
        error,
      } =
        await supabase.functions.invoke(
          "create-user",
          {
            body: {
              full_name: fullName,
              email,
              password,
              role: newRole,
              status: newStatus,
            },
          }
        );

      if (error) {
        console.error(
          "Create user function error:",
          error
        );

        setError(
          `Create user failed: ${error.message}`
        );

        setCreatingUser(false);
        return;
      }

      if (!data?.success) {
        setError(
          data?.error ||
            "Failed to create user."
        );

        setCreatingUser(false);
        return;
      }

      setSuccess(
        "User created successfully."
      );

      // Reset form

      setNewFullName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("user");
      setNewStatus("Active");

      setShowAddUser(false);

      await loadUsers();

    } catch (err) {
      console.error(
        "Create user error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to create user."
      );
    }

    setCreatingUser(false);
  }

  // ==========================================
  // CHANGE ROLE
  // ==========================================

  async function handleRoleChange(
    userId: string,
    newRole: UserRole
  ) {
    if (
      currentRole !==
      "super_admin"
    ) {
      setError(
        "Only Super Admin can change user roles."
      );

      return;
    }

    if (
      userId ===
      currentProfile?.id
    ) {
      setError(
        "You cannot change your own role."
      );

      return;
    }

    setError("");
    setSuccess("");
    setSavingId(userId);

    const {
      error,
    } =
      await supabase
        .from("profiles")
        .update({
          role: newRole,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", userId);

    if (error) {
      console.error(
        "Role update error:",
        error
      );

      setError(
        `Role update failed: ${error.message}`
      );

      setSavingId(null);
      return;
    }

    setUsers(
      (previousUsers) =>
        previousUsers.map(
          (user) =>
            user.id === userId
              ? {
                  ...user,
                  role: newRole,
                }
              : user
        )
    );

    setSuccess(
      "User role updated successfully."
    );

    setSavingId(null);
  }

  // ==========================================
  // CHANGE STATUS
  // ==========================================

  async function handleStatusChange(
    userId: string,
    newStatus: string
  ) {
    if (
      currentRole !==
      "super_admin"
    ) {
      setError(
        "Only Super Admin can change user status."
      );

      return;
    }

    if (
      userId ===
      currentProfile?.id
    ) {
      setError(
        "You cannot change your own status."
      );

      return;
    }

    setError("");
    setSuccess("");
    setSavingId(userId);

    const {
      error,
    } =
      await supabase
        .from("profiles")
        .update({
          status: newStatus,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", userId);

    if (error) {
      console.error(
        "Status update error:",
        error
      );

      setError(
        `Status update failed: ${error.message}`
      );

      setSavingId(null);
      return;
    }

    setUsers(
      (previousUsers) =>
        previousUsers.map(
          (user) =>
            user.id === userId
              ? {
                  ...user,
                  status: newStatus,
                }
              : user
        )
    );

    setSuccess(
      "User status updated successfully."
    );

    setSavingId(null);
  }

  // ==========================================
  // ACCESS CHECK
  // ==========================================

  if (
    currentRole !==
    "super_admin"
  ) {
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
          Only Super Admin can
          access User Management.
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
            User Management
          </h1>

          <p
            style={
              styles.subtitle
            }
          >
            Create users and manage
            roles and account status
          </p>
        </div>

        <button
          onClick={loadUsers}
          style={
            styles.refreshButton
          }
          disabled={loading}
        >
          ↻ Refresh
        </button>

      </div>

      {/* MESSAGES */}

      {error && (
        <div
          style={styles.error}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={styles.success}
        >
          {success}
        </div>
      )}

      {/* CURRENT USER */}

      {currentProfile && (
        <div
          style={
            styles.currentUser
          }
        >
          <div
            style={
              styles.currentUserLabel
            }
          >
            Logged in as
          </div>

          <div
            style={
              styles.currentUserName
            }
          >
            {currentProfile.full_name ||
              currentProfile.email ||
              "Super Admin"}
          </div>

          <div
            style={
              styles.superBadge
            }
          >
            SUPER ADMIN
          </div>
        </div>
      )}

      {/* =====================================
          ADD USER SECTION
      ===================================== */}

      <div style={styles.addUserBox}>

        <div
          style={
            styles.addUserHeader
          }
        >
          <div>
            <div
              style={
                styles.addUserTitle
              }
            >
              ➕ Add User
            </div>

            <div
              style={
                styles.addUserSubtitle
              }
            >
              Only Super Admin can create
              new users.
            </div>
          </div>

          <button
            onClick={() =>
              setShowAddUser(
                !showAddUser
              )
            }
            style={
              styles.addUserToggle
            }
          >
            {showAddUser
              ? "✕ Close"
              : "＋ Add User"}
          </button>
        </div>

        {showAddUser && (
          <div
            style={
              styles.addUserForm
            }
          >

            {/* FULL NAME */}

            <div
              style={
                styles.formGroup
              }
            >
              <label
                style={
                  styles.formLabel
                }
              >
                Full Name
              </label>

              <input
                type="text"
                value={newFullName}
                onChange={(e) =>
                  setNewFullName(
                    e.target.value
                  )
                }
                placeholder="Enter full name"
                style={
                  styles.input
                }
                disabled={
                  creatingUser
                }
              />
            </div>

            {/* EMAIL */}

            <div
              style={
                styles.formGroup
              }
            >
              <label
                style={
                  styles.formLabel
                }
              >
                Email
              </label>

              <input
                type="email"
                value={newEmail}
                onChange={(e) =>
                  setNewEmail(
                    e.target.value
                  )
                }
                placeholder="Enter email"
                style={
                  styles.input
                }
                disabled={
                  creatingUser
                }
              />
            </div>

            {/* PASSWORD */}

            <div
              style={
                styles.formGroup
              }
            >
              <label
                style={
                  styles.formLabel
                }
              >
                Password
              </label>

              <input
                type="password"
                value={newPassword}
                onChange={(e) =>
                  setNewPassword(
                    e.target.value
                  )
                }
                placeholder="Minimum 6 characters"
                style={
                  styles.input
                }
                disabled={
                  creatingUser
                }
              />
            </div>

            {/* ROLE */}

            <div
              style={
                styles.formGroup
              }
            >
              <label
                style={
                  styles.formLabel
                }
              >
                Role
              </label>

              <select
                value={newRole}
                onChange={(e) =>
                  setNewRole(
                    e.target
                      .value as UserRole
                  )
                }
                style={
                  styles.input
                }
                disabled={
                  creatingUser
                }
              >
                <option value="user">
                  User
                </option>

                <option value="admin">
                  Admin
                </option>

                <option value="super_admin">
                  Super Admin
                </option>
              </select>
            </div>

            {/* STATUS */}

            <div
              style={
                styles.formGroup
              }
            >
              <label
                style={
                  styles.formLabel
                }
              >
                Status
              </label>

              <select
                value={newStatus}
                onChange={(e) =>
                  setNewStatus(
                    e.target.value
                  )
                }
                style={
                  styles.input
                }
                disabled={
                  creatingUser
                }
              >
                <option value="Active">
                  Active
                </option>

                <option value="Inactive">
                  Inactive
                </option>
              </select>
            </div>

            {/* CREATE BUTTON */}

            <button
              onClick={
                handleCreateUser
              }
              disabled={
                creatingUser
              }
              style={
                styles.createButton
              }
            >
              {creatingUser
                ? "Creating..."
                : "Create User"}
            </button>

          </div>
        )}

      </div>

      {/* =====================================
          USER LIST
      ===================================== */}

      {loading ? (
        <div
          style={styles.loading}
        >
          Loading users...
        </div>
      ) : users.length === 0 ? (
        <div
          style={styles.empty}
        >
          No users found.
        </div>
      ) : (
        <div
          style={
            styles.userList
          }
        >
          {users.map((user) => {

            const isCurrentUser =
              user.id ===
              currentProfile?.id;

            const isSaving =
              savingId === user.id;

            return (
              <div
                key={user.id}
                style={
                  styles.userCard
                }
              >

                {/* USER INFO */}

                <div
                  style={
                    styles.userInfo
                  }
                >
                  <div
                    style={
                      styles.avatar
                    }
                  >
                    {(user.full_name ||
                      user.email ||
                      "U")
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div
                    style={
                      styles.userDetails
                    }
                  >
                    <div
                      style={
                        styles.userName
                      }
                    >
                      {user.full_name ||
                        "No Name"}
                    </div>

                    <div
                      style={
                        styles.email
                      }
                    >
                      {user.email ||
                        "No Email"}
                    </div>

                    {isCurrentUser && (
                      <div
                        style={
                          styles.youBadge
                        }
                      >
                        YOU
                      </div>
                    )}
                  </div>
                </div>

                {/* ROLE */}

                <div
                  style={
                    styles.controlGroup
                  }
                >
                  <label
                    style={
                      styles.label
                    }
                  >
                    Role
                  </label>

                  <select
                    value={user.role}
                    disabled={
                      isSaving ||
                      isCurrentUser
                    }
                    onChange={(e) =>
                      handleRoleChange(
                        user.id,
                        e.target
                          .value as UserRole
                      )
                    }
                    style={{
                      ...styles.select,
                      ...(isCurrentUser
                        ? styles.disabledSelect
                        : {}),
                    }}
                  >
                    <option value="user">
                      User
                    </option>

                    <option value="admin">
                      Admin
                    </option>

                    <option value="super_admin">
                      Super Admin
                    </option>
                  </select>
                </div>

                {/* STATUS */}

                <div
                  style={
                    styles.controlGroup
                  }
                >
                  <label
                    style={
                      styles.label
                    }
                  >
                    Status
                  </label>

                  <select
                    value={
                      user.status ||
                      "Active"
                    }
                    disabled={
                      isSaving ||
                      isCurrentUser
                    }
                    onChange={(e) =>
                      handleStatusChange(
                        user.id,
                        e.target.value
                      )
                    }
                    style={{
                      ...styles.select,
                      ...(isCurrentUser
                        ? styles.disabledSelect
                        : {}),
                    }}
                  >
                    <option value="Active">
                      Active
                    </option>

                    <option value="Inactive">
                      Inactive
                    </option>
                  </select>
                </div>

                {/* SAVING */}

                {isSaving && (
                  <div
                    style={
                      styles.saving
                    }
                  >
                    Saving...
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


// ============================================
// STYLES
// ============================================

const styles: Record<
  string,
  React.CSSProperties
> = {

  page: {
    width: "100%",
    maxWidth: 1100,
    margin: "0 auto",
    padding: 16,
    boxSizing: "border-box",
  },

  header: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },

  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: "#111827",
  },

  subtitle: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "#6b7280",
  },

  refreshButton: {
    border:
      "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    borderRadius: 9,
    padding: "9px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },

  error: {
    marginBottom: 12,
    padding: 11,
    borderRadius: 9,
    background: "#fee2e2",
    color: "#991b1b",
    fontSize: 12,
    fontWeight: 600,
  },

  success: {
    marginBottom: 12,
    padding: 11,
    borderRadius: 9,
    background: "#dcfce7",
    color: "#166534",
    fontSize: 12,
    fontWeight: 600,
  },

  currentUser: {
    marginBottom: 16,
    padding: 13,
    borderRadius: 11,
    background: "#f8fafc",
    border:
      "1px solid #e5e7eb",
  },

  currentUserLabel: {
    fontSize: 10,
    color: "#6b7280",
    marginBottom: 3,
  },

  currentUserName: {
    display: "inline-block",
    fontSize: 13,
    fontWeight: 700,
    color: "#111827",
    marginRight: 8,
  },

  superBadge: {
    display: "inline-block",
    padding: "3px 7px",
    borderRadius: 6,
    background: "#111827",
    color: "#ffffff",
    fontSize: 9,
    fontWeight: 800,
  },

  // ========================================
  // ADD USER
  // ========================================

  addUserBox: {
    marginBottom: 18,
    padding: 14,
    borderRadius: 13,
    background: "#ffffff",
    border:
      "1px solid #e5e7eb",
  },

  addUserHeader: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 12,
  },

  addUserTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "#111827",
  },

  addUserSubtitle: {
    marginTop: 3,
    fontSize: 11,
    color: "#6b7280",
  },

  addUserToggle: {
    border: "none",
    background: "#111827",
    color: "#ffffff",
    borderRadius: 9,
    padding: "9px 13px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },

  addUserForm: {
    marginTop: 16,
    paddingTop: 16,
    borderTop:
      "1px solid #e5e7eb",
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },

  formGroup: {
    minWidth: 0,
  },

  formLabel: {
    display: "block",
    marginBottom: 5,
    fontSize: 11,
    fontWeight: 700,
    color: "#374151",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    border:
      "1px solid #d1d5db",
    borderRadius: 8,
    padding: "10px 11px",
    background: "#ffffff",
    color: "#111827",
    fontSize: 12,
    outline: "none",
  },

  createButton: {
    alignSelf: "end",
    border: "none",
    background: "#16a34a",
    color: "#ffffff",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },

  // ========================================
  // USER LIST
  // ========================================

  loading: {
    padding: 30,
    textAlign: "center",
    color: "#6b7280",
    fontSize: 13,
  },

  empty: {
    padding: 30,
    textAlign: "center",
    background: "#ffffff",
    borderRadius: 12,
    color: "#6b7280",
    fontSize: 13,
  },

  userList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  userCard: {
    background: "#ffffff",
    border:
      "1px solid #e5e7eb",
    borderRadius: 13,
    padding: 13,
    display: "flex",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
  },

  userInfo: {
    flex: "1 1 220px",
    minWidth: 180,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    background: "#111827",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    fontWeight: 800,
    flexShrink: 0,
  },

  userDetails: {
    minWidth: 0,
  },

  userName: {
    fontSize: 14,
    fontWeight: 800,
    color: "#111827",
  },

  email: {
    marginTop: 2,
    fontSize: 11,
    color: "#6b7280",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  youBadge: {
    display: "inline-block",
    marginTop: 4,
    padding: "2px 6px",
    borderRadius: 5,
    background: "#dbeafe",
    color: "#1d4ed8",
    fontSize: 8,
    fontWeight: 800,
  },

  controlGroup: {
    minWidth: 140,
  },

  label: {
    display: "block",
    marginBottom: 4,
    fontSize: 10,
    fontWeight: 700,
    color: "#6b7280",
  },

  select: {
    width: "100%",
    boxSizing: "border-box",
    border:
      "1px solid #d1d5db",
    borderRadius: 8,
    padding: "9px 10px",
    background: "#ffffff",
    color: "#111827",
    fontSize: 12,
    fontWeight: 600,
    outline: "none",
  },

  disabledSelect: {
    background: "#f3f4f6",
    color: "#9ca3af",
    cursor: "not-allowed",
  },

  saving: {
    fontSize: 10,
    color: "#6b7280",
    fontWeight: 600,
  },

  // ========================================
  // ACCESS DENIED
  // ========================================

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