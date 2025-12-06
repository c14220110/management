/**
 * Main Application Entry Point
 * Initializes all modules and sets up event listeners
 */

// === EVENT LISTENERS ===
document.getElementById("login-form").addEventListener("submit", handleLogin);
document.getElementById("logout-button").addEventListener("click", logout);
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

// Global function to update sidebar based on privileges
window.updateSidebarVisibility = function() {
  const userRole = localStorage.getItem("userRole");
  const managementLink = document.getElementById("management-link"); // User Management
  const stokOpnameLink = document.getElementById("stok-opname-link");
  const websiteGkiLink = document.getElementById("website-gki-link");
  const barangLink = document.getElementById("barang-link");
  const transportasiLink = document.getElementById("transportasi-link");
  const ruanganLink = document.getElementById("ruangan-link");

  // Helper to check privilege
  const hasPrivilege = (priv) => {
    if (userRole !== "management") return false;
    const privileges = localStorage.getItem("userPrivileges");
    if (!privileges) return true; // Full access if no privileges defined
    try {
      const privs = JSON.parse(privileges);
      return Array.isArray(privs) && privs.includes(priv);
    } catch (e) { return false; }
  };

  // Reset all to hidden first (except dashboard which is always visible)
  if (managementLink) managementLink.classList.add("hidden");
  if (stokOpnameLink) stokOpnameLink.classList.add("hidden");
  if (websiteGkiLink) websiteGkiLink.classList.add("hidden");
  
  // For member features (Barang, Transport, Ruangan), they might be visible to members too?
  // Previously they were visible to everyone.
  // If userRole is member, they should see Barang, Transport, Ruangan?
  // Let's assume Members have access to Barang, Transport, Ruangan by default (for borrowing).
  // Only Management needs privilege checks to MANAGE them.
  // BUT, my router logic blocked access to #barang if !hasPrivilege("inventory").
  // Wait, `router.js` logic:
  // `if (hasPrivilege("inventory")) { loadBarangPage(); }`
  // `hasPrivilege` returns FALSE if userRole !== "management".
  // THIS IS A BUG in my plan. Members need access to these pages to borrow items!
  // I need to fix `router.js` first or adjust `hasPrivilege` to allow members.
  
  // Correction: Members should have access to #barang, #transportasi, #ruangan for VIEWING/BORROWING.
  // Management with "inventory" privilege has access to MANAGE.
  // Management WITHOUT "inventory" privilege... should they see it?
  // If they are management, they probably shouldn't see it if they don't have privilege.
  // OR, they see it but only in "Member View"?
  // The requirement says "Privilege system for role management".
  // "Allow different management roles to have varying levels of access".
  // So a "User Manager" shouldn't see "Inventory" tab?
  // If so, then `router.js` logic is correct for Management.
  // But for Members, `hasPrivilege` returns false, so they get "Access Denied".
  
  // I must fix `router.js` logic to allow Members.
  // I will update `updateSidebarVisibility` to handle this.
  
  if (userRole === "member") {
    if (barangLink) barangLink.classList.remove("hidden");
    if (transportasiLink) transportasiLink.classList.remove("hidden");
    if (ruanganLink) ruanganLink.classList.remove("hidden");
  } else if (userRole === "management") {
    // Management: Check privileges
    if (barangLink) {
        if (hasPrivilege("inventory")) barangLink.classList.remove("hidden");
        else barangLink.classList.add("hidden");
    }
    if (transportasiLink) {
        if (hasPrivilege("transport")) transportasiLink.classList.remove("hidden");
        else transportasiLink.classList.add("hidden");
    }
    if (ruanganLink) {
        if (hasPrivilege("room")) ruanganLink.classList.remove("hidden");
        else ruanganLink.classList.add("hidden");
    }
    
    if (managementLink && hasPrivilege("users")) managementLink.classList.remove("hidden");
    if (stokOpnameLink && hasPrivilege("stock_opname")) stokOpnameLink.classList.remove("hidden");
    if (websiteGkiLink && hasPrivilege("website")) websiteGkiLink.classList.remove("hidden");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const loginScreen = document.getElementById("login-screen");
  const appLayout = document.getElementById("app-layout");
  const hamburgerButton = document.getElementById("hamburger-button");
  const closeSidebarButton = document.getElementById("close-sidebar-button");
  const sidebarOverlay = document.getElementById("sidebar-overlay");

  if (localStorage.getItem("authToken")) {
    loginScreen.style.display = "none";
    appLayout.classList.remove("hidden");
    
    updateUserGreeting();
    window.updateSidebarVisibility(); // Call the function
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

  injectCalendarResponsiveStyles();
});

// ============================================================
// Global Action Menu Helpers (shared three-dot menu)
// ============================================================

const globalActionMenuState = {
  menuEl: null,
  itemsEl: null,
};

function ensureGlobalActionMenuElements() {
  if (!globalActionMenuState.menuEl) {
    globalActionMenuState.menuEl =
      document.getElementById("global-action-menu");
  }
  if (!globalActionMenuState.itemsEl) {
    globalActionMenuState.itemsEl = document.getElementById(
      "global-action-menu-items"
    );
  }
}

function closeGlobalActionMenu() {
  ensureGlobalActionMenuElements();
  if (globalActionMenuState.menuEl) {
    globalActionMenuState.menuEl.classList.add("hidden");
    globalActionMenuState.menuEl.style.visibility = "";
  }
  if (globalActionMenuState.itemsEl) {
    globalActionMenuState.itemsEl.innerHTML = "";
  }
}

function openGlobalActionMenu({ triggerElement, items = [] }) {
  ensureGlobalActionMenuElements();
  if (!globalActionMenuState.menuEl || !globalActionMenuState.itemsEl) {
    return;
  }

  globalActionMenuState.itemsEl.innerHTML = "";
  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 ${
      item.className || ""
    }`;
    button.innerHTML = `${
      item.icon ? `<i class="${item.icon}"></i>` : ""
    } <span>${item.label}</span>`;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      closeGlobalActionMenu();
      if (typeof item.onClick === "function") {
        item.onClick();
      }
    });
    globalActionMenuState.itemsEl.appendChild(button);
  });

  if (items.length === 0) {
    closeGlobalActionMenu();
    return;
  }

  if (!triggerElement) {
    closeGlobalActionMenu();
    return;
  }

  // Prepare for measurement without flashing
  globalActionMenuState.menuEl.style.visibility = "hidden";
  globalActionMenuState.menuEl.classList.remove("hidden");

  const menuWidth = globalActionMenuState.menuEl.offsetWidth;
  const menuHeight = globalActionMenuState.menuEl.offsetHeight;

  const rect = triggerElement.getBoundingClientRect();
  const viewportLeft = window.scrollX;
  const viewportRight = window.scrollX + window.innerWidth;
  const viewportTop = window.scrollY;
  const viewportBottom = window.scrollY + window.innerHeight;

  let left = rect.left + window.scrollX;
  let top = rect.bottom + window.scrollY + 4;

  const padding = 8;
  const maxLeft = viewportRight - menuWidth - padding;
  if (left > maxLeft) {
    left = Math.max(viewportLeft + padding, maxLeft);
  } else if (left < viewportLeft + padding) {
    left = viewportLeft + padding;
  }

  if (top + menuHeight > viewportBottom - padding) {
    const above = rect.top + window.scrollY - menuHeight - 4;
    if (above >= viewportTop + padding) {
      top = above;
    } else {
      top = viewportBottom - menuHeight - padding;
    }
  }

  globalActionMenuState.menuEl.style.left = `${left}px`;
  globalActionMenuState.menuEl.style.top = `${top}px`;
  globalActionMenuState.menuEl.style.visibility = "visible";
}

window.openGlobalActionMenu = openGlobalActionMenu;
window.closeGlobalActionMenu = closeGlobalActionMenu;

// ============================================================
// Global Modal Helpers
// ============================================================
let globalModalState = { onConfirm: null };

function openGlobalModal({ title, contentHTML, confirmText = "Simpan", cancelText = "Batal", onConfirm }) {
  closeGlobalModal();
  
  const modalHTML = `
    <div id="global-modal-overlay" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden animate-fade-in">
        <div class="flex justify-between items-center p-4 border-b bg-gradient-to-r from-amber-500 to-orange-500">
          <h3 class="font-bold text-lg text-white">${title}</h3>
          <button id="global-modal-close" class="text-white/80 hover:text-white text-xl"><i class="fas fa-times"></i></button>
        </div>
        <div class="p-5 overflow-y-auto max-h-[60vh]" id="global-modal-content">
          ${contentHTML}
        </div>
        <div class="flex justify-end gap-3 p-4 border-t bg-gray-50">
          <button id="global-modal-cancel" class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium">${cancelText}</button>
          <button id="global-modal-confirm" class="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 font-medium shadow-md">${confirmText}</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML("beforeend", modalHTML);
  globalModalState.onConfirm = onConfirm;
  
  document.getElementById("global-modal-close").onclick = closeGlobalModal;
  document.getElementById("global-modal-cancel").onclick = closeGlobalModal;
  document.getElementById("global-modal-confirm").onclick = async () => {
    if (globalModalState.onConfirm) {
      await globalModalState.onConfirm();
    }
  };
  
  // Close on overlay click
  document.getElementById("global-modal-overlay").onclick = (e) => {
    if (e.target.id === "global-modal-overlay") closeGlobalModal();
  };
}

function closeGlobalModal() {
  const overlay = document.getElementById("global-modal-overlay");
  if (overlay) overlay.remove();
  globalModalState.onConfirm = null;
}

window.openGlobalModal = openGlobalModal;
window.closeGlobalModal = closeGlobalModal;

document.addEventListener("click", (event) => {
  ensureGlobalActionMenuElements();
  if (
    !globalActionMenuState.menuEl ||
    globalActionMenuState.menuEl.classList.contains("hidden")
  ) {
    return;
  }

  const clickedMenu = event.target.closest("#global-action-menu");
  const clickedTrigger = event.target.closest(".action-menu-btn");

  if (!clickedMenu && !clickedTrigger) {
    closeGlobalActionMenu();
  }
});

// ============================================================
// Success Animation Helpers (Lottie)
// ============================================================

const scriptCache = {};
function loadScriptOnce(src) {
  if (!scriptCache[src]) {
    scriptCache[src] = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = () =>
        reject(new Error(`Gagal memuat script eksternal: ${src}`));
      document.head.appendChild(script);
    });
  }
  return scriptCache[src];
}

