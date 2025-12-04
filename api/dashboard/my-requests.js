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

  try {
    // Ambil data peminjaman aset oleh user ini
    const { data: assetLoans } = await supabase
      .from("asset_loans")
      .select("*, assets(asset_name)") // Ambil juga nama asetnya
      .eq("user_id", user.id)
      .order("loan_date", { ascending: false });

    // Ambil data reservasi ruangan oleh user ini (berdasarkan nama)
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    const { data: roomReservations } = await supabase
      .from("room_reservations")
      .select("*")
      .eq("requester_name", profile.full_name)
      .order("start_time", { ascending: false });

    // Ambil data peminjaman transportasi oleh user ini
    const { data: transportLoans } = await supabase
      .from("transport_loans")
      .select("*, transportations(vehicle_name, plate_number)")
      .eq("borrower_id", user.id)
      .order("borrow_start", { ascending: false });

    res.status(200).json({ assetLoans, roomReservations, transportLoans });
  } catch (error) {
    res.status(500).json({
      error: "Gagal mengambil data permintaan Anda.",
      details: error.message,
    });
  }
}
