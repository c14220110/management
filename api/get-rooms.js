// File: /api/get-rooms.js

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  // Endpoint ini bisa diakses oleh semua user yang sudah login, jadi kita pakai ANON_KEY
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  try {
    const { data, error } = await supabase
      .from("rooms")
      .select("name") // Cukup ambil kolom nama
      .order("name", { ascending: true });

    if (error) throw error;

    res.status(200).json(data);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Gagal mengambil data ruangan", details: error.message });
  }
}
