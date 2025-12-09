/**
 * User Management Page Module
 * Handles user CRUD operations for management role
 */

// State for user management
const userManagementState = {
  allUsers: [],
  searchQuery: ""
};

// Debounce helper
function userDebounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

async function loadUserManagementPage() {
  const contentArea = document.getElementById("content-area");
  showLoader();
  try {
    contentArea.innerHTML = "";
    const template = document
      .getElementById("user-management-template")
      .content.cloneNode(true);
    contentArea.appendChild(template);
    
    // Reset search on page load
    userManagementState.searchQuery = "";
    
    await refreshUserTable();
  } catch (error) {
    contentArea.innerHTML = `<p class="text-red-500">Terjadi error saat memuat halaman user: ${error.message}</p>`;
  } finally {
    hideLoader();
  }
}

async function refreshUserTable() {
  const container = document.getElementById("user-management-content-area");
  if (!container) return;
  
  container.innerHTML = `<div class="flex items-center justify-center py-12"><i class="fas fa-spinner fa-spin text-3xl text-amber-500"></i></div>`;

  try {
    const users = await api.post("/api/management", {
      action: "getUsers",
    });
    userManagementState.allUsers = users || [];
    renderUserManagementUI();
  } catch (error) {
    container.innerHTML = `<div class="bg-red-50 text-red-700 p-6 rounded-xl border border-red-200"><i class="fas fa-exclamation-circle mr-2"></i>Gagal memuat data: ${error.message}</div>`;
  }
}

function filterUsers(users) {
  if (!userManagementState.searchQuery) return users;
  const q = userManagementState.searchQuery.toLowerCase();
  return users.filter(u => 
    (u.full_name || "").toLowerCase().includes(q) || 
    (u.email || "").toLowerCase().includes(q)
  );
}

function renderUserManagementUI() {
  const container = document.getElementById("user-management-content-area");
  if (!container) return;
  
  const allUsers = userManagementState.allUsers;
  const filteredUsers = filterUsers(allUsers);
  const mgmtUsers = filteredUsers.filter(u => u.role === "management");
  const memberUsers = filteredUsers.filter(u => u.role === "member" || !u.role);
  
  container.innerHTML = `
    <!-- Search Bar -->
    <div class="bg-white rounded-2xl shadow-md p-4 lg:p-6 mb-6">
      <div class="relative">
        <span class="absolute inset-y-0 left-4 flex items-center text-gray-400"><i class="fas fa-search text-lg"></i></span>
        <input id="user-search-input" type="text" value="${userManagementState.searchQuery || ""}" 
          placeholder="Cari nama atau email pengguna..."
          class="w-full pl-12 pr-4 py-3.5 text-lg border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-gray-50 transition-all"/>
      </div>
      ${userManagementState.searchQuery ? `
        <div class="flex items-center justify-between text-sm text-gray-500 mt-3 pt-3 border-t border-gray-100">
          <span><strong class="text-gray-800">${filteredUsers.length}</strong> dari ${allUsers.length} pengguna</span>
          <button id="user-search-reset" class="text-amber-600 hover:text-amber-700"><i class="fas fa-times mr-1"></i>Reset</button>
        </div>
      ` : ""}
    </div>

    <!-- Management Users Section -->
    <div class="mb-8">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-bold text-gray-800">Management Users <span class="text-sm font-normal text-gray-500">(${mgmtUsers.length})</span></h3>
        <button id="add-management-btn" class="bg-amber-600 text-white font-bold py-2 px-4 rounded-md hover:bg-amber-700 shadow-sm transition-all">
          <i class="fas fa-user-shield mr-2"></i>Tambah User Management
        </button>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table class="min-w-full text-sm text-left table-fixed">
          <thead class="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
            <tr>
              <th class="p-4 w-[40%]">Nama Lengkap</th>
              <th class="p-4 w-[40%]">Email</th>
              <th class="p-4 text-center w-[20%]">Aksi</th>
            </tr>
          </thead>
          <tbody id="management-table-body" class="divide-y divide-gray-100"></tbody>
        </table>
      </div>
    </div>

    <!-- Member Users Section -->
    <div>
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-bold text-gray-800">Member Users <span class="text-sm font-normal text-gray-500">(${memberUsers.length})</span></h3>
        <button id="add-member-btn" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 shadow-sm transition-all">
          <i class="fas fa-user mr-2"></i>Tambah User Member
        </button>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table class="min-w-full text-sm text-left table-fixed">
          <thead class="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
            <tr>
              <th class="p-4 w-[40%]">Nama Lengkap</th>
              <th class="p-4 w-[40%]">Email</th>
              <th class="p-4 text-center w-[20%]">Aksi</th>
            </tr>
          </thead>
          <tbody id="member-table-body" class="divide-y divide-gray-100"></tbody>
        </table>
      </div>
    </div>
  `;

  // Render table bodies
  renderSingleTable("management-table-body", mgmtUsers);
  renderSingleTable("member-table-body", memberUsers);
  
  // Event listeners
  document.getElementById("add-management-btn")?.addEventListener("click", () => openUserModal("create", {}, "management"));
  document.getElementById("add-member-btn")?.addEventListener("click", () => openUserModal("create", {}, "member"));
  
  document.getElementById("user-search-input")?.addEventListener("input", userDebounce((e) => {
    userManagementState.searchQuery = e.target.value;
    renderUserManagementUI();
  }, 300));
  
  document.getElementById("user-search-reset")?.addEventListener("click", () => {
    userManagementState.searchQuery = "";
    renderUserManagementUI();
  });
  
  initializeUserActionMenus();
}


