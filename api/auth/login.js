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
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message || "Email atau password salah.");
    }

    // Ambil role dari tabel profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    // Gabungkan role ke dalam user_metadata untuk frontend
    data.user.user_metadata = {
      ...data.user.user_metadata,
      role: profile.role || "member",
    };

    res.status(200).json(data);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
}