const successAnimationState = {
  overlay: null,
  container: null,
  messageEl: null,
  lottieInstance: null,
  animationData: null,
  hideTimeout: null,
};

async function ensureLottieLoaded() {
  if (window.lottie) return;
  await loadScriptOnce(
    "https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js"
  );
}

async function ensureSuccessAnimationData() {
  if (successAnimationState.animationData) return;
  const response = await fetch("/Success.json");
  if (!response.ok) {
    throw new Error("Gagal memuat animasi sukses.");
  }
  successAnimationState.animationData = await response.json();
}

function ensureSuccessAnimationElements() {
  if (successAnimationState.overlay) return;
  const overlay = document.createElement("div");
  overlay.id = "success-feedback-overlay";
  overlay.className =
    "fixed inset-0 bg-black bg-opacity-40 hidden flex items-center justify-center z-50 px-4";
  overlay.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl px-8 py-6 flex flex-col items-center gap-4 max-w-sm w-full">
      <div id="success-animation-container" class="w-40 h-40"></div>
      <p id="success-animation-message" class="text-lg font-semibold text-gray-800 text-center"></p>
    </div>
  `;
  document.body.appendChild(overlay);
  successAnimationState.overlay = overlay;
  successAnimationState.container = overlay.querySelector(
    "#success-animation-container"
  );
  successAnimationState.messageEl = overlay.querySelector(
    "#success-animation-message"
  );

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      hideSuccessFeedback();
    }
  });
}

function hideSuccessFeedback() {
  if (successAnimationState.hideTimeout) {
    clearTimeout(successAnimationState.hideTimeout);
    successAnimationState.hideTimeout = null;
  }
  if (successAnimationState.overlay) {
    successAnimationState.overlay.classList.add("hidden");
  }
}

async function showSuccessFeedback(message = "Berhasil!") {
  try {
    await ensureLottieLoaded();
    await ensureSuccessAnimationData();
    ensureSuccessAnimationElements();

    if (!successAnimationState.lottieInstance) {
      successAnimationState.lottieInstance = window.lottie.loadAnimation({
        container: successAnimationState.container,
        renderer: "svg",
        loop: false,
        autoplay: false,
        animationData: successAnimationState.animationData,
      });
    } else {
      successAnimationState.lottieInstance.stop();
    }

    successAnimationState.messageEl.textContent = message;
    successAnimationState.overlay.classList.remove("hidden");
    successAnimationState.lottieInstance.goToAndPlay(0, true);

    if (successAnimationState.hideTimeout) {
      clearTimeout(successAnimationState.hideTimeout);
    }
    successAnimationState.hideTimeout = setTimeout(() => {
      hideSuccessFeedback();
    }, 2200);
  } catch (error) {
    console.warn("Success animation gagal:", error);
    alert(message);
  }
}

window.showSuccessFeedback = showSuccessFeedback;
window.hideSuccessFeedback = hideSuccessFeedback;
window.notifySuccess = function notifySuccess(message) {
  if (typeof showSuccessFeedback === "function") {
    showSuccessFeedback(message);
  } else {
    alert(message);
  }
};

// ============================================================
// Error Animation Helpers (Lottie - using Fail.json)
// ============================================================
const errorAnimationState = {
  overlay: null,
  container: null,
  messageEl: null,
  lottieInstance: null,
  animationData: null,
  hideTimeout: null,
};

async function ensureErrorAnimationData() {
  if (errorAnimationState.animationData) return;
  const response = await fetch("/Fail.json");
  if (!response.ok) {
    throw new Error("Gagal memuat animasi error.");
  }
  errorAnimationState.animationData = await response.json();
}

function ensureErrorAnimationElements() {
  if (errorAnimationState.overlay) return;
  const overlay = document.createElement("div");
  overlay.id = "error-feedback-overlay";
  overlay.className =
    "fixed inset-0 bg-black bg-opacity-40 hidden flex items-center justify-center z-50 px-4";
  overlay.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl px-8 py-6 flex flex-col items-center gap-4 max-w-sm w-full">
      <div id="error-animation-container" class="w-40 h-40"></div>
      <p id="error-animation-message" class="text-lg font-semibold text-red-600 text-center"></p>
      <button id="error-close-btn" class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium">Tutup</button>
    </div>
  `;
  document.body.appendChild(overlay);
  errorAnimationState.overlay = overlay;
  errorAnimationState.container = overlay.querySelector("#error-animation-container");
  errorAnimationState.messageEl = overlay.querySelector("#error-animation-message");

  overlay.querySelector("#error-close-btn").addEventListener("click", hideErrorFeedback);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      hideErrorFeedback();
    }
  });
}

