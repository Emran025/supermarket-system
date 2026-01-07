const API_BASE = "../domain/api.php";

// SVG Icons (Extended)
const icons = {
  plus: '<svg class="icon" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
  edit: '<svg class="icon" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
  trash:
    '<svg class="icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
  eye: '<svg class="icon" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
  check:
    '<svg class="icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>',
  print:
    '<svg class="icon" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>',
  box: '<svg class="icon" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>',
  download:
    '<svg class="icon" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>',
  cart: '<svg class="icon" viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>',
  logout:
    '<svg class="icon" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>',
  x: '<svg class="icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
  alert:
    '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
  home: '<svg class="icon" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
  users:
    '<svg class="icon" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
  user: '<svg class="icon" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
  chevronRight:
    '<svg class="icon" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>',
  settings:
    '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
  dollar:
    '<svg class="icon" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
  building:
    '<svg class="icon" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="18"></line><line x1="13" y1="22" x2="13" y2="18"></line><line x1="17" y1="22" x2="17" y2="18"></line></svg>',
  lock: '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
  unlock:
    '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.33-2.22"></path></svg>',
};

function getIcon(name) {
  return icons[name] || "";
}

// Wrapper for fetch to handle repetitive tasks
async function fetchAPI(action, method = "GET", body = null) {
  const options = {
    method: method,
    headers: {},
    credentials: "include",
  };

  if (body) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(
      `${API_BASE}?action=${action.replace("?", "&")}`,
      options
    );

    if (response.status === 401) {
      window.location.href = "login.html";
      return { success: false, message: "Unauthorized" };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("API Error:", error);
    return { success: false, message: "Network error" };
  }
}

// Global settings cache
let systemSettings = null;

async function getSettings() {
  if (systemSettings) return systemSettings;
  try {
    const result = await fetchAPI("settings");
    if (result.success) {
      systemSettings = result.data;
      return systemSettings;
    }
  } catch (e) {
    console.error("Failed to load settings", e);
  }
  return {};
}

/**
 * Simulates checking printer connection for a professional UX
 * @returns {Promise<boolean>}
 */
function checkPrinterConnection() {
  return new Promise((resolve) => {
    // Show a small overlay or toast
    showToast("جاري التحقق من اتصال الطابعة...", "info");

    // Simulate check
    setTimeout(() => {
      // In a real web app, we might check if a local print agent is responding
      // For now, we simulate success
      resolve(true);
    }, 800);
  });
}

// Update current date with specific format
function updateCurrentDate() {
  const dateEl = document.getElementById("current-date");
  if (dateEl) {
    const now = new Date();
    const days = [
      "الأحد",
      "الاثنين",
      "الثلاثاء",
      "الأربعاء",
      "الخميس",
      "الجمعة",
      "السبت",
    ];
    const months = [
      "يناير",
      "فبراير",
      "مارس",
      "أبريل",
      "مايو",
      "يونيو",
      "يوليو",
      "أغسطس",
      "سبتمبر",
      "أكتوبر",
      "نوفمبر",
      "ديسمبر",
    ];

    const dayName = days[now.getDay()];
    const day = now.getDate();
    const monthName = months[now.getMonth()];
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");

    dateEl.textContent = `${dayName}، ${day} ${monthName} , ${year} - ${hours}:${minutes}`;
  }
}

// Check authentication and setup UI
async function checkAuth() {
  const result = await fetchAPI("check");
  if (result.success) {
    const user = result.user;
    setupSidebar(user);
    updateCurrentDate();
    setInterval(updateCurrentDate, 1000);

    // Update user name and role badge
    const nameDisplay = document.getElementById("userNameDisplay");
    if (nameDisplay) nameDisplay.textContent = user.username;

    const roleBadge = document.getElementById("userRoleBadge");
    if (roleBadge) {
      const is_admin = user.role === "admin";
      roleBadge.textContent = is_admin ? "مدير النظام" : "مبيعات";
      roleBadge.className = `badge ${
        is_admin ? "badge-primary" : "badge-secondary"
      }`;
      roleBadge.style.display = "inline-block";
    }

    return user;
  } else {
    window.location.href = "login.html";
    return null;
  }
}

