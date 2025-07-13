import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token dibutuhkan." });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return res.status(401).json({ error: "Token tidak valid." });

  const { asset_id, loan_date, due_date } = req.body;

  if (!asset_id || !loan_date || !due_date) {
    return res.status(400).json({ error: "Semua field harus diisi." });
  }

  try {
    const { error } = await supabase.from("asset_loans").insert({
      asset_id: asset_id,
      user_id: user.id,
      loan_date: loan_date,
      due_date: due_date,
      status: "Menunggu Persetujuan",
    });

    if (error) throw error;

    res
      .status(201)
      .json({ message: "Permintaan peminjaman aset berhasil diajukan." });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Gagal mengajukan permintaan.", details: error.message });
  }
}
