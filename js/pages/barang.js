/**
 * Barang (Assets) Page Module
 * Handles asset listing, detail views, QR tooling, CRUD (management) & borrowing (member)
 */

let fullCalendarInstance;
let calendarResizeObserver = null;

const ASSET_QR_LIBRARY_URL =
  "https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js";
const ASSET_JSQR_LIBRARY_URL =
  "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";

const assetManagementState = {
  assets: [],
  search: "",
  categories: [],
  commissions: [],
};

// Inventory (produk & unit terserialisasi)
const productInventoryState = {
  templates: [],
  locations: [],
  search: "",
  categories: [],
};

const assetMemberState = {
  assets: [],
  search: "",
};

const assetScanState = {
  modal: null,
  video: null,
  canvas: null,
  context: null,
  messageEl: null,
  stream: null,
  frameId: null,
  onDetected: null,
};

const loadedExternalScripts = {};

async function loadBarangPage() {
  const contentArea = document.getElementById("content-area");
  showLoader();
  try {
    contentArea.innerHTML = "";
    const template = document
      .getElementById("barang-template")
      .content.cloneNode(true);
    contentArea.appendChild(template);
    await renderBarangListView();
  } catch (error) {
    contentArea.innerHTML = `<p class="text-red-500">Terjadi error saat memuat halaman barang: ${error.message}</p>`;
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

async function renderBarangManagementView() {
  const container = document.getElementById("barang-content-area");
  container.innerHTML = `
    <div class="bg-white rounded-lg shadow-md p-6">
      <p class="text-gray-500">Memuat data inventori...</p>
    </div>
  `;

  try {
    await ensureInventoryMeta();
    const templates = await fetchProductTemplates();
    productInventoryState.templates = templates || [];
    const visible = filterProductTemplates(
      productInventoryState.templates,
      productInventoryState.search
    );

    container.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-col gap-4 md:flex-row md:items-center">
          <div class="flex-1 relative">
            <span class="absolute inset-y-0 left-3 flex items-center text-gray-400">
              <i class="fas fa-search"></i>
            </span>
            <input
              id="product-search-input"
              type="text"
              value="${productInventoryState.search || ""}"
              placeholder="Cari nama produk, kategori, lokasi..."
              class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#d97706] focus:border-[#d97706]"
            />
          </div>
          <div class="flex gap-3">
            <button
              id="product-scan-btn"
              class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 flex items-center justify-center gap-2"
              type="button"
            >
              <i class="fas fa-qrcode"></i>
              Scan QR
            </button>
            <button
              id="product-add-btn"
              class="px-4 py-2 bg-[#d97706] text-white font-semibold rounded-md hover:bg-[#b45309] flex items-center justify-center gap-2"
              type="button"
            >
              <i class="fas fa-plus"></i>
              Tambah Produk
            </button>
            <button
              id="product-refresh-btn"
              class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 flex items-center justify-center gap-2"
              type="button"
            >
              <i class="fas fa-sync"></i>
              Refresh
            </button>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-md overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <tr>
                <th class="p-3">Produk</th>
                <th class="p-3">Kategori</th>
                <th class="p-3">Lokasi Default</th>
                <th class="p-3">Stok</th>
                <th class="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${getTemplateRowsHTML(visible)}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document
      .getElementById("product-search-input")
      ?.addEventListener("input", (event) => {
        scheduleTemplateSearch(event.target.value);
      });

    document
      .getElementById("product-add-btn")
      ?.addEventListener("click", () => openProductTemplateModal());

    document
      .getElementById("product-scan-btn")
      ?.addEventListener("click", () =>
        openAssetScanModal(handleInventoryScan)
      );

    document
      .getElementById("product-refresh-btn")
      ?.addEventListener("click", () => renderBarangManagementView());

    bindTemplateRowActions(container);
  } catch (error) {
    container.innerHTML = `
      <div class="bg-red-50 text-red-700 p-4 rounded-md">
        <p class="font-semibold">Gagal memuat data inventori.</p>
        <p class="text-sm mt-1">${error.message}</p>
      </div>
    `;
  }
}

function getAssetTableRowsHTML(assets = []) {
  if (!assets.length) {
    return `
      <tr>
        <td colspan="9" class="p-6 text-center text-gray-500">
          Belum ada data barang. Klik <strong>Tambah Barang</strong> untuk menambahkan.
        </td>
      </tr>
    `;
  }

  return assets
    .map((asset) => {
      const photo = getAssetPhotoUrl(asset);
      return `
        <tr class="border-b last:border-b-0 hover:bg-gray-50">
          <td class="p-3">
            <img
              src="${photo}"
              alt="${asset.asset_name}"
              class="w-16 h-16 rounded-md object-cover border border-gray-200"
            />
          </td>
          <td class="p-3">
            <p class="font-semibold text-gray-800">${asset.asset_name}</p>
            <p class="text-xs text-gray-500">${
              asset.asset_code || "Tanpa kode"
            }</p>
          </td>
          <td class="p-3">${asset.commission?.name || "-"}</td>
          <td class="p-3">${
            asset.storage_location || asset.location || "-"
          }</td>
          <td class="p-3">${asset.category?.name || "-"}</td>
          <td class="p-3">${asset.condition || "-"}</td>
          <td class="p-3">${asset.quantity ?? 0}</td>
          <td class="p-3">${formatAssetStatusBadge(asset.status)}</td>
          <td class="p-3 text-center">
            <button
              type="button"
              class="asset-row-action action-menu-btn inline-flex items-center justify-center rounded-md border border-gray-300 shadow-sm px-3 py-2 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none"
              data-asset-id="${asset.id}"
            >
              <i class="fas fa-ellipsis-v"></i>
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function formatAssetStatusBadge(status = "") {
  const classes = getStatusBadgeClasses(status);
  const label = status || "Tidak diketahui";
  return `<span class="${classes}">${label}</span>`;
}

function getStatusBadgeClasses(status = "") {
  const base =
    "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold";
  switch (status) {
    case "Tersedia":
      return `${base} bg-green-100 text-green-700`;
    case "Dipinjam":
      return `${base} bg-amber-100 text-amber-700`;
    case "Tidak Aktif":
      return `${base} bg-gray-200 text-gray-600`;
    default:
      return `${base} bg-blue-100 text-blue-700`;
  }
}

function bindAssetRowMenus(root) {
  root.querySelectorAll(".asset-row-action").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const assetId = button.dataset.assetId;
      const asset = assetManagementState.assets.find(
        (item) => item.id === assetId
      );
      if (!asset) return;

      openGlobalActionMenu({
        triggerElement: button,
        items: [
          {
            label: "Lihat Detail",
            icon: "fas fa-eye",
            className: "text-gray-700",
            onClick: () =>
              renderBarangDetailView(asset.id, { context: "management" }),
          },
          {
            label: "Edit",
            icon: "fas fa-edit",
            className: "text-amber-600",
            onClick: () => openAssetModal("edit", asset),
          },
          {
            label: asset.status === "Tidak Aktif" ? "Aktifkan" : "Nonaktifkan",
            icon:
              asset.status === "Tidak Aktif"
                ? "fas fa-toggle-on"
                : "fas fa-toggle-off",
            className:
              asset.status === "Tidak Aktif"
                ? "text-green-600"
                : "text-red-600",
            onClick: () =>
              handleAssetStatusChange(
                asset.id,
                asset.status === "Tidak Aktif" ? "Tersedia" : "Tidak Aktif"
              ),
          },
          {
            label: "Download Label",
            icon: "fas fa-download",
            onClick: () => downloadAssetLabel(asset),
          },
          {
            label: "Cetak Label",
            icon: "fas fa-print",
            onClick: () => printAssetLabel(asset),
          },
        ],
      });
    });
  });
}

let managementSearchTimeout;
function scheduleManagementSearch(value) {
  assetManagementState.search = value;
  clearTimeout(managementSearchTimeout);
  managementSearchTimeout = setTimeout(() => {
    renderBarangManagementView();
  }, 350);
}

async function ensureAssetMetaLoaded() {
  if (
    assetManagementState.categories.length > 0 &&
    assetManagementState.commissions.length > 0
  ) {
    return;
  }
  const meta = await api.post("/api/management", { action: "getAssetMeta" });
  assetManagementState.categories = meta?.categories || [];
  assetManagementState.commissions = meta?.commissions || [];
}

async function fetchManagementAssets() {
  const payload = assetManagementState.search
    ? { search: assetManagementState.search }
    : {};
  return api.post("/api/management", {
    action: "getAssets",
    payload,
  });
}

// ========= INVENTORY (PRODUCT TEMPLATES & UNITS) =========
async function fetchProductTemplates() {
  return api.post("/api/management", { action: "getProductTemplates" });
}

async function fetchProductUnits(templateId) {
  return api.post("/api/management", {
    action: "getProductUnits",
    payload: { templateId },
  });
}

async function fetchStockLocations() {
  return api.post("/api/management", { action: "getStockLocations" });
}

async function createStockLocation(payload) {
  return api.post("/api/management", {
    action: "createStockLocation",
    payload,
  });
}

async function createProductTemplate(payload) {
  return api.post("/api/management", {
    action: "createProductTemplate",
    payload,
  });
}

async function updateProductTemplate(payload) {
  return api.post("/api/management", {
    action: "updateProductTemplate",
    payload,
  });
}

async function createProductUnit(payload) {
  return api.post("/api/management", {
    action: "createProductUnit",
    payload,
  });
}

async function createCategory(payload) {
  return api.post("/api/management", { action: "createCategory", payload });
}

function filterProductTemplates(list = [], term = "") {
  if (!term) return list;
  const q = term.toLowerCase().trim();
  return list.filter((t) => {
    const cat = t.category?.name || "";
    const loc = t.default_location?.name || "";
    return (
      (t.name || "").toLowerCase().includes(q) ||
      cat.toLowerCase().includes(q) ||
      loc.toLowerCase().includes(q)
    );
  });
}

function getTemplateRowsHTML(templates = []) {
  if (!templates.length) {
    return `
      <tr>
        <td colspan="5" class="p-6 text-center text-gray-500">
          Belum ada produk. Tambahkan data lewat migrasi atau backend.
        </td>
      </tr>
    `;
  }

  return templates
    .map((t) => {
      const stock = t.stock || {};
      return `
        <tr class="border-b last:border-b-0 hover:bg-gray-50">
          <td class="p-3">
            <div class="flex items-center gap-3">
              <img src="${
                t.photo_url || "https://placehold.co/80x80"
              }" class="w-12 h-12 rounded-md object-cover border" alt="${
        t.name
      }" />
              <div>
                <p class="font-semibold text-gray-800">${t.name}</p>
                <p class="text-xs text-gray-500">${
                  t.is_serialized ? "Serialized" : "Non-Serialized"
                }</p>
              </div>
            </div>
          </td>
          <td class="p-3">${t.category?.name || "-"}</td>
          <td class="p-3">${t.default_location?.name || "-"}</td>
          <td class="p-3">
            <div class="flex flex-wrap gap-2 text-xs">
              <span class="px-2 py-1 rounded-full bg-gray-100 text-gray-700">Total: ${
                stock.total ?? 0
              }</span>
              <span class="px-2 py-1 rounded-full bg-green-100 text-green-700">Avail: ${
                stock.available ?? 0
              }</span>
              <span class="px-2 py-1 rounded-full bg-amber-100 text-amber-700">Borrowed: ${
                stock.borrowed ?? 0
              }</span>
              <span class="px-2 py-1 rounded-full bg-blue-100 text-blue-700">Maint: ${
                stock.maintenance ?? 0
              }</span>
              <span class="px-2 py-1 rounded-full bg-purple-100 text-purple-700">Scrap: ${
                stock.scrapped ?? 0
              }</span>
            </div>
          </td>
          <td class="p-3 text-center">
            <button
              type="button"
              class="template-action-menu action-menu-btn inline-flex items-center justify-center rounded-md border border-gray-300 shadow-sm px-3 py-2 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none"
              data-template-id="${t.id}"
            >
              <i class="fas fa-ellipsis-v"></i>
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

let templateSearchTimeout;
function scheduleTemplateSearch(value) {
  productInventoryState.search = value;
  clearTimeout(templateSearchTimeout);
  templateSearchTimeout = setTimeout(() => renderBarangManagementView(), 250);
}

function bindTemplateRowActions(root) {
  root.querySelectorAll(".template-action-menu").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      const templateId = btn.dataset.templateId;
      const template = productInventoryState.templates.find(
        (t) => t.id === templateId
      );
      if (!template) return;

      const items = [
        {
          label: "Lihat Detail",
          icon: "fas fa-eye",
          className: "text-gray-700",
          onClick: () => renderTemplateDetailView(templateId),
        },
        {
          label: "Edit",
          icon: "fas fa-edit",
          className: "text-amber-600",
          onClick: () => openProductTemplateModal(template),
        },
        {
          label: "Nonaktifkan",
          icon: "fas fa-toggle-off",
          className: "text-red-600",
          onClick: () =>
            alert(
              "Nonaktif/aktivasi produk belum diimplementasi. Gunakan edit/hapus sesuai kebutuhan."
            ),
        },
        {
          label: "Tambah Unit",
          icon: "fas fa-plus-circle",
          className: "text-green-600",
          onClick: () => openProductUnitModal({ templateId }),
        },
        {
          label: "Download Label",
          icon: "fas fa-download",
          className: "text-gray-500",
          onClick: () =>
            alert("Label per unit. Buka detail unit untuk download label."),
        },
        {
          label: "Cetak Label",
          icon: "fas fa-print",
          className: "text-gray-500",
          onClick: () =>
            alert("Label per unit. Buka detail unit untuk cetak label."),
        },
      ];

      // fallback jika openGlobalActionMenu tidak tersedia
      if (typeof openGlobalActionMenu === "function") {
        openGlobalActionMenu({ triggerElement: btn, items });
      } else {
        const choice = prompt(
          "Pilih aksi: 1.Detail 2.Edit 3.Tambah Unit 4.Download Label 5.Cetak Label"
        );
        if (choice === "1") items[0].onClick();
        else if (choice === "2") items[1].onClick();
        else if (choice === "3") items[3].onClick();
        else if (choice === "4") items[4].onClick();
        else if (choice === "5") items[5].onClick();
      }
    });
  });
}

