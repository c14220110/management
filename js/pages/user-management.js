/**
 * User Management Page Module
 * Handles user CRUD operations for management role
 */

async function loadUserManagementPage() {
  const contentArea = document.getElementById("content-area");
  showLoader();
  try {
    contentArea.innerHTML = "";
    const template = document
      .getElementById("user-management-template")
      .content.cloneNode(true);
    contentArea.appendChild(template);
    const container = document.getElementById(
      "user-management-content-area"
    );
    container.innerHTML = `<div class="flex justify-end mb-4"><button id="add-user-btn" class="bg-[#d97706] text-white font-bold py-2 px-4 rounded-md hover:bg-[#b45309]"><i class="fas fa-plus mr-2"></i>Tambah User Member</button></div>
      <div class="bg-white p-4 rounded-lg shadow-md"><table class="min-w-full"><thead class="bg-gray-100"><tr><th class="text-left p-3">Nama Lengkap</th><th class="text-left p-3">Email</th><th class="text-left p-3">Aksi</th></tr></thead><tbody id="user-table-body"></tbody></table></div>`;
    document
      .getElementById("add-user-btn")
      .addEventListener("click", () => openUserModal("create"));
    await refreshUserTable();
  } catch (error) {
    contentArea.innerHTML = `<p class="text-red-500">Terjadi error saat memuat halaman user: ${error.message}</p>`;
  } finally {
    hideLoader();
  }
}

async function refreshUserTable() {
  const tableBody = document.getElementById("user-table-body");
  if (!tableBody) return;
  tableBody.innerHTML = `<tr><td colspan="3" class="p-4 text-center">Memuat ulang data...</td></tr>`;
  try {
    const users = await api.post("/api/management", {
      action: "getUsers",
    });
    renderUserTable(users);
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-red-500">Gagal memuat data: ${error.message}</td></tr>`;
  }
}

function renderUserTable(users) {
  const tableBody = document.getElementById("user-table-body");
  if (!tableBody) return;
  if (users.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="3" class="p-4 text-center">Belum ada data pengguna.</td></tr>`;
  } else {
    tableBody.innerHTML = users
      .map(
        (user) => `
          <tr class="border-b">
            <td class="p-3">${user.full_name || user.email}</td>
            <td class="p-3">${user.email}</td>
            <td class="p-3 whitespace-nowrap text-center">
              <button
                type="button"
                class="user-action-btn action-menu-btn inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
                data-user-id="${user.id}"
                data-user-name="${user.full_name || user.email}"
                data-user-email="${user.email}"
              >
                <i class="fas fa-ellipsis-v"></i>
              </button>
            </td>
          </tr>`
      )
      .join("");
  }
  initializeUserActionMenus();
}

function initializeUserActionMenus() {
  document.querySelectorAll(".user-action-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const userData = {
        id: button.dataset.userId,
        name: button.dataset.userName,
        email: button.dataset.userEmail,
      };
      openGlobalActionMenu({
        triggerElement: button,
        items: [
          {
            label: "Edit",
            icon: "fas fa-edit",
            className: "text-amber-600",
            onClick: () => openUserModal("edit", userData),
          },
          {
            label: "Hapus",
            icon: "fas fa-trash-alt",
            className: "text-red-600",
            onClick: () => deleteUserAccount(userData.id),
          },
        ],
      });
    });
  });
}

async function deleteUserAccount(userId) {
  if (!confirm("Apakah Anda yakin ingin menghapus user ini?")) {
    return;
  }
  try {
    const res = await api.post("/api/management", {
      action: "deleteUser",
      payload: { userId },
    });
    alert(res.message);
    refreshUserTable();
  } catch (err) {
    alert(`Gagal menghapus: ${err.message}`);
  }
}

function openUserModal(mode, userData = {}) {
  const modal = document.getElementById("user-modal");
  const form = document.getElementById("user-modal-form");
  form.reset();
  document.getElementById("user-modal-feedback").textContent = "";
  document.getElementById("user-password").placeholder =
    mode === "edit" ? "Kosongkan jika tidak ingin diubah" : "Wajib diisi";
  document.getElementById("user-password").required = mode === "create";
  if (mode === "edit") {
    document.getElementById("user-modal-title").textContent =
      "Edit User Member";
    document.getElementById("user-id").value = userData.id;
    document.getElementById("user-fullname").value = userData.name;
    document.getElementById("user-email").value = userData.email;
  } else {
    document.getElementById("user-modal-title").textContent =
      "Tambah User Member Baru";
    document.getElementById("user-id").value = "";
  }
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeUserModal() {
  document.getElementById("user-modal").classList.add("hidden");
  document.getElementById("user-modal").classList.remove("flex");
}

async function handleUserFormSubmit(e) {
  e.preventDefault();
  const feedback = document.getElementById("user-modal-feedback");
  feedback.textContent = "Menyimpan...";
  const userId = document.getElementById("user-id").value;
  const mode = userId ? "updateUser" : "createUser";
  const payload = {
    fullName: document.getElementById("user-fullname").value,
    email: document.getElementById("user-email").value,
  };
  const password = document.getElementById("user-password").value;
  if (password) payload.password = password;
  if (mode === "updateUser") payload.userId = userId;
  try {
    const result = await api.post("/api/management", {
      action: mode,
      payload,
    });
    alert(result.message);
    closeUserModal();
    refreshUserTable();
  } catch (error) {
    feedback.textContent = `Error: ${error.message}`;
  }
}
