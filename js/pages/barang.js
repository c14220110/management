/**
 * Barang (Inventory) Page Module - With Image Upload & Dynamic Category/Location
 */

const productInventoryState = {
  templates: [],
  locations: [],
  categories: [],
  commissions: [],
  search: "",
  selectedCategory: "all",
};

const memberInventoryState = { items: [], search: "" };

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
  role === "management" ? await renderBarangManagementView() : await renderBarangMemberView();
}

// ============================================================
// MANAGEMENT VIEW
// ============================================================
async function renderBarangManagementView() {
  const container = document.getElementById("barang-content-area");
  container.innerHTML = `<div class="bg-white rounded-lg shadow p-6"><p class="text-gray-500">Memuat data...</p></div>`;

  try {
    await ensureInventoryMeta();
    const templates = await fetchProductTemplates();
    productInventoryState.templates = templates || [];
    
    const categoryCounts = {};
    productInventoryState.templates.forEach(t => {
      const catName = t.category?.name || "Lainnya";
      categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;
    });
    
    const visible = filterProductTemplates(productInventoryState.templates, productInventoryState.search, productInventoryState.selectedCategory);
    const categoryTabsHTML = getCategoryTabsHTML(categoryCounts);

    container.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex-1 relative max-w-md">
            <span class="absolute inset-y-0 left-3 flex items-center text-gray-400"><i class="fas fa-search"></i></span>
            <input id="product-search-input" type="text" value="${productInventoryState.search || ""}" placeholder="Cari produk..."
              class="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-gray-50"/>
          </div>
          <div class="flex gap-3">
            <button id="product-add-btn" class="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-500/30 flex items-center gap-2 transition-all">
              <i class="fas fa-plus"></i> Tambah Produk
            </button>
            <button id="product-refresh-btn" class="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 flex items-center gap-2 shadow-sm">
              <i class="fas fa-sync"></i>
            </button>
          </div>
        </div>
        ${categoryTabsHTML}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">${getTemplateCardsHTML(visible)}</div>
      </div>
    `;

    document.getElementById("product-search-input")?.addEventListener("input", (e) => { productInventoryState.search = e.target.value; setTimeout(() => renderBarangManagementView(), 300); });
    document.getElementById("product-add-btn")?.addEventListener("click", () => openProductTemplateModal());
    document.getElementById("product-refresh-btn")?.addEventListener("click", () => renderBarangManagementView());
    container.querySelectorAll(".category-tab").forEach(tab => { tab.addEventListener("click", () => { productInventoryState.selectedCategory = tab.dataset.category; renderBarangManagementView(); }); });
    bindTemplateCardActions(container);
  } catch (error) {
    container.innerHTML = `<div class="bg-red-50 text-red-700 p-4 rounded-lg">${error.message}</div>`;
  }
}

function getCategoryTabsHTML(counts) {
  const total = productInventoryState.templates.length;
  const selected = productInventoryState.selectedCategory;
  let tabs = `<button class="category-tab px-4 py-2 rounded-full text-sm font-medium transition-all ${selected === 'all' ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}" data-category="all">Semua <span class="ml-1 px-2 py-0.5 rounded-full text-xs ${selected === 'all' ? 'bg-white/20' : 'bg-gray-100'}">${total}</span></button>`;
  Object.entries(counts).sort((a,b) => b[1] - a[1]).forEach(([cat, count]) => {
    const isActive = selected === cat;
    tabs += `<button class="category-tab px-4 py-2 rounded-full text-sm font-medium transition-all ${isActive ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}" data-category="${cat}">${cat} <span class="ml-1 px-2 py-0.5 rounded-full text-xs ${isActive ? 'bg-white/20' : 'bg-gray-100'}">${count}</span></button>`;
  });
  return `<div class="flex flex-wrap gap-2 pb-2">${tabs}</div>`;
}

function getTemplateCardsHTML(templates) {
  if (!templates.length) return `<div class="col-span-full text-center py-12 text-gray-500"><i class="fas fa-box-open text-4xl mb-3 text-gray-300"></i><p>Tidak ada produk ditemukan</p></div>`;
  return templates.map(t => {
    const photo = t.photo_url || "https://placehold.co/300x200/f3f4f6/9ca3af?text=📦";
    const stock = t.stock || { total: 0, available: 0 };
    return `
      <div class="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 group border border-gray-100">
        <div class="relative h-36 overflow-hidden bg-gradient-to-br from-gray-100 to-gray-50">
          <img src="${photo}" alt="${t.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
          <div class="absolute top-2 left-2"><span class="px-2 py-1 rounded-lg text-xs font-medium ${t.is_serialized ? 'bg-blue-500 text-white' : 'bg-emerald-500 text-white'}">${t.is_serialized ? 'Serial' : 'Non-Serial'}</span></div>
          <div class="absolute top-2 right-2"><button type="button" class="template-action-btn w-8 h-8 bg-white/90 backdrop-blur rounded-lg shadow flex items-center justify-center text-gray-600 hover:bg-white" data-template-id="${t.id}"><i class="fas fa-ellipsis-v"></i></button></div>
        </div>
        <div class="p-4">
          <h3 class="font-bold text-gray-900 truncate text-lg">${t.name}</h3>
          <p class="text-xs text-gray-500 mt-1 flex items-center gap-1"><i class="fas fa-tag"></i> ${t.category?.name || "-"}</p>
          <p class="text-xs text-gray-400 mt-1 flex items-center gap-1"><i class="fas fa-map-marker-alt"></i> ${t.default_location?.name || "-"}</p>
          <div class="mt-3 flex items-center justify-between">
            <div class="flex items-center gap-2"><span class="text-2xl font-bold text-emerald-600">${stock.available}</span><span class="text-gray-400 text-sm">/ ${stock.total}</span></div>
            ${stock.borrowed > 0 ? `<span class="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-lg">${stock.borrowed} dipinjam</span>` : ''}
          </div>
        </div>
      </div>`;
  }).join("");
}

function filterProductTemplates(templates, search, category) {
  let result = templates;
  if (category && category !== "all") result = result.filter(t => (t.category?.name || "Lainnya") === category);
  if (search) { const q = search.toLowerCase(); result = result.filter(t => t.name?.toLowerCase().includes(q) || t.category?.name?.toLowerCase().includes(q)); }
  return result;
}

function bindTemplateCardActions(root) {
  root.querySelectorAll(".template-action-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const templateId = btn.dataset.templateId;
      const template = productInventoryState.templates.find(t => t.id === templateId);
      if (!template) return;
      const items = [
        { label: "Lihat Detail", icon: "fas fa-eye", className: "text-gray-700", onClick: () => renderTemplateDetailView(templateId) },
        { label: "Edit", icon: "fas fa-edit", className: "text-amber-600", onClick: () => openProductTemplateModal(template) },
        ...(template.is_serialized ? [{ label: "Tambah Unit", icon: "fas fa-plus-circle", className: "text-green-600", onClick: () => openProductUnitModal({ templateId }) }] : [{ label: "Adjust Stok", icon: "fas fa-boxes", className: "text-blue-600", onClick: () => openAdjustStockModal(template) }]),
        { label: "Hapus", icon: "fas fa-trash", className: "text-red-600", onClick: () => confirmDeleteTemplate(templateId) },
      ];
      openGlobalActionMenu({ triggerElement: btn, items });
    });
  });
}

// ============================================================
// MEMBER VIEW
// ============================================================
async function renderBarangMemberView() {
  const container = document.getElementById("barang-content-area");
  container.innerHTML = `<div class="bg-white rounded-lg shadow p-6"><p class="text-gray-500">Memuat inventori...</p></div>`;
  try {
    const items = await fetchMemberInventory();
    memberInventoryState.items = items || [];
    const visible = memberInventoryState.items.filter(i => !memberInventoryState.search || i.name?.toLowerCase().includes(memberInventoryState.search.toLowerCase()));
    container.innerHTML = `
      <div class="space-y-6">
        <div class="flex items-center gap-4">
          <div class="flex-1 relative"><span class="absolute inset-y-0 left-3 flex items-center text-gray-400"><i class="fas fa-search"></i></span><input id="member-search" type="text" value="${memberInventoryState.search || ""}" placeholder="Cari barang..." class="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 bg-gray-50"/></div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">${getMemberCardsHTML(visible)}</div>
      </div>`;
    document.getElementById("member-search")?.addEventListener("input", (e) => { memberInventoryState.search = e.target.value; renderBarangMemberView(); });
    bindMemberCards(container);
  } catch (error) { container.innerHTML = `<div class="bg-red-50 text-red-700 p-4 rounded-lg">${error.message}</div>`; }
}

function getMemberCardsHTML(items) {
  if (!items.length) return `<div class="col-span-full text-center py-12 text-gray-500">Tidak ada barang tersedia</div>`;
  return items.map(item => {
    const photo = item.photo_url || "https://placehold.co/200x150/f3f4f6/9ca3af?text=📦";
    const stock = item.stock || { available: 0 };
    return `<div class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow"><img src="${photo}" alt="${item.name}" class="w-full h-32 object-cover"/><div class="p-4"><h3 class="font-semibold text-gray-900 truncate">${item.name}</h3><p class="text-xs text-gray-500 mt-1">${item.category?.name || "-"}</p><div class="mt-3 flex items-center justify-between"><span class="text-sm"><strong class="text-emerald-600">${stock.available}</strong> tersedia</span><button type="button" class="member-borrow-btn px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm rounded-lg font-medium" data-template-id="${item.id}" data-is-serialized="${item.is_serialized}">Pinjam</button></div></div></div>`;
  }).join("");
}

