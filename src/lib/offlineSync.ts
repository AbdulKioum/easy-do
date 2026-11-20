import { createStore, get, set, del } from "idb-keyval";
import { supabase } from "./supabase";

// ============================================================================
// Easy DO — single offline store (IndexedDB via idb-keyval)
// ----------------------------------------------------------------------------
// All pages read master data cache-first from here and refresh in background.
// All writes go local-first, then into the outbox, then to Supabase when
// online. Nothing on a page mount awaits the network before first paint.
// Legacy localStorage helpers (getLocalCache/setLocalCache) are kept only so
// old draft keys (easydo_format1_persistent_*, easydo_page2_persistent_*)
// keep working — new code must use getCache/setCache below.
// ============================================================================

const store = createStore("easydo-db", "easydo-store");

export const CACHE_KEYS = {
  PROFILE: "easydo_cache_profile_v1",
  PRICE_LIST_1: "easydo_cache_price_list_1_v1",
  PRICE_LIST_2: "easydo_cache_price_list_2_v1",
  TRANSPORT: "easydo_cache_transport_v1",
  UPAZILAS: "easydo_cache_upazilas_v1",
  SAVED_DOS: "easydo_cache_saved_dos_v1",
  NOTIFICATIONS: "easydo_cache_notifications_v1",
  OUTBOX: "easydo_outbox_v1",
  DEAD_LETTER: "easydo_dead_letter_v1",
  LAST_SYNC: "easydo_last_sync_v1",
  // kept for backward compatibility with the old localStorage queue key
  PENDING_DO_QUEUE: "easydo_pending_do_queue_v1",
};

export type OutboxKind =
  | "saved_do_insert"
  | "saved_do_update"
  | "saved_do_delete"
  | "page_visit"
  | "notification_reply"
  | "notification_read"
  | "fcm_token";

export type OutboxEntry = {
  id: string; // crypto.randomUUID()
  kind: OutboxKind;
  payload: any;
  tempId?: string; // for saved_do_insert: the local temp id of the row
  created_at: string;
  attempts: number;
  last_error?: string;
};

