// File: /api/assets.js
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
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

  switch (req.method) {
    case "GET": // Menggantikan get-assets.js
      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .order("asset_name", { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);

    case "POST": // Menggantikan request-borrow.js
      const { asset_id, loan_date, due_date } = req.body;
      if (!asset_id || !loan_date || !due_date)
        return res.status(400).json({ error: "Semua field harus diisi." });

      const { error: insertError } = await supabase.from("asset_loans").insert({
        asset_id: asset_id,
        user_id: user.id,
        loan_date: loan_date,
        due_date: due_date,
        status: "Menunggu Persetujuan",
      });
      if (insertError)
        return res.status(500).json({ error: insertError.message });
      return res
        .status(201)
        .json({ message: "Permintaan peminjaman aset berhasil diajukan." });

    default:
      res.setHeader("Allow", ["GET", "POST"]);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