function bindMemberCards(container) {
  container.querySelectorAll(".member-borrow-btn").forEach(btn => { btn.addEventListener("click", () => { openMemberBorrowModal(btn.dataset.templateId, btn.dataset.isSerialized === "true"); }); });
}

// ============================================================
// API CALLS
// ============================================================
async function fetchProductTemplates() {
  const token = localStorage.getItem("authToken");
  const res = await fetch("/api/management", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: "getProductTemplates" }) });
  if (!res.ok) throw new Error("Gagal mengambil data");
  return res.json();
}

async function ensureInventoryMeta() {
  if (productInventoryState.categories.length) return;
  const token = localStorage.getItem("authToken");
  const res = await fetch("/api/management", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: "getAssetMeta" }) });
  if (!res.ok) throw new Error("Gagal mengambil metadata");
  const data = await res.json();
  productInventoryState.categories = data.categories || [];
  productInventoryState.locations = data.locations || [];
  productInventoryState.commissions = data.commissions || [];
}

async function refreshInventoryMeta() {
  const token = localStorage.getItem("authToken");
  const res = await fetch("/api/management", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: "getAssetMeta" }) });
  if (!res.ok) throw new Error("Gagal refresh metadata");
  const data = await res.json();
  productInventoryState.categories = data.categories || [];
  productInventoryState.locations = data.locations || [];
  productInventoryState.commissions = data.commissions || [];
}

