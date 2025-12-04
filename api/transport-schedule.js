// File: /api/transport-schedule.js
// Returns loan schedule for a specific transport (for calendar view)
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

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { transport_id } = req.query;

  if (!transport_id) {
    return res.status(400).json({ error: "transport_id diperlukan" });
  }

  try {
    const { data, error } = await supabase
      .from("transport_loans")
      .select("id, borrow_start, borrow_end, status, profiles!borrower_id(full_name)")
      .eq("transport_id", transport_id)
      .in("status", ["Menunggu Persetujuan", "Disetujui"])
      .order("borrow_start", { ascending: true });

    if (error) throw error;

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