async function ensureInventoryMeta() {
  // load categories & locations once
  if (
    productInventoryState.categories.length &&
    productInventoryState.locations.length
  )
    return;
  const [cats, locs] = await Promise.all([
    api
      .post("/api/management", { action: "getAssetMeta" })
      .then((d) => d.categories || []),
    fetchStockLocations(),
  ]);
  productInventoryState.categories = cats || [];
  productInventoryState.locations = locs || [];
}

async function renderBarangMemberView() {
  const container = document.getElementById("barang-content-area");
  container.innerHTML = `
    <div class="bg-white rounded-lg shadow-md p-6">
      <p class="text-gray-500">Memuat daftar barang...</p>
    </div>
  `;

  try {
    const assets = await api.get("/api/member?resource=assets");
    assetMemberState.assets = assets || [];
    const filtered = filterAssetsBySearch(
      assetMemberState.assets.filter((asset) => asset.status !== "Tidak Aktif"),
      assetMemberState.search
    );

    container.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-col gap-3 md:flex-row md:items-center">
          <div class="relative flex-1">
            <span class="absolute inset-y-0 left-3 flex items-center text-gray-400">
              <i class="fas fa-search"></i>
            </span>
            <input
              id="member-asset-search"
              type="text"
              value="${assetMemberState.search || ""}"
              placeholder="Cari barang berdasarkan nama atau kode"
              class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#d97706] focus:border-[#d97706]"
            />
          </div>
          <button
            id="member-asset-scan-btn"
            class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 flex items-center justify-center gap-2"
            type="button"
          >
            <i class="fas fa-qrcode"></i>
            Scan QR
          </button>
        </div>

        <div id="member-asset-grid">
          ${buildMemberAssetGrid(filtered)}
        </div>
      </div>
    `;

    const searchInput = document.getElementById("member-asset-search");
    if (searchInput) {
      searchInput.addEventListener("input", (event) => {
        scheduleMemberSearch(event.target.value);
      });
    }

    document
      .getElementById("member-asset-scan-btn")
      .addEventListener("click", () =>
        openAssetScanModal(handleAssetScanResult)
      );

    bindMemberAssetCards(document.getElementById("member-asset-grid"));
  } catch (error) {
    container.innerHTML = `
      <div class="bg-red-50 text-red-700 p-4 rounded-md">
        <p class="font-semibold">Gagal memuat barang.</p>
        <p class="text-sm mt-1">${error.message}</p>
      </div>
    `;
  }
}

function buildMemberAssetGrid(assets = []) {
  if (!assets.length) {
    return `
      <div class="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
        Barang tidak ditemukan. Coba gunakan kata kunci lain atau scan QR label.
      </div>
    `;
  }

  return `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      ${assets
        .map(
          (asset) => `
          <div
            class="asset-card bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-lg transition cursor-pointer"
            data-asset-id="${asset.id}"
          >
            <div class="relative">
              <img
                src="${getAssetPhotoUrl(asset)}"
                alt="${asset.asset_name}"
                class="w-full h-48 object-cover rounded-t-lg"
              />
              <span class="absolute top-3 left-3 bg-white/90 text-xs font-semibold px-2 py-1 rounded-md shadow">
                ${asset.asset_code || "Tanpa kode"}
              </span>
            </div>
            <div class="p-4 space-y-2">
              <div class="flex items-center justify-between gap-2">
                <h3 class="font-semibold text-gray-800 text-lg truncate">
                  ${asset.asset_name}
                </h3>
                ${formatAssetStatusBadge(asset.status)}
              </div>
              <p class="text-sm text-gray-500">
                <i class="fas fa-tag mr-1"></i>${
                  asset.category?.name || "Tanpa kategori"
                }
              </p>
              <p class="text-sm text-gray-500">
                <i class="fas fa-map-marker-alt mr-1"></i>${
                  asset.storage_location || asset.location || "-"
                }
              </p>
            </div>
          </div>
        `
        )
        .join("")}
    </div>
  `;
}

function bindMemberAssetCards(root) {
  if (!root) return;
  root.querySelectorAll(".asset-card").forEach((card) => {
    card.addEventListener("click", () => {
      const assetId = card.dataset.assetId;
      renderBarangDetailView(assetId, { context: "member" });
    });
  });
}

let memberSearchTimeout;
function scheduleMemberSearch(value) {
  assetMemberState.search = value;
  clearTimeout(memberSearchTimeout);
  memberSearchTimeout = setTimeout(() => {
    const grid = document.getElementById("member-asset-grid");
    if (!grid) return;
    const filtered = filterAssetsBySearch(
      assetMemberState.assets.filter((asset) => asset.status !== "Tidak Aktif"),
      assetMemberState.search
    );
    grid.innerHTML = buildMemberAssetGrid(filtered);
    bindMemberAssetCards(grid);
  }, 250);
}

function filterAssetsBySearch(list = [], term = "") {
  if (!term) return list;
  const query = term.toLowerCase().trim();
  return list.filter((asset) => {
    return (
      (asset.asset_name || "").toLowerCase().includes(query) ||
      (asset.asset_code || "").toLowerCase().includes(query) ||
      (asset.category?.name || "").toLowerCase().includes(query) ||
      (asset.storage_location || asset.location || "")
        .toLowerCase()
        .includes(query)
    );
  });
}

async function renderBarangDetailView(assetId, options = {}) {
  const context =
    options.context ||
    (localStorage.getItem("userRole") === "management"
      ? "management"
      : "member");
  const container = document.getElementById("barang-content-area");
  container.innerHTML = `
    <div class="bg-white rounded-lg shadow-md p-6">
      <p class="text-gray-500">Memuat detail barang...</p>
    </div>
  `;

  showLoader();
  try {
    let asset = getAssetFromState(assetId, context);
    if (!asset) {
      asset = await fetchAssetById(assetId, context);
    }
    if (!asset) {
      container.innerHTML = `<p class="text-red-500">Barang tidak ditemukan atau telah dihapus.</p>`;
      return;
    }

    const schedule = await api.get(`/api/schedule?type=asset&id=${assetId}`);

    container.innerHTML = `
      <div class="space-y-6">
        <button
          id="asset-back-button"
          class="text-[#d97706] hover:underline flex items-center gap-2 font-semibold"
        >
          <i class="fas fa-arrow-left"></i>
          <span>Kembali ke Daftar</span>
        </button>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="bg-white rounded-lg shadow-md p-6 space-y-4">
            <img
              src="${getAssetPhotoUrl(asset)}"
              alt="${asset.asset_name}"
              class="w-full h-64 object-cover rounded-lg border border-gray-200"
            />
            <div>
              <p class="text-sm text-gray-500 uppercase tracking-wide mb-1">Kode Barang</p>
              <p class="text-2xl font-bold text-gray-800">${
                asset.asset_code || "Belum tersedia"
              }</p>
              </div>

            <div class="space-y-2 text-sm text-gray-600">
              ${buildAssetInfoDetails(asset)}
              </div>

            <div class="bg-gray-50 rounded-lg p-4">
              <p class="text-sm font-semibold text-gray-700 mb-2">QR & Label</p>
              <div class="flex flex-col items-center gap-3">
                <div
                  id="asset-detail-qr"
                  class="w-40 h-40 flex items-center justify-center border border-dashed border-gray-300 rounded-lg text-center text-xs text-gray-500"
                >
                  QR belum tersedia
          </div>
                <div class="flex gap-2">
                  <button
                    type="button"
                    id="asset-detail-download"
                    class="px-3 py-2 border rounded-md text-sm flex items-center gap-2 ${
                      asset.asset_code
                        ? "hover:bg-gray-100"
                        : "opacity-50 cursor-not-allowed"
                    }"
                    ${asset.asset_code ? "" : "disabled"}
                  >
                    <i class="fas fa-download"></i>
                    Download
                  </button>
                  <button
                    type="button"
                    id="asset-detail-print"
                    class="px-3 py-2 border rounded-md text-sm flex items-center gap-2 ${
                      asset.asset_code
                        ? "hover:bg-gray-100"
                        : "opacity-50 cursor-not-allowed"
                    }"
                    ${asset.asset_code ? "" : "disabled"}
                  >
                    <i class="fas fa-print"></i>
                    Cetak
                  </button>
                </div>
              </div>
            </div>

            ${buildDetailActionSection(asset, context)}
          </div>

          <div class="lg:col-span-2 space-y-6">
            <div class="bg-white rounded-lg shadow-md p-6">
              <h3 class="text-lg font-bold text-gray-800 mb-4">Kalender Peminjaman</h3>
              <div id="asset-detail-calendar"></div>
            </div>

            <div class="bg-white rounded-lg shadow-md p-6">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-bold text-gray-800">Riwayat Peminjaman</h3>
                <span class="text-sm text-gray-500">${
                  schedule?.length || 0
                } catatan</span>
              </div>
              <div id="asset-history-container">
                ${buildAssetHistoryList(schedule)}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document
      .getElementById("asset-back-button")
      .addEventListener("click", () => {
        if (context === "management") {
          renderBarangManagementView();
        } else {
          renderBarangMemberView();
        }
      });

    if (asset.asset_code) {
      await renderAssetQrPreview("asset-detail-qr", asset.asset_code);
      document
        .getElementById("asset-detail-download")
        ?.addEventListener("click", () => downloadAssetLabel(asset));
      document
        .getElementById("asset-detail-print")
        ?.addEventListener("click", () => printAssetLabel(asset));
    }

    if (context === "management") {
      document
        .getElementById("asset-detail-edit")
        ?.addEventListener("click", () => openAssetModal("edit", asset));
      document
        .getElementById("asset-detail-toggle")
        ?.addEventListener("click", () =>
          handleAssetStatusChange(
            asset.id,
            asset.status === "Tidak Aktif" ? "Tersedia" : "Tidak Aktif"
          )
        );
    } else {
      wireMemberBorrowSection(assetId, asset.status === "Tersedia");
    }

    await initAssetCalendar(schedule);
  } catch (error) {
    container.innerHTML = `<p class="text-red-500">Gagal memuat detail barang: ${error.message}</p>`;
  } finally {
    hideLoader();
  }
}

