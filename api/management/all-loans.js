import { createClient } from "@supabase/supabase-js";

// Helper untuk verifikasi role management
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
    process.env.SUPABASE_ANON_KEY
  );

  try {
    const { data: assets } = await supabase
      .from("assets")
      .select("asset_name, borrower_name, return_date")
      .eq("status", "Dipinjam");

    const { data: reservations } = await supabase
      .from("room_reservations")
      .select("room_name, requester_name, start_time")
      .in("status", ["Disetujui", "Menunggu Persetujuan"]);

    const formattedAssets = assets.map((a) => ({
      type: "Barang",
      name: a.asset_name,
      borrower: a.borrower_name,
      deadline: a.return_date,
    }));

    const formattedReservations = reservations.map((r) => ({
      type: "Ruangan",
      name: r.room_name,
      borrower: r.requester_name,
      deadline: r.start_time,
    }));

    const allLoans = [...formattedAssets, ...formattedReservations].sort(
      (a, b) => new Date(a.deadline) - new Date(b.deadline)
    );

    res.status(200).json(allLoans);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Gagal mengambil data pinjaman", details: err.message });
  }
}