function renderSingleTable(elementId, users) {
  const tbody = document.getElementById(elementId);
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="p-8 text-center text-gray-400 italic">Belum ada data pengguna.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(user => {
    const isDeleted = user.is_deleted || false;
    const rowClass = isDeleted ? "bg-gray-100 opacity-60" : "hover:bg-gray-50";
    const statusBadge = isDeleted ? `<span class="ml-2 px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full font-medium">Nonaktif</span>` : "";
    
    return `
    <tr class="${rowClass} transition-colors">
      <td class="p-4 font-medium ${isDeleted ? 'text-gray-500' : 'text-gray-800'}">
        ${user.full_name || user.email}${statusBadge}
      </td>
      <td class="p-4 ${isDeleted ? 'text-gray-400' : 'text-gray-600'}">${user.email}</td>
      <td class="p-4 text-center">
        <button
          type="button"
          class="user-action-btn w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          data-user-id="${user.id}"
          data-user-name="${user.full_name || user.email}"
          data-user-email="${user.email}"
          data-user-role="${user.role || 'member'}"
          data-user-privileges='${JSON.stringify(user.privileges || [])}'
          data-user-is-deleted="${isDeleted}"
        >
          <i class="fas fa-ellipsis-v"></i>
        </button>
      </td>
    </tr>
  `}).join("");
}