function setupSidebar(user) {
  const nav = document.querySelector(".sidebar-nav");
  if (!nav) return;

  const commonLinks = [
    { href: "dashboard.html", icon: "home", text: "لوحة التحكم" },
    { href: "sales.html", icon: "cart", text: "المبيعات" },
    { href: "deferred_sales.html", icon: "cart", text: "مبيعات آجلة" },
    { href: "ar_customers.html", icon: "users", text: "العملاء والديون" },
    { href: "products.html", icon: "box", text: "المنتجات" },
    { href: "purchases.html", icon: "download", text: "المشتريات" },
    { href: "expenses.html", icon: "dollar", text: "المصروفات" },
    { href: "revenues.html", icon: "plus", text: "الإيرادات الإضافية" },
    { href: "assets.html", icon: "building", text: "الأصول" },
    { href: "general_ledger.html", icon: "dollar", text: "دفتر الأستاذ العام" },
    { href: "journal_vouchers.html", icon: "edit", text: "سندات القيد" },
    { href: "reconciliation.html", icon: "check", text: "التسوية البنكية" },
    {
      href: "accrual_accounting.html",
      icon: "dollar",
      text: "المحاسبة الاستحقاقية",
    },
    {
      href: "recurring_transactions.html",
      icon: "check",
      text: "المعاملات المتكررة",
    },
    { href: "chart_of_accounts.html", icon: "box", text: "دليل الحسابات" },
    { href: "reports.html", icon: "eye", text: "الميزانية والتقارير" },
  ];

  const adminLinks = [
    { href: "users.html", icon: "users", text: "إدارة المستخدمين" },
    { href: "settings.html", icon: "settings", text: "الإعدادات" },
    { href: "audit_trail.html", icon: "eye", text: "سجل التدقيق" },
    { href: "fiscal_periods.html", icon: "dollar", text: "الفترات المالية" },
  ];

  let links = [...commonLinks];
  if (user.role === "admin") {
    links = [...links, ...adminLinks];
  }

  const currentPath =
    window.location.pathname.split("/").pop() || "dashboard.html";

  nav.innerHTML =
    links
      .map(
        (link) => `
        <a href="${link.href}" class="${
          link.href === currentPath ? "active" : ""
        }">
            ${getIcon(link.icon)} <span>${link.text}</span>
        </a>
    `
      )
      .join("") +
    `
    <a href="#" class="logout-btn">
        ${getIcon("logout")} <span>تسجيل الخروج</span>
    </a>
    `;

  // Re-attach logout listener if it was cleared
  nav.querySelector(".logout-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    logout();
  });

  setupCollapseToggle();
}