function newTempId(): string {
  try {
    return `local_${crypto.randomUUID()}`;
  } catch {
    return `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

export function isOnline(): boolean {
  try {
    return navigator.onLine;
  } catch {
    return true;
  }
}

// --- Weak-network handling ----------------------------------------------------
// navigator.onLine only says "some connection exists" — on a weak/slow
// connection it still says online, and then every network call crawls or
// hangs, so the app works neither online nor offline. Fix: probe whether
// the internet is actually usable, in the background, and treat an
// unusable connection exactly like offline (serve cache, queue writes).
// The probe runs on a timer, never inline before an action, so it can
// never slow anything down itself.

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Network timeout")), ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

// Last known verdict: true = net usable, false = treat as offline.
let usableOnline: boolean = (() => {
  try {
    return navigator.onLine;
  } catch {
    return true;
  }
})();

let probeInFlight: Promise<boolean> | null = null;
let lastProbeAt = 0;
const PROBE_INTERVAL_MS = 20000;
const PROBE_TIMEOUT_MS = 4000;

/** One real round-trip to Supabase: true only if it answers quickly. */
export async function probeOnline(): Promise<boolean> {
  const now = Date.now();
  if (probeInFlight) return probeInFlight;
  if (now - lastProbeAt < 5000) return usableOnline;
  probeInFlight = (async () => {
    lastProbeAt = Date.now();
    try {
      const base =
        (supabase as any)?.supabaseUrl ||
        import.meta.env.VITE_SUPABASE_URL ||
        "";
      // Supabase gateway /auth/v1/health keo apikey chara 401 dey
      // (UNAUTHORIZED_MISSING_API_KEY) — key na pathale probe konodin
      // success hoto na, tai usableOnline=false hoye outbox flush
      // bondho hoye jeto (page visit, DO sync — sob atke jeto).
      // Anon key public (app er bundle ei thake), tai probe e pathano safe.
      const key =
        (supabase as any)?.supabaseKey ||
        import.meta.env.VITE_SUPABASE_ANON_KEY ||
        "";
      if (!base || !isOnline()) return false;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
      try {
        const res = await fetch(`${base}/auth/v1/health`, {
          method: "GET",
          cache: "no-store",
          signal: ctrl.signal,
          headers: key
            ? { apikey: key, Authorization: `Bearer ${key}` }
            : {},
        });
        return res.ok;
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return false;
    }
  })();
  try {
    usableOnline = await probeInFlight;
  } finally {
    probeInFlight = null;
  }
  return usableOnline;
}

/** Synchronous read of the last probe verdict (defaults to navigator.onLine). */
export function isUsableOnline(): boolean {
  return usableOnline;
}

let probeTimer: ReturnType<typeof setInterval> | null = null;

function startConnectivityProbe(): void {
  if (probeTimer) return;
  void probeOnline();
  probeTimer = setInterval(() => {
    void probeOnline().then((ok) => {
      if (ok) void flushOutbox();
    });
  }, PROBE_INTERVAL_MS);
}

// --- IndexedDB cache ---------------------------------------------------------

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const v = await get<T>(key, store);
    return v === undefined ? null : v;
  } catch {
    return null;
  }
}

export async function setCache<T>(key: string, data: T): Promise<void> {
  try {
    await set(key, data, store);
  } catch (e) {
    console.warn("Cache save error:", e);
  }
}

export async function removeCache(key: string): Promise<void> {
  try {
    await del(key, store);
  } catch {
    /* ignore */
  }
}

export async function getCachedList<T>(key: string): Promise<T[]> {
  const v = await getCache<T[]>(key);
  return Array.isArray(v) ? v : [];
}

// --- Legacy localStorage helpers (drafts / tiny flags only) -----------------

export function getLocalCache<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function setLocalCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn("LocalStorage save error:", e);
  }
}

export function isRunningInsideApp(): boolean {
  const win = window as any;
  if (win.Capacitor?.isNativePlatform?.()) return true;
  if (window.location.protocol === "capacitor:" || window.location.protocol === "file:") return true;
  if (window.matchMedia?.("(display-mode: standalone)")?.matches) return true;
  if (navigator.userAgent.includes("EasyDOApp") || navigator.userAgent.includes("wv")) return true;
  return false;
}

// --- Profile cache -----------------------------------------------------------

export async function getCachedProfile(): Promise<any | null> {
  return getCache<any>(CACHE_KEYS.PROFILE);
}

export async function cacheProfile(profile: any): Promise<void> {
  if (profile) await setCache(CACHE_KEYS.PROFILE, profile);
}

// --- Last-sync timestamp -----------------------------------------------------

export async function getLastSyncTime(): Promise<string | null> {
  const v = await getCache<string>(CACHE_KEYS.LAST_SYNC);
  if (v) return v;
  try {
    return localStorage.getItem(CACHE_KEYS.LAST_SYNC);
  } catch {
    return null;
  }
}

export async function setLastSyncTime(ts?: string): Promise<void> {
  const value = ts || new Date().toISOString();
  await setCache(CACHE_KEYS.LAST_SYNC, value);
  try {
    localStorage.setItem(CACHE_KEYS.LAST_SYNC, value);
  } catch {
    /* ignore */
  }
}

// --- Outbox ------------------------------------------------------------------

export async function getOutbox(): Promise<OutboxEntry[]> {
  const v = await getCache<OutboxEntry[]>(CACHE_KEYS.OUTBOX);
  if (Array.isArray(v)) return v;
  // one-time migration from the old localStorage DO queue
  try {
    const legacy = getLocalCache<{ tempId: string; payload: any }[]>(CACHE_KEYS.PENDING_DO_QUEUE, []);
    if (legacy.length) {
      const migrated: OutboxEntry[] = legacy.map((item) => ({
        id: newTempId(),
        kind: "saved_do_insert",
        payload: item.payload,
        tempId: item.tempId,
        created_at: new Date().toISOString(),
        attempts: 0,
      }));
      await setCache(CACHE_KEYS.OUTBOX, migrated);
      try {
        localStorage.removeItem(CACHE_KEYS.PENDING_DO_QUEUE);
      } catch {
        /* ignore */
      }
      return migrated;
    }
  } catch {
    /* ignore */
  }
  return [];
}

async function setOutbox(entries: OutboxEntry[]): Promise<void> {
  await setCache(CACHE_KEYS.OUTBOX, entries);
}

export async function enqueueOutbox(
  kind: OutboxKind,
  payload: any,
  opts?: { tempId?: string }
): Promise<OutboxEntry> {
  const entry: OutboxEntry = {
    id: newTempId(),
    kind,
    payload,
    tempId: opts?.tempId,
    created_at: new Date().toISOString(),
    attempts: 0,
  };
  const box = await getOutbox();
  box.push(entry);
  await setOutbox(box);
  return entry;
}

export async function getDeadLetter(): Promise<OutboxEntry[]> {
  const v = await getCache<OutboxEntry[]>(CACHE_KEYS.DEAD_LETTER);
  return Array.isArray(v) ? v : [];
}

async function moveToDeadLetter(entry: OutboxEntry, error: any): Promise<void> {
  const dead = await getDeadLetter();
  dead.push({ ...entry, last_error: String(error?.message || error || "Validation error") });
  await setCache(CACHE_KEYS.DEAD_LETTER, dead.slice(-100));
}

function isValidationError(error: any): boolean {
  if (!error) return false;
  const status = error.status ?? error.code;
  if (typeof status === "number") return status >= 400 && status < 500;
  if (typeof status === "string") {
    // PostgREST codes: 4xxxx = client/validation errors
    if (/^4\d{2}/.test(status)) return true;
    if (/^PGRST/.test(status)) return false;
  }
  const msg = String(error.message || "").toLowerCase();
  return (
    msg.includes("violates") ||
    msg.includes("invalid") ||
    msg.includes("duplicate key") ||
    msg.includes("not-null") ||
    msg.includes("check constraint")
  );
}

let flushing = false;

export async function flushOutbox(): Promise<void> {
  if (flushing || !isUsableOnline()) return;
  flushing = true;
  try {
    let box = await getOutbox();
    if (!box.length) return;
    const remaining: OutboxEntry[] = [];
    for (const entry of box) {
      try {
        // One crawling entry must not stall the whole queue on weak net.
        const result = await withTimeout(flushOne(entry), 5000);
        if (result === "ok") continue;
        if (result === "validation") {
          await moveToDeadLetter(entry, "Validation error");
          continue;
        }
        // network / server error: keep queued
        remaining.push({ ...entry, attempts: entry.attempts + 1 });
      } catch (err: any) {
        if (isValidationError(err)) {
          await moveToDeadLetter(entry, err);
        } else {
          remaining.push({ ...entry, attempts: entry.attempts + 1, last_error: String(err?.message || err) });
        }
      }
    }
    await setOutbox(remaining);
    box = remaining;
    if (!box.length) {
      // all flushed — nothing else to do; last-sync is set by the sync call
    }
  } finally {
    flushing = false;
  }
}

async function flushOne(entry: OutboxEntry): Promise<"ok" | "validation" | "retry"> {
  switch (entry.kind) {
    case "saved_do_insert": {
      const { data, error } = await supabase.from("saved_dos").insert([entry.payload]).select().single();
      if (error) return isValidationError(error) ? "validation" : "retry";
      if (data && entry.tempId) {
        const dos = await getCachedList<any>(CACHE_KEYS.SAVED_DOS);
        await setCache(
          CACHE_KEYS.SAVED_DOS,
          dos.map((d) => (d.id === entry.tempId ? { ...data, is_offline_pending: false } : d))
        );
      }
      return "ok";
    }
    case "saved_do_update": {
      const { id, patch } = entry.payload;
      const { error } = await supabase.from("saved_dos").update(patch).eq("id", id);
      if (error) return isValidationError(error) ? "validation" : "retry";
      return "ok";
    }
    case "saved_do_delete": {
      const { error } = await supabase.from("saved_dos").delete().eq("id", entry.payload.id);
      if (error) return isValidationError(error) ? "validation" : "retry";
      return "ok";
    }
    case "page_visit": {
      const { error } = await supabase.from("page_visits").insert([entry.payload]);
      if (error) return isValidationError(error) ? "validation" : "retry";
      return "ok";
    }
    case "notification_reply": {
      const { error } = await supabase.from("notifications").insert([entry.payload]);
      if (error) return isValidationError(error) ? "validation" : "retry";
      return "ok";
    }
    case "notification_read": {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", entry.payload.id);
      if (error) return isValidationError(error) ? "validation" : "retry";
      return "ok";
    }
    case "fcm_token": {
      const { userId, token } = entry.payload;
      // clear the token from any other profile first, then set it on mine
      try {
        await supabase.from("profiles").update({ fcm_token: null }).eq("fcm_token", token);
      } catch {
        /* best effort */
      }
      const { error } = await supabase.from("profiles").update({ fcm_token: token }).eq("id", userId);
      if (error) return isValidationError(error) ? "validation" : "retry";
      return "ok";
    }
    default:
      return "validation";
  }
}

/** Backwards-compatible name used by older code. */
export async function flushPendingDOQueue(): Promise<void> {
  return flushOutbox();
}

// --- Page-visit log (never blocks, never throws) ------------------------------

export async function logPageVisit(pageName: string, userId?: string, _userEmail?: string): Promise<void> {
  try {
    // Payload shape matches the existing page_visits inserts exactly:
    // { user_id, page_name, visit_date } — created_at is set by the server.
    // (userEmail is accepted for call-site compatibility but not stored;
    // the table has no such column.)
    const payload: any = {
      page_name: pageName,
      visit_date: new Date().toISOString().split("T")[0],
    };
    if (userId) payload.user_id = userId;
    await enqueueOutbox("page_visit", payload);
    if (isOnline()) void flushOutbox();
  } catch {
    /* visit logging must never break the page */
  }
}

// --- Master-data sync ----------------------------------------------------------

export async function syncAllMasterDataInBackground(
  userId?: string,
  isSuperAdmin?: boolean
): Promise<{ ok: boolean; syncedAt: string | null }> {
  // No usable-net gate here: this sync runs in the background and its
  // callers already cap how long THEY wait (Format pages 5s, login 5s).
  // Skipping it on a weak connection would mean the data never arrives
  // at all — and capping the queries themselves would throw away
  // results that were about to complete. Let it finish at its own pace;
  // whatever completes gets cached.
  if (!isOnline()) return { ok: false, syncedAt: await getLastSyncTime() };
  try {
    const queries: Promise<any>[] = [
      supabase.from("feed_price_list").select("*").eq("status", "Active").order("sort_order", { ascending: true }) as any,
      supabase.from("feed_price_list_2").select("*").eq("status", "Active").order("sort_order", { ascending: true }) as any,
      supabase.from("transportation").select("*").eq("status", "Active").order("from_location", { ascending: true }).order("to_upazila", { ascending: true }) as any,
      supabase.from("upazilas").select("*").eq("status", "Active").order("district", { ascending: true }).order("upazila_name", { ascending: true }) as any,
    ];
    if (userId) {
      queries.push(supabase.from("profiles").select("*").eq("id", userId).single() as any);
      // Saved DOs: own rows only, super_admin sees all
      const dosQuery = isSuperAdmin
        ? supabase.from("saved_dos").select("*").order("id", { ascending: false }).limit(500)
        : supabase.from("saved_dos").select("*").eq("user_id", userId).order("id", { ascending: false }).limit(500);
      queries.push(dosQuery as any);
      // Notifications for the bell (last ~100, own + broadcast)
      queries.push(
        supabase
          .from("notifications")
          .select("*")
          .or(`user_id.eq.${userId},user_id.is.null`)
          .order("created_at", { ascending: false })
          .limit(100) as any
      );
    }

    const results = await Promise.allSettled(queries);
    const keys = [
      CACHE_KEYS.PRICE_LIST_1,
      CACHE_KEYS.PRICE_LIST_2,
      CACHE_KEYS.TRANSPORT,
      CACHE_KEYS.UPAZILAS,
      CACHE_KEYS.PROFILE,
      CACHE_KEYS.SAVED_DOS,
      CACHE_KEYS.NOTIFICATIONS,
    ];
    let anyOk = false;
    // Cache writes MUST be awaited before returning: callers read the
    // cache right after this resolves (first login, page open). A
    // fire-and-forget write let the page read before the data landed,
    // so the user saw an empty page until a manual reload.
    const writeJobs: Promise<unknown>[] = [];
    results.forEach((res, i) => {
      if (res.status === "fulfilled" && !res.value.error && res.value.data != null) {
        anyOk = true;
        // merge pending local DO rows back in: a temp row must survive a refresh
        if (keys[i] === CACHE_KEYS.SAVED_DOS) {
          writeJobs.push(
            (async () => {
              const local = await getCachedList<any>(CACHE_KEYS.SAVED_DOS);
              const pending = local.filter((d) => String(d.id || "").startsWith("local_"));
              const serverRows: any[] = res.value.data || [];
              const merged = [...pending, ...serverRows.filter((s) => !pending.some((p) => p.id === s.id))];
              await setCache(CACHE_KEYS.SAVED_DOS, merged);
            })()
          );
        } else {
          writeJobs.push(setCache(keys[i], res.value.data));
        }
      }
    });
    await Promise.all(writeJobs);
    if (anyOk) {
      const ts = new Date().toISOString();
      await setLastSyncTime(ts);
      // flush anything queued while offline, in the background
      void flushOutbox();
      return { ok: true, syncedAt: ts };
    }
    return { ok: false, syncedAt: await getLastSyncTime() };
  } catch (err) {
    console.warn("Background sync skipped:", err);
    return { ok: false, syncedAt: await getLastSyncTime() };
  }
}

// --- DO save / edit / delete (local-first) -------------------------------------

export async function saveDOOfflineFirst(payload: any): Promise<{ synced: boolean; record: any }> {
  const tempId = newTempId();
  const localRecord = { ...payload, id: tempId, created_at: new Date().toISOString(), is_offline_pending: true };
  const existing = await getCachedList<any>(CACHE_KEYS.SAVED_DOS);
  await setCache(CACHE_KEYS.SAVED_DOS, [localRecord, ...existing]);

  if (isUsableOnline()) {
    try {
      const { data, error } = await withTimeout(
        supabase.from("saved_dos").insert([payload]).select().single(),
        3000
      );
      if (!error && data) {
        const dos = await getCachedList<any>(CACHE_KEYS.SAVED_DOS);
        await setCache(
          CACHE_KEYS.SAVED_DOS,
          dos.map((d) => (d.id === tempId ? { ...data, is_offline_pending: false } : d))
        );
        return { synced: true, record: data };
      }
      if (error && isValidationError(error)) {
        // do not queue a payload the server will never accept
        const dos = await getCachedList<any>(CACHE_KEYS.SAVED_DOS);
        await setCache(
          CACHE_KEYS.SAVED_DOS,
          dos.map((d) => (d.id === tempId ? { ...d, is_offline_pending: true, sync_error: String(error.message || error) } : d))
        );
        return { synced: false, record: localRecord };
      }
    } catch {
      /* fall through to queue */
    }
  }

  await enqueueOutbox("saved_do_insert", payload, { tempId });
  return { synced: false, record: localRecord };
}

export async function updateSavedDOOffline(id: string | number, patch: Record<string, any>): Promise<{ synced: boolean }> {
  // Coalesce: if this DO is still a pending insert, fold the edit into it.
  const box = await getOutbox();
  const pendingInsert = box.find((e) => e.kind === "saved_do_insert" && e.tempId === String(id));
  if (pendingInsert) {
    pendingInsert.payload = { ...pendingInsert.payload, ...patch };
    await setOutbox(box);
    const dos = await getCachedList<any>(CACHE_KEYS.SAVED_DOS);
    await setCache(CACHE_KEYS.SAVED_DOS, dos.map((d) => (String(d.id) === String(id) ? { ...d, ...patch } : d)));
    return { synced: false };
  }
  const dos = await getCachedList<any>(CACHE_KEYS.SAVED_DOS);
  await setCache(CACHE_KEYS.SAVED_DOS, dos.map((d) => (String(d.id) === String(id) ? { ...d, ...patch } : d)));
  if (isUsableOnline()) {
    try {
      const { error } = await withTimeout(
        supabase.from("saved_dos").update(patch).eq("id", id),
        3000
      );
      if (!error) return { synced: true };
      if (isValidationError(error)) return { synced: false };
    } catch {
      /* fall through to queue */
    }
  }
  await enqueueOutbox("saved_do_update", { id, patch });
  return { synced: false };
}

export async function deleteSavedDOOffline(id: string | number): Promise<{ synced: boolean }> {
  const box = await getOutbox();
  const pendingIdx = box.findIndex((e) => e.kind === "saved_do_insert" && e.tempId === String(id));
  const dos = await getCachedList<any>(CACHE_KEYS.SAVED_DOS);
  await setCache(CACHE_KEYS.SAVED_DOS, dos.filter((d) => String(d.id) !== String(id)));
  if (pendingIdx >= 0) {
    // never sent to the server — just drop the queued insert
    box.splice(pendingIdx, 1);
    await setOutbox(box);
    return { synced: false };
  }
  // drop any queued update for the same row
  const filtered = box.filter((e) => !(e.kind === "saved_do_update" && String(e.payload?.id) === String(id)));
  await setOutbox(filtered);
  if (isUsableOnline()) {
    try {
      const { error } = await withTimeout(
        supabase.from("saved_dos").delete().eq("id", id),
        3000
      );
      if (!error) return { synced: true };
      if (isValidationError(error)) return { synced: false };
    } catch {
      /* fall through to queue */
    }
  }
  await enqueueOutbox("saved_do_delete", { id });
  return { synced: false };
}

export async function getCachedSavedDOs(): Promise<any[]> {
  return getCachedList<any>(CACHE_KEYS.SAVED_DOS);
}

// --- Global listeners (call once at app start) ---------------------------------

let listenersInstalled = false;

export function setupOfflineListeners(): void {
  if (listenersInstalled) return;
  listenersInstalled = true;
  startConnectivityProbe();
  try {
    window.addEventListener("online", () => {
      void probeOnline().then((ok) => {
        if (ok) void flushOutbox();
      });
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && isOnline()) {
        void probeOnline().then((ok) => {
          if (ok) void flushOutbox();
        });
      }
    });
  } catch {
    /* ignore */
  }
}
