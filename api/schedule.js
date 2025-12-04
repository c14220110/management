// File: /api/schedule.js
// Consolidated API for fetching schedules: assets, rooms, transports
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  // Optional: Enforce auth if needed. For now, we'll use anon key but can add auth check.
  // Transport schedule originally required auth, others didn't.
  // We will check for token if present to pass to Supabase RLS if needed.
  const token = req.headers.authorization?.split(" ")[1];
  
  const options = token 
    ? { global: { headers: { Authorization: `Bearer ${token}` } } }
    : {};

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    options
  );

  let managementClient = null;
  let isManagementUser = false;
  if (token && process.env.SUPABASE_SERVICE_KEY) {
    const serviceClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    try {
      const {
        data: { user },
      } = await serviceClient.auth.getUser(token);
      if (user) {
        const { data: profile } = await serviceClient
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profile?.role === "management") {
          isManagementUser = true;
          managementClient = serviceClient;
        }
      }
    } catch (error) {
      console.warn("schedule: failed to verify management role", error.message);
    }
  }

  const { type, id, name } = req.query;

  if (!type) {
    return res.status(400).json({ error: "Parameter 'type' dibutuhkan (asset, room, transport)." });
  }

  try {
    let data, error;

    switch (type) {
      case "asset":
        if (!id) return res.status(400).json({ error: "ID aset dibutuhkan." });
        {
          const assetClient =
            isManagementUser && managementClient ? managementClient : supabase;
          ({ data, error } = await assetClient
            .from("asset_loans")
            .select("loan_date, due_date, status, profiles(full_name)")
            .eq("asset_id", id)
            .in("status", ["Disetujui", "Dipinjam"])); // Hanya yang pasti
        }
        break;

      case "room":
        if (!name) return res.status(400).json({ error: "Nama ruangan dibutuhkan." });
        ({ data, error } = await supabase
          .from("room_reservations")
          .select("event_name, start_time, end_time")
          .eq("room_name", name)
          .eq("status", "Disetujui"));
        break;

      case "transport":
        if (!id) return res.status(400).json({ error: "ID transportasi dibutuhkan." });
        // Transport schedule shows pending too (as per original code)
        ({ data, error } = await supabase
          .from("transport_loans")
          .select("id, borrow_start, borrow_end, status, profiles!borrower_id(full_name)")
          .eq("transport_id", id)
          .in("status", ["Menunggu Persetujuan", "Disetujui"])
          .order("borrow_start", { ascending: true }));
        break;

      default:
        return res.status(400).json({ error: "Tipe jadwal tidak valid." });
    }

    if (error) throw error;
    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ 
      error: "Gagal mengambil jadwal.", 
      details: error.message 
    });
  }
}
