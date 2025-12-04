// File: /api/member.js
// Consolidated API for member operations: assets, rooms, transports, cancel
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

  const { resource, action } = req.query;

  // Handle cancel action (POST only)
  if (action === "cancel" && req.method === "POST") {
    return handleCancel(req, res, supabase, user);
  }

  // Handle resource-based operations
  switch (resource) {
    case "assets":
      return handleAssets(req, res, supabase, user);
    case "rooms":
      return handleRooms(req, res, supabase, user);
    case "transports":
      return handleTransports(req, res, supabase, user);
    default:
      return res.status(400).json({ error: "Resource tidak valid. Gunakan: assets, rooms, transports" });
  }
}

// ============================================================
// ASSETS HANDLER
// ============================================================
async function handleAssets(req, res, supabase, user) {
  switch (req.method) {
    case "GET":
      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .order("asset_name", { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);

    case "POST":
      const { asset_id, loan_date, due_date } = req.body;
      if (!asset_id || !loan_date || !due_date)
        return res.status(400).json({ error: "Semua field harus diisi." });

      const { error: insertError } = await supabase.from("asset_loans").insert({
        asset_id: asset_id,
        user_id: user.id,
        loan_date: loan_date,
        due_date: due_date,
        status: "Menunggu Persetujuan",
      });
      if (insertError)
        return res.status(500).json({ error: insertError.message });
      return res
        .status(201)
        .json({ message: "Permintaan peminjaman aset berhasil diajukan." });

    default:
      res.setHeader("Allow", ["GET", "POST"]);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

// ============================================================
// ROOMS HANDLER
// ============================================================
async function handleRooms(req, res, supabase, user) {
  switch (req.method) {
    case "GET":
      const { data, error } = await supabase
        .from("rooms")
        .select("name")
        .order("name", { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);

    case "POST":
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
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

// ============================================================
// TRANSPORTS HANDLER
// ============================================================
async function handleTransports(req, res, supabase, user) {
  switch (req.method) {
    case "GET":
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
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

// ============================================================
// CANCEL HANDLER
// ============================================================
async function handleCancel(req, res, supabase, user) {
  const { requestId, requestType } = req.body;
  if (!requestId || !requestType) {
    return res
      .status(400)
      .json({ error: "ID dan tipe permintaan dibutuhkan." });
  }

  try {
    let tableName = "";
    let ownerColumn = "";

    if (requestType === "asset") {
      tableName = "asset_loans";
      ownerColumn = "user_id";
    } else if (requestType === "room") {
      tableName = "room_reservations";
      ownerColumn = "requester_name";
    } else if (requestType === "transport") {
      tableName = "transport_loans";
      ownerColumn = "borrower_id";
    } else {
      return res.status(400).json({ error: "Tipe permintaan tidak valid." });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq("id", requestId)
      .eq(ownerColumn, ownerColumn === "requester_name" ? profile.full_name : user.id)
      .eq("status", "Menunggu Persetujuan");

    if (error) throw error;

    res.status(200).json({ message: "Permintaan berhasil dibatalkan." });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Gagal membatalkan permintaan.", details: error.message });
  }
}
