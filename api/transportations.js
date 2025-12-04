// File: /api/transportations.js
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
    case "GET":
      // Get all transportations with PIC info
      const { data, error } = await supabase
        .from("transportations")
        .select(`
          *,
          person_in_charge:profiles!person_in_charge_id (id, full_name)
        `)
        .order("vehicle_name", { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);

    case "POST":
      // Request to borrow transportation (member)
      const {
        transport_id,
        borrow_start,
        borrow_end,
        purpose,
        origin,
        destination,
        passengers_count,
      } = req.body;

      if (!transport_id || !borrow_start || !borrow_end) {
        return res.status(400).json({
          error: "Transport ID, waktu mulai, dan waktu selesai harus diisi.",
        });
      }

      // Check for time conflict
      const { data: conflicts } = await supabase
        .from("transport_loans")
        .select("id")
        .eq("transport_id", transport_id)
        .in("status", ["Menunggu Persetujuan", "Disetujui"])
        .or(`and(borrow_start.lte.${borrow_end},borrow_end.gte.${borrow_start})`);

      if (conflicts && conflicts.length > 0) {
        return res.status(409).json({
          error: "Waktu yang dipilih bertabrakan dengan peminjaman lain.",
        });
      }

      const { error: insertError } = await supabase
        .from("transport_loans")
        .insert({
          transport_id,
          borrower_id: user.id,
          borrow_start,
          borrow_end,
          purpose: purpose || null,
          origin: origin || null,
          destination: destination || null,
          passengers_count: passengers_count || null,
          status: "Menunggu Persetujuan",
        });

      if (insertError) {
        return res.status(500).json({ error: insertError.message });
      }

      return res.status(201).json({
        message: "Permintaan peminjaman transportasi berhasil diajukan.",
      });

    default:
      res.setHeader("Allow", ["GET", "POST"]);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