function setupCollapseToggle() {
  const sidebar = document.querySelector(".sidebar");
  const content = document.querySelector(".content");
  if (!sidebar) return;

  // Add toggle button if it doesn't exist (Check body first/globally)
  let toggleBtn = document.querySelector(".sidebar-toggle-btn");
  if (!toggleBtn) {
    toggleBtn = document.createElement("button");
    toggleBtn.className = "sidebar-toggle-btn";
    toggleBtn.innerHTML = getIcon("chevronRight");
    document.body.appendChild(toggleBtn);
  } else if (toggleBtn.parentNode !== document.body) {
    // If button exists but isn't in body (e.g., inside sidebar), move it
    toggleBtn.parentNode.removeChild(toggleBtn);
    document.body.appendChild(toggleBtn);
  }

  // Create overlay for mobile
  let overlay = document.querySelector(".sidebar-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "sidebar-overlay";
    document.body.appendChild(overlay);

    overlay.addEventListener("click", () => {
      sidebar.classList.remove("mobile-visible");
      overlay.classList.remove("active");
      toggleBtn.classList.remove("mobile-open");
    });
  }

  // Remove old event listeners by cloning
  const newToggleBtn = toggleBtn.cloneNode(true);
  toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);
  toggleBtn = newToggleBtn;

  toggleBtn.addEventListener("click", () => {
    if (window.innerWidth <= 1024) {
      // Mobile / Tablet logic
      const isVisible = sidebar.classList.toggle("mobile-visible");
      toggleBtn.classList.toggle("mobile-open", isVisible);

      if (isVisible) {
        overlay.classList.add("active");
        sidebar.classList.remove("collapsed");
        document.body.classList.remove("sidebar-is-collapsed"); // Ensure body state matches
      } else {
        overlay.classList.remove("active");
      }
    } else {
      // Desktop logic
      const collapsed = sidebar.classList.toggle("collapsed");
      document.body.classList.toggle("sidebar-is-collapsed", collapsed); // Sync body class
      content?.classList.toggle("expanded");
      localStorage.setItem("sidebarCollapsed", collapsed);
    }
  });

  // Handle Resize Events
  window.addEventListener("resize", () => {
    if (window.innerWidth > 1024) {
      // Desktop: Reset mobile states
      sidebar.classList.remove("mobile-visible");
      overlay.classList.remove("active");
      toggleBtn.classList.remove("mobile-open");

      // Restore desktop state from storage
      const isCollapsed = localStorage.getItem("sidebarCollapsed") === "true";
      if (isCollapsed) {
        sidebar.classList.add("collapsed");
        document.body.classList.add("sidebar-is-collapsed");
        content?.classList.add("expanded");
      } else {
        sidebar.classList.remove("collapsed");
        document.body.classList.remove("sidebar-is-collapsed");
        content?.classList.remove("expanded");
      }
    } else {
      // Mobile: Reset desktop collapsed states so full menu shows
      sidebar.classList.remove("collapsed");
      document.body.classList.remove("sidebar-is-collapsed");
      content?.classList.remove("expanded");
    }
  });

  // Initial state check
  if (window.innerWidth > 1024) {
    const isCollapsed = localStorage.getItem("sidebarCollapsed") === "true";
    if (isCollapsed) {
      sidebar.classList.add("collapsed");
      document.body.classList.add("sidebar-is-collapsed");
      content?.classList.add("expanded");
    } else {
      sidebar.classList.remove("collapsed");
      document.body.classList.remove("sidebar-is-collapsed");
      content?.classList.remove("expanded");
    }
  } else {
    // Mobile initial
    sidebar.classList.remove("collapsed");
    document.body.classList.remove("sidebar-is-collapsed");
    content?.classList.remove("expanded");
  }
}

// Logout
async function logout() {
  await fetchAPI("logout", "POST");
  window.location.href = "login.html";
}

document.getElementById("logoutBtn")?.addEventListener("click", logout);

// Toast Notification
function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  if (!toast) {
    // Fallback to alert if toast element doesn't exist
    alert(message);
    return;
  }

  toast.textContent = message;
  toast.className = `toast show ${type}`;

  setTimeout(() => {
    toast.className = toast.className.replace("show", "");
  }, 3000);
}

// Alert Notification (inline)
function showAlert(containerId, message, type = "success") {
  const container = document.getElementById(containerId);
  if (!container) {
    showToast(message, type);
    return;
  }

  const alertDiv = document.createElement("div");
  alertDiv.className = `alert alert-${type} animate-fade`;
  alertDiv.style.margin = "1rem 0";
  alertDiv.style.padding = "1rem";
  alertDiv.style.borderRadius = "var(--radius-md)";
  alertDiv.style.backgroundColor = type === "error" ? "#fee2e2" : "#dcfce7";
  alertDiv.style.color = type === "error" ? "#991b1b" : "#166534";
  alertDiv.style.border = `1px solid ${
    type === "error" ? "#fecaca" : "#bbf7d0"
  }`;
  alertDiv.textContent = message;

  container.innerHTML = "";
  container.appendChild(alertDiv);

  if (type !== "error") {
    setTimeout(() => {
      alertDiv.style.opacity = "0";
      alertDiv.style.transition = "opacity 0.5s ease";
      setTimeout(() => alertDiv.remove(), 500);
    }, 5000);
  }
}

