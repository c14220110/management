// File: /api/member.js
// Consolidated API for member operations: inventory, rooms, transports, cancel
import { createClient } from "@supabase/supabase-js";
import { sendEmail, getManagementEmails } from "./utils/email.js";

// Service client for inventory (bypasses RLS)
function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

export default async function handler(req, res) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token dibutuhkan." });

  // Use anon key with user token for auth operations
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
    case "inventory":
      // Use service client for inventory to bypass RLS
      return handleInventory(req, res, getServiceClient(), user);
    case "rooms":
      return handleRooms(req, res, supabase, user);
    case "transports":
      return handleTransports(req, res, supabase, user);
    default:
      return res.status(400).json({ error: "Resource tidak valid. Gunakan: inventory, rooms, transports" });
  }
}


// ============================================================
// INVENTORY HANDLER (New system using product_templates & product_units)
// ============================================================
async function handleInventory(req, res, supabase, user) {
  switch (req.method) {
    case "GET": {
      const { templateId, unitId } = req.query || {};

      // Get single unit detail
      if (unitId) {
        const { data: unit, error } = await supabase
          .from("product_units")
          .select(`
            id,
            serial_number,
            asset_code,
            status,
            condition,
            location:stock_locations!location_id (id, name, code),
            template:product_templates!template_id (
              id, name, description, photo_url, is_serialized, uom,
              category:asset_categories!category_id (id, name, code)
            )
          `)
          .eq("id", unitId)
          .single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(unit);
      }

      // Get units for a specific template
      if (templateId) {
        const { data: units, error } = await supabase
          .from("product_units")
          .select(`
            id,
            serial_number,
            asset_code,
            status,
            condition,
            photo_url,
            location:stock_locations!location_id (id, name, code)
          `)
          .eq("template_id", templateId)
          .eq("status", "available")
          .order("asset_code", { ascending: true });
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(units || []);
      }

      // Get all product templates with stock info
      const { data: templates, error: tmplError } = await supabase
        .from("product_templates")
        .select(`
          id,
          name,
          description,
          photo_url,
          is_serialized,
          uom,
          quantity_on_hand,
          category:asset_categories!category_id (id, name, code),
          default_location:stock_locations!default_location_id (id, name, code)
        `)
        .order("name", { ascending: true });
      if (tmplError) return res.status(500).json({ error: tmplError.message });

      // Get unit counts for serialized items
      const { data: units } = await supabase
        .from("product_units")
        .select("template_id, status");

      const serializedStock = new Map();
      (units || []).forEach((u) => {
        const curr = serializedStock.get(u.template_id) || { total: 0, available: 0 };
        curr.total += 1;
        if (u.status === "available") curr.available += 1;
        serializedStock.set(u.template_id, curr);
      });

      // Get borrowed quantities for non-serialized items
      const { data: activeLoans } = await supabase
        .from("asset_loans")
        .select("product_template_id, quantity")
        .not("product_template_id", "is", null)
        .in("status", ["Disetujui", "Dipinjam"])
        .is("return_date", null);

      const borrowedQty = new Map();
      (activeLoans || []).forEach((loan) => {
        const curr = borrowedQty.get(loan.product_template_id) || 0;
        borrowedQty.set(loan.product_template_id, curr + (loan.quantity || 0));
      });

      const result = (templates || []).map((t) => {
        if (t.is_serialized) {
          const stock = serializedStock.get(t.id) || { total: 0, available: 0 };
          return { ...t, stock };
        } else {
          const borrowed = borrowedQty.get(t.id) || 0;
          const available = Math.max(0, (t.quantity_on_hand || 0) - borrowed);
          return {
            ...t,
            stock: {
              total: t.quantity_on_hand || 0,
              available,
            },
          };
        }
      });

      // Return all items (member can see all, but only borrow available ones)
      return res.status(200).json(result);
    }

    case "POST": {
      // Create loan request with specific time slots (like room/transport)
      const { 
        unit_id,           // For serialized items: specific unit
        template_id,       // For non-serialized items: template
        quantity,          // For non-serialized items: how many
        borrow_start,      // Start timestamp (datetime)
        borrow_end         // End timestamp (datetime)
      } = req.body;

      if (!borrow_start || !borrow_end) {
        return res.status(400).json({ error: "Waktu mulai dan selesai harus diisi." });
      }

      // Validate time range
      const startTime = new Date(borrow_start);
      const endTime = new Date(borrow_end);
      if (endTime <= startTime) {
        return res.status(400).json({ error: "Waktu selesai harus setelah waktu mulai." });
      }

      // Serialized loan (by unit)
      if (unit_id) {
        // Check unit availability
        const { data: unit, error: unitError } = await supabase
          .from("product_units")
          .select("id, status, template_id, asset_code, serial_number, template:product_templates!template_id(name)")
          .eq("id", unit_id)
          .single();
        
        if (unitError || !unit) {
          return res.status(404).json({ error: "Unit tidak ditemukan." });
        }

        // Check for time overlap conflict (similar to transport/room)
        const { data: conflicts } = await supabase
          .from("asset_loans")
          .select("id, borrow_start, borrow_end")
          .eq("asset_unit_id", unit_id)
          .in("status", ["Menunggu Persetujuan", "Disetujui", "Dipinjam"])
          .is("return_date", null)
          .or(`and(borrow_start.lte.${borrow_end},borrow_end.gte.${borrow_start})`);

        if (conflicts && conflicts.length > 0) {
          return res.status(409).json({ 
            error: "Sudah ada peminjaman pada rentang waktu tersebut. Silakan pilih waktu lain." 
          });
        }

        const { error: insertError } = await supabase.from("asset_loans").insert({
          asset_unit_id: unit_id,
          user_id: user.id,
          borrow_start,
          borrow_end,
          loan_date: startTime.toISOString().split('T')[0], // Keep for backwards compat
          due_date: endTime.toISOString().split('T')[0],    // Keep for backwards compat
          quantity: 1,
          status: "Menunggu Persetujuan",
        });

        if (insertError) return res.status(500).json({ error: insertError.message });

        // Send Notification
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
        const borrowerName = profile?.full_name || user.email;
        const itemName = unit.template?.name || "Unit Barang";
        const itemCode = unit.asset_code || unit.serial_number || unit_id;

        const emails = await getManagementEmails('inventory');
        await sendEmail({
          to: emails,
          subject: `Permintaan Peminjaman Barang: ${itemName}`,
          html: `
            <h3>Permintaan Peminjaman Baru</h3>
            <p><strong>Peminjam:</strong> ${borrowerName}</p>
            <p><strong>Barang:</strong> ${itemName} (${itemCode})</p>
            <p><strong>Waktu Mulai:</strong> ${startTime.toLocaleString('id-ID')}</p>
            <p><strong>Waktu Selesai:</strong> ${endTime.toLocaleString('id-ID')}</p>
            <p>Mohon cek dashboard untuk persetujuan: <a href="https://gki-management.vercel.app/#dashboard">Dashboard</a></p>
          `
        });

        return res.status(201).json({ message: "Permintaan peminjaman berhasil diajukan." });
      }

      // Non-serialized loan (by template + quantity)
      if (template_id && quantity) {
        // Check template and availability
        const { data: template, error: tmplError } = await supabase
          .from("product_templates")
          .select("id, name, is_serialized, quantity_on_hand")
          .eq("id", template_id)
          .single();

        if (tmplError || !template) {
          return res.status(404).json({ error: "Produk tidak ditemukan." });
        }
        if (template.is_serialized) {
          return res.status(400).json({ error: "Produk ini serialized, pilih unit spesifik." });
        }

        // Calculate available quantity at the requested time range
        // Get all loans that overlap with the requested time
        const { data: overlappingLoans } = await supabase
          .from("asset_loans")
          .select("quantity, borrow_start, borrow_end")
          .eq("product_template_id", template_id)
          .in("status", ["Menunggu Persetujuan", "Disetujui", "Dipinjam"])
          .is("return_date", null)
          .or(`and(borrow_start.lte.${borrow_end},borrow_end.gte.${borrow_start})`);

        const borrowedQty = (overlappingLoans || []).reduce((sum, l) => sum + (l.quantity || 0), 0);
        const availableQty = (template.quantity_on_hand || 0) - borrowedQty;

        if (quantity > availableQty) {
          return res.status(409).json({ 
            error: `Stok tidak cukup pada waktu tersebut. Tersedia: ${availableQty}, diminta: ${quantity}` 
          });
        }

        const { error: insertError } = await supabase.from("asset_loans").insert({
          product_template_id: template_id,
          user_id: user.id,
          borrow_start,
          borrow_end,
          loan_date: startTime.toISOString().split('T')[0], // Keep for backwards compat
          due_date: endTime.toISOString().split('T')[0],    // Keep for backwards compat
          quantity: quantity,
          status: "Menunggu Persetujuan",
        });

        if (insertError) return res.status(500).json({ error: insertError.message });

        // Send Notification
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
        const borrowerName = profile?.full_name || user.email;

        const emails = await getManagementEmails('inventory');
        await sendEmail({
          to: emails,
          subject: `Permintaan Peminjaman Barang: ${template.name}`,
          html: `
            <h3>Permintaan Peminjaman Baru</h3>
            <p><strong>Peminjam:</strong> ${borrowerName}</p>
            <p><strong>Barang:</strong> ${template.name} (Jumlah: ${quantity})</p>
            <p><strong>Waktu Mulai:</strong> ${startTime.toLocaleString('id-ID')}</p>
            <p><strong>Waktu Selesai:</strong> ${endTime.toLocaleString('id-ID')}</p>
            <p>Mohon cek dashboard untuk persetujuan: <a href="https://gki-management.vercel.app/#dashboard">Dashboard</a></p>
          `
        });

        return res.status(201).json({ message: "Permintaan peminjaman berhasil diajukan." });
      }

      return res.status(400).json({ error: "Tentukan unit_id atau template_id + quantity." });
    }

    default:
      res.setHeader("Allow", ["GET", "POST"]);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

// ============================================================
// ROOMS HANDLER
// ============================================================
async function handleRooms(req, res, supabase, user) {
  const serviceClient = getServiceClient();
  
  switch (req.method) {
    case "GET":
      try {
        // Get rooms with basic info
        const { data: rooms, error } = await supabase
          .from("rooms")
          .select("id, name, lokasi, kapasitas, image_url")
          .order("name", { ascending: true });
        if (error) return res.status(500).json({ error: error.message });

        // Get all room_pic entries
        let roomPics = [];
        const { data: rpData, error: rpError } = await serviceClient
          .from("room_pic")
          .select("room_id, user_id");
        if (rpError) {
          console.log("room_pic query error:", rpError.message);
        } else {
          roomPics = rpData || [];
        }

        // Get user details for PICs
        const picUserIds = [...new Set(roomPics.map(p => p.user_id))];
        let picUsers = [];
        if (picUserIds.length > 0) {
          const { data: profiles } = await serviceClient.from("profiles").select("id, full_name").in("id", picUserIds);
          picUsers = (profiles || []).map(p => ({ id: p.id, full_name: p.full_name }));
        }
        const userMap = new Map(picUsers.map(u => [u.id, u]));

        // Attach PICs to rooms
        const roomsWithPics = (rooms || []).map(room => {
          const pics = roomPics
            .filter(rp => rp.room_id === room.id)
            .map(rp => userMap.get(rp.user_id))
            .filter(Boolean);
          return { ...room, pics };
        });

        return res.status(200).json(roomsWithPics);
      } catch (err) {
        console.error("handleRooms GET error:", err);
        return res.status(500).json({ error: "Gagal memuat data ruangan: " + err.message });
      }

    case "POST":
      const { event_name, room_name, start_time, end_time } = req.body;
      if (!event_name || !room_name || !start_time || !end_time)
        return res.status(400).json({ error: "Semua field harus diisi." });

      // Check for time conflict with existing reservations
      const { data: conflicts } = await supabase
        .from("room_reservations")
        .select("id, event_name, start_time, end_time")
        .eq("room_name", room_name)
        .in("status", ["Menunggu Persetujuan", "Disetujui"])
        .or(`and(start_time.lt.${end_time},end_time.gt.${start_time})`);

      if (conflicts && conflicts.length > 0) {
        return res.status(409).json({
          error: `Waktu yang dipilih bertabrakan dengan reservasi lain (${conflicts[0].event_name}). Silakan pilih waktu lain.`,
        });
      }

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

      // Send Notification to room-specific PICs only
      // serviceClient already declared at function level
      
      // Get room ID from room name
      const { data: roomData } = await serviceClient
        .from("rooms")
        .select("id")
        .eq("name", room_name)
        .single();
      
      let roomEmails = [];
      if (roomData) {
        // Get PICs for this specific room
        const { data: roomPics } = await serviceClient
          .from("room_pic")
          .select("user_id")
          .eq("room_id", roomData.id);
        
        if (roomPics && roomPics.length > 0) {
          const picUserIds = roomPics.map(p => p.user_id);
          
          // Get emails for these users
          const { data: { users } } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
          if (users) {
            roomEmails = users
              .filter(u => picUserIds.includes(u.id))
              .map(u => u.email)
              .filter(Boolean);
          }
        }
      }
      
      const durationMs = new Date(end_time) - new Date(start_time);
      const durationHours = Math.round(durationMs / (1000 * 60 * 60));
      
      if (roomEmails.length > 0) {
        await sendEmail({
          to: roomEmails,
          subject: `Permintaan Reservasi Ruangan: ${room_name}`,
          html: `
            <h3>Permintaan Reservasi Ruangan Baru</h3>
            <p><strong>Peminjam:</strong> ${profile.full_name || user.email}</p>
            <p><strong>Ruangan:</strong> ${room_name}</p>
            <p><strong>Acara:</strong> ${event_name}</p>
            <p><strong>Waktu Mulai:</strong> ${new Date(start_time).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</p>
            <p><strong>Waktu Selesai:</strong> ${new Date(end_time).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</p>
            <p><strong>Durasi:</strong> ${durationHours} Jam</p>
            <p>Mohon cek dashboard untuk persetujuan: <a href="https://gki-management.vercel.app/#dashboard">Dashboard</a></p>
          `
        });
      }

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
  const serviceClient = getServiceClient();
  
  switch (req.method) {
    case "GET":
      try {
        // Get transportations
        const { data: transports, error } = await supabase
          .from("transportations")
          .select(`
            id,
            vehicle_name,
            plate_number,
            vehicle_year,
            odometer_km,
            capacity,
            driver_name,
            driver_whatsapp,
            notes,
            image_url
          `)
          .order("vehicle_name", { ascending: true });
        if (error) return res.status(500).json({ error: error.message });

        // Get all transport_pic entries (with error handling for table not existing)
        let transportPics = [];
        try {
          const { data: tpData, error: tpError } = await serviceClient
            .from("transport_pic")
            .select("transport_id, user_id");
          if (!tpError) {
            transportPics = tpData || [];
          }
        } catch (e) {
          // Table might not exist yet, continue without PICs
          console.log("transport_pic query error:", e.message);
        }

        // Get user details for PICs
        const picUserIds = [...new Set(transportPics.map(p => p.user_id))];
        let picUsers = [];
        if (picUserIds.length > 0) {
          const { data: profiles } = await serviceClient.from("profiles").select("id, full_name").in("id", picUserIds);
          picUsers = (profiles || []).map(p => ({ id: p.id, full_name: p.full_name }));
        }
        const userMap = new Map(picUsers.map(u => [u.id, u]));

        // Attach PICs to transports
        const transportsWithPics = (transports || []).map(transport => {
          const pics = transportPics
            .filter(tp => tp.transport_id === transport.id)
            .map(tp => userMap.get(tp.user_id))
            .filter(Boolean);
          return { ...transport, pics };
        });

        return res.status(200).json(transportsWithPics);
      } catch (err) {
        console.error("handleTransports GET error:", err);
        return res.status(500).json({ error: "Gagal memuat data transportasi: " + err.message });
      }

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

      // Send Notification to transport-specific PICs only
      const serviceClient = getServiceClient();
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      const borrowerName = profile?.full_name || user.email;
      
      const { data: transport } = await supabase.from("transportations").select("vehicle_name").eq("id", transport_id).single();
      const vehicleName = transport?.vehicle_name || "Kendaraan";
      
      const durationMs = new Date(borrow_end) - new Date(borrow_start);
      const durationHours = Math.round(durationMs / (1000 * 60 * 60));
      const durationStr = durationHours > 24 ? `${Math.round(durationHours/24)} Hari` : `${durationHours} Jam`;

      // Get PICs for this specific transport
      let transportEmails = [];
      const { data: emailTransportPics } = await serviceClient
        .from("transport_pic")
        .select("user_id")
        .eq("transport_id", transport_id);
      
      if (emailTransportPics && emailTransportPics.length > 0) {
        const picUserIds = emailTransportPics.map(p => p.user_id);
        
        // Get emails for these users
        const { data: { users } } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
        if (users) {
          transportEmails = users
            .filter(u => picUserIds.includes(u.id))
            .map(u => u.email)
            .filter(Boolean);
        }
      }

      if (transportEmails.length > 0) {
        await sendEmail({
          to: transportEmails,
          subject: `Permintaan Peminjaman Transportasi: ${vehicleName}`,
          html: `
            <h3>Permintaan Peminjaman Transportasi Baru</h3>
            <p><strong>Peminjam:</strong> ${borrowerName}</p>
            <p><strong>Kendaraan:</strong> ${vehicleName}</p>
            <p><strong>Tujuan:</strong> ${destination || '-'}</p>
            <p><strong>Keperluan:</strong> ${purpose || '-'}</p>
            <p><strong>Waktu Mulai:</strong> ${new Date(borrow_start).toLocaleString('id-ID')}</p>
            <p><strong>Waktu Selesai:</strong> ${new Date(borrow_end).toLocaleString('id-ID')}</p>
            <p><strong>Durasi:</strong> ${durationStr}</p>
            <p>Mohon cek dashboard untuk persetujuan: <a href="https://gki-management.vercel.app/#dashboard">Dashboard</a></p>
          `
        });
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

    if (requestType === "asset" || requestType === "inventory") {
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
