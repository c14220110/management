/**
 * Dashboard Page Module
 * Handles both manager and member dashboard views
 */

async function loadDashboardPage() {
  const contentArea = document.getElementById("content-area");
  showLoader();
  try {
    contentArea.innerHTML = "";
    const template = document
      .getElementById("dashboard-template")
      .content.cloneNode(true);
    contentArea.appendChild(template);
    const userRole = localStorage.getItem("userRole");
    if (userRole === "management") {
      document
        .getElementById("manager-dashboard-content")
        .classList.remove("hidden");
      await renderManagerDashboard();
    } else {
      document
        .getElementById("member-dashboard-content")
        .classList.remove("hidden");
      await renderMemberDashboard();
    }
  } catch (error) {
    contentArea.innerHTML = `<p class="text-red-500">Gagal memuat dashboard: ${error.message}</p>`;
  } finally {
    hideLoader();
  }
}

async function renderManagerDashboard() {
  const container = document.getElementById("manager-dashboard-content");
  container.innerHTML = `<h1 class="text-3xl font-bold text-gray-800 mb-6">Dashboard Manajemen</h1><p>Memuat data...</p>`;
  try {
    const [stats, pendingRequests, pendingTransLoans] = await Promise.all([
      api.get("/api/dashboard?action=stats"),
      api.post("/api/management", { action: "getPendingRequests" }),
      api.post("/api/management", { action: "getPendingTransportLoans" }).catch(() => []),
    ]);
    const pendingAssetLoans = pendingRequests.pendingAssetLoans ?? [];
    const pendingRoomReservations =
      pendingRequests.pendingRoomReservations ?? [];
    const pendingTransportLoans = pendingTransLoans ?? [];
    let contentHTML = `
          <h1 class="text-3xl font-bold text-gray-800 mb-6">Dashboard Manajemen</h1>
          <h2 class="text-xl font-semibold text-gray-700 mb-4">Statistik Aset</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div class="p-6 bg-white rounded-lg shadow-md"><h3 class="text-gray-500">Total Aset</h3><p class="text-3xl font-bold">${stats.totalAssets}</p></div>
              <div class="p-6 bg-white rounded-lg shadow-md"><h3 class="text-gray-500">Aset Dipinjam</h3><p class="text-3xl font-bold">${stats.borrowedAssets}</p></div>
              <div class="p-6 bg-white rounded-lg shadow-md"><h3 class="text-gray-500">Dalam Perbaikan</h3><p class="text-3xl font-bold">${stats.maintenanceAssets}</p></div>
          </div>
          <h2 class="text-xl font-semibold text-gray-700 mb-4">Statistik Ruangan</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div class="p-6 bg-white rounded-lg shadow-md"><h3 class="text-gray-500">Total Ruangan</h3><p class="text-3xl font-bold">${stats.totalRooms}</p></div>
              <div class="p-6 bg-white rounded-lg shadow-md"><h3 class="text-gray-500">Reservasi Disetujui</h3><p class="text-3xl font-bold">${stats.approvedReservations}</p></div>
              <div class="p-6 bg-white rounded-lg shadow-md"><h3 class="text-gray-500">Menunggu Persetujuan</h3><p class="text-3xl font-bold">${stats.pendingReservations}</p></div>
          </div>
          <div id="actionable-list-container">
              <h2 class="text-xl font-semibold text-gray-700 mb-4">Persetujuan Tertunda</h2>
              <div class="bg-white p-4 rounded-lg shadow-md space-y-4">`;
    const allPendingRequests = [
      ...pendingAssetLoans.map((item) => ({ ...item, type: "loan" })),
      ...pendingRoomReservations.map((item) => ({
        ...item,
        type: "room",
      })),
      ...pendingTransportLoans.map((item) => ({
        ...item,
        type: "transport",
      })),
    ];
    if (allPendingRequests.length === 0) {
      contentHTML +=
        '<p class="text-gray-500 p-4 text-center">Tidak ada permintaan baru.</p>';
    } else {
      allPendingRequests.forEach((item) => {
        let title, requester, time;
        if (item.type === "loan") {
          title = `🔧 ${item.assets.asset_name}`;
          requester = item.profiles.full_name;
          time = new Date(item.loan_date).toLocaleDateString("id-ID");
        } else if (item.type === "room") {
          title = `🏠 ${item.event_name} (${item.room_name})`;
          requester = item.requester_name;
          time = new Date(item.start_time).toLocaleString("id-ID");
        } else if (item.type === "transport") {
          title = `🚐 ${item.transportations?.vehicle_name || "Kendaraan"}` + (item.transportations?.plate_number ? ` (${item.transportations.plate_number})` : "");
          requester = item.profiles?.full_name || "-";
          time = new Date(item.borrow_start).toLocaleString("id-ID");
        }
        contentHTML += `
                  <div class="flex items-center justify-between p-4 border rounded-md">
                      <div>
                          <p class="font-semibold">${title}</p>
                          <p class="text-sm text-gray-600">Oleh: ${requester} | Diajukan: ${time}</p>
                      </div>
                      <div class="flex space-x-2">
                          <button data-id="${item.id}" data-type="${item.type}" data-action="Disetujui" class="admin-action-btn bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 rounded">Setujui</button>
                          <button data-id="${item.id}" data-type="${item.type}" data-action="Ditolak" class="admin-action-btn bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded">Tolak</button>
                      </div>
                  </div>`;
      });
    }
    contentHTML += `</div></div>`;
    container.innerHTML = contentHTML;
    document
      .querySelectorAll(".admin-action-btn")
      .forEach((button) =>
        button.addEventListener("click", handleAdminAction)
      );
  } catch (error) {
    container.innerHTML = `<p class="text-red-500">Gagal memuat data dashboard: ${error.message}</p>`;
  }
}

