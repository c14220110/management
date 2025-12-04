/**
 * Ruangan (Rooms) Page Module
 * Handles room management for both members and management users
 */

async function loadRuanganPage() {
  const contentArea = document.getElementById("content-area");
  showLoader();
  try {
    contentArea.innerHTML = "";
    const template = document
      .getElementById("ruangan-template")
      .content.cloneNode(true);
    contentArea.appendChild(template);
    const container = document.getElementById("ruangan-content-area");
    if (localStorage.getItem("userRole") === "management") {
      await renderRuanganManagementView(container);
    } else {
      await renderRuanganListView();
    }
  } catch (error) {
    contentArea.innerHTML = `<p class="text-red-500">Terjadi error saat memuat halaman ruangan: ${error.message}</p>`;
  } finally {
    hideLoader();
  }
}

async function renderRuanganManagementView(container) {
  container.innerHTML = `<p>Memuat data manajemen ruangan...</p>`;
  try {
    const [rooms, users] = await Promise.all([
      api.post("/api/management", { action: "getRooms" }),
      api.post("/api/management", { action: "getUsers" }),
    ]);
    const managementUsers = users.filter((u) => u.role === "management");
    const managerOptionsHTML = managementUsers
      .map((m) => `<option value="${m.id}">${m.full_name}</option>`)
      .join("");

    container.innerHTML = `<div class="flex justify-end mb-4"><button id="add-room-btn" class="bg-[#d97706] text-white font-bold py-2 px-4 rounded-md hover:bg-[#b46504]"><i class="fas fa-plus mr-2"></i>Tambah Ruangan</button></div>
      <div class="bg-white p-4 rounded-lg shadow-md">
          <div class="overflow-x-auto">
              <table class="min-w-full"><thead class="bg-gray-100"><tr><th class="text-left p-3">Nama Ruangan</th><th class="text-left p-3">Lokasi</th><th class="text-left p-3">Kapasitas</th><th class="text-left p-3">Penanggung Jawab</th><th class="text-center p-3">Aksi</th></tr></thead>
              <tbody id="room-table-body">${rooms
                .map(
                  (room) => `
                  <tr class="border-b">
                      <td class="p-3">${room.name}</td>
                      <td class="p-3">${room.lokasi || "-"}</td>
                      <td class="p-3">${room.kapasitas || "-"}</td>
                      <td class="p-3">${
                        room.penanggung_jawab?.full_name ||
                        "<i>Belum diatur</i>"
                      }</td>
                      <td class="p-3 whitespace-nowrap text-center">
                          <button type="button" class="room-action-btn action-menu-btn inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none" data-room-id="${
                            room.id
                          }" data-room-name="${
                    room.name
                  }" data-room-data='${JSON.stringify(room)}'>
                              <i class="fas fa-ellipsis-v"></i>
                          </button>
                      </td>
                  </tr>`
                )
                .join("")}
              </tbody></table>
          </div>
      </div>`;

    document
      .getElementById("add-room-btn")
      .addEventListener("click", () =>
        openRoomModal("create", {}, managerOptionsHTML)
      );

    initializeRoomActionMenus(container, managerOptionsHTML);
  } catch (error) {
    container.innerHTML = `<p class="text-red-500">Gagal memuat data: ${error.message}</p>`;
  }
}

function initializeRoomActionMenus(container, managerOptionsHTML) {
  const buttons = container.querySelectorAll(".room-action-btn");
  buttons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const roomData = JSON.parse(button.dataset.roomData);
      const roomName = button.dataset.roomName;
      const roomId = button.dataset.roomId;
      openGlobalActionMenu({
        triggerElement: button,
        items: [
          {
            label: "Edit",
            icon: "fas fa-edit",
            className: "text-amber-600",
            onClick: () => openRoomModal("edit", roomData, managerOptionsHTML),
          },
          {
            label: "Lihat Jadwal",
            icon: "fas fa-calendar-alt",
            className: "text-gray-700",
            onClick: () => renderRuanganScheduleView_Management(roomName),
          },
          {
            label: "Hapus",
            icon: "fas fa-trash-alt",
            className: "text-red-600",
            onClick: () => {
              if (!confirm("Apakah Anda yakin ingin menghapus ruangan ini?")) {
                return;
              }
              api
                .post("/api/management", {
                  action: "deleteRoom",
                  payload: { roomId },
                })
                .then((res) => {
                  notifySuccess(res.message);
                  renderRuanganManagementView(
                    document.getElementById("ruangan-content-area")
                  );
                })
                .catch((err) => alert(`Gagal menghapus: ${err.message}`));
            },
          },
        ],
      });
    });
  });
}

