import { supabase } from "./supabase";
import { isOnline } from "./offlineSync";

export async function universalFileDownload(
  blob: Blob,
  fileName: string,
  mimeType: string
) {
  const ua = navigator.userAgent || "";
  const isAndroidApp =
    /;\s*wv\)/i.test(ua) ||
    window.location.protocol === "capacitor:" ||
    Boolean((window as any).Capacitor);

  // 1. On a PC or a normal mobile browser, download directly.
  if (!isAndroidApp) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return;
  }

  // Native share/save sheet on the phone — the first path when offline,
  // and the fallback when the cloud upload fails. Returns true when the
  // share sheet was opened.
  async function tryNativeShare(): Promise<boolean> {
    try {
      const file = new File([blob], fileName, { type: mimeType });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName });
        return true;
      }
    } catch {
      /* user cancelled the share sheet, or sharing is unavailable */
    }
    return false;
  }

  // 2. Inside the app while offline: never try the cloud upload first —
  // open the phone's native share/save menu straight away.
  if (!isOnline()) {
    const shared = await tryNativeShare();
    if (!shared) {
      alert("No internet connection. Please connect to the internet to download this file.");
    }
    return;
  }

  // 3. Inside the app while online: create a direct HTTPS download link
  // from Supabase so the Android download manager saves the real file.
  try {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniquePath = `files/${Date.now()}_${safeName}`;

    const { error } = await supabase.storage
      .from("temp_downloads")
      .upload(uniquePath, blob, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from("temp_downloads")
      .getPublicUrl(uniquePath, {
        download: fileName, // forces the browser / download manager to save the file directly
      });

    if (data?.publicUrl) {
      // Trigger the Android download manager
      const link = document.createElement("a");
      link.href = data.publicUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } catch (err: any) {
    // If the cloud link fails for any reason, open the phone's native
    // share/save menu instead.
    const shared = await tryNativeShare();
    if (!shared) {
      alert("Download failed: " + (err?.message || "Please check internet connection."));
    }
  }
}
