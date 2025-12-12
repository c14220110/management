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
// ============================================================
// MANAGEMENT VIEW
// ============================================================
const managementFilterState = {
  category: "all",
  location: "all",
  stockStatus: "all", // all, available, low, out
  sortBy: "name", // name, stock_high, stock_low
};

async function renderBarangManagementView() {
  const container = document.getElementById("barang-content-area");
  container.innerHTML = `<div class="flex items-center justify-center py-12"><i class="fas fa-spinner fa-spin text-3xl text-amber-500"></i></div>`;

  try {
    await ensureInventoryMeta();
    const templates = await fetchProductTemplates();
    productInventoryState.templates = templates || [];
    
    // Get unique categories and locations for filters
    const categories = [...new Set(productInventoryState.templates.map(t => t.category?.name || "Lainnya"))].sort();
    const locations = [...new Set(productInventoryState.templates.map(t => t.default_location?.name || "Tanpa Lokasi"))].sort();
    
    const visible = filterManagementTemplates(productInventoryState.templates);

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Header with Title & Actions -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 class="text-2xl font-bold text-gray-800">Manajemen Inventaris</h1>
          <div class="flex gap-3 self-start sm:self-auto flex-wrap">
            <button id="product-active-loans-btn" class="px-4 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 flex items-center gap-2 shadow-sm font-medium">
              <i class="fas fa-hand-holding"></i> Peminjaman Aktif
            </button>
            <button id="product-history-btn" class="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 flex items-center gap-2 shadow-sm">
              <i class="fas fa-history"></i> Lihat Riwayat
            </button>
            <button id="product-add-btn" class="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-500/30 flex items-center gap-2 transition-all">
              <i class="fas fa-plus"></i> Tambah Produk
            </button>
            <button id="product-refresh-btn" class="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 flex items-center gap-2 shadow-sm">
              <i class="fas fa-sync"></i>
            </button>
          </div>
        </div>
        
        <!-- Search & Filters Bar -->
        <div class="bg-white rounded-2xl shadow-md p-4 lg:p-6 space-y-4">
          <!-- Search Bar - Full Width -->
          <div class="relative">
            <span class="absolute inset-y-0 left-4 flex items-center text-gray-400"><i class="fas fa-search text-lg"></i></span>
            <input id="product-search-input" type="text" value="${productInventoryState.search || ""}" 
              placeholder="Cari nama produk, kategori, atau kode..."
              class="w-full pl-12 pr-12 py-3.5 text-lg border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-gray-50 transition-all"/>
            <button id="qr-scan-btn" class="absolute inset-y-0 right-4 flex items-center text-gray-400 hover:text-amber-600 transition-colors" title="Scan QR Code">
              <i class="fas fa-qrcode text-xl"></i>
            </button>
          </div>
          
          <!-- Filter Row -->
          <div class="flex flex-col sm:flex-row gap-3 sm:items-center">
            <!-- Category Filter -->
            <div class="flex-1 sm:max-w-xs">
              <label class="block text-xs font-medium text-gray-500 mb-1 ml-1">Kategori</label>
              <select id="mgmt-filter-category" class="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 text-gray-700">
                <option value="all" ${managementFilterState.category === "all" ? "selected" : ""}>Semua Kategori</option>
                ${categories.map(c => `<option value="${c}" ${managementFilterState.category === c ? "selected" : ""}>${c}</option>`).join("")}
              </select>
            </div>
            
            <!-- Location Filter -->
            <div class="flex-1 sm:max-w-xs">
              <label class="block text-xs font-medium text-gray-500 mb-1 ml-1">Lokasi</label>
              <select id="mgmt-filter-location" class="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 text-gray-700">
                <option value="all" ${managementFilterState.location === "all" ? "selected" : ""}>Semua Lokasi</option>
                ${locations.map(l => `<option value="${l}" ${managementFilterState.location === l ? "selected" : ""}>${l}</option>`).join("")}
              </select>
            </div>

            <!-- Stock Status Filter -->
            <div class="flex-1 sm:max-w-xs">
              <label class="block text-xs font-medium text-gray-500 mb-1 ml-1">Status Stok</label>
              <select id="mgmt-filter-stock" class="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 text-gray-700">
                <option value="all" ${managementFilterState.stockStatus === "all" ? "selected" : ""}>Semua Status</option>
                <option value="available" ${managementFilterState.stockStatus === "available" ? "selected" : ""}>Tersedia</option>
                <option value="low" ${managementFilterState.stockStatus === "low" ? "selected" : ""}>Stok Menipis</option>
                <option value="out" ${managementFilterState.stockStatus === "out" ? "selected" : ""}>Habis</option>
              </select>
            </div>
            
            <!-- Sort -->
            <div class="flex-1 sm:max-w-xs">
              <label class="block text-xs font-medium text-gray-500 mb-1 ml-1">Urutkan</label>
              <select id="mgmt-filter-sort" class="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 text-gray-700">
                <option value="name" ${managementFilterState.sortBy === "name" ? "selected" : ""}>Nama (A-Z)</option>
                <option value="stock_high" ${managementFilterState.sortBy === "stock_high" ? "selected" : ""}>Stok Terbanyak</option>
                <option value="stock_low" ${managementFilterState.sortBy === "stock_low" ? "selected" : ""}>Stok Sedikit</option>
              </select>
            </div>
            
            <!-- Reset Filter Button -->
            <div class="sm:self-end">
              <button id="mgmt-reset-filter" class="w-full sm:w-auto px-4 py-2.5 text-gray-600 hover:text-amber-600 border border-gray-200 rounded-xl hover:bg-gray-50 flex items-center justify-center gap-2">
                <i class="fas fa-times"></i> Reset
              </button>
            </div>
          </div>
          
          <!-- Results Count -->
          <div class="flex items-center justify-between text-sm text-gray-500 pt-2 border-t border-gray-100">
            <span><strong class="text-gray-800">${visible.length}</strong> dari ${productInventoryState.templates.length} produk</span>
            ${managementFilterState.category !== "all" || managementFilterState.location !== "all" || managementFilterState.stockStatus !== "all" || productInventoryState.search ? 
              '<span class="text-amber-600"><i class="fas fa-filter mr-1"></i>Filter aktif</span>' : ''}
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">${getTemplateCardsHTML(visible)}</div>
      </div>
    `;

    // Event Listeners
    document.getElementById("product-search-input")?.addEventListener("input", debounce((e) => { 
      productInventoryState.search = e.target.value; 
      renderBarangManagementView(); 
    }, 600));
    
    document.getElementById("qr-scan-btn")?.addEventListener("click", handleQRScan);
    
    document.getElementById("product-add-btn")?.addEventListener("click", () => openProductTemplateModal());
    document.getElementById("product-refresh-btn")?.addEventListener("click", () => renderBarangManagementView());
    document.getElementById("product-history-btn")?.addEventListener("click", () => openAssetHistoryModal());
    document.getElementById("product-active-loans-btn")?.addEventListener("click", () => openActiveLoansModal());
    
    document.getElementById("mgmt-filter-category")?.addEventListener("change", (e) => {
      managementFilterState.category = e.target.value;
      renderBarangManagementView();
    });
    
    document.getElementById("mgmt-filter-location")?.addEventListener("change", (e) => {
      managementFilterState.location = e.target.value;
      renderBarangManagementView();
    });

    document.getElementById("mgmt-filter-stock")?.addEventListener("change", (e) => {
      managementFilterState.stockStatus = e.target.value;
      renderBarangManagementView();
    });
    
    document.getElementById("mgmt-filter-sort")?.addEventListener("change", (e) => {
      managementFilterState.sortBy = e.target.value;
      renderBarangManagementView();
    });
    
    document.getElementById("mgmt-reset-filter")?.addEventListener("click", () => {
      productInventoryState.search = "";
      managementFilterState.category = "all";
      managementFilterState.location = "all";
      managementFilterState.stockStatus = "all";
      managementFilterState.sortBy = "name";
      renderBarangManagementView();
    });

    bindTemplateCardActions(container);
  } catch (error) {
    container.innerHTML = `<div class="bg-red-50 text-red-700 p-4 rounded-lg">${error.message}</div>`;
  }
}

function filterManagementTemplates(templates) {
  let result = [...templates];
  
  // Search
  if (productInventoryState.search) {
    const q = productInventoryState.search.toLowerCase();
    result = result.filter(t => 
      t.name?.toLowerCase().includes(q) || 
      t.category?.name?.toLowerCase().includes(q) ||
      t.default_location?.name?.toLowerCase().includes(q)
    );
  }
  
  // Category
  if (managementFilterState.category !== "all") {
    result = result.filter(t => (t.category?.name || "Lainnya") === managementFilterState.category);
  }
  
  // Location
  if (managementFilterState.location !== "all") {
    result = result.filter(t => (t.default_location?.name || "Tanpa Lokasi") === managementFilterState.location);
  }

  // Stock Status
  if (managementFilterState.stockStatus !== "all") {
    result = result.filter(t => {
      const stock = t.stock || { available: 0, total: 0 };
      const min = t.min_quantity || 0;
      if (managementFilterState.stockStatus === "available") return stock.available > 0;
      if (managementFilterState.stockStatus === "out") return stock.available === 0;
      if (managementFilterState.stockStatus === "low") return stock.available > 0 && stock.available <= min;
      return true;
    });
  }
  
  // Sort
  if (managementFilterState.sortBy === "name") {
    result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } else if (managementFilterState.sortBy === "stock_high") {
    result.sort((a, b) => (b.stock?.available || 0) - (a.stock?.available || 0));
  } else if (managementFilterState.sortBy === "stock_low") {
    result.sort((a, b) => (a.stock?.available || 0) - (b.stock?.available || 0));
  }
  
  return result;
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

function bindTemplateCardActions(root) {
  root.querySelectorAll(".template-action-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const templateId = btn.dataset.templateId;
      const template = productInventoryState.templates.find(t => t.id === templateId);
      if (!template) return;
      
      // QR code text for this product (format: PRODUCT:id)
      const qrCodeText = `PRODUCT:${templateId}`;
      const productName = template.name || "Produk";
      
      const items = [
        { label: "Lihat Detail", icon: "fas fa-eye", className: "text-gray-700", onClick: () => renderTemplateDetailView(templateId) },
        { label: "Edit", icon: "fas fa-edit", className: "text-amber-600", onClick: () => openProductTemplateModal(template) },
        ...(template.is_serialized 
          ? [{ label: "Tambah Unit", icon: "fas fa-plus-circle", className: "text-green-600", onClick: () => openProductUnitModal({ templateId }) }] 
          : [{ label: "Adjust Stok", icon: "fas fa-boxes", className: "text-blue-600", onClick: () => openAdjustStockModal(template) }]),
        { label: "Preview QR", icon: "fas fa-qrcode", className: "text-purple-600", onClick: () => previewQRCode(productName, qrCodeText) },
        { label: "Download QR", icon: "fas fa-download", className: "text-indigo-600", onClick: () => downloadQRCode(productName, qrCodeText) },
        { label: "Hapus", icon: "fas fa-trash", className: "text-red-600", onClick: () => confirmDeleteTemplate(templateId) },
      ];
      openGlobalActionMenu({ triggerElement: btn, items });
    });
  });
}

// ============================================================
// MEMBER VIEW - Improved UI with Filters
// ============================================================
const memberFilterState = {
  category: "all",
  availability: "all", // all, available, unavailable
  sortBy: "name", // name, available
};

async function renderBarangMemberView() {
  const container = document.getElementById("barang-content-area");
  container.innerHTML = `<div class="flex items-center justify-center py-12"><i class="fas fa-spinner fa-spin text-3xl text-amber-500"></i></div>`;
  
  try {
    const items = await fetchMemberInventory();
    memberInventoryState.items = items || [];
    
    // Get unique categories for filter
    const categories = [...new Set(memberInventoryState.items.map(i => i.category?.name || "Lainnya"))].sort();
    
    // Apply filters
    const filtered = applyMemberFilters(memberInventoryState.items);
    
    container.innerHTML = `
      <div class="space-y-6">
        <!-- Header with Title -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 class="text-2xl font-bold text-gray-800">Peminjaman Barang</h1>
          <button id="member-refresh-btn" class="px-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 flex items-center gap-2 shadow-sm self-start sm:self-auto">
            <i class="fas fa-sync"></i> Refresh
          </button>
        </div>
        
        <!-- Search & Filters Bar -->
        <div class="bg-white rounded-2xl shadow-md p-4 lg:p-6 space-y-4">
          <!-- Search Bar - Full Width -->
          <div class="relative">
            <span class="absolute inset-y-0 left-4 flex items-center text-gray-400"><i class="fas fa-search text-lg"></i></span>
            <input id="member-search" type="text" value="${memberInventoryState.search || ""}" 
              placeholder="Cari nama barang, kategori, atau lokasi..."
              class="w-full pl-12 pr-4 py-3.5 text-lg border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-gray-50 transition-all"/>
          </div>
          
          <!-- Filter Row -->
          <div class="flex flex-col sm:flex-row gap-3 sm:items-center">
            <!-- Category Filter -->
            <div class="flex-1 sm:max-w-xs">
              <label class="block text-xs font-medium text-gray-500 mb-1 ml-1">Kategori</label>
              <select id="member-filter-category" class="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 text-gray-700">
                <option value="all" ${memberFilterState.category === "all" ? "selected" : ""}>Semua Kategori</option>
                ${categories.map(c => `<option value="${c}" ${memberFilterState.category === c ? "selected" : ""}>${c}</option>`).join("")}
              </select>
            </div>
            
            <!-- Availability Filter -->
            <div class="flex-1 sm:max-w-xs">
              <label class="block text-xs font-medium text-gray-500 mb-1 ml-1">Ketersediaan</label>
              <select id="member-filter-availability" class="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 text-gray-700">
                <option value="all" ${memberFilterState.availability === "all" ? "selected" : ""}>Semua</option>
                <option value="available" ${memberFilterState.availability === "available" ? "selected" : ""}>Tersedia</option>
                <option value="unavailable" ${memberFilterState.availability === "unavailable" ? "selected" : ""}>Tidak Tersedia</option>
              </select>
            </div>
            
            <!-- Sort -->
            <div class="flex-1 sm:max-w-xs">
              <label class="block text-xs font-medium text-gray-500 mb-1 ml-1">Urutkan</label>
              <select id="member-filter-sort" class="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 text-gray-700">
                <option value="name" ${memberFilterState.sortBy === "name" ? "selected" : ""}>Nama (A-Z)</option>
                <option value="available" ${memberFilterState.sortBy === "available" ? "selected" : ""}>Stok Terbanyak</option>
                <option value="category" ${memberFilterState.sortBy === "category" ? "selected" : ""}>Kategori</option>
              </select>
            </div>
            
            <!-- Reset Filter Button -->
            <div class="sm:self-end">
              <button id="member-reset-filter" class="w-full sm:w-auto px-4 py-2.5 text-gray-600 hover:text-amber-600 border border-gray-200 rounded-xl hover:bg-gray-50 flex items-center justify-center gap-2">
                <i class="fas fa-times"></i> Reset
              </button>
            </div>
          </div>
          
          <!-- Results Count -->
          <div class="flex items-center justify-between text-sm text-gray-500 pt-2 border-t border-gray-100">
            <span><strong class="text-gray-800">${filtered.length}</strong> dari ${memberInventoryState.items.length} barang</span>
            ${memberFilterState.category !== "all" || memberFilterState.availability !== "all" || memberInventoryState.search ? 
              '<span class="text-amber-600"><i class="fas fa-filter mr-1"></i>Filter aktif</span>' : ''}
          </div>
        </div>
        
        <!-- Items Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          ${getMemberCardsHTML(filtered)}
        </div>
      </div>
    `;
    
    // Event listeners
    document.getElementById("member-search")?.addEventListener("input", debounce((e) => {
      memberInventoryState.search = e.target.value; 
      renderBarangMemberView(); 
    }, 600));
    
    document.getElementById("member-filter-category")?.addEventListener("change", (e) => {
      memberFilterState.category = e.target.value;
      renderBarangMemberView();
    });
    
    document.getElementById("member-filter-availability")?.addEventListener("change", (e) => {
      memberFilterState.availability = e.target.value;
      renderBarangMemberView();
    });
    
    document.getElementById("member-filter-sort")?.addEventListener("change", (e) => {
      memberFilterState.sortBy = e.target.value;
      renderBarangMemberView();
    });
    
    document.getElementById("member-reset-filter")?.addEventListener("click", () => {
      memberInventoryState.search = "";
      memberFilterState.category = "all";
      memberFilterState.availability = "all";
      memberFilterState.sortBy = "name";
      renderBarangMemberView();
    });
    
    document.getElementById("member-refresh-btn")?.addEventListener("click", () => renderBarangMemberView());
    
    bindMemberCards(container);
  } catch (error) { 
    container.innerHTML = `<div class="bg-red-50 text-red-700 p-6 rounded-xl border border-red-200"><i class="fas fa-exclamation-circle mr-2"></i>${error.message}</div>`; 
  }
}

function applyMemberFilters(items) {
  let result = [...items];
  
  // Search filter
  if (memberInventoryState.search) {
    const q = memberInventoryState.search.toLowerCase();
    result = result.filter(i => 
      i.name?.toLowerCase().includes(q) || 
      i.category?.name?.toLowerCase().includes(q) ||
      i.default_location?.name?.toLowerCase().includes(q)
    );
  }
  
  // Category filter
  if (memberFilterState.category !== "all") {
    result = result.filter(i => (i.category?.name || "Lainnya") === memberFilterState.category);
  }
  
  // Availability filter
  if (memberFilterState.availability === "available") {
    result = result.filter(i => (i.stock?.available || 0) > 0);
  } else if (memberFilterState.availability === "unavailable") {
    result = result.filter(i => (i.stock?.available || 0) === 0);
  }
  
  // Sort
  if (memberFilterState.sortBy === "name") {
    result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } else if (memberFilterState.sortBy === "available") {
    result.sort((a, b) => (b.stock?.available || 0) - (a.stock?.available || 0));
  } else if (memberFilterState.sortBy === "category") {
    result.sort((a, b) => (a.category?.name || "").localeCompare(b.category?.name || ""));
  }
  
  return result;
}

function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function getMemberCardsHTML(items) {
  if (!items.length) {
    return `
      <div class="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
        <i class="fas fa-search text-5xl mb-4"></i>
        <p class="text-lg font-medium">Tidak ada barang ditemukan</p>
        <p class="text-sm">Coba ubah filter atau kata kunci pencarian</p>
      </div>
    `;
  }
  
  return items.map(item => {
    const photo = item.photo_url || "https://placehold.co/300x200/f3f4f6/9ca3af?text=📦";
    const stock = item.stock || { available: 0, total: 0 };
    const isAvailable = stock.available > 0;
    const isSerialized = item.is_serialized;
    
    return `
      <div class="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 group border border-gray-100 flex flex-col">
        <!-- Image -->
        <div class="relative h-40 sm:h-36 overflow-hidden bg-gradient-to-br from-gray-100 to-gray-50">
          <img src="${photo}" alt="${item.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onerror="this.src='https://placehold.co/300x200/f3f4f6/9ca3af?text=📦'"/>
          
          <!-- Type Badge -->
          <div class="absolute top-2 left-2">
            <span class="px-2.5 py-1 rounded-lg text-xs font-semibold ${isSerialized ? 'bg-blue-500/90 text-white' : 'bg-emerald-500/90 text-white'} backdrop-blur-sm">
              ${isSerialized ? '<i class="fas fa-barcode mr-1"></i>Serial' : '<i class="fas fa-cubes mr-1"></i>Qty'}
            </span>
          </div>
          
          <!-- Availability Badge -->
          <div class="absolute top-2 right-2">
            <span class="px-2.5 py-1 rounded-lg text-xs font-semibold ${isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
              ${isAvailable ? `${stock.available} tersedia` : 'Habis'}
            </span>
          </div>
        </div>
        
        <!-- Content -->
        <div class="p-4 flex-1 flex flex-col">
          <h3 class="font-bold text-gray-900 text-base line-clamp-2 mb-2">${item.name}</h3>
          
          <div class="space-y-1 text-xs text-gray-500 mb-3">
            <p class="flex items-center gap-1.5">
              <i class="fas fa-tag text-amber-500 w-4"></i>
              <span>${item.category?.name || "Lainnya"}</span>
            </p>
            <p class="flex items-center gap-1.5">
              <i class="fas fa-map-marker-alt text-blue-500 w-4"></i>
              <span>${item.default_location?.name || "-"}</span>
            </p>
          </div>
          
          <!-- Footer -->
          <div class="mt-auto pt-3 border-t border-gray-100">
            ${isAvailable ? `
              <button type="button" 
                class="member-borrow-btn w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm rounded-xl font-semibold hover:from-amber-600 hover:to-orange-600 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                data-template-id="${item.id}" 
                data-is-serialized="${item.is_serialized}">
                <i class="fas fa-hand-holding"></i> Pinjam
              </button>
            ` : `
              <button type="button" 
                class="w-full py-2.5 bg-gray-100 text-gray-400 text-sm rounded-xl font-medium cursor-not-allowed flex items-center justify-center gap-2" disabled>
                <i class="fas fa-times-circle"></i> Tidak Tersedia
              </button>
            `}
          </div>
        </div>
      </div>
    `;
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
      
      
      <!-- Stock section - ONLY for Non-Serialized items -->
      <div id="stock-section" class="${existing?.is_serialized !== false ? 'hidden' : ''}">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Stok Awal</label>
          <input type="number" name="quantity_on_hand" value="${existing?.quantity_on_hand || 0}" min="0" class="w-full px-3 py-2 border border-gray-300 rounded-lg"/>
          <p class="text-xs text-gray-500 mt-1">Jumlah awal barang yang tersedia</p>
        </div>
      </div>
      
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
    
    // Toggle stock section based on serialized type (only for new products)
    const typeSelect = document.querySelector('select[name="is_serialized"]');
    const stockSection = document.getElementById("stock-section");
    if (typeSelect && stockSection && !isEdit) {
      typeSelect.addEventListener("change", (e) => {
        if (e.target.value === "false") {
          stockSection.classList.remove("hidden");
        } else {
          stockSection.classList.add("hidden");
        }
      });
    }
  }, 100);
}

function handlePhotoPreview(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { notifyError("Ukuran file melebihi 2MB"); return; }
  const preview = document.getElementById("photo-preview");
  const reader = new FileReader();
  reader.onload = (ev) => { preview.innerHTML = `<img src="${ev.target.result}" class="w-full h-full object-cover"/>`; };
  reader.readAsDataURL(file);
}

async function handleProductTemplateSubmit(existingId) {
  const form = document.getElementById("product-template-form");
  const fd = new FormData(form);
  const name = fd.get("name")?.trim();
  
  // Frontend validation
  if (!name) {
    notifyError("Nama produk wajib diisi!");
    return;
  }
  
  // Handle image upload
  let photoUrl = fd.get("photo_url") || null;
  const photoFile = document.getElementById("photo-file-input")?.files[0];
  if (photoFile) {
    try {
      const confirmBtn = document.getElementById("global-modal-confirm");
      if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Uploading...'; }
      photoUrl = await uploadProductImage(photoFile);
    } catch (e) { 
      notifyError("Gagal upload foto: " + e.message); 
      resetConfirmButton();
      return; 
    }
  }
  
  const payload = {
    name: name,
    description: fd.get("description") || null,
    category_id: fd.get("category_id") || null,
    default_location_id: fd.get("default_location_id") || null,
    uom: fd.get("uom") || "unit",
    photo_url: photoUrl,
  };
  
  // Only update is_serialized if the field is enabled (present in FormData)
  // This prevents overwriting it to false when editing (field is disabled)
  const isSerializedVal = fd.get("is_serialized");
  if (isSerializedVal !== null) {
    payload.is_serialized = isSerializedVal === "true";
  }

  // Only update stock for non-serialized items if we are creating or if it's explicitly non-serialized
  if (payload.is_serialized === false) {
    payload.quantity_on_hand = parseInt(fd.get("quantity_on_hand") || "0", 10);
  }
  if (existingId) payload.id = existingId;

  try {
    const token = localStorage.getItem("authToken");
    const res = await fetch("/api/management", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: existingId ? "updateProductTemplate" : "createProductTemplate", payload }) });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Terjadi kesalahan saat menyimpan produk");
    }
    closeGlobalModal();
    notifySuccess("Produk berhasil disimpan!");
    await renderBarangManagementView();
  } catch (e) { 
    notifyError(e.message); 
    resetConfirmButton();
  }
}

function resetConfirmButton() {
  const confirmBtn = document.getElementById("global-modal-confirm");
  if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.innerHTML = 'Simpan'; }
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
    } catch (err) { notifyError(err.message); }
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
    } catch (err) { notifyError(err.message); }
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
  } catch (e) { notifyError(e.message); }
}

function previewQRCode(title, code) {
  const content = `
    <div class="flex flex-col items-center justify-center p-4">
      <div id="preview-qr" class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4"></div>
      <p class="text-lg font-bold text-gray-800">${title}</p>
      <p class="text-sm text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded mt-1">${code}</p>
      <div class="flex gap-3 mt-6 w-full">
        <button id="preview-print-btn" class="flex-1 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors">
          <i class="fas fa-print mr-2"></i> Print
        </button>
        <button id="preview-download-btn" class="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <i class="fas fa-download mr-2"></i> Download
        </button>
      </div>
    </div>
  `;
  
  openGlobalModal({
    title: "Preview QR Code",
    contentHTML: content,
    confirmText: "Tutup",
    onConfirm: () => closeGlobalModal()
  });

  setTimeout(() => {
    const container = document.getElementById("preview-qr");
    if (container) {
      new QRCode(container, { text: code, width: 200, height: 200 });
    }
    
    document.getElementById("preview-print-btn")?.addEventListener("click", () => printQRCode(title, code));
    document.getElementById("preview-download-btn")?.addEventListener("click", () => downloadQRCode(code, code));
  }, 100);
}

function downloadQRCode(filename, code) {
  const div = document.createElement("div");
  const qr = new QRCode(div, { text: code, width: 300, height: 300 });
  
  setTimeout(() => {
    const img = div.querySelector("img");
    if (img && img.src) {
      const link = document.createElement("a");
      link.href = img.src;
      link.download = `${filename}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, 500);
}

