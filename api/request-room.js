import { createClient } from "@supabase/supabase-js";

// ... (file ini butuh user_id di tabel room_reservations, asumsikan sudah ditambahkan)
// Jika belum, Anda perlu menambahkan kolom user_id UUID FK ke auth.users
// Untuk sementara, kode ini akan tetap menggunakan requester_name

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

  const { event_name, room_name, start_time, end_time } = req.body;

  if (!event_name || !room_name || !start_time || !end_time) {
    return res.status(400).json({ error: "Semua field harus diisi." });
  }

  try {
    // Ambil nama lengkap user dari profil untuk diisi ke requester_name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const { error } = await supabase.from("room_reservations").insert({
      requester_name: profile.full_name || user.email, // Gunakan nama lengkap jika ada
      event_name,
      room_name,
      start_time,
      end_time,
      status: "Menunggu Persetujuan",
      // user_id: user.id // -> Idealnya seperti ini jika kolomnya ada
    });

    if (error) throw error;

    res
      .status(201)
      .json({ message: "Permintaan reservasi ruangan berhasil diajukan." });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Gagal mengajukan reservasi.", details: error.message });
  }
}
