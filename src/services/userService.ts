import { supabase } from "../lib/supabase";

export type UserRole =
  | "user"
  | "admin"
  | "super_admin";

export type UserProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  status: string;
  created_at?: string;
  updated_at?: string;
};


// =====================================================
// GET ALL USERS
// =====================================================

export async function getAllUsers(): Promise<UserProfile[]> {
  const { data, error } =
    await supabase.rpc("get_all_profiles");

  if (error) {
    console.error(
      "Get users error:",
      error
    );

    throw error;
  }

  return (data || []) as UserProfile[];
}


// =====================================================
// CHANGE USER ROLE
// =====================================================

export async function updateUserRole(
  userId: string,
  role: UserRole
): Promise<UserProfile> {

  const { data, error } =
    await supabase.rpc(
      "update_user_role",
      {
        target_user_id: userId,
        new_role: role,
      }
    );

  if (error) {
    console.error(
      "Update role error:",
      error
    );

    throw error;
  }

  return data as UserProfile;
}