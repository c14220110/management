/**
 * Barang (Inventory) Page Module - New Inventory System
 * Handles product templates, units, borrowing for management & member
 */

let fullCalendarInstance;
let calendarResizeObserver = null;

const ASSET_QR_LIBRARY_URL = "https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js";
const ASSET_JSQR_LIBRARY_URL = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";

const productInventoryState = {
  templates: [],
  locations: [],
  categories: [],
  commissions: [],
  search: "",
};

const memberInventoryState = {
  items: [],
  search: "",
};

const assetScanState = {
  modal: null, video: null, canvas: null, context: null,
  messageEl: null, stream: null, frameId: null, onDetected: null,
};

const loadedExternalScripts = {};

// ============================================================
// PAGE LOADER
// ============================================================
async function loadBarangPage() {
  const contentArea = document.getElementById("content-area");
  showLoader();
  try {
    contentArea.innerHTML = "";
    const template = document.getElementById("barang-template").content.cloneNode(true);
    contentArea.appendChild(template);
    await renderBarangListView();
  } catch (error) {
    contentArea.innerHTML = `<p class="text-red-500">Error: ${error.message}</p>`;
  } finally {
    hideLoader();
  }
}

async function renderBarangListView() {
  const role = localStorage.getItem("userRole");
  if (role === "management") {
    await renderBarangManagementView();
  } else {
    await renderBarangMemberView();
  }
}

// ============================================================
// MANAGEMENT VIEW
// ============================================================
async function renderBarangManagementView() {
  const container = document.getElementById("barang-content-area");
  container.innerHTML = `<div class="bg-white rounded-lg shadow-md p-6"><p class="text-gray-500">Memuat data inventori...</p></div>`;

  try {
    await ensureInventoryMeta();
    const templates = await fetchProductTemplates();
    productInventoryState.templates = templates || [];
    const visible = filterProductTemplates(productInventoryState.templates, productInventoryState.search);

    container.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-col gap-4 md:flex-row md:items-center">
          <div class="flex-1 relative">
            <span class="absolute inset-y-0 left-3 flex items-center text-gray-400"><i class="fas fa-search"></i></span>
            <input id="product-search-input" type="text" value="${productInventoryState.search || ""}"
              placeholder="Cari nama produk, kategori, lokasi..."
              class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#d97706] focus:border-[#d97706]"/>
          </div>
          <div class="flex gap-3">
            <button id="product-scan-btn" class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 flex items-center gap-2" type="button">
              <i class="fas fa-qrcode"></i> Scan QR
            </button>
            <button id="product-add-btn" class="px-4 py-2 bg-[#d97706] text-white font-semibold rounded-md hover:bg-[#b45309] flex items-center gap-2" type="button">
              <i class="fas fa-plus"></i> Tambah Produk
            </button>
            <button id="product-refresh-btn" class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 flex items-center gap-2" type="button">
              <i class="fas fa-sync"></i> Refresh
            </button>
          </div>
        </div>
        <div class="bg-white rounded-lg shadow-md overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <tr>
                <th class="p-3">Produk</th>
                <th class="p-3">Kategori</th>
                <th class="p-3">Lokasi</th>
                <th class="p-3">Tipe</th>
                <th class="p-3">Stok</th>
                <th class="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>${getTemplateRowsHTML(visible)}</tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById("product-search-input")?.addEventListener("input", (e) => scheduleTemplateSearch(e.target.value));
    document.getElementById("product-add-btn")?.addEventListener("click", () => openProductTemplateModal());
    document.getElementById("product-scan-btn")?.addEventListener("click", () => openAssetScanModal(handleInventoryScan));
    document.getElementById("product-refresh-btn")?.addEventListener("click", () => renderBarangManagementView());
    bindTemplateRowActions(container);
  } catch (error) {
    container.innerHTML = `<div class="bg-red-50 text-red-700 p-4 rounded-md"><p class="font-semibold">Gagal memuat data.</p><p class="text-sm mt-1">${error.message}</p></div>`;
  }
}

