import { supabase } from "./supabase";

export const CACHE_KEYS = {
  PROFILE: "easydo_cache_profile_v1",
  PRICE_LIST_1: "easydo_cache_price_list_1_v1",
  PRICE_LIST_2: "easydo_cache_price_list_2_v1",
  TRANSPORT: "easydo_cache_transport_v1",
  UPAZILAS: "easydo_cache_upazilas_v1",
  SAVED_DOS: "easydo_cache_saved_dos_v1",
  PENDING_DO_QUEUE: "easydo_pending_do_queue_v1",
};

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

export async function syncAllMasterDataInBackground(userId?: string) {
  if (!navigator.onLine) return;

  try {
    const promises: Promise<any>[] = [
      supabase.from("feed_price_list").select("*").eq("status", "Active").order("sort_order", { ascending: true }) as any,
      supabase.from("feed_price_list_2").select("*").eq("status", "Active").order("sort_order", { ascending: true }) as any,
      supabase.from("transportation").select("*").eq("status", "Active").order("from_location", { ascending: true }).order("to_upazila", { ascending: true }) as any,
      supabase.from("upazilas").select("*").eq("status", "Active").order("district", { ascending: true }).order("upazila_name", { ascending: true }) as any,
    ];

    if (userId) {
      promises.push(supabase.from("profiles").select("*").eq("id", userId).single() as any);
    }

    const [p1Res, p2Res, transRes, upzRes, profRes] = await Promise.allSettled(promises);

    if (p1Res.status === "fulfilled" && !p1Res.value.error && p1Res.value.data) {
      setLocalCache(CACHE_KEYS.PRICE_LIST_1, p1Res.value.data);
    }
    if (p2Res.status === "fulfilled" && !p2Res.value.error && p2Res.value.data) {
      setLocalCache(CACHE_KEYS.PRICE_LIST_2, p2Res.value.data);
    }
    if (transRes.status === "fulfilled" && !transRes.value.error && transRes.value.data) {
      setLocalCache(CACHE_KEYS.TRANSPORT, transRes.value.data);
    }
    if (upzRes.status === "fulfilled" && !upzRes.value.error && upzRes.value.data) {
      setLocalCache(CACHE_KEYS.UPAZILAS, upzRes.value.data);
    }
    if (profRes && profRes.status === "fulfilled" && !profRes.value.error && profRes.value.data) {
      setLocalCache(CACHE_KEYS.PROFILE, profRes.value.data);
    }
  } catch (err) {
    console.warn("Background sync skipped:", err);
  }
}

export async function saveDOOfflineFirst(payload: any): Promise<{ synced: boolean; record: any }> {
  const tempId = `local_${Date.now()}`;
  const localRecord = {
    ...payload,
    id: tempId,
    created_at: new Date().toISOString(),
    is_offline_pending: true,
  };

  const existingDOs = getLocalCache<any[]>(CACHE_KEYS.SAVED_DOS, []);
  setLocalCache(CACHE_KEYS.SAVED_DOS, [localRecord, ...existingDOs]);

  if (navigator.onLine) {
    try {
      const { data, error } = await supabase.from("saved_dos").insert([payload]).select().single();
      if (!error && data) {
        const updatedDOs = getLocalCache<any[]>(CACHE_KEYS.SAVED_DOS, []).map((item) =>
          item.id === tempId ? { ...data, is_offline_pending: false } : item
        );
        setLocalCache(CACHE_KEYS.SAVED_DOS, updatedDOs);
        return { synced: true, record: data };
      }
    } catch {}
  }

  const queue = getLocalCache<any[]>(CACHE_KEYS.PENDING_DO_QUEUE, []);
  setLocalCache(CACHE_KEYS.PENDING_DO_QUEUE, [...queue, { tempId, payload }]);

  return { synced: false, record: localRecord };
}

export async function flushPendingDOQueue() {
  if (!navigator.onLine) return;
  const queue = getLocalCache<{ tempId: string; payload: any }[]>(CACHE_KEYS.PENDING_DO_QUEUE, []);
  if (!queue.length) return;

  const remainingQueue: { tempId: string; payload: any }[] = [];

  for (const item of queue) {
    try {
      const { data, error } = await supabase.from("saved_dos").insert([item.payload]).select().single();
      if (!error && data) {
        const currentDOs = getLocalCache<any[]>(CACHE_KEYS.SAVED_DOS, []);
        setLocalCache(
          CACHE_KEYS.SAVED_DOS,
          currentDOs.map((d) => (d.id === item.tempId ? { ...data, is_offline_pending: false } : d))
        );
      } else {
        remainingQueue.push(item);
      }
    } catch {
      remainingQueue.push(item);
    }
  }

  setLocalCache(CACHE_KEYS.PENDING_DO_QUEUE, remainingQueue);
}