// ========== TEMPLATE DETAIL (Management) ==========
async function renderTemplateDetailView(templateId) {
  const container = document.getElementById("barang-content-area");
  container.innerHTML = `
    <div class="bg-white rounded-lg shadow-md p-6">
      <p class="text-gray-500">Memuat detail produk...</p>
    </div>
  `;

  showLoader();
  try {
    const template =
      productInventoryState.templates.find((t) => t.id === templateId) || null;
    if (!template) {
      container.innerHTML = `<p class="text-red-500">Produk tidak ditemukan.</p>`;
      return;
    }

    const units = (await fetchProductUnits(templateId)) || [];
    const stock = template.stock || {};

    container.innerHTML = `
      <div class="space-y-6">
        <button
          id="template-back-button"
          class="text-[#d97706] hover:underline flex items-center gap-2 font-semibold"
        >
          <i class="fas fa-arrow-left"></i>
          <span>Kembali ke Daftar Produk</span>
        </button>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="bg-white rounded-lg shadow-md p-6 space-y-4">
            <img
              src="${
                template.photo_url ||
                "https://placehold.co/400x300/EEE/31343C?text=Produk"
              }"
              alt="${template.name}"
              class="w-full h-64 object-cover rounded-lg border border-gray-200"
            />
            <div>
              <p class="text-sm text-gray-500 uppercase tracking-wide mb-1">Nama Produk</p>
              <p class="text-2xl font-bold text-gray-800">${template.name}</p>
            </div>
            <div class="space-y-2 text-sm text-gray-600">
              <div class="flex items-center justify-between">
                <span class="text-gray-500">Kategori</span>
                <span class="font-semibold text-gray-800">${
                  template.category?.name || "-"
                }</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-gray-500">Lokasi Default</span>
                <span class="font-semibold text-gray-800">${
                  template.default_location?.name || "-"
                }</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-gray-500">Serialized</span>
                <span class="font-semibold text-gray-800">${
                  template.is_serialized ? "Ya" : "Tidak"
                }</span>
              </div>
            </div>
            ${
              template.description
                ? `<div class="pt-2 border-t border-gray-200 text-sm text-gray-700">${template.description}</div>`
                : ""
            }
          </div>

          <div class="lg:col-span-2 space-y-6">
            <div class="bg-white rounded-lg shadow-md p-6">
              <h3 class="text-lg font-bold text-gray-800 mb-4">Ringkasan Stok</h3>
              <div class="flex flex-wrap gap-2 text-sm">
                <span class="px-3 py-2 rounded-lg bg-gray-100 text-gray-700">Total: ${
                  stock.total ?? 0
                }</span>
                <span class="px-3 py-2 rounded-lg bg-green-100 text-green-700">Available: ${
                  stock.available ?? 0
                }</span>
                <span class="px-3 py-2 rounded-lg bg-amber-100 text-amber-700">Borrowed: ${
                  stock.borrowed ?? 0
                }</span>
                <span class="px-3 py-2 rounded-lg bg-blue-100 text-blue-700">Maintenance: ${
                  stock.maintenance ?? 0
                }</span>
                <span class="px-3 py-2 rounded-lg bg-purple-100 text-purple-700">Scrapped: ${
                  stock.scrapped ?? 0
                }</span>
                <span class="px-3 py-2 rounded-lg bg-gray-200 text-gray-700">Lost: ${
                  stock.lost ?? 0
                }</span>
              </div>
            </div>

            <div class="bg-white rounded-lg shadow-md p-6">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-bold text-gray-800">Daftar Unit</h3>
                <button
                  id="template-refresh-units"
                  class="px-3 py-2 border rounded-md text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <i class="fas fa-sync"></i> Refresh
                </button>
              </div>
              <div class="overflow-x-auto">
                ${buildUnitTable(units)}
              </div>
              <div class="mt-4 flex flex-wrap gap-2">
                <button
                  id="template-add-unit"
                  class="px-4 py-2 bg-[#d97706] text-white font-semibold rounded-md hover:bg-[#b45309] flex items-center gap-2"
                  type="button"
                >
                  <i class="fas fa-plus"></i> Tambah Unit
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document
      .getElementById("template-back-button")
      ?.addEventListener("click", () => renderBarangManagementView());

    document
      .getElementById("template-refresh-units")
      ?.addEventListener("click", () => renderTemplateDetailView(templateId));

    document
      .getElementById("template-add-unit")
      ?.addEventListener("click", () => openProductUnitModal({ templateId }));
  } catch (error) {
    container.innerHTML = `<p class="text-red-500">Gagal memuat detail produk: ${error.message}</p>`;
  } finally {
    hideLoader();
  }
}

function buildUnitTable(units = []) {
  if (!units.length) {
    return `<p class="text-sm text-gray-500">Belum ada unit tercatat.</p>`;
  }
  return `
    <table class="min-w-full text-sm">
      <thead class="bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
        <tr>
          <th class="p-3">Serial</th>
          <th class="p-3">Kode</th>
          <th class="p-3">Status</th>
          <th class="p-3">Kondisi</th>
          <th class="p-3">Lokasi</th>
          <th class="p-3">Vendor</th>
          <th class="p-3">Harga Beli</th>
          <th class="p-3">Tgl Beli</th>
        </tr>
      </thead>
      <tbody>
        ${units
          .map(
            (u) => `
            <tr class="border-b last:border-b-0 hover:bg-gray-50">
              <td class="p-3">${u.serial_number || "-"}</td>
              <td class="p-3">${u.asset_code || "-"}</td>
              <td class="p-3">${formatUnitStatusBadge(u.status)}</td>
              <td class="p-3">${u.condition || "-"}</td>
              <td class="p-3">${u.location?.name || "-"}</td>
              <td class="p-3">${u.vendor_name || "-"}</td>
              <td class="p-3">${
                u.purchase_price != null
                  ? formatCurrency(u.purchase_price)
                  : "-"
              }</td>
              <td class="p-3">${
                u.purchase_date
                  ? new Date(u.purchase_date).toLocaleDateString("id-ID")
                  : "-"
              }</td>
            </tr>
          `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function formatUnitStatusBadge(status = "") {
  const base =
    "inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold";
  switch (status) {
    case "available":
      return `<span class="${base} bg-green-100 text-green-700">Available</span>`;
    case "borrowed":
      return `<span class="${base} bg-amber-100 text-amber-700">Borrowed</span>`;
    case "maintenance":
      return `<span class="${base} bg-blue-100 text-blue-700">Maintenance</span>`;
    case "scrapped":
      return `<span class="${base} bg-purple-100 text-purple-700">Scrapped</span>`;
    case "lost":
      return `<span class="${base} bg-gray-200 text-gray-700">Lost</span>`;
    default:
      return `<span class="${base} bg-gray-100 text-gray-700">${
        status || "Unknown"
      }</span>`;
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(value));
}

// ====== PRODUCT TEMPLATE MODAL ======
function openProductTemplateModal(template = null) {
  const modal = ensureProductTemplateModal();
  modal.classList.remove("hidden");
  modal.classList.add("flex");

  const form = document.getElementById("product-template-form");
  form.reset();
  document.getElementById("product-template-id").value = template?.id || "";
  document.getElementById("product-template-feedback").textContent = "";

  populateSelect(
    "product-template-category",
    productInventoryState.categories,
    "Pilih kategori..."
  );
  populateSelect(
    "product-template-location",
    productInventoryState.locations,
    "Pilih lokasi default..."
  );

  document.getElementById("product-template-title").textContent = template
    ? "Edit Produk"
    : "Tambah Produk";

  document.getElementById("product-template-name").value = template?.name || "";
  document.getElementById("product-template-uom").value =
    template?.uom || "unit";
  document.getElementById("product-template-category").value =
    template?.category?.id || template?.category_id || "";
  document.getElementById("product-template-location").value =
    template?.default_location?.id || template?.default_location_id || "";
  document.getElementById("product-template-serialized").checked =
    template?.is_serialized ?? true;
  document.getElementById("product-template-description").value =
    template?.description || "";

  const photoUrl = template?.photo_url || "";
  document.getElementById("product-template-photo").value = photoUrl;
  updateProductTemplatePhotoPreview(photoUrl);
}

function ensureProductTemplateModal() {
  let modal = document.getElementById("product-template-modal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "product-template-modal";
  modal.className =
    "fixed inset-0 bg-gray-900 bg-opacity-50 hidden items-center justify-center z-50 px-4";
  modal.innerHTML = `
    <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
      <div class="flex items-start justify-between">
        <h2 id="product-template-title" class="text-2xl font-bold text-gray-800">Tambah Produk</h2>
        <button type="button" id="product-template-close" class="text-gray-500 hover:text-gray-700">
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>
      <form id="product-template-form" class="mt-6 space-y-4">
        <input type="hidden" id="product-template-id" />
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nama Produk *</label>
            <input type="text" id="product-template-name" required class="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">UOM</label>
            <input type="text" id="product-template-uom" value="unit" class="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
            <select id="product-template-category" class="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="">Pilih kategori...</option>
            </select>
            <button type="button" id="product-template-add-category" class="text-xs text-[#d97706] mt-1 hover:underline">
              + Tambah kategori
            </button>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Lokasi Default</label>
            <select id="product-template-location" class="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="">Pilih lokasi...</option>
            </select>
            <button type="button" id="product-template-add-location" class="text-xs text-[#d97706] mt-1 hover:underline">
              + Tambah lokasi
            </button>
          </div>
          <div class="md:col-span-2">
            <label class="inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" id="product-template-serialized" class="rounded border-gray-300" checked />
              Serialized (setiap unit punya serial/kode unik)
            </label>
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">URL Foto</label>
            <div class="flex items-center gap-4">
              <div class="w-32 h-24 bg-gray-100 rounded-md flex items-center justify-center overflow-hidden border border-gray-200">
                <img id="product-template-photo-preview" src="" alt="Preview" class="hidden w-full h-full object-cover" />
                <div id="product-template-photo-placeholder" class="text-xs text-gray-500 text-center px-3">
                  Tidak ada foto
                </div>
              </div>
              <div class="flex-1 space-y-2">
                <input type="file" id="product-template-photo-file" accept="image/*" class="block w-full text-sm text-gray-600 border border-gray-300 rounded-md cursor-pointer" />
                <input type="hidden" id="product-template-photo" />
                <p class="text-xs text-gray-500">Format JPG/PNG, maksimal 2 MB.</p>
              </div>
            </div>
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
            <textarea id="product-template-description" rows="3" class="w-full border border-gray-300 rounded-md px-3 py-2"></textarea>
          </div>
        </div>
        <div class="flex justify-end gap-3 pt-4">
          <button type="button" id="product-template-cancel" class="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300">Batal</button>
          <button type="submit" class="px-4 py-2 bg-[#d97706] text-white rounded-md hover:bg-[#b45309]">Simpan</button>
        </div>
        <p id="product-template-feedback" class="text-center text-sm font-semibold mt-2"></p>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal
    .querySelector("#product-template-close")
    .addEventListener("click", () => closeProductTemplateModal());
  modal
    .querySelector("#product-template-cancel")
    .addEventListener("click", () => closeProductTemplateModal());
  modal
    .querySelector("#product-template-add-category")
    .addEventListener("click", openQuickCategoryPrompt);
  modal
    .querySelector("#product-template-add-location")
    .addEventListener("click", openQuickLocationPrompt);
  modal
    .querySelector("#product-template-photo-file")
    .addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        updateProductTemplatePhotoPreview("");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => updateProductTemplatePhotoPreview(reader.result);
      reader.readAsDataURL(file);
    });
  modal
    .querySelector("#product-template-form")
    .addEventListener("submit", handleProductTemplateSubmit);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeProductTemplateModal();
  });

  return modal;
}

function closeProductTemplateModal() {
  const modal = document.getElementById("product-template-modal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

async function handleProductTemplateSubmit(event) {
  event.preventDefault();
  const feedback = document.getElementById("product-template-feedback");
  feedback.textContent = "";
  showLoader();
  try {
    const templateId =
      document.getElementById("product-template-id").value || null;
    let photoUrl =
      document.getElementById("product-template-photo").value || null;
    const file = document.getElementById("product-template-photo-file")
      .files?.[0];
    if (file) {
      photoUrl = await uploadAssetImage(file); // re-use upload helper
      document.getElementById("product-template-photo").value = photoUrl;
    }

    const payload = {
      name: document.getElementById("product-template-name").value,
      description:
        document.getElementById("product-template-description").value || null,
      category_id:
        document.getElementById("product-template-category").value || null,
      photo_url: photoUrl,
      default_location_id:
        document.getElementById("product-template-location").value || null,
      is_serialized: document.getElementById("product-template-serialized")
        .checked,
      uom: document.getElementById("product-template-uom").value || "unit",
    };
    if (templateId) {
      payload.id = templateId;
      await updateProductTemplate(payload);
      notifySuccess("Produk berhasil diperbarui.");
    } else {
      await createProductTemplate(payload);
      notifySuccess("Produk berhasil dibuat.");
    }
    closeProductTemplateModal();
    await renderBarangManagementView();
  } catch (error) {
    feedback.textContent = error.message;
    feedback.className = "text-center text-sm font-semibold text-red-600";
  } finally {
    hideLoader();
  }
}

function populateSelect(id, options = [], placeholder = "Pilih...") {
  const select = document.getElementById(id);
  if (!select) return;
  const current = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  options.forEach((opt) => {
    select.innerHTML += `<option value="${opt.id}">${
      opt.name || opt.code || "-"
    }</option>`;
  });
  if (current) select.value = current;
}

// ====== QUICK CATEGORY PROMPT ======
async function openQuickCategoryPrompt() {
  const name = prompt("Nama kategori baru:");
  if (!name) return;
  const parent =
    prompt("ID parent (opsional, biarkan kosong jika tidak ada):") || null;
  try {
    await createCategory({ name, parent_id: parent || null });
    notifySuccess("Kategori berhasil dibuat.");
    // refresh categories
    const meta = await api.post("/api/management", { action: "getAssetMeta" });
    productInventoryState.categories = meta?.categories || [];
    populateSelect(
      "product-template-category",
      productInventoryState.categories,
      "Pilih kategori..."
    );
  } catch (error) {
    alert("Gagal membuat kategori: " + error.message);
  }
}

// ====== QUICK LOCATION PROMPT ======
async function openQuickLocationPrompt() {
  const name = prompt("Nama lokasi baru (misal: Gudang 2):");
  if (!name) return;
  const code = prompt("Kode lokasi (opsional, misal: WH2):") || null;
  const type =
    prompt("Tipe lokasi (internal/customer/vendor/scrap):", "internal") ||
    "internal";
  const description = prompt("Deskripsi (opsional):") || null;
  try {
    await createStockLocation({ name, code, type, description });
    notifySuccess("Lokasi berhasil dibuat.");
    const locs = await fetchStockLocations();
    productInventoryState.locations = locs || [];
    populateSelect(
      "product-template-location",
      productInventoryState.locations,
      "Pilih lokasi..."
    );
    populateSelect(
      "product-unit-location",
      productInventoryState.locations,
      "Pilih lokasi..."
    );
  } catch (error) {
    alert("Gagal membuat lokasi: " + error.message);
  }
}

// ====== PRODUCT UNIT MODAL ======
function openProductUnitModal({ templateId }) {
  const modal = ensureProductUnitModal();
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  const form = document.getElementById("product-unit-form");
  form.reset();
  form.dataset.templateId = templateId;
  document.getElementById("product-unit-feedback").textContent = "";
  populateSelect(
    "product-unit-location",
    productInventoryState.locations,
    "Pilih lokasi..."
  );
}

function ensureProductUnitModal() {
  let modal = document.getElementById("product-unit-modal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "product-unit-modal";
  modal.className =
    "fixed inset-0 bg-gray-900 bg-opacity-50 hidden items-center justify-center z-50 px-4";
  modal.innerHTML = `
    <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
      <div class="flex items-start justify-between">
        <h2 class="text-2xl font-bold text-gray-800">Tambah Unit</h2>
        <button type="button" id="product-unit-close" class="text-gray-500 hover:text-gray-700">
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>
      <form id="product-unit-form" class="mt-6 space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
            <input type="text" id="product-unit-serial" class="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Asset Code</label>
            <input type="text" id="product-unit-code" class="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select id="product-unit-status" class="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="available">Available</option>
              <option value="borrowed">Borrowed</option>
              <option value="maintenance">Maintenance</option>
              <option value="scrapped">Scrapped</option>
              <option value="lost">Lost</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Kondisi</label>
            <input type="text" id="product-unit-condition" class="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Lokasi</label>
            <select id="product-unit-location" class="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="">Pilih lokasi...</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
            <input type="text" id="product-unit-vendor" class="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Harga Beli</label>
            <input type="number" id="product-unit-price" class="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Tgl Beli</label>
            <input type="date" id="product-unit-purchase-date" class="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
            <textarea id="product-unit-notes" rows="2" class="w-full border border-gray-300 rounded-md px-3 py-2"></textarea>
          </div>
        </div>
        <div class="flex justify-end gap-3 pt-4">
          <button type="button" id="product-unit-cancel" class="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300">Batal</button>
          <button type="submit" class="px-4 py-2 bg-[#d97706] text-white rounded-md hover:bg-[#b45309]">Simpan</button>
        </div>
        <p id="product-unit-feedback" class="text-center text-sm font-semibold mt-2"></p>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal
    .querySelector("#product-unit-close")
    .addEventListener("click", () => closeProductUnitModal());
  modal
    .querySelector("#product-unit-cancel")
    .addEventListener("click", () => closeProductUnitModal());
  modal
    .querySelector("#product-unit-form")
    .addEventListener("submit", handleProductUnitSubmit);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeProductUnitModal();
  });

  return modal;
}

function closeProductUnitModal() {
  const modal = document.getElementById("product-unit-modal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

async function handleProductUnitSubmit(event) {
  event.preventDefault();
  const feedback = document.getElementById("product-unit-feedback");
  feedback.textContent = "";
  try {
    const form = document.getElementById("product-unit-form");
    const templateId = form.dataset.templateId;
    const payload = {
      template_id: templateId,
      serial_number:
        document.getElementById("product-unit-serial").value || null,
      asset_code: document.getElementById("product-unit-code").value || null,
      status:
        document.getElementById("product-unit-status").value || "available",
      condition:
        document.getElementById("product-unit-condition").value || null,
      location_id:
        document.getElementById("product-unit-location").value || null,
      vendor_name: document.getElementById("product-unit-vendor").value || null,
      purchase_price:
        document.getElementById("product-unit-price").value || null,
      purchase_date:
        document.getElementById("product-unit-purchase-date").value || null,
      notes: document.getElementById("product-unit-notes").value || null,
    };

    await createProductUnit(payload);
    notifySuccess("Unit berhasil dibuat.");
    closeProductUnitModal();
    await renderTemplateDetailView(templateId);
  } catch (error) {
    feedback.textContent = error.message;
    feedback.className = "text-center text-sm font-semibold text-red-600";
  }
}

function getAssetFromState(assetId, context) {
  const source =
    context === "management"
      ? assetManagementState.assets
      : assetMemberState.assets;
  return source.find((item) => item.id === assetId);
}

async function fetchAssetById(assetId, context) {
  if (context === "management") {
    const data = await api.post("/api/management", {
      action: "getAssets",
      payload: { assetId },
    });
    return Array.isArray(data) ? data[0] : data;
  }
  return api.get(`/api/member?resource=assets&assetId=${assetId}`);
}

function buildAssetInfoDetails(asset) {
  const info = [
    ["Nama Barang", asset.asset_name || "-"],
    ["Komisi Pemilik", asset.commission?.name || "-"],
    ["Kategori", asset.category?.name || "-"],
    ["Lokasi Simpan", asset.storage_location || asset.location || "-"],
    ["Jumlah", `${asset.quantity ?? 0} unit`],
    ["Kondisi", asset.condition || "-"],
    ["Status", formatAssetStatusBadge(asset.status)],
  ];

  let description = "";
  if (asset.description) {
    description = `
      <div class="pt-2 border-t border-gray-200">
        <p class="text-xs text-gray-500 uppercase tracking-wide">Deskripsi</p>
        <p class="text-sm text-gray-700 mt-1">${asset.description}</p>
      </div>
    `;
  }

  return `
    ${info
      .map(
        ([label, value]) => `
        <div class="flex items-center justify-between gap-4">
          <span class="text-gray-500">${label}</span>
          <span class="font-semibold text-gray-800">${value}</span>
        </div>
      `
      )
      .join("")}
    ${description}
  `;
}

function buildAssetHistoryList(history = []) {
  if (!history || history.length === 0) {
    return `<p class="text-sm text-gray-500">Belum ada riwayat peminjaman.</p>`;
  }

  return `
    <ul class="divide-y divide-gray-100">
      ${history
        .map((loan) => {
          const borrower = loan.profiles?.full_name || "Pengguna";
          const start = new Date(loan.loan_date).toLocaleString("id-ID");
          const end = new Date(loan.due_date).toLocaleString("id-ID");
          return `
            <li class="py-3 space-y-1">
              <div class="flex items-center justify-between">
                <p class="font-semibold text-gray-800">${borrower}</p>
                ${formatAssetStatusBadge(loan.status)}
              </div>
              <p class="text-sm text-gray-500">
                ${start} &ndash; ${end}
              </p>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}

function buildDetailActionSection(asset, context) {
  if (context === "management") {
    return `
      <div class="space-y-3">
        <button
          type="button"
          id="asset-detail-edit"
          class="w-full bg-[#d97706] text-white font-semibold py-2 px-4 rounded-md hover:bg-[#b45309]"
        >
          Edit Barang
        </button>
        <button
          type="button"
          id="asset-detail-toggle"
          class="w-full border border-gray-300 rounded-md py-2 text-sm font-semibold ${
            asset.status === "Tidak Aktif" ? "text-green-700" : "text-red-600"
          } hover:bg-gray-50"
        >
          ${
            asset.status === "Tidak Aktif"
              ? "Aktifkan Kembali"
              : "Nonaktifkan Barang"
          }
        </button>
      </div>
    `;
  }

  const isBorrowable = asset.status === "Tersedia";
  return `
    <div class="space-y-3">
      <button
        type="button"
        id="member-borrow-toggle"
        class="w-full ${
          isBorrowable
            ? "bg-[#d97706] hover:bg-[#b45309] text-white"
            : "bg-gray-200 text-gray-500 cursor-not-allowed"
        } font-semibold py-2 px-4 rounded-md"
        ${isBorrowable ? "" : "disabled"}
      >
        Ajukan Peminjaman
      </button>
      <form id="member-borrow-form" class="hidden space-y-3">
        <div>
          <label class="text-sm text-gray-600">Waktu Mulai</label>
          <input
            type="datetime-local"
            id="member-borrow-start"
            class="w-full mt-1 border border-gray-300 rounded-md px-3 py-2"
            required
          />
        </div>
        <div>
          <label class="text-sm text-gray-600">Waktu Selesai</label>
          <input
            type="datetime-local"
            id="member-borrow-end"
            class="w-full mt-1 border border-gray-300 rounded-md px-3 py-2"
            required
          />
        </div>
        <button
          type="submit"
          class="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md"
        >
          Kirim Permintaan
        </button>
        <p id="member-borrow-feedback" class="text-center text-sm font-semibold"></p>
      </form>
      ${
        isBorrowable
          ? ""
          : `<p class="text-xs text-gray-500 text-center">Barang ini belum dapat dipinjam karena statusnya ${asset.status}.</p>`
      }
    </div>
  `;
}

function wireMemberBorrowSection(assetId, isBorrowable) {
  if (!isBorrowable) return;
  const toggleBtn = document.getElementById("member-borrow-toggle");
  const form = document.getElementById("member-borrow-form");
  if (!toggleBtn || !form) return;

  toggleBtn.addEventListener("click", () => {
    form.classList.remove("hidden");
    toggleBtn.classList.add("hidden");
  });

  form.addEventListener("submit", (event) =>
    handleAssetBorrowSubmit(event, assetId)
  );
}

async function handleAssetBorrowSubmit(event, assetId) {
  event.preventDefault();
  const feedback = document.getElementById("member-borrow-feedback");
  feedback.textContent = "Mengirim permintaan...";
  feedback.className = "text-center text-sm font-semibold text-amber-600";

  try {
    await api.post("/api/member?resource=assets", {
      asset_id: assetId,
      loan_date: document.getElementById("member-borrow-start").value,
      due_date: document.getElementById("member-borrow-end").value,
    });
    feedback.textContent = "Permintaan berhasil dikirim!";
    feedback.className = "text-center text-sm font-semibold text-green-600";
    notifySuccess("Permintaan peminjaman berhasil dikirim!");
    event.target.reset();
  } catch (error) {
    feedback.textContent = `Gagal: ${error.message}`;
    feedback.className = "text-center text-sm font-semibold text-red-600";
  }
}

async function initAssetCalendar(schedule = []) {
  const calendarEl = document.getElementById("asset-detail-calendar");
  if (!calendarEl) return;
  if (fullCalendarInstance) {
    fullCalendarInstance.destroy();
  }

  const events = schedule.map((loan) => ({
    title: `${loan.profiles?.full_name || "Peminjam"} (${loan.status})`,
    start: loan.loan_date,
    end: loan.due_date,
    color:
      loan.status === "Dipinjam" || loan.status === "Disetujui"
        ? "#2563eb"
        : "#f97316",
  }));

  fullCalendarInstance = new FullCalendar.Calendar(
    calendarEl,
    window.getResponsiveCalendarOptions({
      locale: "id",
      events,
    })
  );

  fullCalendarInstance.render();
}

function getAssetPhotoUrl(asset) {
  return (
    asset.photo_url || "https://placehold.co/400x300/EEE/31343C?text=Asset"
  );
}

function openAssetModal(mode, asset = {}) {
  const modal = ensureAssetModalElements();
  modal.classList.remove("hidden");
  modal.classList.add("flex");

  document.getElementById("asset-modal-title").textContent =
    mode === "edit" ? "Edit Barang" : "Tambah Barang Baru";
  document.getElementById("asset-modal-id").value = asset.id || "";
  document.getElementById("asset-modal-feedback").textContent = "";

  populateAssetModalSelect(
    "asset-modal-commission",
    assetManagementState.commissions
  );
  populateAssetModalSelect(
    "asset-modal-category",
    assetManagementState.categories
  );

  document.getElementById("asset-modal-name").value = asset.asset_name || "";
  document.getElementById("asset-modal-commission").value =
    asset.commission_id || "";
  document.getElementById("asset-modal-location").value =
    asset.storage_location || asset.location || "";
  document.getElementById("asset-modal-quantity").value = asset.quantity ?? 1;
  document.getElementById("asset-modal-category").value =
    asset.category_id || "";
  document.getElementById("asset-modal-condition").value =
    asset.condition || "";
  document.getElementById("asset-modal-description").value =
    asset.description || "";
  document.getElementById("asset-modal-status").value =
    asset.status || "Tersedia";
  document.getElementById("asset-modal-photo-url").value =
    asset.photo_url || "";

  updateAssetModalPhotoPreview(asset.photo_url || "");

  const downloadBtn = document.getElementById("asset-modal-download-label");
  const printBtn = document.getElementById("asset-modal-print-label");
  const codeLabel = document.getElementById("asset-modal-code");
  codeLabel.textContent = asset.asset_code || "-";

  if (asset.asset_code) {
    renderAssetQrPreview("asset-modal-qr", asset.asset_code);
    downloadBtn.disabled = false;
    printBtn.disabled = false;
    downloadBtn.classList.remove("opacity-50", "cursor-not-allowed");
    printBtn.classList.remove("opacity-50", "cursor-not-allowed");
    downloadBtn.onclick = () => downloadAssetLabel(asset);
    printBtn.onclick = () => printAssetLabel(asset);
  } else {
    document.getElementById("asset-modal-qr").innerHTML =
      "QR akan dibuat setelah barang disimpan.";
    downloadBtn.disabled = true;
    printBtn.disabled = true;
    downloadBtn.classList.add("opacity-50", "cursor-not-allowed");
    printBtn.classList.add("opacity-50", "cursor-not-allowed");
    downloadBtn.onclick = null;
    printBtn.onclick = null;
  }
}

function ensureAssetModalElements() {
  let modal = document.getElementById("asset-modal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "asset-modal";
  modal.className =
    "fixed inset-0 bg-gray-900 bg-opacity-50 hidden items-center justify-center z-50";
  modal.innerHTML = `
    <div class="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
      <div class="flex items-start justify-between">
        <h2 id="asset-modal-title" class="text-2xl font-bold text-gray-800"></h2>
        <button
          type="button"
          id="asset-modal-close"
          class="text-gray-500 hover:text-gray-700"
        >
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>
      <form id="asset-modal-form" class="mt-6 space-y-4">
        <input type="hidden" id="asset-modal-id" />
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nama Barang *</label>
            <input type="text" id="asset-modal-name" required class="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Komisi</label>
            <select id="asset-modal-commission" class="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="">Pilih Komisi...</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Lokasi Simpan</label>
            <input type="text" id="asset-modal-location" class="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Jumlah</label>
            <input type="number" id="asset-modal-quantity" min="0" class="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
            <select id="asset-modal-category" class="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="">Pilih Kategori...</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Kondisi</label>
            <select id="asset-modal-condition" class="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="">Pilih Kondisi...</option>
              <option value="Baik">Baik</option>
              <option value="Perlu Perbaikan">Perlu Perbaikan</option>
              <option value="Rusak">Rusak</option>
            </select>
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
            <textarea id="asset-modal-description" rows="3" class="w-full border border-gray-300 rounded-md px-3 py-2"></textarea>
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">Foto Barang</label>
            <div class="flex items-center gap-4">
              <div class="w-32 h-24 bg-gray-100 rounded-md flex items-center justify-center overflow-hidden border border-gray-200">
                <img id="asset-modal-photo-preview" src="" alt="Preview" class="hidden w-full h-full object-cover" />
                <div id="asset-modal-photo-placeholder" class="text-xs text-gray-500 text-center px-3">
                  Tidak ada foto
                </div>
              </div>
              <div class="flex-1 space-y-2">
                <input type="file" id="asset-modal-photo-file" accept="image/*" class="block w-full text-sm text-gray-600 border border-gray-300 rounded-md cursor-pointer" />
                <input type="hidden" id="asset-modal-photo-url" />
                <p class="text-xs text-gray-500">Format JPG/PNG, maksimal 2 MB.</p>
              </div>
            </div>
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select id="asset-modal-status" class="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="Tersedia">Tersedia</option>
              <option value="Dipinjam">Dipinjam</option>
              <option value="Tidak Aktif">Tidak Aktif</option>
            </select>
          </div>
          <div class="md:col-span-2 bg-gray-50 rounded-lg p-4 space-y-3">
            <p class="text-sm font-semibold text-gray-700">Kode Barang & QR</p>
            <div class="flex flex-col md:flex-row items-center gap-4">
              <div
                id="asset-modal-qr"
                class="w-40 h-40 border border-dashed border-gray-300 rounded-lg flex items-center justify-center text-xs text-gray-500 text-center"
              >
                QR akan dibuat setelah kode tersedia.
              </div>
              <div class="flex-1 space-y-2 text-sm text-gray-600">
                <p>
                  Kode Barang:
                  <span id="asset-modal-code" class="font-semibold text-gray-800">-</span>
                </p>
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    id="asset-modal-download-label"
                    class="px-3 py-2 border rounded-md text-sm flex items-center gap-2 opacity-50 cursor-not-allowed"
                    disabled
                  >
                    <i class="fas fa-download"></i> Download
                  </button>
                  <button
                    type="button"
                    id="asset-modal-print-label"
                    class="px-3 py-2 border rounded-md text-sm flex items-center gap-2 opacity-50 cursor-not-allowed"
                    disabled
                  >
                    <i class="fas fa-print"></i> Cetak
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-3 pt-4">
          <button type="button" id="asset-modal-cancel" class="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300">
            Batal
          </button>
          <button type="submit" class="px-4 py-2 bg-[#d97706] text-white rounded-md hover:bg-[#b45309]">
            Simpan
          </button>
        </div>
        <p id="asset-modal-feedback" class="text-center text-sm font-semibold mt-2"></p>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  document
    .getElementById("asset-modal-close")
    .addEventListener("click", closeAssetModal);
  document
    .getElementById("asset-modal-cancel")
    .addEventListener("click", closeAssetModal);
  document
    .getElementById("asset-modal-form")
    .addEventListener("submit", handleAssetFormSubmit);

  document
    .getElementById("asset-modal-photo-file")
    .addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        updateAssetModalPhotoPreview("");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => updateAssetModalPhotoPreview(reader.result);
      reader.readAsDataURL(file);
    });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeAssetModal();
    }
  });

  return modal;
}

function populateAssetModalSelect(id, options = []) {
  const select = document.getElementById(id);
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = '<option value="">Pilih...</option>';
  options.forEach((option) => {
    select.innerHTML += `<option value="${option.id}">${option.name}</option>`;
  });
  if (currentValue) {
    select.value = currentValue;
  }
}

function updateAssetModalPhotoPreview(src) {
  const preview = document.getElementById("asset-modal-photo-preview");
  const placeholder = document.getElementById("asset-modal-photo-placeholder");
  if (src) {
    preview.src = src;
    preview.classList.remove("hidden");
    placeholder.classList.add("hidden");
  } else {
    preview.src = "";
    preview.classList.add("hidden");
    placeholder.classList.remove("hidden");
  }
}

// Preview foto untuk modal produk (template)
function updateProductTemplatePhotoPreview(src) {
  const preview = document.getElementById("product-template-photo-preview");
  const placeholder = document.getElementById(
    "product-template-photo-placeholder"
  );
  if (!preview || !placeholder) return;
  if (src) {
    preview.src = src;
    preview.classList.remove("hidden");
    placeholder.classList.add("hidden");
  } else {
    preview.src = "";
    preview.classList.add("hidden");
    placeholder.classList.remove("hidden");
  }
}

function closeAssetModal() {
  const modal = document.getElementById("asset-modal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  document.getElementById("asset-modal-form").reset();
  updateAssetModalPhotoPreview("");
}

async function handleAssetFormSubmit(event) {
  event.preventDefault();

  const feedback = document.getElementById("asset-modal-feedback");
  feedback.textContent = "";

  const assetId = document.getElementById("asset-modal-id").value;
  const action = assetId ? "updateAsset" : "createAsset";

  try {
    const photoFileInput = document.getElementById("asset-modal-photo-file");
    let photoUrl = document.getElementById("asset-modal-photo-url").value;
    const file = photoFileInput.files?.[0];
    if (file) {
      photoUrl = await uploadAssetImage(file);
      document.getElementById("asset-modal-photo-url").value = photoUrl;
    }

    const payload = {
      asset_name: document.getElementById("asset-modal-name").value,
      commission_id:
        document.getElementById("asset-modal-commission").value || null,
      storage_location:
        document.getElementById("asset-modal-location").value || null,
      quantity:
        parseInt(document.getElementById("asset-modal-quantity").value, 10) ||
        0,
      category_id:
        document.getElementById("asset-modal-category").value || null,
      condition: document.getElementById("asset-modal-condition").value || null,
      description:
        document.getElementById("asset-modal-description").value || null,
      status: document.getElementById("asset-modal-status").value || "Tersedia",
      photo_url: photoUrl || null,
    };

    if (assetId) {
      payload.assetId = assetId;
    }

    const result = await api.post("/api/management", { action, payload });
    notifySuccess(result.message);
    closeAssetModal();
    await renderBarangManagementView();
  } catch (error) {
    feedback.textContent = error.message;
    feedback.className = "text-center text-sm font-semibold text-red-600";
  }
}

async function uploadAssetImage(file) {
  const MAX_BYTES = 2 * 1024 * 1024;
  if (!file) throw new Error("File gambar tidak ditemukan.");
  if (file.size > MAX_BYTES) {
    throw new Error("Ukuran gambar melebihi 2 MB.");
  }

  const token = localStorage.getItem("authToken");
  if (!token)
    throw new Error("Token login tidak ditemukan. Silakan login ulang.");

  const base64Data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
    reader.readAsDataURL(file);
  });

  const response = await fetch("/api/website-hero-video", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || "image/jpeg",
      base64Data,
      target: "assets",
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || "Gagal mengunggah gambar barang.");
  }

  if (!result.url) {
    throw new Error("Server tidak mengembalikan URL gambar.");
  }

  return result.url;
}

async function handleAssetStatusChange(assetId, newStatus) {
  if (
    !confirm(
      `Yakin ingin ${
        newStatus === "Tidak Aktif" ? "menonaktifkan" : "mengaktifkan"
      } barang ini?`
    )
  ) {
    return;
  }

  try {
    const result = await api.post("/api/management", {
      action: "setAssetStatus",
      payload: { assetId, status: newStatus },
    });
    notifySuccess(result.message);
    await renderBarangManagementView();
  } catch (error) {
    alert("Gagal memperbarui status barang: " + error.message);
  }
}

function loadExternalScript(url) {
  if (!loadedExternalScripts[url]) {
    loadedExternalScripts[url] = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Gagal memuat script ${url}`));
      document.body.appendChild(script);
    });
  }
  return loadedExternalScripts[url];
}

async function ensureQrLibrary() {
  if (window.QRCode) return;
  await loadExternalScript(ASSET_QR_LIBRARY_URL);
}

async function ensureJsQrLibrary() {
  if (window.jsQR) return;
  await loadExternalScript(ASSET_JSQR_LIBRARY_URL);
}

async function generateQrDataUrl(text, size = 220) {
  if (!text) {
    throw new Error("Kode barang tidak tersedia.");
  }
  await ensureQrLibrary();
  return new Promise((resolve, reject) => {
    window.QRCode.toDataURL(
      text,
      { errorCorrectionLevel: "H", width: size, margin: 1 },
      (error, url) => {
        if (error) reject(error);
        else resolve(url);
      }
    );
  });
}

async function renderAssetQrPreview(containerId, assetCode) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!assetCode) {
    container.innerHTML = "Kode barang belum tersedia.";
    return;
  }

  try {
    const dataUrl = await generateQrDataUrl(assetCode, 240);
    container.innerHTML = `
      <img src="${dataUrl}" alt="QR ${assetCode}" class="w-40 h-40 object-contain" />
    `;
  } catch (error) {
    container.innerHTML = `<p class="text-xs text-red-500 text-center">Gagal membuat QR: ${error.message}</p>`;
  }
}