async function fetchMemberInventory() {
  const token = localStorage.getItem("authToken");
  const res = await fetch("/api/member?resource=inventory", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Gagal mengambil data");
  return res.json();
}

async function fetchProductUnits(templateId) {
  const token = localStorage.getItem("authToken");
  const res = await fetch("/api/management", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: "getProductUnits", payload: { templateId } }) });
  if (!res.ok) throw new Error("Gagal mengambil unit");
  return res.json();
}

async function fetchMemberAvailableUnits(templateId) {
  const token = localStorage.getItem("authToken");
  const res = await fetch(`/api/member?resource=inventory&templateId=${templateId}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Gagal mengambil unit");
  return res.json();
}

async function uploadProductImage(file) {
  const token = localStorage.getItem("authToken");
  const base64 = await fileToBase64(file);
  const res = await fetch("/api/website-hero-video", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fileName: file.name, mimeType: file.type, base64Data: base64, target: "assets" }),
  });
  if (!res.ok) throw new Error("Gagal upload gambar");
  const data = await res.json();
  return data.url;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================================
// MODALS - PRODUCT TEMPLATE (with Image Upload & Add New Category/Location)
// ============================================================
function openProductTemplateModal(existing = null) {
  const isEdit = !!existing;
  const catOpts = productInventoryState.categories.map(c => `<option value="${c.id}" ${existing?.category?.id === c.id ? "selected" : ""}>${c.name}</option>`).join("");
  const locOpts = productInventoryState.locations.map(l => `<option value="${l.id}" ${existing?.default_location?.id === l.id ? "selected" : ""}>${l.name}</option>`).join("");

  const content = `
    <form id="product-template-form" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Nama Produk *</label>
        <input type="text" name="name" value="${existing?.name || ""}" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"/>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
        <textarea name="description" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-lg">${existing?.description || ""}</textarea>
      </div>
      
      <!-- Category with Add New -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
        <div class="flex gap-2">
          <select name="category_id" id="category-select" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg">
            <option value="">-- Pilih Kategori --</option>
            ${catOpts}
          </select>
          <button type="button" id="add-category-btn" class="px-3 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600" title="Tambah Kategori Baru">
            <i class="fas fa-plus"></i>
          </button>
        </div>
      </div>
      
      <!-- Location with Add New -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Lokasi Default</label>
        <div class="flex gap-2">
          <select name="default_location_id" id="location-select" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg">
            <option value="">-- Pilih Lokasi --</option>
            ${locOpts}
          </select>
          <button type="button" id="add-location-btn" class="px-3 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600" title="Tambah Lokasi Baru">
            <i class="fas fa-plus"></i>
          </button>
        </div>
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Tipe</label>
          <select name="is_serialized" class="w-full px-3 py-2 border border-gray-300 rounded-lg" ${isEdit ? "disabled" : ""}>
            <option value="true" ${existing?.is_serialized !== false ? "selected" : ""}>Serialized (per unit)</option>
            <option value="false" ${existing?.is_serialized === false ? "selected" : ""}>Non-Serialized (qty)</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">UoM</label>
          <input type="text" name="uom" value="${existing?.uom || "unit"}" class="w-full px-3 py-2 border border-gray-300 rounded-lg"/>
        </div>
      </div>
      
      ${!isEdit || existing?.is_serialized === false ? `
      <div class="grid grid-cols-2 gap-4">
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Stok Awal</label><input type="number" name="quantity_on_hand" value="${existing?.quantity_on_hand || 0}" min="0" class="w-full px-3 py-2 border border-gray-300 rounded-lg"/></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Min. Stok</label><input type="number" name="min_quantity" value="${existing?.min_quantity || 0}" min="0" class="w-full px-3 py-2 border border-gray-300 rounded-lg"/></div>
      </div>` : ""}
      
      <!-- Image Upload -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Foto Produk</label>
        <div class="flex items-center gap-4">
          <div id="photo-preview" class="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300">
            ${existing?.photo_url ? `<img src="${existing.photo_url}" class="w-full h-full object-cover"/>` : '<i class="fas fa-image text-gray-400 text-2xl"></i>'}
          </div>
          <div class="flex-1">
            <input type="file" name="photo_file" id="photo-file-input" accept="image/*" class="hidden"/>
            <input type="hidden" name="photo_url" value="${existing?.photo_url || ""}"/>
            <button type="button" id="upload-photo-btn" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
              <i class="fas fa-upload mr-2"></i> Pilih Foto
            </button>
            <p class="text-xs text-gray-500 mt-1">Max 2MB. Format: JPG, PNG, WEBP</p>
          </div>
        </div>
      </div>
    </form>
  `;

  openGlobalModal({
    title: isEdit ? "Edit Produk" : "Tambah Produk Baru",
    contentHTML: content,
    confirmText: isEdit ? "Simpan" : "Tambah",
    onConfirm: () => handleProductTemplateSubmit(existing?.id),
  });

  // Setup event handlers after modal is open
  setTimeout(() => {
    document.getElementById("upload-photo-btn")?.addEventListener("click", () => document.getElementById("photo-file-input")?.click());
    document.getElementById("photo-file-input")?.addEventListener("change", handlePhotoPreview);
    document.getElementById("add-category-btn")?.addEventListener("click", openAddCategoryModal);
    document.getElementById("add-location-btn")?.addEventListener("click", openAddLocationModal);
  }, 100);
}

function handlePhotoPreview(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { alert("Ukuran file melebihi 2MB"); return; }
  const preview = document.getElementById("photo-preview");
  const reader = new FileReader();
  reader.onload = (ev) => { preview.innerHTML = `<img src="${ev.target.result}" class="w-full h-full object-cover"/>`; };
  reader.readAsDataURL(file);
}

async function handleProductTemplateSubmit(existingId) {
  const form = document.getElementById("product-template-form");
  const fd = new FormData(form);
  
  // Handle image upload first if there's a new file
  let photoUrl = fd.get("photo_url") || null;
  const photoFile = document.getElementById("photo-file-input")?.files[0];
  if (photoFile) {
    try {
      const confirmBtn = document.getElementById("global-modal-confirm");
      if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Uploading...'; }
      photoUrl = await uploadProductImage(photoFile);
    } catch (e) { alert("Gagal upload foto: " + e.message); return; }
  }
  
  const payload = {
    name: fd.get("name"),
    description: fd.get("description") || null,
    category_id: fd.get("category_id") || null,
    default_location_id: fd.get("default_location_id") || null,
    is_serialized: fd.get("is_serialized") === "true",
    uom: fd.get("uom") || "unit",
    photo_url: photoUrl,
  };
  if (!payload.is_serialized) {
    payload.quantity_on_hand = parseInt(fd.get("quantity_on_hand") || "0", 10);
    payload.min_quantity = parseInt(fd.get("min_quantity") || "0", 10);
  }
  if (existingId) payload.id = existingId;

  try {
    const token = localStorage.getItem("authToken");
    const res = await fetch("/api/management", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: existingId ? "updateProductTemplate" : "createProductTemplate", payload }) });
    if (!res.ok) throw new Error((await res.json()).error || "Gagal");
    closeGlobalModal();
    notifySuccess("Produk berhasil disimpan!");
    await renderBarangManagementView();
  } catch (e) { alert(e.message); }
}

// ============================================================
// ADD NEW CATEGORY MODAL (Odoo Style)
// ============================================================
function openAddCategoryModal() {
  const currentModal = document.getElementById("global-modal-overlay");
  if (currentModal) currentModal.style.display = "none";

  const modalHTML = `
    <div id="add-category-modal" class="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div class="flex justify-between items-center p-4 border-b bg-gradient-to-r from-emerald-500 to-green-500">
          <h3 class="font-bold text-lg text-white">Tambah Kategori Baru</h3>
          <button id="close-add-category" class="text-white/80 hover:text-white"><i class="fas fa-times"></i></button>
        </div>
        <form id="add-category-form" class="p-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nama Kategori *</label>
            <input type="text" name="name" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"/>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Kode (opsional)</label>
            <input type="text" name="code" placeholder="ELK, MEB, MSK..." class="w-full px-3 py-2 border border-gray-300 rounded-lg"/>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" id="cancel-add-category" class="px-4 py-2 border border-gray-300 rounded-lg">Batal</button>
            <button type="submit" class="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">Tambah</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHTML);

  const closeAddCat = () => {
    document.getElementById("add-category-modal")?.remove();
    if (currentModal) currentModal.style.display = "";
  };

  document.getElementById("close-add-category").onclick = closeAddCat;
  document.getElementById("cancel-add-category").onclick = closeAddCat;
  document.getElementById("add-category-form").onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch("/api/management", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: "createCategory", payload: { name: fd.get("name"), code: fd.get("code") || null } }) });
      if (!res.ok) throw new Error((await res.json()).error || "Gagal");
      const data = await res.json();
      // Update dropdown and select new category
      await refreshInventoryMeta();
      const select = document.getElementById("category-select");
      if (select) {
        const newOpt = productInventoryState.categories.map(c => `<option value="${c.id}" ${c.id === data.category?.id ? "selected" : ""}>${c.name}</option>`).join("");
        select.innerHTML = `<option value="">-- Pilih Kategori --</option>${newOpt}`;
        if (data.category?.id) select.value = data.category.id;
      }
      closeAddCat();
      notifySuccess("Kategori berhasil ditambahkan!");
    } catch (err) { alert(err.message); }
  };
}

