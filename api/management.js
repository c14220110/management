// File: /api/management.js (Versi dengan Inventory System Baru)

import { createClient } from "@supabase/supabase-js";

// Helper untuk verifikasi role management
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
    .select("role, privileges")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "management")
    return { user: null, error: "Akses ditolak." };

  return { user, profile, error: null };
}

// Helper untuk cek privilege
function checkPrivilege(profile, requiredPrivilege) {
  // Jika privileges null/undefined, anggap full access (backward compatibility / super admin)
  // Atau jika privileges array kosong, berarti tidak punya akses apa-apa?
  // Mari kita buat default: jika null -> full access. Jika array -> cek isi.
  if (!profile.privileges) return true; 
  if (Array.isArray(profile.privileges) && profile.privileges.includes(requiredPrivilege)) return true;
  return false;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Hanya metode POST yang diizinkan" });
  }

  const { user, profile, error: authError } = await verifyManagement(req);
  if (authError)
    return res.status(403).json({ error: "Access Forbidden: " + authError });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const { action, payload } = req.body;

  try {
    switch (action) {
      // ============================================================
      // INVENTORY - PRODUCT TEMPLATE & UNITS
      // ============================================================
      case "getProductTemplates": {
        if (!checkPrivilege(profile, "inventory")) throw new Error("Akses ditolak: Butuh privilege 'inventory'");
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
            quantity_on_hand,
            min_quantity,
            category:asset_categories!category_id (id, name, code),
            default_location:stock_locations!default_location_id (id, name, code, type, commission_id)
          `
          )
          .order("name", { ascending: true });
        if (tmplError) throw tmplError;

        // Untuk serialized items, hitung stock dari product_units
        const { data: units, error: unitError } = await supabase
          .from("product_units")
          .select("id, template_id, status");
        if (unitError) throw unitError;

        // Hitung stock per template untuk serialized
        const serializedStock = new Map();
        (units || []).forEach((u) => {
          const curr = serializedStock.get(u.template_id) || {
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
          serializedStock.set(u.template_id, curr);
        });

        // Hitung borrowed quantity untuk non-serialized dari asset_loans
        const { data: activeLoans, error: loansError } = await supabase
          .from("asset_loans")
          .select("product_template_id, quantity")
          .not("product_template_id", "is", null)
          .in("status", ["Disetujui", "Dipinjam"])
          .is("return_date", null);
        if (loansError) throw loansError;

        const borrowedQty = new Map();
        (activeLoans || []).forEach((loan) => {
          const curr = borrowedQty.get(loan.product_template_id) || 0;
          borrowedQty.set(loan.product_template_id, curr + (loan.quantity || 0));
        });

        const result = (templates || []).map((t) => {
          if (t.is_serialized) {
            // Serialized: stock dari product_units
            return {
              ...t,
              stock: serializedStock.get(t.id) || {
                total: 0,
                available: 0,
                borrowed: 0,
                maintenance: 0,
                scrapped: 0,
                lost: 0,
              },
            };
          } else {
            // Non-serialized: stock dari quantity_on_hand
            const borrowed = borrowedQty.get(t.id) || 0;
            const available = Math.max(0, (t.quantity_on_hand || 0) - borrowed);
            return {
              ...t,
              stock: {
                total: t.quantity_on_hand || 0,
                available,
                borrowed,
                maintenance: 0,
                scrapped: 0,
                lost: 0,
              },
            };
          }
        });

        return res.status(200).json(result);
      }

      case "getProductUnits": {
        if (!checkPrivilege(profile, "inventory")) throw new Error("Akses ditolak: Butuh privilege 'inventory'");
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
        if (!checkPrivilege(profile, "inventory")) throw new Error("Akses ditolak: Butuh privilege 'inventory'");
        const {
          name,
          description,
          category_id,
          photo_url,
          default_location_id,
          is_serialized = true,
          uom = "unit",
          quantity_on_hand = 0,
          min_quantity = 0,
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
            quantity_on_hand: is_serialized ? 0 : (quantity_on_hand || 0),
            min_quantity: min_quantity || 0,
          })
          .select()
          .single();
        if (error) throw error;

        return res
          .status(201)
          .json({ message: "Produk berhasil dibuat.", template: data });
      }

      case "updateProductTemplate": {
        if (!checkPrivilege(profile, "inventory")) throw new Error("Akses ditolak: Butuh privilege 'inventory'");
        const { id, ...fields } = payload || {};
        if (!id) throw new Error("ID template wajib diisi.");
        
        const updatePayload = {};
        [
          "name",
          "description",
          "category_id",
          "photo_url",
          "default_location_id",
          "is_serialized",
          "uom",
          "quantity_on_hand",
          "min_quantity",
        ].forEach((k) => {
          if (fields[k] !== undefined) updatePayload[k] = fields[k];
        });
        
        const { data, error } = await supabase
          .from("product_templates")
          .update(updatePayload)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return res
          .status(200)
          .json({ message: "Produk berhasil diperbarui.", template: data });
      }

      case "adjustProductQuantity": {
        if (!checkPrivilege(profile, "inventory")) throw new Error("Akses ditolak: Butuh privilege 'inventory'");
        // Untuk adjust quantity non-serialized items
        const { templateId, adjustment, notes } = payload || {};
        if (!templateId) throw new Error("Template ID wajib diisi.");
        if (adjustment === undefined || adjustment === 0) 
          throw new Error("Adjustment quantity wajib diisi.");

        // Get current quantity
        const { data: template, error: getError } = await supabase
          .from("product_templates")
          .select("quantity_on_hand, is_serialized")
          .eq("id", templateId)
          .single();
        if (getError) throw getError;

        if (template.is_serialized) {
          throw new Error("Tidak bisa adjust quantity untuk produk serialized. Gunakan unit management.");
        }

        const newQuantity = Math.max(0, (template.quantity_on_hand || 0) + adjustment);

        const { error: updateError } = await supabase
          .from("product_templates")
          .update({ quantity_on_hand: newQuantity })
          .eq("id", templateId);
        if (updateError) throw updateError;

        return res.status(200).json({ 
          message: `Stok berhasil ${adjustment > 0 ? 'ditambah' : 'dikurangi'}. Stok baru: ${newQuantity}`,
          newQuantity 
        });
      }

      case "deleteProductTemplate": {
        if (!checkPrivilege(profile, "inventory")) throw new Error("Akses ditolak: Butuh privilege 'inventory'");
        const { templateId } = payload || {};
        if (!templateId) throw new Error("Template ID wajib diisi.");

        // Check if there are units
        const { data: units } = await supabase
          .from("product_units")
          .select("id")
          .eq("template_id", templateId)
          .limit(1);

        if (units && units.length > 0) {
          throw new Error("Tidak bisa menghapus produk yang masih memiliki unit. Hapus semua unit terlebih dahulu.");
        }

        const { error } = await supabase
          .from("product_templates")
          .delete()
          .eq("id", templateId);
        if (error) throw error;

        return res.status(200).json({ message: "Produk berhasil dihapus." });
      }

      case "createProductUnit": {
        if (!checkPrivilege(profile, "inventory")) throw new Error("Akses ditolak: Butuh privilege 'inventory'");
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

      case "updateProductUnit": {
        if (!checkPrivilege(profile, "inventory")) throw new Error("Akses ditolak: Butuh privilege 'inventory'");
        const { unitId, ...fields } = payload || {};
        if (!unitId) throw new Error("Unit ID wajib diisi.");

        const updatePayload = {};
        [
          "serial_number",
          "asset_code",
          "status",
          "condition",
          "location_id",
          "purchase_date",
          "purchase_price",
          "vendor_name",
          "notes",
        ].forEach((k) => {
          if (fields[k] !== undefined) updatePayload[k] = fields[k];
        });

        const { data, error } = await supabase
          .from("product_units")
          .update(updatePayload)
          .eq("id", unitId)
          .select()
          .single();
        if (error) throw error;

        return res.status(200).json({ message: "Unit berhasil diperbarui.", unit: data });
      }

      case "deleteProductUnit": {
        if (!checkPrivilege(profile, "inventory")) throw new Error("Akses ditolak: Butuh privilege 'inventory'");
        const { unitId } = payload || {};
        if (!unitId) throw new Error("Unit ID wajib diisi.");

        // Check if unit is borrowed
        const { data: activeLoans } = await supabase
          .from("asset_loans")
          .select("id")
          .eq("asset_unit_id", unitId)
          .in("status", ["Disetujui", "Dipinjam"])
          .is("return_date", null)
          .limit(1);

        if (activeLoans && activeLoans.length > 0) {
          throw new Error("Tidak bisa menghapus unit yang sedang dipinjam.");
        }

        const { error } = await supabase
          .from("product_units")
          .delete()
          .eq("id", unitId);
        if (error) throw error;

        return res.status(200).json({ message: "Unit berhasil dihapus." });
      }

      case "getStockLocations": {
        if (!checkPrivilege(profile, "inventory")) throw new Error("Akses ditolak: Butuh privilege 'inventory'");
        const { data, error } = await supabase
          .from("stock_locations")
          .select(`
            id, 
            name, 
            code, 
            type,
            commission:commissions!commission_id (id, name, code)
          `)
          .order("name", { ascending: true });
        if (error) throw error;
        return res.status(200).json(data || []);
      }

      case "findUnitByCode": {
        if (!checkPrivilege(profile, "inventory")) throw new Error("Akses ditolak: Butuh privilege 'inventory'");
        const { code } = payload || {};
        if (!code) throw new Error("Kode atau serial wajib diisi.");
        const { data, error } = await supabase
          .from("product_units")
          .select(
            `
            id,
            asset_code,
            serial_number,
            status,
            template_id,
            template:product_templates!inner (
              id,
              name,
              category_id,
              default_location_id,
              is_serialized,
              uom,
              photo_url
            )
          `
          )
          .or([`asset_code.eq.${code}`, `serial_number.eq.${code}`].join(","))
          .limit(1)
          .single();
        if (error) throw error;
        return res.status(200).json(data);
      }

      case "createStockLocation": {
        if (!checkPrivilege(profile, "inventory")) throw new Error("Akses ditolak: Butuh privilege 'inventory'");
        const { name, code, type, parent_id, description, commission_id } = payload || {};
        if (!name) throw new Error("Nama lokasi wajib diisi.");
        if (!type)
          throw new Error(
            "Tipe lokasi wajib diisi (internal/customer/vendor/scrap)."
          );
        const { data, error } = await supabase
          .from("stock_locations")
          .insert({
            name,
            code: code || null,
            type,
            parent_id: parent_id || null,
            description: description || null,
            commission_id: commission_id || null,
          })
          .select()
          .single();
        if (error) throw error;
        return res
          .status(201)
          .json({ message: "Lokasi berhasil dibuat.", location: data });
      }

      case "createCategory": {
        if (!checkPrivilege(profile, "inventory")) throw new Error("Akses ditolak: Butuh privilege 'inventory'");
        const { name, code, description, parent_id } = payload || {};
        if (!name) throw new Error("Nama kategori wajib diisi.");
        const { data, error } = await supabase
          .from("asset_categories")
          .insert({
            name,
            code: code || null,
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

      case "getAssetMeta": {
        if (!checkPrivilege(profile, "inventory")) throw new Error("Akses ditolak: Butuh privilege 'inventory'");
        const [
          { data: commissions, error: commissionError },
          { data: categories, error: categoryError },
          { data: locations, error: locationError },
        ] = await Promise.all([
          supabase
            .from("commissions")
            .select("id, name, code")
            .order("name", { ascending: true }),
          supabase
            .from("asset_categories")
            .select("id, name, code")
            .order("name", { ascending: true }),
          supabase
            .from("stock_locations")
            .select("id, name, code, type, commission_id")
            .order("name", { ascending: true }),
        ]);
        if (commissionError) throw commissionError;
        if (categoryError) throw categoryError;
        if (locationError) throw locationError;
        return res.status(200).json({
          commissions: commissions || [],
          categories: categories || [],
          locations: locations || [],
        });
      }

      // ============================================================
      // ASSET LOANS MANAGEMENT
      // ============================================================
      case "updateLoanStatus": {
        if (!checkPrivilege(profile, "transport")) throw new Error("Akses ditolak: Butuh privilege 'transport'");
        const { loanId, newStatus } = payload;
        
        // Get loan info
        const { data: loan, error: loanError } = await supabase
          .from("asset_loans")
          .select("*, asset_unit_id, product_template_id, quantity")
          .eq("id", loanId)
          .single();
        if (loanError) throw loanError;

        // Update loan status
        const updateData = { status: newStatus };
        if (newStatus === "Dikembalikan") {
          updateData.return_date = new Date().toISOString();
        }

        const { error: updateError } = await supabase
          .from("asset_loans")
          .update(updateData)
          .eq("id", loanId);
        if (updateError) throw updateError;

        // Update unit status for serialized items
        if (loan.asset_unit_id) {
          let unitStatus = "available";
          if (newStatus === "Disetujui" || newStatus === "Dipinjam") {
            unitStatus = "borrowed";
          }
          await supabase
            .from("product_units")
            .update({ status: unitStatus })
            .eq("id", loan.asset_unit_id);
        }

        return res
          .status(200)
          .json({ message: `Peminjaman berhasil diubah menjadi ${newStatus}` });
      }

      case "updateReservationStatus": {
        if (!checkPrivilege(profile, "room")) throw new Error("Akses ditolak: Butuh privilege 'room'");
        const { reservationId, newStatus: newReservationStatus } = payload;
        await supabase
          .from("room_reservations")
          .update({ status: newReservationStatus })
          .eq("id", reservationId);
        return res.status(200).json({
          message: `Reservasi berhasil diubah menjadi ${newReservationStatus}`,
        });
      }

      // ============================================================
      // USER MANAGEMENT
      // ============================================================
      case "getUsers": {
        if (!checkPrivilege(profile, "users")) throw new Error("Akses ditolak: Butuh privilege 'users'");
        const {
          data: { users },
          error: listError,
        } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;

        const { data: profiles } = await supabase.from("profiles").select("*");

        const usersWithProfiles = users.map((user) => {
          const profile = profiles.find((p) => p.id === user.id);
          return {
            ...user,
            full_name: profile?.full_name,
            role: profile?.role || "member",
            privileges: profile?.privileges || [],
            is_deleted: profile?.is_deleted || false,
          };
        });

        return res.status(200).json(usersWithProfiles);
      }

      case "createUser": {
        if (!checkPrivilege(profile, "users")) throw new Error("Akses ditolak: Butuh privilege 'users'");
        const { fullName, email, password, role, privileges } = payload;
        const {
          data: { user: newUser },
          error: createError,
        } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { role: role || "member", full_name: fullName },
        });
        if (createError) throw createError;

        // Jika role management, update privileges di profiles
        if (role === 'management' && privileges) {
           await supabase.from('profiles').update({ privileges }).eq('id', newUser.id);
        }

        return res.status(201).json({
          message: "User member baru berhasil dibuat.",
          user: newUser,
        });
      }

      case "updateUser": {
        if (!checkPrivilege(profile, "users")) throw new Error("Akses ditolak: Butuh privilege 'users'");
        const { userId, privileges, ...updateData } = payload;
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

        // Update privileges jika ada
        if (privileges !== undefined) {
           await supabase.from('profiles').update({ privileges }).eq('id', userId);
        }

        return res
          .status(200)
          .json({ message: "Data user berhasil diperbarui." });
      }

      case "deleteUser": {
        if (!checkPrivilege(profile, "users")) throw new Error("Akses ditolak: Butuh privilege 'users'");
        const { userId: deleteId } = payload;
        const { error: deleteError } = await supabase.auth.admin.deleteUser(
          deleteId
        );
        if (deleteError) throw deleteError;
        return res.status(200).json({ message: "User berhasil dihapus." });
      }

      case "toggleUserStatus": {
        if (!checkPrivilege(profile, "users")) throw new Error("Akses ditolak: Butuh privilege 'users'");
        const { userId: toggleId, is_deleted } = payload;
        const { error: toggleError } = await supabase
          .from("profiles")
          .update({ is_deleted: is_deleted })
          .eq("id", toggleId);
        if (toggleError) throw toggleError;
        const statusText = is_deleted ? "dinonaktifkan" : "diaktifkan kembali";
        return res.status(200).json({ message: `User berhasil ${statusText}.` });
      }

      // ============================================================
      // ROOM MANAGEMENT
      // ============================================================
      case "getRooms": {
        if (!checkPrivilege(profile, "room")) throw new Error("Akses ditolak: Butuh privilege 'room'");
        const { data: rooms, error: getRoomsError } = await supabase.from(
          "rooms"
        ).select(`
            id,
            name,
            lokasi,
            kapasitas,
            image_url,
            penanggung_jawab_id,
            penanggung_jawab: profiles!penanggung_jawab_id (id, full_name),
            room_pic (
              user_id,
              profiles:user_id (id, full_name)
            )
          `);
        if (getRoomsError) throw getRoomsError;
        
        // Transform room_pic data to flat array of PICs
        const transformedRooms = (rooms || []).map(room => {
          const picsFromJunction = (room.room_pic || []).map(rp => rp.profiles).filter(Boolean);
          // Fallback to old penanggung_jawab if no junction entries
          const pics = picsFromJunction.length > 0 
            ? picsFromJunction 
            : (room.penanggung_jawab ? [room.penanggung_jawab] : []);
          return {
            ...room,
            pics,
            // Keep penanggung_jawab for backwards compatibility
            penanggung_jawab: room.penanggung_jawab
          };
        });
        
        return res.status(200).json(transformedRooms);
      }

      case "createRoom": {
        if (!checkPrivilege(profile, "room")) throw new Error("Akses ditolak: Butuh privilege 'room'");
        const { name, lokasi, kapasitas, pic_ids, penanggung_jawab_id, image_url } = payload;
        
        // Insert room first
        const { data: newRoom, error: createRoomError } = await supabase
          .from("rooms")
          .insert({ 
            name, 
            lokasi, 
            kapasitas, 
            image_url,
            // Keep penanggung_jawab_id for backwards compatibility
            penanggung_jawab_id: pic_ids?.length > 0 ? pic_ids[0] : penanggung_jawab_id
          })
          .select()
          .single();
        if (createRoomError) throw createRoomError;
        
        // Insert PICs into junction table
        if (pic_ids && pic_ids.length > 0) {
          const picRecords = pic_ids.map(uid => ({ room_id: newRoom.id, user_id: uid }));
          const { error: picError } = await supabase.from("room_pic").insert(picRecords);
          if (picError) console.warn("Failed to insert room_pic:", picError.message);
        }
        
        return res
          .status(201)
          .json({ message: "Ruangan baru berhasil dibuat." });
      }

      case "updateRoom": {
        if (!checkPrivilege(profile, "room")) throw new Error("Akses ditolak: Butuh privilege 'room'");
        const { id, pic_ids, ...updateRoomData } = payload;
        
        // Update room data
        const { error: updateRoomError } = await supabase
          .from("rooms")
          .update({
            ...updateRoomData,
            // Update penanggung_jawab_id for backwards compatibility
            penanggung_jawab_id: pic_ids?.length > 0 ? pic_ids[0] : updateRoomData.penanggung_jawab_id
          })
          .eq("id", id);
        if (updateRoomError) throw updateRoomError;
        
        // Update PICs in junction table
        if (pic_ids !== undefined) {
          // Delete existing entries
          await supabase.from("room_pic").delete().eq("room_id", id);
          
          // Insert new entries
          if (pic_ids && pic_ids.length > 0) {
            const picRecords = pic_ids.map(uid => ({ room_id: id, user_id: uid }));
            const { error: picError } = await supabase.from("room_pic").insert(picRecords);
            if (picError) console.warn("Failed to insert room_pic:", picError.message);
          }
        }
        
        return res
          .status(200)
          .json({ message: "Data ruangan berhasil diperbarui." });
      }

      case "deleteRoom": {
        if (!checkPrivilege(profile, "room")) throw new Error("Akses ditolak: Butuh privilege 'room'");
        const { roomId: deleteRoomId } = payload;
        // room_pic entries will be deleted via CASCADE
        const { error: deleteRoomError } = await supabase
          .from("rooms")
          .delete()
          .eq("id", deleteRoomId);
        if (deleteRoomError) throw deleteRoomError;
        return res.status(200).json({ message: "Ruangan berhasil dihapus." });
      }

      // ============================================================
      // TRANSPORTATION MANAGEMENT
      // ============================================================
      case "getTransportations": {
        if (!checkPrivilege(profile, "transport")) throw new Error("Akses ditolak: Butuh privilege 'transport'");
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
      }

      case "createTransportation": {
        if (!checkPrivilege(profile, "transport")) throw new Error("Akses ditolak: Butuh privilege 'transport'");
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
      }

      case "updateTransportation": {
        if (!checkPrivilege(profile, "transport")) throw new Error("Akses ditolak: Butuh privilege 'transport'");
        const { transportId, ...updateTransData } = payload;
        const { error: updateTransError } = await supabase
          .from("transportations")
          .update(updateTransData)
          .eq("id", transportId);
        if (updateTransError) throw updateTransError;
        return res
          .status(200)
          .json({ message: "Data transportasi berhasil diperbarui." });
      }

      case "deleteTransportation": {
        if (!checkPrivilege(profile, "transport")) throw new Error("Akses ditolak: Butuh privilege 'transport'");
        const { transportId: deleteTransId } = payload;
        const { error: deleteTransError } = await supabase
          .from("transportations")
          .delete()
          .eq("id", deleteTransId);
        if (deleteTransError) throw deleteTransError;
        return res
          .status(200)
          .json({ message: "Transportasi berhasil dihapus." });
      }

      // ============================================================
      // STOCK OPNAME MANAGEMENT
      // ============================================================
      case "createStockOpname": {
        if (!checkPrivilege(profile, "stock_opname")) throw new Error("Akses ditolak: Butuh privilege 'stock_opname'");
        const { title, notes } = payload;
        if (!title) throw new Error("Judul stok opname wajib diisi.");

        // Check if there is already an ongoing opname
        const { data: ongoing } = await supabase
          .from("stock_opnames")
          .select("id")
          .eq("status", "ongoing")
          .limit(1);
        
        if (ongoing && ongoing.length > 0) {
          throw new Error("Masih ada stok opname yang sedang berlangsung. Selesaikan terlebih dahulu.");
        }

        const { data, error } = await supabase
          .from("stock_opnames")
          .insert({
            title,
            notes,
            status: "ongoing",
            created_by: user.id
          })
          .select()
          .single();
        
        if (error) throw error;
        return res.status(201).json(data);
      }

      case "getActiveStockOpname": {
        if (!checkPrivilege(profile, "stock_opname")) throw new Error("Akses ditolak: Butuh privilege 'stock_opname'");
        // Get ongoing opname
        const { data: opname, error } = await supabase
          .from("stock_opnames")
          .select("*")
          .eq("status", "ongoing")
          .maybeSingle();
        
        if (error) throw error;
        if (!opname) return res.status(200).json(null);

        // Get stats
        const { data: items, error: itemsError } = await supabase
          .from("stock_opname_items")
          .select(`
            id,
            product_template_id,
            product_unit_id,
            actual_qty,
            checked_at,
            template:product_templates!product_template_id (id, name, category:asset_categories(name))
          `)
          .eq("opname_id", opname.id)
          .order("checked_at", { ascending: false });

        if (itemsError) throw itemsError;

        return res.status(200).json({ opname, items });
      }

      case "submitOpnameItem": {
        if (!checkPrivilege(profile, "stock_opname")) throw new Error("Akses ditolak: Butuh privilege 'stock_opname'");
        const { opnameId, templateId, unitId, qty, notes, isScan } = payload;
        
        if (!opnameId) throw new Error("Opname ID wajib diisi.");
        if (!templateId) throw new Error("Template ID wajib diisi.");

        // Get current system stock
        let systemQty = 0;
        if (unitId) {
          // Serialized: 1 if exists and available/borrowed
          const { data: u } = await supabase.from("product_units").select("status").eq("id", unitId).single();
          if (u) systemQty = 1; 
        } else {
          // Non-serialized: get quantity_on_hand
          const { data: t } = await supabase.from("product_templates").select("quantity_on_hand").eq("id", templateId).single();
          if (t) systemQty = t.quantity_on_hand || 0;
        }

        // Check if item already checked in this opname
        let existingQuery = supabase.from("stock_opname_items").select("id, actual_qty").eq("opname_id", opnameId);
        
        if (unitId) {
          existingQuery = existingQuery.eq("product_unit_id", unitId);
        } else {
          existingQuery = existingQuery.eq("product_template_id", templateId).is("product_unit_id", null);
        }
        
        const { data: existingItem } = await existingQuery.maybeSingle();

        let result;
        if (existingItem) {
          // Update existing
          const newQty = unitId ? 1 : (existingItem.actual_qty + (qty || 1));
          const { data, error } = await supabase
            .from("stock_opname_items")
            .update({
              actual_qty: newQty,
              system_qty: systemQty, // Update snapshot
              checked_at: new Date().toISOString(),
              checked_by: user.id,
              notes: notes || null
            })
            .eq("id", existingItem.id)
            .select()
            .single();
          if (error) throw error;
          result = data;
        } else {
          // Insert new
          const { data, error } = await supabase
            .from("stock_opname_items")
            .insert({
              opname_id: opnameId,
              product_template_id: templateId,
              product_unit_id: unitId || null,
              system_qty: systemQty,
              actual_qty: qty || 1,
              notes: notes || null,
              checked_by: user.id
            })
            .select()
            .single();
          if (error) throw error;
          result = data;
        }

        return res.status(200).json(result);
      }

      case "completeStockOpname": {
        if (!checkPrivilege(profile, "stock_opname")) throw new Error("Akses ditolak: Butuh privilege 'stock_opname'");
        const { opnameId, notes } = payload;
        if (!opnameId) throw new Error("Opname ID wajib diisi.");

        const { data, error } = await supabase
          .from("stock_opnames")
          .update({
            status: "completed",
            end_date: new Date().toISOString(),
            notes: notes || undefined
          })
          .eq("id", opnameId)
          .select()
          .single();
        
        if (error) throw error;
        return res.status(200).json(data);
      }

      case "getOpnameHistory": {
        if (!checkPrivilege(profile, "stock_opname")) throw new Error("Akses ditolak: Butuh privilege 'stock_opname'");
        const { data, error } = await supabase
          .from("stock_opnames")
          .select("*")
          .eq("status", "completed")
          .order("end_date", { ascending: false });
        
        if (error) throw error;
        return res.status(200).json(data);
      }

      case "getOpnameDetail": {
        if (!checkPrivilege(profile, "stock_opname")) throw new Error("Akses ditolak: Butuh privilege 'stock_opname'");
        const { opnameId } = payload;
        if (!opnameId) throw new Error("Opname ID wajib diisi.");

        const { data: opname, error: opError } = await supabase
          .from("stock_opnames")
          .select("*")
          .eq("id", opnameId)
          .single();
        
        if (opError) throw opError;

        // Fetch items without joining profiles directly to avoid FK issues
        const { data: items, error: itemsError } = await supabase
          .from("stock_opname_items")
          .select(`
            *,
            template:product_templates!product_template_id (name, uom, category:asset_categories(name)),
            unit:product_units!product_unit_id (asset_code, serial_number)
          `)
          .eq("opname_id", opnameId)
          .order("checked_at", { ascending: true });

        if (itemsError) throw itemsError;

        // Manually fetch checker profiles
        const checkerIds = [...new Set(items.map(i => i.checked_by).filter(Boolean))];
        let profilesMap = {};
        
        if (checkerIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", checkerIds);
          
          if (profiles) {
            profiles.forEach(p => profilesMap[p.id] = p);
          }
        }

        // Attach checker info
        const itemsWithChecker = items.map(item => ({
          ...item,
          checker: profilesMap[item.checked_by] || { full_name: "Unknown" }
        }));

        return res.status(200).json({ opname, items: itemsWithChecker });
      }

      case "getPendingTransportLoans": {
        if (!checkPrivilege(profile, "transport")) throw new Error("Akses ditolak: Butuh privilege 'transport'");
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
      }

      case "updateTransportLoanStatus": {
        if (!checkPrivilege(profile, "transport")) throw new Error("Akses ditolak: Butuh privilege 'transport'");
        const { loanId: transLoanId, newStatus: transLoanStatus } = payload;
        const { error: updateTransLoanError } = await supabase
          .from("transport_loans")
          .update({ status: transLoanStatus })
          .eq("id", transLoanId);
        if (updateTransLoanError) throw updateTransLoanError;
        return res.status(200).json({
          message: `Peminjaman transportasi berhasil diubah menjadi ${transLoanStatus}`,
        });
      }

      default:
        return res.status(400).json({ error: "Aksi tidak dikenal" });
    }
  } catch (error) {
    if (
      error.message &&
      (error.message.includes("User already registered") ||
        error.message.includes(
          "duplicate key value violates unique constraint"
        ))
    ) {
      return res
        .status(409)
        .json({ error: "Email ini sudah terpakai oleh pengguna lain." });
    }

    return res.status(500).json({
      error: "Terjadi kesalahan di server manajemen.",
      details: error.message,
    });
  }
}
