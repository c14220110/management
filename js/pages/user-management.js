/**
 * User Management Page Module
 * Handles user CRUD operations for management role
 */

// State to store users for filtering
const userState = {
  allUsers: [],
  searchManagement: "",
  searchMember: ""
};

async function loadUserManagementPage() {
  const contentArea = document.getElementById("content-area");
  showLoader();
  try {
    contentArea.innerHTML = "";
    const template = document
      .getElementById("user-management-template")
      .content.cloneNode(true);
    contentArea.appendChild(template);
    const container = document.getElementById("user-management-content-area");
    container.innerHTML = `
      <!-- Management Users Section -->
      <div class="mb-8">
        <div class="flex items-center justify-between gap-4 mb-4">
          <h3 class="text-lg font-bold text-gray-800 whitespace-nowrap">Management Users</h3>
          <div class="flex items-center gap-3">
            <div class="relative">
              <span class="absolute inset-y-0 left-3 flex items-center text-gray-400"><i class="fas fa-search"></i></span>
              <input type="text" id="search-management" placeholder="Cari nama atau email..." 
                class="w-56 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"/>
            </div>
            <button id="add-management-btn" class="bg-amber-600 text-white font-bold py-2 px-4 rounded-md hover:bg-amber-700 shadow-sm transition-all whitespace-nowrap">
              <i class="fas fa-user-shield mr-2"></i>Tambah User Management
            </button>
          </div>
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
        <div class="flex items-center justify-between gap-4 mb-4">
          <h3 class="text-lg font-bold text-gray-800 whitespace-nowrap">Member Users</h3>
          <div class="flex items-center gap-3">
            <div class="relative">
              <span class="absolute inset-y-0 left-3 flex items-center text-gray-400"><i class="fas fa-search"></i></span>
              <input type="text" id="search-member" placeholder="Cari nama atau email..." 
                class="w-56 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"/>
            </div>
            <button id="add-member-btn" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 shadow-sm transition-all whitespace-nowrap">
              <i class="fas fa-user mr-2"></i>Tambah User Member
            </button>
          </div>
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

    // Event listeners for buttons
    document.getElementById("add-management-btn").addEventListener("click", () => openUserModal("create", {}, "management"));
    document.getElementById("add-member-btn").addEventListener("click", () => openUserModal("create", {}, "member"));
    
    // Event listeners for search
    document.getElementById("search-management").addEventListener("input", (e) => {
      userState.searchManagement = e.target.value.toLowerCase();
      renderUserTables(userState.allUsers);
    });
    document.getElementById("search-member").addEventListener("input", (e) => {
      userState.searchMember = e.target.value.toLowerCase();
      renderUserTables(userState.allUsers);
    });
    
    await refreshUserTable();
  } catch (error) {
    contentArea.innerHTML = `<p class="text-red-500">Terjadi error saat memuat halaman user: ${error.message}</p>`;
  } finally {
    hideLoader();
  }
}

async function refreshUserTable() {
  const mgmtBody = document.getElementById("management-table-body");
  const memberBody = document.getElementById("member-table-body");
  
  if (mgmtBody) mgmtBody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-gray-400">Memuat data...</td></tr>`;
  if (memberBody) memberBody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-gray-400">Memuat data...</td></tr>`;

  try {
    const users = await api.post("/api/management", {
      action: "getUsers",
    });
    userState.allUsers = users;
    renderUserTables(users);
  } catch (error) {
    const errHtml = `<tr><td colspan="3" class="p-4 text-center text-red-500">Gagal memuat data: ${error.message}</td></tr>`;
    if (mgmtBody) mgmtBody.innerHTML = errHtml;
    if (memberBody) memberBody.innerHTML = errHtml;
  }
}

function renderUserTables(users) {
  let mgmtUsers = users.filter(u => u.role === "management");
  let memberUsers = users.filter(u => u.role === "member" || !u.role);

  // Apply search filters
  if (userState.searchManagement) {
    const q = userState.searchManagement;
    mgmtUsers = mgmtUsers.filter(u => 
      (u.full_name || "").toLowerCase().includes(q) || 
      (u.email || "").toLowerCase().includes(q)
    );
  }
  if (userState.searchMember) {
    const q = userState.searchMember;
    memberUsers = memberUsers.filter(u => 
      (u.full_name || "").toLowerCase().includes(q) || 
      (u.email || "").toLowerCase().includes(q)
    );
  }

  renderSingleTable("management-table-body", mgmtUsers);
  renderSingleTable("member-table-body", memberUsers);
  
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
    const isActive = user.is_active !== false;
    const statusBadge = isActive 
      ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"><i class="fas fa-check-circle mr-1"></i>Aktif</span>'
      : '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"><i class="fas fa-ban mr-1"></i>Nonaktif</span>';
    return `
      <tr class="hover:bg-gray-50 transition-colors ${!isActive ? 'opacity-60' : ''}">
        <td class="p-4">
          <div class="font-medium text-gray-800">${user.full_name || user.email}</div>
          <div class="mt-1">${statusBadge}</div>
        </td>
        <td class="p-4 text-gray-600">${user.email}</td>
        <td class="p-4 text-center">
          <button
            type="button"
            class="user-action-btn w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            data-user-id="${user.id}"
            data-user-name="${user.full_name || user.email}"
            data-user-email="${user.email}"
            data-user-role="${user.role || 'member'}"
            data-user-privileges='${JSON.stringify(user.privileges || [])}'
            data-user-active="${isActive}"
          >
            <i class="fas fa-ellipsis-v"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");
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

      const userData = {
        id: button.dataset.userId,
        name: button.dataset.userName,
        email: button.dataset.userEmail,
        role: button.dataset.userRole,
        privileges: JSON.parse(button.dataset.userPrivileges || '[]'),
        isActive: button.dataset.userActive === 'true'
      };
      
      const toggleLabel = userData.isActive ? "Nonaktifkan" : "Aktifkan";
      const toggleIcon = userData.isActive ? "fas fa-user-slash" : "fas fa-user-check";
      const toggleClass = userData.isActive ? "text-orange-600" : "text-green-600";
      
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
            label: toggleLabel,
            icon: toggleIcon,
            className: toggleClass,
            onClick: () => toggleUserStatus(userData.id, !userData.isActive),
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

async function toggleUserStatus(userId, isActive) {
  const actionText = isActive ? "mengaktifkan" : "menonaktifkan";
  if (!confirm(`Apakah Anda yakin ingin ${actionText} user ini?`)) {
    return;
  }
  try {
    const res = await api.post("/api/management", {
      action: "toggleUserStatus",
      payload: { userId, isActive },
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
  if (password) {
    // Validasi password minimum 6 karakter (requirement Supabase Auth)
    if (password.length < 6) {
      feedback.textContent = "Error: Password harus minimal 6 karakter.";
      return;
    }
    payload.password = password;
  }
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