// ============================================================
// ADD NEW LOCATION MODAL (Odoo Style)
// ============================================================
function openAddLocationModal() {
  const currentModal = document.getElementById("global-modal-overlay");
  if (currentModal) currentModal.style.display = "none";

  const commissionOpts = productInventoryState.commissions.map(c => `<option value="${c.id}">${c.name}</option>`).join("");

  const modalHTML = `
    <div id="add-location-modal" class="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div class="flex justify-between items-center p-4 border-b bg-gradient-to-r from-blue-500 to-indigo-500">
          <h3 class="font-bold text-lg text-white">Tambah Lokasi Baru</h3>
          <button id="close-add-location" class="text-white/80 hover:text-white"><i class="fas fa-times"></i></button>
        </div>
        <form id="add-location-form" class="p-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nama Lokasi *</label>
            <input type="text" name="name" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"/>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Kode (opsional)</label>
            <input type="text" name="code" placeholder="GSG/L1, WH-01..." class="w-full px-3 py-2 border border-gray-300 rounded-lg"/>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Tipe Lokasi *</label>
            <select name="type" required class="w-full px-3 py-2 border border-gray-300 rounded-lg">
              <option value="internal">Internal</option>
              <option value="customer">Customer</option>
              <option value="vendor">Vendor</option>
              <option value="scrap">Scrap</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Komisi (opsional)</label>
            <select name="commission_id" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
              <option value="">-- Tidak ada --</option>
              ${commissionOpts}
            </select>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" id="cancel-add-location" class="px-4 py-2 border border-gray-300 rounded-lg">Batal</button>
            <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Tambah</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHTML);

  const closeAddLoc = () => {
    document.getElementById("add-location-modal")?.remove();
    if (currentModal) currentModal.style.display = "";
  };

  document.getElementById("close-add-location").onclick = closeAddLoc;
  document.getElementById("cancel-add-location").onclick = closeAddLoc;
  document.getElementById("add-location-form").onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch("/api/management", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: "createStockLocation", payload: { name: fd.get("name"), code: fd.get("code") || null, type: fd.get("type"), commission_id: fd.get("commission_id") || null } }) });
      if (!res.ok) throw new Error((await res.json()).error || "Gagal");
      const data = await res.json();
      await refreshInventoryMeta();
      const select = document.getElementById("location-select");
      if (select) {
        const newOpt = productInventoryState.locations.map(l => `<option value="${l.id}" ${l.id === data.location?.id ? "selected" : ""}>${l.name}</option>`).join("");
        select.innerHTML = `<option value="">-- Pilih Lokasi --</option>${newOpt}`;
        if (data.location?.id) select.value = data.location.id;
      }
      closeAddLoc();
      notifySuccess("Lokasi berhasil ditambahkan!");
    } catch (err) { alert(err.message); }
  };
}

// ============================================================
// OTHER MODALS
// ============================================================
function openAdjustStockModal(template) {
  const content = `
    <form id="adjust-stock-form" class="space-y-4">
      <p class="text-gray-600">Stok saat ini: <strong class="text-2xl text-emerald-600">${template.quantity_on_hand || 0}</strong> ${template.uom || "unit"}</p>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Adjustment</label>
        <div class="flex gap-2">
          <select name="type" class="px-3 py-2 border border-gray-300 rounded-lg"><option value="add">Tambah (+)</option><option value="subtract">Kurang (-)</option></select>
          <input type="number" name="amount" min="1" value="1" required class="flex-1 px-3 py-2 border border-gray-300 rounded-lg"/>
        </div>
      </div>
    </form>`;
  openGlobalModal({ title: `Adjust Stok: ${template.name}`, contentHTML: content, confirmText: "Simpan", onConfirm: () => handleAdjustStock(template.id) });
}

async function handleAdjustStock(templateId) {
  const form = document.getElementById("adjust-stock-form");
  const fd = new FormData(form);
  const adjustment = fd.get("type") === "subtract" ? -parseInt(fd.get("amount")) : parseInt(fd.get("amount"));
  try {
    const token = localStorage.getItem("authToken");
    const res = await fetch("/api/management", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: "adjustProductQuantity", payload: { templateId, adjustment } }) });
    if (!res.ok) throw new Error((await res.json()).error || "Gagal");
    closeGlobalModal(); notifySuccess("Stok berhasil diupdate!"); await renderBarangManagementView();
  } catch (e) { alert(e.message); }
}

function openProductUnitModal(opts = {}) {
  const { templateId, existing = null } = opts;
  const locOpts = productInventoryState.locations.map(l => `<option value="${l.id}" ${existing?.location?.id === l.id ? "selected" : ""}>${l.name}</option>`).join("");
  const content = `
    <form id="product-unit-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Kode Aset</label><input type="text" name="asset_code" value="${existing?.asset_code || ""}" class="w-full px-3 py-2 border border-gray-300 rounded-lg"/></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Serial Number</label><input type="text" name="serial_number" value="${existing?.serial_number || ""}" class="w-full px-3 py-2 border border-gray-300 rounded-lg"/></div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Lokasi</label><select name="location_id" class="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="">--</option>${locOpts}</select></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Kondisi</label><select name="condition" class="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="Baik" ${existing?.condition === "Baik" ? "selected" : ""}>Baik</option><option value="Perlu Perbaikan" ${existing?.condition === "Perlu Perbaikan" ? "selected" : ""}>Perlu Perbaikan</option><option value="Rusak" ${existing?.condition === "Rusak" ? "selected" : ""}>Rusak</option></select></div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Tanggal Beli</label><input type="date" name="purchase_date" value="${existing?.purchase_date || ""}" class="w-full px-3 py-2 border border-gray-300 rounded-lg"/></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Harga Beli</label><input type="number" name="purchase_price" value="${existing?.purchase_price || ""}" class="w-full px-3 py-2 border border-gray-300 rounded-lg"/></div>
      </div>
    </form>`;
  openGlobalModal({ title: existing ? "Edit Unit" : "Tambah Unit Baru", contentHTML: content, confirmText: existing ? "Simpan" : "Tambah", onConfirm: () => handleProductUnitSubmit(templateId, existing?.id) });
}

async function handleProductUnitSubmit(templateId, existingId) {
  const form = document.getElementById("product-unit-form");
  const fd = new FormData(form);
  const payload = { template_id: templateId, asset_code: fd.get("asset_code") || null, serial_number: fd.get("serial_number") || null, location_id: fd.get("location_id") || null, condition: fd.get("condition") || null, purchase_date: fd.get("purchase_date") || null, purchase_price: fd.get("purchase_price") || null };
  if (existingId) payload.unitId = existingId;
  try {
    const token = localStorage.getItem("authToken");
    const res = await fetch("/api/management", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: existingId ? "updateProductUnit" : "createProductUnit", payload }) });
    if (!res.ok) throw new Error((await res.json()).error || "Gagal");
    closeGlobalModal(); notifySuccess("Unit berhasil disimpan!");
    const detailContainer = document.getElementById("template-detail-container");
    if (detailContainer) await renderTemplateDetailView(templateId);
  } catch (e) { alert(e.message); }
}

// ============================================================
// DETAIL VIEW
// ============================================================
async function renderTemplateDetailView(templateId) {
  const container = document.getElementById("barang-content-area");
  try {
    const template = productInventoryState.templates.find(t => t.id === templateId);
    if (!template) throw new Error("Produk tidak ditemukan");
    let unitsHTML = "";
    if (template.is_serialized) {
      const units = await fetchProductUnits(templateId);
      unitsHTML = getUnitsTableHTML(units, templateId);
    } else {
      unitsHTML = `<div class="bg-gradient-to-r from-emerald-50 to-green-50 p-6 rounded-xl border border-emerald-200"><p class="text-gray-600">Stok saat ini: <span class="text-4xl font-bold text-emerald-600 ml-2">${template.quantity_on_hand || 0}</span> ${template.uom || "unit"}</p><button type="button" id="adjust-stock-detail-btn" class="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"><i class="fas fa-boxes mr-2"></i>Adjust Stok</button></div>`;
    }
    container.innerHTML = `
      <div id="template-detail-container" class="space-y-6">
        <div class="flex items-center gap-4"><button id="back-to-list-btn" class="p-2 rounded-lg hover:bg-gray-100"><i class="fas fa-arrow-left text-gray-600"></i></button><h2 class="text-2xl font-bold text-gray-800">${template.name}</h2></div>
        <div class="bg-white rounded-xl shadow-md p-6"><div class="grid grid-cols-1 md:grid-cols-3 gap-6"><img src="${template.photo_url || "https://placehold.co/300x200/f3f4f6/9ca3af?text=📦"}" class="w-full rounded-xl object-cover"/><div class="md:col-span-2 space-y-3"><p><strong>Deskripsi:</strong> ${template.description || "-"}</p><p><strong>Kategori:</strong> ${template.category?.name || "-"}</p><p><strong>Lokasi:</strong> ${template.default_location?.name || "-"}</p><p><strong>Tipe:</strong> ${template.is_serialized ? "Serialized" : "Non-Serialized"}</p></div></div></div>
        <div class="bg-white rounded-xl shadow-md p-6"><div class="flex items-center justify-between mb-4"><h3 class="text-lg font-semibold">${template.is_serialized ? "Daftar Unit" : "Informasi Stok"}</h3>${template.is_serialized ? `<button id="add-unit-btn" class="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg"><i class="fas fa-plus mr-2"></i>Tambah Unit</button>` : ""}</div>${unitsHTML}</div>
      </div>`;
    document.getElementById("back-to-list-btn")?.addEventListener("click", () => renderBarangManagementView());
    document.getElementById("add-unit-btn")?.addEventListener("click", () => openProductUnitModal({ templateId }));
    document.getElementById("adjust-stock-detail-btn")?.addEventListener("click", () => openAdjustStockModal(template));
    bindUnitRowActions(container, templateId);
  } catch (e) { container.innerHTML = `<div class="bg-red-50 text-red-700 p-4 rounded-lg">${e.message}</div>`; }
}

function getUnitsTableHTML(units, templateId) {
  if (!units.length) return `<p class="text-gray-500 text-center py-6">Belum ada unit.</p>`;
  const statusColors = { available: "bg-emerald-100 text-emerald-700", borrowed: "bg-orange-100 text-orange-700", maintenance: "bg-yellow-100 text-yellow-700", lost: "bg-red-100 text-red-700", scrapped: "bg-gray-100 text-gray-700" };
  const rows = units.map(u => `<tr class="border-b hover:bg-gray-50"><td class="p-3 font-mono text-sm">${u.asset_code || "-"}</td><td class="p-3 text-sm">${u.serial_number || "-"}</td><td class="p-3"><span class="text-xs px-2 py-1 rounded-lg ${statusColors[u.status] || "bg-gray-100"}">${u.status}</span></td><td class="p-3 text-sm">${u.condition || "-"}</td><td class="p-3 text-sm">${u.location?.name || "-"}</td><td class="p-3 text-center"><button type="button" class="unit-action-btn px-2 py-1 text-gray-500 hover:text-gray-700" data-unit-id="${u.id}"><i class="fas fa-ellipsis-v"></i></button></td></tr>`).join("");
  return `<table class="min-w-full text-sm"><thead class="bg-gray-100 text-xs font-semibold text-gray-600 uppercase"><tr><th class="p-3 text-left">Kode</th><th class="p-3 text-left">Serial</th><th class="p-3 text-left">Status</th><th class="p-3 text-left">Kondisi</th><th class="p-3 text-left">Lokasi</th><th class="p-3 text-center">Aksi</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function bindUnitRowActions(container, templateId) {
  container.querySelectorAll(".unit-action-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const unitId = btn.dataset.unitId;
      openGlobalActionMenu({ triggerElement: btn, items: [
        { label: "Edit", icon: "fas fa-edit", className: "text-amber-600", onClick: async () => { const units = await fetchProductUnits(templateId); const u = units.find(x => x.id === unitId); if (u) openProductUnitModal({ templateId, existing: u }); } },
        { label: "Hapus", icon: "fas fa-trash", className: "text-red-600", onClick: () => confirmDeleteUnit(templateId, unitId) },
      ] });
    });
  });
}

