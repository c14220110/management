/**
 * Authentication Module
 * Handles login, logout, and user session management
 */

function updateUserGreeting() {
  const greetingElement = document.getElementById("user-greeting");
  const userName = localStorage.getItem("userFullName");
  if (greetingElement && userName) {
    greetingElement.innerHTML = `Hi, <strong class="font-bold text-white">${userName}</strong>!`;
  }
}

function logout() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("userRole");
  localStorage.removeItem("userFullName");
  localStorage.removeItem("userPrivileges");
  window.location.replace("/");
}

async function handleLogin(e) {
  e.preventDefault();
  const feedback = document.getElementById("login-feedback");
  const loginScreen = document.getElementById("login-screen");
  const appLayout = document.getElementById("app-layout");
  const managementLink = document.getElementById("management-link");
  
  showLoader();
  feedback.textContent = "";

  try {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const data = await api.login(email, password);

    localStorage.setItem("authToken", data.session.access_token);
    const userRole = data.user.user_metadata.role || "member";
    localStorage.setItem("userRole", userRole);
    localStorage.setItem(
      "userFullName",
      data.user.full_name || data.user.email
    );
    if (data.user.privileges) {
      localStorage.setItem("userPrivileges", JSON.stringify(data.user.privileges));
    } else {
      localStorage.removeItem("userPrivileges");
    }

    loginScreen.style.display = "none";
    appLayout.classList.remove("hidden");

    if (window.updateSidebarVisibility) {
      window.updateSidebarVisibility();
    }

    window.location.hash = "#dashboard";
    router();
  } catch (error) {
    feedback.textContent = error.message;
  } finally {
    hideLoader();
  }
}
