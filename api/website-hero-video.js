// File: /api/website-hero-video.js
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    // Naikkan batas body agar bisa kirim file sampai ~10MB
    bodyParser: {
      sizeLimit: "12mb",
    },
  },
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET_NAME = "website-assets"; // pastikan bucket ini ada (public)

function getServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// Verifikasi role: management / admin
async function requireManagement(req, res) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  if (!token) {
    res.status(401).json({ error: "Token dibutuhkan." });
    return null;
  }

  const supabase = getServiceClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    res.status(401).json({ error: "Token tidak valid." });
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError && profileError.code !== "PGRST116") {
    res.status(500).json({
      error: "Gagal mengambil data profil pengguna.",
      details: profileError.message,
    });
    return null;
  }

  const role = profile?.role || "member";
  if (role !== "management" && role !== "admin") {
    res.status(403).json({
      error:
        "Hanya user dengan role management/admin yang dapat mengunggah media.",
    });
    return null;
  }

  return { supabase, user, role };
}

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({
      error: "SUPABASE_URL / SUPABASE_SERVICE_KEY belum diset di environment.",
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const ctx = await requireManagement(req, res);
  if (!ctx) return;
  const { supabase } = ctx;

  try {
    const { fileName, mimeType, base64Data, target } = req.body || {};

    if (!fileName || !mimeType || !base64Data) {
      return res.status(400).json({
        error: "fileName, mimeType, dan base64Data dibutuhkan.",
      });
    }

    // target: hero / about / pastor / transport / assets
    const allowedTargets = ["hero", "about", "pastor", "transport", "assets"];

    const folder = target && allowedTargets.includes(target) ? target : "hero";

    // Bersihkan prefix data URL kalau ada
    const base64 = base64Data.includes(",")
      ? base64Data.split(",").pop()
      : base64Data;

    const fileBuffer = Buffer.from(base64, "base64");

    const isImage = mimeType.startsWith("image/");
    const MAX_BYTES = isImage ? 2 * 1024 * 1024 : 10 * 1024 * 1024;

    if (fileBuffer.length > MAX_BYTES) {
      return res.status(400).json({
        error: isImage
          ? "Ukuran gambar melebihi 2 MB."
          : "Ukuran video melebihi 10 MB.",
      });
    }

    const ext = (fileName.split(".").pop() || "").toLowerCase();
    const safeName = fileName.replace(/\s+/g, "-").toLowerCase();
    const path = `${folder}/${Date.now()}-${safeName || "media"}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, fileBuffer, {
        contentType: mimeType || (isImage ? "image/jpeg" : "video/mp4"),
        upsert: true,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      throw uploadError;
    }

    const publicUrl =
      SUPABASE_URL.replace(/\/$/, "") +
      `/storage/v1/object/public/${encodeURIComponent(
        BUCKET_NAME
      )}/${encodeURIComponent(path)}`;

    return res.status(200).json({ url: publicUrl });
  } catch (error) {
    console.error("Upload media error:", error);
    return res.status(500).json({
      error: "Gagal mengunggah media.",
      details: error.message,
    });
  }
}
