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

    // Ambil role dari tabel profiles
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", sessionData.user.id)
      .single();

    // Jika ada error saat mengambil profil (selain profil tidak ditemukan), lempar error.
    if (profileError && profileError.code !== "PGRST116") {
      throw new Error("Gagal mengambil data profil pengguna.");
    }

    // Gabungkan role ke dalam user_metadata untuk frontend.
    // Jika profil tidak ada, default ke 'member'.
    const userRole = profileData ? profileData.role : "member";
    sessionData.user.user_metadata = {
      ...sessionData.user.user_metadata,
      role: userRole,
    };

    // Kirim kembali data sesi yang sudah lengkap
    res.status(200).json(sessionData);
  } catch (error) {
    // Kirim status 401 jika terjadi error otentikasi atau lainnya
    res.status(401).json({ error: error.message });
  } //haris
} //ss
