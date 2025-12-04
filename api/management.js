// File: /api/management.js (Versi Final dengan Penanganan Error yang Lebih Baik)

import { createClient } from "@supabase/supabase-js";

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

  const { action, payload } = req.body;

  try {
    switch (action) {
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
          .select(`
            *,
            person_in_charge:profiles!person_in_charge_id (id, full_name)
          `)
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
            .select(`
              *,
              transportations (vehicle_name, plate_number),
              profiles!borrower_id (full_name)
            `)
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
