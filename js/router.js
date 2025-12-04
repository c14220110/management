/**
 * Router Module
 * Handles SPA hash-based navigation
 */

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebar-overlay");
  sidebar.classList.toggle("-translate-x-full");
  sidebarOverlay.classList.toggle("hidden");
}

function router() {
  const contentArea = document.getElementById("content-area");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebar-overlay");
  const managementLink = document.getElementById("management-link");
  
  updateUserGreeting();
  
  if (window.innerWidth < 768) {
    sidebar.classList.add("-translate-x-full");
    sidebarOverlay.classList.add("hidden");
  }
  
  let hash = window.location.hash;
  if (!hash) {
    if (localStorage.getItem("authToken")) {
      hash = "#dashboard";
      window.location.hash = "#dashboard";
    } else {
      return;
    }
  }

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle(
      "bg-gray-700",
      link.getAttribute("href") === hash
    );
  });

  contentArea.innerHTML = "";
  switch (hash) {
    case "#dashboard":
      loadDashboardPage();
      break;
    case "#barang":
      loadBarangPage();
      break;
    case "#ruangan":
      loadRuanganPage();
      break;
    case "#user-management":
      if (localStorage.getItem("userRole") === "management") {
        loadUserManagementPage();
      } else {
        contentArea.innerHTML = `<h1 class="text-2xl text-red-600">Akses Ditolak</h1>`;
      }
      break;
    case "#website-gki":
      if (localStorage.getItem("userRole") === "management") {
        loadWebsiteGkiPage();
      } else {
        contentArea.innerHTML =
          '<h1 class="text-2xl text-red-600">Akses Ditolak</h1>';
      }
      break;
    default:
      window.location.hash = "#dashboard";
      loadDashboardPage();
  }
}
