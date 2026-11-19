import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import type {
  Session,
  User,
} from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";

import {
  CACHE_KEYS,
  cacheProfile,
  getCachedProfile,
  removeCache,
  setupOfflineListeners,
} from "../lib/offlineSync";


export type UserRole =
  | "user"
  | "admin"
  | "super_admin";


export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  status: string;
  created_at?: string;
  updated_at?: string;
};


type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole | null;

  loading: boolean;

  signIn: (
    email: string,
    password: string
  ) => Promise<{
    error: any;
  }>;

  signOut: () => Promise<void>;

  refreshProfile: () => Promise<void>;
};


const AuthContext =
  createContext<AuthContextType | undefined>(
    undefined
  );


export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {

  const [session, setSession] =
    useState<Session | null>(null);

  const [user, setUser] =
    useState<User | null>(null);

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [loading, setLoading] =
    useState(true);


  // ==========================================
  // LOAD PROFILE
  // ==========================================

  async function loadProfile(
    authUser: User | null
  ) {

    if (!authUser) {
      setProfile(null);
      return;
    }

    try {
      const {
        data,
        error,
      } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();


      if (error) {
        throw error;
      }

      // Cache the profile so a logged-in user can open the app offline.
      if (data) {
        await cacheProfile(data);
      }

      setProfile(
        data as Profile | null
      );
    } catch (err) {
      console.error(
        "Profile load error:",
        err
      );

      // Offline fallback: a session exists but the network failed — use the
      // last cached profile instead of locking the user out.
      try {
        const cached = await getCachedProfile();
        if (cached && cached.id === authUser.id) {
          setProfile(cached as Profile);
          return;
        }
      } catch {
        /* ignore */
      }

      setProfile(null);
    }
  }


  // ==========================================
  // INITIAL SESSION
  // ==========================================

  useEffect(() => {

    let mounted = true;

    // Offline flush triggers (online event + app foreground), once only.
    setupOfflineListeners();

    async function initializeAuth() {

      try {

        // Show the cached profile immediately so the app paints at once;
        // the network profile load below refreshes it in the background.
        try {
          const cached = await getCachedProfile();
          if (mounted && cached) setProfile(cached as Profile);
        } catch {
          /* ignore */
        }

        const {
          data: {
            session: currentSession,
          },
        } =
          await supabase.auth.getSession();


        if (!mounted) {
          return;
        }


        setSession(currentSession);

        setUser(
          currentSession?.user || null
        );


        if (currentSession?.user) {

          await loadProfile(
            currentSession.user
          );
        }

      } catch (error) {

        console.error(
          "Auth initialization error:",
          error
        );

      } finally {

        if (mounted) {
          setLoading(false);
        }

      }
    }


    initializeAuth();


    // ========================================
    // AUTH STATE CHANGE
    // ========================================

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        async (
          _event,
          newSession
        ) => {

          if (!mounted) {
            return;
          }


          setSession(newSession);


          const authUser =
            newSession?.user || null;


          setUser(authUser);


          if (authUser) {

            await loadProfile(
              authUser
            );

          } else {

            setProfile(null);

          }


          setLoading(false);
        }
      );


    return () => {

      mounted = false;

      subscription.unsubscribe();

    };

  }, []);


  // ==========================================
  // LOGIN
  // ==========================================

  async function signIn(
    email: string,
    password: string
  ) {

    const result =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });


    if (result.error) {

      return {
        error: result.error,
      };
    }


    if (result.data.user) {

      await loadProfile(
        result.data.user
      );
    }


    return {
      error: null,
    };
  }


  // ==========================================
  // LOGOUT
  // ==========================================

  async function signOut() {

    try {
      const {
        error,
      } =
        await supabase.auth.signOut();


      if (error) {

        console.error(
          "Logout error:",
          error
        );
      }
    } catch (err) {
      // Offline sign-out: the server call fails, but the local session
      // must still be cleared so the user is not stuck logged in.
      console.error("Logout error:", err);
    }

    try {
      await removeCache(CACHE_KEYS.PROFILE);
    } catch {
      /* ignore */
    }


    setSession(null);
    setUser(null);
    setProfile(null);
  }


  // ==========================================
  // REFRESH PROFILE
  // ==========================================

  async function refreshProfile() {

    if (!user) {
      return;
    }


    await loadProfile(user);
  }


  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role:
          profile?.role || null,
        loading,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}


// ============================================
// useAuth HOOK
// ============================================

export function useAuth() {

  const context =
    useContext(AuthContext);


  if (!context) {

    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }


  return context;
}