
// State
let opnameState = {
  active: null,
  items: [],
  history: [],
  templates: [], // Cache for product templates
  units: [], // Cache for product units
  categories: []
};

async function loadStockOpnamePage() {
  const contentArea = document.getElementById("content-area");
  showLoader();
  try {
    contentArea.innerHTML = "";
    const template = document.getElementById("stok-opname-template").content.cloneNode(true);
    contentArea.appendChild(template);
    await renderStockOpnameView();
  } catch (error) {
    contentArea.innerHTML = `<p class="text-red-500">Error: ${error.message}</p>`;
  } finally {
    hideLoader();
  }
}

// Main Entry Point
async function renderStockOpnameView() {
  const container = document.getElementById("stok-opname-content-area");
  if (!container) return;

  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      <p class="mt-4 text-gray-500">Memuat data stok opname...</p>
    </div>
  `;

  try {
    await loadOpnameData();
    
    if (opnameState.active) {
      renderActiveOpname(container);
    } else {
      renderHistoryOpname(container);
    }
  } catch (error) {
    container.innerHTML = `
      <div class="bg-red-50 text-red-700 p-6 rounded-xl border border-red-200">
        <h3 class="font-bold text-lg mb-2">Terjadi Kesalahan</h3>
        <p>${error.message}</p>
        <button onclick="renderStockOpnameView()" class="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Coba Lagi</button>
      </div>
    `;
  }
}

// Data Loading
async function loadOpnameData() {
  const token = localStorage.getItem("authToken");
  
  // Load Active Opname
  const activeRes = await fetch("/api/management", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: "getActiveStockOpname" })
  });
  if (!activeRes.ok) throw new Error("Gagal memuat data aktif");
  const activeData = await activeRes.json();
  
  opnameState.active = activeData?.opname || null;
  opnameState.items = activeData?.items || [];

  // Load History if no active
  if (!opnameState.active) {
    const historyRes = await fetch("/api/management", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "getOpnameHistory" })
    });
    if (!historyRes.ok) throw new Error("Gagal memuat history");
    opnameState.history = await historyRes.json();
  }

  // Load Metadata (Templates & Categories) needed for input
  if (opnameState.active) {
    await ensureInventoryMeta();
    const tmplRes = await fetch("/api/management", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "getProductTemplates" })
    });
    if (tmplRes.ok) opnameState.templates = await tmplRes.json();
  }
}

// ============================================================
// ACTIVE OPNAME VIEW
// ============================================================
function renderActiveOpname(container) {
  const { active, items, templates } = opnameState;
  
  // Calculate Stats
  const totalChecked = items.length;
  
  // Calculate Overall Progress
  let totalItemsSystem = 0;
  let totalItemsChecked = 0;
  
  // Group by category for chart
  const categoryStats = {};
  
  // Initialize all categories with 0
  templates.forEach(t => {
    const catName = t.category?.name || "Lainnya";
    if (!categoryStats[catName]) {
      categoryStats[catName] = { total: 0, checked: 0 };
    }
    
    // Add to total system items
    const stock = t.is_serialized ? (t.stock?.total || 0) : (t.quantity_on_hand || 0);
    totalItemsSystem += stock;
    categoryStats[catName].total += stock;
  });

  // Count checked items
  items.forEach(item => {
    const catName = item.template?.category?.name || "Lainnya";
    if (categoryStats[catName]) {
      categoryStats[catName].checked += item.actual_qty;
    }
    totalItemsChecked += item.actual_qty;
  });

  const overallProgress = totalItemsSystem > 0 ? Math.round((totalItemsChecked / totalItemsSystem) * 100) : 0;

  container.innerHTML = `
    <!-- Header -->
    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full uppercase tracking-wide">Sedang Berlangsung</span>
            <span class="text-gray-400 text-sm"><i class="far fa-clock mr-1"></i> Dimulai: ${new Date(active.start_date).toLocaleString('id-ID')}</span>
          </div>
          <h2 class="text-2xl font-bold text-gray-800">${active.title}</h2>
          <p class="text-gray-500 text-sm mt-1">${active.notes || "Tidak ada catatan"}</p>
        </div>
        <div class="flex items-center gap-4">
          <div class="text-right hidden md:block">
            <p class="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Progress</p>
            <p class="text-2xl font-bold text-amber-600">${overallProgress}%</p>
          </div>
          <button id="finish-opname-btn" class="px-6 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-all font-medium flex items-center gap-2">
            <i class="fas fa-flag-checkered"></i> Selesai Opname
          </button>
        </div>
      </div>
      
      <!-- Progress Bar -->
      <div class="mt-6">
        <div class="flex justify-between text-sm mb-2">
          <span class="text-gray-600 font-medium">Kelengkapan Data (${totalItemsChecked} / ${totalItemsSystem} item)</span>
          <span class="font-bold text-amber-600">${overallProgress}%</span>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div class="bg-gradient-to-r from-amber-400 to-orange-500 h-3 rounded-full transition-all duration-500" style="width: ${overallProgress}%"></div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Left Column: Input & Recent -->
      <div class="lg:col-span-2 space-y-6">
        
        <!-- Input Card -->
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 class="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <i class="fas fa-qrcode text-amber-600"></i> Input Stok
          </h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <button id="opname-scan-btn" class="flex flex-col items-center justify-center p-6 border-2 border-dashed border-amber-300 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors cursor-pointer group">
              <div class="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                <i class="fas fa-camera text-2xl text-amber-600"></i>
              </div>
              <span class="font-bold text-amber-800">Scan QR Code</span>
              <span class="text-xs text-amber-600 mt-1">Untuk barang serialized</span>
            </button>
            
            <button id="opname-manual-btn" class="flex flex-col items-center justify-center p-6 border-2 border-dashed border-blue-300 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors cursor-pointer group">
              <div class="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                <i class="fas fa-keyboard text-2xl text-blue-600"></i>
              </div>
              <span class="font-bold text-blue-800">Input Manual</span>
              <span class="text-xs text-blue-600 mt-1">Cari nama / kode barang</span>
            </button>
          </div>
        </div>

        <!-- Recent Activity -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div class="p-4 border-b border-gray-100 flex justify-between items-center">
            <h3 class="font-bold text-gray-800">Aktivitas Terakhir</h3>
            <span class="text-xs bg-gray-100 px-2 py-1 rounded-lg text-gray-600">${items.length} entri</span>
          </div>
          <div class="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
            ${items.length ? items.slice().reverse().map(item => `
              <div class="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
                    <i class="fas ${item.product_unit_id ? 'fa-barcode' : 'fa-box'}"></i>
                  </div>
                  <div>
                    <p class="font-medium text-gray-800 text-sm">${item.template?.name || "Unknown"}</p>
                    <p class="text-xs text-gray-500">
                      ${item.template?.category?.name || "-"} • 
                      ${new Date(item.checked_at).toLocaleTimeString('id-ID')}
                    </p>
                  </div>
                </div>
                <div class="text-right">
                  <span class="block font-bold text-emerald-600 text-sm">+${item.actual_qty}</span>
                  <span class="text-xs text-gray-400">${item.product_unit_id ? 'Serialized' : 'Non-Ser'}</span>
                </div>
              </div>
            `).join("") : `
              <div class="p-8 text-center text-gray-400">
                <i class="fas fa-clipboard-list text-4xl mb-3 opacity-30"></i>
                <p>Belum ada item yang dicek</p>
              </div>
            `}
          </div>
        </div>
      </div>

      <!-- Right Column: Stats -->
      <div class="space-y-6">
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 class="font-bold text-gray-800 mb-4">Progress Kategori</h3>
          <div class="space-y-5">
            ${Object.entries(categoryStats).map(([cat, stats]) => {
              const pct = stats.total > 0 ? Math.round((stats.checked / stats.total) * 100) : 0;
              const colorClass = pct === 100 ? 'bg-green-500' : (pct > 50 ? 'bg-amber-500' : 'bg-gray-300');
              
              return `
              <div>
                <div class="flex justify-between text-sm mb-1">
                  <span class="text-gray-700 font-medium">${cat}</span>
                  <span class="text-xs text-gray-500">${stats.checked}/${stats.total}</span>
                </div>
                <div class="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div class="${colorClass} h-2.5 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                </div>
                <div class="text-right mt-0.5">
                  <span class="text-[10px] font-bold text-gray-400">${pct}%</span>
                </div>
              </div>
            `}).join("")}
            ${Object.keys(categoryStats).length === 0 ? '<p class="text-sm text-gray-400 italic">Belum ada data kategori</p>' : ''}
          </div>
        </div>
      </div>
    </div>
  `;

  // Event Listeners
  document.getElementById("finish-opname-btn")?.addEventListener("click", confirmFinishOpname);
  document.getElementById("opname-scan-btn")?.addEventListener("click", handleOpnameScan);
  document.getElementById("opname-manual-btn")?.addEventListener("click", openManualInputModal);
}

// ============================================================
// HISTORY VIEW
// ============================================================
function renderHistoryOpname(container) {
  const { history } = opnameState;

  container.innerHTML = `
    <div class="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center mb-8">
      <div class="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
        <i class="fas fa-clipboard-check"></i>
      </div>
      <h2 class="text-2xl font-bold text-gray-800 mb-2">Stok Opname</h2>
      <p class="text-gray-500 max-w-lg mx-auto mb-6">Lakukan stok opname secara berkala untuk memastikan keakuratan data inventaris fisik dengan sistem.</p>
      <button id="start-opname-btn" class="px-6 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 shadow-lg shadow-amber-200 transition-all font-medium">
        <i class="fas fa-plus mr-2"></i> Mulai Stok Opname Baru
      </button>
    </div>

    <h3 class="font-bold text-gray-800 text-lg mb-4 px-1">Riwayat Opname</h3>
    
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      ${history.length ? `
        <table class="min-w-full text-sm text-left">
          <thead class="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
            <tr>
              <th class="p-4">Judul</th>
              <th class="p-4">Tanggal Mulai</th>
              <th class="p-4">Tanggal Selesai</th>
              <th class="p-4">Status</th>
              <th class="p-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${history.map(h => `
              <tr class="hover:bg-gray-50 transition-colors">
                <td class="p-4 font-medium text-gray-800">${h.title}</td>
                <td class="p-4 text-gray-600">${new Date(h.start_date).toLocaleDateString('id-ID')}</td>
                <td class="p-4 text-gray-600">${h.end_date ? new Date(h.end_date).toLocaleDateString('id-ID') : '-'}</td>
                <td class="p-4"><span class="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold uppercase">Selesai</span></td>
                <td class="p-4 text-center">
                  <button class="text-blue-600 hover:text-blue-800 font-medium text-xs view-detail-btn" data-id="${h.id}">
                    Lihat Detail
                  </button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `
        <div class="p-12 text-center text-gray-400">
          <p>Belum ada riwayat stok opname.</p>
        </div>
      `}
    </div>
  `;

  document.getElementById("start-opname-btn")?.addEventListener("click", openStartOpnameModal);
  container.querySelectorAll(".view-detail-btn").forEach(btn => {
    btn.addEventListener("click", () => openOpnameDetail(btn.dataset.id));
  });
}

// ============================================================
// ACTIONS & MODALS
// ============================================================

function openStartOpnameModal() {
  const content = `
    <form id="start-opname-form" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Judul Opname</label>
        <input type="text" name="title" placeholder="Contoh: Opname Q4 2025" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"/>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
        <textarea name="notes" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-lg"></textarea>
      </div>
    </form>
  `;

  openGlobalModal({
    title: "Mulai Stok Opname Baru",
    contentHTML: content,
    confirmText: "Mulai",
    onConfirm: async () => {
      const form = document.getElementById("start-opname-form");
      const fd = new FormData(form);
      const title = fd.get("title");
      const notes = fd.get("notes");
      
      if (!title) { notifyError("Judul wajib diisi"); return; }

      try {
        const token = localStorage.getItem("authToken");
        const res = await fetch("/api/management", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: "createStockOpname", payload: { title, notes } })
        });
        
        if (!res.ok) throw new Error((await res.json()).error || "Gagal memulai opname");
        
        closeGlobalModal();
        notifySuccess("Stok opname dimulai!");
        renderStockOpnameView();
      } catch (e) {
        notifyError(e.message);
      }
    }
  });
}

function handleOpnameScan() {
  const content = `
    <div class="flex flex-col items-center">
      <div id="opname-qr-reader" style="width: 100%; max-width: 400px;"></div>
      <p class="text-sm text-gray-500 mt-4">Scan QR Code barang untuk check-in</p>
    </div>
  `;
  
  openGlobalModal({
    title: "Scan Barang",
    contentHTML: content,
    confirmText: "Tutup",
    onConfirm: () => closeGlobalModal()
  });

  setTimeout(() => {
    if (!document.getElementById("opname-qr-reader")) return;
    const scanner = new Html5QrcodeScanner("opname-qr-reader", { fps: 10, qrbox: 250 });
    
    scanner.render(async (decodedText) => {
      // Handle Scan
      try {
        scanner.pause();
        await processScannedItem(decodedText);
        scanner.resume();
      } catch (e) {
        console.error(e);
        notifyError("Gagal memproses QR: " + e.message);
        scanner.resume();
      }
    });

    // Cleanup
    const cleanup = () => { try { scanner.clear(); } catch(e){} };
    document.getElementById("global-modal-close")?.addEventListener("click", cleanup);
    document.getElementById("global-modal-confirm")?.addEventListener("click", cleanup);
  }, 200);
}

async function processScannedItem(code) {
  // 1. Find Unit
  const token = localStorage.getItem("authToken");
  const findRes = await fetch("/api/management", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: "findUnitByCode", payload: { code } })
  });
  
  if (!findRes.ok) { notifyError("Barang tidak ditemukan"); return; }
  const unit = await findRes.json();
  
  if (!unit) { notifyError("QR Code tidak valid / Barang tidak ditemukan"); return; }

  // 2. Submit to Opname
  const submitRes = await fetch("/api/management", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ 
      action: "submitOpnameItem", 
      payload: { 
        opnameId: opnameState.active.id,
        templateId: unit.template_id,
        unitId: unit.id,
        qty: 1,
        isScan: true
      } 
    })
  });

  if (!submitRes.ok) throw new Error("Gagal menyimpan data opname");
  
  notifySuccess(`Berhasil: ${unit.template.name} (${unit.asset_code || unit.serial_number})`);
  
  // Refresh data in background
  loadOpnameData().then(() => {
    const container = document.getElementById("stok-opname-content-area");
    if (container) renderActiveOpname(container);
  });
}

function openManualInputModal() {
  // Filter templates: Show all, but we will handle unit filtering dynamically
  // For non-serialized, we could check if actual_qty >= quantity_on_hand, but usually we allow re-checking or adding more.
  // Let's just show all templates for now.
  const tmplOpts = opnameState.templates.map(t => `<option value="${t.id}">${t.name} (${t.category?.name || '-'})</option>`).join("");
  
  const content = `
    <form id="manual-opname-form" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Pilih Produk</label>
        <select name="template_id" id="manual-template-select" class="w-full px-3 py-2 border border-gray-300 rounded-lg select2-enable">
          <option value="">-- Cari Produk --</option>
          ${tmplOpts}
        </select>
      </div>
      
      <div id="manual-unit-section" class="hidden">
        <label class="block text-sm font-medium text-gray-700 mb-1">Pilih Unit (Serialized)</label>
        <select name="unit_id" id="manual-unit-select" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
          <option value="">-- Pilih Unit --</option>
        </select>
        <p id="manual-unit-hint" class="text-xs text-gray-500 mt-1 hidden">Unit yang sudah dicek tidak ditampilkan.</p>
      </div>

      <div id="manual-qty-section">
        <label class="block text-sm font-medium text-gray-700 mb-1">Jumlah Fisik</label>
        <input type="number" name="qty" value="1" min="1" class="w-full px-3 py-2 border border-gray-300 rounded-lg"/>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
        <textarea name="notes" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-lg"></textarea>
      </div>
    </form>
  `;

  openGlobalModal({
    title: "Input Manual Stok",
    contentHTML: content,
    confirmText: "Simpan",
    onConfirm: async () => {
      const form = document.getElementById("manual-opname-form");
      const fd = new FormData(form);
      const templateId = fd.get("template_id");
      const unitId = fd.get("unit_id");
      const qty = parseInt(fd.get("qty") || "1");
      const notes = fd.get("notes");

      if (!templateId) { notifyError("Pilih produk terlebih dahulu"); return; }

      try {
        const token = localStorage.getItem("authToken");
        const res = await fetch("/api/management", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ 
            action: "submitOpnameItem", 
            payload: { 
              opnameId: opnameState.active.id,
              templateId,
              unitId: unitId || null,
              qty,
              notes,
              isScan: false
            } 
          })
        });

        if (!res.ok) throw new Error("Gagal menyimpan data");
        
        closeGlobalModal();
        notifySuccess("Data tersimpan");
        await loadOpnameData();
        renderActiveOpname(document.getElementById("stok-opname-content-area"));
      } catch (e) {
        notifyError(e.message);
      }
    }
  });

  // Dynamic Unit Loading
  setTimeout(() => {
    const tmplSelect = document.getElementById("manual-template-select");
    const unitSelect = document.getElementById("manual-unit-select");
    const unitSection = document.getElementById("manual-unit-section");
    const qtySection = document.getElementById("manual-qty-section");
    const unitHint = document.getElementById("manual-unit-hint");

    tmplSelect?.addEventListener("change", async (e) => {
      const tid = e.target.value;
      const tmpl = opnameState.templates.find(t => t.id === tid);
      
      if (tmpl?.is_serialized) {
        unitSection.classList.remove("hidden");
        qtySection.classList.add("hidden"); // Serialized is always 1 by 1 check
        
        // Load units
        unitSelect.innerHTML = '<option>Loading...</option>';
        const token = localStorage.getItem("authToken");
        const res = await fetch("/api/management", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: "getProductUnits", payload: { templateId: tid } })
        });
        const units = await res.json();
        
        // Filter out units that are already checked in this opname
        const checkedUnitIds = new Set(opnameState.items.map(i => i.product_unit_id).filter(Boolean));
        const availableUnits = units.filter(u => !checkedUnitIds.has(u.id));

        if (availableUnits.length === 0) {
           unitSelect.innerHTML = '<option value="">-- Semua unit sudah dicek --</option>';
           unitSelect.disabled = true;
        } else {
           unitSelect.disabled = false;
           unitSelect.innerHTML = '<option value="">-- Pilih Unit --</option>' + 
             availableUnits.map(u => `<option value="${u.id}">${u.asset_code || u.serial_number} (${u.status})</option>`).join("");
        }
        unitHint.classList.remove("hidden");

      } else {
        unitSection.classList.add("hidden");
        unitHint.classList.add("hidden");
        qtySection.classList.remove("hidden");
        unitSelect.value = "";
      }
    });
  }, 100);
}

function confirmFinishOpname() {
  openGlobalModal({
    title: "Selesaikan Stok Opname?",
    contentHTML: `<p>Apakah Anda yakin ingin menyelesaikan sesi stok opname ini? Data tidak bisa diubah lagi setelah selesai.</p>`,
    confirmText: "Ya, Selesaikan",
    onConfirm: async () => {
      try {
        const token = localStorage.getItem("authToken");
        const res = await fetch("/api/management", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: "completeStockOpname", payload: { opnameId: opnameState.active.id } })
        });
        
        if (!res.ok) throw new Error("Gagal menyelesaikan opname");
        
        closeGlobalModal();
        notifySuccess("Stok Opname Selesai!");
        opnameState.active = null;
        renderStockOpnameView();
      } catch (e) {
        notifyError(e.message);
      }
    }
  });
}

async function openOpnameDetail(opnameId) {
  // Fetch detail
  const token = localStorage.getItem("authToken");
  const res = await fetch("/api/management", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: "getOpnameDetail", payload: { opnameId } })
  });
  
  if (!res.ok) { notifyError("Gagal mengambil detail"); return; }
  const { opname, items, summary } = await res.json();

  // Store data globally for export and filtering
  window._opnameExportData = { opname, items, summary };
  window._opnameAllItems = items; // Full list for filtering

  // Create or get modal
  let modal = document.getElementById('opname-detail-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'opname-detail-modal';
    modal.className = 'modal fixed inset-0 bg-gray-900/50 backdrop-blur-sm hidden items-center justify-center z-50 p-4';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
      <!-- Header -->
      <div class="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-6 flex justify-between items-center">
        <div>
          <h2 class="text-xl font-bold"><i class="fas fa-clipboard-list mr-2"></i>Detail: ${opname.title}</h2>
          <p class="text-white/80 text-sm mt-1">
            <i class="fas fa-calendar-alt mr-1"></i>Periode: ${new Date(opname.start_date).toLocaleDateString('id-ID')} - ${opname.end_date ? new Date(opname.end_date).toLocaleDateString('id-ID') : 'Berlangsung'}
            <span class="ml-3 px-2 py-0.5 ${opname.status === 'completed' ? 'bg-green-600/80' : 'bg-yellow-600/80'} rounded-full text-xs">${opname.status === 'completed' ? 'Selesai' : 'Berlangsung'}</span>
          </p>
        </div>
        <button onclick="closeOpnameDetailModal()" class="text-white/80 hover:text-white text-2xl">
          <i class="fas fa-times"></i>
        </button>
      </div>
      
      <!-- Stats Cards -->
      <div class="p-6 border-b bg-gray-50">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div class="bg-white rounded-xl p-4 text-center shadow-sm border">
            <p class="text-3xl font-bold text-blue-600">${summary.totalChecked}</p>
            <p class="text-xs text-gray-500">dari ${summary.totalUnitsInInventory} unit</p>
            <p class="text-sm font-medium text-gray-700 mt-1">Item Dicek</p>
          </div>
          <div class="bg-white rounded-xl p-4 text-center shadow-sm border">
            <p class="text-3xl font-bold text-green-600">${summary.accuracyRate}%</p>
            <p class="text-xs text-gray-500">${summary.matched} sesuai</p>
            <p class="text-sm font-medium text-gray-700 mt-1">Akurasi</p>
          </div>
          <div class="bg-white rounded-xl p-4 text-center shadow-sm border">
            <p class="text-3xl font-bold text-red-600">${summary.mismatched}</p>
            <p class="text-xs text-gray-500">${summary.missing} kurang, ${summary.excess} lebih</p>
            <p class="text-sm font-medium text-gray-700 mt-1">Tidak Sesuai</p>
          </div>
          <div class="bg-white rounded-xl p-4 text-center shadow-sm border">
            <p class="text-3xl font-bold ${summary.totalDiscrepancy >= 0 ? 'text-green-600' : 'text-red-600'}">${summary.totalDiscrepancy >= 0 ? '+' : ''}${summary.totalDiscrepancy}</p>
            <p class="text-xs text-gray-500">Sistem: ${summary.totalSystemQty}, Aktual: ${summary.totalActualQty}</p>
            <p class="text-sm font-medium text-gray-700 mt-1">Selisih Qty</p>
          </div>
        </div>
        
        <!-- Category Breakdown & Checkers -->
        <div class="flex flex-wrap items-center gap-4 mb-4">
          ${Object.keys(summary.categoryBreakdown).length > 0 ? `
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-medium text-gray-600"><i class="fas fa-layer-group mr-1"></i>Kategori:</span>
              ${Object.entries(summary.categoryBreakdown).map(([cat, data]) => `
                <span class="bg-white px-3 py-1 rounded-full text-xs border shadow-sm">
                  <span class="font-medium">${cat}:</span>
                  <span class="text-green-600 ml-1">${data.matched}✓</span>
                  ${data.mismatched > 0 ? `<span class="text-red-600 ml-1">${data.mismatched}✗</span>` : ''}
                </span>
              `).join('')}
            </div>
          ` : ''}
        </div>
        ${summary.topCheckers.length > 0 ? `
          <div class="flex items-center gap-2 text-xs text-gray-500">
            <span><i class="fas fa-user-check mr-1"></i>Petugas:</span>
            ${summary.topCheckers.map(c => `<span class="bg-white px-2 py-1 rounded shadow-sm">${c.name} (${c.count})</span>`).join('')}
          </div>
        ` : ''}
        ${opname.notes ? `<p class="text-sm text-gray-500 mt-3"><i class="fas fa-sticky-note mr-1"></i>${opname.notes}</p>` : ''}
      </div>
      
      <!-- Search & Export Bar -->
      <div class="px-6 py-4 border-b bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div class="flex-1 max-w-md">
          <div class="relative">
            <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input type="text" id="opname-search-input" placeholder="Cari nama produk, kode unit, kategori..." 
              class="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500">
          </div>
        </div>
        <div class="flex gap-2">
          <button onclick="exportOpnameToCSV()" class="px-4 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 flex items-center gap-2 shadow-md">
            <i class="fas fa-file-csv"></i> CSV
          </button>
          <button onclick="exportOpnameToExcel()" class="px-4 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 flex items-center gap-2 shadow-md">
            <i class="fas fa-file-excel"></i> Excel
          </button>
        </div>
      </div>
      
      <!-- Table Content -->
      <div id="opname-detail-content" class="flex-1 overflow-y-auto p-6">
        <!-- Table will be rendered here -->
      </div>
      
      <!-- Footer -->
      <div class="bg-gray-50 px-6 py-4 border-t flex justify-between items-center">
        <span id="opname-detail-count" class="text-sm text-gray-600">Total: ${items.length} item</span>
        <button onclick="closeOpnameDetailModal()" class="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300">
          Tutup
        </button>
      </div>
    </div>
  `;

  // Show modal
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  // Render initial table
  renderOpnameDetailTable(items);

  // Setup search
  const searchInput = document.getElementById('opname-search-input');
  searchInput?.addEventListener('input', debounceOpnameSearch);
}