// Format currency
function formatCurrency(amount) {
  return (
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + " ر.ي"
  );
}

// Format date
function formatDate(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString("en-US");
}

// Sidebar Toggle (Mobile)
document.getElementById("sidebarToggle")?.addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("active");
});

// Dialog management
function openDialog(dialogId) {
  const dialog = document.getElementById(dialogId);
  if (dialog) {
    dialog.classList.add("active");
    document.body.style.overflow = "hidden"; // Prevent scroll
  }
}

function closeDialog(dialogId) {
  const dialog = document.getElementById(dialogId);
  if (dialog) {
    dialog.classList.remove("active");
    document.body.style.overflow = "auto";
  }
}

// Close dialog on overlay click
document.addEventListener("click", function (e) {
  if (e.target.classList.contains("dialog-overlay")) {
    closeDialog(e.target.id);
  }
});

let confirmResolve = null;

function showConfirm(message) {
  return new Promise((resolve) => {
    const dialog = document.getElementById("confirm-dialog");
    const messageEl = document.getElementById("confirm-message");
    const yesBtn = document.getElementById("confirm-yes-btn");

    if (!dialog || !messageEl || !yesBtn) {
      resolve(confirm(message));
      return;
    }

    messageEl.textContent = message;
    confirmResolve = resolve;

    // Clone to remove listeners
    const newYesBtn = yesBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);

    newYesBtn.addEventListener("click", () => {
      closeConfirmDialog(true);
    });

    openDialog("confirm-dialog");
  });
}

function closeConfirmDialog(result) {
  const resolve = confirmResolve;
  confirmResolve = null;
  closeDialog("confirm-dialog");
  if (resolve) {
    resolve(result);
  }
}

// Override closeDialog for confirm logic
const originalCloseDialog = closeDialog;
closeDialog = function (dialogId) {
  originalCloseDialog(dialogId);
  if (dialogId === "confirm-dialog" && confirmResolve) {
    const resolve = confirmResolve;
    confirmResolve = null;
    resolve(false);
  }
};

/**
 * Render standard numeric pagination
 * @param {Object} pagination - Pagination metadata from API
 * @param {String} containerId - ID of the container element
 * @param {Function} onPageChange - Callback when a page is clicked
 */
/**
 * Render standard numeric pagination (sequential format)
 * @param {Object} pagination - Pagination metadata from API
 * @param {String} containerId - ID of the container element
 * @param {Function} onPageChange - Callback when a page is clicked
 */
function renderPagination(pagination, containerId, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Clear container
  container.innerHTML = "";

  // Hide if no records or only one page
  if (
    !pagination ||
    pagination.total_records <= pagination.per_page ||
    pagination.total_pages <= 1
  ) {
    container.style.display = "none";
    return;
  }

  container.style.display = "flex";

  const { current_page, total_pages } = pagination;
  const controls = document.createElement("div");
  controls.className = "pagination-controls";

  // Previous Button
  const prevBtn = document.createElement("button");
  prevBtn.className = "pagination-btn nav-btn";
  prevBtn.innerHTML =
    '<i class="fas fa-chevron-right" style="margin-left: 5px;"></i> السابق'; // RTL: chevron right is previous
  prevBtn.disabled = current_page <= 1;
  prevBtn.onclick = (e) => {
    e.preventDefault();
    onPageChange(current_page - 1);
  };
  controls.appendChild(prevBtn);

  // Logic: 1, 2, ... current ... Last-1, Last
  const pages = new Set();
  pages.add(1);
  if (total_pages >= 2) pages.add(2);
  pages.add(current_page);
  if (total_pages - 1 >= 1) pages.add(total_pages - 1);
  pages.add(total_pages);

  const sortedPages = Array.from(pages).sort((a, b) => a - b);
  const finalPages = [];

  for (let i = 0; i < sortedPages.length; i++) {
    if (i > 0 && sortedPages[i] - sortedPages[i - 1] > 1) {
      finalPages.push("...");
    }
    finalPages.push(sortedPages[i]);
  }

  finalPages.forEach((p) => {
    if (p === "...") {
      const span = document.createElement("span");
      span.className = "pagination-ellipsis";
      span.textContent = "...";
      controls.appendChild(span);
    } else {
      const pageBtn = document.createElement("button");
      pageBtn.className = `pagination-btn ${
        p === current_page ? "active" : ""
      }`;
      pageBtn.textContent = p;
      pageBtn.onclick = (e) => {
        e.preventDefault();
        if (p !== current_page) onPageChange(p);
      };
      controls.appendChild(pageBtn);
    }
  });

  // Next Button
  const nextBtn = document.createElement("button");
  nextBtn.className = "pagination-btn nav-btn";
  nextBtn.innerHTML =
    'التالي <i class="fas fa-chevron-left" style="margin-right: 5px;"></i>'; // RTL: chevron left is next
  nextBtn.disabled = current_page >= total_pages;
  nextBtn.onclick = (e) => {
    e.preventDefault();
    onPageChange(current_page + 1);
  };
  controls.appendChild(nextBtn);

  container.appendChild(controls);
}

