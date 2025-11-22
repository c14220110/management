// File: /api/website-content.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Video default di church profile
const DEFAULT_HERO_VIDEO = "assets/bg_gki.mp4";

// Client publik untuk GET (dipakai church profile & halaman management)
function getPublicClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Client admin untuk POST/PUT (server-side)
function getServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// Verifikasi user = management / admin
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

  // Ambil user dari token (via service key)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    res.status(401).json({ error: "Token tidak valid." });
    return null;
  }

  // Ambil role dari tabel profiles
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
        "Hanya user dengan role management/admin yang dapat mengubah konten website.",
    });
    return null;
  }

  return { supabase, user, role };
}

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({
      error:
        "SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_KEY belum diset di environment.",
    });
  }

  // ======== GET: untuk church profile (tanpa login) ========
  if (req.method === "GET") {
    const supabase = getPublicClient();

    try {
      const { data, error } = await supabase
        .from("website_content")
        .select("content_key, content_data")
        .order("content_key", { ascending: true });

      if (error) throw error;

      const formatted = {};
      (data || []).forEach((row) => {
        formatted[row.content_key] = row.content_data;
      });

      // setelah const formatted = {...}
      const heroData = formatted.hero || {};
      const schedulesData = formatted.schedules || {};
      const aboutData = formatted.about || {};
      const pastorData = formatted.pastor || {};

      const result = {
        hero: {
          title: heroData.title ?? "Selamat Datang di GKI Kutisari Indah",
          subtitle:
            heroData.subtitle ??
            "Gereja yang bertumbuh dalam Iman, Kasih, dan Pelayanan bagi sesama.",
          videoUrl: heroData.videoUrl ?? DEFAULT_HERO_VIDEO,
        },
        schedules: {
          title: schedulesData.title ?? "Jadwal Ibadah & Kegiatan",
          subtitle:
            schedulesData.subtitle ??
            "Kami mengundang Anda untuk bersekutu bersama kami. Berikut adalah jadwal kegiatan rutin kami.",
          items: schedulesData.items ?? [],
        },
        about: {
          badge: aboutData.badge ?? "TENTANG KAMI",
          heading: aboutData.heading ?? "Mengenal GKI Kutisari Indah",
          paragraph1:
            aboutData.paragraph1 ??
            "Komunitas yang bertumbuh dalam pengenalan akan Kristus, saling mengasihi, dan melayani.",
          paragraph2:
            aboutData.paragraph2 ??
            "Visi kami: gereja yang relevan, berdampak, dan menjadi berkat.",
          ctaText: aboutData.ctaText ?? "Visi, Misi & Sejarah",
          ctaUrl: aboutData.ctaUrl ?? "#",
          imageUrl: aboutData.imageUrl ?? "assets/gedung_gereja.jpg",
        },
        pastor: {
          badge: pastorData.badge ?? "PROFIL GEMBALA SIDANG",
          name: pastorData.name ?? "Pdt. William Suryajaya",
          phone: pastorData.phone ?? "087808786969",
          description:
            pastorData.description ??
            "Gembala sidang yang memimpin dengan dedikasi dan kasih, membimbing jemaat dalam pertumbuhan rohani.",
          whatsappUrl: pastorData.whatsappUrl ?? "https://wa.me/6287808786969",
          buttonText: pastorData.buttonText ?? "Hubungi Pendeta",
          imageUrl: pastorData.imageUrl ?? "assets/pastor.jpg",
        },
      };

      return res.status(200).json(result);
    } catch (error) {
      console.error("GET /api/website-content error:", error);
      return res.status(500).json({
        error: "Gagal mengambil konten website.",
        details: error.message,
      });
    }
  }

  // ======== POST/PUT: hanya management/admin ========
  if (req.method === "POST" || req.method === "PUT") {
    const ctx = await requireManagement(req, res);
    if (!ctx) return; // kalau gagal verifikasi, response sudah dikirim

    const { supabase } = ctx; // ini client dengan SERVICE_KEY

    try {
      const { contentKey, contentData, content_key, content_data } =
        req.body || {};

      const finalKey = contentKey || content_key;
      const finalData = contentData || content_data;

      if (!finalKey || !finalData) {
        return res.status(400).json({
          error:
            "contentKey/content_key dan contentData/content_data dibutuhkan.",
        });
      }

      const payload = {
        content_key: finalKey,
        content_data: finalData,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabase
        .from("website_content")
        .upsert(payload, { onConflict: "content_key" });

      if (upsertError) throw upsertError;

      return res.status(200).json({
        message: "Konten berhasil disimpan!",
        key: finalKey,
      });
    } catch (error) {
      console.error("POST/PUT /api/website-content error:", error);
      return res.status(500).json({
        error: "Gagal menyimpan konten: " + error.message,
      });
    }
  }

  // ======== Method lain ========
  res.setHeader("Allow", ["GET", "POST", "PUT"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
