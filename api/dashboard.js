// File: /api/dashboard.js
// Consolidated API for dashboard operations: stats, my-requests, management-dashboard, member-dashboard, calendar
import { createClient } from "@supabase/supabase-js";

// Helper: Get current date in WIB (Asia/Jakarta) timezone
function getWIBDate() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
}

// Helper: Get WIB ISO string for current time
function getWIBISOString() {
  const date = getWIBDate();
  return date.toISOString();
}

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

  switch (action) {
    case "stats":
      return handleDashboardStats(req, res, user);
    case "my-requests":
      return handleMyRequests(req, res, supabase, user);
    case "management-dashboard":
      return handleManagementDashboard(req, res, user);
    case "member-dashboard":
      return handleMemberDashboard(req, res, supabase, user);
    case "calendar":
      return handleCalendarData(req, res, supabase, user);
    default:
      return res.status(400).json({
        error:
          "Action tidak valid. Gunakan: stats, my-requests, management-dashboard, member-dashboard, calendar",
      });
  }
}

// ============================================================
// DASHBOARD STATS HANDLER
// ============================================================
async function handleDashboardStats(req, res, user) {
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    // Get inventory stats from new system
    const [
      { count: totalTemplates },
      { count: totalUnits },
      { count: borrowedUnits },
      { count: maintenanceUnits },
      { count: totalRooms },
      { count: approvedReservations },
      { count: pendingReservations },
    ] = await Promise.all([
      supabaseAdmin.from("product_templates").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("product_units").select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("product_units")
        .select("*", { count: "exact", head: true })
        .eq("status", "borrowed"),
      supabaseAdmin
        .from("product_units")
        .select("*", { count: "exact", head: true })
        .eq("status", "maintenance"),
      supabaseAdmin.from("rooms").select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("room_reservations")
        .select("*", { count: "exact", head: true })
        .eq("status", "Disetujui"),
      supabaseAdmin
        .from("room_reservations")
        .select("*", { count: "exact", head: true })
        .eq("status", "Menunggu Persetujuan"),
    ]);

    res.status(200).json({
      totalAssets: totalTemplates ?? 0,
      totalUnits: totalUnits ?? 0,
      borrowedAssets: borrowedUnits ?? 0,
      maintenanceAssets: maintenanceUnits ?? 0,
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
    // Asset Loans - now with product_units and product_templates
    const { data: assetLoans } = await supabase
      .from("asset_loans")
      .select(`
        *,
        product_units:asset_unit_id (
          id, asset_code, serial_number,
          template:product_templates!template_id (id, name, photo_url)
        ),
        product_templates:product_template_id (id, name, photo_url)
      `)
      .eq("user_id", user.id)
      .order("loan_date", { ascending: false });

    // Process loans to get item name
    const processedLoans = (assetLoans || []).map((loan) => {
      let itemName = "Barang";
      let itemCode = "";
      let photoUrl = null;

      if (loan.product_units) {
        // Serialized item
        itemName = loan.product_units.template?.name || "Barang";
        itemCode = loan.product_units.asset_code || loan.product_units.serial_number || "";
        photoUrl = loan.product_units.template?.photo_url;
      } else if (loan.product_templates) {
        // Non-serialized item
        itemName = loan.product_templates.name || "Barang";
        itemCode = `Qty: ${loan.quantity || 1}`;
        photoUrl = loan.product_templates.photo_url;
      }

      return {
        ...loan,
        item_name: itemName,
        item_code: itemCode,
        photo_url: photoUrl,
      };
    });

    // Room Reservations
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const { data: roomReservations } = await supabase
      .from("room_reservations")
      .select("*")
      .eq("requester_name", profile?.full_name || user.email)
      .order("start_time", { ascending: false });

    // Transport Loans
    const { data: transportLoans } = await supabase
      .from("transport_loans")
      .select("*, transportations(vehicle_name, plate_number)")
      .eq("borrower_id", user.id)
      .order("borrow_start", { ascending: false });

    res.status(200).json({ 
      assetLoans: processedLoans, 
      roomReservations, 
      transportLoans 
    });
  } catch (error) {
    res.status(500).json({
      error: "Gagal mengambil data permintaan Anda.",
      details: error.message,
    });
  }
}

// ============================================================
// MANAGEMENT DASHBOARD - PUSAT KONTROL OPERASIONAL
// ============================================================
async function handleManagementDashboard(req, res, user) {
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).toISOString();
    const todayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59
    ).toISOString();

    // 1. STATISTIK DASAR - Updated for new inventory system
    const [
      { count: totalTemplates },
      { count: totalUnits },
      { count: borrowedUnits },
      { count: maintenanceUnits },
      { count: totalRooms },
      { count: approvedReservations },
      { count: pendingReservations },
      { count: totalTransports },
    ] = await Promise.all([
      supabaseAdmin.from("product_templates").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("product_units").select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("product_units")
        .select("*", { count: "exact", head: true })
        .eq("status", "borrowed"),
      supabaseAdmin
        .from("product_units")
        .select("*", { count: "exact", head: true })
        .eq("status", "maintenance"),
      supabaseAdmin.from("rooms").select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("room_reservations")
        .select("*", { count: "exact", head: true })
        .eq("status", "Disetujui"),
      supabaseAdmin
        .from("room_reservations")
        .select("*", { count: "exact", head: true })
        .eq("status", "Menunggu Persetujuan"),
      supabaseAdmin
        .from("transportations")
        .select("*", { count: "exact", head: true }),
    ]);

    // Get non-serialized borrowed count from asset_loans
    const { data: nonSerialLoans } = await supabaseAdmin
      .from("asset_loans")
      .select("quantity")
      .not("product_template_id", "is", null)
      .in("status", ["Disetujui", "Dipinjam"])
      .is("return_date", null);
    
    const nonSerialBorrowed = (nonSerialLoans || []).reduce((sum, l) => sum + (l.quantity || 0), 0);

    // 2. PERINGATAN SERVIS KENDARAAN
    const { data: vehicleServiceAlerts } = await supabaseAdmin
      .from("transportations")
      .select(
        "id, vehicle_name, plate_number, next_service_at, odometer_km, driver_name"
      )
      .not("next_service_at", "is", null)
      .lte("next_service_at", todayEnd)
      .order("next_service_at", { ascending: true });

    // 3. BARANG TERLAMBAT DIKEMBALIKAN (Overdue) - Updated query
    const { data: overdueLoansRaw } = await supabaseAdmin
      .from("asset_loans")
      .select(`
        id, 
        loan_date, 
        due_date,
        quantity,
        user_id,
        asset_unit_id,
        product_template_id,
        product_units:asset_unit_id (
          asset_code, serial_number,
          template:product_templates!template_id (name)
        ),
        product_templates:product_template_id (name)
      `)
      .in("status", ["Disetujui", "Dipinjam"])
      .is("return_date", null)
      .lt("due_date", todayStart)
      .order("due_date", { ascending: true });

    // Get profiles for overdue loans
    const overdueUserIds = [...new Set((overdueLoansRaw || []).map(l => l.user_id).filter(Boolean))];
    let overdueProfileMap = new Map();
    if (overdueUserIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", overdueUserIds);
      overdueProfileMap = new Map((profiles || []).map(p => [p.id, p.full_name]));
    }

    const overdueItems = (overdueLoansRaw || []).map((loan) => {
      const dueDate = new Date(loan.due_date);
      const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
      
      let itemName = "Barang";
      let itemCode = "";
      if (loan.product_units) {
        itemName = loan.product_units.template?.name || "Barang";
        itemCode = loan.product_units.asset_code || loan.product_units.serial_number || "";
      } else if (loan.product_templates) {
        itemName = `${loan.product_templates.name} (x${loan.quantity || 1})`;
      }

      return {
        ...loan,
        item_name: itemName,
        item_code: itemCode,
        borrower_name: overdueProfileMap.get(loan.user_id) || null,
        days_overdue: daysOverdue,
      };
    });

    // 4. KEGIATAN HARI INI
    const { data: todayRoomReservations } = await supabaseAdmin
      .from("room_reservations")
      .select("id, room_name, event_name, requester_name, start_time, end_time")
      .eq("status", "Disetujui")
      .gte("end_time", todayStart)
      .lte("start_time", todayEnd)
      .order("start_time", { ascending: true });

    const { data: todayTransportLoans } = await supabaseAdmin
      .from("transport_loans")
      .select(`
        id, 
        borrow_start, 
        borrow_end, 
        purpose,
        origin,
        destination,
        transportations(vehicle_name, plate_number, driver_name, driver_whatsapp),
        profiles:borrower_id(full_name)
      `)
      .eq("status", "Disetujui")
      .gte("borrow_end", todayStart)
      .lte("borrow_start", todayEnd)
      .order("borrow_start", { ascending: true });

    // 5. KONDISI UNIT (untuk pie chart) - Updated for product_units
    const { data: unitConditions } = await supabaseAdmin
      .from("product_units")
      .select("condition")
      .not("status", "eq", "scrapped");

    const conditionSummary = {
      baik: 0,
      perluPerbaikan: 0,
      rusak: 0,
      tidakDiketahui: 0,
    };

    (unitConditions || []).forEach((unit) => {
      const cond = (unit.condition || "").toLowerCase();
      if (cond === "baik") conditionSummary.baik++;
      else if (cond === "perlu perbaikan") conditionSummary.perluPerbaikan++;
      else if (cond === "rusak") conditionSummary.rusak++;
      else conditionSummary.tidakDiketahui++;
    });

    // 6. PENDING REQUESTS (gabungan) - Updated query
    const [
      { data: pendingAssetLoansRaw },
      { data: pendingRoomReservations },
      { data: pendingTransportLoans },
    ] = await Promise.all([
      supabaseAdmin
        .from("asset_loans")
        .select(`
          id,
          loan_date,
          due_date,
          status,
          quantity,
          asset_unit_id,
          product_template_id,
          user_id,
          product_units:asset_unit_id (
            asset_code, serial_number,
            template:product_templates!template_id (name, photo_url)
          ),
          product_templates:product_template_id (name, photo_url)
        `)
        .eq("status", "Menunggu Persetujuan")
        .order("loan_date", { ascending: true }),
      supabaseAdmin
        .from("room_reservations")
        .select("*")
        .eq("status", "Menunggu Persetujuan")
        .order("start_time", { ascending: true }),
      supabaseAdmin
        .from("transport_loans")
        .select(`
          id, borrow_start, borrow_end, purpose,
          transportations(vehicle_name, plate_number),
          profiles:borrower_id(full_name)
        `)
        .eq("status", "Menunggu Persetujuan")
        .order("borrow_start", { ascending: true }),
    ]);

    // Get profiles for pending asset loans
    const assetLoanUserIds = [
      ...new Set(
        (pendingAssetLoansRaw || []).map((loan) => loan.user_id).filter(Boolean)
      ),
    ];
    let assetProfileMap = new Map();
    if (assetLoanUserIds.length > 0) {
      const { data: assetProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", assetLoanUserIds);
      if (assetProfiles) {
        assetProfileMap = new Map(
          assetProfiles.map((profile) => [profile.id, profile.full_name])
        );
      }
    }

    // Process pending asset loans
    const pendingAssetLoans = (pendingAssetLoansRaw || []).map((loan) => {
      let itemName = "Barang";
      let itemCode = "";
      let photoUrl = null;

      if (loan.product_units) {
        itemName = loan.product_units.template?.name || "Barang";
        itemCode = loan.product_units.asset_code || loan.product_units.serial_number || "";
        photoUrl = loan.product_units.template?.photo_url;
      } else if (loan.product_templates) {
        itemName = `${loan.product_templates.name} (x${loan.quantity || 1})`;
        photoUrl = loan.product_templates.photo_url;
      }

      return {
        ...loan,
        item_name: itemName,
        item_code: itemCode,
        photo_url: photoUrl,
        profiles: { full_name: assetProfileMap.get(loan.user_id) || null },
      };
    });

    // 7. STATISTIK TRANSPORTASI HARI INI
    const { data: transportStats } = await supabaseAdmin
      .from("transport_loans")
      .select("id")
      .eq("status", "Disetujui")
      .gte("borrow_start", todayStart)
      .lte("borrow_start", todayEnd);

    res.status(200).json({
      stats: {
        totalAssets: totalTemplates ?? 0,
        totalUnits: totalUnits ?? 0,
        borrowedAssets: (borrowedUnits ?? 0) + nonSerialBorrowed,
        maintenanceAssets: maintenanceUnits ?? 0,
        totalRooms: totalRooms ?? 0,
        approvedReservations: approvedReservations ?? 0,
        pendingReservations: pendingReservations ?? 0,
        totalTransports: totalTransports ?? 0,
        activeTransportsToday: transportStats?.length ?? 0,
      },
      alerts: {
        vehicleServiceAlerts: vehicleServiceAlerts || [],
        overdueItems: overdueItems || [],
      },
      todayActivities: {
        rooms: todayRoomReservations || [],
        transports: todayTransportLoans || [],
      },
      conditionSummary,
      pendingRequests: {
        assetLoans: pendingAssetLoans || [],
        roomReservations: pendingRoomReservations || [],
        transportLoans: pendingTransportLoans || [],
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Gagal mengambil data dashboard manajemen.",
      details: error.message,
    });
  }
}

