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

  const { requestId, requestType } = req.body;
  if (!requestId || !requestType) {
    return res
      .status(400)
      .json({ error: "ID dan tipe permintaan dibutuhkan." });
  }

  try {
    let tableName = "";
    let ownerColumn = "";

    if (requestType === "asset") {
      tableName = "asset_loans";
      ownerColumn = "user_id";
    } else if (requestType === "room") {
      tableName = "room_reservations";
      ownerColumn = "requester_name"; // Ini kurang ideal, seharusnya user_id
    } else if (requestType === "transport") {
      tableName = "transport_loans";
      ownerColumn = "borrower_id";
    } else {
      return res.status(400).json({ error: "Tipe permintaan tidak valid." });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    // Hapus request jika statusnya masih 'Menunggu Persetujuan' dan dimiliki oleh user yang benar
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq("id", requestId)
      .eq(ownerColumn, ownerColumn === "user_id" ? user.id : profile.full_name)
      .eq("status", "Menunggu Persetujuan");

    if (error) throw error;

    res.status(200).json({ message: "Permintaan berhasil dibatalkan." });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Gagal membatalkan permintaan.", details: error.message });
  }
}
