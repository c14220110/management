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
      // Create loan request
      const { 
        unit_id,           // For serialized items: specific unit
        template_id,       // For non-serialized items: template
        quantity,          // For non-serialized items: how many
        loan_date, 
        due_date 
      } = req.body;

      if (!loan_date || !due_date) {
        return res.status(400).json({ error: "Tanggal pinjam dan tanggal kembali harus diisi." });
      }

      // Serialized loan (by unit)
      if (unit_id) {
        // Check unit availability
        const { data: unit, error: unitError } = await supabase
          .from("product_units")
          .select("id, status, template_id")
          .eq("id", unit_id)
          .single();
        
        if (unitError || !unit) {
          return res.status(404).json({ error: "Unit tidak ditemukan." });
        }
        if (unit.status !== "available") {
          return res.status(409).json({ error: "Unit sedang tidak tersedia." });
        }

        // Check for time conflict
        const { data: conflicts } = await supabase
          .from("asset_loans")
          .select("id")
          .eq("asset_unit_id", unit_id)
          .in("status", ["Menunggu Persetujuan", "Disetujui", "Dipinjam"])
          .is("return_date", null);

        if (conflicts && conflicts.length > 0) {
          return res.status(409).json({ error: "Unit ini sudah ada peminjaman aktif." });
        }

        const { error: insertError } = await supabase.from("asset_loans").insert({
          asset_unit_id: unit_id,
          user_id: user.id,
          loan_date,
          due_date,
          quantity: 1,
          status: "Menunggu Persetujuan",
        });

        if (insertError) return res.status(500).json({ error: insertError.message });

        // Send Notification
        // Send Notification
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
        const borrowerName = profile?.full_name || user.email;
        const itemName = unit.template?.name || "Unit Barang"; // Need to fetch template name if not available in unit object
        // Actually unit object above selects template_id, not joined template.
        // I should fetch template name or just say "Unit ID: ..."
        // Better: Fetch unit with template name.
        
        const emails = await getManagementEmails('inventory');
        await sendEmail({
          to: emails,
          subject: `Permintaan Peminjaman Barang: ${itemName}`,
          html: `
            <h3>Permintaan Peminjaman Baru</h3>
            <p><strong>Peminjam:</strong> ${borrowerName}</p>
            <p><strong>Barang:</strong> Unit ID ${unit_id}</p>
            <p><strong>Tanggal Pinjam:</strong> ${new Date(loan_date).toLocaleDateString('id-ID')}</p>
            <p><strong>Tanggal Kembali:</strong> ${new Date(due_date).toLocaleDateString('id-ID')}</p>
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
          .select("id, is_serialized, quantity_on_hand")
          .eq("id", template_id)
          .single();

        if (tmplError || !template) {
          return res.status(404).json({ error: "Produk tidak ditemukan." });
        }
        if (template.is_serialized) {
          return res.status(400).json({ error: "Produk ini serialized, pilih unit spesifik." });
        }

        // Calculate available quantity
        const { data: activeLoans } = await supabase
          .from("asset_loans")
          .select("quantity")
          .eq("product_template_id", template_id)
          .in("status", ["Disetujui", "Dipinjam"])
          .is("return_date", null);

        const borrowedQty = (activeLoans || []).reduce((sum, l) => sum + (l.quantity || 0), 0);
        const availableQty = (template.quantity_on_hand || 0) - borrowedQty;

        if (quantity > availableQty) {
          return res.status(409).json({ 
            error: `Stok tidak cukup. Tersedia: ${availableQty}, diminta: ${quantity}` 
          });
        }

        const { error: insertError } = await supabase.from("asset_loans").insert({
          product_template_id: template_id,
          user_id: user.id,
          loan_date,
          due_date,
          quantity: quantity,
          status: "Menunggu Persetujuan",
        });

        if (insertError) return res.status(500).json({ error: insertError.message });

        // Send Notification
        // Send Notification
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
        const borrowerName = profile?.full_name || user.email;
        const itemName = template.name || "Barang"; // template object above selects name? No, selects id, is_serialized, quantity_on_hand.
        // Need to fetch name.
        const { data: tmplDetails } = await supabase.from("product_templates").select("name").eq("id", template_id).single();
        const realItemName = tmplDetails?.name || "Barang";

        const emails = await getManagementEmails('inventory');
        await sendEmail({
          to: emails,
          subject: `Permintaan Peminjaman Barang: ${realItemName}`,
          html: `
            <h3>Permintaan Peminjaman Baru</h3>
            <p><strong>Peminjam:</strong> ${borrowerName}</p>
            <p><strong>Barang:</strong> ${realItemName} (Jumlah: ${quantity})</p>
            <p><strong>Tanggal Pinjam:</strong> ${new Date(loan_date).toLocaleDateString('id-ID')}</p>
            <p><strong>Tanggal Kembali:</strong> ${new Date(due_date).toLocaleDateString('id-ID')}</p>
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
  switch (req.method) {
    case "GET":
      const { data, error } = await supabase
        .from("rooms")
        .select("name, lokasi, kapasitas, image_url")
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

      // Send Notification
      // Send Notification
      const roomEmails = await getManagementEmails('room');
      const durationMs = new Date(end_time) - new Date(start_time);
      const durationHours = Math.round(durationMs / (1000 * 60 * 60));
      
      await sendEmail({
        to: roomEmails,
        subject: `Permintaan Reservasi Ruangan: ${room_name}`,
        html: `
          <h3>Permintaan Reservasi Ruangan Baru</h3>
          <p><strong>Peminjam:</strong> ${profile.full_name || user.email}</p>
          <p><strong>Ruangan:</strong> ${room_name}</p>
          <p><strong>Acara:</strong> ${event_name}</p>
          <p><strong>Waktu Mulai:</strong> ${new Date(start_time).toLocaleString('id-ID')}</p>
          <p><strong>Waktu Selesai:</strong> ${new Date(end_time).toLocaleString('id-ID')}</p>
          <p><strong>Durasi:</strong> ${durationHours} Jam</p>
          <p>Mohon cek dashboard untuk persetujuan: <a href="https://gki-management.vercel.app/#dashboard">Dashboard</a></p>
        `
      });

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

      // Send Notification
      // Send Notification
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      const borrowerName = profile?.full_name || user.email;
      
      const { data: transport } = await supabase.from("transportations").select("vehicle_name").eq("id", transport_id).single();
      const vehicleName = transport?.vehicle_name || "Kendaraan";
      
      const durationMs = new Date(borrow_end) - new Date(borrow_start);
      const durationHours = Math.round(durationMs / (1000 * 60 * 60));
      const durationStr = durationHours > 24 ? `${Math.round(durationHours/24)} Hari` : `${durationHours} Jam`;

      const transportEmails = await getManagementEmails('transport');
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