// ============================================================
// MEMBER DASHBOARD - STATUS TRACKING & QUICK INFO
// ============================================================
async function handleMemberDashboard(req, res, supabase, user) {
  try {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).toISOString();
    const todayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59
    ).toISOString();
    const tomorrowEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      23,
      59,
      59
    ).toISOString();

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    // 1. PENGINGAT JATUH TEMPO - Updated query
    const { data: dueSoonLoans } = await supabase
      .from("asset_loans")
      .select(`
        id, loan_date, due_date, quantity,
        asset_unit_id, product_template_id,
        product_units:asset_unit_id (
          asset_code, serial_number,
          template:product_templates!template_id (name)
        ),
        product_templates:product_template_id (name)
      `)
      .eq("user_id", user.id)
      .in("status", ["Disetujui", "Dipinjam"])
      .is("return_date", null)
      .gte("due_date", todayStart)
      .lte("due_date", tomorrowEnd)
      .order("due_date", { ascending: true });

    const dueReminders = (dueSoonLoans || []).map((loan) => {
      const dueDate = new Date(loan.due_date);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1
      );

      let urgency = "normal";
      if (dueDate <= today) urgency = "today";
      else if (dueDate <= tomorrow) urgency = "tomorrow";

      let itemName = "Barang";
      let itemCode = "";
      if (loan.product_units) {
        itemName = loan.product_units.template?.name || "Barang";
        itemCode = loan.product_units.asset_code || loan.product_units.serial_number || "";
      } else if (loan.product_templates) {
        itemName = `${loan.product_templates.name} (x${loan.quantity || 1})`;
      }

      return { 
        ...loan, 
        urgency,
        item_name: itemName,
        item_code: itemCode,
      };
    });

    // 2. RIWAYAT PERMINTAAN - Updated query
    const { data: assetLoans } = await supabase
      .from("asset_loans")
      .select(`
        *,
        product_units:asset_unit_id (
          asset_code, serial_number,
          template:product_templates!template_id (name)
        ),
        product_templates:product_template_id (name)
      `)
      .eq("user_id", user.id)
      .order("loan_date", { ascending: false })
      .limit(10);

    const processedAssetLoans = (assetLoans || []).map((loan) => {
      let itemName = "Barang";
      if (loan.product_units) {
        itemName = loan.product_units.template?.name || "Barang";
      } else if (loan.product_templates) {
        itemName = loan.product_templates.name || "Barang";
      }
      return { ...loan, item_name: itemName };
    });

    const { data: roomReservations } = await supabase
      .from("room_reservations")
      .select("*")
      .eq("requester_name", profile?.full_name || user.email)
      .order("start_time", { ascending: false })
      .limit(10);

    const { data: transportLoans } = await supabase
      .from("transport_loans")
      .select("*, transportations(vehicle_name, plate_number)")
      .eq("borrower_id", user.id)
      .order("borrow_start", { ascending: false })
      .limit(10);

    // 3. KETERSEDIAAN CEPAT
    const { data: allRooms } = await supabase
      .from("rooms")
      .select("id, name, lokasi, kapasitas")
      .order("name", { ascending: true });

    const { data: busyRooms } = await supabase
      .from("room_reservations")
      .select("room_name")
      .eq("status", "Disetujui")
      .lte("start_time", now.toISOString())
      .gte("end_time", now.toISOString());

    const busyRoomNames = new Set((busyRooms || []).map((r) => r.room_name));

    const roomAvailability = (allRooms || []).map((room) => ({
      ...room,
      isAvailable: !busyRoomNames.has(room.name),
    }));

    const { data: allTransports } = await supabase
      .from("transportations")
      .select("id, vehicle_name, plate_number, capacity, driver_name")
      .order("vehicle_name", { ascending: true });

    const { data: busyTransports } = await supabase
      .from("transport_loans")
      .select("transport_id")
      .eq("status", "Disetujui")
      .lte("borrow_start", now.toISOString())
      .gte("borrow_end", now.toISOString());

    const busyTransportIds = new Set(
      (busyTransports || []).map((t) => t.transport_id)
    );

    const transportAvailability = (allTransports || []).map((transport) => ({
      ...transport,
      isAvailable: !busyTransportIds.has(transport.id),
    }));

    // 4. KEGIATAN MENDATANG
    const weekFromNow = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 7
    ).toISOString();

    const { data: upcomingRooms } = await supabase
      .from("room_reservations")
      .select("*")
      .eq("requester_name", profile?.full_name || user.email)
      .eq("status", "Disetujui")
      .gte("start_time", todayStart)
      .lte("start_time", weekFromNow)
      .order("start_time", { ascending: true });

    const { data: upcomingTransports } = await supabase
      .from("transport_loans")
      .select("*, transportations(vehicle_name, plate_number)")
      .eq("borrower_id", user.id)
      .eq("status", "Disetujui")
      .gte("borrow_start", todayStart)
      .lte("borrow_start", weekFromNow)
      .order("borrow_start", { ascending: true });

    res.status(200).json({
      dueReminders: dueReminders || [],
      requests: {
        assetLoans: processedAssetLoans || [],
        roomReservations: roomReservations || [],
        transportLoans: transportLoans || [],
      },
      availability: {
        rooms: roomAvailability || [],
        transports: transportAvailability || [],
      },
      upcoming: {
        rooms: upcomingRooms || [],
        transports: upcomingTransports || [],
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Gagal mengambil data dashboard member.",
      details: error.message,
    });
  }
}

