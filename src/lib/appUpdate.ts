import { App as CapApp } from "@capacitor/app";
import { isOnline, isRunningInsideApp } from "./offlineSync";

/**
 * In-app update check.
 *
 * How it works:
 * - The latest version lives in a tiny public JSON file in the same
 *   Supabase Storage bucket as the APK:
 *   https://xazcbgiovvrtzrhymgsc.supabase.co/storage/v1/object/public/APK/version.json
 *   { "latestVersionCode": 2, "latestVersionName": "1.2",
 *     "apkUrl": "https://.../APK/Easy-DO.apk?download=Easy-DO.apk",
 *     "message": "..." }
 * - To release a new version: build the APK, replace Easy-DO.apk in
 *   Storage, then update version.json. Users on an older APK see
 *   "Update Now" the next time they open the app online.
 * - Browser users never see it (the browser is always online and always
 *   runs the latest web code).
 *
 * Current version detection:
 * - If the code is running from the Vercel site (easy-do-five.vercel.app),
 *   it is being loaded by the OLD APK (versionCode 1) — the bundled app
 *   never loads from Vercel. So current = 1 there.
 * - Otherwise, inside the native app, Capacitor App.getInfo() reports the
 *   real APK build (versionCode from build.gradle).
 */
export const VERSION_JSON_URL =
  "https://xazcbgiovvrtzrhymgsc.supabase.co/storage/v1/object/public/APK/version.json";

export const APK_DOWNLOAD_URL =
  "https://xazcbgiovvrtzrhymgsc.supabase.co/storage/v1/object/public/APK/Easy-DO.apk?download=Easy-DO.apk";

export type UpdateInfo = {
  latestVersionCode: number;
  latestVersionName: string;
  apkUrl: string;
  message?: string;
};

async function getCurrentVersionCode(): Promise<number | null> {
  // Old APK loads the app from Vercel — that is always versionCode 1.
  if (window.location.hostname.includes("vercel.app")) return 1;
  // Browser: no APK to update.
  if (!isRunningInsideApp()) return null;
  try {
    const info = await CapApp.getInfo();
    const build = parseInt(String(info?.build ?? ""), 10);
    return Number.isFinite(build) && build > 0 ? build : null;
  } catch {
    return null;
  }
}

let cachedCheck: Promise<UpdateInfo | null> | null = null;

/** Returns update info when a newer APK exists, otherwise null. Safe to call often — fetched once per session. */
export function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!cachedCheck) {
    cachedCheck = (async (): Promise<UpdateInfo | null> => {
      try {
        if (!isOnline()) return null;
        const current = await getCurrentVersionCode();
        if (current === null) return null;

        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8000);
        try {
          const res = await fetch(`${VERSION_JSON_URL}?t=${Date.now()}`, {
            signal: controller.signal,
            cache: "no-store",
          });
          if (!res.ok) return null;
          const data = (await res.json()) as Partial<UpdateInfo>;
          const latest = Number(data.latestVersionCode);
          if (!Number.isFinite(latest) || latest <= current) return null;
          return {
            latestVersionCode: latest,
            latestVersionName: String(data.latestVersionName || `v${latest}`),
            apkUrl: String(data.apkUrl || APK_DOWNLOAD_URL),
            message: data.message ? String(data.message) : undefined,
          };
        } finally {
          window.clearTimeout(timeout);
        }
      } catch {
        // Offline, Storage unreachable, bad JSON — never block the app.
        return null;
      }
    })();
  }
  return cachedCheck;
}

/**
 * Downloads the APK without navigating the current page.
 *
 * The Easy DO pages register a `beforeunload` guard (unsaved DO draft),
 * so a normal link / window.open to the APK URL makes the browser show
 * "Leave this page / Stay on this page". Loading the APK URL in a hidden
 * iframe triggers the system download instead, with no navigation and
 * therefore no leave-page dialog — and the DO draft is left untouched.
 */
export function openApkDownload(apkUrl: string): void {
  try {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.setAttribute("aria-hidden", "true");
    iframe.src = apkUrl;
    document.body.appendChild(iframe);
    // The download is handed to the system download manager; the iframe
    // itself is just the trigger and can go away shortly after.
    window.setTimeout(() => iframe.remove(), 30000);
  } catch {
    window.open(apkUrl, "_blank");
  }
}
