// File: /api/dashboard-stats.js (Versi Final)

import { createClient } from "@supabase/supabase-js";

// Helper untuk verifikasi token, pastikan user sudah login
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
  // Verifikasi user terlebih dahulu
  const { error: userError } = await verifyUser(req);
  if (userError) return res.status(401).json({ error: "Unauthorized" });

  // Gunakan service key untuk membaca data, agar tidak terhalang RLS
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    // Jalankan semua query penghitungan data secara paralel agar lebih cepat
    const [
      { count: totalAssets },
      { count: borrowedAssets },
      { count: maintenanceAssets },
      { count: totalRooms },
      { count: approvedReservations },
      { count: pendingReservations },
    ] = await Promise.all([
      // 1. Hitung semua baris di tabel 'assets'
      supabaseAdmin.from("assets").select("*", { count: "exact", head: true }),
      // 2. Hitung aset dengan status 'Dipinjam'
      supabaseAdmin
        .from("assets")
        .select("*", { count: "exact", head: true })
        .eq("status", "Dipinjam"),
      // 3. Hitung aset dengan status 'Dalam Perbaikan'
      supabaseAdmin
        .from("assets")
        .select("*", { count: "exact", head: true })
        .eq("status", "Dalam Perbaikan"),
      // 4. Hitung semua baris di tabel 'rooms'
      supabaseAdmin.from("rooms").select("*", { count: "exact", head: true }),
      // 5. Hitung reservasi dengan status 'Disetujui'
      supabaseAdmin
        .from("room_reservations")
        .select("*", { count: "exact", head: true })
        .eq("status", "Disetujui"),
      // 6. Hitung reservasi dengan status 'Menunggu Persetujuan'
      supabaseAdmin
        .from("room_reservations")
        .select("*", { count: "exact", head: true })
        .eq("status", "Menunggu Persetujuan"),
    ]);

    // Kirim semua data yang sudah dihitung sebagai response
    res.status(200).json({
      totalAssets: totalAssets ?? 0,
      borrowedAssets: borrowedAssets ?? 0,
      maintenanceAssets: maintenanceAssets ?? 0,
      totalRooms: totalRooms ?? 0,
      approvedReservations: approvedReservations ?? 0,
      pendingReservations: pendingReservations ?? 0,
    });
  } catch (error) {
    res.status(500).json({
      error: "Gagal mengambil statistik dashboard",
      details: error.message,
    });
  }
}
