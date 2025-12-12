/**
 * Ruangan (Room) Page Module
 * Handles Room Management (CRUD + Image Upload) and Member Reservation
 */

const roomState = {
  rooms: [],
  search: "",
  selectedLocation: "all",
};

async function loadRuanganPage() {
  const contentArea = document.getElementById("content-area");
  showLoader();
  try {
    contentArea.innerHTML = "";
    const template = document.getElementById("ruangan-template").content.cloneNode(true);
    contentArea.appendChild(template);
    
    const role = localStorage.getItem("userRole");
    if (role === "management") {
      await renderRuanganManagementView();
    } else {
      await renderRuanganMemberView();
    }
  } catch (error) {
    contentArea.innerHTML = `<p class="text-red-500">Error: ${error.message}</p>`;
  } finally {
    hideLoader();
  }
}

// ============================================================
// MANAGEMENT VIEW
// ============================================================
async function renderRuanganManagementView() {
  const container = document.getElementById("ruangan-content-area");
  container.innerHTML = `<div class="flex items-center justify-center py-12"><i class="fas fa-spinner fa-spin text-3xl text-amber-500"></i></div>`;

  try {
    const rooms = await fetchRooms();
    roomState.rooms = rooms || [];
    
    const locations = [...new Set(roomState.rooms.map(r => r.lokasi || "Tanpa Lokasi"))].sort();
    const filtered = filterRooms(roomState.rooms);

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Header & Actions -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 class="text-xl font-semibold text-gray-800">Daftar Ruangan</h2>
          <div class="flex gap-3 self-start sm:self-auto flex-wrap">
            <button id="room-history-btn" class="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 flex items-center gap-2 shadow-sm">
              <i class="fas fa-history"></i> Lihat Riwayat
            </button>
            <button id="room-add-btn" class="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-500/30 flex items-center gap-2 transition-all">
              <i class="fas fa-plus"></i> Tambah Ruangan
            </button>
            <button id="room-refresh-btn" class="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 flex items-center gap-2 shadow-sm">
              <i class="fas fa-sync"></i>
            </button>
          </div>
        </div>

        <!-- Search & Filter -->
        <div class="bg-white rounded-2xl shadow-md p-4 lg:p-6 space-y-4">
          <div class="flex flex-col sm:flex-row gap-4">
            <div class="flex-1 relative">
              <span class="absolute inset-y-0 left-4 flex items-center text-gray-400"><i class="fas fa-search"></i></span>
              <input id="room-search" type="text" value="${roomState.search || ""}" 
                placeholder="Cari nama ruangan atau lokasi..."
                class="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-gray-50 transition-all"/>
            </div>
            <div class="sm:w-64">
              <select id="room-filter-location" class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 text-gray-700">
                <option value="all" ${roomState.selectedLocation === "all" ? "selected" : ""}>Semua Lokasi</option>
                ${locations.map(l => `<option value="${l}" ${roomState.selectedLocation === l ? "selected" : ""}>${l}</option>`).join("")}
              </select>
            </div>
          </div>
        </div>

        <!-- Room Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${getRoomCardsHTML(filtered, true)}
        </div>
      </div>
    `;

    // Event Listeners
    document.getElementById("room-search")?.addEventListener("input", debounce((e) => {
      roomState.search = e.target.value;
      renderRuanganManagementView();
    }, 300));

    document.getElementById("room-filter-location")?.addEventListener("change", (e) => {
      roomState.selectedLocation = e.target.value;
      renderRuanganManagementView();
    });

    document.getElementById("room-add-btn")?.addEventListener("click", () => openRoomModal());
    document.getElementById("room-refresh-btn")?.addEventListener("click", () => renderRuanganManagementView());
    document.getElementById("room-history-btn")?.addEventListener("click", () => openRoomHistoryModal());

    bindRoomCardActions(container);

  } catch (error) {
    container.innerHTML = `<div class="bg-red-50 text-red-700 p-6 rounded-xl border border-red-200"><i class="fas fa-exclamation-circle mr-2"></i>${error.message}</div>`;
  }
}

// ============================================================
// MEMBER VIEW
// ============================================================
async function renderRuanganMemberView() {
  const container = document.getElementById("ruangan-content-area");
  container.innerHTML = `<div class="flex items-center justify-center py-12"><i class="fas fa-spinner fa-spin text-3xl text-amber-500"></i></div>`;

  try {
    const rooms = await fetchRooms(); // Member uses same fetch for now, API handles permission if needed
    roomState.rooms = rooms || [];
    const filtered = filterRooms(roomState.rooms);

    container.innerHTML = `
      <div class="space-y-6">
        <div class="bg-white rounded-2xl shadow-md p-4 lg:p-6">
          <div class="relative">
            <span class="absolute inset-y-0 left-4 flex items-center text-gray-400"><i class="fas fa-search"></i></span>
            <input id="member-room-search" type="text" value="${roomState.search || ""}" 
              placeholder="Cari ruangan..."
              class="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-gray-50 transition-all"/>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${getRoomCardsHTML(filtered, false)}
        </div>
      </div>
    `;

    document.getElementById("member-room-search")?.addEventListener("input", debounce((e) => {
      roomState.search = e.target.value;
      renderRuanganMemberView();
    }, 300));

    bindMemberRoomActions(container);

  } catch (error) {
    container.innerHTML = `<div class="bg-red-50 text-red-700 p-6 rounded-xl border border-red-200"><i class="fas fa-exclamation-circle mr-2"></i>${error.message}</div>`;
  }
}

// ============================================================
// HELPERS
// ============================================================
function filterRooms(rooms) {
  let result = [...rooms];
  if (roomState.search) {
    const q = roomState.search.toLowerCase();
    result = result.filter(r => r.name?.toLowerCase().includes(q) || r.lokasi?.toLowerCase().includes(q));
  }
  if (roomState.selectedLocation !== "all") {
    result = result.filter(r => (r.lokasi || "Tanpa Lokasi") === roomState.selectedLocation);
  }
  return result;
}

function getRoomCardsHTML(rooms, isManagement) {
  if (!rooms.length) {
    return `<div class="col-span-full text-center py-12 text-gray-500"><i class="fas fa-door-open text-4xl mb-3 text-gray-300"></i><p>Tidak ada ruangan ditemukan</p></div>`;
  }

  return rooms.map(room => {
    const photo = room.image_url || "https://placehold.co/400x300/f3f4f6/9ca3af?text=Ruangan";
    return `
      <div class="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 group border border-gray-100 flex flex-col">
        <div class="relative h-48 overflow-hidden bg-gray-100">
          <img src="${photo}" alt="${room.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onerror="this.src='https://placehold.co/400x300/f3f4f6/9ca3af?text=Ruangan'"/>
          <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-4">
            <h3 class="text-white font-bold text-lg shadow-sm">${room.name}</h3>
            <p class="text-white/90 text-sm"><i class="fas fa-map-marker-alt mr-1"></i> ${room.lokasi || "-"}</p>
          </div>
          ${isManagement ? `
            <div class="absolute top-2 right-2">
              <button class="room-action-btn w-8 h-8 bg-white/90 backdrop-blur rounded-lg shadow flex items-center justify-center text-gray-600 hover:bg-white" data-room-id="${room.id}">
                <i class="fas fa-ellipsis-v"></i>
              </button>
            </div>
          ` : ''}
        </div>
        <div class="p-4 flex-1 flex flex-col gap-3">
          <div class="grid grid-cols-2 gap-2 text-sm text-gray-600">
            <div class="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
              <i class="fas fa-users text-blue-500"></i>
              <span>${room.kapasitas || 0} Orang</span>
            </div>
            <div class="flex items-center gap-2 bg-gray-50 p-2 rounded-lg overflow-hidden" title="${(room.pics || []).map(p => p.full_name || p.email).join(', ') || 'Belum ada PIC'}">
              <i class="fas fa-user-tie text-emerald-500 flex-shrink-0"></i>
              <span class="truncate">${
                (room.pics || []).length === 0 ? '-' :
                (room.pics || []).length === 1 ? room.pics[0].full_name || room.pics[0].email :
                (room.pics || []).length <= 2 ? room.pics.map(p => (p.full_name || p.email).split(' ')[0]).join(', ') :
                room.pics.slice(0, 1).map(p => (p.full_name || p.email).split(' ')[0]).join('') + ' +' + (room.pics.length - 1)
              }</span>
            </div>
          </div>
          
          ${!isManagement ? `
            <button class="book-room-btn w-full mt-auto py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-600 shadow-md transition-all" data-room-id="${room.id}" data-room-name="${room.name}">
              Reservasi Ruangan
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join("");
}

function bindRoomCardActions(container) {
  container.querySelectorAll(".room-action-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const roomId = btn.dataset.roomId;
      const room = roomState.rooms.find(r => r.id === roomId);
      if (!room) return;
      
      const items = [
        { label: "Edit", icon: "fas fa-edit", className: "text-amber-600", onClick: () => openRoomModal(room) },
        { label: "Hapus", icon: "fas fa-trash", className: "text-red-600", onClick: () => confirmDeleteRoom(roomId) },
      ];
      openGlobalActionMenu({ triggerElement: btn, items });
    });
  });
}

function bindMemberRoomActions(container) {
  container.querySelectorAll(".book-room-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      // Use existing reservation modal logic if available or create new
      // For now, assuming we use a simple prompt or redirect, but ideally a modal
      // Reusing the existing room reservation modal logic from dashboard/member pages if possible
      // Or implementing a simple one here.
      openReservationModal(btn.dataset.roomName);
    });
  });
}

// ============================================================
// MODALS & FORMS
// ============================================================
async function openRoomModal(existing = null) {
  const isEdit = !!existing;
  
  // Fetch users for PIC checkboxes (only management users with room privilege)
  let users = [];
  try {
    const token = localStorage.getItem("authToken");
    const res = await fetch("/api/management", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: "getUsers" }) });
    if (res.ok) {
      const allUsers = await res.json();
      // Filter to only show management users with room privilege
      users = allUsers.filter(u => {
        if (u.role !== "management") return false;
        // If no privileges defined, assume full access
        if (!u.privileges) return true;
        return Array.isArray(u.privileges) && u.privileges.includes("room");
      });
    }
  } catch (e) { console.error("Failed to fetch users", e); }
  
  // Get existing PIC IDs
  const existingPicIds = (existing?.pics || []).map(p => p.id);
  
  // Generate checkboxes for PICs
  const picCheckboxes = users.map(u => `
    <label class="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer">
      <input type="checkbox" name="pic_ids" value="${u.id}" 
        ${existingPicIds.includes(u.id) ? "checked" : ""}
        class="rounded text-amber-600 focus:ring-amber-500"/>
      <span class="text-sm">${u.full_name || u.email}</span>
      <span class="text-xs text-gray-400">(${u.email})</span>
    </label>
  `).join("");

  const content = `
    <form id="room-form" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Nama Ruangan *</label>
        <input type="text" name="name" value="${existing?.name || ""}" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"/>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Lokasi</label>
        <input type="text" name="lokasi" value="${existing?.lokasi || ""}" class="w-full px-3 py-2 border border-gray-300 rounded-lg"/>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Kapasitas (Orang)</label>
        <input type="number" name="kapasitas" value="${existing?.kapasitas || 0}" class="w-full px-3 py-2 border border-gray-300 rounded-lg"/>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Penanggung Jawab (PIC) *</label>
        <p class="text-xs text-gray-500 mb-2">Pilih satu atau lebih PIC yang akan menerima notifikasi reservasi</p>
        <div class="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1 bg-gray-50">
          ${picCheckboxes.length > 0 ? picCheckboxes : '<p class="text-gray-400 text-sm p-2">Tidak ada user management dengan privilege ruangan</p>'}
        </div>
      </div>
      
      <!-- Image Upload -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Foto Ruangan</label>
        <div class="flex items-center gap-4">
          <div id="room-photo-preview" class="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300">
            ${existing?.image_url ? `<img src="${existing.image_url}" class="w-full h-full object-cover"/>` : '<i class="fas fa-image text-gray-400 text-2xl"></i>'}
          </div>
          <div class="flex-1">
            <input type="file" name="photo_file" id="room-photo-input" accept="image/*" class="hidden"/>
            <input type="hidden" name="image_url" value="${existing?.image_url || ""}"/>
            <button type="button" id="upload-room-photo-btn" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
              <i class="fas fa-upload mr-2"></i> Pilih Foto
            </button>
            <p class="text-xs text-gray-500 mt-1">Max 2MB</p>
          </div>
        </div>
      </div>
    </form>
  `;

  openGlobalModal({
    title: isEdit ? "Edit Ruangan" : "Tambah Ruangan Baru",
    contentHTML: content,
    confirmText: isEdit ? "Simpan" : "Tambah",
    onConfirm: () => handleRoomSubmit(existing?.id),
  });

  setTimeout(() => {
    document.getElementById("upload-room-photo-btn")?.addEventListener("click", () => document.getElementById("room-photo-input")?.click());
    document.getElementById("room-photo-input")?.addEventListener("change", handleRoomPhotoPreview);
  }, 100);
}

function handleRoomPhotoPreview(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { notifyError("Ukuran file melebihi 2MB"); return; }
  const preview = document.getElementById("room-photo-preview");
  const reader = new FileReader();
  reader.onload = (ev) => { preview.innerHTML = `<img src="${ev.target.result}" class="w-full h-full object-cover"/>`; };
  reader.readAsDataURL(file);
}

async function handleRoomSubmit(existingId) {
  const form = document.getElementById("room-form");
  const fd = new FormData(form);
  const name = fd.get("name")?.trim();
  
  if (!name) { notifyError("Nama ruangan wajib diisi!"); return; }

  // Collect all checked PIC IDs
  const picCheckboxes = form.querySelectorAll("input[name='pic_ids']:checked");
  const picIds = Array.from(picCheckboxes).map(cb => cb.value);

  // Upload Image
  let imageUrl = fd.get("image_url") || null;
  const photoFile = document.getElementById("room-photo-input")?.files[0];
  if (photoFile) {
    try {
      const confirmBtn = document.getElementById("global-modal-confirm");
      if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Uploading...'; }
      imageUrl = await uploadRoomImage(photoFile);
    } catch (e) { 
      notifyError("Gagal upload foto: " + e.message); 
      const confirmBtn = document.getElementById("global-modal-confirm");
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.innerHTML = 'Simpan'; }
      return; 
    }
  }

  const payload = {
    name,
    lokasi: fd.get("lokasi"),
    kapasitas: parseInt(fd.get("kapasitas") || "0"),
    pic_ids: picIds,
    image_url: imageUrl,
  };
  if (existingId) payload.id = existingId;

  try {
    const token = localStorage.getItem("authToken");
    const action = existingId ? "updateRoom" : "createRoom";
    const res = await fetch("/api/management", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, payload }) });
    
    if (!res.ok) throw new Error((await res.json()).error || "Gagal menyimpan ruangan");
    
    closeGlobalModal();
    notifySuccess("Ruangan berhasil disimpan!");
    await renderRuanganManagementView();
  } catch (e) { notifyError(e.message); }
}

async function confirmDeleteRoom(roomId) {
  if (!confirm("Apakah Anda yakin ingin menghapus ruangan ini?")) return;
  try {
    const token = localStorage.getItem("authToken");
    const res = await fetch("/api/management", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: "deleteRoom", payload: { id: roomId } }) });
    if (!res.ok) throw new Error((await res.json()).error || "Gagal menghapus ruangan");
    notifySuccess("Ruangan berhasil dihapus!");
    await renderRuanganManagementView();
  } catch (e) { notifyError(e.message); }
}

function openReservationModal(roomName) {
  // Simple reservation modal reusing existing logic if possible, or new simple form
  const content = `
    <form id="reservation-form" class="space-y-4">
      <div><label class="block text-sm font-medium text-gray-700">Nama Kegiatan</label><input type="text" name="event_name" required class="w-full px-3 py-2 border rounded-lg"/></div>
      <div><label class="block text-sm font-medium text-gray-700">Ruangan</label><input type="text" name="room_name" value="${roomName || ""}" readonly class="w-full px-3 py-2 border rounded-lg bg-gray-100"/></div>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="block text-sm font-medium text-gray-700">Mulai</label><input type="datetime-local" name="start_time" required class="w-full px-3 py-2 border rounded-lg"/></div>
        <div><label class="block text-sm font-medium text-gray-700">Selesai</label><input type="datetime-local" name="end_time" required class="w-full px-3 py-2 border rounded-lg"/></div>
      </div>
    </form>
  `;
  
  openGlobalModal({
    title: "Reservasi Ruangan",
    contentHTML: content,
    confirmText: "Ajukan",
    onConfirm: async () => {
      const form = document.getElementById("reservation-form");
      const fd = new FormData(form);
      const payload = {
        event_name: fd.get("event_name"),
        room_name: fd.get("room_name"),
        start_time: fd.get("start_time") + ":00+07:00",
        end_time: fd.get("end_time") + ":00+07:00",
      };
      
      const token = localStorage.getItem("authToken");
      const res = await fetch("/api/member?resource=rooms", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Gagal mengajukan reservasi");
      }
      
      closeGlobalModal(true); // Force close
      notifySuccess("Reservasi berhasil diajukan!");
    }
  });
}

// ============================================================
// API
// ============================================================
async function fetchRooms() {
  const token = localStorage.getItem("authToken");
  // Use management API for management role to get full details including image_url if not available in member API yet
  // Or update member API to return image_url
  const role = localStorage.getItem("userRole");
  const endpoint = role === "management" ? "/api/management" : "/api/member?resource=rooms";
  const body = role === "management" ? JSON.stringify({ action: "getRooms" }) : null;
  const method = role === "management" ? "POST" : "GET";
  
  const res = await fetch(endpoint, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body });
  if (!res.ok) throw new Error("Gagal mengambil data ruangan");
  return res.json();
}

async function uploadRoomImage(file) {
  const token = localStorage.getItem("authToken");
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  
  const res = await fetch("/api/website-hero-video", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fileName: file.name, mimeType: file.type, base64Data: base64, target: "assets" }),
  });
  if (!res.ok) throw new Error("Gagal upload gambar");
  const data = await res.json();
  return data.url;
}

function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

window.loadRuanganPage = loadRuanganPage;

// ============================================================
// ROOM HISTORY MODAL - FULLSCREEN VERSION
// ============================================================
async function openRoomHistoryModal() {
  let currentData = [];
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
    title: "Riwayat Reservasi Ruangan",
    contentHTML: content
  });

  async function loadHistoryData() {
    const container = document.getElementById("history-data-container");
    const totalEl = document.getElementById("history-total");
    
    container.innerHTML = `<div class="flex items-center justify-center py-16 text-gray-400"><i class="fas fa-spinner fa-spin text-2xl mr-3"></i> Memuat data...</div>`;
    
    try {
      currentData = await api.post("/api/management", {
        action: "getRoomReservationHistory",
        payload: { startDate: currentStartDate, endDate: currentEndDate, status: currentStatus }
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

      const grouped = groupDataByMonth(currentData, "start_time");

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
                    <th class="px-5 py-3 text-left font-semibold">Tanggal</th>
                    <th class="px-5 py-3 text-left font-semibold">Ruangan</th>
                    <th class="px-5 py-3 text-left font-semibold">Acara</th>
                    <th class="px-5 py-3 text-left font-semibold">Waktu</th>
                    <th class="px-5 py-3 text-left font-semibold">Pemohon</th>
                    <th class="px-5 py-3 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  ${group.items.map(item => `
                    <tr class="hover:bg-amber-50/50 transition-colors">
                      <td class="px-5 py-3 text-sm">${new Date(item.start_time).toLocaleDateString("id-ID")}</td>
                      <td class="px-5 py-3 font-medium text-gray-800">${item.room_name || "-"}</td>
                      <td class="px-5 py-3 text-sm text-gray-600">${item.event_name || "-"}</td>
                      <td class="px-5 py-3 text-sm">${new Date(item.start_time).toLocaleTimeString("id-ID", {hour: '2-digit', minute: '2-digit'})} - ${new Date(item.end_time).toLocaleTimeString("id-ID", {hour: '2-digit', minute: '2-digit'})}</td>
                      <td class="px-5 py-3 text-sm">${item.requester_name || "-"}</td>
                      <td class="px-5 py-3">${getStatusBadgeHTML(item.status)}</td>
                    </tr>
                  `).join("")}
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

  setTimeout(loadHistoryData, 100);

  setTimeout(() => {
    const periodSelect = document.getElementById("history-period");
    const customContainer = document.getElementById("custom-date-container");
    const statusSelect = document.getElementById("history-status");
    
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
    
    statusSelect?.addEventListener("change", () => {
      currentStatus = statusSelect.value;
      loadHistoryData();
    });
    
    document.getElementById("history-apply-custom")?.addEventListener("click", () => {
      currentStartDate = document.getElementById("history-start-date").value;
      currentEndDate = document.getElementById("history-end-date").value;
      loadHistoryData();
    });

    document.getElementById("history-export-csv")?.addEventListener("click", () => {
      const columns = [
        { label: "Tanggal", getValue: item => new Date(item.start_time).toLocaleDateString("id-ID") },
        { label: "Waktu Mulai", getValue: item => new Date(item.start_time).toLocaleTimeString("id-ID") },
        { label: "Waktu Selesai", getValue: item => new Date(item.end_time).toLocaleTimeString("id-ID") },
        { label: "Ruangan", key: "room_name" },
        { label: "Acara", key: "event_name" },
        { label: "Pemohon", key: "requester_name" },
        { label: "Status", key: "status" }
      ];
      exportToCSV(currentData, "riwayat_reservasi_ruangan", columns);
    });

    document.getElementById("history-export-excel")?.addEventListener("click", () => {
      const columns = [
        { label: "Tanggal", getValue: item => new Date(item.start_time).toLocaleDateString("id-ID") },
        { label: "Waktu Mulai", getValue: item => new Date(item.start_time).toLocaleTimeString("id-ID") },
        { label: "Waktu Selesai", getValue: item => new Date(item.end_time).toLocaleTimeString("id-ID") },
        { label: "Ruangan", key: "room_name" },
        { label: "Acara", key: "event_name" },
        { label: "Pemohon", key: "requester_name" },
        { label: "Status", key: "status" }
      ];
      exportToExcel(currentData, "riwayat_reservasi_ruangan", columns);
    });
  }, 150);
}