function openProductUnitModal(opts = {}) {
  const { templateId, existing = null } = opts;
  const locOpts = productInventoryState.locations.map(l => `<option value="${l.id}" ${existing?.location?.id === l.id ? "selected" : ""}>${l.name}</option>`).join("");
  const content = `
    <form id="product-unit-form" class="space-y-4">
      <!-- Photo Upload Section -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Foto Unit</label>
        <div class="flex items-center gap-4">
          <div id="unit-photo-preview" class="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300">
            ${existing?.photo_url ? `<img src="${existing.photo_url}" class="w-full h-full object-cover"/>` : '<i class="fas fa-camera text-gray-400 text-xl"></i>'}
          </div>
          <div class="flex-1">
            <input type="file" name="unit_photo_file" id="unit-photo-file-input" accept="image/*" class="hidden"/>
            <input type="hidden" name="photo_url" value="${existing?.photo_url || ""}"/>
            <button type="button" id="upload-unit-photo-btn" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
              <i class="fas fa-upload mr-2"></i> Pilih Foto
            </button>
            <p class="text-xs text-gray-500 mt-1">Max 2MB. Opsional.</p>
          </div>
        </div>
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Kode Aset</label>
          <div class="flex gap-2">
            <input type="text" name="asset_code" id="unit-asset-code" value="${existing?.asset_code || ""}" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg"/>
            <button type="button" id="generate-code-btn" class="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200" title="Generate Code"><i class="fas fa-magic"></i></button>
          </div>
        </div>
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
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Catatan (Opsional)</label>
        <textarea name="notes" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Contoh: Ada goresan di body belakang">${existing?.notes || ""}</textarea>
      </div>
    </form>`;
  
  openGlobalModal({ title: existing ? "Edit Unit" : "Tambah Unit Baru", contentHTML: content, confirmText: existing ? "Simpan" : "Tambah", onConfirm: () => handleProductUnitSubmit(templateId, existing?.id) });

  setTimeout(() => {
    document.getElementById("generate-code-btn")?.addEventListener("click", () => {
      const code = "GKI-" + Date.now().toString().slice(-6);
      document.getElementById("unit-asset-code").value = code;
    });
    
    // Photo upload handlers
    document.getElementById("upload-unit-photo-btn")?.addEventListener("click", () => document.getElementById("unit-photo-file-input")?.click());
    document.getElementById("unit-photo-file-input")?.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { notifyError("Ukuran file melebihi 2MB"); return; }
      const preview = document.getElementById("unit-photo-preview");
      const reader = new FileReader();
      reader.onload = (ev) => { preview.innerHTML = `<img src="${ev.target.result}" class="w-full h-full object-cover"/>`; };
      reader.readAsDataURL(file);
    });
  }, 100);
}

