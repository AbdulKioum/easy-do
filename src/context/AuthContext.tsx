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

// Offline, a Supabase request can hang for a long time instead of failing
// (e.g. Wi-Fi connected but no internet — navigator.onLine still says
// online). Never let a network call hold the startup loader hostage:
// race it against a short timeout and treat a timeout as offline.
const NETWORK_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: PromiseLike<T>, ms = NETWORK_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Network timeout — treating as offline")), ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

// Supabase stores the session in localStorage under sb-*-auth-token.
// If getSession() itself hangs (expired token + no network), read the
// stored session directly so a logged-in user still opens instantly.
function readStoredSession(): { session: Session; user: User } | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const user = parsed?.user ?? parsed?.session?.user;
      if (!user) continue;
      const session = (parsed?.session ?? parsed) as Session;
      return { session, user: user as User };
    }
  } catch {
    /* ignore — caller falls back to no session */
  }
  return null;
}


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
      } = await withTimeout(supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle());


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

      // 1. Show the cached profile immediately so the app paints at once.
      try {
        const cached = await getCachedProfile();
        if (mounted && cached) setProfile(cached as Profile);
      } catch {
        /* ignore */
      }

      // 2. Read the stored session straight from the phone — no network
      // call at all — and clear the loader right away. Startup must be
      // under a second, offline or online.
      const stored = readStoredSession();
      if (mounted) {
        setSession(stored?.session ?? null);
        setUser(stored?.user ?? null);
        setLoading(false);
      }

      // 3. Everything network-related runs in the background and can
      // never hold the screen: verify/refresh the session, then the
      // profile. If the net is dead, the stored session + cached
      // profile above are already on screen.
      if (stored?.user) {
        void loadProfile(stored.user);
      }
      void (async () => {
        try {
          const { data: { session } } = await withTimeout(
            supabase.auth.getSession()
          );
          if (!mounted) return;
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) void loadProfile(session.user);
        } catch {
          /* offline — stored session already shown */
        }
      })();
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

            // Background refresh only — never block on it.
            void loadProfile(
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