async function downloadAssetLabel(asset) {
  if (!asset.asset_code) {
    alert("Kode barang belum tersedia.");
    return;
  }
  try {
    const dataUrl = await generateQrDataUrl(asset.asset_code, 300);
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${asset.asset_code}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    alert("Gagal mengunduh label: " + error.message);
  }
}

async function printAssetLabel(asset) {
  if (!asset.asset_code) {
    alert("Kode barang belum tersedia.");
    return;
  }
  try {
    const dataUrl = await generateQrDataUrl(asset.asset_code, 320);
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Popup diblokir oleh browser. Izinkan popup untuk mencetak label.");
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>Label ${asset.asset_code}</title>
          <style>
            body { font-family: Arial, sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
            .label { border:1px dashed #cbd5f5; padding:24px 32px; text-align:center; }
            img { width:180px; height:180px; object-fit:contain; }
            h1 { margin:16px 0 4px; font-size:24px; }
            p { margin:0; font-size:14px; color:#4b5563; }
          </style>
        </head>
        <body>
          <div class="label">
            <img src="${dataUrl}" alt="QR ${asset.asset_code}" />
            <h1>${asset.asset_code}</h1>
            <p>${asset.asset_name || ""}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.addEventListener("afterprint", () => printWindow.close());
  } catch (error) {
    alert("Gagal mencetak label: " + error.message);
  }
}

function openAssetScanModal(onDetected) {
  const modal = ensureAssetScanModal();
  assetScanState.onDetected = onDetected;
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.body.classList.add("overflow-hidden");

  assetScanState.messageEl.textContent = "Mengarahkan kamera ke QR barang...";
  startAssetScanner().catch((error) => {
    assetScanState.messageEl.textContent = error.message;
  });
}

function ensureAssetScanModal() {
  if (assetScanState.modal) return assetScanState.modal;

  const modal = document.createElement("div");
  modal.id = "asset-scan-modal";
  modal.className =
    "fixed inset-0 bg-black/70 hidden z-50 items-center justify-center px-4";
  modal.innerHTML = `
    <div class="bg-white rounded-lg shadow-2xl w-full max-w-md p-6 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-gray-800">Scan QR Barang</h3>
        <button id="asset-scan-close" class="text-gray-500 hover:text-gray-700">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="space-y-3">
        <video id="asset-scan-video" class="w-full rounded-lg bg-black aspect-video" playsinline></video>
        <canvas id="asset-scan-canvas" class="hidden"></canvas>
        <p id="asset-scan-message" class="text-sm text-gray-500">
          Menginisialisasi kamera...
        </p>
      </div>
      <div class="flex justify-end">
        <button
          id="asset-scan-stop"
          class="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
        >
          Batalkan
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  assetScanState.modal = modal;
  assetScanState.video = modal.querySelector("#asset-scan-video");
  assetScanState.canvas = modal.querySelector("#asset-scan-canvas");
  assetScanState.context = assetScanState.canvas.getContext("2d");
  assetScanState.messageEl = modal.querySelector("#asset-scan-message");

  const stop = () => stopAssetScanner();
  modal.querySelector("#asset-scan-close").addEventListener("click", stop);
  modal.querySelector("#asset-scan-stop").addEventListener("click", stop);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      stopAssetScanner();
    }
  });

  return modal;
}

async function startAssetScanner() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Perangkat ini tidak mendukung akses kamera.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
  });
  assetScanState.stream = stream;
  assetScanState.video.srcObject = stream;
  await assetScanState.video.play();

  if ("BarcodeDetector" in window) {
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    const detect = async () => {
      if (!assetScanState.video) return;
      try {
        const codes = await detector.detect(assetScanState.video);
        if (codes.length && assetScanState.onDetected) {
          const code = codes[0].rawValue || codes[0].rawData || "";
          const callback = assetScanState.onDetected;
          stopAssetScanner();
          callback(code);
          return;
        }
      } catch (error) {
        assetScanState.messageEl.textContent = error.message;
      }
      assetScanState.frameId = requestAnimationFrame(detect);
    };
    detect();
  } else {
    await ensureJsQrLibrary();
    const scanLoop = () => {
      if (!assetScanState.video || assetScanState.video.readyState < 2) {
        assetScanState.frameId = requestAnimationFrame(scanLoop);
        return;
      }
      const canvas = assetScanState.canvas;
      const ctx = assetScanState.context;
      canvas.width = assetScanState.video.videoWidth;
      canvas.height = assetScanState.video.videoHeight;
      ctx.drawImage(assetScanState.video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = window.jsQR(imageData.data, canvas.width, canvas.height);
      if (result && assetScanState.onDetected) {
        const callback = assetScanState.onDetected;
        stopAssetScanner();
        callback(result.data);
        return;
      }
      assetScanState.frameId = requestAnimationFrame(scanLoop);
    };
    scanLoop();
  }
}

function stopAssetScanner() {
  if (assetScanState.frameId) {
    cancelAnimationFrame(assetScanState.frameId);
    assetScanState.frameId = null;
  }
  if (assetScanState.stream) {
    assetScanState.stream.getTracks().forEach((track) => track.stop());
    assetScanState.stream = null;
  }
  if (assetScanState.video) {
    assetScanState.video.srcObject = null;
    assetScanState.video.pause();
  }
  assetScanState.onDetected = null;
  const modal = assetScanState.modal;
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
  document.body.classList.remove("overflow-hidden");
}

function extractAssetCodeFromScan(value = "") {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.searchParams.has("asset_code")) {
      return url.searchParams.get("asset_code");
    }
    const maybeCode = url.pathname.split("/").filter(Boolean).pop();
    if (maybeCode) return decodeURIComponent(maybeCode);
  } catch (error) {
    // Not a URL
  }
  if (trimmed.includes("asset_code=")) {
    const params = new URLSearchParams(
      trimmed.split("?")[1] || trimmed.split("#")[1] || ""
    );
    return params.get("asset_code") || trimmed;
  }
  return trimmed;
}

function handleAssetScanResult(rawValue) {
  const code = extractAssetCodeFromScan(rawValue);
  if (!code) {
    alert("QR tidak dikenali. Pastikan Anda memindai label resmi.");
    return;
  }

  const role =
    localStorage.getItem("userRole") === "management" ? "management" : "member";
  if (role === "management") {
    handleInventoryScan(code);
  } else {
    // fallback ke logika lama untuk member
    const normalized = code.toLowerCase();
    const pool = assetMemberState.assets;
    const asset = pool.find(
      (item) => item.asset_code && item.asset_code.toLowerCase() === normalized
    );
    if (asset) {
      renderBarangDetailView(asset.id, { context: role });
      return;
    }
    assetMemberState.search = code;
    renderBarangMemberView();
    alert("Barang dengan kode tersebut tidak ditemukan pada data saat ini.");
  }
}

// Scan untuk inventory (produk/unit)
async function handleInventoryScan(code) {
  try {
    const unit = await api.post("/api/management", {
      action: "findUnitByCode",
      payload: { code },
    });
    if (unit?.template_id) {
      // pastikan template ada di state, kalau belum refresh
      const exists = productInventoryState.templates.find(
        (t) => t.id === unit.template_id
      );
      if (!exists) {
        await renderBarangManagementView();
      }
      renderTemplateDetailView(unit.template_id);
      return;
    }
    alert("Unit tidak ditemukan untuk kode tersebut.");
  } catch (error) {
    alert("Gagal mencari unit: " + error.message);
  }
}
