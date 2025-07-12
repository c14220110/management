import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  const { requester_name, event_name, room_name, start_time, end_time } =
    req.body;

  if (
    !requester_name ||
    !event_name ||
    !room_name ||
    !start_time ||
    !end_time
  ) {
    return res.status(400).json({ error: "Semua field harus diisi." });
  }

  try {
    // Cek jadwal bentrok
    const { data: existing, error: checkError } = await supabase
      .from("room_reservations")
      .select("id")
      .eq("room_name", room_name)
      .eq("status", "Disetujui")
      .or(`[start_time, end_time).overlaps.[${start_time}, ${end_time})`);

    if (checkError) throw checkError;

    if (existing && existing.length > 0) {
      return res.status(409).json({
        error: "Jadwal bentrok dengan reservasi yang sudah disetujui.",
      });
    }

    const { error } = await supabase.from("room_reservations").insert([
      {
        requester_name,
        event_name,
        room_name,
        start_time,
        end_time,
        status: "Menunggu Persetujuan",
      },
    ]);

    if (error) throw error;

    res.status(201).json({
      message:
        "Permintaan reservasi berhasil dikirim dan menunggu persetujuan.",
    });
  } catch (error) {
    res.status(500).json({
      error: "Gagal menyimpan data reservasi.",
      details: error.message,
    });
  }
}
