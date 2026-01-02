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

// Check authentication and setup UI
async function checkAuth() {
  const result = await fetchAPI("check");
  if (result.success) {
    const user = result.user;
    setupSidebar(user);

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
    { href: "products.html", icon: "box", text: "المنتجات" },
    { href: "purchases.html", icon: "download", text: "المشتريات" },
  ];

  const adminLinks = [
    { href: "users.html", icon: "users", text: "إدارة المستخدمين" },
    { href: "settings.html", icon: "settings", text: "الإعدادات" },
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

  // Add toggle button if it doesn't exist
  if (!sidebar.querySelector(".sidebar-toggle-btn")) {
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "sidebar-toggle-btn";
    toggleBtn.innerHTML = getIcon("chevronRight");
    sidebar.appendChild(toggleBtn);

    toggleBtn.addEventListener("click", () => {
      const collapsed = sidebar.classList.toggle("collapsed");
      content?.classList.toggle("expanded");
      localStorage.setItem("sidebarCollapsed", collapsed);
    });
  }

  // Initial state check
  const isCollapsed = localStorage.getItem("sidebarCollapsed") === "true";
  if (isCollapsed) {
    sidebar.classList.add("collapsed");
    content?.classList.add("expanded");
  } else {
    sidebar.classList.remove("collapsed");
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
  const formattedTotal = parseFloat(inv.total_amount).toFixed(2);
  const formattedVat = "0.00"; // Assuming tax is inclusive or already in total

  const tlvData = generateTLV({
    1: settings.store_name || "سوبر ماركت الوفاء",
    2: settings.tax_number || "310122393500003", // Official Sample TRN if empty
    3: isoTimestamp,
    4: formattedTotal,
    5: formattedVat,
  });

  // Generate QR locally if not provided (increase quiet zone for printed invoices)
  const qrUrl = qrDataUrl || generateQRCode(tlvData, isThermal ? 12 : 28);

  const style = `
        <style>
            @page { 
                margin: 0; 
                size: ${isThermal ? "80mm auto" : "A4"};
            }
            body { 
                font-family: 'Inter', 'Segoe UI', Tahoma, sans-serif; 
                direction: rtl; 
                margin: 0; 
                padding: ${isThermal ? "5mm" : "15mm"};
                color: #1a1a1a;
                background: white;
                line-height: 1.4;
            }
            .invoice-container {
                width: ${isThermal ? "70mm" : "auto"};
                max-width: ${isThermal ? "70mm" : "800px"};
                margin: 0 auto;
            }
            .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .header h1 { margin: 0 0 5px 0; font-size: ${
              isThermal ? "1.4rem" : "2rem"
            }; font-weight: 800; }
            .header p { margin: 2px 0; font-size: 0.85rem; color: #444; }
            
            .invoice-meta { 
                display: flex; 
                justify-content: space-between; 
                margin: 15px 0; 
                font-size: 0.85rem;
                background: #f9f9f9;
                padding: 8px;
                border-radius: 4px;
            }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 0.85rem; }
            th { text-align: right; border-bottom: 1px solid #000; padding: 8px 2px; font-weight: 700; }
            td { padding: 8px 2px; border-bottom: 1px solid #eee; }
            
            .totals { 
                margin-top: 10px;
                border-top: 2px solid #000;
                padding-top: 8px;
            }
            .total-row { 
                display: flex; 
                justify-content: space-between; 
                padding: 4px 0;
            }
            .total-row.grand-total { 
                font-weight: 800; 
                font-size: 1.2rem; 
                margin-top: 5px;
                background: #000;
                color: #fff;
                padding: 8px;
                border-radius: 4px;
            }
            
            .footer { 
                text-align: center; 
                margin-top: 25px; 
                font-size: 0.8rem;
                border-top: 1px dashed #ccc;
                padding-top: 15px;
            }
            .qr-code {
                margin: 15px auto;
                width: 100%;
                max-width: ${isThermal ? "140px" : "320px"};
                height: auto;
                display: block;
            }
            .barcode {
                /* increase spacing so barcode isn't cramped against previous section */
                margin: 20px auto 16px;
                width: 100%;
                max-width: 100%;
                height: auto;
                display: block;
            }
            .watermark {
                position: fixed;
                bottom: 10px;
                left: 10px;
                font-size: 0.6rem;
                color: #ccc;
            }

            @media print {
                body { padding: ${isThermal ? "0" : "15mm"}; }
                .invoice-container { width: 100%; }
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
                    <div class="total-row">
                        <span>المجموع الفرعي:</span>
                        <span>${localFormatCurrency(inv.total_amount)}</span>
                    </div>
                    <div class="total-row grand-total">
                        <span>الإجمالي النهائي:</span>
                        <span>${localFormatCurrency(inv.total_amount)}</span>
                    </div>
                </div>

                <div class="footer">
                    <!-- Render barcode image directly (no external library) -->
                    <img src="${qrUrl}" class="barcode" alt="Barcode">

                    <p><strong>${
                      settings.footer_message || "شكراً لزيارتكم!"
                    }</strong></p>
                    <p>الموظف: ${inv.salesperson_name || "المسؤول"}</p>
                    <p style="font-size: 0.7rem; color: #777;">نظام إدارة السوبر ماركت الذكي</p>
                </div>
            </div>
            <div class="watermark">Supermarket System v1.0</div>
        </body>
        </html>
    `;
}
