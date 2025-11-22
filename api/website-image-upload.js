// File: /api/website-image-upload.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET_NAME = "website-assets"; // sama seperti hero video

function getServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// Copas pola verifikasi dari website-hero-video.js / website-content.js
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

  // Dengan service key, kita cek user dari JWT yang dikirim
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
        "Hanya user dengan role management/admin yang dapat mengunggah gambar.",
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

    // Boleh kosong, tapi kita pakai buat nama folder
    const folder = ["about", "pastor"].includes(target) ? target : "images";

    // Bersihkan prefix data URL jika ada
    const base64 = base64Data.includes(",")
      ? base64Data.split(",").pop()
      : base64Data;

    const fileBuffer = Buffer.from(base64, "base64");

    // BATAS ukuran: 2 MB
    const MAX_BYTES = 2 * 1024 * 1024;
    if (fileBuffer.length > MAX_BYTES) {
      return res.status(400).json({
        error: "Ukuran file melebihi 2 MB.",
      });
    }

    const ext = (fileName.split(".").pop() || "").toLowerCase() || "jpg";
    const safeName = fileName.replace(/\s+/g, "-").toLowerCase();
    const path = `${folder}/${Date.now()}-${safeName}`;

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
    console.error("Upload website image error:", error);
    return res.status(500).json({
      error: "Gagal mengunggah gambar.",
      details: error.message,
    });
  }
}