async function handleProductUnitSubmit(templateId, existingId) {
  const form = document.getElementById("product-unit-form");
  const fd = new FormData(form);
  
  // Handle photo upload first
  let photoUrl = fd.get("photo_url") || null;
  const photoFile = document.getElementById("unit-photo-file-input")?.files[0];
  if (photoFile) {
    try {
      const confirmBtn = document.getElementById("global-modal-confirm");
      if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Uploading...'; }
      photoUrl = await uploadProductImage(photoFile);
    } catch (e) { 
      notifyError("Gagal upload foto: " + e.message); 
      resetConfirmButton();
      return; 
    }
  }
  
  const payload = { 
    template_id: templateId, 
    asset_code: fd.get("asset_code") || null, 
    serial_number: fd.get("serial_number") || null, 
    location_id: fd.get("location_id") || null, 
    condition: fd.get("condition") || null, 
    purchase_date: fd.get("purchase_date") || null, 
    purchase_price: fd.get("purchase_price") || null,
    notes: fd.get("notes") || null,
    photo_url: photoUrl
  };
  if (existingId) payload.unitId = existingId;
  try {
    const token = localStorage.getItem("authToken");
    const res = await fetch("/api/management", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: existingId ? "updateProductUnit" : "createProductUnit", payload }) });
    if (!res.ok) throw new Error((await res.json()).error || "Gagal");
    closeGlobalModal(); notifySuccess("Unit berhasil disimpan!");
    const detailContainer = document.getElementById("template-detail-container");
    if (detailContainer) await renderTemplateDetailView(templateId);
  } catch (e) { notifyError(e.message); }
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
  
  const rows = units.map(u => `
    <tr class="border-b hover:bg-gray-50 transition-colors">
      <td class="p-3">
        <div class="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
          ${u.photo_url 
            ? `<img src="${u.photo_url}" alt="${u.asset_code || 'Unit'}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-box text-gray-400\\'></i>'"/>` 
            : '<i class="fas fa-box text-gray-400"></i>'}
        </div>
      </td>
      <td class="p-3 font-mono text-sm font-medium text-gray-700">${u.asset_code || "-"}</td>
      <td class="p-3 text-sm text-gray-600">${u.serial_number || "-"}</td>
      <td class="p-3"><span class="text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[u.status] || "bg-gray-100"}">${u.status}</span></td>
      <td class="p-3 text-sm text-gray-600">${u.condition || "-"}</td>
      <td class="p-3 text-sm text-gray-600">${u.location?.name || "-"}</td>
      <td class="p-3 text-sm text-gray-500 italic max-w-xs truncate" title="${u.notes || ""}">${u.notes || "-"}</td>
      <td class="p-3 text-center">
        <button type="button" class="unit-action-btn w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors" data-unit-id="${u.id}">
          <i class="fas fa-ellipsis-v"></i>
        </button>
      </td>
    </tr>
  `).join("");

  return `
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
          <tr>
            <th class="p-3 text-left" style="width: 60px;">Foto</th>
            <th class="p-3 text-left">Kode Aset</th>
            <th class="p-3 text-left">Serial Number</th>
            <th class="p-3 text-left">Status</th>
            <th class="p-3 text-left">Kondisi</th>
            <th class="p-3 text-left">Lokasi</th>
            <th class="p-3 text-left">Catatan</th>
            <th class="p-3 text-center" style="width: 80px;">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 bg-white">${rows}</tbody>
      </table>
    </div>
  `;
}