async function renderMemberDashboard() {
  const container = document.getElementById("member-dashboard-content");
  container.innerHTML = `<h1 class="text-3xl font-bold text-gray-800 mb-6">Status Permintaan Saya</h1><div id="my-requests-list" class="space-y-4"><p>Memuat data permintaan...</p></div>`;
  const listContainer = document.getElementById("my-requests-list");
  try {
    const { assetLoans, roomReservations, transportLoans } = await api.get(
      "/api/dashboard?action=my-requests"
    );
    listContainer.innerHTML = "";
    listContainer.innerHTML +=
      '<h2 class="text-xl font-semibold mt-4">Peminjaman Barang</h2>';
    if (assetLoans.length > 0) {
      assetLoans.forEach((item) => {
        const statusColor =
          item.status === "Disetujui"
            ? "text-green-600"
            : item.status === "Ditolak"
            ? "text-red-600"
            : "text-yellow-600";
        const itemDiv = document.createElement("div");
        itemDiv.className =
          "bg-white p-4 rounded-lg shadow-md flex justify-between items-center";
        itemDiv.innerHTML = `<div><p class="font-bold">${
          item.assets.asset_name
        }</p><p class="text-sm ${statusColor}">${item.status}</p></div>
                  ${
                    item.status === "Menunggu Persetujuan"
                      ? `<button data-id="${item.id}" data-type="asset" class="cancel-btn bg-gray-500 text-white py-1 px-3 rounded hover:bg-gray-600">Batalkan</button>`
                      : ""
                  }`;
        listContainer.appendChild(itemDiv);
      });
    } else {
      listContainer.innerHTML +=
        '<p class="text-gray-500">Tidak ada riwayat peminjaman barang.</p>';
    }
    listContainer.innerHTML +=
      '<h2 class="text-xl font-semibold mt-6">Reservasi Ruangan</h2>';
    if (roomReservations.length > 0) {
      roomReservations.forEach((item) => {
        const statusColor =
          item.status === "Disetujui"
            ? "text-green-600"
            : item.status === "Ditolak"
            ? "text-red-600"
            : "text-yellow-600";
        const itemDiv = document.createElement("div");
        itemDiv.className =
          "bg-white p-4 rounded-lg shadow-md flex justify-between items-center";
        itemDiv.innerHTML = `<div><p class="font-bold">${
          item.event_name
        } (${item.room_name})</p><p class="text-sm ${statusColor}">${
          item.status
        }</p></div>
                  ${
                    item.status === "Menunggu Persetujuan"
                      ? `<button data-id="${item.id}" data-type="room" class="cancel-btn bg-gray-500 text-white py-1 px-3 rounded hover:bg-gray-600">Batalkan</button>`
                      : ""
                  }`;
        listContainer.appendChild(itemDiv);
      });
    } else {
      listContainer.innerHTML +=
        '<p class="text-gray-500">Tidak ada riwayat reservasi ruangan.</p>';
    }

    // TRANSPORT LOANS SECTION
    listContainer.innerHTML +=
      '<h2 class="text-xl font-semibold mt-6">Peminjaman Transportasi</h2>';
    if (transportLoans && transportLoans.length > 0) {
      transportLoans.forEach((item) => {
        const statusColor =
          item.status === "Disetujui"
            ? "text-green-600"
            : item.status === "Ditolak"
            ? "text-red-600"
            : "text-yellow-600";
        const itemDiv = document.createElement("div");
        itemDiv.className =
          "bg-white p-4 rounded-lg shadow-md flex justify-between items-center";
        itemDiv.innerHTML = `<div><p class="font-bold">${
          item.transportations?.vehicle_name || "Kendaraan"
        } (${item.transportations?.plate_number || "-"})</p><p class="text-sm text-gray-500">${item.purpose || "-"} | ${new Date(item.borrow_start).toLocaleDateString("id-ID")}</p><p class="text-sm ${statusColor}">${item.status}</p></div>
                  ${
                    item.status === "Menunggu Persetujuan"
                      ? `<button data-id="${item.id}" data-type="transport" class="cancel-btn bg-gray-500 text-white py-1 px-3 rounded hover:bg-gray-600">Batalkan</button>`
                      : ""
                  }`;
        listContainer.appendChild(itemDiv);
      });
    } else {
      listContainer.innerHTML +=
        '<p class="text-gray-500">Tidak ada riwayat peminjaman transportasi.</p>';
    }
    document
      .querySelectorAll(".cancel-btn")
      .forEach((btn) =>
        btn.addEventListener("click", handleCancelRequest)
      );
  } catch (error) {
    listContainer.innerHTML = `<p class="text-red-500">Gagal memuat data: ${error.message}</p>`;
  }
}