async function renderRuanganListView() {
  const container = document.getElementById("ruangan-content-area");
  container.innerHTML = `<p>Memuat daftar ruangan...</p>`;
  try {
    const rooms = await api.get("/api/member?resource=rooms");
    let listHTML = '<div class="space-y-4">';
    rooms.forEach((room) => {
      listHTML += `<div data-name="${room.name}" class="room-item bg-white p-4 rounded-lg shadow-md cursor-pointer hover:shadow-xl transition-shadow flex items-center"><i class="fas fa-building text-2xl text-gray-400 mr-4"></i><h3 class="font-bold text-lg">${room.name}</h3></div>`;
    });
    listHTML += "</div>";
    container.innerHTML = listHTML;
    document.querySelectorAll(".room-item").forEach((item) => {
      item.addEventListener("click", () => {
        const roomName = item.dataset.name;
        renderRuanganDetailView(roomName);
      });
    });
  } catch (error) {
    container.innerHTML = `<p class="text-red-500">Gagal memuat ruangan: ${error.message}</p>`;
  }
}

async function renderRuanganDetailView(roomName) {
  const container = document.getElementById("ruangan-content-area");
  container.innerHTML = `<p>Memuat detail dan jadwal untuk ${roomName}...</p>`;
  try {
    const schedule = await api.get(
      `/api/schedule?type=room&name=${encodeURIComponent(roomName)}`
    );
    const calendarEvents = schedule.map((reservation) => ({
      title: reservation.event_name,
      start: reservation.start_time,
      end: reservation.end_time,
      backgroundColor: "#3b82f6",
      borderColor: "#3b82f6",
    }));
    container.innerHTML = `<div class="bg-white p-6 rounded-lg shadow-md">
          <button id="back-to-room-list-btn" class="mb-4 text-amber-600 hover:underline"><i class="fas fa-arrow-left mr-2"></i>Kembali ke Daftar Ruangan</button>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div class="md:col-span-1"><h2 class="text-2xl font-bold">${roomName}</h2><p class="text-gray-600 mt-2">Gunakan kalender di sebelah kanan untuk melihat jadwal yang sudah terisi.</p><div id="reservation-section-container" class="mt-6"></div></div>
              <div class="md:col-span-2"><h3 class="text-xl font-semibold mb-2">Kalender Reservasi</h3><div id="detail-calendar" class="w-full h-full"></div></div>
          </div></div>`;
    const calendarEl = document.getElementById("detail-calendar");
    if (fullCalendarInstance) fullCalendarInstance.destroy();
    fullCalendarInstance = new FullCalendar.Calendar(calendarEl, {
      initialView: "timeGridWeek",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay",
      },
      locale: "id",
      events: calendarEvents,
      eventDidMount: function (info) {
        info.el.title = info.event.title;
      },
    });
    fullCalendarInstance.render();
    document
      .getElementById("back-to-room-list-btn")
      .addEventListener("click", renderRuanganListView);
    const reservationContainer = document.getElementById(
      "reservation-section-container"
    );
    if (localStorage.getItem("userRole") === "member") {
      reservationContainer.innerHTML = `<button id="show-reservation-form-btn" class="w-full bg-[#d97706] text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700">Reservasi Ruangan Ini</button>
          <form id="detail-reservation-form" class="hidden mt-4 space-y-4">
              <div><label for="res-event-name" class="block text-sm font-medium text-gray-700">Nama Kegiatan</label><input type="text" id="res-event-name" required class="w-full p-2 border border-gray-300 rounded-md"></div>
              <div><label for="res-start-time" class="block text-sm font-medium text-gray-700">Waktu Mulai</label><input type="datetime-local" id="res-start-time" required class="w-full p-2 border border-gray-300 rounded-md"></div>
              <div><label for="res-end-time" class="block text-sm font-medium text-gray-700">Waktu Selesai</label><input type="datetime-local" id="res-end-time" required class="w-full p-2 border border-gray-300 rounded-md"></div>
              <button type="submit" class="w-full bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700">Kirim Permintaan</button>
              <p id="detail-reservation-feedback" class="text-center font-semibold"></p>
          </form>`;
      const showFormBtn = document.getElementById("show-reservation-form-btn");
      const detailReservationForm = document.getElementById(
        "detail-reservation-form"
      );
      showFormBtn.addEventListener("click", () => {
        detailReservationForm.classList.remove("hidden");
        showFormBtn.classList.add("hidden");
      });
      detailReservationForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const feedback = document.getElementById("detail-reservation-feedback");
        feedback.textContent = "Mengirim...";
        feedback.className = "text-center font-semibold text-amber-600";
        try {
          await api.post("/api/member?resource=rooms", {
            room_name: roomName,
            event_name: document.getElementById("res-event-name").value,
            start_time: document.getElementById("res-start-time").value,
            end_time: document.getElementById("res-end-time").value,
          });
          feedback.textContent = "Permintaan berhasil dikirim!";
          feedback.className = "text-center font-semibold text-green-600";
          detailReservationForm.reset();
          renderRuanganDetailView(roomName);
        } catch (error) {
          feedback.textContent = `Gagal: ${error.message}`;
          feedback.className = "text-center font-semibold text-red-600";
        }
      });
    }
  } catch (error) {
    container.innerHTML = `<p class="text-red-500">Gagal memuat detail ruangan: ${error.message}</p>`;
  }
}

