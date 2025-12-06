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

  // Helper to check privilege
  const hasPrivilege = (priv) => {
    const userRole = localStorage.getItem("userRole");
    if (userRole !== "management") return false;
    
    const privileges = localStorage.getItem("userPrivileges");
    if (!privileges) return true; // Full access if no privileges defined (backward compat)
    
    try {
      const privs = JSON.parse(privileges);
      return Array.isArray(privs) && privs.includes(priv);
    } catch (e) {
      return false;
    }
  };

  contentArea.innerHTML = "";
  switch (hash) {
    case "#dashboard":
      loadDashboardPage();
      break;
    case "#barang":
      if (localStorage.getItem("userRole") === "member" || hasPrivilege("inventory")) {
        loadBarangPage();
      } else {
        contentArea.innerHTML = `<h1 class="text-2xl text-red-600 p-8">Akses Ditolak: Anda tidak memiliki izin untuk mengakses halaman Barang.</h1>`;
      }
      break;
    case "#ruangan":
      if (localStorage.getItem("userRole") === "member" || hasPrivilege("room")) {
        loadRuanganPage();
      } else {
        contentArea.innerHTML = `<h1 class="text-2xl text-red-600 p-8">Akses Ditolak: Anda tidak memiliki izin untuk mengakses halaman Ruangan.</h1>`;
      }
      break;
    case "#transportasi":
      if (localStorage.getItem("userRole") === "member" || hasPrivilege("transport")) {
        loadTransportasiPage();
      } else {
        contentArea.innerHTML = `<h1 class="text-2xl text-red-600 p-8">Akses Ditolak: Anda tidak memiliki izin untuk mengakses halaman Transportasi.</h1>`;
      }
      break;
    case "#user-management":
      if (hasPrivilege("users")) {
        loadUserManagementPage();
      } else {
        contentArea.innerHTML = `<h1 class="text-2xl text-red-600 p-8">Akses Ditolak: Anda tidak memiliki izin untuk mengakses halaman User Management.</h1>`;
      }
      break;
    case "#website-gki":
      if (hasPrivilege("website")) {
        loadWebsiteGkiPage();
      } else {
        contentArea.innerHTML =
          '<h1 class="text-2xl text-red-600 p-8">Akses Ditolak: Anda tidak memiliki izin untuk mengakses halaman Website GKI.</h1>';
      }
      break;
    case "#stok-opname":
      if (hasPrivilege("stock_opname")) {
        loadStockOpnamePage();
      } else {
        contentArea.innerHTML = '<h1 class="text-2xl text-red-600 p-8">Akses Ditolak: Anda tidak memiliki izin untuk mengakses halaman Stok Opname.</h1>';
      }
      break;
    default:
      window.location.hash = "#dashboard";
      loadDashboardPage();
  }
}
