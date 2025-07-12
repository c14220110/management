// ===== KODE DIAGNOSTIK UNTUK /api/dashboard-stats.js =====
// Tujuan: Hanya untuk memeriksa apakah token valid dan mengembalikan data user.

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    // 1. Ambil token dari header
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      // Jika tidak ada token sama sekali
      return res
        .status(401)
        .json({ error: "Akses ditolak: Token tidak ditemukan." });
    }

    // 2. Buat koneksi ke Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // 3. Verifikasi token untuk mendapatkan data user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError) {
      // Jika Supabase mengembalikan error saat verifikasi token
      return res.status(401).json({
        error: "Token tidak valid atau sudah kedaluwarsa.",
        details: userError.message,
      });
    }

    if (!user) {
      // Jika token valid tapi tidak ada user yang cocok
      return res.status(404).json({ error: "Pengguna tidak ditemukan." });
    }

    // 4. JIKA SEMUA BERHASIL: Kirim kembali data user sebagai konfirmasi
    // Di aplikasi nyata, kita akan mengembalikan stats, tapi untuk tes ini kita kembalikan user.
    return res.status(200).json({
      message: "Tes berhasil! Token valid.",
      userId: user.id,
      userEmail: user.email,
      // Kita kembalikan nilai dummy untuk stats agar frontend tidak error
      totalAssets: 1,
      borrowedAssets: 1,
      pendingReservations: 1,
      totalRooms: 1,
    });
  } catch (e) {
    // Menangkap error tak terduga lainnya
    return res
      .status(500)
      .json({ error: "Terjadi error internal di server.", details: e.message });
  }
}