/**
 * Generates a Base64 encoded TLV string for E-Invoicing compliance (e.g., ZATCA Phase 1)
 */
function generateTLV(tags) {
  const binaryParts = [];

  for (const tagId in tags) {
    const tag = parseInt(tagId);
    const value = String(tags[tagId]);

    // Tag Id
    binaryParts.push(tag);

    // Value Length
    const encodedValue = new TextEncoder().encode(value);
    binaryParts.push(encodedValue.length);

    // Value Bytes
    for (const byte of encodedValue) {
      binaryParts.push(byte);
    }
  }

  // Convert to binary string correctly for btoa
  const uint8Array = new Uint8Array(binaryParts);
  let binaryString = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binaryString += String.fromCharCode(uint8Array[i]);
  }

  return btoa(binaryString);
}

/**
 * Helper to generate a barcode-like image (Data URL).
 * This replaces the previous QR Code generator for invoice printing.
 * It encodes the input text into a sequence of bits and renders
 * narrow/wide vertical bars on a canvas, then returns a data URL.
 */
function generateQRCode(text, padding = 20) {
  try {
    const input = String(text || "");
    const bytes = new TextEncoder().encode(input);

    // Convert bytes to a stream of bits, add a 0 separator between bytes for variation
    const bits = [];
    for (const b of bytes) {
      for (let i = 7; i >= 0; i--) {
        bits.push((b >> i) & 1);
      }
      bits.push(0);
    }

    if (bits.length === 0) return "";

    // Collapse consecutive identical bits into segments
    const segments = [];
    let curr = bits[0],
      cnt = 1;
    for (let i = 1; i < bits.length; i++) {
      if (bits[i] === curr) cnt++;
      else {
        segments.push({ bit: curr, count: cnt });
        curr = bits[i];
        cnt = 1;
      }
    }
    segments.push({ bit: curr, count: cnt });

    // Render segments to canvas as alternating bars/spaces (1 = black bar, 0 = space)
    const unit = 1.6; // pixels per bit; tune to change look
    // `padding` is configurable (pixels) to control the quiet zone around the barcode
    const width = Math.round(
      segments.reduce((s, seg) => s + seg.count * unit, 0) + padding * 2
    );
    const height = 120;

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(120, width);
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    // background
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let x = padding;
    for (const seg of segments) {
      const segWidth = Math.max(1, Math.round(seg.count * unit));
      if (seg.bit === 1) {
        ctx.fillStyle = "#000";
        ctx.fillRect(x, 0, segWidth, canvas.height);
      }
      x += segWidth;
    }

    return canvas.toDataURL();
  } catch (e) {
    console.error("Barcode generation error", e);
    return "";
  }
}

