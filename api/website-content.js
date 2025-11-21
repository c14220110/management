// File: /api/website-content.js
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res
      .status(500)
      .json({ error: "SUPABASE_URL atau SUPABASE_ANON_KEY belum diset." });
  }

  // =========================
  // GET: publik, tanpa login
  // =========================
  if (req.method === "GET") {
    const supabase = createClient(supabaseUrl, supabaseKey);

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

      // Pastikan selalu ada struktur hero + schedules
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

  // ======================================
  // POST / PUT: hanya management / admin
  // ======================================
  if (req.method === "POST" || req.method === "PUT") {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Token dibutuhkan." });
    }

    // Client dengan Authorization TOKEN → dipakai untuk auth + query
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    try {
      // 1) Verifikasi user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Token tidak valid.");
      }

      // 2) Cek role di tabel profiles
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      if (
        !profile ||
        (profile.role !== "management" && profile.role !== "admin")
      ) {
        return res.status(403).json({
          error: "Hanya management/admin yang dapat mengubah konten website.",
        });
      }

      // 3) Validate body
      const { contentKey, contentData } = req.body;
      if (!contentKey || !contentData) {
        return res
          .status(400)
          .json({ error: "contentKey dan contentData dibutuhkan." });
      }

      // 4) UPSERT → kalau belum ada row, akan INSERT
      const payload = {
        content_key: contentKey,
        content_data: contentData,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("website_content")
        .upsert(payload, { onConflict: "content_key" });

      if (error) throw error;

      return res.status(200).json({ message: "Konten berhasil disimpan!" });
    } catch (error) {
      return res.status(500).json({
        error: "Gagal menyimpan konten.",
        details: error.message,
      });
    }
  }

  res.setHeader("Allow", ["GET", "POST", "PUT"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
