import { createClient } from "@supabase/supabase-js";

// Helper untuk verifikasi role management (bisa diekstrak ke file terpisah)
async function verifyManagement(req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return { error: "No token" };

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return { error: "Invalid token" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "management") return { error: "Forbidden" };

  return { user };
}

export default async function handler(req, res) {
  const { error: authError } = await verifyManagement(req);
  if (authError) return res.status(403).json({ error: "Access Forbidden" });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    const { data: pendingAssetLoans } = await supabase
      .from("asset_loans")
      .select("*, assets(asset_name), profiles(full_name)")
      .eq("status", "Menunggu Persetujuan")
      .order("loan_date", { ascending: true });

    const { data: pendingRoomReservations } = await supabase
      .from("room_reservations")
      .select("*")
      .eq("status", "Menunggu Persetujuan")
      .order("start_time", { ascending: true });

    res.status(200).json({ pendingAssetLoans, pendingRoomReservations });
  } catch (error) {
    res.status(500).json({
      error: "Gagal mengambil data permintaan pending.",
      details: error.message,
    });
  }
}
