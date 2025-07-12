import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  try {
    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .order("asset_name", { ascending: true });

    if (error) throw error;

    res.status(200).json(data);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Gagal mengambil data aset", details: error.message });
  }
}
