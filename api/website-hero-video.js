// File: /api/website-hero-video.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET_NAME = "website-assets"; // Pastikan bucket ini ADA di Supabase (public)

function getServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// Copas pola verifikasi dari website-content.js
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
        "Hanya user dengan role management/admin yang dapat mengunggah video hero.",
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
    const { fileName, mimeType, base64Data } = req.body || {};

    if (!fileName || !mimeType || !base64Data) {
      return res.status(400).json({
        error: "fileName, mimeType, dan base64Data dibutuhkan.",
      });
    }

    // Bersihkan prefix data URL jika ada
    const base64 = base64Data.includes(",")
      ? base64Data.split(",").pop()
      : base64Data;

    const fileBuffer = Buffer.from(base64, "base64");
    const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

    if (fileBuffer.length > MAX_BYTES) {
      return res.status(400).json({
        error: "Ukuran file melebihi 10 MB.",
      });
    }

    const ext = (fileName.split(".").pop() || "").toLowerCase() || "mp4";
    const safeName = fileName.replace(/\s+/g, "-").toLowerCase();
    const path = `hero/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const publicUrl =
      SUPABASE_URL.replace(/\/$/, "") +
      `/storage/v1/object/public/${encodeURIComponent(
        BUCKET_NAME
      )}/${encodeURIComponent(path)}`;

    return res.status(200).json({ url: publicUrl });
  } catch (error) {
    console.error("Upload hero video error:", error);
    return res.status(500).json({
      error: "Gagal mengunggah video hero.",
      details: error.message,
    });
  }
}
