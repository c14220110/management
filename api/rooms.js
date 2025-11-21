// File: /api/rooms.js
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
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

  switch (req.method) {
    case "GET": // Menggantikan get-rooms.js
      const { data, error } = await supabase
        .from("rooms")
        .select("name")
        .order("name", { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);

    case "POST": // Menggantikan request-room.js
      const { event_name, room_name, start_time, end_time } = req.body;
      if (!event_name || !room_name || !start_time || !end_time)
        return res.status(400).json({ error: "Semua field harus diisi." });

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      const { error: insertError } = await supabase
        .from("room_reservations")
        .insert({
          requester_name: profile.full_name || user.email,
          event_name,
          room_name,
          start_time,
          end_time,
          status: "Menunggu Persetujuan",
        });
      if (insertError)
        return res.status(500).json({ error: insertError.message });
      return res
        .status(201)
        .json({ message: "Permintaan reservasi ruangan berhasil diajukan." });

    default:
      res.setHeader("Allow", ["GET", "POST"]);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
