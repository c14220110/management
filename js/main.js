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
      document.getElementById("website-gki-link").classList.remove("hidden");
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
