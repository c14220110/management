/**
 * Dashboard Page Module
 * Handles both manager and member dashboard views
 * Enhanced version with operational control center features
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

// ============================================================
// MANAGEMENT DASHBOARD - PUSAT KONTROL OPERASIONAL
// ============================================================
async function renderManagerDashboard() {
  const container = document.getElementById("manager-dashboard-content");
  container.innerHTML = `
    <h1 class="text-3xl font-bold text-gray-800 mb-6">Pusat Kontrol Operasional</h1>
    <div class="flex items-center gap-2 text-gray-500 mb-6">
      <i class="fas fa-sync-alt animate-spin"></i>
      <span>Memuat data dashboard...</span>
    </div>
  `;

  try {
    const data = await api.get("/api/dashboard?action=management-dashboard");

    const {
      stats,
      alerts,
      todayActivities,
      conditionSummary,
      pendingRequests,
    } = data;

    // Count total alerts
    const totalAlerts =
      (alerts.vehicleServiceAlerts?.length || 0) +
      (alerts.overdueItems?.length || 0);
    const totalPending =
      (pendingRequests.assetLoans?.length || 0) +
      (pendingRequests.roomReservations?.length || 0) +
      (pendingRequests.transportLoans?.length || 0);
    const totalTodayActivities =
      (todayActivities.rooms?.length || 0) +
      (todayActivities.transports?.length || 0);

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Header -->
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 class="text-3xl font-bold text-gray-800">Pusat Kontrol Operasional</h1>
            <p class="text-gray-500 mt-1">Dashboard real-time untuk monitoring gereja</p>
          </div>
          <div class="flex items-center gap-2 text-sm text-gray-500">
            <i class="fas fa-clock"></i>
            <span>Update: ${new Date().toLocaleString("id-ID")}</span>
          </div>
        </div>

        <!-- Alert Banner -->
        ${
          totalAlerts > 0
            ? `
          <div class="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
            <div class="flex items-center gap-3">
              <i class="fas fa-exclamation-triangle text-red-500 text-xl"></i>
              <div>
                <p class="font-semibold text-red-800">Perhatian! Ada ${totalAlerts} peringatan yang perlu ditindaklanjuti</p>
                <p class="text-sm text-red-600">
                  ${
                    alerts.vehicleServiceAlerts?.length
                      ? `${alerts.vehicleServiceAlerts.length} kendaraan perlu servis`
                      : ""
                  }
                  ${
                    alerts.vehicleServiceAlerts?.length &&
                    alerts.overdueItems?.length
                      ? " • "
                      : ""
                  }
                  ${
                    alerts.overdueItems?.length
                      ? `${alerts.overdueItems.length} barang terlambat dikembalikan`
                      : ""
                  }
                </p>
              </div>
            </div>
          </div>
        `
            : ""
        }

        <!-- Quick Stats Grid -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-500">Total Aset</p>
                <p class="text-2xl font-bold text-gray-800">${
                  stats.totalAssets
                }</p>
              </div>
              <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <i class="fas fa-boxes text-blue-500 text-xl"></i>
              </div>
            </div>
            <p class="text-xs text-gray-400 mt-2">${
              stats.borrowedAssets
            } dipinjam • ${stats.maintenanceAssets} perbaikan</p>
          </div>

          <div class="bg-white rounded-lg shadow-md p-4 border-l-4 border-green-500">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-500">Total Ruangan</p>
                <p class="text-2xl font-bold text-gray-800">${
                  stats.totalRooms
                }</p>
              </div>
              <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <i class="fas fa-building text-green-500 text-xl"></i>
              </div>
            </div>
            <p class="text-xs text-gray-400 mt-2">${
              stats.approvedReservations
            } reservasi aktif</p>
          </div>

          <div class="bg-white rounded-lg shadow-md p-4 border-l-4 border-amber-500">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-500">Kendaraan</p>
                <p class="text-2xl font-bold text-gray-800">${
                  stats.totalTransports
                }</p>
              </div>
              <div class="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <i class="fas fa-shuttle-van text-amber-500 text-xl"></i>
              </div>
            </div>
            <p class="text-xs text-gray-400 mt-2">${
              stats.activeTransportsToday
            } dipakai hari ini</p>
          </div>

          <div class="bg-white rounded-lg shadow-md p-4 border-l-4 border-purple-500">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-500">Menunggu Approval</p>
                <p class="text-2xl font-bold text-gray-800">${totalPending}</p>
              </div>
              <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <i class="fas fa-clock text-purple-500 text-xl"></i>
              </div>
            </div>
            <p class="text-xs text-gray-400 mt-2">Perlu persetujuan Anda</p>
          </div>
        </div>

        <!-- Main Content Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <!-- Left Column: Alerts & Condition -->
          <div class="space-y-6">
            
            <!-- Vehicle Service Alerts -->
            <div class="bg-white rounded-lg shadow-md overflow-hidden">
              <div class="bg-red-500 text-white px-4 py-3 flex items-center gap-2">
                <i class="fas fa-tools"></i>
                <h3 class="font-semibold">Peringatan Servis Kendaraan</h3>
              </div>
              <div class="p-4">
                ${
                  alerts.vehicleServiceAlerts?.length
                    ? `
                  <div class="space-y-3">
                    ${alerts.vehicleServiceAlerts
                      .map(
                        (v) => `
                      <div class="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                        <i class="fas fa-exclamation-circle text-red-500 mt-1"></i>
                        <div class="flex-1">
                          <p class="font-semibold text-gray-800">${
                            v.vehicle_name
                          }</p>
                          <p class="text-sm text-gray-500">${v.plate_number}</p>
                          <p class="text-xs text-red-600 mt-1">
                            <i class="fas fa-calendar-alt mr-1"></i>
                            Jadwal: ${new Date(
                              v.next_service_at
                            ).toLocaleDateString("id-ID")}
                          </p>
                          ${
                            v.odometer_km
                              ? `<p class="text-xs text-gray-400">Odometer: ${v.odometer_km.toLocaleString()} km</p>`
                              : ""
                          }
                        </div>
                      </div>
                    `
                      )
                      .join("")}
                  </div>
                `
                    : `
                  <div class="text-center py-6 text-gray-400">
                    <i class="fas fa-check-circle text-3xl text-green-400 mb-2"></i>
                    <p>Semua kendaraan dalam kondisi baik</p>
                  </div>
                `
                }
              </div>
            </div>

            <!-- Overdue Items -->
            <div class="bg-white rounded-lg shadow-md overflow-hidden">
              <div class="bg-amber-500 text-white px-4 py-3 flex items-center gap-2">
                <i class="fas fa-hourglass-end"></i>
                <h3 class="font-semibold">Barang Terlambat Dikembalikan</h3>
              </div>
              <div class="p-4">
                ${
                  alerts.overdueItems?.length
                    ? `
                  <div class="space-y-3">
                    ${alerts.overdueItems
                      .slice(0, 5)
                      .map(
                        (item) => `
                      <div class="flex items-start gap-3 p-3 bg-amber-50 rounded-lg">
                        <i class="fas fa-clock text-amber-500 mt-1"></i>
                        <div class="flex-1">
                          <p class="font-semibold text-gray-800">${
                            item.assets?.asset_name || "Barang"
                          }</p>
                          <p class="text-sm text-gray-600">Peminjam: ${
                            item.profiles?.full_name || "-"
                          }</p>
                          <p class="text-xs text-amber-600 mt-1">
                            <span class="font-bold">${
                              item.days_overdue
                            } hari</span> terlambat
                          </p>
                        </div>
                      </div>
                    `
                      )
                      .join("")}
                    ${
                      alerts.overdueItems.length > 5
                        ? `
                      <p class="text-center text-sm text-gray-500">... dan ${
                        alerts.overdueItems.length - 5
                      } lainnya</p>
                    `
                        : ""
                    }
                  </div>
                `
                    : `
                  <div class="text-center py-6 text-gray-400">
                    <i class="fas fa-thumbs-up text-3xl text-green-400 mb-2"></i>
                    <p>Tidak ada barang terlambat</p>
                  </div>
                `
                }
              </div>
            </div>

            <!-- Asset Condition Chart -->
            <div class="bg-white rounded-lg shadow-md overflow-hidden">
              <div class="bg-gray-700 text-white px-4 py-3 flex items-center gap-2">
                <i class="fas fa-chart-pie"></i>
                <h3 class="font-semibold">Kondisi Aset</h3>
              </div>
              <div class="p-4">
                ${renderConditionChart(conditionSummary)}
              </div>
            </div>
          </div>

          <!-- Middle Column: Today's Activities -->
          <div class="bg-white rounded-lg shadow-md overflow-hidden">
            <div class="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <i class="fas fa-calendar-day"></i>
                <h3 class="font-semibold">Kegiatan Hari Ini</h3>
              </div>
              <span class="bg-white/20 px-2 py-1 rounded text-sm">${totalTodayActivities} kegiatan</span>
            </div>
            <div class="p-4 max-h-[600px] overflow-y-auto">
              ${
                totalTodayActivities > 0
                  ? `
                <!-- Room Activities -->
                ${
                  todayActivities.rooms?.length
                    ? `
                  <div class="mb-4">
                    <h4 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      <i class="fas fa-door-open mr-2"></i>Ruangan Dipakai
                    </h4>
                    <div class="space-y-2">
                      ${todayActivities.rooms
                        .map((room) => {
                          const startTime = new Date(room.start_time);
                          const endTime = new Date(room.end_time);
                          const now = new Date();
                          const isOngoing = now >= startTime && now <= endTime;
                          return `
                          <div class="p-3 rounded-lg border ${
                            isOngoing
                              ? "border-green-300 bg-green-50"
                              : "border-gray-200"
                          }">
                            <div class="flex items-center justify-between">
                              <span class="font-semibold text-gray-800">${
                                room.room_name
                              }</span>
                              ${
                                isOngoing
                                  ? '<span class="text-xs bg-green-500 text-white px-2 py-1 rounded-full">Berlangsung</span>'
                                  : ""
                              }
                            </div>
                            <p class="text-sm text-gray-600">${
                              room.event_name
                            }</p>
                            <p class="text-xs text-gray-400 mt-1">
                              <i class="fas fa-user mr-1"></i>${
                                room.requester_name
                              } • 
                              ${startTime.toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })} - 
                              ${endTime.toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        `;
                        })
                        .join("")}
                    </div>
                  </div>
                `
                    : ""
                }

                <!-- Transport Activities -->
                ${
                  todayActivities.transports?.length
                    ? `
                  <div>
                    <h4 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      <i class="fas fa-car mr-2"></i>Kendaraan Keluar
                    </h4>
                    <div class="space-y-2">
                      ${todayActivities.transports
                        .map((trip) => {
                          const startTime = new Date(trip.borrow_start);
                          const endTime = new Date(trip.borrow_end);
                          const now = new Date();
                          const isOngoing = now >= startTime && now <= endTime;
                          return `
                          <div class="p-3 rounded-lg border ${
                            isOngoing
                              ? "border-blue-300 bg-blue-50"
                              : "border-gray-200"
                          }">
                            <div class="flex items-center justify-between">
                              <span class="font-semibold text-gray-800">${
                                trip.transportations?.vehicle_name ||
                                "Kendaraan"
                              }</span>
                              ${
                                isOngoing
                                  ? '<span class="text-xs bg-blue-500 text-white px-2 py-1 rounded-full">Di Jalan</span>'
                                  : ""
                              }
                            </div>
                            <p class="text-sm text-gray-500">${
                              trip.transportations?.plate_number || ""
                            }</p>
                            <p class="text-sm text-gray-600 mt-1">${
                              trip.purpose || "Tidak ada keterangan"
                            }</p>
                            ${
                              trip.origin || trip.destination
                                ? `
                              <p class="text-xs text-gray-400 mt-1">
                                <i class="fas fa-route mr-1"></i>${
                                  trip.origin || "?"
                                } → ${trip.destination || "?"}
                              </p>
                            `
                                : ""
                            }
                            <p class="text-xs text-gray-400 mt-1">
                              <i class="fas fa-user mr-1"></i>${
                                trip.profiles?.full_name || "-"
                              }
                              ${
                                trip.transportations?.driver_name
                                  ? ` • Sopir: ${trip.transportations.driver_name}`
                                  : ""
                              }
                            </p>
                            <p class="text-xs text-gray-400">
                              <i class="fas fa-clock mr-1"></i>
                              ${startTime.toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })} - 
                              ${endTime.toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        `;
                        })
                        .join("")}
                    </div>
                  </div>
                `
                    : ""
                }
              `
                  : `
                <div class="text-center py-12 text-gray-400">
                  <i class="fas fa-calendar-times text-4xl mb-3"></i>
                  <p>Tidak ada kegiatan terjadwal hari ini</p>
                </div>
              `
              }
            </div>
          </div>

          <!-- Right Column: Pending Approvals -->
          <div class="bg-white rounded-lg shadow-md overflow-hidden">
            <div class="bg-purple-600 text-white px-4 py-3 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <i class="fas fa-tasks"></i>
                <h3 class="font-semibold">Perlu Persetujuan</h3>
              </div>
              <span class="bg-white/20 px-2 py-1 rounded text-sm">${totalPending} permintaan</span>
            </div>
            <div class="p-4 max-h-[600px] overflow-y-auto">
              ${
                totalPending > 0
                  ? `
                <div class="space-y-3">
                  ${renderPendingItems(pendingRequests)}
                </div>
              `
                  : `
                <div class="text-center py-12 text-gray-400">
                  <i class="fas fa-inbox text-4xl mb-3"></i>
                  <p>Tidak ada permintaan menunggu</p>
                </div>
              `
              }
            </div>
          </div>
        </div>

        <!-- Unified Calendar Section -->
        <div class="bg-white rounded-lg shadow-md overflow-hidden">
          <div class="bg-gray-800 text-white px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div class="flex items-center gap-2">
              <i class="fas fa-calendar-alt"></i>
              <h3 class="font-semibold">Kalender Peminjaman & Reservasi</h3>
            </div>
            <div class="flex flex-wrap items-center gap-3 text-sm">
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-blue-500"></span>
                <span>Barang</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-green-500"></span>
                <span>Ruangan</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-purple-500"></span>
                <span>Kendaraan</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-amber-500"></span>
                <span>Menunggu</span>
              </div>
            </div>
          </div>
          <div class="p-4">
            <div id="dashboard-calendar" class="min-h-[400px]"></div>
          </div>
        </div>
      </div>
    `;

    // Bind event listeners for admin action buttons
    document
      .querySelectorAll(".admin-action-btn")
      .forEach((button) => button.addEventListener("click", handleAdminAction));

    // Initialize the unified calendar
    await initDashboardCalendar();
  } catch (error) {
    container.innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <i class="fas fa-exclamation-circle text-red-500 text-4xl mb-3"></i>
        <p class="text-red-800 font-semibold">Gagal memuat data dashboard</p>
        <p class="text-red-600 text-sm mt-1">${error.message}</p>
        <button onclick="loadDashboardPage()" class="mt-4 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600">
          <i class="fas fa-redo mr-2"></i>Coba Lagi
        </button>
      </div>
    `;
  }
}

// Helper function to render condition chart
function renderConditionChart(summary) {
  const total =
    summary.baik +
    summary.perluPerbaikan +
    summary.rusak +
    summary.tidakDiketahui;
  if (total === 0) {
    return `<p class="text-center text-gray-400 py-4">Tidak ada data kondisi</p>`;
  }

  const getPercentage = (val) => Math.round((val / total) * 100);

  return `
    <div class="space-y-4">
      <!-- Visual Bar -->
      <div class="h-8 rounded-full overflow-hidden flex">
        ${
          summary.baik > 0
            ? `<div class="bg-green-500 h-full" style="width: ${getPercentage(
                summary.baik
              )}%"></div>`
            : ""
        }
        ${
          summary.perluPerbaikan > 0
            ? `<div class="bg-yellow-500 h-full" style="width: ${getPercentage(
                summary.perluPerbaikan
              )}%"></div>`
            : ""
        }
        ${
          summary.rusak > 0
            ? `<div class="bg-red-500 h-full" style="width: ${getPercentage(
                summary.rusak
              )}%"></div>`
            : ""
        }
        ${
          summary.tidakDiketahui > 0
            ? `<div class="bg-gray-300 h-full" style="width: ${getPercentage(
                summary.tidakDiketahui
              )}%"></div>`
            : ""
        }
      </div>

      <!-- Legend -->
      <div class="grid grid-cols-2 gap-2 text-sm">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-green-500"></span>
          <span class="text-gray-600">Baik</span>
          <span class="ml-auto font-semibold">${summary.baik} (${getPercentage(
    summary.baik
  )}%)</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-yellow-500"></span>
          <span class="text-gray-600">Perlu Perbaikan</span>
          <span class="ml-auto font-semibold">${summary.perluPerbaikan}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-red-500"></span>
          <span class="text-gray-600">Rusak</span>
          <span class="ml-auto font-semibold">${summary.rusak}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-gray-300"></span>
          <span class="text-gray-600">Tidak Diketahui</span>
          <span class="ml-auto font-semibold">${summary.tidakDiketahui}</span>
        </div>
      </div>

      ${
        summary.rusak > 0 || summary.perluPerbaikan > 0
          ? `
        <div class="text-xs text-amber-600 bg-amber-50 p-2 rounded">
          <i class="fas fa-info-circle mr-1"></i>
          ${summary.rusak + summary.perluPerbaikan} aset membutuhkan perhatian
        </div>
      `
          : ""
      }
    </div>
  `;
}

// Helper function to render pending items
function renderPendingItems(pendingRequests) {
  const items = [];

  // Asset loans
  (pendingRequests.assetLoans || []).forEach((item) => {
    items.push({
      type: "loan",
      id: item.id,
      icon: "fas fa-box",
      iconBg: "bg-blue-100 text-blue-600",
      title: item.assets?.asset_name || "Barang",
      subtitle: `Oleh: ${item.profiles?.full_name || "-"}`,
      time: new Date(item.loan_date).toLocaleDateString("id-ID"),
      dueInfo: `Sampai: ${new Date(item.due_date).toLocaleDateString("id-ID")}`,
    });
  });

  // Room reservations
  (pendingRequests.roomReservations || []).forEach((item) => {
    items.push({
      type: "room",
      id: item.id,
      icon: "fas fa-door-open",
      iconBg: "bg-green-100 text-green-600",
      title: `${item.event_name}`,
      subtitle: `Ruangan: ${item.room_name} • ${item.requester_name}`,
      time: new Date(item.start_time).toLocaleString("id-ID"),
      dueInfo: "",
    });
  });

  // Transport loans
  (pendingRequests.transportLoans || []).forEach((item) => {
    items.push({
      type: "transport",
      id: item.id,
      icon: "fas fa-shuttle-van",
      iconBg: "bg-amber-100 text-amber-600",
      title: item.transportations?.vehicle_name || "Kendaraan",
      subtitle: `${item.transportations?.plate_number || ""} • ${
        item.profiles?.full_name || "-"
      }`,
      time: new Date(item.borrow_start).toLocaleString("id-ID"),
      dueInfo: item.purpose || "",
    });
  });

  if (items.length === 0) return "";

  return items
    .map(
      (item) => `
    <div class="p-3 border rounded-lg hover:bg-gray-50 transition">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-full ${
          item.iconBg
        } flex items-center justify-center flex-shrink-0">
          <i class="${item.icon}"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-gray-800 truncate">${item.title}</p>
          <p class="text-sm text-gray-500 truncate">${item.subtitle}</p>
          <p class="text-xs text-gray-400 mt-1">
            <i class="fas fa-clock mr-1"></i>${item.time}
          </p>
          ${
            item.dueInfo
              ? `<p class="text-xs text-gray-400">${item.dueInfo}</p>`
              : ""
          }
        </div>
      </div>
      <div class="flex gap-2 mt-3">
        <button 
          data-id="${item.id}" 
          data-type="${item.type}" 
          data-action="Disetujui" 
          class="admin-action-btn flex-1 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold py-2 px-3 rounded-md transition">
          <i class="fas fa-check mr-1"></i>Setujui
        </button>
        <button 
          data-id="${item.id}" 
          data-type="${item.type}" 
          data-action="Ditolak" 
          class="admin-action-btn flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2 px-3 rounded-md transition">
          <i class="fas fa-times mr-1"></i>Tolak
        </button>
      </div>
    </div>
  `
    )
    .join("");
}

// ============================================================
// MEMBER DASHBOARD - STATUS TRACKING & QUICK INFO
// ============================================================
async function renderMemberDashboard() {
  const container = document.getElementById("member-dashboard-content");
  container.innerHTML = `
    <h1 class="text-3xl font-bold text-gray-800 mb-6">Dashboard Saya</h1>
    <div class="flex items-center gap-2 text-gray-500">
      <i class="fas fa-sync-alt animate-spin"></i>
      <span>Memuat data...</span>
    </div>
  `;

  try {
    const data = await api.get("/api/dashboard?action=member-dashboard");

    const { dueReminders, requests, availability, upcoming } = data;

    const userName = localStorage.getItem("userFullName") || "Member";
    const totalUpcoming =
      (upcoming.rooms?.length || 0) + (upcoming.transports?.length || 0);
    const availableRooms =
      availability.rooms?.filter((r) => r.isAvailable).length || 0;
    const availableTransports =
      availability.transports?.filter((t) => t.isAvailable).length || 0;

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Header -->
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 class="text-3xl font-bold text-gray-800">Halo, ${userName}!</h1>
            <p class="text-gray-500 mt-1">Selamat datang di dashboard Anda</p>
          </div>
          <div class="flex items-center gap-2 text-sm text-gray-500">
            <i class="fas fa-clock"></i>
            <span>${new Date().toLocaleDateString("id-ID", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}</span>
          </div>
        </div>

        <!-- Due Reminder Banner -->
        ${
          dueReminders?.length > 0
            ? `
          <div class="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
            <div class="flex items-start gap-3">
              <i class="fas fa-bell text-amber-500 text-xl mt-1"></i>
              <div class="flex-1">
                <p class="font-semibold text-amber-800">Pengingat Pengembalian Barang</p>
                <div class="mt-2 space-y-2">
                  ${dueReminders
                    .map((loan) => {
                      const urgencyClass =
                        loan.urgency === "today"
                          ? "bg-red-100 text-red-700 border-red-200"
                          : "bg-amber-100 text-amber-700 border-amber-200";
                      const urgencyText =
                        loan.urgency === "today" ? "Hari Ini!" : "Besok";
                      return `
                      <div class="flex items-center justify-between p-2 rounded border ${urgencyClass}">
                        <div class="flex items-center gap-2">
                          <i class="fas fa-box"></i>
                          <span class="font-medium">${
                            loan.assets?.asset_name || "Barang"
                          }</span>
                        </div>
                        <span class="text-sm font-bold">${urgencyText}</span>
                      </div>
                    `;
                    })
                    .join("")}
                </div>
              </div>
            </div>
          </div>
        `
            : ""
        }

        <!-- Quick Stats -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-white rounded-lg shadow-md p-4 text-center">
            <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <i class="fas fa-calendar-check text-blue-500 text-xl"></i>
            </div>
            <p class="text-2xl font-bold text-gray-800">${totalUpcoming}</p>
            <p class="text-sm text-gray-500">Kegiatan Mendatang</p>
          </div>
          <div class="bg-white rounded-lg shadow-md p-4 text-center">
            <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <i class="fas fa-door-open text-green-500 text-xl"></i>
            </div>
            <p class="text-2xl font-bold text-gray-800">${availableRooms}/${
      availability.rooms?.length || 0
    }</p>
            <p class="text-sm text-gray-500">Ruangan Tersedia</p>
          </div>
          <div class="bg-white rounded-lg shadow-md p-4 text-center">
            <div class="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <i class="fas fa-shuttle-van text-amber-500 text-xl"></i>
            </div>
            <p class="text-2xl font-bold text-gray-800">${availableTransports}/${
      availability.transports?.length || 0
    }</p>
            <p class="text-sm text-gray-500">Kendaraan Tersedia</p>
          </div>
          <div class="bg-white rounded-lg shadow-md p-4 text-center">
            <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <i class="fas fa-history text-purple-500 text-xl"></i>
            </div>
            <p class="text-2xl font-bold text-gray-800">${
              (requests.assetLoans?.length || 0) +
              (requests.roomReservations?.length || 0) +
              (requests.transportLoans?.length || 0)
            }</p>
            <p class="text-sm text-gray-500">Total Permintaan</p>
          </div>
        </div>

        <!-- Main Content Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <!-- Left Column: Quick Availability -->
          <div class="space-y-6">
            <!-- Room Availability -->
            <div class="bg-white rounded-lg shadow-md overflow-hidden">
              <div class="bg-green-600 text-white px-4 py-3 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <i class="fas fa-door-open"></i>
                  <h3 class="font-semibold">Ketersediaan Ruangan</h3>
                </div>
                <span class="text-xs bg-white/20 px-2 py-1 rounded">Saat ini</span>
              </div>
              <div class="p-4">
                <div class="grid grid-cols-2 gap-2">
                  ${
                    availability.rooms?.length
                      ? availability.rooms
                          .map(
                            (room) => `
                    <div class="p-3 rounded-lg border ${
                      room.isAvailable
                        ? "border-green-200 bg-green-50"
                        : "border-red-200 bg-red-50"
                    }">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="w-2 h-2 rounded-full ${
                          room.isAvailable ? "bg-green-500" : "bg-red-500"
                        }"></span>
                        <span class="font-medium text-sm text-gray-800 truncate">${
                          room.name
                        }</span>
                      </div>
                      <p class="text-xs ${
                        room.isAvailable ? "text-green-600" : "text-red-600"
                      }">
                        ${room.isAvailable ? "Tersedia" : "Sedang Dipakai"}
                      </p>
                    </div>
                  `
                          )
                          .join("")
                      : '<p class="text-gray-400 col-span-2 text-center py-4">Tidak ada data ruangan</p>'
                  }
                </div>
                <a href="#ruangan" class="block mt-4 text-center text-sm text-green-600 hover:underline">
                  <i class="fas fa-plus mr-1"></i>Reservasi Ruangan
                </a>
              </div>
            </div>

            <!-- Transport Availability -->
            <div class="bg-white rounded-lg shadow-md overflow-hidden">
              <div class="bg-amber-600 text-white px-4 py-3 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <i class="fas fa-shuttle-van"></i>
                  <h3 class="font-semibold">Ketersediaan Kendaraan</h3>
                </div>
                <span class="text-xs bg-white/20 px-2 py-1 rounded">Saat ini</span>
              </div>
              <div class="p-4">
                <div class="space-y-2">
                  ${
                    availability.transports?.length
                      ? availability.transports
                          .map(
                            (transport) => `
                    <div class="flex items-center justify-between p-3 rounded-lg border ${
                      transport.isAvailable
                        ? "border-green-200 bg-green-50"
                        : "border-red-200 bg-red-50"
                    }">
                      <div>
                        <p class="font-medium text-gray-800">${
                          transport.vehicle_name
                        }</p>
                        <p class="text-xs text-gray-500">${
                          transport.plate_number
                        } • ${transport.capacity} orang</p>
                      </div>
                      <span class="w-3 h-3 rounded-full ${
                        transport.isAvailable ? "bg-green-500" : "bg-red-500"
                      }"></span>
                    </div>
                  `
                          )
                          .join("")
                      : '<p class="text-gray-400 text-center py-4">Tidak ada data kendaraan</p>'
                  }
                </div>
                <a href="#transportasi" class="block mt-4 text-center text-sm text-amber-600 hover:underline">
                  <i class="fas fa-plus mr-1"></i>Pinjam Kendaraan
                </a>
              </div>
            </div>
          </div>

          <!-- Middle Column: Upcoming Activities -->
          <div class="bg-white rounded-lg shadow-md overflow-hidden">
            <div class="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <i class="fas fa-calendar-alt"></i>
                <h3 class="font-semibold">Kegiatan Mendatang</h3>
              </div>
              <span class="text-xs bg-white/20 px-2 py-1 rounded">7 hari</span>
            </div>
            <div class="p-4 max-h-[500px] overflow-y-auto">
              ${
                totalUpcoming > 0
                  ? `
                <div class="space-y-3">
                  ${
                    upcoming.rooms
                      ?.map(
                        (room) => `
                    <div class="p-3 border rounded-lg border-green-200 bg-green-50">
                      <div class="flex items-center gap-2 mb-1">
                        <i class="fas fa-door-open text-green-600"></i>
                        <span class="font-semibold text-gray-800">${
                          room.event_name
                        }</span>
                      </div>
                      <p class="text-sm text-gray-600">Ruangan: ${
                        room.room_name
                      }</p>
                      <p class="text-xs text-gray-500 mt-1">
                        <i class="fas fa-clock mr-1"></i>
                        ${new Date(room.start_time).toLocaleString("id-ID", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  `
                      )
                      .join("") || ""
                  }
                  ${
                    upcoming.transports
                      ?.map(
                        (trip) => `
                    <div class="p-3 border rounded-lg border-amber-200 bg-amber-50">
                      <div class="flex items-center gap-2 mb-1">
                        <i class="fas fa-shuttle-van text-amber-600"></i>
                        <span class="font-semibold text-gray-800">${
                          trip.transportations?.vehicle_name || "Kendaraan"
                        }</span>
                      </div>
                      <p class="text-sm text-gray-600">${
                        trip.transportations?.plate_number || ""
                      }</p>
                      <p class="text-xs text-gray-500 mt-1">
                        <i class="fas fa-clock mr-1"></i>
                        ${new Date(trip.borrow_start).toLocaleString("id-ID", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  `
                      )
                      .join("") || ""
                  }
                </div>
              `
                  : `
                <div class="text-center py-12 text-gray-400">
                  <i class="fas fa-calendar-times text-4xl mb-3"></i>
                  <p>Tidak ada kegiatan dalam 7 hari ke depan</p>
                  <div class="mt-4 space-y-2">
                    <a href="#ruangan" class="block text-sm text-blue-600 hover:underline">
                      <i class="fas fa-plus mr-1"></i>Reservasi Ruangan
                    </a>
                    <a href="#transportasi" class="block text-sm text-amber-600 hover:underline">
                      <i class="fas fa-plus mr-1"></i>Pinjam Kendaraan
                    </a>
                    <a href="#barang" class="block text-sm text-green-600 hover:underline">
                      <i class="fas fa-plus mr-1"></i>Pinjam Barang
                    </a>
                  </div>
                </div>
              `
              }
            </div>
          </div>

          <!-- Right Column: Request History -->
          <div class="bg-white rounded-lg shadow-md overflow-hidden">
            <div class="bg-purple-600 text-white px-4 py-3 flex items-center gap-2">
              <i class="fas fa-history"></i>
              <h3 class="font-semibold">Riwayat Permintaan</h3>
            </div>
            <div class="p-4 max-h-[500px] overflow-y-auto">
              <!-- Tabs -->
              <div class="flex border-b mb-4">
                <button class="member-tab-btn flex-1 py-2 text-sm font-medium border-b-2 border-purple-500 text-purple-600" data-tab="assets">
                  Barang
                </button>
                <button class="member-tab-btn flex-1 py-2 text-sm font-medium text-gray-500 hover:text-gray-700" data-tab="rooms">
                  Ruangan
                </button>
                <button class="member-tab-btn flex-1 py-2 text-sm font-medium text-gray-500 hover:text-gray-700" data-tab="transports">
                  Kendaraan
                </button>
              </div>

              <!-- Tab Contents -->
              <div id="member-tab-content">
                ${renderMemberRequestTab(requests, "assets")}
              </div>
            </div>
          </div>
        </div>

        <!-- Unified Calendar Section -->
        <div class="bg-white rounded-lg shadow-md overflow-hidden">
          <div class="bg-gray-800 text-white px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div class="flex items-center gap-2">
              <i class="fas fa-calendar-alt"></i>
              <h3 class="font-semibold">Kalender Peminjaman Saya</h3>
            </div>
            <div class="flex flex-wrap items-center gap-3 text-sm">
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-blue-500"></span>
                <span>Barang</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-green-500"></span>
                <span>Ruangan</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-purple-500"></span>
                <span>Kendaraan</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full bg-amber-500"></span>
                <span>Menunggu</span>
              </div>
            </div>
          </div>
          <div class="p-4">
            <div id="dashboard-calendar" class="min-h-[400px]"></div>
          </div>
        </div>
      </div>
    `;

    // Bind tab switching
    document.querySelectorAll(".member-tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tab = e.target.dataset.tab;

        // Update active tab styling
        document.querySelectorAll(".member-tab-btn").forEach((b) => {
          b.classList.remove(
            "border-b-2",
            "border-purple-500",
            "text-purple-600"
          );
          b.classList.add("text-gray-500");
        });
        e.target.classList.add(
          "border-b-2",
          "border-purple-500",
          "text-purple-600"
        );
        e.target.classList.remove("text-gray-500");

        // Update content
        document.getElementById("member-tab-content").innerHTML =
          renderMemberRequestTab(requests, tab);

        // Re-bind cancel buttons
        document
          .querySelectorAll(".cancel-btn")
          .forEach((btn) => btn.addEventListener("click", handleCancelRequest));
      });
    });

    // Bind cancel buttons
    document
      .querySelectorAll(".cancel-btn")
      .forEach((btn) => btn.addEventListener("click", handleCancelRequest));

    // Initialize the unified calendar
    await initDashboardCalendar();
  } catch (error) {
    container.innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <i class="fas fa-exclamation-circle text-red-500 text-4xl mb-3"></i>
        <p class="text-red-800 font-semibold">Gagal memuat data dashboard</p>
        <p class="text-red-600 text-sm mt-1">${error.message}</p>
        <button onclick="loadDashboardPage()" class="mt-4 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600">
          <i class="fas fa-redo mr-2"></i>Coba Lagi
        </button>
      </div>
    `;
  }
}

// Helper function to render member request tabs
function renderMemberRequestTab(requests, activeTab) {
  const getStatusBadge = (status) => {
    const badges = {
      Disetujui: "bg-green-100 text-green-700",
      Ditolak: "bg-red-100 text-red-700",
      "Menunggu Persetujuan": "bg-yellow-100 text-yellow-700",
    };
    return badges[status] || "bg-gray-100 text-gray-700";
  };

  if (activeTab === "assets") {
    const items = requests.assetLoans || [];
    if (items.length === 0) {
      return `<p class="text-gray-400 text-center py-8">Belum ada riwayat peminjaman barang</p>`;
    }
    return `
      <div class="space-y-2">
        ${items
          .map(
            (item) => `
          <div class="p-3 border rounded-lg">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <p class="font-semibold text-gray-800">${
                  item.assets?.asset_name || "Barang"
                }</p>
                <p class="text-xs text-gray-500 mt-1">
                  <i class="fas fa-calendar mr-1"></i>
                  ${new Date(item.loan_date).toLocaleDateString("id-ID")}
                </p>
              </div>
              <span class="text-xs px-2 py-1 rounded-full ${getStatusBadge(
                item.status
              )}">${item.status}</span>
            </div>
            ${
              item.status === "Menunggu Persetujuan"
                ? `
              <button data-id="${item.id}" data-type="asset" class="cancel-btn mt-2 w-full text-sm text-gray-500 hover:text-red-600 py-1 border rounded hover:bg-red-50 transition">
                <i class="fas fa-times mr-1"></i>Batalkan
              </button>
            `
                : ""
            }
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  if (activeTab === "rooms") {
    const items = requests.roomReservations || [];
    if (items.length === 0) {
      return `<p class="text-gray-400 text-center py-8">Belum ada riwayat reservasi ruangan</p>`;
    }
    return `
      <div class="space-y-2">
        ${items
          .map(
            (item) => `
          <div class="p-3 border rounded-lg">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <p class="font-semibold text-gray-800">${item.event_name}</p>
                <p class="text-sm text-gray-600">${item.room_name}</p>
                <p class="text-xs text-gray-500 mt-1">
                  <i class="fas fa-calendar mr-1"></i>
                  ${new Date(item.start_time).toLocaleString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <span class="text-xs px-2 py-1 rounded-full ${getStatusBadge(
                item.status
              )}">${item.status}</span>
            </div>
            ${
              item.status === "Menunggu Persetujuan"
                ? `
              <button data-id="${item.id}" data-type="room" class="cancel-btn mt-2 w-full text-sm text-gray-500 hover:text-red-600 py-1 border rounded hover:bg-red-50 transition">
                <i class="fas fa-times mr-1"></i>Batalkan
              </button>
            `
                : ""
            }
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  if (activeTab === "transports") {
    const items = requests.transportLoans || [];
    if (items.length === 0) {
      return `<p class="text-gray-400 text-center py-8">Belum ada riwayat peminjaman kendaraan</p>`;
    }
    return `
      <div class="space-y-2">
        ${items
          .map(
            (item) => `
          <div class="p-3 border rounded-lg">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <p class="font-semibold text-gray-800">${
                  item.transportations?.vehicle_name || "Kendaraan"
                }</p>
                <p class="text-sm text-gray-600">${
                  item.transportations?.plate_number || ""
                }</p>
                <p class="text-xs text-gray-500 mt-1">
                  <i class="fas fa-calendar mr-1"></i>
                  ${new Date(item.borrow_start).toLocaleString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <span class="text-xs px-2 py-1 rounded-full ${getStatusBadge(
                item.status
              )}">${item.status}</span>
            </div>
            ${
              item.status === "Menunggu Persetujuan"
                ? `
              <button data-id="${item.id}" data-type="transport" class="cancel-btn mt-2 w-full text-sm text-gray-500 hover:text-red-600 py-1 border rounded hover:bg-red-50 transition">
                <i class="fas fa-times mr-1"></i>Batalkan
              </button>
            `
                : ""
            }
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  return "";
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
  if (!confirm("Apakah Anda yakin ingin membatalkan permintaan ini?")) return;
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

// ============================================================
// UNIFIED DASHBOARD CALENDAR
// ============================================================
let dashboardCalendarInstance = null;

async function initDashboardCalendar() {
  const calendarEl = document.getElementById("dashboard-calendar");
  if (!calendarEl) return;

  // Destroy previous instance if exists
  if (dashboardCalendarInstance) {
    dashboardCalendarInstance.destroy();
    dashboardCalendarInstance = null;
  }

  // Show loading state
  calendarEl.innerHTML = `
    <div class="flex items-center justify-center py-12 text-gray-400">
      <i class="fas fa-sync-alt animate-spin mr-2"></i>
      <span>Memuat kalender...</span>
    </div>
  `;

  try {
    // Fetch calendar data
    const calendarData = await api.get("/api/dashboard?action=calendar");
    const events = calendarData.events || [];

    // Debug logging
    console.log("Calendar data received:", {
      eventCount: events.length,
      events: events,
      meta: calendarData.meta,
    });

    // Clear loading state
    calendarEl.innerHTML = "";

    // Determine initial view based on viewport
    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    // Create calendar
    dashboardCalendarInstance = new FullCalendar.Calendar(calendarEl, {
      locale: "id",
      initialView: isMobile ? "listWeek" : "dayGridMonth",
      headerToolbar: isMobile
        ? {
            left: "prev,next",
            center: "title",
            right: "listWeek,timeGridDay",
          }
        : {
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,listWeek",
          },
      height: isMobile ? "auto" : 500,
      events: events.map((event) => {
        // Ensure end date is valid (if same as start, add 1 day)
        let endDate = event.end;
        if (!endDate || endDate === event.start) {
          const start = new Date(event.start);
          start.setDate(start.getDate() + 1);
          endDate = start.toISOString();
        }

        return {
          ...event,
          // Ensure all required fields are present
          start: event.start,
          end: endDate,
          title: event.title || "Event",
          backgroundColor: event.backgroundColor || "#3b82f6",
          borderColor: event.borderColor || "#2563eb",
          textColor: event.textColor || "#ffffff",
        };
      }),
      eventDisplay: "block",
      displayEventTime: true,
      eventTimeFormat: {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      },
      dayMaxEvents: 3,
      moreLinkText: (num) => `+${num} lainnya`,
      noEventsText: "Tidak ada jadwal",
      eventClassNames: function (info) {
        // Add custom class based on type
        const type = info.event.extendedProps?.type;
        const classes = [`calendar-event-${type || "default"}`];
        if (type) {
          classes.push(`fc-event-${type}`);
        }
        return classes;
      },
      buttonText: {
        today: "Hari Ini",
        month: "Bulan",
        week: "Minggu",
        day: "Hari",
        list: "Daftar",
      },
      // Handle date range changes to fetch new data
      datesSet: async function (dateInfo) {
        // Fetch data for new date range
        const start = encodeURIComponent(dateInfo.startStr);
        const end = encodeURIComponent(dateInfo.endStr);
        try {
          const newData = await api.get(
            `/api/dashboard?action=calendar&start=${start}&end=${end}`
          );
          dashboardCalendarInstance.removeAllEvents();
          dashboardCalendarInstance.addEventSource(newData.events || []);
        } catch (err) {
          console.warn("Failed to refresh calendar events:", err);
        }
      },
      // Event click handler
      eventClick: function (info) {
        const props = info.event.extendedProps;
        let message = "";

        if (props.type === "asset") {
          message = `📦 Peminjaman Barang\n\n`;
          message += `Barang: ${props.assetName || "-"}\n`;
          message += `Kode: ${props.assetCode || "-"}\n`;
          message += `Peminjam: ${props.borrower || "-"}\n`;
          message += `Status: ${props.status}`;
        } else if (props.type === "room") {
          message = `🏠 Reservasi Ruangan\n\n`;
          message += `Ruangan: ${props.roomName || "-"}\n`;
          message += `Kegiatan: ${props.eventName || "-"}\n`;
          message += `Pemohon: ${props.requester || "-"}\n`;
          message += `Status: ${props.status}`;
        } else if (props.type === "transport") {
          message = `🚐 Peminjaman Kendaraan\n\n`;
          message += `Kendaraan: ${props.vehicleName || "-"}\n`;
          message += `Plat: ${props.plateNumber || "-"}\n`;
          message += `Keperluan: ${props.purpose || "-"}\n`;
          if (props.origin || props.destination) {
            message += `Rute: ${props.origin || "?"} → ${
              props.destination || "?"
            }\n`;
          }
          message += `Peminjam: ${props.borrower || "-"}\n`;
          message += `Status: ${props.status}`;
        }

        alert(message);
      },
      // Custom event rendering
      eventDidMount: function (info) {
        const props = info.event.extendedProps;

        // Add tooltip
        info.el.setAttribute("title", getEventTooltip(props));

        // Add type indicator icon to event
        const icon = getTypeIcon(props.type);
        if (icon && info.el.querySelector(".fc-event-title")) {
          // Icon is already in title from backend
        }
      },
    });

    dashboardCalendarInstance.render();

    // Log after render to verify events are displayed
    setTimeout(() => {
      const renderedEvents = dashboardCalendarInstance.getEvents();
      console.log("Calendar rendered with events:", {
        count: renderedEvents.length,
        events: renderedEvents.map((e) => ({
          id: e.id,
          title: e.title,
          start: e.startStr,
          end: e.endStr,
          type: e.extendedProps?.type,
        })),
      });
    }, 500);

    // Handle window resize
    window.addEventListener("resize", handleCalendarResize);
  } catch (error) {
    calendarEl.innerHTML = `
      <div class="text-center py-12 text-red-500">
        <i class="fas fa-exclamation-circle text-3xl mb-2"></i>
        <p>Gagal memuat kalender: ${error.message}</p>
        <button onclick="initDashboardCalendar()" class="mt-2 text-sm text-blue-600 hover:underline">
          Coba lagi
        </button>
      </div>
    `;
  }
}

function getTypeIcon(type) {
  switch (type) {
    case "asset":
      return "📦";
    case "room":
      return "🏠";
    case "transport":
      return "🚐";
    default:
      return "📅";
  }
}

function getEventTooltip(props) {
  if (props.type === "asset") {
    return `Barang: ${props.assetName}\nPeminjam: ${props.borrower}\nStatus: ${props.status}`;
  } else if (props.type === "room") {
    return `Ruangan: ${props.roomName}\nKegiatan: ${props.eventName}\nStatus: ${props.status}`;
  } else if (props.type === "transport") {
    return `Kendaraan: ${props.vehicleName}\nKeperluan: ${props.purpose}\nStatus: ${props.status}`;
  }
  return "";
}

let calendarResizeTimeout = null;
function handleCalendarResize() {
  if (calendarResizeTimeout) {
    clearTimeout(calendarResizeTimeout);
  }
  calendarResizeTimeout = setTimeout(() => {
    if (dashboardCalendarInstance) {
      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      const currentView = dashboardCalendarInstance.view.type;

      // Switch view based on viewport
      if (isMobile && currentView === "dayGridMonth") {
        dashboardCalendarInstance.changeView("listWeek");
      } else if (!isMobile && currentView === "listWeek") {
        dashboardCalendarInstance.changeView("dayGridMonth");
      }

      dashboardCalendarInstance.updateSize();
    }
  }, 250);
}