function getTemplateRowsHTML(templates = []) {
  if (!templates.length) {
    return `<tr><td colspan="6" class="p-6 text-center text-gray-500">Belum ada data produk.</td></tr>`;
  }
  return templates.map((t) => {
    const photo = t.photo_url || "https://placehold.co/48x48?text=📦";
    const stock = t.stock || { total: 0, available: 0 };
    const typeLabel = t.is_serialized ? '<span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Serialized</span>' : '<span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Non-Serial</span>';
    return `
      <tr class="border-b last:border-b-0 hover:bg-gray-50">
        <td class="p-3">
          <div class="flex items-center gap-3">
            <img src="${photo}" alt="${t.name}" class="w-12 h-12 rounded-md object-cover bg-gray-100"/>
            <div>
              <p class="font-medium text-gray-900">${t.name}</p>
              <p class="text-xs text-gray-500">${t.description || "-"}</p>
            </div>
          </div>
        </td>
        <td class="p-3"><span class="text-xs bg-gray-100 px-2 py-1 rounded">${t.category?.name || "-"}</span></td>
        <td class="p-3">${t.default_location?.name || "-"}</td>
        <td class="p-3">${typeLabel}</td>
        <td class="p-3">
          <div class="text-sm">
            <span class="font-semibold text-green-600">${stock.available}</span>
            <span class="text-gray-400">/ ${stock.total}</span>
            ${stock.borrowed > 0 ? `<span class="text-xs text-orange-500 ml-1">(${stock.borrowed} dipinjam)</span>` : ""}
          </div>
        </td>
        <td class="p-3 text-center">
          <button type="button" class="template-action-menu action-menu-btn inline-flex items-center justify-center rounded-md border border-gray-300 shadow-sm px-3 py-2 bg-white text-gray-700 hover:bg-gray-50" data-template-id="${t.id}">
            <i class="fas fa-ellipsis-v"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

let templateSearchTimeout;
function scheduleTemplateSearch(value) {
  clearTimeout(templateSearchTimeout);
  templateSearchTimeout = setTimeout(() => {
    productInventoryState.search = value;
    renderBarangManagementView();
  }, 300);
}

function filterProductTemplates(templates, search) {
  if (!search) return templates;
  const q = search.toLowerCase();
  return templates.filter((t) =>
    t.name?.toLowerCase().includes(q) ||
    t.category?.name?.toLowerCase().includes(q) ||
    t.default_location?.name?.toLowerCase().includes(q)
  );
}

function bindTemplateRowActions(root) {
  root.querySelectorAll(".template-action-menu").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      const templateId = btn.dataset.templateId;
      const template = productInventoryState.templates.find((t) => t.id === templateId);
      if (!template) return;

      const items = [
        { label: "Lihat Detail", icon: "fas fa-eye", className: "text-gray-700", onClick: () => renderTemplateDetailView(templateId) },
        { label: "Edit", icon: "fas fa-edit", className: "text-amber-600", onClick: () => openProductTemplateModal(template) },
        ...(template.is_serialized ? [
          { label: "Tambah Unit", icon: "fas fa-plus-circle", className: "text-green-600", onClick: () => openProductUnitModal({ templateId }) },
        ] : [
          { label: "Adjust Stok", icon: "fas fa-boxes", className: "text-blue-600", onClick: () => openAdjustStockModal(template) },
        ]),
        { label: "Hapus Produk", icon: "fas fa-trash", className: "text-red-600", onClick: () => confirmDeleteTemplate(templateId) },
      ];

      if (typeof openGlobalActionMenu === "function") {
        openGlobalActionMenu({ triggerElement: btn, items });
      }
    });
  });
}

// ============================================================
// MEMBER VIEW
// ============================================================
async function renderBarangMemberView() {
  const container = document.getElementById("barang-content-area");
  container.innerHTML = `<div class="bg-white rounded-lg shadow-md p-6"><p class="text-gray-500">Memuat inventori...</p></div>`;

  try {
    const items = await fetchMemberInventory();
    memberInventoryState.items = items || [];
    const visible = filterMemberInventory(memberInventoryState.items, memberInventoryState.search);

    container.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-col gap-4 md:flex-row md:items-center">
          <div class="flex-1 relative">
            <span class="absolute inset-y-0 left-3 flex items-center text-gray-400"><i class="fas fa-search"></i></span>
            <input id="member-inventory-search" type="text" value="${memberInventoryState.search || ""}"
              placeholder="Cari nama barang..."
              class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#d97706] focus:border-[#d97706]"/>
          </div>
          <button id="member-refresh-btn" class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 flex items-center gap-2" type="button">
            <i class="fas fa-sync"></i> Refresh
          </button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          ${getMemberInventoryCardsHTML(visible)}
        </div>
      </div>
    `;

    document.getElementById("member-inventory-search")?.addEventListener("input", (e) => {
      memberInventoryState.search = e.target.value;
      renderBarangMemberView();
    });
    document.getElementById("member-refresh-btn")?.addEventListener("click", () => renderBarangMemberView());
    bindMemberInventoryCards(container);
  } catch (error) {
    container.innerHTML = `<div class="bg-red-50 text-red-700 p-4 rounded-md"><p>${error.message}</p></div>`;
  }
}

function filterMemberInventory(items, search) {
  if (!search) return items;
  const q = search.toLowerCase();
  return items.filter((i) => i.name?.toLowerCase().includes(q) || i.category?.name?.toLowerCase().includes(q));
}

function getMemberInventoryCardsHTML(items) {
  if (!items.length) return `<div class="col-span-full text-center text-gray-500 py-12">Tidak ada barang yang tersedia untuk dipinjam.</div>`;
  return items.map((item) => {
    const photo = item.photo_url || "https://placehold.co/200x150?text=📦";
    const stock = item.stock || { available: 0, total: 0 };
    const typeLabel = item.is_serialized ? "Pilih Unit" : "Pilih Qty";
    return `
      <div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
        <img src="${photo}" alt="${item.name}" class="w-full h-32 object-cover bg-gray-100"/>
        <div class="p-4">
          <h3 class="font-semibold text-gray-900 truncate">${item.name}</h3>
          <p class="text-xs text-gray-500 mt-1">${item.category?.name || "-"} • ${item.default_location?.name || "-"}</p>
          <div class="mt-2 flex items-center justify-between">
            <span class="text-sm"><span class="font-bold text-green-600">${stock.available}</span> tersedia</span>
            <button type="button" class="member-borrow-btn px-3 py-1 bg-[#d97706] text-white text-sm rounded hover:bg-[#b45309]" data-template-id="${item.id}" data-is-serialized="${item.is_serialized}">
              ${typeLabel}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function bindMemberInventoryCards(container) {
  container.querySelectorAll(".member-borrow-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const templateId = btn.dataset.templateId;
      const isSerialized = btn.dataset.isSerialized === "true";
      openMemberBorrowModal(templateId, isSerialized);
    });
  });
}

// ============================================================
// API CALLS
// ============================================================
async function fetchProductTemplates() {
  const token = localStorage.getItem("authToken");
  const res = await fetch("/api/management", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: "getProductTemplates" }),
  });
  if (!res.ok) throw new Error("Gagal mengambil data produk");
  return res.json();
}

async function ensureInventoryMeta() {
  if (productInventoryState.categories.length && productInventoryState.locations.length) return;
  const token = localStorage.getItem("authToken");
  const res = await fetch("/api/management", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: "getAssetMeta" }),
  });
  if (!res.ok) throw new Error("Gagal mengambil metadata");
  const data = await res.json();
  productInventoryState.categories = data.categories || [];
  productInventoryState.locations = data.locations || [];
  productInventoryState.commissions = data.commissions || [];
}

async function fetchMemberInventory() {
  const token = localStorage.getItem("authToken");
  const res = await fetch("/api/member?resource=inventory", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Gagal mengambil data inventori");
  return res.json();
}

async function fetchProductUnits(templateId) {
  const token = localStorage.getItem("authToken");
  const res = await fetch("/api/management", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: "getProductUnits", payload: { templateId } }),
  });
  if (!res.ok) throw new Error("Gagal mengambil data unit");
  return res.json();
}

async function fetchMemberAvailableUnits(templateId) {
  const token = localStorage.getItem("authToken");
  const res = await fetch(`/api/member?resource=inventory&templateId=${templateId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Gagal mengambil unit tersedia");
  return res.json();
}

// ============================================================
// MODALS - PRODUCT TEMPLATE
// ============================================================
function openProductTemplateModal(existing = null) {
  const isEdit = !!existing;
  const title = isEdit ? "Edit Produk" : "Tambah Produk Baru";
  
  const categoryOptions = productInventoryState.categories.map((c) => 
    `<option value="${c.id}" ${existing?.category?.id === c.id ? "selected" : ""}>${c.name}</option>`
  ).join("");
  
  const locationOptions = productInventoryState.locations.map((l) => 
    `<option value="${l.id}" ${existing?.default_location?.id === l.id ? "selected" : ""}>${l.name} (${l.code || "-"})</option>`
  ).join("");

  const content = `
    <form id="product-template-form" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Nama Produk *</label>
        <input type="text" name="name" value="${existing?.name || ""}" required class="w-full px-3 py-2 border border-gray-300 rounded-md"/>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
        <textarea name="description" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-md">${existing?.description || ""}</textarea>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
          <select name="category_id" class="w-full px-3 py-2 border border-gray-300 rounded-md">
            <option value="">-- Pilih --</option>
            ${categoryOptions}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Lokasi Default</label>
          <select name="default_location_id" class="w-full px-3 py-2 border border-gray-300 rounded-md">
            <option value="">-- Pilih --</option>
            ${locationOptions}
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Tipe Tracking</label>
          <select name="is_serialized" class="w-full px-3 py-2 border border-gray-300 rounded-md" ${isEdit ? "disabled" : ""}>
            <option value="true" ${existing?.is_serialized !== false ? "selected" : ""}>Serialized (per unit)</option>
            <option value="false" ${existing?.is_serialized === false ? "selected" : ""}>Non-Serialized (quantity)</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">UoM</label>
          <input type="text" name="uom" value="${existing?.uom || "unit"}" class="w-full px-3 py-2 border border-gray-300 rounded-md"/>
        </div>
      </div>
      ${!isEdit || existing?.is_serialized === false ? `
      <div class="grid grid-cols-2 gap-4" id="quantity-fields">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Stok Awal</label>
          <input type="number" name="quantity_on_hand" value="${existing?.quantity_on_hand || 0}" min="0" class="w-full px-3 py-2 border border-gray-300 rounded-md"/>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Min. Stok (alert)</label>
          <input type="number" name="min_quantity" value="${existing?.min_quantity || 0}" min="0" class="w-full px-3 py-2 border border-gray-300 rounded-md"/>
        </div>
      </div>
      ` : ""}
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">URL Foto</label>
        <input type="text" name="photo_url" value="${existing?.photo_url || ""}" placeholder="https://..." class="w-full px-3 py-2 border border-gray-300 rounded-md"/>
      </div>
    </form>
  `;

  openGlobalModal({
    title,
    contentHTML: content,
    confirmText: isEdit ? "Simpan" : "Tambah",
    onConfirm: () => handleProductTemplateSubmit(existing?.id),
  });
}

async function handleProductTemplateSubmit(existingId) {
  const form = document.getElementById("product-template-form");
  const formData = new FormData(form);
  const payload = {
    name: formData.get("name"),
    description: formData.get("description") || null,
    category_id: formData.get("category_id") || null,
    default_location_id: formData.get("default_location_id") || null,
    is_serialized: formData.get("is_serialized") === "true",
    uom: formData.get("uom") || "unit",
    photo_url: formData.get("photo_url") || null,
  };

  if (!payload.is_serialized) {
    payload.quantity_on_hand = parseInt(formData.get("quantity_on_hand") || "0", 10);
    payload.min_quantity = parseInt(formData.get("min_quantity") || "0", 10);
  }

  const action = existingId ? "updateProductTemplate" : "createProductTemplate";
  if (existingId) payload.id = existingId;

  try {
    const token = localStorage.getItem("authToken");
    const res = await fetch("/api/management", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, payload }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Gagal menyimpan");
    }
    closeGlobalModal();
    notifySuccess(`Produk berhasil ${existingId ? "diperbarui" : "ditambahkan"}!`);
    await renderBarangManagementView();
  } catch (error) {
    alert(error.message);
  }
}

// ============================================================
// MODALS - ADJUST STOCK (Non-serialized)
// ============================================================
function openAdjustStockModal(template) {
  const content = `
    <form id="adjust-stock-form" class="space-y-4">
      <p class="text-gray-600">Stok saat ini: <strong>${template.quantity_on_hand || 0}</strong> ${template.uom || "unit"}</p>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Adjustment</label>
        <div class="flex gap-2">
          <select name="type" class="px-3 py-2 border border-gray-300 rounded-md">
            <option value="add">Tambah (+)</option>
            <option value="subtract">Kurang (-)</option>
          </select>
          <input type="number" name="amount" min="1" value="1" required class="flex-1 px-3 py-2 border border-gray-300 rounded-md"/>
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Catatan (opsional)</label>
        <input type="text" name="notes" class="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Alasan adjust..."/>
      </div>
    </form>
  `;

  openGlobalModal({
    title: `Adjust Stok: ${template.name}`,
    contentHTML: content,
    confirmText: "Simpan",
    onConfirm: () => handleAdjustStock(template.id),
  });
}

async function handleAdjustStock(templateId) {
  const form = document.getElementById("adjust-stock-form");
  const formData = new FormData(form);
  const type = formData.get("type");
  const amount = parseInt(formData.get("amount") || "0", 10);
  const notes = formData.get("notes");
  
  const adjustment = type === "subtract" ? -amount : amount;

  try {
    const token = localStorage.getItem("authToken");
    const res = await fetch("/api/management", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "adjustProductQuantity", payload: { templateId, adjustment, notes } }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Gagal adjust stok");
    }
    closeGlobalModal();
    notifySuccess("Stok berhasil diupdate!");
    await renderBarangManagementView();
  } catch (error) {
    alert(error.message);
  }
}

// ============================================================
// MODALS - PRODUCT UNIT
// ============================================================
function openProductUnitModal(opts = {}) {
  const { templateId, existing = null } = opts;
  const isEdit = !!existing;
  const title = isEdit ? "Edit Unit" : "Tambah Unit Baru";

  const locationOptions = productInventoryState.locations.map((l) => 
    `<option value="${l.id}" ${existing?.location?.id === l.id ? "selected" : ""}>${l.name}</option>`
  ).join("");

  const content = `
    <form id="product-unit-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Kode Aset</label>
          <input type="text" name="asset_code" value="${existing?.asset_code || ""}" class="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="MSK-GSG1-001"/>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
          <input type="text" name="serial_number" value="${existing?.serial_number || ""}" class="w-full px-3 py-2 border border-gray-300 rounded-md"/>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Lokasi</label>
          <select name="location_id" class="w-full px-3 py-2 border border-gray-300 rounded-md">
            <option value="">-- Pilih --</option>
            ${locationOptions}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Kondisi</label>
          <select name="condition" class="w-full px-3 py-2 border border-gray-300 rounded-md">
            <option value="Baik" ${existing?.condition === "Baik" ? "selected" : ""}>Baik</option>
            <option value="Perlu Perbaikan" ${existing?.condition === "Perlu Perbaikan" ? "selected" : ""}>Perlu Perbaikan</option>
            <option value="Rusak" ${existing?.condition === "Rusak" ? "selected" : ""}>Rusak</option>
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Tanggal Beli</label>
          <input type="date" name="purchase_date" value="${existing?.purchase_date || ""}" class="w-full px-3 py-2 border border-gray-300 rounded-md"/>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Harga Beli</label>
          <input type="number" name="purchase_price" value="${existing?.purchase_price || ""}" class="w-full px-3 py-2 border border-gray-300 rounded-md"/>
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
        <textarea name="notes" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-md">${existing?.notes || ""}</textarea>
      </div>
    </form>
  `;

  openGlobalModal({
    title,
    contentHTML: content,
    confirmText: isEdit ? "Simpan" : "Tambah",
    onConfirm: () => handleProductUnitSubmit(templateId, existing?.id),
  });
}

async function handleProductUnitSubmit(templateId, existingId) {
  const form = document.getElementById("product-unit-form");
  const formData = new FormData(form);
  const payload = {
    template_id: templateId,
    asset_code: formData.get("asset_code") || null,
    serial_number: formData.get("serial_number") || null,
    location_id: formData.get("location_id") || null,
    condition: formData.get("condition") || null,
    purchase_date: formData.get("purchase_date") || null,
    purchase_price: formData.get("purchase_price") || null,
    notes: formData.get("notes") || null,
  };

  const action = existingId ? "updateProductUnit" : "createProductUnit";
  if (existingId) payload.unitId = existingId;

  try {
    const token = localStorage.getItem("authToken");
    const res = await fetch("/api/management", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, payload }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Gagal menyimpan");
    }
    closeGlobalModal();
    notifySuccess(`Unit berhasil ${existingId ? "diperbarui" : "ditambahkan"}!`);
    // Refresh detail view if showing
    const detailContainer = document.getElementById("template-detail-container");
    if (detailContainer) {
      await renderTemplateDetailView(templateId);
    }
  } catch (error) {
    alert(error.message);
  }
}

// ============================================================
// TEMPLATE DETAIL VIEW
// ============================================================
async function renderTemplateDetailView(templateId) {
  const container = document.getElementById("barang-content-area");
  container.innerHTML = `<div class="bg-white rounded-lg shadow-md p-6"><p class="text-gray-500">Memuat detail...</p></div>`;

  try {
    const template = productInventoryState.templates.find((t) => t.id === templateId);
    if (!template) throw new Error("Produk tidak ditemukan");

    let unitsHTML = "";
    if (template.is_serialized) {
      const units = await fetchProductUnits(templateId);
      unitsHTML = getUnitsTableHTML(units, templateId);
    } else {
      unitsHTML = `
        <div class="bg-gray-50 p-4 rounded-md">
          <p class="text-gray-600">Produk ini <strong>non-serialized</strong>. Stok ditrack berdasarkan quantity.</p>
          <p class="mt-2">Stok saat ini: <strong class="text-green-600">${template.quantity_on_hand || 0}</strong> ${template.uom || "unit"}</p>
          <button type="button" id="adjust-stock-detail-btn" class="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            <i class="fas fa-boxes mr-1"></i> Adjust Stok
          </button>
        </div>
      `;
    }

    container.innerHTML = `
      <div id="template-detail-container" class="space-y-6">
        <div class="flex items-center gap-4">
          <button id="back-to-list-btn" class="p-2 rounded-md hover:bg-gray-100"><i class="fas fa-arrow-left text-gray-600"></i></button>
          <h2 class="text-2xl font-bold text-gray-800">${template.name}</h2>
        </div>
        <div class="bg-white rounded-lg shadow-md p-6">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <img src="${template.photo_url || "https://placehold.co/300x200?text=📦"}" alt="${template.name}" class="w-full rounded-lg object-cover"/>
            </div>
            <div class="md:col-span-2 space-y-3">
              <p><strong>Deskripsi:</strong> ${template.description || "-"}</p>
              <p><strong>Kategori:</strong> ${template.category?.name || "-"}</p>
              <p><strong>Lokasi Default:</strong> ${template.default_location?.name || "-"}</p>
              <p><strong>Tipe:</strong> ${template.is_serialized ? "Serialized (per unit)" : "Non-Serialized (quantity)"}</p>
              <p><strong>UoM:</strong> ${template.uom || "unit"}</p>
            </div>
          </div>
        </div>
        <div class="bg-white rounded-lg shadow-md p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold">${template.is_serialized ? "Daftar Unit" : "Informasi Stok"}</h3>
            ${template.is_serialized ? `<button id="add-unit-btn" class="px-3 py-1 bg-[#d97706] text-white text-sm rounded hover:bg-[#b45309]"><i class="fas fa-plus mr-1"></i> Tambah Unit</button>` : ""}
          </div>
          ${unitsHTML}
        </div>
      </div>
    `;

    document.getElementById("back-to-list-btn")?.addEventListener("click", () => renderBarangManagementView());
    document.getElementById("add-unit-btn")?.addEventListener("click", () => openProductUnitModal({ templateId }));
    document.getElementById("adjust-stock-detail-btn")?.addEventListener("click", () => openAdjustStockModal(template));
    bindUnitRowActions(container, templateId);
  } catch (error) {
    container.innerHTML = `<div class="bg-red-50 text-red-700 p-4 rounded-md"><p>${error.message}</p></div>`;
  }
}

function getUnitsTableHTML(units, templateId) {
  if (!units.length) {
    return `<p class="text-gray-500 text-center py-6">Belum ada unit. Klik "Tambah Unit" untuk menambahkan.</p>`;
  }
  const rows = units.map((u) => {
    const statusBadge = getUnitStatusBadge(u.status);
    return `
      <tr class="border-b hover:bg-gray-50">
        <td class="p-3 font-mono text-sm">${u.asset_code || "-"}</td>
        <td class="p-3 text-sm">${u.serial_number || "-"}</td>
        <td class="p-3">${statusBadge}</td>
        <td class="p-3 text-sm">${u.condition || "-"}</td>
        <td class="p-3 text-sm">${u.location?.name || "-"}</td>
        <td class="p-3 text-center">
          <button type="button" class="unit-action-menu action-menu-btn px-2 py-1 text-gray-500 hover:text-gray-700" data-unit-id="${u.id}">
            <i class="fas fa-ellipsis-v"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");
  return `
    <table class="min-w-full text-sm">
      <thead class="bg-gray-100 text-xs font-semibold text-gray-600 uppercase">
        <tr>
          <th class="p-3 text-left">Kode Aset</th>
          <th class="p-3 text-left">Serial Number</th>
          <th class="p-3 text-left">Status</th>
          <th class="p-3 text-left">Kondisi</th>
          <th class="p-3 text-left">Lokasi</th>
          <th class="p-3 text-center">Aksi</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function getUnitStatusBadge(status) {
  const colors = {
    available: "bg-green-100 text-green-800",
    borrowed: "bg-orange-100 text-orange-800",
    maintenance: "bg-yellow-100 text-yellow-800",
    lost: "bg-red-100 text-red-800",
    scrapped: "bg-gray-100 text-gray-800",
  };
  return `<span class="text-xs px-2 py-1 rounded ${colors[status] || "bg-gray-100 text-gray-800"}">${status}</span>`;
}

function bindUnitRowActions(container, templateId) {
  container.querySelectorAll(".unit-action-menu").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const unitId = btn.dataset.unitId;
      const items = [
        { label: "Edit Unit", icon: "fas fa-edit", className: "text-amber-600", onClick: () => editUnit(templateId, unitId) },
        { label: "Hapus Unit", icon: "fas fa-trash", className: "text-red-600", onClick: () => confirmDeleteUnit(templateId, unitId) },
      ];
      if (typeof openGlobalActionMenu === "function") {
        openGlobalActionMenu({ triggerElement: btn, items });
      }
    });
  });
}

