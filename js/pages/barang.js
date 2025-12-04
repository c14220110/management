/**
 * Barang (Assets) Page Module
 * Handles asset listing, detail views, and borrowing
 */

// Global variable for FullCalendar
let fullCalendarInstance;

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
  const container = document.getElementById("barang-content-area");
  try {
    const assets = await api.get("/api/assets");
    let cardsHTML =
      '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">';
    assets.forEach((asset) => {
      cardsHTML += `<div data-id="${
        asset.id
      }" class="asset-card bg-white p-4 rounded-lg shadow-md cursor-pointer hover:shadow-xl transition-shadow">
              <img src="${
                asset.photo_url ||
                "https://placehold.co/600x400/EEE/31343C?text=Aset"
              }" class="w-full h-40 object-cover rounded-md mb-3">
              <h3 class="font-bold text-lg">${asset.asset_name}</h3>
              <p class="text-sm text-gray-500">${asset.location}</p>
          </div>`;
    });
    cardsHTML += "</div>";
    container.innerHTML = cardsHTML;
    document.querySelectorAll(".asset-card").forEach((card) => {
      card.addEventListener("click", () => {
        const assetId = card.dataset.id;
        renderBarangDetailView(assetId);
      });
    });
  } catch (error) {
    container.innerHTML = `<p class="text-red-500">Gagal memuat barang: ${error.message}</p>`;
  }
}

async function renderBarangDetailView(assetId) {
  const container = document.getElementById("barang-content-area");
  container.innerHTML = `<p>Memuat detail dan jadwal untuk aset...</p>`;
  try {
    const [assets, schedule] = await Promise.all([
      api.get("/api/assets"),
      api.get(`/api/assets/${assetId}/schedule`),
    ]);
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) {
      container.innerHTML =
        '<p class="text-red-500">Aset tidak ditemukan.</p>';
      return;
    }
    const calendarEvents = schedule.map((loan) => ({
      title: `Dipinjam oleh ${loan.profiles.full_name}`,
      start: loan.loan_date,
      end: loan.due_date,
      allDay: !(
        new Date(loan.due_date).getTime() -
          new Date(loan.loan_date).getTime() <
        86400000
      ),
    }));
    container.innerHTML = `<div class="bg-white p-6 rounded-lg shadow-md">
          <button id="back-to-list-btn" class="mb-4 text-amber-600 hover:underline"><i class="fas fa-arrow-left mr-2"></i>Kembali ke Daftar</button>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div class="md:col-span-1">
                  <img src="${
                    asset.photo_url ||
                    "https://placehold.co/600x400/EEE/31343C?text=Aset"
                  }" class="w-full h-auto object-cover rounded-lg shadow-md">
                  <h2 class="text-2xl font-bold mt-4">${
                    asset.asset_name
                  }</h2>
                  <p class="text-gray-600">${
                    asset.description || "Tidak ada deskripsi."
                  }</p>
                  <p class="mt-2"><i class="fas fa-map-marker-alt w-5"></i> ${
                    asset.location
                  }</p>
                  <div id="borrow-section-container" class="mt-6"></div>
              </div>
              <div class="md:col-span-2">
                  <h3 class="text-xl font-semibold mb-2">Kalender Peminjaman</h3>
                  <div id="detail-calendar" class="w-full h-full"></div>
              </div>
          </div>
      </div>`;
    const calendarEl = document.getElementById("detail-calendar");
    if (fullCalendarInstance) fullCalendarInstance.destroy();
    fullCalendarInstance = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek",
      },
      locale: "id",
      events: calendarEvents,
      eventDidMount: function (info) {
        info.el.title = info.event.title;
      },
    });
    fullCalendarInstance.render();
    document
      .getElementById("back-to-list-btn")
      .addEventListener("click", renderBarangListView);
    const borrowContainer = document.getElementById(
      "borrow-section-container"
    );
    if (localStorage.getItem("userRole") === "member") {
      borrowContainer.innerHTML = `<button id="show-borrow-form-btn" class="w-full bg-[#d97706] text-white font-bold py-2 px-4 rounded-md hover:bg-[#b45309]">Pinjam Barang Ini</button>
          <form id="detail-borrow-form" class="hidden mt-4 space-y-4">
              <div><label for="loan_date" class="block text-sm font-medium text-gray-700">Waktu Pinjam</label><input type="datetime-local" id="loan_date" required class="w-full p-2 border border-gray-300 rounded-md"></div>
              <div><label for="due_date" class="block text-sm font-medium text-gray-700">Waktu Kembali</label><input type="datetime-local" id="due_date" required class="w-full p-2 border border-gray-300 rounded-md"></div>
              <button type="submit" class="w-full bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700">Kirim Permintaan</button>
              <p id="detail-borrow-feedback" class="text-center font-semibold"></p>
          </form>`;
      const showFormBtn = document.getElementById("show-borrow-form-btn");
      const detailBorrowForm =
        document.getElementById("detail-borrow-form");
      showFormBtn.addEventListener("click", () => {
        detailBorrowForm.classList.remove("hidden");
        showFormBtn.classList.add("hidden");
      });
      detailBorrowForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const feedback = document.getElementById(
          "detail-borrow-feedback"
        );
        feedback.textContent = "Mengirim...";
        feedback.className = "text-center font-semibold text-amber-600";
        try {
          await api.post("/api/assets", {
            asset_id: assetId,
            loan_date: document.getElementById("loan_date").value,
            due_date: document.getElementById("due_date").value,
          });
          feedback.textContent = "Permintaan berhasil dikirim!";
          feedback.className = "text-center font-semibold text-green-600";
          detailBorrowForm.reset();
          renderBarangDetailView(assetId);
        } catch (error) {
          feedback.textContent = `Gagal: ${error.message}`;
          feedback.className = "text-center font-semibold text-red-600";
        }
      });
    }
  } catch (error) {
    container.innerHTML = `<p class="text-red-500">Gagal memuat detail barang: ${error.message}</p>`;
  }
}
