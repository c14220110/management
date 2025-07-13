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

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", sessionData.user.id)
      .single();

    if (profileError && profileError.code !== "PGRST116") {
      throw new Error("Gagal mengambil data profil pengguna.");
    }

    const userRole = profileData ? profileData.role : "member";
    sessionData.user.user_metadata = {
      ...sessionData.user.user_metadata,
      role: userRole,
    };

    res.status(200).json(sessionData);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
}