// ============================================================
// CALENDAR DATA - UNIFIED VIEW FOR ALL RESERVATIONS
// ============================================================
async function handleCalendarData(req, res, supabase, user) {
  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();

    const isManagement = profile?.role === "management";
    const userFullName = profile?.full_name || user.email;

    const { start, end } = req.query;
    const normalizeDateString = (val) => {
      if (!val) return null;
      const cleaned = String(val).replace(" ", "+");
      const parsed = new Date(cleaned);
      if (Number.isNaN(parsed.getTime())) return null;
      return parsed.toISOString();
    };

    const now = new Date();
    const rangeStart =
      normalizeDateString(start) ||
      new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
    const rangeEnd =
      normalizeDateString(end) ||
      new Date(
        now.getFullYear(),
        now.getMonth() + 3,
        0,
        23,
        59,
        59
      ).toISOString();

    const events = [];

    // 1. ASSET LOANS - Updated query
    let assetQuery = supabaseAdmin
      .from("asset_loans")
      .select(`
        id,
        loan_date,
        due_date,
        status,
        user_id,
        quantity,
        asset_unit_id,
        product_template_id,
        product_units:asset_unit_id (
          asset_code, serial_number,
          template:product_templates!template_id (name)
        ),
        product_templates:product_template_id (name)
      `)
      .in("status", ["Disetujui", "Menunggu Persetujuan", "Dipinjam"])
      .lte("loan_date", rangeEnd);

    if (!isManagement) {
      assetQuery = assetQuery.eq("user_id", user.id);
    }

    const { data: assetLoansRaw, error: assetError } = await assetQuery;
    if (assetError) {
      console.error("Asset loans query error:", assetError);
    }

    const assetLoansFiltered = (assetLoansRaw || []).filter(
      (loan) => new Date(loan.due_date) >= new Date(rangeStart)
    );

    // Get profiles for asset loans
    const userIds = [
      ...new Set(
        assetLoansFiltered.map((loan) => loan.user_id).filter(Boolean)
      ),
    ];
    let profileMap = new Map();
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      if (profiles) {
        profileMap = new Map(
          profiles.map((profile) => [profile.id, profile.full_name])
        );
      }
    }

    const assetLoans = assetLoansFiltered.map((loan) => {
      let itemName = "Barang";
      let itemCode = "";
      if (loan.product_units) {
        itemName = loan.product_units.template?.name || "Barang";
        itemCode = loan.product_units.asset_code || loan.product_units.serial_number || "";
      } else if (loan.product_templates) {
        itemName = `${loan.product_templates.name} (x${loan.quantity || 1})`;
      }
      return {
        ...loan,
        borrowerName: profileMap.get(loan.user_id) || null,
        item_name: itemName,
        item_code: itemCode,
      };
    });

    (assetLoans || []).forEach((loan) => {
      events.push({
        id: `asset-${loan.id}`,
        title: `📦 ${loan.item_name}`,
        start: loan.loan_date,
        end: loan.due_date,
        type: "asset",
        status: loan.status,
        backgroundColor:
          loan.status === "Menunggu Persetujuan" ? "#f59e0b" : "#3b82f6",
        borderColor:
          loan.status === "Menunggu Persetujuan" ? "#d97706" : "#2563eb",
        textColor: "#ffffff",
        extendedProps: {
          type: "asset",
          assetName: loan.item_name,
          assetCode: loan.item_code,
          borrower: loan.borrowerName,
          status: loan.status,
        },
      });
    });

    // 2. ROOM RESERVATIONS
    let roomQuery = supabaseAdmin
      .from("room_reservations")
      .select(
        "id, room_name, event_name, requester_name, start_time, end_time, status"
      )
      .in("status", ["Disetujui", "Menunggu Persetujuan"])
      .lte("start_time", rangeEnd);

    if (!isManagement) {
      roomQuery = roomQuery.eq("requester_name", userFullName);
    }

    const { data: roomReservationsRaw, error: roomError } = await roomQuery;
    if (roomError) {
      console.error("Room reservations query error:", roomError);
    }

    const roomReservations = (roomReservationsRaw || []).filter(
      (res) => new Date(res.end_time) >= new Date(rangeStart)
    );

    (roomReservations || []).forEach((res) => {
      events.push({
        id: `room-${res.id}`,
        title: `🏠 ${res.room_name}: ${res.event_name}`,
        start: res.start_time,
        end: res.end_time,
        type: "room",
        status: res.status,
        backgroundColor:
          res.status === "Menunggu Persetujuan" ? "#f59e0b" : "#10b981",
        borderColor:
          res.status === "Menunggu Persetujuan" ? "#d97706" : "#059669",
        textColor: "#ffffff",
        extendedProps: {
          type: "room",
          roomName: res.room_name,
          eventName: res.event_name,
          requester: res.requester_name,
          status: res.status,
        },
      });
    });

    // 3. TRANSPORT LOANS
    let transportQuery = supabaseAdmin
      .from("transport_loans")
      .select(`
        id,
        borrow_start,
        borrow_end,
        purpose,
        origin,
        destination,
        status,
        transportations(vehicle_name, plate_number),
        profiles:borrower_id(full_name)
      `)
      .in("status", ["Disetujui", "Menunggu Persetujuan"])
      .lte("borrow_start", rangeEnd);

    if (!isManagement) {
      transportQuery = transportQuery.eq("borrower_id", user.id);
    }

    const { data: transportLoansRaw, error: transportError } =
      await transportQuery;
    if (transportError) {
      console.error("Transport loans query error:", transportError);
    }

    const transportLoans = (transportLoansRaw || []).filter(
      (loan) => new Date(loan.borrow_end) >= new Date(rangeStart)
    );

    (transportLoans || []).forEach((loan) => {
      events.push({
        id: `transport-${loan.id}`,
        title: `🚐 ${loan.transportations?.vehicle_name || "Kendaraan"}`,
        start: loan.borrow_start,
        end: loan.borrow_end,
        type: "transport",
        status: loan.status,
        backgroundColor:
          loan.status === "Menunggu Persetujuan" ? "#f59e0b" : "#8b5cf6",
        borderColor:
          loan.status === "Menunggu Persetujuan" ? "#d97706" : "#7c3aed",
        textColor: "#ffffff",
        extendedProps: {
          type: "transport",
          vehicleName: loan.transportations?.vehicle_name,
          plateNumber: loan.transportations?.plate_number,
          purpose: loan.purpose,
          origin: loan.origin,
          destination: loan.destination,
          borrower: loan.profiles?.full_name,
          status: loan.status,
        },
      });
    });

    res.status(200).json({
      events,
      meta: {
        isManagement,
        rangeStart,
        rangeEnd,
        counts: {
          assets: assetLoans?.length || 0,
          rooms: roomReservations?.length || 0,
          transports: transportLoans?.length || 0,
          total: events.length,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Gagal mengambil data kalender.",
      details: error.message,
    });
  }
}