async function confirmDeleteUnit(templateId, unitId) {
  if (!confirm("Hapus unit ini?")) return;
  try {
    const token = localStorage.getItem("authToken");
    const res = await fetch("/api/management", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: "deleteProductUnit", payload: { unitId } }) });
    if (!res.ok) throw new Error((await res.json()).error);
    notifySuccess("Unit dihapus!"); await renderTemplateDetailView(templateId);
  } catch (e) { alert(e.message); }
}

async function confirmDeleteTemplate(templateId) {
  if (!confirm("Hapus produk ini?")) return;
  try {
    const token = localStorage.getItem("authToken");
    const res = await fetch("/api/management", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: "deleteProductTemplate", payload: { templateId } }) });
    if (!res.ok) throw new Error((await res.json()).error);
    notifySuccess("Produk dihapus!"); await renderBarangManagementView();
  } catch (e) { alert(e.message); }
}

// ============================================================
// MEMBER BORROW
// ============================================================
async function openMemberBorrowModal(templateId, isSerialized) {
  const item = memberInventoryState.items.find(i => i.id === templateId);
  if (!item) return;
  let unitsOpts = "";
  if (isSerialized) {
    try { const units = await fetchMemberAvailableUnits(templateId); unitsOpts = units.map(u => `<option value="${u.id}">${u.asset_code || u.serial_number || u.id}</option>`).join(""); if (!units.length) { alert("Tidak ada unit tersedia"); return; } } catch (e) { alert(e.message); return; }
  }
  const today = new Date().toISOString().split("T")[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
  const content = `<form id="member-borrow-form" class="space-y-4"><p class="text-gray-600">Produk: <strong>${item.name}</strong></p>${isSerialized ? `<div><label class="block text-sm font-medium text-gray-700 mb-1">Pilih Unit</label><select name="unit_id" required class="w-full px-3 py-2 border border-gray-300 rounded-lg">${unitsOpts}</select></div>` : `<div><label class="block text-sm font-medium text-gray-700 mb-1">Jumlah (max: ${item.stock?.available || 0})</label><input type="number" name="quantity" min="1" max="${item.stock?.available || 1}" value="1" required class="w-full px-3 py-2 border border-gray-300 rounded-lg"/></div>`}<div class="grid grid-cols-2 gap-4"><div><label class="block text-sm font-medium text-gray-700 mb-1">Tanggal Pinjam</label><input type="date" name="loan_date" value="${today}" required class="w-full px-3 py-2 border border-gray-300 rounded-lg"/></div><div><label class="block text-sm font-medium text-gray-700 mb-1">Tanggal Kembali</label><input type="date" name="due_date" value="${nextWeek}" required class="w-full px-3 py-2 border border-gray-300 rounded-lg"/></div></div></form>`;
  openGlobalModal({ title: "Ajukan Peminjaman", contentHTML: content, confirmText: "Ajukan", onConfirm: () => handleMemberBorrowSubmit(templateId, isSerialized) });
}

async function handleMemberBorrowSubmit(templateId, isSerialized) {
  const form = document.getElementById("member-borrow-form");
  const fd = new FormData(form);
  const body = { loan_date: fd.get("loan_date"), due_date: fd.get("due_date") };
  if (isSerialized) body.unit_id = fd.get("unit_id");
  else { body.template_id = templateId; body.quantity = parseInt(fd.get("quantity"), 10); }
  try {
    const token = localStorage.getItem("authToken");
    const res = await fetch("/api/member?resource=inventory", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error((await res.json()).error);
    closeGlobalModal(); notifySuccess("Permintaan peminjaman berhasil!"); await renderBarangMemberView();
  } catch (e) { alert(e.message); }
}

window.loadBarangPage = loadBarangPage;
window.renderBarangListView = renderBarangListView;
