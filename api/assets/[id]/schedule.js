import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const { id } = req.query; // Mengambil id dari URL, misal: /api/assets/abc-123/schedule

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  try {
    const { data, error } = await supabase
      .from("asset_loans")
      .select("loan_date, due_date, status, profiles(full_name)")
      .eq("asset_id", id)
      .in("status", ["Disetujui", "Dipinjam"]); // Hanya tampilkan yang sudah pasti dipinjam

    if (error) throw error;

    res.status(200).json(data);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Gagal mengambil jadwal aset.", details: error.message });
  }
}