function bindUnitRowActions(container, templateId) {
  container.querySelectorAll(".unit-action-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const unitId = btn.dataset.unitId;
      // Fetch unit data freshly to ensure we have the latest code for QR
      const units = await fetchProductUnits(templateId);
      const u = units.find(x => x.id === unitId);
      if (!u) return;

      const qrCodeText = u.asset_code || u.serial_number || u.id;

      openGlobalActionMenu({ 
        triggerElement: btn, 
        items: [
          { 
            label: "Preview QR", 
            icon: "fas fa-qrcode", 
            className: "text-gray-700", 
            onClick: () => previewQRCode(u.name || "Unit", qrCodeText) 
          },
          { 
            label: "Download QR", 
            icon: "fas fa-download", 
            className: "text-blue-600", 
            onClick: () => downloadQRCode(u.asset_code || "QR", qrCodeText) 
          },
          { 
            label: "Edit Unit", 
            icon: "fas fa-edit", 
            className: "text-amber-600", 
            onClick: () => openProductUnitModal({ templateId, existing: u }) 
          },
          { 
            label: "Hapus Unit", 
            icon: "fas fa-trash", 
            className: "text-red-600", 
            onClick: () => confirmDeleteUnit(templateId, unitId) 
          },
        ] 
      });
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
  } catch (e) { notifyError(e.message); }
}

