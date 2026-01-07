document.addEventListener("DOMContentLoaded", async () => {
  const user = await checkAuth();
  if (!user) return;

  // Global state
  let allRoles = [];
  let allModules = {};
  let selectedRoleId = null;

  // Elements
  const rolesList = document.getElementById("rolesList");
  const permissionsEditor = document.getElementById("permissionsEditor");
  const permissionsLoading = document.getElementById("permissionsLoading");
  const permissionsGrid = document.getElementById("permissionsGrid");
  const selectedRoleName = document.getElementById("selectedRoleName");
  const selectedRoleDesc = document.getElementById("selectedRoleDesc");
  const btnDeleteRole = document.getElementById("btnDeleteRole");
  const btnSavePermissions = document.getElementById("btnSavePermissions");
  const createRoleForm = document.getElementById("createRoleForm");

  // Load Initial Data
  async function init() {
    await loadRoles();
    await loadModules();
  }

  // Load Roles
  async function loadRoles() {
    const response = await fetchAPI("roles");
    if (response.success) {
      allRoles = response.data;
      renderRoles();
    }
  }

  // Load Modules
  async function loadModules() {
    const response = await fetchAPI("modules");
    if (response.success) {
      allModules = response.data;
    }
  }

  // Render Roles List
  function renderRoles() {
    rolesList.innerHTML = allRoles
      .map(
        (role) => `
        <div class="role-item ${selectedRoleId === role.id ? "active" : ""}" 
             onclick="selectRole(${role.id})">
            <div class="role-info">
                <h4>${role.role_name_ar} ${
          role.is_system ? '<span class="badge-system">نظام</span>' : ""
        }</h4>
                <p>${role.user_count} مستخدم</p>
            </div>
            ${getIcon("chevron-left")}
        </div>
    `
      )
      .join("");
  }

  // Select Role
  window.selectRole = async function (roleId) {
    selectedRoleId = roleId;
    renderRoles();

    const role = allRoles.find((r) => r.id === roleId);
    if (!role) return;

    // Show editor
    permissionsLoading.style.display = "none";
    permissionsEditor.style.display = "block";

    // Set header info
    selectedRoleName.textContent = role.role_name_ar;
    selectedRoleDesc.textContent = role.description || "لا يوجد وصف";

    // Toggle delete button (only for non-system roles)
    btnDeleteRole.style.display = role.is_system ? "none" : "block";

    // Load permissions for this role
    await loadRolePermissions(roleId);
  };

  // Load Role Permissions
  async function loadRolePermissions(roleId) {
    const response = await fetchAPI(`role_permissions&role_id=${roleId}`);
    if (response.success) {
      renderPermissions(response.data);
    }
  }

  // Render Permissions Table
  function renderPermissions(rolePermissions) {
    let html = "";

    const categories = {
      sales: "المبيعات والإيرادات",
      inventory: "المخازن والمنتجات",
      purchases: "المشتريات والمصروفات",
      people: "العملاء والموردين",
      finance: "المحاسبة والمالية",
      reports: "التقارير والميزانية",
      system: "إدارة النظام",
      other: "أخرى",
    };

    // Group modules by category from the response (which includes module info)
    const grouped = {};
    rolePermissions.forEach((p) => {
      const cat = p.category || "other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });

    // Iterate through categories in specific order
    const catOrder = [
      "sales",
      "inventory",
      "purchases",
      "people",
      "finance",
      "reports",
      "system",
    ];

    catOrder.forEach((cat) => {
      if (!grouped[cat]) return;

      html += `
        <div class="permission-group">
            <div class="group-title">
                ${categories[cat] || cat}
            </div>
      `;

      grouped[cat].forEach((module) => {
        html += `
            <div class="module-row" data-module-id="${module.module_id}">
                <div class="module-name">${module.module_name_ar}</div>
                <div class="actions-grid">
                    <label class="action-checkbox">
                        <input type="checkbox" data-action="view" ${
                          module.can_view ? "checked" : ""
                        }>
                        عرض
                    </label>
                    <label class="action-checkbox">
                        <input type="checkbox" data-action="create" ${
                          module.can_create ? "checked" : ""
                        }>
                        إضافة
                    </label>
                    <label class="action-checkbox">
                        <input type="checkbox" data-action="edit" ${
                          module.can_edit ? "checked" : ""
                        }>
                        تعديل
                    </label>
                    <label class="action-checkbox">
                        <input type="checkbox" data-action="delete" ${
                          module.can_delete ? "checked" : ""
                        }>
                        حذف
                    </label>
                </div>
            </div>
        `;
      });

      html += `</div>`;
    });

    permissionsGrid.innerHTML = html;
  }

  // Save Permissions
  btnSavePermissions.addEventListener("click", async () => {
    if (!selectedRoleId) return;

    btnSavePermissions.disabled = true;
    btnSavePermissions.textContent = "جاري الحفظ...";

    const permissionRows = permissionsGrid.querySelectorAll(".module-row");
    const permissions = [];

    permissionRows.forEach((row) => {
      const moduleId = row.dataset.moduleId;
      const canView = row.querySelector('[data-action="view"]').checked;
      const canCreate = row.querySelector('[data-action="create"]').checked;
      const canEdit = row.querySelector('[data-action="edit"]').checked;
      const canDelete = row.querySelector('[data-action="delete"]').checked;

      // Only add if at least one checkbox is checked
      if (canView || canCreate || canEdit || canDelete) {
        permissions.push({
          module_id: moduleId,
          can_view: canView,
          can_create: canCreate,
          can_edit: canEdit,
          can_delete: canDelete,
        });
      }
    });

    const response = await fetchAPI("update_permissions", "POST", {
      role_id: selectedRoleId,
      permissions: permissions,
    });

    if (response.success) {
      showAlert("alert-container", "تم حفظ الصلاحيات بنجاح", "success");
      // If the current user's role was updated, we might need to tell them to refresh
      if (selectedRoleId === user.role_id) {
        showAlert(
          "alert-container",
          "ملاحظة: تحتاج لإعادة تسجيل الدخول لتطبيق التغييرات على حسابك",
          "info"
        );
      }
    } else {
      showAlert(
        "alert-container",
        response.message || "فشل حفظ الصلاحيات",
        "error"
      );
    }

    btnSavePermissions.disabled = false;
    btnSavePermissions.textContent = "حفظ الصلاحيات";
  });

  // Create Role
  window.openCreateRoleModal = function () {
    createRoleForm.reset();
    openDialog("createRoleModal");
  };

  createRoleForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(createRoleForm);
    const data = Object.fromEntries(formData.entries());

    const response = await fetchAPI("create_role", "POST", data);
    if (response.success) {
      closeDialog("createRoleModal");
      showAlert("alert-container", "تم إضافة الدور بنجاح", "success");
      await loadRoles();
      selectRole(response.id);
    } else {
      showAlert(
        "alert-container",
        response.message || "فشل إضافة الدور",
        "error"
      );
    }
  });

  // Delete Role
  btnDeleteRole.addEventListener("click", async () => {
    const role = allRoles.find((r) => r.id === selectedRoleId);
    if (!role || role.is_system) return;

    if (
      !confirm(
        `هل أنت متأكد من حذف دور "${role.role_name_ar}"؟ ستفقد كافة الصلاحيات المرتبطة به.`
      )
    ) {
      return;
    }

    const response = await fetchAPI("roles", "DELETE", { id: selectedRoleId });
    if (response.success) {
      showAlert("alert-container", "تم حذف الدور بنجاح", "success");
      selectedRoleId = null;
      permissionsEditor.style.display = "none";
      permissionsLoading.style.display = "flex";
      await loadRoles();
    } else {
      showAlert(
        "alert-container",
        response.message || "فشل حذف الدور",
        "error"
      );
    }
  });

  // Initialize
  init();
});