async function renderRuanganScheduleView_Management(roomName) {
  const container = document.getElementById("ruangan-content-area");
  container.innerHTML = `<p>Memuat jadwal untuk ${roomName}...</p>`;
  showLoader();

  try {
    const schedule = await api.get(
      `/api/schedule?type=room&name=${encodeURIComponent(roomName)}`
    );
    const calendarEvents = schedule.map((reservation) => ({
      title: reservation.event_name,
      start: reservation.start_time,
      end: reservation.end_time,
      backgroundColor: "#3b82f6",
      borderColor: "#3b82f6",
    }));

    container.innerHTML = `
          <div class="bg-white p-6 rounded-lg shadow-md">
              <button id="back-to-management-view-btn" class="mb-4 text-amber-600 hover:underline"><i class="fas fa-arrow-left mr-2"></i>Kembali ke Manajemen Ruangan</button>
              <h2 class="text-2xl font-bold mb-4">Jadwal untuk ${roomName}</h2>
              <div id="management-schedule-calendar" class="w-full h-full"></div>
          </div>
      `;

    const calendarEl = document.getElementById("management-schedule-calendar");
    if (fullCalendarInstance) {
      fullCalendarInstance.destroy();
    }
    fullCalendarInstance = new FullCalendar.Calendar(calendarEl, {
      initialView: "timeGridWeek",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay",
      },
      locale: "id",
      events: calendarEvents,
      eventDidMount: function (info) {
        info.el.title = info.event.title;
      },
    });
    fullCalendarInstance.render();

    document
      .getElementById("back-to-management-view-btn")
      .addEventListener("click", loadRuanganPage);
  } catch (error) {
    container.innerHTML = `<p class="text-red-500">Gagal memuat jadwal: ${error.message}</p>`;
  } finally {
    hideLoader();
  }
}

function openRoomModal(mode, roomData = {}, managerOptionsHTML) {
  const modal = document.getElementById("room-modal");
  const form = document.getElementById("room-modal-form");
  form.reset();
  document.getElementById("room-modal-feedback").textContent = "";
  const pjSelect = document.getElementById("room-penanggung-jawab");
  pjSelect.innerHTML = `<option value="">-- Pilih Penanggung Jawab --</option>${managerOptionsHTML}`;
  if (mode === "edit") {
    document.getElementById("room-modal-title").textContent = "Edit Ruangan";
    document.getElementById("room-id").value = roomData.id;
    document.getElementById("room-name").value = roomData.name;
    document.getElementById("room-lokasi").value = roomData.lokasi || "";
    document.getElementById("room-kapasitas").value = roomData.kapasitas || "";
    pjSelect.value = roomData.penanggung_jawab?.id || "";
  } else {
    document.getElementById("room-modal-title").textContent =
      "Tambah Ruangan Baru";
    document.getElementById("room-id").value = "";
  }
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeRoomModal() {
  document.getElementById("room-modal").classList.add("hidden");
  document.getElementById("room-modal").classList.remove("flex");
}

async function handleRoomFormSubmit(e) {
  e.preventDefault();
  const feedback = document.getElementById("room-modal-feedback");
  const button = e.target.querySelector('button[type="submit"]');
  button.disabled = true;
  feedback.textContent = "Menyimpan...";
  const roomId = document.getElementById("room-id").value;
  const action = roomId ? "updateRoom" : "createRoom";
  const payload = {
    name: document.getElementById("room-name").value,
    lokasi: document.getElementById("room-lokasi").value,
    kapasitas:
      parseInt(document.getElementById("room-kapasitas").value) || null,
    penanggung_jawab_id: document.getElementById("room-penanggung-jawab").value,
  };
  if (!payload.penanggung_jawab_id) {
    feedback.textContent = "Error: Penanggung Jawab wajib dipilih.";
    button.disabled = false;
    return;
  }
  if (action === "updateRoom") payload.roomId = roomId;
  try {
    const result = await api.post("/api/management", { action, payload });
    notifySuccess(result.message);
    closeRoomModal();
    renderRuanganManagementView(
      document.getElementById("ruangan-content-area")
    );
  } catch (error) {
    feedback.textContent = `Error: ${error.message}`;
  } finally {
    button.disabled = false;
  }
}
