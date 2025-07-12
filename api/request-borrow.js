import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  const { asset_id, borrower_name, return_date } = req.body;

  if (!asset_id || !borrower_name || !return_date) {
    return res.status(400).json({ error: "Semua field harus diisi." });
  }

  try {
    const { data, error } = await supabase
      .from("assets")
      .update({
        status: "Dipinjam",
        borrower_name: borrower_name,
        return_date: return_date,
      })
      .eq("id", asset_id)
      .eq("status", "Tersedia") // Pastikan hanya aset yang tersedia yang bisa dipinjam
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(409).json({
        error:
          "Aset ini baru saja dipinjam atau tidak ditemukan. Silakan refresh halaman.",
      });
    }

    res.status(200).json({
      message: `Peminjaman untuk ${data.asset_name} berhasil diajukan.`,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Gagal memproses permintaan.", details: error.message });
  }
}