function initializeUserActionMenus() {
  // Use event delegation on the table bodies
  ['management-table-body', 'member-table-body'].forEach(bodyId => {
    const tbody = document.getElementById(bodyId);
    if (!tbody) return;

    // Remove existing listener if any (to avoid duplicates if called multiple times)
    const newBody = tbody.cloneNode(true);
    tbody.parentNode.replaceChild(newBody, tbody);
    
    newBody.addEventListener('click', (event) => {
      const button = event.target.closest('.user-action-btn');
      if (!button) return;

      event.preventDefault();
      event.stopPropagation();

      const isDeleted = button.dataset.userIsDeleted === 'true';
      const userData = {
        id: button.dataset.userId,
        name: button.dataset.userName,
        email: button.dataset.userEmail,
        role: button.dataset.userRole,
        privileges: JSON.parse(button.dataset.userPrivileges || '[]'),
        is_deleted: isDeleted
      };
      
      openGlobalActionMenu({
        triggerElement: button,
        items: [
          {
            label: "Edit",
            icon: "fas fa-edit",
            className: "text-amber-600",
            onClick: () => openUserModal("edit", userData, userData.role),
          },
          {
            label: isDeleted ? "Aktifkan" : "Nonaktifkan",
            icon: isDeleted ? "fas fa-user-check" : "fas fa-user-slash",
            className: isDeleted ? "text-green-600" : "text-orange-600",
            onClick: () => toggleUserStatus(userData.id, !isDeleted),
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
    notifySuccess(res.message);
    refreshUserTable();
  } catch (err) {
    alert(`Gagal menghapus: ${err.message}`);
  }
}

async function toggleUserStatus(userId, newStatus) {
  const actionText = newStatus ? "menonaktifkan" : "mengaktifkan kembali";
  if (!confirm(`Apakah Anda yakin ingin ${actionText} user ini?`)) {
    return;
  }
  try {
    const res = await api.post("/api/management", {
      action: "toggleUserStatus",
      payload: { userId, is_deleted: newStatus },
    });
    notifySuccess(res.message);
    refreshUserTable();
  } catch (err) {
    alert(`Gagal ${actionText}: ${err.message}`);
  }
}

function openUserModal(mode, userData = {}, role = "member") {
  const modal = document.getElementById("user-modal");
  const form = document.getElementById("user-modal-form");
  form.reset();
  
  // Store role in a hidden field or data attribute
  form.dataset.targetRole = role;

  document.getElementById("user-modal-feedback").textContent = "";
  document.getElementById("user-password").placeholder =
    mode === "edit" ? "Kosongkan jika tidak ingin diubah" : "Wajib diisi";
  document.getElementById("user-password").required = mode === "create";
  
  const roleLabel = role === "management" ? "Management" : "Member";

  if (mode === "edit") {
    document.getElementById("user-modal-title").textContent = `Edit User ${roleLabel}`;
    document.getElementById("user-id").value = userData.id;
    document.getElementById("user-fullname").value = userData.name;
    document.getElementById("user-email").value = userData.email;
  } else {
    document.getElementById("user-modal-title").textContent = `Tambah User ${roleLabel} Baru`;
    document.getElementById("user-id").value = "";
  }
  
  // Handle Privileges UI
  const privContainer = document.getElementById("user-privileges-container");
  if (role === "management") {
    privContainer.classList.remove("hidden");
    const checkboxes = privContainer.querySelectorAll("input[name='privileges']");
    const userPrivs = userData.privileges || [];
    checkboxes.forEach(cb => {
      cb.checked = mode === "edit" ? userPrivs.includes(cb.value) : false;
    });
  } else {
    privContainer.classList.add("hidden");
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
  const form = document.getElementById("user-modal-form");
  const feedback = document.getElementById("user-modal-feedback");
  feedback.textContent = "Menyimpan...";
  
  const userId = document.getElementById("user-id").value;
  const mode = userId ? "updateUser" : "createUser";
  const role = form.dataset.targetRole || "member";

  const payload = {
    fullName: document.getElementById("user-fullname").value,
    email: document.getElementById("user-email").value,
    role: role 
  };

  if (role === "management") {
    const checkboxes = document.querySelectorAll("input[name='privileges']:checked");
    payload.privileges = Array.from(checkboxes).map(cb => cb.value);
  }
  
  const password = document.getElementById("user-password").value;
  if (password) payload.password = password;
  if (mode === "updateUser") payload.userId = userId;
  
  try {
    const result = await api.post("/api/management", {
      action: mode,
      payload,
    });
    notifySuccess(result.message);
    closeUserModal();
    refreshUserTable();
  } catch (error) {
    feedback.textContent = `Error: ${error.message}`;
  }
}
