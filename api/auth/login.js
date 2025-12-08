// File: /api/auth/login.js (Versi yang sudah diperbarui)
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  const { email, password } = req.body;

  try {
    const { data: sessionData, error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (loginError) {
      throw new Error(loginError.message || "Email atau password salah.");
    }

    // PERUBAHAN DI SINI: Ambil role, full_name, dan privileges
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("role, full_name, privileges, is_deleted") // <-- Tambah is_deleted
      .eq("id", sessionData.user.id)
      .single();

    if (profileError && profileError.code !== "PGRST116") {
      throw new Error("Gagal mengambil data profil pengguna.");
    }

    // Check if user is deactivated
    if (profileData?.is_deleted === true) {
      throw new Error("Akun Anda telah dinonaktifkan. Hubungi administrator.");
    }

    // Gabungkan data ke dalam user object untuk dikirim ke frontend
    const userRole = profileData ? profileData.role : "member";
    const userFullName = profileData ? profileData.full_name : email; // Jika nama kosong, pakai email
    const userPrivileges = profileData ? profileData.privileges : null;

    sessionData.user.user_metadata = {
      ...sessionData.user.user_metadata,
      role: userRole,
    };
    // Tambahkan full_name dan privileges langsung ke objek user
    sessionData.user.full_name = userFullName;
    sessionData.user.privileges = userPrivileges;

    res.status(200).json(sessionData);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
}