function hideErrorFeedback() {
  if (errorAnimationState.hideTimeout) {
    clearTimeout(errorAnimationState.hideTimeout);
    errorAnimationState.hideTimeout = null;
  }
  if (errorAnimationState.overlay) {
    errorAnimationState.overlay.classList.add("hidden");
  }
}

async function showErrorFeedback(message = "Terjadi kesalahan!") {
  try {
    await ensureLottieLoaded();
    await ensureErrorAnimationData();
    ensureErrorAnimationElements();

    if (!errorAnimationState.lottieInstance) {
      errorAnimationState.lottieInstance = window.lottie.loadAnimation({
        container: errorAnimationState.container,
        renderer: "svg",
        loop: false,
        autoplay: false,
        animationData: errorAnimationState.animationData,
      });
    } else {
      errorAnimationState.lottieInstance.stop();
    }

    errorAnimationState.messageEl.textContent = message;
    errorAnimationState.overlay.classList.remove("hidden");
    errorAnimationState.lottieInstance.goToAndPlay(0, true);

    // Don't auto-hide error - user must click to close
  } catch (error) {
    console.warn("Error animation gagal:", error);
    alert(message);
  }
}

window.showErrorFeedback = showErrorFeedback;
window.hideErrorFeedback = hideErrorFeedback;
window.notifyError = function notifyError(message) {
  if (typeof showErrorFeedback === "function") {
    showErrorFeedback(message);
  } else {
    alert(message);
  }
};

