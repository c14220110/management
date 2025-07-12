import { createClient } from "@supabase/supabase-js";

// Helper untuk verifikasi token
async function verifyUser(req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return { error: { message: "No token provided" } };
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  return await supabase.auth.getUser(token);
}

export default async function handler(req, res) {
  const { error: userError } = await verifyUser(req);
  if (userError) return res.status(401).json({ error: "Unauthorized" });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  try {
    const [
      { count: totalAssets },
      { count: borrowedAssets },
      { count: pendingReservations },
      { count: totalRooms },
    ] = await Promise.all([
      supabase.from("assets").select("*", { count: "exact", head: true }),
      supabase
        .from("assets")
        .select("*", { count: "exact", head: true })
        .eq("status", "Dipinjam"),
      supabase
        .from("room_reservations")
        .select("*", { count: "exact", head: true })
        .eq("status", "Menunggu Persetujuan"),
      supabase.from("rooms").select("*", { count: "exact", head: true }),
    ]);

    res
      .status(200)
      .json({ totalAssets, borrowedAssets, pendingReservations, totalRooms });
  } catch (error) {
    res.status(500).json({
      error: "Gagal mengambil statistik dashboard",
      details: error.message,
    });
  }
}
