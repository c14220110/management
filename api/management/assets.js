import { createClient } from "@supabase/supabase-js";

// Helper untuk verifikasi role management (bisa diekstrak ke file terpisah)
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

  switch (req.method) {
    case "GET":
      const { data: assets, error: getError } = await supabase
        .from("assets")
        .select("*");
      if (getError) return res.status(500).json({ error: getError.message });
      return res.status(200).json(assets);

    case "POST":
      const { error: postError } = await supabase
        .from("assets")
        .insert(req.body);
      if (postError) return res.status(500).json({ error: postError.message });
      return res.status(201).json({ message: "Aset berhasil ditambahkan" });

    case "PUT":
      const { id: putId, ...putData } = req.body;
      const { error: putError } = await supabase
        .from("assets")
        .update(putData)
        .eq("id", putId);
      if (putError) return res.status(500).json({ error: putError.message });
      return res.status(200).json({ message: "Aset berhasil diperbarui" });

    case "DELETE":
      const { id: deleteId } = req.body;
      const { error: deleteError } = await supabase
        .from("assets")
        .delete()
        .eq("id", deleteId);
      if (deleteError)
        return res.status(500).json({ error: deleteError.message });
      return res.status(204).end(); // No Content

    default:
      res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
