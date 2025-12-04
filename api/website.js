// File: /api/website.js
// Consolidated API for website content and media upload
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "12mb", // Increased for video uploads
    },
  },
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET_NAME = "website-assets";
const DEFAULT_HERO_VIDEO = "assets/bg_gki.mp4";

// Helper clients
function getPublicClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function getServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// Helper: Verify management role
async function requireManagement(req, res) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token) {
    res.status(401).json({ error: "Token dibutuhkan." });
    return null;
  }

  const supabase = getServiceClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);

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
    res.status(500).json({ error: "Gagal mengambil data profil.", details: profileError.message });
    return null;
  }

  const role = profile?.role || "member";
  if (role !== "management" && role !== "admin") {
    res.status(403).json({ error: "Hanya management/admin yang dapat mengubah konten." });
    return null;
  }

  return { supabase, user, role };
}

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: "Environment variables belum diset." });
  }

  const { action } = req.query;

  // ======== GET: Public Content ========
  if (req.method === "GET") {
    return handleGetContent(req, res);
  }

  // ======== POST: Upload Media or Update Content ========
  if (req.method === "POST" || req.method === "PUT") {
    const ctx = await requireManagement(req, res);
    if (!ctx) return;

    if (action === "upload") {
      return handleUploadMedia(req, res, ctx.supabase);
    } else {
      return handleUpdateContent(req, res, ctx.supabase);
    }
  }

  res.setHeader("Allow", ["GET", "POST", "PUT"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}

async function handleGetContent(req, res) {
  const supabase = getPublicClient();
  try {
    const { data, error } = await supabase
      .from("website_content")
      .select("content_key, content_data")
      .order("content_key", { ascending: true });

    if (error) throw error;

    const formatted = {};
    (data || []).forEach((row) => {
      formatted[row.content_key] = row.content_data || {};
    });

    // Default values logic (same as original)
    const result = {
      hero: {
        title: formatted.hero?.title ?? "Selamat Datang di GKI Kutisari Indah",
        subtitle: formatted.hero?.subtitle ?? "Gereja yang bertumbuh dalam Iman, Kasih, dan Pelayanan bagi sesama.",
        videoUrl: formatted.hero?.videoUrl ?? DEFAULT_HERO_VIDEO,
      },
      schedules: {
        title: formatted.schedules?.title ?? "Jadwal Ibadah & Kegiatan",
        subtitle: formatted.schedules?.subtitle ?? "Kami mengundang Anda untuk bersekutu bersama kami.",
        items: formatted.schedules?.items ?? [],
      },
      about: {
        badge: formatted.about?.badge ?? "TENTANG KAMI",
        heading: formatted.about?.heading ?? "Mengenal GKI Kutisari Indah",
        paragraph1: formatted.about?.paragraph1 ?? "Komunitas yang bertumbuh dalam pengenalan akan Kristus.",
        paragraph2: formatted.about?.paragraph2 ?? "Visi kami: gereja yang relevan, berdampak, dan menjadi berkat.",
        ctaText: formatted.about?.ctaText ?? "Visi, Misi & Sejarah",
        ctaUrl: formatted.about?.ctaUrl ?? "#",
        imageUrl: formatted.about?.imageUrl ?? "assets/gedung_gereja.jpg",
      },
      pastor: {
        badge: formatted.pastor?.badge ?? "PROFIL GEMBALA SIDANG",
        name: formatted.pastor?.name ?? "Pdt. William Suryajaya",
        phone: formatted.pastor?.phone ?? "087808786969",
        description: formatted.pastor?.description ?? "Gembala sidang yang memimpin dengan dedikasi dan kasih.",
        whatsappUrl: formatted.pastor?.whatsappUrl ?? "https://wa.me/6287808786969",
        buttonText: formatted.pastor?.buttonText ?? "Hubungi Pendeta",
        imageUrl: formatted.pastor?.imageUrl ?? "assets/pastor.jpg",
      },
      contact: {
        title: formatted.contact?.title ?? "Hubungi & Kunjungi Kami",
        subtitle: formatted.contact?.subtitle ?? "Kami senang dapat terhubung dengan Anda.",
        addressTitle: formatted.contact?.addressTitle ?? "Alamat Gereja",
        addressText: formatted.contact?.addressText ?? "Jl. Raya Kutisari Indah No.139, Surabaya",
        officeTitle: formatted.contact?.officeTitle ?? "Kantor Gereja",
        officeText: formatted.contact?.officeText ?? "Hubungi kami untuk informasi umum & administrasi.",
        whatsappLabel: formatted.contact?.whatsappLabel ?? "WhatsApp Kantor",
        whatsappUrl: formatted.contact?.whatsappUrl ?? "https://wa.me/6281332240711",
      },
    };

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: "Gagal mengambil konten.", details: error.message });
  }
}

async function handleUpdateContent(req, res, supabase) {
  try {
    const { contentKey, contentData, content_key, content_data } = req.body || {};
    const finalKey = contentKey || content_key;
    const finalData = contentData || content_data;

    if (!finalKey || !finalData) {
      return res.status(400).json({ error: "Data konten tidak lengkap." });
    }

    const { error } = await supabase
      .from("website_content")
      .upsert({
        content_key: finalKey,
        content_data: finalData,
        updated_at: new Date().toISOString(),
      }, { onConflict: "content_key" });

    if (error) throw error;

    return res.status(200).json({ message: "Konten berhasil disimpan!", key: finalKey });
  } catch (error) {
    return res.status(500).json({ error: "Gagal menyimpan konten.", details: error.message });
  }
}

async function handleUploadMedia(req, res, supabase) {
  try {
    const { fileName, mimeType, base64Data, target } = req.body || {};

    if (!fileName || !mimeType || !base64Data) {
      return res.status(400).json({ error: "Data upload tidak lengkap." });
    }

    const folder = target && ["hero", "about", "pastor"].includes(target) ? target : "hero";
    const base64 = base64Data.includes(",") ? base64Data.split(",").pop() : base64Data;
    const fileBuffer = Buffer.from(base64, "base64");

    const isImage = mimeType.startsWith("image/");
    const MAX_BYTES = isImage ? 2 * 1024 * 1024 : 10 * 1024 * 1024; // 2MB img, 10MB video

    if (fileBuffer.length > MAX_BYTES) {
      return res.status(400).json({ error: isImage ? "Max gambar 2MB" : "Max video 10MB" });
    }

    const safeName = fileName.replace(/\s+/g, "-").toLowerCase();
    const path = `${folder}/${Date.now()}-${safeName}`;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) throw error;

    const publicUrl = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET_NAME}/${path}`;

    return res.status(200).json({ url: publicUrl });
  } catch (error) {
    return res.status(500).json({ error: "Gagal upload media.", details: error.message });
  }
}
