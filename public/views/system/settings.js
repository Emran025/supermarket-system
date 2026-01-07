// Global state for Roles management
let allRoles = [];
let allModules = {};
let selectedRoleId = null;

// Pagination for sessions
let currentPage = 1;
let totalItems = 0;
const itemsPerPage = 10;

// Define global functions at top level so they are available immediately
window.openCreateRoleModal = function () {
  const form = document.getElementById("createRoleForm");
  if (form) form.reset();
  openDialog("createRoleModal");
};

window.selectRole = async function (roleId) {
  selectedRoleId = roleId;
  renderRoles();

  // IDs from API might be strings, IDs from onclick are numbers
  const role = allRoles.find((r) => r.id == roleId);
  if (!role) {
    console.error(
      "Role not found for ID:",
      roleId,
      "Total roles:",
      allRoles.length
    );
    return;
  }

  const permissionsLoading = document.getElementById("permissionsLoading");
  const permissionsEditor = document.getElementById("permissionsEditor");
  const selectedRoleName = document.getElementById("selectedRoleName");
  const selectedRoleDesc = document.getElementById("selectedRoleDesc");
  const btnDeleteRole = document.getElementById("btnDeleteRole");

  if (permissionsLoading) permissionsLoading.style.display = "none";
  if (permissionsEditor) permissionsEditor.style.display = "block";

  if (selectedRoleName) selectedRoleName.textContent = role.role_name_ar;
  if (selectedRoleDesc)
    selectedRoleDesc.textContent = role.description || "لا يوجد وصف";

  if (btnDeleteRole)
    btnDeleteRole.style.display = role.is_system ? "none" : "block";

  // Show loading state in permissions grid
  const permissionsGrid = document.getElementById("permissionsGrid");
  if (permissionsGrid) {
    permissionsGrid.innerHTML = `
      <div class="empty-state animate-fade">
          <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i>
          <p>جاري تحميل الصلاحيات...</p>
      </div>
    `;
  }

  await loadRolePermissions(roleId);
};

document.addEventListener("DOMContentLoaded", async function () {
  // 1. Custom Premium Dropdown Logic
  const dropdownTrigger = document.getElementById("dropdownTrigger");
  const settingsDropdown = document.getElementById("settingsDropdown");
  const dropdownMenu = document.getElementById("dropdownMenu");

  if (dropdownTrigger && settingsDropdown) {
    dropdownTrigger.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      settingsDropdown.classList.toggle("active");
    });

    document.addEventListener("click", function (e) {
      if (
        settingsDropdown.classList.contains("active") &&
        !settingsDropdown.contains(e.target)
      ) {
        settingsDropdown.classList.remove("active");
      }
    });

    if (dropdownMenu) {
      dropdownMenu.addEventListener("click", function (e) {
        const item = e.target.closest(".dropdown-item");
        if (item) {
          e.stopPropagation();
          const tabId = item.getAttribute("data-value");
          switchTab(tabId);
          settingsDropdown.classList.remove("active");
        }
      });
    }
  }

  // 3. Setup Listeners
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      switchTab(btn.getAttribute("data-tab"))
    );
  });

  document.querySelectorAll(".save-trigger").forEach((btn) => {
    btn.addEventListener("click", saveSettings);
  });

  document
    .getElementById("preview-invoice-btn")
    ?.addEventListener("click", previewInvoice);
  document.getElementById("print-test-btn")?.addEventListener("click", () => {
    const iframe = document.getElementById("preview-iframe");
    if (iframe) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
  });

  const settingInputs = [
    "store_name",
    "store_address",
    "store_phone",
    "tax_number",
    "invoice_size",
    "footer_message",
    "currency_symbol",
  ];
  settingInputs.forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => {
      if (
        document
          .getElementById("preview-invoice-dialog")
          ?.classList.contains("active")
      ) {
        renderPreview();
      }
    });
  });

  document
    .getElementById("changePasswordForm")
    ?.addEventListener("submit", handlePasswordChange);
  document
    .getElementById("btnSavePermissions")
    ?.addEventListener("click", saveRolePermissions);
  document
    .getElementById("btnDeleteRole")
    ?.addEventListener("click", deleteRole);
  document
    .getElementById("createRoleForm")
    ?.addEventListener("submit", handleCreateRole);

  // 2. Fetch User & Load Data (Robust Parallel Loading)
  try {
    const user = await checkAuth();
    if (!user) return;

    window.currentUser = user;

    const canManageRoles = canAccess("roles_permissions", "view");
    const canManageSettings = canAccess("settings", "view");

    // Parallel load core data
    const loadPromises = [];
    if (canManageSettings) loadPromises.push(loadSettings());
    loadPromises.push(loadSessions());
    if (canManageRoles) loadPromises.push(initRolesManagement());

    // Choose default active tab
    let activeTab = "account";
    if (canManageSettings) activeTab = "store";

    // Permission-based UI cleanup
    const hideSection = (value) => {
      document
        .querySelectorAll(`.dropdown-item[data-value="${value}"]`)
        .forEach((i) => i.remove());
      document
        .querySelectorAll(`.tab-btn[data-tab="${value}"]`)
        .forEach((t) => (t.style.display = "none"));
    };

    if (!canManageSettings) {
      hideSection("store");
      hideSection("invoices");
    }
    if (!canManageRoles) hideSection("roles");

    switchTab(activeTab);

    // Wait for all to finish in background (don't block switchTab)
    Promise.all(
      loadPromises.map((p) =>
        p.catch((err) => {
          console.error("Partial settings load failed:", err);
        })
      )
    ).then(() => {
      console.log("All settings data loaded");
    });
  } catch (err) {
    console.error("Settings initialization failed", err);
    showToast("حدث خطأ أثناء تحميل الإعدادات", "error");
  }
});

