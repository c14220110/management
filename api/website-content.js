// File: /api/website-content.js
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  // GET: Ambil semua konten website
  if (req.method === "GET") {
    try {
      const { data, error } = await supabase
        .from("website_content")
        .select("*")
        .order("content_key", { ascending: true });

      if (error) throw error;

      // Format data untuk mudah diakses
      const formattedData = {};
      data.forEach((item) => {
        formattedData[item.content_key] = item.content_data;
      });

      res.status(200).json(formattedData);
    } catch (error) {
      res.status(500).json({
        error: "Gagal mengambil konten website.",
        details: error.message,
      });
    }
  }

  // POST/PUT: Update konten website (hanya admin/management)
  else if (req.method === "POST" || req.method === "PUT") {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Token dibutuhkan." });
    }

    const authSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    // Verifikasi user adalah admin/management
    const {
      data: { user },
    } = await authSupabase.auth.getUser();
    if (!user) {
      return res.status(401).json({ error: "Token tidak valid." });
    }

    const { data: profile } = await authSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      !profile ||
      (profile.role !== "management" && profile.role !== "admin")
    ) {
      return res.status(403).json({
        error: "Hanya management/admin yang dapat mengubah konten website.",
      });
    }

    // Update konten
    const { contentKey, contentData } = req.body;
    if (!contentKey || !contentData) {
      return res
        .status(400)
        .json({ error: "contentKey dan contentData dibutuhkan." });
    }

    try {
      const { error } = await supabase
        .from("website_content")
        .update({
          content_data: contentData,
          updated_at: new Date().toISOString(),
        })
        .eq("content_key", contentKey);

      if (error) throw error;

      res.status(200).json({ message: "Konten berhasil diperbarui!" });
    } catch (error) {
      res.status(500).json({
        error: "Gagal memperbarui konten.",
        details: error.message,
      });
    }
  } else {
    res.status(405).json({ error: "Method Not Allowed" });
  }
}
