/**
 * Transportasi Page Module
 * Handles transportation borrowing for members and CRUD for management
 */

let transportCalendarInstance = null;

async function loadTransportasiPage() {
  const contentArea = document.getElementById("content-area");
  const userRole = localStorage.getItem("userRole");
  showLoader();

  try {
    contentArea.innerHTML = "";
    const template = document
      .getElementById("transportasi-template")
      .content.cloneNode(true);
    contentArea.appendChild(template);

    if (userRole === "management") {
      await renderTransportManagementView();
    } else {
      await renderTransportMemberListView();
    }
  } catch (error) {
    contentArea.innerHTML = `<p class="text-red-500">Terjadi error: ${error.message}</p>`;
  } finally {
    hideLoader();
  }
}

// ============================================================
// MEMBER VIEW
// ============================================================

async function renderTransportMemberListView() {
  const container = document.getElementById("transportasi-content-area");

  try {
    const transports = await api.get("/api/member?resource=transports");

    if (transports.length === 0) {
      container.innerHTML = `<p class="text-gray-500">Belum ada kendaraan terdaftar.</p>`;
      return;
    }

    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${transports
          .map(
            (t) => `
          <div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition cursor-pointer" onclick="renderTransportDetailView('${t.id}')">
            <div class="h-40 bg-gray-200 flex items-center justify-center overflow-hidden">
              ${
                t.image_url
                  ? `<img src="${t.image_url}" alt="${t.vehicle_name}" class="w-full h-full object-cover"/>`
                  : `<i class="fas fa-shuttle-van text-6xl text-gray-400"></i>`
              }
            </div>
            <div class="p-4">
              <h3 class="text-lg font-bold text-gray-800">${t.vehicle_name}</h3>
              <p class="text-sm text-gray-500">${t.plate_number}</p>
              <div class="mt-2 flex items-center gap-4 text-sm text-gray-600">
                <span><i class="fas fa-users mr-1"></i> ${t.capacity} orang</span>
                <span><i class="fas fa-calendar-alt mr-1"></i> ${t.vehicle_year}</span>
              </div>
              ${
                t.driver_name
                  ? `<p class="mt-2 text-sm text-gray-600"><i class="fas fa-id-badge mr-1"></i> Sopir: ${t.driver_name}</p>`
                  : ""
              }
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<p class="text-red-500">Gagal memuat data: ${error.message}</p>`;
  }
}

async function renderTransportDetailView(transportId) {
  const container = document.getElementById("transportasi-content-area");
  showLoader();

  try {
    const transports = await api.get("/api/member?resource=transports");
    const transport = transports.find((t) => t.id === transportId);

    if (!transport) {
      container.innerHTML = `<p class="text-red-500">Kendaraan tidak ditemukan.</p>`;
      return;
    }

    // Get schedule for this transport
    const loans = await api.post("/api/management", {
      action: "getPendingTransportLoans",
    }).catch(() => []);

    // Get all loans for calendar (approved + pending)
    const allLoansResponse = await fetch("/api/member?resource=transports", {
      headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
    });

    container.innerHTML = `
      <button onclick="renderTransportMemberListView()" class="mb-4 text-[#d97706] hover:underline">
        <i class="fas fa-arrow-left mr-2"></i>Kembali ke Daftar
      </button>
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Info Kendaraan -->
        <div class="bg-white rounded-lg shadow-md p-6">
          <div class="mb-4 h-48 bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
            ${
              transport.image_url
                ? `<img src="${transport.image_url}" alt="${transport.vehicle_name}" class="w-full h-full object-cover"/>`
                : `<i class="fas fa-shuttle-van text-6xl text-gray-400"></i>`
            }
          </div>
          <h2 class="text-2xl font-bold text-gray-800 mb-2">${transport.vehicle_name}</h2>
          <p class="text-lg text-gray-600 mb-4">${transport.plate_number}</p>
          
          <div class="space-y-2 text-sm text-gray-600">
            <p><i class="fas fa-users w-6"></i> Kapasitas: ${transport.capacity} orang</p>
            <p><i class="fas fa-calendar-alt w-6"></i> Tahun: ${transport.vehicle_year}</p>
            <p><i class="fas fa-tachometer-alt w-6"></i> Odometer: ${transport.odometer_km.toLocaleString()} km</p>
            ${transport.driver_name ? `<p><i class="fas fa-id-badge w-6"></i> Sopir: ${transport.driver_name}</p>` : ""}
            ${transport.driver_whatsapp ? `<p><i class="fab fa-whatsapp w-6"></i> WA Sopir: <a href="https://wa.me/${transport.driver_whatsapp.replace(/\D/g, "")}" target="_blank" class="text-green-600 hover:underline">${transport.driver_whatsapp}</a></p>` : ""}
            ${transport.person_in_charge ? `<p><i class="fas fa-user-tie w-6"></i> PIC: ${transport.person_in_charge.full_name}</p>` : ""}
            ${transport.notes ? `<p class="mt-2 p-2 bg-yellow-50 rounded"><i class="fas fa-sticky-note mr-2"></i>${transport.notes}</p>` : ""}
          </div>
        </div>
        
        <!-- Kalendar & Form -->
        <div class="bg-white rounded-lg shadow-md p-6">
          <h3 class="text-lg font-bold text-gray-800 mb-4">Jadwal Peminjaman</h3>
          <div id="transport-calendar" class="mb-6"></div>
          
          <h3 class="text-lg font-bold text-gray-800 mb-4 mt-6 pt-4 border-t">Ajukan Peminjaman</h3>
          <form id="transport-borrow-form" class="space-y-4">
            <input type="hidden" id="transport-borrow-id" value="${transportId}" />
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Waktu Mulai</label>
                <input type="datetime-local" id="transport-borrow-start" required 
                  class="w-full p-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Waktu Selesai</label>
                <input type="datetime-local" id="transport-borrow-end" required 
                  class="w-full p-2 border border-gray-300 rounded-md" />
              </div>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Keperluan</label>
              <input type="text" id="transport-borrow-purpose" placeholder="Contoh: Kunjungi jemaat sakit"
                class="w-full p-2 border border-gray-300 rounded-md" />
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Titik Berangkat</label>
                <input type="text" id="transport-borrow-origin" placeholder="GKI Kutisari"
                  class="w-full p-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Tujuan</label>
                <input type="text" id="transport-borrow-destination" placeholder="RS Husada Utama"
                  class="w-full p-2 border border-gray-300 rounded-md" />
              </div>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Jumlah Penumpang</label>
              <input type="number" id="transport-borrow-passengers" min="1" max="${transport.capacity}" value="1"
                class="w-full p-2 border border-gray-300 rounded-md" />
            </div>
            
            <button type="submit" class="w-full bg-[#d97706] text-white font-bold py-2 px-4 rounded-md hover:bg-[#b45309]">
              <i class="fas fa-paper-plane mr-2"></i>Ajukan Peminjaman
            </button>
          </form>
        </div>
      </div>
    `;

    // Initialize FullCalendar
    await initTransportCalendar(transportId);

    // Form handler
    document
      .getElementById("transport-borrow-form")
      .addEventListener("submit", handleTransportBorrowSubmit);
  } catch (error) {
    container.innerHTML = `<p class="text-red-500">Gagal memuat detail: ${error.message}</p>`;
  } finally {
    hideLoader();
  }
}

async function initTransportCalendar(transportId) {
  const calendarEl = document.getElementById("transport-calendar");
  if (!calendarEl) return;

  // Fetch loans for this transport
  let events = [];
  try {
    const response = await fetch(
      `/api/schedule?type=transport&id=${transportId}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      }
    );
    if (response.ok) {
      const loans = await response.json();
      events = loans.map((loan) => ({
        title: loan.profiles?.full_name || "Peminjaman",
        start: loan.borrow_start,
        end: loan.borrow_end,
        color:
          loan.status === "Disetujui"
            ? "#22c55e"
            : loan.status === "Menunggu Persetujuan"
            ? "#f59e0b"
            : "#6b7280",
      }));
    }
  } catch (e) {
    console.log("Could not load schedule:", e);
  }

  if (transportCalendarInstance) {
    transportCalendarInstance.destroy();
  }

  transportCalendarInstance = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek",
    },
    height: 400,
    events: events,
    eventClick: function (info) {
      alert(
        `${info.event.title}\n${new Date(info.event.start).toLocaleString()} - ${new Date(info.event.end).toLocaleString()}`
      );
    },
  });

  transportCalendarInstance.render();
}

async function handleTransportBorrowSubmit(e) {
  e.preventDefault();
  showLoader();

  try {
    const payload = {
      transport_id: document.getElementById("transport-borrow-id").value,
      borrow_start: document.getElementById("transport-borrow-start").value,
      borrow_end: document.getElementById("transport-borrow-end").value,
      purpose: document.getElementById("transport-borrow-purpose").value,
      origin: document.getElementById("transport-borrow-origin").value,
      destination: document.getElementById("transport-borrow-destination").value,
      passengers_count: parseInt(
        document.getElementById("transport-borrow-passengers").value
      ),
    };

    const result = await api.post("/api/member?resource=transports", payload);
    alert(result.message);
    e.target.reset();
    await initTransportCalendar(payload.transport_id);
  } catch (error) {
    alert("Gagal mengajukan peminjaman: " + error.message);
  } finally {
    hideLoader();
  }
}

// ============================================================
// MANAGEMENT VIEW
// ============================================================

let managementUserListForTransport = [];

async function renderTransportManagementView() {
  const container = document.getElementById("transportasi-content-area");

  // Load users for PIC dropdown
  try {
    managementUserListForTransport = await api.post("/api/management", {
      action: "getUsers",
    });
  } catch (e) {
    managementUserListForTransport = [];
  }

  container.innerHTML = `
    <div class="mb-6">
      <div class="flex flex-wrap gap-2">
        <button onclick="showTransportManagementTab('list')" id="tab-transport-list" 
          class="px-4 py-2 rounded-md bg-[#d97706] text-white font-semibold">
          Daftar Kendaraan
        </button>
        <button onclick="showTransportManagementTab('pending')" id="tab-transport-pending" 
          class="px-4 py-2 rounded-md bg-gray-200 text-gray-700 font-semibold">
          Pending Requests
        </button>
      </div>
    </div>
    <div id="transport-management-content"></div>
  `;

  await showTransportManagementTab("list");
}

async function showTransportManagementTab(tab) {
  // Update tab buttons
  document.getElementById("tab-transport-list").className =
    tab === "list"
      ? "px-4 py-2 rounded-md bg-[#d97706] text-white font-semibold"
      : "px-4 py-2 rounded-md bg-gray-200 text-gray-700 font-semibold";
  document.getElementById("tab-transport-pending").className =
    tab === "pending"
      ? "px-4 py-2 rounded-md bg-[#d97706] text-white font-semibold"
      : "px-4 py-2 rounded-md bg-gray-200 text-gray-700 font-semibold";

  if (tab === "list") {
    await renderTransportCrudView();
  } else {
    await renderTransportPendingView();
  }
}

async function renderTransportCrudView() {
  const content = document.getElementById("transport-management-content");
  showLoader();

  try {
    const transports = await api.post("/api/management", {
      action: "getTransportations",
    });

    content.innerHTML = `
      <div class="flex justify-end mb-4">
        <button onclick="openTransportModal('create')" class="bg-[#d97706] text-white font-bold py-2 px-4 rounded-md hover:bg-[#b45309]">
          <i class="fas fa-plus mr-2"></i>Tambah Kendaraan
        </button>
      </div>
      
      <div class="bg-white rounded-lg shadow-md overflow-x-auto">
        <table class="min-w-full">
          <thead class="bg-gray-100">
            <tr>
              <th class="text-left p-3">Kendaraan</th>
              <th class="text-left p-3">Plat</th>
              <th class="text-left p-3">Tahun</th>
              <th class="text-left p-3">Kapasitas</th>
              <th class="text-left p-3">PIC</th>
              <th class="text-left p-3">Sopir</th>
              <th class="text-left p-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${
              transports.length === 0
                ? `<tr><td colspan="7" class="p-4 text-center text-gray-500">Belum ada data kendaraan.</td></tr>`
                : transports
                    .map(
                      (t) => `
                <tr class="border-b hover:bg-gray-50">
                  <td class="p-3 font-medium">${t.vehicle_name}</td>
                  <td class="p-3">${t.plate_number}</td>
                  <td class="p-3">${t.vehicle_year}</td>
                  <td class="p-3">${t.capacity} orang</td>
                  <td class="p-3">${t.person_in_charge?.full_name || "-"}</td>
                  <td class="p-3">${t.driver_name || "-"}</td>
                  <td class="p-3 whitespace-nowrap">
                    <button onclick='openTransportModal("edit", ${JSON.stringify(t).replace(/'/g, "\\'")})' 
                      class="text-blue-500 hover:underline mr-3">Edit</button>
                    <button onclick="deleteTransportation('${t.id}')" 
                      class="text-red-500 hover:underline">Hapus</button>
                  </td>
                </tr>
              `
                    )
                    .join("")
            }
          </tbody>
        </table>
      </div>
    `;
  } catch (error) {
    content.innerHTML = `<p class="text-red-500">Gagal memuat data: ${error.message}</p>`;
  } finally {
    hideLoader();
  }
}

async function renderTransportPendingView() {
  const content = document.getElementById("transport-management-content");
  showLoader();

  try {
    const pendingLoans = await api.post("/api/management", {
      action: "getPendingTransportLoans",
    });

    content.innerHTML = `
      <div class="bg-white rounded-lg shadow-md overflow-x-auto">
        <table class="min-w-full">
          <thead class="bg-gray-100">
            <tr>
              <th class="text-left p-3">Pemohon</th>
              <th class="text-left p-3">Kendaraan</th>
              <th class="text-left p-3">Jadwal</th>
              <th class="text-left p-3">Keperluan</th>
              <th class="text-left p-3">Rute</th>
              <th class="text-left p-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${
              pendingLoans.length === 0
                ? `<tr><td colspan="6" class="p-4 text-center text-gray-500">Tidak ada permintaan menunggu.</td></tr>`
                : pendingLoans
                    .map(
                      (loan) => `
                <tr class="border-b hover:bg-gray-50">
                  <td class="p-3 font-medium">${loan.profiles?.full_name || "-"}</td>
                  <td class="p-3">${loan.transportations?.vehicle_name || "-"}<br><span class="text-xs text-gray-500">${loan.transportations?.plate_number || ""}</span></td>
                  <td class="p-3 text-sm">
                    ${new Date(loan.borrow_start).toLocaleString("id-ID")}<br>
                    <span class="text-gray-500">s/d</span><br>
                    ${new Date(loan.borrow_end).toLocaleString("id-ID")}
                  </td>
                  <td class="p-3">${loan.purpose || "-"}</td>
                  <td class="p-3 text-sm">${loan.origin || "-"} → ${loan.destination || "-"}<br><span class="text-xs text-gray-500">${loan.passengers_count || 1} org</span></td>
                  <td class="p-3 whitespace-nowrap">
                    <button onclick="updateTransportLoanStatus('${loan.id}', 'Disetujui')" 
                      class="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 mr-2">
                      <i class="fas fa-check"></i> Setujui
                    </button>
                    <button onclick="updateTransportLoanStatus('${loan.id}', 'Ditolak')" 
                      class="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600">
                      <i class="fas fa-times"></i> Tolak
                    </button>
                  </td>
                </tr>
              `
                    )
                    .join("")
            }
          </tbody>
        </table>
      </div>
    `;
  } catch (error) {
    content.innerHTML = `<p class="text-red-500">Gagal memuat data: ${error.message}</p>`;
  } finally {
    hideLoader();
  }
}

async function updateTransportLoanStatus(loanId, newStatus) {
  if (!confirm(`Yakin ingin ${newStatus === "Disetujui" ? "menyetujui" : "menolak"} peminjaman ini?`)) return;

  showLoader();
  try {
    const result = await api.post("/api/management", {
      action: "updateTransportLoanStatus",
      payload: { loanId, newStatus },
    });
    alert(result.message);
    await renderTransportPendingView();
  } catch (error) {
    alert("Gagal: " + error.message);
  } finally {
    hideLoader();
  }
}

function openTransportModal(mode, data = {}) {
  // Create modal if not exists
  let modal = document.getElementById("transport-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "transport-modal";
    modal.className =
      "modal fixed inset-0 bg-gray-900 bg-opacity-50 hidden items-center justify-center z-50";
    modal.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 id="transport-modal-title" class="text-2xl font-bold mb-6"></h2>
        <form id="transport-modal-form">
          <input type="hidden" id="transport-modal-id" />
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Nama Kendaraan *</label>
              <input type="text" id="transport-modal-name" required class="w-full p-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Nomor Plat *</label>
              <input type="text" id="transport-modal-plate" required class="w-full p-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Tahun</label>
              <input type="number" id="transport-modal-year" class="w-full p-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Odometer (km)</label>
              <input type="number" id="transport-modal-odometer" class="w-full p-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Kapasitas (orang) *</label>
              <input type="number" id="transport-modal-capacity" required min="1" class="w-full p-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Penanggung Jawab (PIC) *</label>
              <select id="transport-modal-pic" required class="w-full p-2 border border-gray-300 rounded-md">
                <option value="">Pilih PIC...</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Nama Sopir</label>
              <input type="text" id="transport-modal-driver" class="w-full p-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">WA Sopir</label>
              <input type="text" id="transport-modal-driver-wa" placeholder="08xxx" class="w-full p-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Service Terakhir</label>
              <input type="date" id="transport-modal-last-service" class="w-full p-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Service Berikutnya</label>
              <input type="date" id="transport-modal-next-service" class="w-full p-2 border border-gray-300 rounded-md" />
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">URL Gambar</label>
              <input type="url" id="transport-modal-image" placeholder="https://..." class="w-full p-2 border border-gray-300 rounded-md" />
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
              <textarea id="transport-modal-notes" rows="2" class="w-full p-2 border border-gray-300 rounded-md"></textarea>
            </div>
          </div>
          <div class="flex justify-end space-x-4 mt-6">
            <button type="button" onclick="closeTransportModal()" class="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300">Batal</button>
            <button type="submit" class="px-4 py-2 bg-[#d97706] text-white rounded-md hover:bg-[#b45309]">Simpan</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    document
      .getElementById("transport-modal-form")
      .addEventListener("submit", handleTransportFormSubmit);
  }

  // Populate PIC dropdown
  const picSelect = document.getElementById("transport-modal-pic");
  picSelect.innerHTML = `<option value="">Pilih PIC...</option>`;
  managementUserListForTransport.forEach((u) => {
    picSelect.innerHTML += `<option value="${u.id}">${u.full_name || u.email}</option>`;
  });

  // Fill form
  document.getElementById("transport-modal-title").textContent =
    mode === "edit" ? "Edit Kendaraan" : "Tambah Kendaraan Baru";
  document.getElementById("transport-modal-id").value = data.id || "";
  document.getElementById("transport-modal-name").value = data.vehicle_name || "";
  document.getElementById("transport-modal-plate").value = data.plate_number || "";
  document.getElementById("transport-modal-year").value = data.vehicle_year || new Date().getFullYear();
  document.getElementById("transport-modal-odometer").value = data.odometer_km || 0;
  document.getElementById("transport-modal-capacity").value = data.capacity || 7;
  document.getElementById("transport-modal-pic").value = data.person_in_charge_id || "";
  document.getElementById("transport-modal-driver").value = data.driver_name || "";
  document.getElementById("transport-modal-driver-wa").value = data.driver_whatsapp || "";
  document.getElementById("transport-modal-last-service").value = data.last_service_at || "";
  document.getElementById("transport-modal-next-service").value = data.next_service_at || "";
  document.getElementById("transport-modal-image").value = data.image_url || "";
  document.getElementById("transport-modal-notes").value = data.notes || "";

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeTransportModal() {
  const modal = document.getElementById("transport-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
}

async function handleTransportFormSubmit(e) {
  e.preventDefault();
  showLoader();

  const transportId = document.getElementById("transport-modal-id").value;
  const action = transportId ? "updateTransportation" : "createTransportation";

  const payload = {
    vehicle_name: document.getElementById("transport-modal-name").value,
    plate_number: document.getElementById("transport-modal-plate").value,
    vehicle_year: parseInt(document.getElementById("transport-modal-year").value),
    odometer_km: parseInt(document.getElementById("transport-modal-odometer").value) || 0,
    capacity: parseInt(document.getElementById("transport-modal-capacity").value),
    person_in_charge_id: document.getElementById("transport-modal-pic").value,
    driver_name: document.getElementById("transport-modal-driver").value || null,
    driver_whatsapp: document.getElementById("transport-modal-driver-wa").value || null,
    last_service_at: document.getElementById("transport-modal-last-service").value || null,
    next_service_at: document.getElementById("transport-modal-next-service").value || null,
    image_url: document.getElementById("transport-modal-image").value || null,
    notes: document.getElementById("transport-modal-notes").value || null,
  };

  if (transportId) payload.transportId = transportId;

  try {
    const result = await api.post("/api/management", { action, payload });
    alert(result.message);
    closeTransportModal();
    await renderTransportCrudView();
  } catch (error) {
    alert("Gagal menyimpan: " + error.message);
  } finally {
    hideLoader();
  }
}

async function deleteTransportation(transportId) {
  if (!confirm("Yakin ingin menghapus kendaraan ini?")) return;

  showLoader();
  try {
    const result = await api.post("/api/management", {
      action: "deleteTransportation",
      payload: { transportId },
    });
    alert(result.message);
    await renderTransportCrudView();
  } catch (error) {
    alert("Gagal menghapus: " + error.message);
  } finally {
    hideLoader();
  }
}
