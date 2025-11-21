import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  try {
    const { data, error } = await supabase
      .from("room_reservations")
      .select("*")
      .in("status", ["Disetujui", "Menunggu Persetujuan"]);

    if (error) throw error;

    // Format data untuk FullCalendar
    const events = data.map((reservation) => ({
      id: reservation.id,
      title: `${reservation.room_name}: ${reservation.event_name}`,
      start: reservation.start_time,
      end: reservation.end_time,
      extendedProps: {
        status: reservation.status,
        requester: reservation.requester_name,
      },
      // Beri warna sesuai status
      backgroundColor:
        reservation.status === "Disetujui" ? "#3b82f6" : "#f97316",
      borderColor: reservation.status === "Disetujui" ? "#3b82f6" : "#f97316",
    }));

    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({
      error: "Gagal mengambil data reservasi.",
      details: error.message,
    });
  }
}