async function editUnit(templateId, unitId) {
  const units = await fetchProductUnits(templateId);
  const unit = units.find((u) => u.id === unitId);
  if (unit) openProductUnitModal({ templateId, existing: unit });
}

async function confirmDeleteUnit(templateId, unitId) {
  if (!confirm("Yakin hapus unit ini?")) return;
  try {
    const token = localStorage.getItem("authToken");
    const res = await fetch("/api/management", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "deleteProductUnit", payload: { unitId } }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Gagal menghapus");
    }
    notifySuccess("Unit berhasil dihapus!");
    await renderTemplateDetailView(templateId);
  } catch (error) {
    alert(error.message);
  }
}

async function confirmDeleteTemplate(templateId) {
  if (!confirm("Yakin hapus produk ini? Semua unit terkait juga akan dihapus.")) return;
  try {
    const token = localStorage.getItem("authToken");
    const res = await fetch("/api/management", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "deleteProductTemplate", payload: { templateId } }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Gagal menghapus");
    }
    notifySuccess("Produk berhasil dihapus!");
    await renderBarangManagementView();
  } catch (error) {
    alert(error.message);
  }
}

// ============================================================
// MEMBER BORROW MODAL
// ============================================================
async function openMemberBorrowModal(templateId, isSerialized) {
  const item = memberInventoryState.items.find((i) => i.id === templateId);
  if (!item) return;

  let unitsOptions = "";
  if (isSerialized) {
    try {
      const units = await fetchMemberAvailableUnits(templateId);
      unitsOptions = units.map((u) => `<option value="${u.id}">${u.asset_code || u.serial_number || u.id}</option>`).join("");
      if (!units.length) {
        alert("Tidak ada unit yang tersedia untuk dipinjam.");
        return;
      }
    } catch (e) {
      alert(e.message);
      return;
    }
  }

  const content = `
    <form id="member-borrow-form" class="space-y-4">
      <p class="text-gray-600">Produk: <strong>${item.name}</strong></p>
      ${isSerialized ? `
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Pilih Unit</label>
          <select name="unit_id" required class="w-full px-3 py-2 border border-gray-300 rounded-md">${unitsOptions}</select>
        </div>
      ` : `
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Jumlah (max: ${item.stock?.available || 0})</label>
          <input type="number" name="quantity" min="1" max="${item.stock?.available || 1}" value="1" required class="w-full px-3 py-2 border border-gray-300 rounded-md"/>
        </div>
      `}
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Tanggal Pinjam</label>
          <input type="date" name="loan_date" required class="w-full px-3 py-2 border border-gray-300 rounded-md"/>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Tanggal Kembali</label>
          <input type="date" name="due_date" required class="w-full px-3 py-2 border border-gray-300 rounded-md"/>
        </div>
      </div>
    </form>
  `;

  openGlobalModal({
    title: "Ajukan Peminjaman",
    contentHTML: content,
    confirmText: "Ajukan",
    onConfirm: () => handleMemberBorrowSubmit(templateId, isSerialized),
  });

  // Set default dates
  const today = new Date().toISOString().split("T")[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  document.querySelector('[name="loan_date"]').value = today;
  document.querySelector('[name="due_date"]').value = nextWeek;
}

async function handleMemberBorrowSubmit(templateId, isSerialized) {
  const form = document.getElementById("member-borrow-form");
  const formData = new FormData(form);
  
  const body = {
    loan_date: formData.get("loan_date"),
    due_date: formData.get("due_date"),
  };

  if (isSerialized) {
    body.unit_id = formData.get("unit_id");
  } else {
    body.template_id = templateId;
    body.quantity = parseInt(formData.get("quantity"), 10);
  }

  try {
    const token = localStorage.getItem("authToken");
    const res = await fetch("/api/member?resource=inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Gagal mengajukan peminjaman");
    }
    closeGlobalModal();
    notifySuccess("Permintaan peminjaman berhasil diajukan!");
    await renderBarangMemberView();
  } catch (error) {
    alert(error.message);
  }
}