// Close modal function
function closeOpnameDetailModal() {
  const modal = document.getElementById('opname-detail-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

// Debounce for search
let _opnameSearchTimeout;
function debounceOpnameSearch(e) {
  clearTimeout(_opnameSearchTimeout);
  _opnameSearchTimeout = setTimeout(() => {
    filterOpnameItems(e.target.value);
  }, 300);
}

// Filter items
function filterOpnameItems(query) {
  const allItems = window._opnameAllItems || [];
  const q = query.toLowerCase().trim();
  
  const filtered = q ? allItems.filter(item => {
    const name = (item.template?.name || '').toLowerCase();
    const code = (item.unit?.asset_code || item.unit?.serial_number || '').toLowerCase();
    const category = (item.template?.category?.name || '').toLowerCase();
    const checker = (item.checker?.full_name || '').toLowerCase();
    const notes = (item.notes || '').toLowerCase();
    
    return name.includes(q) || code.includes(q) || category.includes(q) || checker.includes(q) || notes.includes(q);
  }) : allItems;
  
  renderOpnameDetailTable(filtered);
  document.getElementById('opname-detail-count').textContent = `Menampilkan: ${filtered.length} dari ${allItems.length} item`;
}

// Render table
function renderOpnameDetailTable(items) {
  const content = document.getElementById('opname-detail-content');
  
  if (!items || items.length === 0) {
    content.innerHTML = `
      <div class="text-center py-12 text-gray-400">
        <i class="fas fa-search text-5xl mb-4"></i>
        <p class="text-lg">Tidak ada item yang cocok</p>
      </div>
    `;
    return;
  }
  
  const rows = items.map(item => `
    <tr class="border-b hover:bg-gray-50">
      <td class="p-3 font-medium">${item.template?.name || '-'}</td>
      <td class="p-3 font-mono text-xs">${item.unit?.asset_code || item.unit?.serial_number || "-"}</td>
      <td class="p-3 text-xs text-gray-500">${item.template?.category?.name || '-'}</td>
      <td class="p-3 text-center">${item.system_qty}</td>
      <td class="p-3 text-center font-bold ${item.actual_qty !== item.system_qty ? 'text-red-600' : 'text-green-600'}">${item.actual_qty}</td>
      <td class="p-3 text-center font-bold ${item.actual_qty !== item.system_qty ? 'text-red-600' : 'text-gray-400'}">${item.actual_qty - item.system_qty !== 0 ? (item.actual_qty - item.system_qty > 0 ? '+' : '') + (item.actual_qty - item.system_qty) : '-'}</td>
      <td class="p-3 text-sm text-gray-500 max-w-[150px] truncate" title="${item.notes || ''}">${item.notes || "-"}</td>
      <td class="p-3 text-xs text-gray-500">${item.checker?.full_name || '-'}</td>
      <td class="p-3 text-xs text-gray-400">${item.checked_at ? new Date(item.checked_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
    </tr>
  `).join("");
  
  content.innerHTML = `
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table class="min-w-full text-sm">
        <thead class="bg-gray-100 text-gray-600 sticky top-0">
          <tr>
            <th class="p-3 text-left">Produk</th>
            <th class="p-3 text-left">Kode Unit</th>
            <th class="p-3 text-left">Kategori</th>
            <th class="p-3 text-center">Sistem</th>
            <th class="p-3 text-center">Aktual</th>
            <th class="p-3 text-center">Selisih</th>
            <th class="p-3 text-left">Catatan</th>
            <th class="p-3 text-left">Petugas</th>
            <th class="p-3 text-left">Waktu Cek</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">${rows}</tbody>
      </table>
    </div>
  `;
}

// Make functions global
window.closeOpnameDetailModal = closeOpnameDetailModal;

// Export functions for Stock Opname
function exportOpnameToCSV() {
  const { opname, items, summary } = window._opnameExportData;
  if (!items || items.length === 0) { notifyError("Tidak ada data untuk diekspor"); return; }

  const headers = ['Produk', 'Kode Unit', 'Serial Number', 'Kategori', 'Qty Sistem', 'Qty Aktual', 'Selisih', 'Status', 'Catatan', 'Petugas', 'Waktu Cek'];
  const rows = items.map(item => [
    item.template?.name || '',
    item.unit?.asset_code || '',
    item.unit?.serial_number || '',
    item.template?.category?.name || '',
    item.system_qty,
    item.actual_qty,
    item.actual_qty - item.system_qty,
    item.system_qty === item.actual_qty ? 'Sesuai' : (item.actual_qty < item.system_qty ? 'Kurang' : 'Lebih'),
    (item.notes || '').replace(/"/g, '""'),
    item.checker?.full_name || '',
    item.checked_at ? new Date(item.checked_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : ''
  ]);

  // Add summary section
  const summaryRows = [
    [],
    ['RINGKASAN OPNAME'],
    ['Judul', opname.title],
    ['Periode', `${new Date(opname.start_date).toLocaleDateString('id-ID')} - ${opname.end_date ? new Date(opname.end_date).toLocaleDateString('id-ID') : 'Berlangsung'}`],
    ['Total Item Dicek', `${summary.totalChecked} dari ${summary.totalUnitsInInventory} unit`],
    ['Akurasi', `${summary.accuracyRate}%`],
    ['Sesuai', summary.matched],
    ['Tidak Sesuai', summary.mismatched],
    ['Kurang', summary.missing],
    ['Lebih', summary.excess],
    ['Total Qty Sistem', summary.totalSystemQty],
    ['Total Qty Aktual', summary.totalActualQty],
    ['Total Selisih', summary.totalDiscrepancy],
    []
  ];

  const allRows = [...summaryRows, headers, ...rows];
  const csv = allRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `opname_${opname.title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  notifySuccess("File CSV berhasil diunduh!");
}

function exportOpnameToExcel() {
  const { opname, items, summary } = window._opnameExportData;
  if (!items || items.length === 0) { notifyError("Tidak ada data untuk diekspor"); return; }

  const headers = ['Produk', 'Kode Unit', 'Serial Number', 'Kategori', 'Qty Sistem', 'Qty Aktual', 'Selisih', 'Status', 'Catatan', 'Petugas', 'Waktu Cek'];
  const rows = items.map(item => [
    item.template?.name || '',
    item.unit?.asset_code || '',
    item.unit?.serial_number || '',
    item.template?.category?.name || '',
    item.system_qty,
    item.actual_qty,
    item.actual_qty - item.system_qty,
    item.system_qty === item.actual_qty ? 'Sesuai' : (item.actual_qty < item.system_qty ? 'Kurang' : 'Lebih'),
    item.notes || '',
    item.checker?.full_name || '',
    item.checked_at ? new Date(item.checked_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : ''
  ]);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="header"><Font ss:Bold="1"/><Interior ss:Color="#E0E0E0" ss:Pattern="Solid"/></Style>
    <Style ss:ID="match"><Font ss:Color="#16A34A"/></Style>
    <Style ss:ID="mismatch"><Font ss:Color="#DC2626" ss:Bold="1"/></Style>
  </Styles>
  <Worksheet ss:Name="Ringkasan">
    <Table>
      <Row><Cell ss:StyleID="header"><Data ss:Type="String">RINGKASAN OPNAME: ${opname.title}</Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">Periode</Data></Cell><Cell><Data ss:Type="String">${new Date(opname.start_date).toLocaleDateString('id-ID')} - ${opname.end_date ? new Date(opname.end_date).toLocaleDateString('id-ID') : 'Berlangsung'}</Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">Total Item Dicek</Data></Cell><Cell><Data ss:Type="String">${summary.totalChecked} dari ${summary.totalUnitsInInventory} unit</Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">Akurasi</Data></Cell><Cell><Data ss:Type="String">${summary.accuracyRate}%</Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">Sesuai</Data></Cell><Cell><Data ss:Type="Number">${summary.matched}</Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">Tidak Sesuai</Data></Cell><Cell><Data ss:Type="Number">${summary.mismatched}</Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">Kurang</Data></Cell><Cell><Data ss:Type="Number">${summary.missing}</Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">Lebih</Data></Cell><Cell><Data ss:Type="Number">${summary.excess}</Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">Total Selisih Qty</Data></Cell><Cell><Data ss:Type="Number">${summary.totalDiscrepancy}</Data></Cell></Row>
    </Table>
  </Worksheet>
  <Worksheet ss:Name="Detail Item">
    <Table>
      <Row>${headers.map(h => `<Cell ss:StyleID="header"><Data ss:Type="String">${h}</Data></Cell>`).join('')}</Row>
      ${rows.map(row => `<Row>${row.map((cell, idx) => {
        const styleId = idx === 7 ? (cell === 'Sesuai' ? 'match' : 'mismatch') : '';
        return `<Cell${styleId ? ` ss:StyleID="${styleId}"` : ''}><Data ss:Type="${typeof cell === 'number' ? 'Number' : 'String'}">${cell}</Data></Cell>`;
      }).join('')}</Row>`).join('\n      ')}
    </Table>
  </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `opname_${opname.title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.xls`;
  link.click();
  notifySuccess("File Excel berhasil diunduh!");
}