/**
 * Switch between settings tabs
 */
function switchTab(tabId) {
  if (!tabId) return;
  const cleanId = tabId.trim();

  // 1. Update buttons (for desktop)
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    const isMatched = btn.getAttribute("data-tab") === cleanId;
    btn.classList.toggle("active", isMatched);
  });

  // 2. Update custom dropdown (for mobile)
  const selectedTabText = document.getElementById("selectedTabText");
  const dropdownMenu = document.getElementById("dropdownMenu");

  if (selectedTabText && dropdownMenu) {
    const activeItem = dropdownMenu.querySelector(
      `.dropdown-item[data-value="${cleanId}"]`
    );
    if (activeItem) {
      selectedTabText.textContent = activeItem.textContent.trim();

      // Update active state in menu
      dropdownMenu.querySelectorAll(".dropdown-item").forEach((item) => {
        item.classList.toggle(
          "active",
          item.getAttribute("data-value") === cleanId
        );
      });
    }
  }

  // 3. Update content sections
  let found = false;
  document.querySelectorAll(".tab-content").forEach((content) => {
    const targetId = `tab-${cleanId}`;
    if (content.id === targetId) {
      content.style.display = "block";
      content.classList.add("active");
      found = true;
    } else {
      content.style.display = "none";
      content.classList.remove("active");
    }
  });

  if (!found) {
    console.error("Tab content not found for ID:", cleanId);
  }
}

async function handlePasswordChange(e) {
  e.preventDefault();

  const currentPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (newPassword !== confirmPassword) {
    showToast("كلمتا المرور غير متطابقتين", "error");
    return;
  }

  try {
    const response = await fetchAPI("change_password", "POST", {
      current_password: currentPassword,
      new_password: newPassword,
    });

    if (response.success) {
      showToast("تم تغيير كلمة المرور بنجاح", "success");
      document.getElementById("changePasswordForm").reset();
    } else {
      showToast(response.message || "فشل تغيير كلمة المرور", "error");
    }
  } catch (error) {
    console.error("Error changing password:", error);
    showToast("حدث خطأ أثناء الاتصال بالخادم", "error");
  }
}