// ============================================================
// QR SCAN
// ============================================================
async function loadExternalScript(url) {
  if (loadedExternalScripts[url]) return true;
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = url;
    s.onload = () => { loadedExternalScripts[url] = true; resolve(true); };
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

async function openAssetScanModal(onDetected) {
  const ok = await loadExternalScript(ASSET_JSQR_LIBRARY_URL);
  if (!ok || typeof jsQR !== "function") {
    alert("Gagal memuat library QR scanner.");
    return;
  }

  const modalHTML = `
    <div id="asset-scan-modal" class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden">
        <div class="flex justify-between items-center p-4 border-b">
          <h3 class="font-semibold text-lg">Scan QR Code</h3>
          <button id="close-scan-modal" class="text-gray-500 hover:text-gray-700"><i class="fas fa-times"></i></button>
        </div>
        <div class="p-4">
          <video id="asset-scan-video" class="w-full rounded-md bg-black" autoplay playsinline></video>
          <canvas id="asset-scan-canvas" class="hidden"></canvas>
          <p id="asset-scan-message" class="text-center text-gray-500 mt-3">Arahkan kamera ke QR code...</p>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHTML);

  assetScanState.modal = document.getElementById("asset-scan-modal");
  assetScanState.video = document.getElementById("asset-scan-video");
  assetScanState.canvas = document.getElementById("asset-scan-canvas");
  assetScanState.context = assetScanState.canvas.getContext("2d");
  assetScanState.messageEl = document.getElementById("asset-scan-message");
  assetScanState.onDetected = onDetected;

  document.getElementById("close-scan-modal").onclick = closeAssetScanModal;

  try {
    assetScanState.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    assetScanState.video.srcObject = assetScanState.stream;
    assetScanState.video.play();
    requestAnimationFrame(scanAssetFrame);
  } catch (e) {
    assetScanState.messageEl.textContent = "Gagal mengakses kamera: " + e.message;
  }
}

function scanAssetFrame() {
  if (!assetScanState.video || assetScanState.video.readyState !== assetScanState.video.HAVE_ENOUGH_DATA) {
    assetScanState.frameId = requestAnimationFrame(scanAssetFrame);
    return;
  }
  const { video, canvas, context } = assetScanState;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
  if (code && code.data) {
    if (assetScanState.onDetected) assetScanState.onDetected(code.data);
    closeAssetScanModal();
    return;
  }
  assetScanState.frameId = requestAnimationFrame(scanAssetFrame);
}

function closeAssetScanModal() {
  if (assetScanState.frameId) cancelAnimationFrame(assetScanState.frameId);
  if (assetScanState.stream) assetScanState.stream.getTracks().forEach((t) => t.stop());
  if (assetScanState.modal) assetScanState.modal.remove();
  Object.keys(assetScanState).forEach((k) => (assetScanState[k] = null));
}

async function handleInventoryScan(code) {
  try {
    const token = localStorage.getItem("authToken");
    const res = await fetch("/api/management", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "findUnitByCode", payload: { code } }),
    });
    if (!res.ok) throw new Error("Unit tidak ditemukan");
    const unit = await res.json();
    if (unit?.template_id) {
      await renderTemplateDetailView(unit.template_id);
    }
  } catch (e) {
    alert(e.message);
  }
}

// Global expose
window.loadBarangPage = loadBarangPage;
window.renderBarangListView = renderBarangListView;