async function confirmDeleteTemplate(templateId) {
  if (!confirm("Hapus produk ini?")) return;
  try {
    const token = localStorage.getItem("authToken");
    const res = await fetch("/api/management", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: "deleteProductTemplate", payload: { templateId } }) });
    if (!res.ok) throw new Error((await res.json()).error);
    notifySuccess("Produk dihapus!"); await renderBarangManagementView();
  } catch (e) { notifyError(e.message); }
}

// ============================================================
// MEMBER BORROW
// ============================================================
async function openMemberBorrowModal(templateId, isSerialized) {
  const item = memberInventoryState.items.find(i => i.id === templateId);
  if (!item) return;
  
  let unitsOpts = "";
  let selectedUnitId = null;
  let unitsData = []; // Store full unit data for photo display
  
  if (isSerialized) {
    try { 
      unitsData = await fetchMemberAvailableUnits(templateId); 
      unitsOpts = unitsData.map(u => `<option value="${u.id}" data-photo="${u.photo_url || ''}">${u.asset_code || u.serial_number || u.id}</option>`).join(""); 
      if (!unitsData.length) { 
        notifyError("Tidak ada unit tersedia untuk dipinjam"); 
        return; 
      }
      selectedUnitId = unitsData[0]?.id;
    } catch (e) { notifyError(e.message); return; }
  }
  
  // Get current datetime (rounded to next hour)
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  const startDefault = now.toISOString().slice(0, 16);
  const endNow = new Date(now.getTime() + 2 * 60 * 60 * 1000); // +2 hours
  const endDefault = endNow.toISOString().slice(0, 16);
  
  // Get first unit photo for initial display
  const initialUnitPhoto = unitsData[0]?.photo_url || item.photo_url || "";
  
  const content = `
    <form id="member-borrow-form" class="space-y-4">
      <p class="text-gray-600">Produk: <strong>${item.name}</strong></p>
      
      ${isSerialized ? `
        <!-- Unit Photo Preview -->
        <div class="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
          <div id="borrow-unit-photo" class="w-20 h-20 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
            ${initialUnitPhoto 
              ? `<img src="${initialUnitPhoto}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-box text-gray-400 text-2xl\\'></i>'"/>` 
              : '<i class="fas fa-box text-gray-400 text-2xl"></i>'}
          </div>
          <div class="flex-1">
            <label class="block text-sm font-medium text-gray-700 mb-1">Pilih Unit</label>
            <select name="unit_id" id="borrow-unit-select" required class="w-full px-3 py-2 border border-gray-300 rounded-lg">
              ${unitsOpts}
            </select>
          </div>
        </div>
      ` : `
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Jumlah (max: ${item.stock?.available || 0})</label>
          <input type="number" name="quantity" min="1" max="${item.stock?.available || 1}" value="1" required class="w-full px-3 py-2 border border-gray-300 rounded-lg"/>
        </div>
      `}
      
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            <i class="fas fa-clock text-emerald-500 mr-1"></i> Waktu Mulai
          </label>
          <input type="datetime-local" name="borrow_start" id="borrow-start-input" value="${startDefault}" required 
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"/>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            <i class="fas fa-clock text-red-500 mr-1"></i> Waktu Selesai
          </label>
          <input type="datetime-local" name="borrow_end" id="borrow-end-input" value="${endDefault}" required 
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"/>
        </div>
      </div>
      
      <!-- Existing Schedule Preview -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          <i class="fas fa-calendar-alt text-blue-500 mr-1"></i> Jadwal Peminjaman yang Ada
        </label>
        <div id="borrow-schedule-preview" class="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto border border-gray-200">
          <div class="text-center text-gray-400 py-2">
            <i class="fas fa-spinner fa-spin mr-2"></i> Memuat jadwal...
          </div>
        </div>
      </div>
    </form>
  `;
  
  openGlobalModal({ 
    title: "Ajukan Peminjaman", 
    contentHTML: content, 
    confirmText: "Ajukan", 
    onConfirm: () => handleMemberBorrowSubmit(templateId, isSerialized) 
  });
  
  // Load schedule after modal opens
  setTimeout(async () => {
    await loadBorrowSchedule(isSerialized ? selectedUnitId : templateId, isSerialized);
    
    // If serialized, reload schedule and update photo when unit changes
    if (isSerialized) {
      document.getElementById("borrow-unit-select")?.addEventListener("change", async (e) => {
        const selectedId = e.target.value;
        // Update photo
        const selectedUnit = unitsData.find(u => u.id === selectedId);
        const photoEl = document.getElementById("borrow-unit-photo");
        if (photoEl) {
          const photo = selectedUnit?.photo_url || item.photo_url || "";
          photoEl.innerHTML = photo 
            ? `<img src="${photo}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-box text-gray-400 text-2xl\\'></i>'"/>` 
            : '<i class="fas fa-box text-gray-400 text-2xl"></i>';
        }
        // Reload schedule
        await loadBorrowSchedule(selectedId, true);
      });
    }
  }, 100);
}

