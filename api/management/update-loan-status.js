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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { error: authError } = await verifyManagement(req);
  if (authError) return res.status(403).json({ error: "Access Forbidden" });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  const { loanId, newStatus } = req.body;

  if (!loanId || !newStatus) {
    return res
      .status(400)
      .json({ error: "ID Peminjaman dan status baru dibutuhkan." });
  }

  try {
    // Update status di tabel asset_loans
    const { data: updatedLoan, error: loanError } = await supabase
      .from("asset_loans")
      .update({ status: newStatus })
      .eq("id", loanId)
      .select()
      .single();

    if (loanError) throw loanError;

    // Jika disetujui, update juga status di tabel assets utama
    if (newStatus === "Disetujui") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", updatedLoan.user_id)
        .single();

      const { error: assetError } = await supabase
        .from("assets")
        .update({
          status: "Dipinjam",
          borrower_name: profile.full_name || "N/A",
        })
        .eq("id", updatedLoan.asset_id);

      if (assetError) throw assetError;
    }

    res
      .status(200)
      .json({ message: `Peminjaman berhasil diubah menjadi ${newStatus}` });
  } catch (error) {
    res.status(500).json({
      error: "Gagal memperbarui status peminjaman.",
      details: error.message,
    });
  }
}