async function handleAdminAction(e) {
  const button = e.target;
  const id = button.dataset.id;
  const type = button.dataset.type;
  const action = button.dataset.action;
  if (
    !confirm(
      `Apakah Anda yakin ingin mengubah status permintaan ini menjadi "${action}"?`
    )
  )
    return;
  button.disabled = true;
  button.textContent = "Memproses...";
  try {
    const endpoint = "/api/management";
    let actionPayload;
    let payload;

    if (type === "loan") {
      actionPayload = "updateLoanStatus";
      payload = { loanId: id, newStatus: action };
    } else if (type === "room") {
      actionPayload = "updateReservationStatus";
      payload = { reservationId: id, newStatus: action };
    } else if (type === "transport") {
      actionPayload = "updateTransportLoanStatus";
      payload = { loanId: id, newStatus: action };
    }

    await api.post(endpoint, { action: actionPayload, payload: payload });
    notifySuccess("Status permintaan berhasil diperbarui.");
    loadDashboardPage();
  } catch (error) {
    alert(`Gagal memperbarui: ${error.message}`);
    button.disabled = false;
    button.textContent = action;
  }
}

async function handleCancelRequest(e) {
  const button = e.target;
  const id = button.dataset.id;
  const type = button.dataset.type;
  if (!confirm("Apakah Anda yakin ingin membatalkan permintaan ini?"))
    return;
  button.disabled = true;
  button.textContent = "Memproses...";
  try {
    await api.post("/api/member?action=cancel", {
      requestId: id,
      requestType: type,
    });
    notifySuccess("Permintaan berhasil dibatalkan.");
    loadDashboardPage();
  } catch (error) {
    alert(`Gagal membatalkan: ${error.message}`);
    button.disabled = false;
    button.textContent = "Batalkan";
  }
}