async function loadSessions() {
  const tbody = document.getElementById("sessionsTable");
  if (!tbody) return;

  try {
    const response = await fetch(
      `${API_BASE}?action=my_sessions&page=${currentPage}&limit=${itemsPerPage}`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    const result = await response.json();
    if (result.success) {
      const sessions = result.data;
      totalItems = result.pagination.total_records;
      tbody.innerHTML = "";

      if (sessions.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="4" style="text-align: center; padding: 20px;">لا توجد جلسات نشطة</td></tr>';
        return;
      }

      sessions.forEach((session) => {
        const isCurrent = session.is_current;
        const row = document.createElement("tr");
        row.innerHTML = `
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">
                        <div class="session-agent" title="${
                          session.user_agent
                        }" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;">
                            <i class="fas fa-desktop"></i> ${getBrowserName(
                              session.user_agent
                            )}
                        </div>
                    </td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">${
                      session.ip_address || "Unknown"
                    }</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 0.75rem;">${formatDate(
                      session.created_at
                    )}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">
                        ${
                          isCurrent
                            ? '<span class="badge badge-success" style="font-size: 0.7rem;">الحالية</span>'
                            : '<span class="badge badge-secondary" style="font-size: 0.7rem;">سابقة</span>'
                        }
                    </td>
                `;
        tbody.appendChild(row);
      });

      renderPagination(result.pagination, "pagination-controls", (newPage) => {
        currentPage = newPage;
        loadSessions();
      });
    }
  } catch (error) {
    console.error("Error loading sessions:", error);
  }
}

function getBrowserName(userAgent) {
  if (!userAgent) return "جهاز غير معروف";
  if (userAgent.includes("Chrome")) return "Chrome";
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Safari")) return "Safari";
  if (userAgent.includes("Edge")) return "Edge";
  return "متصفح آخر";
}

async function previewInvoice() {
  const previewBtn = document.getElementById("preview-invoice-btn");
  const originalHtml = previewBtn.innerHTML;
  previewBtn.disabled = true;
  previewBtn.innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> جاري التحميل...';

  try {
    await renderPreview();
    openDialog("preview-invoice-dialog");
  } catch (error) {
    console.error("Preview error", error);
    showToast("حدث خطأ أثناء المعاينة", "error");
  } finally {
    previewBtn.disabled = false;
    previewBtn.innerHTML = originalHtml;
  }
}

async function renderPreview() {
  const keys = [
    "store_name",
    "store_address",
    "store_phone",
    "tax_number",
    "invoice_size",
    "footer_message",
    "currency_symbol",
  ];
  const settings = {};
  keys.forEach((key) => {
    const input = document.getElementById(key);
    if (input) settings[key] = input.value;
  });

  const res = await fetchAPI("invoices&page=1&per_page=1");
  if (!res.success || !res.data || res.data.length === 0) {
    showToast("لا توجد مبيعات سابقة لإجراء المعاينة", "error");
    return;
  }

  const sampleId = res.data[0].id;
  const detailRes = await fetchAPI(`invoice_details&id=${sampleId}`);
  if (!detailRes.success) return;

  const inv = detailRes.data;
  const content = generateInvoiceHTML(inv, settings);

  const iframe = document.getElementById("preview-iframe");
  if (iframe) {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(content);
    doc.close();
  }
}

async function loadSettings() {
  const result = await fetchAPI("settings");
  if (result.success) {
    const settings = result.data;
    for (const key in settings) {
      const input = document.getElementById(key);
      if (input) {
        input.value = settings[key];
      }
    }
  } else {
    showToast("فشل تحميل الإعدادات", "error");
  }
}

async function saveSettings(e) {
  const saveBtn = e.currentTarget;
  const originalText = saveBtn.textContent;
  saveBtn.disabled = true;
  saveBtn.textContent = "جاري الحفظ...";

  const keys = [
    "store_name",
    "store_address",
    "store_phone",
    "tax_number",
    "invoice_size",
    "footer_message",
    "currency_symbol",
  ];
  const data = {};

  keys.forEach((key) => {
    const input = document.getElementById(key);
    if (input) {
      data[key] = input.value;
    }
  });

  try {
    const result = await fetchAPI("settings", "POST", data);
    if (result.success) {
      showToast("تم حفظ الإعدادات بنجاح", "success");
      if (typeof systemSettings !== "undefined") {
        systemSettings = null;
      }
    } else {
      showToast(result.message || "حدث خطأ أثناء الحفظ", "error");
    }
  } catch (error) {
    showToast("خطأ في الاتصال بالخادم", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = originalText;
  }
}

// --- Roles & Permissions Management Functions ---

async function initRolesManagement() {
  await loadRoles();
  await loadModules();
}

window.loadRoles = async function () {
  const rolesList = document.getElementById("rolesList");
  try {
    const response = await fetchAPI("roles");
    if (response.success) {
      allRoles = response.data;
      if (allRoles.length === 0) {
        if (rolesList) {
          rolesList.innerHTML = `
            <div class="empty-state animate-fade">
                <i class="fas fa-user-shield" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                <p>لا توجد أدوار مضافة حالياً</p>
            </div>
          `;
        }
        return;
      }
      renderRoles();

      // If no role is selected, select the first one automatically
      if (!selectedRoleId && allRoles.length > 0) {
        selectRole(allRoles[0].id);
      }
    } else {
      throw new Error(response.message || "فشل تحميل الأدوار");
    }
  } catch (error) {
    console.error("Load roles error:", error);
    if (rolesList) {
      rolesList.innerHTML = `
        <div class="empty-state error animate-fade">
            <i class="fas fa-exclamation-circle text-danger" style="font-size: 2rem; margin-bottom: 1rem;"></i>
            <p>${error.message}</p>
            <button class="btn btn-secondary btn-sm mt-3" onclick="loadRoles()">
               <i class="fas fa-sync"></i> إعادة المحاولة
            </button>
        </div>
      `;
    }
  }
};

async function loadModules() {
  try {
    const response = await fetchAPI("modules");
    if (response.success) {
      allModules = response.data;
    }
  } catch (error) {
    console.error("Load modules error:", error);
  }
}

function renderRoles() {
  const rolesList = document.getElementById("rolesList");
  if (!rolesList) return;

  rolesList.innerHTML = allRoles
    .map(
      (role) => `
         <div class="role-item ${selectedRoleId == role.id ? "active" : ""}" 
              onclick="selectRole(${role.id})">
             <div class="role-info">
                 <h4>${role.role_name_ar} ${
        role.is_system ? '<span class="badge-system">نظام</span>' : ""
      }</h4>
                 <p>${role.user_count} مستخدم</p>
             </div>
             <i class="fas fa-chevron-left" style="opacity: 0.5"></i>
         </div>
     `
    )
    .join("");
}

async function loadRolePermissions(roleId) {
  const response = await fetchAPI(`role_permissions&role_id=${roleId}`);
  if (response.success) {
    renderPermissions(response.data);
  }
}

function renderPermissions(rolePermissions) {
  const permissionsGrid = document.getElementById("permissionsGrid");
  if (!permissionsGrid) return;

  let html = "";
  const categories = {
    sales: "المبيعات والإيرادات",
    inventory: "المخازن والمنتجات",
    purchases: "المشتريات والمصروفات",
    people: "العملاء والموردين",
    finance: "المحاسبة والمالية",
    reports: "التقارير والميزانية",
    system: "إدارة النظام",
    hr: "الموارد البشرية",
    other: "أخرى",
  };

  const grouped = {};
  rolePermissions.forEach((p) => {
    const cat = p.category || "other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  });

  const catOrder = [
    "sales",
    "inventory",
    "purchases",
    "people",
    "finance",
    "reports",
    "system",
    "hr",
    "other",
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
                        }> عرض
                    </label>
                    <label class="action-checkbox">
                        <input type="checkbox" data-action="create" ${
                          module.can_create ? "checked" : ""
                        }> إضافة
                    </label>
                    <label class="action-checkbox">
                        <input type="checkbox" data-action="edit" ${
                          module.can_edit ? "checked" : ""
                        }> تعديل
                    </label>
                    <label class="action-checkbox">
                        <input type="checkbox" data-action="delete" ${
                          module.can_delete ? "checked" : ""
                        }> حذف
                    </label>
                </div>
            </div>
        `;
    });
    html += `</div>`;
  });

  permissionsGrid.innerHTML = html;
}

async function saveRolePermissions() {
  if (!selectedRoleId) return;

  const btn = document.getElementById("btnSavePermissions");
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "جاري الحفظ...";

  const permissionsGrid = document.getElementById("permissionsGrid");
  const permissionRows = permissionsGrid.querySelectorAll(".module-row");
  const permissions = [];

  permissionRows.forEach((row) => {
    const moduleId = row.dataset.moduleId;
    const canView = row.querySelector('[data-action="view"]').checked;
    const canCreate = row.querySelector('[data-action="create"]').checked;
    const canEdit = row.querySelector('[data-action="edit"]').checked;
    const canDelete = row.querySelector('[data-action="delete"]').checked;

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
    showToast("تم حفظ الصلاحيات بنجاح", "success");
    if (selectedRoleId === window.currentUser?.role_id) {
      showToast(
        "ملاحظة: تحتاج لإعادة تسجيل الدخول لتطبيق التغييرات على حسابك",
        "info"
      );
    }
  } else {
    showToast(response.message || "فشل حفظ الصلاحيات", "error");
  }

  btn.disabled = false;
  btn.textContent = originalText;
}

async function handleCreateRole(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());

  const response = await fetchAPI("create_role", "POST", data);
  if (response.success) {
    closeDialog("createRoleModal");
    showToast("تم إضافة الدور بنجاح", "success");
    await loadRoles();
    selectRole(response.id);
  } else {
    showToast(response.message || "فشل إضافة الدور", "error");
  }
}

async function deleteRole() {
  const role = allRoles.find((r) => r.id === selectedRoleId);
  if (!role || role.is_system) return;

  if (!confirm(`هل أنت متأكد من حذف دور "${role.role_name_ar}"؟`)) return;

  const response = await fetchAPI("roles", "DELETE", { id: selectedRoleId });
  if (response.success) {
    showToast("تم حذف الدور بنجاح", "success");
    selectedRoleId = null;
    document.getElementById("permissionsEditor").style.display = "none";
    document.getElementById("permissionsLoading").style.display = "flex";
    await loadRoles();
  } else {
    showToast(response.message || "فشل حذف الدور", "error");
  }
}