function injectCalendarResponsiveStyles() {
  if (document.getElementById("calendar-responsive-style")) {
    return;
  }
  const style = document.createElement("style");
  style.id = "calendar-responsive-style";
  style.textContent = `
    .fc-toolbar.fc-header-toolbar {
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .fc-toolbar-title {
      font-size: 1.4rem;
      font-weight: 700;
    }

    .fc-button {
      border-radius: 0.5rem;
      border: none;
      background-color: #1f2937;
      color: #fff;
      padding: 0.35rem 0.65rem;
      font-size: 0.85rem;
      text-transform: capitalize;
    }

    .fc-button:focus {
      box-shadow: none;
    }

    @media (max-width: 768px) {
      .fc-toolbar.fc-header-toolbar {
        flex-direction: column;
        align-items: stretch;
      }

      .fc-toolbar-title {
        font-size: 1.1rem;
      }

      .fc-toolbar-chunk {
        width: 100%;
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
      }

      .fc-toolbar-chunk:last-child {
        justify-content: flex-end;
      }

      .fc-button {
        flex: 1;
        padding: 0.4rem 0.2rem;
      }

      .fc-daygrid-day-number,
      .fc-col-header-cell-cushion {
        font-size: 0.8rem;
      }
    }
  `;
  document.head.appendChild(style);
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function getResponsiveCalendarOptions(overrides = {}) {
  const isMobile = isMobileViewport();
  const baseOptions = {
    headerToolbar: isMobile
      ? { start: "title", center: "", end: "prev,next today" }
      : {
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        },
    initialView: isMobile ? "timeGridDay" : "timeGridWeek",
    height: isMobile ? "auto" : 520,
    expandRows: true,
    handleWindowResize: true,
    stickyHeaderDates: true,
    dayMaxEventRows: 3,
    slotEventOverlap: false,
    views: {
      dayGridMonth: { dayHeaderFormat: { weekday: "short" } },
      timeGridWeek: {
        dayHeaderFormat: { weekday: "short", day: "numeric" },
      },
      timeGridDay: {
        dayHeaderFormat: { weekday: "long", day: "numeric" },
      },
    },
  };
  return { ...baseOptions, ...overrides };
}

window.getResponsiveCalendarOptions = getResponsiveCalendarOptions;
window.isMobileViewport = isMobileViewport;
