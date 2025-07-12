// File: /api/management/pending-reservations.js
import { createClient } from "@supabase/supabase-js";

// Helper untuk verifikasi role management
async function verifyManagement(req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return { error: "No token" };

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return { error: "Invalid token" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "management") return { error: "Forbidden" };

  return { user };
}

export default async function handler(req, res) {
  const { error: authError } = await verifyManagement(req);
  if (authError) return res.status(403).json({ error: "Access Forbidden" });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    const { data, error } = await supabase
      .from("room_reservations")
      .select("*")
      .eq("status", "Menunggu Persetujuan")
      .order("created_at", { ascending: true }); // Tampilkan yang paling lama dulu

    if (error) throw error;

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({
      error: "Gagal mengambil data reservasi pending.",
      details: error.message,
    });
  }
}
