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

  const { type, id, name, resource, itemId, isSerialized } = req.query;

  // Support both query styles: type/id (old) and resource/itemId (new)
  const resolvedType = type || resource;
  const resolvedId = id || itemId;

  if (!resolvedType) {
    return res
      .status(400)
      .json({ error: "Parameter 'type' atau 'resource' dibutuhkan." });
  }

  try {
    let data, error;

    switch (resolvedType) {
      case "asset":
        if (!resolvedId) return res.status(400).json({ error: "ID aset dibutuhkan." });
        {
          const assetClient =
            isManagementUser && managementClient ? managementClient : supabase;
          ({ data, error } = await assetClient
            .from("asset_loans")
            .select("loan_date, due_date, borrow_start, borrow_end, status, user_id")
            .eq("asset_id", resolvedId)
            .in("status", ["Disetujui", "Dipinjam"])); // Hanya yang pasti
          if (!error && data?.length) {
            data = await attachProfilesToLoans(
              data,
              isManagementUser && managementClient ? managementClient : supabase
            );
          }
        }
        break;

      // New handler for member borrow modal schedule preview
      case "assets":
        if (!resolvedId) return res.status(400).json({ error: "ID item dibutuhkan." });
        {
          const assetClient =
            isManagementUser && managementClient ? managementClient : supabase;
          
          // Query based on whether we're looking at a serialized unit or non-serialized template
          let query = assetClient
            .from("asset_loans")
            .select("id, borrow_start, borrow_end, status, user_id")
            .in("status", ["Menunggu Persetujuan", "Disetujui", "Dipinjam"])
            .is("return_date", null)
            .not("borrow_start", "is", null)
            .order("borrow_start", { ascending: true });
          
          if (isSerialized === "true") {
            // Serialized: filter by asset_unit_id
            query = query.eq("asset_unit_id", resolvedId);
          } else {
            // Non-serialized: filter by product_template_id
            query = query.eq("product_template_id", resolvedId);
          }
          
          ({ data, error } = await query);
          
          // Only return future schedules (next 30 days)
          if (!error && data) {
            const now = new Date();
            data = data.filter(d => new Date(d.borrow_end) > now);
          }
        }
        break;

      case "room":
        if (!name)
          return res.status(400).json({ error: "Nama ruangan dibutuhkan." });
        ({ data, error } = await supabase
          .from("room_reservations")
          .select("event_name, start_time, end_time")
          .eq("room_name", name)
          .eq("status", "Disetujui"));
        break;

      case "transport":
        if (!resolvedId)
          return res.status(400).json({ error: "ID transportasi dibutuhkan." });
        // Transport schedule shows pending too (as per original code)
        ({ data, error } = await supabase
          .from("transport_loans")
          .select(
            "id, borrow_start, borrow_end, status, profiles!borrower_id(full_name)"
          )
          .eq("transport_id", resolvedId)
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
      details: error.message,
    });
  }
}

async function attachProfilesToLoans(loans = [], client) {
  if (!client || loans.length === 0) return loans;
  const userIds = [
    ...new Set(loans.map((loan) => loan.user_id).filter(Boolean)),
  ];
  if (userIds.length === 0) return loans;

  const { data: profiles, error } = await client
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);
  if (error || !profiles) return loans;

  const profileMap = new Map(
    profiles.map((profile) => [profile.id, profile.full_name])
  );

  return loans.map((loan) => ({
    ...loan,
    profiles: { full_name: profileMap.get(loan.user_id) || null },
  }));
}
