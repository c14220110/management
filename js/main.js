/**
 * Main Application Entry Point
 * Initializes all modules and sets up event listeners
 */

// === EVENT LISTENERS ===
document
  .getElementById("login-form")
  .addEventListener("submit", handleLogin);
document
  .getElementById("logout-button")
  .addEventListener("click", logout);
window.addEventListener("hashchange", router);

// Handle navigation dengan data-page attribute
document.addEventListener("click", (e) => {
  const navLink = e.target.closest("[data-page]");
  if (navLink) {
    e.preventDefault();
    const page = navLink.getAttribute("data-page");
    window.location.hash = page;
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const loginScreen = document.getElementById("login-screen");
  const appLayout = document.getElementById("app-layout");
  const managementLink = document.getElementById("management-link");
  const hamburgerButton = document.getElementById("hamburger-button");
  const closeSidebarButton = document.getElementById("close-sidebar-button");
  const sidebarOverlay = document.getElementById("sidebar-overlay");
  
  if (localStorage.getItem("authToken")) {
    loginScreen.style.display = "none";
    appLayout.classList.remove("hidden");
    if (localStorage.getItem("userRole") === "management") {
      managementLink.classList.remove("hidden");
      document
        .getElementById("website-gki-link")
        .classList.remove("hidden");
    }

    updateUserGreeting();
    router();
  }
  hamburgerButton.addEventListener("click", toggleSidebar);
  closeSidebarButton.addEventListener("click", toggleSidebar);
  sidebarOverlay.addEventListener("click", toggleSidebar);
  document
    .getElementById("user-modal-close")
    .addEventListener("click", closeUserModal);
  document
    .getElementById("user-modal-form")
    .addEventListener("submit", handleUserFormSubmit);
  document
    .getElementById("room-modal-close")
    .addEventListener("click", closeRoomModal);
  document
    .getElementById("room-modal-form")
    .addEventListener("submit", handleRoomFormSubmit);
});
