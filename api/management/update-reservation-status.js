// File: /api/management/update-reservation-status.js

import { createClient } from "@supabase/supabase-js";

// Helper lengkap untuk verifikasi role management
async function verifyManagement(req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return { user: null, error: "Token tidak ditemukan." };

  // Gunakan service key untuk mendapatkan profil user yang melakukan request
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError) return { user: null, error: "Token tidak valid." };
  if (!user) return { user: null, error: "Pengguna tidak ditemukan." };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError) return { user: null, error: "Gagal memeriksa profil." };
  if (profile?.role !== "management")
    return { user: null, error: "Akses ditolak, peran bukan manajemen." };

  return { user, error: null };
}

export default async function handler(req, res) {
  // Method check
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Verifikasi bahwa request datang dari user dengan role 'management'
  const { error: authError } = await verifyManagement(req);
  if (authError) {
    return res.status(403).json({ error: "Access Forbidden: " + authError });
  }

  // Buat koneksi Supabase dengan hak akses penuh
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  const { reservationId, newStatus } = req.body;

  // Validasi input
  if (!reservationId || !newStatus) {
    return res
      .status(400)
      .json({ error: "ID Reservasi dan status baru dibutuhkan." });
  }
  if (!["Disetujui", "Ditolak"].includes(newStatus)) {
    return res
      .status(400)
      .json({ error: 'Status baru hanya bisa "Disetujui" atau "Ditolak".' });
  }

  // Jalankan proses update ke database
  try {
    const { error } = await supabase
      .from("room_reservations")
      .update({ status: newStatus })
      .eq("id", reservationId);

    if (error) {
      throw error;
    }

    res
      .status(200)
      .json({ message: `Reservasi berhasil diubah menjadi ${newStatus}` });
  } catch (error) {
    res.status(500).json({
      error: "Gagal memperbarui status reservasi di database.",
      details: error.message,
    });
  }
}
