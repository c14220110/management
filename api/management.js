// File: /api/management.js (Versi Final dengan Penanganan Error yang Lebih Baik)

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Helper untuk verifikasi role management
async function verifyManagement(req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return { user: null, error: "Token tidak ditemukan." };

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) return { user: null, error: "Token tidak valid." };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "management")
    return { user: null, error: "Akses ditolak." };

  return { user, error: null };
}

function sanitizeSearchTerm(term = "") {
  return term.replace(/[%']/g, "").trim();
}

function createAssetCode() {
  const randomPart = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `AST-${randomPart}`;
}

async function generateUniqueAssetCode(supabase, attempt = 0) {
  if (attempt > 7) {
    throw new Error("Gagal membuat kode aset unik setelah beberapa percobaan.");
  }
  const candidate = createAssetCode();
  const { data, error } = await supabase
    .from("assets")
    .select("id")
    .eq("asset_code", candidate)
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) {
    return candidate;
  }
  return generateUniqueAssetCode(supabase, attempt + 1);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Hanya metode POST yang diizinkan" });
  }

  const { error: authError } = await verifyManagement(req);
  if (authError)
    return res.status(403).json({ error: "Access Forbidden: " + authError });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // Helper: derive status from destination location
  const deriveStatusFromDestination = (location) => {
    const code = (location?.code || "").toUpperCase();
    const type = (location?.type || "").toLowerCase();
    if (code === "BORROWED" || type === "customer") return "borrowed";
    if (code === "SCRAP" || type === "scrap") return "scrapped";
    return "available";
  };

  const { action, payload } = req.body;

  try {
    switch (action) {
      // ============================================================
      // INVENTORY - PRODUCT TEMPLATE & UNIT (SERIALIZED)
      // ============================================================
      case "getProductTemplates": {
        const { data: templates, error: tmplError } = await supabase
          .from("product_templates")
          .select(
            `
            id,
            name,
            description,
            photo_url,
            is_serialized,
            uom,
            category:asset_categories!category_id (id, name),
            default_location:stock_locations!default_location_id (id, name, code, type)
          `
          )
          .order("name", { ascending: true });
        if (tmplError) throw tmplError;

        const { data: units, error: unitError } = await supabase
          .from("product_units")
          .select("id, template_id, status");
        if (unitError) throw unitError;

        const agg = new Map();
        (units || []).forEach((u) => {
          const curr = agg.get(u.template_id) || {
            total: 0,
            available: 0,
            borrowed: 0,
            maintenance: 0,
            scrapped: 0,
            lost: 0,
          };
          curr.total += 1;
          if (u.status === "available") curr.available += 1;
          if (u.status === "borrowed") curr.borrowed += 1;
          if (u.status === "maintenance") curr.maintenance += 1;
          if (u.status === "scrapped") curr.scrapped += 1;
          if (u.status === "lost") curr.lost += 1;
          agg.set(u.template_id, curr);
        });

        const result = (templates || []).map((t) => ({
          ...t,
          stock: agg.get(t.id) || {
            total: 0,
            available: 0,
            borrowed: 0,
            maintenance: 0,
            scrapped: 0,
            lost: 0,
          },
        }));

        return res.status(200).json(result);
      }

      case "getProductUnits": {
        const { templateId } = payload || {};
        if (!templateId)
          throw new Error("templateId dibutuhkan untuk melihat unit.");

        const { data: units, error: unitError } = await supabase
          .from("product_units")
          .select(
            `
            id,
            serial_number,
            asset_code,
            status,
            condition,
            purchase_date,
            purchase_price,
            vendor_name,
            book_value,
            notes,
            location:stock_locations!location_id (id, name, code, type),
            template_id
          `
          )
          .eq("template_id", templateId)
          .order("created_at", { ascending: true });
        if (unitError) throw unitError;

        return res.status(200).json(units || []);
      }

      case "createProductTemplate": {
        const {
          name,
          description,
          category_id,
          photo_url,
          default_location_id,
          is_serialized = true,
          uom = "unit",
        } = payload || {};

        if (!name) throw new Error("Nama produk wajib diisi.");

        const { data, error } = await supabase
          .from("product_templates")
          .insert({
            name,
            description: description || null,
            category_id: category_id || null,
            photo_url: photo_url || null,
            default_location_id: default_location_id || null,
            is_serialized: !!is_serialized,
            uom: uom || "unit",
          })
          .select()
          .single();
        if (error) throw error;

        return res
          .status(201)
          .json({ message: "Produk berhasil dibuat.", template: data });
      }

      case "createProductUnit": {
        const {
          template_id,
          serial_number,
          asset_code,
          status = "available",
          condition,
          location_id,
          purchase_date,
          purchase_price,
          vendor_name,
          book_value,
          depreciation_method = "straight_line",
          salvage_value,
          useful_life_months,
          notes,
        } = payload || {};

        if (!template_id) throw new Error("template_id wajib diisi.");

        const insertPayload = {
          template_id,
          serial_number: serial_number || null,
          asset_code: asset_code || null,
          status,
          condition: condition || null,
          location_id: location_id || null,
          purchase_date: purchase_date || null,
          purchase_price:
            purchase_price === undefined || purchase_price === null
              ? null
              : Number(purchase_price),
          vendor_name: vendor_name || null,
          book_value:
            book_value === undefined || book_value === null
              ? null
              : Number(book_value),
          depreciation_method,
          salvage_value:
            salvage_value === undefined || salvage_value === null
              ? null
              : Number(salvage_value),
          useful_life_months:
            useful_life_months === undefined || useful_life_months === null
              ? null
              : Number(useful_life_months),
          notes: notes || null,
        };

        const { data, error } = await supabase
          .from("product_units")
          .insert(insertPayload)
          .select()
          .single();
        if (error) throw error;

        return res
          .status(201)
          .json({ message: "Unit berhasil dibuat.", unit: data });
      }

      case "getStockLocations": {
        const { data, error } = await supabase
          .from("stock_locations")
          .select("id, name, code, type")
          .order("name", { ascending: true });
        if (error) throw error;
        return res.status(200).json(data || []);
      }

      case "createCategory": {
        const { name, description, parent_id } = payload || {};
        if (!name) throw new Error("Nama kategori wajib diisi.");
        const { data, error } = await supabase
          .from("asset_categories")
          .insert({
            name,
            description: description || null,
            parent_id: parent_id || null,
          })
          .select()
          .single();
        if (error) throw error;
        return res
          .status(201)
          .json({ message: "Kategori berhasil dibuat.", category: data });
      }

      case "createStockMove": {
        const {
          source_location_id,
          dest_location_id,
          move_type,
          partner_name,
          notes,
          unitIds,
        } = payload || {};

        if (!source_location_id || !dest_location_id)
          throw new Error("Source dan destination lokasi wajib diisi.");
        if (source_location_id === dest_location_id)
          throw new Error("Source dan destination tidak boleh sama.");
        if (!Array.isArray(unitIds) || unitIds.length === 0)
          throw new Error("Daftar unit yang dipindahkan wajib diisi.");

        const { data: destLoc, error: destErr } = await supabase
          .from("stock_locations")
          .select("id, code, type")
          .eq("id", dest_location_id)
          .single();
        if (destErr || !destLoc)
          throw new Error("Lokasi tujuan tidak ditemukan.");

        const derivedStatus = deriveStatusFromDestination(destLoc);

        const { data: move, error: moveErr } = await supabase
          .from("stock_moves")
          .insert({
            source_location_id,
            dest_location_id,
            move_type: move_type || "internal",
            partner_name: partner_name || null,
            notes: notes || null,
          })
          .select()
          .single();
        if (moveErr) throw moveErr;

        const moveItemsPayload = unitIds.map((id) => ({
          move_id: move.id,
          product_unit_id: id,
        }));
        const { error: itemsErr } = await supabase
          .from("stock_move_items")
          .insert(moveItemsPayload);
        if (itemsErr) throw itemsErr;

        const { error: updateErr } = await supabase
          .from("product_units")
          .update({
            location_id: dest_location_id,
            status: derivedStatus,
          })
          .in("id", unitIds);
        if (updateErr) throw updateErr;

        return res.status(201).json({
          message: "Stock move berhasil dicatat.",
          move,
          derivedStatus,
        });
      }

      // Aksi dari pending-requests.js
      case "getPendingRequests":
        const { data: pendingAssetLoans } = await supabase
          .from("asset_loans")
          .select("*, assets(asset_name), profiles(full_name)")
          .eq("status", "Menunggu Persetujuan")
          .order("loan_date", { ascending: true });
        const { data: pendingRoomReservations } = await supabase
          .from("room_reservations")
          .select("*")
          .eq("status", "Menunggu Persetujuan")
          .order("start_time", { ascending: true });
        return res
          .status(200)
          .json({ pendingAssetLoans, pendingRoomReservations });

      // Aksi dari update-loan-status.js
      case "updateLoanStatus":
        const { loanId, newStatus } = payload;
        const { data: updatedLoan, error: loanError } = await supabase
          .from("asset_loans")
          .update({ status: newStatus })
          .eq("id", loanId)
          .select()
          .single();
        if (loanError) throw loanError;
        if (newStatus === "Disetujui" || newStatus === "Dipinjam") {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", updatedLoan.user_id)
            .single();
          await supabase
            .from("assets")
            .update({
              status: "Dipinjam",
              borrower_name: profile.full_name || "N/A",
            })
            .eq("id", updatedLoan.asset_id);
        } else if (newStatus === "Dikembalikan" || newStatus === "Ditolak") {
          await supabase
            .from("assets")
            .update({ status: "Tersedia", borrower_name: null })
            .eq("id", updatedLoan.asset_id);
        }
        return res
          .status(200)
          .json({ message: `Peminjaman berhasil diubah menjadi ${newStatus}` });

      // Aksi dari update-reservation-status.js
      case "updateReservationStatus":
        const { reservationId, newStatus: newReservationStatus } = payload;
        await supabase
          .from("room_reservations")
          .update({ status: newReservationStatus })
          .eq("id", reservationId);
        return res.status(200).json({
          message: `Reservasi berhasil diubah menjadi ${newReservationStatus}`,
        });

      // ============================================================
      // ASSET MANAGEMENT ACTIONS
      // ============================================================
      case "getAssets": {
        const searchTerm = sanitizeSearchTerm(payload?.search || "");
        const assetId = payload?.assetId || null;
        let query = supabase
          .from("assets")
          .select(
            `
            *,
            commission:commissions!commission_id (id, name),
            category:asset_categories!category_id (id, name)
          `
          )
          .order("asset_name", { ascending: true });

        if (assetId) {
          query = query.eq("id", assetId);
        }

        if (searchTerm) {
          query = query.or(
            [
              `asset_name.ilike.%${searchTerm}%`,
              `asset_code.ilike.%${searchTerm}%`,
              `condition.ilike.%${searchTerm}%`,
              `storage_location.ilike.%${searchTerm}%`,
              `status.ilike.%${searchTerm}%`,
            ].join(",")
          );
        }

        const { data, error } = await query;
        if (error) throw error;
        return res.status(200).json(data || []);
      }

      case "getAssetMeta": {
        const [
          { data: commissions, error: commissionError },
          { data: categories, error: categoryError },
        ] = await Promise.all([
          supabase
            .from("commissions")
            .select("id, name")
            .order("name", { ascending: true }),
          supabase
            .from("asset_categories")
            .select("id, name")
            .order("name", { ascending: true }),
        ]);
        if (commissionError) throw commissionError;
        if (categoryError) throw categoryError;
        return res.status(200).json({
          commissions: commissions || [],
          categories: categories || [],
        });
      }

      case "createAsset": {
        const {
          asset_name,
          commission_id,
          storage_location,
          quantity,
          category_id,
          condition,
          photo_url,
          description,
          status,
        } = payload || {};

        if (!asset_name) {
          throw new Error("Nama barang wajib diisi.");
        }

        const assetCode = await generateUniqueAssetCode(supabase);

        const insertPayload = {
          asset_name,
          commission_id: commission_id || null,
          storage_location: storage_location || null,
          location: storage_location || null,
          quantity: typeof quantity === "number" && quantity > 0 ? quantity : 1,
          category_id: category_id || null,
          condition: condition || null,
          photo_url: photo_url || null,
          description: description || null,
          status: status || "Tersedia",
          asset_code: assetCode,
        };

        const { data, error } = await supabase
          .from("assets")
          .insert(insertPayload)
          .select()
          .single();

        if (error) throw error;

        return res.status(201).json({
          message: "Barang berhasil ditambahkan.",
          asset: data,
        });
      }

      case "updateAsset": {
        const { assetId, ...fields } = payload || {};
        if (!assetId) throw new Error("ID barang dibutuhkan.");

        const updatePayload = {};
        if (fields.asset_name !== undefined)
          updatePayload.asset_name = fields.asset_name;
        if (fields.commission_id !== undefined)
          updatePayload.commission_id = fields.commission_id || null;
        if (fields.storage_location !== undefined) {
          updatePayload.storage_location = fields.storage_location || null;
          updatePayload.location = fields.storage_location || null;
        }
        if (fields.quantity !== undefined) {
          const qty = parseInt(fields.quantity, 10);
          updatePayload.quantity = Number.isNaN(qty) || qty < 0 ? 0 : qty;
        }
        if (fields.category_id !== undefined)
          updatePayload.category_id = fields.category_id || null;
        if (fields.condition !== undefined)
          updatePayload.condition = fields.condition || null;
        if (fields.photo_url !== undefined)
          updatePayload.photo_url = fields.photo_url || null;
        if (fields.description !== undefined)
          updatePayload.description = fields.description || null;
        if (fields.status !== undefined) updatePayload.status = fields.status;

        if (fields.asset_code) {
          updatePayload.asset_code = fields.asset_code;
        }

        const { error } = await supabase
          .from("assets")
          .update(updatePayload)
          .eq("id", assetId);
        if (error) throw error;

        return res
          .status(200)
          .json({ message: "Data barang berhasil diperbarui." });
      }

      case "setAssetStatus": {
        const { assetId, status: newStatus } = payload || {};
        if (!assetId || !newStatus)
          throw new Error("ID barang dan status baru dibutuhkan.");
        const { error } = await supabase
          .from("assets")
          .update({ status: newStatus })
          .eq("id", assetId);
        if (error) throw error;
        return res
          .status(200)
          .json({ message: "Status barang berhasil diperbarui." });
      }

      case "deleteAsset": {
        const { assetId } = payload || {};
        if (!assetId) throw new Error("ID barang dibutuhkan.");
        const { error } = await supabase
          .from("assets")
          .delete()
          .eq("id", assetId);
        if (error) throw error;
        return res.status(200).json({ message: "Barang berhasil dihapus." });
      }

      // GANTI CASE LAMA DENGAN VERSI INI
      case "getUsers":
        const {
          data: { users },
          error: listError,
        } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;

        const { data: profiles } = await supabase.from("profiles").select("*");

        const usersWithProfiles = users.map((user) => {
          const profile = profiles.find((p) => p.id === user.id);
          // Gabungkan data auth dan profile, pastikan ada fallback jika profil belum ada
          return {
            ...user,
            full_name: profile?.full_name,
            role: profile?.role || "member",
          };
        });

        // Sekarang kita kembalikan SEMUA user, biarkan frontend yang menyaring
        return res.status(200).json(usersWithProfiles);

      case "createUser":
        const { fullName, email, password } = payload;
        const {
          data: { user: newUser },
          error: createError,
        } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { role: "member", full_name: fullName },
        });
        if (createError) throw createError;
        return res.status(201).json({
          message: "User member baru berhasil dibuat.",
          user: newUser,
        });

      case "updateUser":
        const { userId, ...updateData } = payload;
        const authUpdate = {};
        if (updateData.email) authUpdate.email = updateData.email;
        if (updateData.password) authUpdate.password = updateData.password;

        const profileUpdate = {};
        if (updateData.fullName) profileUpdate.full_name = updateData.fullName;

        if (Object.keys(authUpdate).length > 0) {
          const { error: authUpdateError } =
            await supabase.auth.admin.updateUserById(userId, authUpdate);
          if (authUpdateError) throw authUpdateError;
        }
        if (Object.keys(profileUpdate).length > 0) {
          const { error: profileUpdateError } = await supabase
            .from("profiles")
            .update(profileUpdate)
            .eq("id", userId);
          if (profileUpdateError) throw profileUpdateError;
        }
        return res
          .status(200)
          .json({ message: "Data user berhasil diperbarui." });

      case "deleteUser":
        const { userId: deleteId } = payload;
        const { error: deleteError } = await supabase.auth.admin.deleteUser(
          deleteId
        );
        if (deleteError) throw deleteError;
        return res.status(200).json({ message: "User berhasil dihapus." });

      // BARU: Aksi untuk Manajemen Ruangan
      case "getRooms":
        // Ambil data ruangan dan gabungkan dengan nama penanggung jawab dari profiles
        const { data: rooms, error: getRoomsError } = await supabase.from(
          "rooms"
        ).select(`
            id,
            name,
            lokasi,
            kapasitas,
            penanggung_jawab: profiles (id, full_name)
          `);
        if (getRoomsError) throw getRoomsError;
        return res.status(200).json(rooms);

      case "createRoom":
        const { name, lokasi, kapasitas, penanggung_jawab_id } = payload;
        const { error: createRoomError } = await supabase
          .from("rooms")
          .insert({ name, lokasi, kapasitas, penanggung_jawab_id });
        if (createRoomError) throw createRoomError;
        return res
          .status(201)
          .json({ message: "Ruangan baru berhasil dibuat." });

      case "updateRoom":
        const { roomId, ...updateRoomData } = payload;
        const { error: updateRoomError } = await supabase
          .from("rooms")
          .update(updateRoomData)
          .eq("id", roomId);
        if (updateRoomError) throw updateRoomError;
        return res
          .status(200)
          .json({ message: "Data ruangan berhasil diperbarui." });

      case "deleteRoom":
        const { roomId: deleteRoomId } = payload;
        const { error: deleteRoomError } = await supabase
          .from("rooms")
          .delete()
          .eq("id", deleteRoomId);
        if (deleteRoomError) throw deleteRoomError;
        return res.status(200).json({ message: "Ruangan berhasil dihapus." });

      // ============================================================
      // TRANSPORTATION MANAGEMENT ACTIONS
      // ============================================================

      case "getTransportations":
        const { data: transports, error: getTransError } = await supabase
          .from("transportations")
          .select(
            `
            *,
            person_in_charge:profiles!person_in_charge_id (id, full_name)
          `
          )
          .order("vehicle_name", { ascending: true });
        if (getTransError) throw getTransError;
        return res.status(200).json(transports);

      case "createTransportation":
        const {
          vehicle_name,
          plate_number,
          vehicle_year,
          odometer_km,
          capacity,
          person_in_charge_id,
          driver_name,
          driver_whatsapp,
          last_service_at,
          next_service_at,
          notes,
          image_url,
        } = payload;

        const { error: createTransError } = await supabase
          .from("transportations")
          .insert({
            vehicle_name,
            plate_number,
            vehicle_year: vehicle_year || new Date().getFullYear(),
            odometer_km: odometer_km || 0,
            capacity: capacity || 1,
            person_in_charge_id,
            driver_name: driver_name || null,
            driver_whatsapp: driver_whatsapp || null,
            last_service_at: last_service_at || null,
            next_service_at: next_service_at || null,
            notes: notes || null,
            image_url: image_url || null,
          });
        if (createTransError) throw createTransError;
        return res
          .status(201)
          .json({ message: "Transportasi baru berhasil ditambahkan." });

      case "updateTransportation":
        const { transportId, ...updateTransData } = payload;
        const { error: updateTransError } = await supabase
          .from("transportations")
          .update(updateTransData)
          .eq("id", transportId);
        if (updateTransError) throw updateTransError;
        return res
          .status(200)
          .json({ message: "Data transportasi berhasil diperbarui." });

      case "deleteTransportation":
        const { transportId: deleteTransId } = payload;
        const { error: deleteTransError } = await supabase
          .from("transportations")
          .delete()
          .eq("id", deleteTransId);
        if (deleteTransError) throw deleteTransError;
        return res
          .status(200)
          .json({ message: "Transportasi berhasil dihapus." });

      case "getPendingTransportLoans":
        const { data: pendingTransLoans, error: pendingTransError } =
          await supabase
            .from("transport_loans")
            .select(
              `
              *,
              transportations (vehicle_name, plate_number),
              profiles!borrower_id (full_name)
            `
            )
            .eq("status", "Menunggu Persetujuan")
            .order("borrow_start", { ascending: true });
        if (pendingTransError) throw pendingTransError;
        return res.status(200).json(pendingTransLoans);

      case "updateTransportLoanStatus":
        const { loanId: transLoanId, newStatus: transLoanStatus } = payload;
        const { error: updateTransLoanError } = await supabase
          .from("transport_loans")
          .update({ status: transLoanStatus })
          .eq("id", transLoanId);
        if (updateTransLoanError) throw updateTransLoanError;
        return res.status(200).json({
          message: `Peminjaman transportasi berhasil diubah menjadi ${transLoanStatus}`,
        });

      default:
        return res.status(400).json({ error: "Aksi tidak dikenal" });
    }
  } catch (error) {
    // ===== PERBAIKAN UTAMA ADA DI BLOK CATCH INI =====
    // Cek secara spesifik jika error adalah karena user sudah ada
    if (
      error.message &&
      (error.message.includes("User already registered") ||
        error.message.includes(
          "duplicate key value violates unique constraint"
        ))
    ) {
      // Kirim status 409 Conflict dengan pesan yang lebih ramah
      return res
        .status(409)
        .json({ error: "Email ini sudah terpakai oleh pengguna lain." });
    }

    // Jika error lain, kirim pesan error server umum
    return res.status(500).json({
      error: "Terjadi kesalahan di server manajemen.",
      details: error.message,
    });
  }
}
