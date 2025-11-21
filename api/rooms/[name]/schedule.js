// File: /api/rooms/[name]/schedule.js
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const { name } = req.query;

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  try {
    const { data, error } = await supabase
      .from("room_reservations")
      .select("event_name, start_time, end_time")
      .eq("room_name", name)
      .eq("status", "Disetujui");

    if (error) throw error;

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({
      error: "Gagal mengambil jadwal ruangan.",
      details: error.message,
    });
  }
}
