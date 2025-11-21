// File: /api/website-content.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({
      error: "SUPABASE_URL atau SUPABASE_ANON_KEY belum diset di environment.",
    });
  }

  // ========== GET: dipakai publik (church profile) ==========
  if (req.method === "GET") {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

      // Fallback default kalau DB masih kosong
      const result = {
        hero: {
          title:
            formatted.hero?.title ?? "Selamat Datang di GKI Kutisari Indah",
          subtitle:
            formatted.hero?.subtitle ??
            "Gereja yang bertumbuh dalam Iman, Kasih, dan Pelayanan bagi sesama.",
        },
        schedules: {
          title: formatted.schedules?.title ?? "Jadwal Ibadah & Kegiatan",
          subtitle:
            formatted.schedules?.subtitle ??
            "Kami mengundang Anda untuk bersekutu bersama kami. Berikut adalah jadwal kegiatan rutin kami.",
          items: formatted.schedules?.items ?? [],
        },
      };

      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        error: "Gagal mengambil konten website.",
        details: error.message,
      });
    }
  }

  // ========== POST / PUT: hanya untuk management / admin ==========
  if (req.method === "POST" || req.method === "PUT") {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Token dibutuhkan." });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    try {
      // 1) Ambil user dari token
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Token tidak valid.");
      }

      // 2) Ambil role dari tabel profiles (pola sama dengan login.js)
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      // Kalau error tapi BUKAN "row not found"
      if (profileError && profileError.code !== "PGRST116") {
        throw new Error("Gagal mengambil data profil pengguna.");
      }

      const userRole = profile?.role || "member";

      if (userRole !== "management" && userRole !== "admin") {
        return res.status(403).json({
          error:
            "Hanya user dengan role management/admin yang dapat mengubah konten website.",
        });
      }

      // 3) Ambil body, dukung 2 gaya penamaan key
      const { contentKey, contentData, content_key, content_data } =
        req.body || {};

      const finalKey = contentKey || content_key;
      const finalData = contentData || content_data;

      if (!finalKey || !finalData) {
        return res.status(400).json({
          error:
            "contentKey/content_key dan contentData/content_data dibutuhkan.",
          body: req.body || null,
        });
      }

      // 4) UPSERT berdasarkan content_key
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
      return res.status(500).json({
        error: "Gagal menyimpan konten.",
        details: error.message,
      });
    }
  }

  // ========== Method lain ditolak ==========
  res.setHeader("Allow", ["GET", "POST", "PUT"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