async function loadBorrowSchedule(itemId, isSerialized) {
  const previewEl = document.getElementById("borrow-schedule-preview");
  if (!previewEl) return;
  
  try {
    const token = localStorage.getItem("authToken");
    const res = await fetch(`/api/schedule?resource=assets&itemId=${itemId}&isSerialized=${isSerialized}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!res.ok) {
      previewEl.innerHTML = '<p class="text-gray-400 text-center py-2">Gagal memuat jadwal</p>';
      return;
    }
    
    const schedules = await res.json();
    
    if (!schedules || schedules.length === 0) {
      previewEl.innerHTML = '<p class="text-emerald-600 text-center py-2"><i class="fas fa-check-circle mr-1"></i> Tidak ada jadwal - tersedia kapanpun!</p>';
      return;
    }
    
    previewEl.innerHTML = schedules.map(s => {
      const start = new Date(s.borrow_start);
      const end = new Date(s.borrow_end);
      // Check if same day
      const sameDay = start.toDateString() === end.toDateString();
      
      const formatDate = (d) => d.toLocaleDateString('id-ID', {day: 'numeric', month: 'short'});
      const formatTime = (d) => d.toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'});
      
      // If same day: "12 Des 14:00 - 16:00", if different: "12 Des 14:00 → 13 Des 16:00"
      const dateDisplay = sameDay 
        ? `${formatDate(start)} ${formatTime(start)} - ${formatTime(end)}`
        : `${formatDate(start)} ${formatTime(start)} → ${formatDate(end)} ${formatTime(end)}`;
      
      return `
        <div class="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0 text-sm">
          <div class="flex-shrink-0 w-2 h-2 rounded-full ${s.status === 'Dipinjam' ? 'bg-orange-500' : 'bg-yellow-500'}"></div>
          <div class="flex-1">
            <span class="text-gray-700">${dateDisplay}</span>
          </div>
          <span class="text-xs px-2 py-0.5 rounded-full ${s.status === 'Dipinjam' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}">${s.status}</span>
        </div>
      `;
    }).join("");
    
  } catch (e) {
    previewEl.innerHTML = '<p class="text-red-500 text-center py-2">Error: ' + e.message + '</p>';
  }
}

async function handleMemberBorrowSubmit(templateId, isSerialized) {
  const form = document.getElementById("member-borrow-form");
  const fd = new FormData(form);
  
  // Build payload with borrow_start and borrow_end (timestamps)
  const borrowStart = fd.get("borrow_start");
  const borrowEnd = fd.get("borrow_end");
  
  if (!borrowStart || !borrowEnd) {
    notifyError("Waktu mulai dan selesai harus diisi");
    return;
  }
  
  // Add timezone
  const body = { 
    borrow_start: borrowStart + ":00+07:00", 
    borrow_end: borrowEnd + ":00+07:00" 
  };
  
  if (isSerialized) {
    body.unit_id = fd.get("unit_id");
  } else { 
    body.template_id = templateId; 
    body.quantity = parseInt(fd.get("quantity"), 10); 
  }
  
  // Disable button during submission
  const confirmBtn = document.getElementById("global-modal-confirm");
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Mengajukan...';
  }
  
  try {
    const token = localStorage.getItem("authToken");
    const res = await fetch("/api/member?resource=inventory", { 
      method: "POST", 
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, 
      body: JSON.stringify(body) 
    });
    
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Gagal mengajukan peminjaman");
    }
    
    closeGlobalModal(); 
    notifySuccess("Permintaan peminjaman berhasil diajukan!"); 
    await renderBarangMemberView();
  } catch (e) { 
    notifyError(e.message);
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = 'Ajukan';
    }
  }
}

window.loadBarangPage = loadBarangPage;
window.renderBarangListView = renderBarangListView;

// ============================================================
// QR CODE HANDLERS
// ============================================================
function handleQRScan() {
  const content = `
    <div class="flex flex-col items-center">
      <div id="qr-reader" style="width: 100%; max-width: 400px;"></div>
      <p class="text-sm text-gray-500 mt-4">Arahkan kamera ke QR Code barang</p>
    </div>
  `;
  
  openGlobalModal({
    title: "Scan QR Code",
    contentHTML: content,
    confirmText: "Tutup",
    onConfirm: () => { 
      closeGlobalModal(); 
    }
  });

  // Initialize scanner after modal is open
  setTimeout(() => {
    if (!document.getElementById("qr-reader")) return;
    
    // Check if Html5QrcodeScanner is defined
    if (typeof Html5QrcodeScanner === 'undefined') {
      document.getElementById("qr-reader").innerHTML = '<p class="text-red-500">Library QR Scanner tidak dimuat. Cek koneksi internet.</p>';
      return;
    }

    const scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 250 });
    scanner.render(async (decodedText) => {
      // Success
      try { scanner.clear(); } catch(e){}
      closeGlobalModal();
      
      // Check if it's a product template QR (format: PRODUCT:uuid)
      if (decodedText.startsWith("PRODUCT:")) {
        const templateId = decodedText.replace("PRODUCT:", "");
        const template = productInventoryState.templates.find(t => t.id === templateId);
        if (template) {
          notifySuccess(`Produk ditemukan: ${template.name}`);
          await renderTemplateDetailView(templateId);
          return;
        }
      }
      
      // Try to find unit by code (serialized items)
      try {
        const token = localStorage.getItem("authToken");
        const res = await fetch("/api/management", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: "findUnitByCode", payload: { code: decodedText } })
        });
        
        if (res.ok) {
          const unit = await res.json();
          if (unit && unit.template) {
            notifySuccess(`Unit ditemukan: ${unit.asset_code || unit.serial_number}`);
            await renderTemplateDetailView(unit.template.id);
            return;
          }
        }
      } catch (e) {
        console.error("QR Lookup failed", e);
      }

      // Fallback: Update search
      productInventoryState.search = decodedText;
      renderBarangManagementView();
      notifySuccess(`Mencari: ${decodedText}`);
    }, (error) => {
      // Ignore parse errors
    });
    
    // Cleanup on modal close
    const closeBtn = document.getElementById("global-modal-close");
    const confirmBtn = document.getElementById("global-modal-confirm");
    const cleanup = () => { try { scanner.clear(); } catch(e){} };
    if(closeBtn) closeBtn.addEventListener("click", cleanup);
    if(confirmBtn) confirmBtn.addEventListener("click", cleanup);
  }, 200);
}

function printQRCode(title, code) {
  const win = window.open('', '', 'height=500,width=500');
  win.document.write('<html><head><title>Print QR</title>');
  win.document.write('<style>body{font-family:sans-serif;text-align:center;padding:20px;} .label{border:2px solid #000;padding:20px;display:inline-block;border-radius:10px;} h3{margin:10px 0 5px;font-size:18px;} p{margin:0;font-size:14px;color:#555;}</style>');
  win.document.write('</head><body>');
  win.document.write('<div class="label">');
  win.document.write(`<div id="print-qr"></div>`);
  win.document.write(`<h3>${title}</h3>`);
  win.document.write(`<p>${code}</p>`);
  win.document.write('</div>');
  
  win.document.write('<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>');
  win.document.write('<script>');
  win.document.write(`new QRCode(document.getElementById("print-qr"), { text: "${code}", width: 150, height: 150 });`);
  win.document.write('setTimeout(() => { window.print(); window.close(); }, 800);');
  win.document.write('</script>');
  
  win.document.write('</body></html>');
  win.document.close();
}

// ============================================================
// ACTIVE LOANS MODAL - VIEW & MANAGE BORROWED ITEMS
// ============================================================
async function openActiveLoansModal() {
  const content = `
    <div class="h-full flex flex-col">
      <!-- Header Info -->
      <div class="bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl p-4 mb-4">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <i class="fas fa-hand-holding text-2xl"></i>
          </div>
          <div>
            <h3 class="font-bold text-lg">Peminjaman Aktif</h3>
            <p class="text-sm opacity-90">Kelola barang yang sedang dipinjam</p>
          </div>
        </div>
      </div>

      <!-- Data Container -->
      <div id="active-loans-container" class="flex-1 overflow-y-auto bg-white rounded-xl border border-gray-200">
        <div class="flex items-center justify-center py-16 text-gray-400">
          <i class="fas fa-spinner fa-spin text-2xl mr-3"></i> Memuat data...
        </div>
      </div>

      <!-- Footer -->
      <div class="flex justify-between items-center pt-4 border-t border-gray-200 mt-4">
        <div id="active-loans-total" class="text-sm text-gray-600 font-medium"></div>
        <button onclick="closeFullscreenModal()" class="px-6 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium">
          <i class="fas fa-times mr-2"></i> Tutup
        </button>
      </div>
    </div>
  `;

  openFullscreenModal({
    title: "Peminjaman Aktif",
    contentHTML: content
  });

  async function loadActiveLoans() {
    const container = document.getElementById("active-loans-container");
    const totalEl = document.getElementById("active-loans-total");
    
    container.innerHTML = `<div class="flex items-center justify-center py-16 text-gray-400"><i class="fas fa-spinner fa-spin text-2xl mr-3"></i> Memuat data...</div>`;
    
    try {
      const loans = await api.post("/api/management", { action: "getActiveLoans" });

      if (!loans || loans.length === 0) {
        container.innerHTML = `
          <div class="text-center py-16 text-gray-400">
            <i class="fas fa-check-circle text-5xl mb-4 text-green-400"></i>
            <p class="text-lg font-medium text-gray-600">Tidak ada peminjaman aktif</p>
            <p class="text-sm">Semua barang sudah dikembalikan</p>
          </div>`;
        totalEl.textContent = "";
        return;
      }

      // Group by overdue status
      const overdueLoans = loans.filter(l => l.is_overdue);
      const activeLoans = loans.filter(l => !l.is_overdue);

      let html = "";
      
      // Overdue section first
      if (overdueLoans.length > 0) {
        html += `
          <div class="mb-6">
            <div class="bg-red-100 px-5 py-3 font-bold text-red-700 sticky top-0 border-b border-red-200 flex items-center gap-2">
              <i class="fas fa-exclamation-triangle"></i>
              TERLAMBAT DIKEMBALIKAN
              <span class="bg-red-500 text-white px-2 py-0.5 rounded-full text-sm font-medium">${overdueLoans.length}</span>
            </div>
            <div class="divide-y divide-gray-100">
              ${overdueLoans.map(loan => renderActiveLoanRow(loan, true)).join("")}
            </div>
          </div>`;
      }
      
      // Active loans section
      if (activeLoans.length > 0) {
        html += `
          <div class="mb-6">
            <div class="bg-blue-100 px-5 py-3 font-bold text-blue-700 sticky top-0 border-b border-blue-200 flex items-center gap-2">
              <i class="fas fa-clock"></i>
              SEDANG DIPINJAM
              <span class="bg-blue-500 text-white px-2 py-0.5 rounded-full text-sm font-medium">${activeLoans.length}</span>
            </div>
            <div class="divide-y divide-gray-100">
              ${activeLoans.map(loan => renderActiveLoanRow(loan, false)).join("")}
            </div>
          </div>`;
      }

      container.innerHTML = html;
      totalEl.innerHTML = `<span class="text-orange-600 font-bold">${loans.length}</span> peminjaman aktif`;

      // Bind action buttons
      container.querySelectorAll(".loan-action-btn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          const loanId = btn.dataset.loanId;
          const newStatus = btn.dataset.newStatus;
          
          if (!confirm(`Ubah status peminjaman menjadi "${newStatus}"?`)) return;
          
          btn.disabled = true;
          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
          
          try {
            await api.post("/api/management", {
              action: "updateLoanStatus",
              payload: { loanId, newStatus }
            });
            notifySuccess(`Status berhasil diubah menjadi ${newStatus}`);
            loadActiveLoans(); // Refresh list
          } catch (error) {
            notifyError("Gagal mengubah status: " + error.message);
            loadActiveLoans(); // Refresh to restore button state
          }
        });
      });

    } catch (error) {
      container.innerHTML = `
        <div class="text-center py-16 text-red-500">
          <i class="fas fa-exclamation-triangle text-5xl mb-4"></i>
          <p class="text-lg font-medium">Gagal memuat data</p>
          <p class="text-sm text-gray-500 mt-2">${error.message}</p>
        </div>`;
    }
  }

  function renderActiveLoanRow(loan, isOverdue) {
    const photo = loan.photo_url || "https://placehold.co/60x60/f3f4f6/9ca3af?text=📦";
    
    // Use borrow_start/borrow_end if available, fallback to loan_date/due_date
    const startDate = loan.borrow_start || loan.loan_date;
    const endDate = loan.borrow_end || loan.due_date;
    
    // Format with both date and time
    const formatDateTime = (dateStr) => {
      if (!dateStr) return "-";
      const d = new Date(dateStr);
      return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) + 
             " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    };
    
    const startDisplay = formatDateTime(startDate);
    const endDisplay = formatDateTime(endDate);
    
    const statusBadge = loan.status === "Disetujui" 
      ? '<span class="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium">Disetujui</span>'
      : '<span class="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">Dipinjam</span>';
    
    const overdueInfo = isOverdue 
      ? `<span class="text-red-600 font-bold text-sm"><i class="fas fa-exclamation-circle mr-1"></i>Terlambat ${loan.days_overdue} hari</span>`
      : '';
    
    const qtyInfo = loan.quantity > 1 ? `<span class="text-gray-500 text-sm">Qty: ${loan.quantity}</span>` : '';

    return `
      <div class="p-4 hover:bg-gray-50 transition-colors ${isOverdue ? 'bg-red-50/50' : ''}">
        <div class="flex items-start gap-4">
          <!-- Photo -->
          <div class="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
            <img src="${photo}" alt="${loan.item_name}" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/60x60/f3f4f6/9ca3af?text=📦'"/>
          </div>
          
          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <div>
                <h4 class="font-bold text-gray-900">${loan.item_name}</h4>
                ${loan.item_code ? `<p class="text-xs text-gray-400 font-mono">${loan.item_code}</p>` : ''}
                ${qtyInfo}
              </div>
              ${statusBadge}
            </div>
            
            <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
              <span><i class="fas fa-user mr-1 text-gray-400"></i>${loan.borrower_name}</span>
              <span><i class="fas fa-play mr-1 text-emerald-500"></i>${startDisplay}</span>
              <span class="${isOverdue ? 'text-red-600 font-semibold' : ''}"><i class="fas fa-stop mr-1 ${isOverdue ? 'text-red-500' : 'text-gray-400'}"></i>${endDisplay}</span>
            </div>
            
            ${overdueInfo ? `<div class="mt-2">${overdueInfo}</div>` : ''}
          </div>
          
          <!-- Actions -->
          <div class="flex flex-col gap-2 flex-shrink-0">
            <button class="loan-action-btn px-3 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 flex items-center gap-1.5 font-medium shadow-sm" 
              data-loan-id="${loan.id}" data-new-status="Dikembalikan">
              <i class="fas fa-undo"></i> Kembalikan
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Initial load
  setTimeout(loadActiveLoans, 100);
}

// ============================================================
// ASSET HISTORY MODAL - FULLSCREEN VERSION
// ============================================================
async function openAssetHistoryModal() {
  let currentData = [];
  
  // Default: 1 month
  let currentPeriod = "1";
  let currentStatus = "all";
  
  function getDateRange(period) {
    const end = new Date();
    const start = new Date();
    switch(period) {
      case "1": start.setMonth(start.getMonth() - 1); break;
      case "3": start.setMonth(start.getMonth() - 3); break;
      case "6": start.setMonth(start.getMonth() - 6); break;
      case "12": start.setMonth(start.getMonth() - 12); break;
      default: return null;
    }
    return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
  }
  
  let dates = getDateRange("1");
  let currentStartDate = dates.start;
  let currentEndDate = dates.end;

  const content = `
    <div class="h-full flex flex-col">
      <!-- Filter Bar -->
      <div class="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200">
        <div class="flex flex-wrap gap-4 items-end">
          <div class="min-w-[160px]">
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              <i class="fas fa-clock text-amber-500 mr-1"></i> Periode
            </label>
            <select id="history-period" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white">
              <option value="1" selected>1 Bulan Terakhir</option>
              <option value="3">3 Bulan Terakhir</option>
              <option value="6">6 Bulan Terakhir</option>
              <option value="12">1 Tahun Terakhir</option>
              <option value="custom">Pilih Tanggal...</option>
            </select>
          </div>
          <div id="custom-date-container" class="hidden flex-1 flex gap-3 items-end">
            <div class="flex-1 min-w-[140px]">
              <label class="block text-sm font-semibold text-gray-700 mb-2">
                <i class="fas fa-calendar text-amber-500 mr-1"></i> Dari
              </label>
              <input type="date" id="history-start-date" value="${currentStartDate}" 
                class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"/>
            </div>
            <div class="flex-1 min-w-[140px]">
              <label class="block text-sm font-semibold text-gray-700 mb-2">
                <i class="fas fa-calendar-check text-amber-500 mr-1"></i> Sampai
              </label>
              <input type="date" id="history-end-date" value="${currentEndDate}" 
                class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"/>
            </div>
            <button id="history-apply-custom" class="px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium">
              <i class="fas fa-check"></i>
            </button>
          </div>
          <div class="min-w-[160px]">
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              <i class="fas fa-filter text-amber-500 mr-1"></i> Status
            </label>
            <select id="history-status" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white">
              <option value="all">Semua Status</option>
              <option value="Disetujui">Disetujui</option>
              <option value="Ditolak">Ditolak</option>
              <option value="Menunggu Persetujuan">Menunggu Persetujuan</option>
              <option value="Dikembalikan">Dikembalikan</option>
              <option value="Dipinjam">Dipinjam</option>
            </select>
          </div>
          <div class="flex items-center gap-2 ml-auto">
            <button id="history-export-csv" class="px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 font-medium shadow-sm">
              <i class="fas fa-file-csv"></i> CSV
            </button>
            <button id="history-export-excel" class="px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 font-medium shadow-sm">
              <i class="fas fa-file-excel"></i> Excel
            </button>
          </div>
        </div>
      </div>

      <!-- Data Container -->
      <div id="history-data-container" class="flex-1 overflow-y-auto bg-white rounded-xl border border-gray-200">
        <div class="flex items-center justify-center py-16 text-gray-400">
          <i class="fas fa-spinner fa-spin text-2xl mr-3"></i> Memuat data...
        </div>
      </div>

      <!-- Footer -->
      <div class="flex justify-between items-center pt-4 border-t border-gray-200 mt-4">
        <div id="history-total" class="text-sm text-gray-600 font-medium"></div>
        <button onclick="closeFullscreenModal()" class="px-6 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium">
          <i class="fas fa-times mr-2"></i> Tutup
        </button>
      </div>
    </div>
  `;

  openFullscreenModal({
    title: "Riwayat Peminjaman Barang",
    contentHTML: content
  });

  async function loadHistoryData() {
    const container = document.getElementById("history-data-container");
    const totalEl = document.getElementById("history-total");
    
    container.innerHTML = `<div class="flex items-center justify-center py-16 text-gray-400"><i class="fas fa-spinner fa-spin text-2xl mr-3"></i> Memuat data...</div>`;
    
    try {
      currentData = await api.post("/api/management", {
        action: "getAssetLoanHistory",
        payload: { 
          startDate: currentStartDate, 
          endDate: currentEndDate, 
          status: currentStatus 
        }
      });

      if (!currentData || currentData.length === 0) {
        container.innerHTML = `
          <div class="text-center py-16 text-gray-400">
            <i class="fas fa-inbox text-5xl mb-4"></i>
            <p class="text-lg">Tidak ada data untuk periode ini</p>
          </div>`;
        totalEl.textContent = "";
        return;
      }

      // Group by month
      const grouped = groupDataByMonth(currentData, "loan_date");

      let html = "";
      grouped.forEach(group => {
        html += `
          <div class="mb-6">
            <div class="bg-gradient-to-r from-gray-100 to-gray-50 px-5 py-3 font-bold text-gray-700 sticky top-0 border-b border-gray-200 flex items-center gap-2">
              <i class="fas fa-calendar-alt text-amber-500"></i>
              ${group.label} 
              <span class="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-sm font-medium">${group.items.length}</span>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full">
                <thead class="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200">
                  <tr>
                    <th class="px-5 py-3 text-left font-semibold">Mulai</th>
                    <th class="px-5 py-3 text-left font-semibold">Selesai</th>
                    <th class="px-5 py-3 text-left font-semibold">Barang</th>
                    <th class="px-5 py-3 text-left font-semibold">Peminjam</th>
                    <th class="px-5 py-3 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  ${group.items.map(item => {
                    const itemName = item.product_units?.template?.name || item.product_templates?.name || "-";
                    const itemCode = item.product_units?.asset_code || "";
                    // Use borrow_start/borrow_end if available, fallback to loan_date/due_date
                    const startDate = item.borrow_start || item.loan_date;
                    const endDate = item.borrow_end || item.due_date;
                    const formatDateTime = (d) => {
                      if (!d) return "-";
                      const dt = new Date(d);
                      return dt.toLocaleDateString("id-ID", {day: "numeric", month: "short"}) + 
                             " " + dt.toLocaleTimeString("id-ID", {hour: "2-digit", minute: "2-digit"});
                    };
                    return `
                    <tr class="hover:bg-amber-50/50 transition-colors">
                      <td class="px-5 py-3 text-sm">${formatDateTime(startDate)}</td>
                      <td class="px-5 py-3 text-sm">${formatDateTime(endDate)}</td>
                      <td class="px-5 py-3">
                        <div class="font-medium text-gray-800">${itemName}</div>
                        ${itemCode ? `<div class="text-xs text-gray-400 font-mono">${itemCode}</div>` : ""}
                        ${item.quantity > 1 ? `<div class="text-xs text-gray-500">Qty: ${item.quantity}</div>` : ""}
                      </td>
                      <td class="px-5 py-3 text-sm">${item.profiles?.full_name || "-"}</td>
                      <td class="px-5 py-3">${getStatusBadgeHTML(item.status)}</td>
                    </tr>
                  `}).join("")}
                </tbody>
              </table>
            </div>
          </div>`;
      });

      container.innerHTML = html;
      totalEl.innerHTML = `<span class="text-amber-600 font-bold">${currentData.length}</span> data ditemukan`;

    } catch (error) {
      container.innerHTML = `
        <div class="text-center py-16 text-red-500">
          <i class="fas fa-exclamation-triangle text-5xl mb-4"></i>
          <p class="text-lg font-medium">Gagal memuat data</p>
          <p class="text-sm text-gray-500 mt-2">${error.message}</p>
        </div>`;
    }
  }

  // Initial load
  setTimeout(loadHistoryData, 100);

  // Event listeners
  setTimeout(() => {
    const periodSelect = document.getElementById("history-period");
    const customContainer = document.getElementById("custom-date-container");
    const statusSelect = document.getElementById("history-status");
    
    // Period change
    periodSelect?.addEventListener("change", (e) => {
      currentPeriod = e.target.value;
      if (currentPeriod === "custom") {
        customContainer.classList.remove("hidden");
      } else {
        customContainer.classList.add("hidden");
        const dates = getDateRange(currentPeriod);
        if (dates) {
          currentStartDate = dates.start;
          currentEndDate = dates.end;
          loadHistoryData();
        }
      }
    });
    
    // Status change - auto apply
    statusSelect?.addEventListener("change", () => {
      currentStatus = statusSelect.value;
      loadHistoryData();
    });
    
    // Custom date apply
    document.getElementById("history-apply-custom")?.addEventListener("click", () => {
      currentStartDate = document.getElementById("history-start-date").value;
      currentEndDate = document.getElementById("history-end-date").value;
      loadHistoryData();
    });

    document.getElementById("history-export-csv")?.addEventListener("click", () => {
      const columns = [
        { label: "Tanggal Pinjam", getValue: item => new Date(item.loan_date).toLocaleDateString("id-ID") },
        { label: "Barang", getValue: item => item.product_units?.template?.name || item.product_templates?.name || "-" },
        { label: "Kode", getValue: item => item.product_units?.asset_code || "-" },
        { label: "Peminjam", getValue: item => item.profiles?.full_name || "-" },
        { label: "Keperluan", key: "purpose" },
        { label: "Jatuh Tempo", getValue: item => item.due_date ? new Date(item.due_date).toLocaleDateString("id-ID") : "-" },
        { label: "Tanggal Kembali", getValue: item => item.return_date ? new Date(item.return_date).toLocaleDateString("id-ID") : "-" },
        { label: "Status", key: "status" }
      ];
      exportToCSV(currentData, "riwayat_peminjaman_barang", columns);
    });

    document.getElementById("history-export-excel")?.addEventListener("click", () => {
      const columns = [
        { label: "Tanggal Pinjam", getValue: item => new Date(item.loan_date).toLocaleDateString("id-ID") },
        { label: "Barang", getValue: item => item.product_units?.template?.name || item.product_templates?.name || "-" },
        { label: "Kode", getValue: item => item.product_units?.asset_code || "-" },
        { label: "Peminjam", getValue: item => item.profiles?.full_name || "-" },
        { label: "Keperluan", key: "purpose" },
        { label: "Jatuh Tempo", getValue: item => item.due_date ? new Date(item.due_date).toLocaleDateString("id-ID") : "-" },
        { label: "Tanggal Kembali", getValue: item => item.return_date ? new Date(item.return_date).toLocaleDateString("id-ID") : "-" },
        { label: "Status", key: "status" }
      ];
      exportToExcel(currentData, "riwayat_peminjaman_barang", columns);
    });
  }, 150);
}