/**
 * Generates the HTML content for an invoice based on provided settings and data.
 * @param {Object} inv - Invoice data
 * @param {Object} settings - System settings
 * @param {String} [qrDataUrl] - Optional pre-generated QR code data URL. If not provided, it will be generated.
 */
function generateInvoiceHTML(inv, settings, qrDataUrl) {
  const isThermal = (settings.invoice_size || "thermal") === "thermal";
  const currencySymbol = settings.currency_symbol || "ر.ي";

  // Format currency locally for the invoice (using saved symbol)
  const localFormatCurrency = (amount) => {
    return (
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount) +
      " " +
      currencySymbol
    );
  };

  // E-Invoicing Data Preparation
  // Ensure the date is in valid ISO 8601 format (KSA/GCC Standard)
  const dateObj = inv.created_at ? new Date(inv.created_at) : new Date();
  const isoTimestamp = dateObj.toISOString().split(".")[0] + "Z";
  const formattedTotal = parseFloat(inv.total_amount || 0).toFixed(2);
  const formattedVat = parseFloat(
    inv.vat_amount || inv.tax_amount || 0
  ).toFixed(2); // prefer explicit VAT if provided

  // Compute amounts (fallbacks if specific fields are missing)
  const subtotalAmount =
    inv.subtotal !== undefined
      ? parseFloat(inv.subtotal)
      : inv.items
      ? inv.items.reduce(
          (s, it) =>
            s +
            parseFloat(
              it.subtotal ?? (it.quantity * (it.unit_price || 0) || 0)
            ),
          0
        )
      : parseFloat(inv.total_amount || 0);

  const taxAmount =
    inv.vat_amount !== undefined
      ? parseFloat(inv.vat_amount)
      : inv.tax_amount !== undefined
      ? parseFloat(inv.tax_amount)
      : 0;

  const discountAmount =
    inv.discount_amount !== undefined
      ? parseFloat(inv.discount_amount)
      : inv.discount !== undefined
      ? parseFloat(inv.discount)
      : 0;

  const finalTotal = parseFloat(
    inv.total_amount || subtotalAmount - discountAmount + taxAmount
  );

  const tlvData = generateTLV({
    1: settings.store_name || "سوبر ماركت الوفاء",
    2: settings.tax_number || "310122393500003", // Official Sample TRN if empty
    3: isoTimestamp,
    4: finalTotal.toFixed(2),
    5: (taxAmount || 0).toFixed(2),
  });

  // Generate QR locally if not provided (increase quiet zone for printed invoices)
  const qrUrl = qrDataUrl || generateQRCode(tlvData, isThermal ? 12 : 28);

  const style = `
        <style>
            :root{ --accent: #0f172a; --muted:#6b7280; --surface:#ffffff }
            @page { 
                margin: 0; 
                size: ${isThermal ? "80mm auto" : "A4"};
            }
            body { 
                font-family: 'Inter', 'Segoe UI', Tahoma, sans-serif; 
                direction: rtl; 
                margin: 0; 
                padding: ${isThermal ? "6mm" : "18mm"};
                color: #0b1220;
                background: var(--surface);
                line-height: 1.45;
                -webkit-font-smoothing:antialiased;
            }

            .invoice-container{
                width: ${isThermal ? "70mm" : "100%"};
                max-width: ${isThermal ? "70mm" : "820px"};
                margin: 0 auto;
                box-sizing: border-box;
                color: inherit;
            }

            .header{
              text-align:center;
              margin-bottom:14px;
              padding-bottom:10px;
              border-bottom:1px solid #e6e9ef
            }

            .header h1{
              margin:0 0 6px 0;
              font-size:${isThermal ? "1rem" : "1.6rem"};
              font-weight:700;
              color:var(--accent)
            }
            .header p{
              margin:0;
              font-size:0.85rem;
              color:var(--muted)
            }

            .invoice-meta{
              display:flex;
              justify-content:space-between;
              gap:12px;
              margin:14px 0;
              font-size:0.86rem
            }
            .invoice-meta div{
              color:var(--muted)
            }

            table{ width:100%;
              border-collapse:collapse;
              margin-bottom:14px;
              font-size:0.9rem
            }
            thead th{ text-align:right;
              font-weight:700;
              padding:8px 6px;
              background:#f7fafc;
              color:#0b1220;
              border-bottom:1px solid #e6e9ef }
            tbody td{
              padding:10px 6px;
              border-bottom:1px solid #f1f5f9;
              vertical-align:middle
            }

            tbody tr:nth-child(even) td{
              background: #fbfdff
            }

            td.numeric{
              text-align:left;
              font-variant-numeric: tabular-nums
            }
            td.center{
              text-align:center
            }

            .totals{
              margin-top:10px;
              padding-top:10px;
              border-top:1px solid #e6e9ef
            }
            .total-row{
              display:flex;
              justify-content:space-between;
              align-items:center;
              padding:6px 0;
              color:var(--muted)
            }
            .total-row small{
              display:block;
              font-size:0.8rem;
              color:#94a3b8 }

            .total-row.grand-total{
              font-weight:800;
              font-size:1.05rem;
              color:var(--accent);
              border-top:2px dashed #e6e9ef;
              padding-top:10px
            }

            .footer{
              text-align:center;
              margin-top:22px;
              font-size:0.82rem;
              color:var(--muted);
              border-top:1px dashed #e6e9ef;
              padding-top:12px
            }

            .barcode{
              margin:16px auto;
              display:block;
              max-width: 100%;
              height:50px;
            }

            .watermark{
              position:fixed;
              bottom:10px;
              left:10px;
              font-size:0.62rem;
              color:#e6e9ef
            }

            @media print{
                body{
                  padding:${isThermal ? "2mm" : "15mm"}
                }
                .invoice-container{
                  width:100%
                }
                thead th{
                  background-color:#f7fafc;
                  -webkit-print-color-adjust:exact
                }
            }
        </style>
    `;

  return `
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Invoice ${inv.invoice_number}</title>
            ${style}
        </head>
        <body>
            <div class="invoice-container">
                <div class="header">
                    <h1>${settings.store_name || "سوبر ماركت الوفاء"}</h1>
                    <p>${settings.store_address || "اليمن - صنعاء"}</p>
                    <p>هاتف: ${settings.store_phone || "777000000"}</p>
                    ${
                      settings.tax_number
                        ? `<p>الرقم الضريبي: <strong>${settings.tax_number}</strong></p>`
                        : ""
                    }
                </div>

                <div class="invoice-meta">
                    <div>
                        <strong>رقم الفاتورة:</strong> #${inv.invoice_number}
                    </div>
                    <div>
                        <strong>التاريخ:</strong> ${formatDate(inv.created_at)}
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>الصنف</th>
                            <th style="text-align:center">الكمية</th>
                            <th style="text-align:left">السعر</th>
                            <th style="text-align:left">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${inv.items
                          .map(
                            (i) => `
                            <tr>
                                <td>${i.product_name}</td>
                                <td style="text-align:center">${i.quantity}</td>
                                <td style="text-align:left">${i.unit_price}</td>
                                <td style="text-align:left">${localFormatCurrency(
                                  i.subtotal
                                )}</td>
                            </tr>
                        `
                          )
                          .join("")}
                    </tbody>
                </table>

                <div class="totals">
                    <div class="total-row grand-total">
                        <span>الإجمالي النهائي:</span>
                        <span>${localFormatCurrency(finalTotal)}</span>
                    </div>
                </div>

                <div class="footer">
                    <!-- Render barcode image directly (no external library) -->
                    <img src="${qrUrl}" class="barcode" alt="Barcode">

                    <p><strong>${
                      settings.footer_message || "شكراً لزيارتكم!"
                    }</strong></p>
                    <p>الموظف: ${inv.salesperson_name || "المسؤول"}</p>
                    <p style="font-size: 0.7rem;
              color: #777;">نظام إدارة السوبر ماركت الذكي</p>
                </div>
            </div>
            <div class="watermark">Supermarket System v1.0</div>
        </body>
        </html>
    `;
}
