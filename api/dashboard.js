// File: /api/dashboard.js
// Consolidated API for dashboard operations: stats and my-requests
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

  const { action } = req.query;

  if (action === "stats") {
    return handleDashboardStats(req, res, user);
  } else if (action === "my-requests") {
    return handleMyRequests(req, res, supabase, user);
  } else {
    return res.status(400).json({ error: "Action tidak valid. Gunakan: stats, my-requests" });
  }
}

// ============================================================
// DASHBOARD STATS HANDLER
// ============================================================
async function handleDashboardStats(req, res, user) {
  // Use service key for stats to bypass RLS if needed, or stick to anon key if RLS allows reading counts.
  // Original code used service key for stats.
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    const [
      { count: totalAssets },
      { count: borrowedAssets },
      { count: maintenanceAssets },
      { count: totalRooms },
      { count: approvedReservations },
      { count: pendingReservations },
    ] = await Promise.all([
      supabaseAdmin.from("assets").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("assets").select("*", { count: "exact", head: true }).eq("status", "Dipinjam"),
      supabaseAdmin.from("assets").select("*", { count: "exact", head: true }).eq("status", "Dalam Perbaikan"),
      supabaseAdmin.from("rooms").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("room_reservations").select("*", { count: "exact", head: true }).eq("status", "Disetujui"),
      supabaseAdmin.from("room_reservations").select("*", { count: "exact", head: true }).eq("status", "Menunggu Persetujuan"),
    ]);

    res.status(200).json({
      totalAssets: totalAssets ?? 0,
      borrowedAssets: borrowedAssets ?? 0,
      maintenanceAssets: maintenanceAssets ?? 0,
      totalRooms: totalRooms ?? 0,
      approvedReservations: approvedReservations ?? 0,
      pendingReservations: pendingReservations ?? 0,
    });
  } catch (error) {
    res.status(500).json({
      error: "Gagal mengambil statistik dashboard",
      details: error.message,
    });
  }
}

// ============================================================
// MY REQUESTS HANDLER
// ============================================================
async function handleMyRequests(req, res, supabase, user) {
  try {
    // Asset Loans
    const { data: assetLoans } = await supabase
      .from("asset_loans")
      .select("*, assets(asset_name)")
      .eq("user_id", user.id)
      .order("loan_date", { ascending: false });

    // Room Reservations
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
      
    const { data: roomReservations } = await supabase
      .from("room_reservations")
      .select("*")
      .eq("requester_name", profile?.full_name || user.email) // Fallback if no profile name
      .order("start_time", { ascending: false });

    // Transport Loans
    const { data: transportLoans } = await supabase
      .from("transport_loans")
      .select("*, transportations(vehicle_name, plate_number)")
      .eq("borrower_id", user.id)
      .order("borrow_start", { ascending: false });

    res.status(200).json({ assetLoans, roomReservations, transportLoans });
  } catch (error) {
    res.status(500).json({
      error: "Gagal mengambil data permintaan Anda.",
      details: error.message,
    });
  }
}
