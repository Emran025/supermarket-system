let users = [];
let managerList = [];
let roleList = [];
let currentPage = 1;
let itemsPerPage = 20;
let totalItems = 0;

document.addEventListener("DOMContentLoaded", async () => {
  // Check auth
  const user = await checkAuth();
  if (!user) return;

  // Only users with 'users' view permission can access this page
  if (!canAccess("users", "view")) {
    window.location.href = "dashboard.html";
    return;
  }

  await loadAccountRoles(); // Load roles for dropdowns
  await loadManagers();
  await loadUsers();

  // Add User button
  const btn = document.getElementById("addUserBtn");
  if (btn) {
    btn.onclick = function () {
      populateManagerDropdown("manager", null);
      openDialog("userModal");
    };
  }
});

/**
 * Load roles from API and populate dropdowns
 */
async function loadAccountRoles() {
  try {
    const response = await fetchAPI("roles");
    if (response.success) {
      roleList = response.data;
      populateRoleDropdown("role_id");
      populateRoleDropdown("edit_role_id");
    }
  } catch (error) {
    console.error("Error loading roles:", error);
  }
}

function populateRoleDropdown(elementId) {
  const select = document.getElementById(elementId);
  if (!select) return;

  select.innerHTML = '<option value="">-- اختر الدور الصلاحي --</option>';
  roleList.forEach((role) => {
    const option = document.createElement("option");
    option.value = role.id;
    option.textContent = `${role.role_name_ar} (${role.role_key})`;
    select.appendChild(option);
  });
}

// Dialog helper functions
function closeUserModal() {
  closeDialog("userModal");
}

function submitUserForm() {
  document.getElementById("userForm").requestSubmit();
}

function closeEditUserModal() {
  closeDialog("editUserModal");
}

function submitEditUserForm() {
  document.getElementById("editUserForm").requestSubmit();
}

document.getElementById("userForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const role_id = document.getElementById("role_id").value;
  const manager_id = document.getElementById("manager").value;

  try {
    const response = await fetchAPI("users", "POST", {
      username,
      password,
      role_id,
      manager_id,
    });

    if (response.success) {
      showToast("تمت إضافة المستخدم بنجاح", "success");
      document.getElementById("userForm").reset();
      closeDialog("userModal");
      await loadManagers(); // Refresh managers list
      await loadUsers();
    } else {
      showToast(response.message || "فشل إضافة المستخدم", "error");
    }
  } catch (error) {
    console.error("Error adding user:", error);
    showToast("حدث خطأ أثناء الاتصال بالخادم", "error");
  }
});

document
  .getElementById("editUserForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("editUserId").value;
    const role_id = document.getElementById("edit_role_id").value;
    const isActive = document.getElementById("editIsActive").checked ? 1 : 0;
    const manager_id = document.getElementById("editManager").value;

    try {
      const response = await fetchAPI("users", "PUT", {
        id,
        role_id,
        is_active: isActive,
        manager_id,
      });

      if (response.success) {
        showToast("تم تحديث المستخدم بنجاح", "success");
        closeDialog("editUserModal");
        await loadManagers(); // Refresh managers list
        await loadUsers();
      } else {
        showToast(response.message || "فشل تحديث المستخدم", "error");
      }
    } catch (error) {
      console.error("Error updating user:", error);
      showToast("حدث خطأ أثناء الاتصال بالخادم", "error");
    }
  });

async function loadManagers() {
  try {
    const response = await fetch(`${API_BASE}?action=manager_list`, {
      method: "GET",
      credentials: "include",
    });
    const result = await response.json();
    if (result.success) {
      managerList = result.data;
    }
  } catch (error) {
    console.error("Error loading managers:", error);
  }
}

async function loadUsers() {
  try {
    const response = await fetch(
      `${API_BASE}?action=users&page=${currentPage}&limit=${itemsPerPage}`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    const result = await response.json();
    if (result.success) {
      users = result.data;
      totalItems = result.pagination.total_records;
      renderUsers();

      // Centralized numeric pagination
      renderPagination(result.pagination, "pagination-controls", (newPage) => {
        currentPage = newPage;
        loadUsers();
      });
    }
  } catch (error) {
    console.error("Error loading users:", error);
  }
}

function renderUsers() {
  const tbody = document.getElementById("usersTable");
  tbody.innerHTML = "";

  if (users.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="text-center">لا يوجد مستخدمين</td></tr>';
    return;
  }

  users.forEach((u) => {
    const row = document.createElement("tr");

    // Dynamic role badges based on role_key
    let badgeClass = "badge-secondary";
    if (u.role_key === "admin") badgeClass = "badge-primary";
    else if (u.role_key === "manager") badgeClass = "badge-success";
    else if (u.role_key === "accountant") badgeClass = "badge-info";

    const roleBadge = `<span class="badge ${badgeClass}">${
      u.role_name_ar || u.role_key
    }</span>`;

    const statusBadge =
      u.is_active == 1
        ? '<span class="badge badge-success">نشط</span>'
        : '<span class="badge badge-danger">غير نشط</span>';

    const managerName = u.manager_name || "-";

    row.innerHTML = `
            <td>${u.username}</td>
            <td>${roleBadge}</td>
            <td>${managerName}</td>
            <td>${statusBadge}</td>
            <td>${formatDate(u.created_at)}</td>
            <td><span class="badge badge-secondary">${
              u.creator_name || "النظام"
            }</span></td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="openEditModal(${
                  u.id
                }, ${u.role_id}, ${u.is_active}, ${u.manager_id})">
                    <i class="fas fa-edit"></i> تعديل
                </button>
            </td>

        `;
    tbody.appendChild(row);
  });
}

function populateManagerDropdown(elementId, excludeId) {
  const select = document.getElementById(elementId);
  if (!select) return;
  select.innerHTML = '<option value="">-- لا يوجد --</option>';

  managerList.forEach((u) => {
    // Can't manage self
    if (excludeId && u.id == excludeId) return;

    const option = document.createElement("option");
    option.value = u.id;
    option.textContent = u.username + (u.role === "admin" ? " (Admin)" : "");
    select.appendChild(option);
  });
}

// Make globally available for onclick
window.openEditModal = function (id, roleId, isActive, managerId) {
  document.getElementById("editUserId").value = id;
  document.getElementById("edit_role_id").value = roleId;
  document.getElementById("editIsActive").checked = isActive == 1;

  populateManagerDropdown("editManager", id);
  if (managerId) {
    document.getElementById("editManager").value = managerId;
  }

  openDialog("editUserModal");
};
