import { supabase } from "./supabase";

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

  // ১. পিসি বা সাধারণ মোবাইল ব্রাউজার হলে সরাসরি ডাউনলোড হবে
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

  // ২. অ্যাপের ভেতরে থাকলে Supabase থেকে সরাসরি আসল HTTPS ডাউনলোড লিংক তৈরি করবে
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
        download: fileName, // ব্রাউজার বা ডাউনলোড ম্যানেজারকে সরাসরি ফাইল সেভ করতে বাধ্য করবে
      });

    if (data?.publicUrl) {
      // অ্যান্ড্রয়েডের ডাউনলোড ম্যানেজার ট্রিগার করা
      const link = document.createElement("a");
      link.href = data.publicUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } catch (err: any) {
    // কোনো কারণে ক্লাউড লিংক কাজ না করলে ফোনের নেটিভ শেয়ার/সেভ মেনু ওপেন হবে
    try {
      const file = new File([blob], fileName, { type: mimeType });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName });
        return;
      }
    } catch {}
    alert("Download failed: " + (err?.message || "Please check internet connection."));
  }
}