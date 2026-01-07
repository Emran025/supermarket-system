let purchases = [];
let products = [];
let currentPurchaseId = null;
let currentPage = 1;
let itemsPerPage = 20;
let totalItems = 0;

// Initialize
document.addEventListener("DOMContentLoaded", async function () {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  // Setup UI permissions
  if (!canAccess("purchases", "create")) {
    const addBtn = document.querySelector('button[onclick="openAddDialog()"]');
    if (addBtn) addBtn.style.display = "none";
  }

  // Setup Search
  const searchInput = document.getElementById("params-search");
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener("input", (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentPage = 1; // Reset to first page on search
        loadPurchases();
      }, 400); // 400ms debounce
    });
  }

  await loadProducts();
  await loadPurchases();
});

// Load purchases
async function loadPurchases() {
  try {
    const searchInput = document.getElementById("params-search");
    const searchValue = searchInput ? searchInput.value : "";

    const response = await fetch(
      `${API_BASE}?action=purchases&page=${currentPage}&limit=${itemsPerPage}&search=${encodeURIComponent(
        searchValue
      )}`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    const result = await response.json();
    if (result.success) {
      purchases = result.data;
      totalItems = result.pagination.total_records;
      renderPurchases();

      // Centralized numeric pagination
      renderPagination(result.pagination, "pagination-controls", (newPage) => {
        currentPage = newPage;
        loadPurchases();
      });
    }
  } catch (error) {
    showAlert("alert-container", "خطأ في تحميل المشتريات", "error");
  }
}

// Load products for dropdown
async function loadProducts() {
  try {
    const response = await fetch(`${API_BASE}?action=products`, {
      method: "GET",
      credentials: "include",
    });
    const result = await response.json();
    if (result.success) {
      products = result.data;
      const select = document.getElementById("purchase-product");
      if (!select) return;
      select.innerHTML = '<option value="">-- اختر منتجاً --</option>';
      products.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        select.appendChild(opt);
      });
      select.addEventListener("change", onPurchaseUnitChange);
    }
  } catch (error) {
    console.error("Error loading products", error);
  }
}

function onPurchaseUnitChange() {
  const productId = document.getElementById("purchase-product").value;
  const unitType = document.getElementById("purchase-unit-type").value;
  const infoLabel = document.getElementById("unit-info-label");

  if (!productId) {
    if (infoLabel) infoLabel.textContent = "";
    return;
  }

  const p = products.find((item) => item.id == productId);
  if (!p) {
    if (infoLabel) infoLabel.textContent = "";
    return;
  }

  if (infoLabel) {
    if (unitType === "main") {
      infoLabel.textContent = `الكرتون الواحد يحتوي على ${
        p.items_per_unit || 1
      } ${p.sub_unit_name || "حبة"}`;
    } else {
      infoLabel.textContent = `الشراء بالوحدة الفردية (${
        p.sub_unit_name || "حبة"
      })`;
    }
  }
}

function renderPurchases() {
  const tbody = document.getElementById("purchases-tbody");
  if (!tbody) return;

  if (purchases.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align: center; padding: 2rem;">لا توجد مشتريات مسجلة</td></tr>';
    return;
  }

  tbody.innerHTML = purchases
    .map((p) => {
      const createdDate = new Date(p.purchase_date);
      const hoursPassed = (new Date() - createdDate) / (1000 * 60 * 60);
      const canEdit = hoursPassed < 24;

      let expiryWarning = "";
      if (p.expiry_date) {
        const expiryDate = new Date(p.expiry_date);
        const today = new Date();
        const diffTime = expiryDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
          expiryWarning = `<br><span class="badge badge-danger" style="font-size: 0.7rem;">منتهي الصلاحية</span>`;
        } else if (diffDays <= 30) {
          expiryWarning = `<br><span class="badge badge-warning" style="font-size: 0.7rem;">تنتهي الصلاحية خلال ${diffDays} يوم</span>`;
        }
      }

      return `
            <tr class="animate-fade">
                <td>#${p.id}</td>
                <td>
                    <strong>${p.product_name}</strong>
                    ${expiryWarning}
                </td>
                <td>${p.quantity} ${
        p.unit_type === "main"
          ? p.unit_name || "كرتون"
          : p.sub_unit_name || "حبة"
      }</td>
                <td>${formatCurrency(p.invoice_price)}</td>
                <td>${formatDate(p.purchase_date)}</td>
                <td><span class="badge badge-secondary">${
                  p.recorder_name || "النظام"
                }</span></td>
                <td>

                    <div class="action-buttons">
                        <button class="icon-btn view" onclick="viewPurchase(${
                          p.id
                        })" title="عرض">${getIcon("eye")}</button>
                        ${
                          canEdit && canAccess("purchases", "edit")
                            ? `<button class="icon-btn edit" onclick="editPurchase(${
                                p.id
                              })" title="تعديل">${getIcon("edit")}</button>`
                            : ""
                        }
                        ${
                          canEdit && canAccess("purchases", "delete")
                            ? `<button class="icon-btn delete" onclick="deletePurchase(${
                                p.id
                              })" title="حذف">${getIcon("trash")}</button>`
                            : ""
                        }
                    </div>
                </td>
            </tr>
        `;
    })
    .join("");
}

function openAddDialog() {
  currentPurchaseId = null;
  const title = document.getElementById("purchase-dialog-title");
  if (title) title.textContent = "إضافة شراء جديد";

  const form = document.getElementById("purchase-form");
  if (form) form.reset();

  const dateInput = document.getElementById("purchase-date");
  if (dateInput) {
    dateInput.value = new Date().toISOString().slice(0, 16);
  }

  setFormDisabled(false);
  const saveBtn = document.getElementById("save-purchase-btn");
  if (saveBtn) saveBtn.style.display = "inline-flex";

  openDialog("purchase-dialog");
}

function viewPurchase(id) {
  const p = purchases.find((item) => item.id == id);
  if (!p) return;

  const viewBody = document.getElementById("view-dialog-body");
  if (!viewBody) return;

  viewBody.innerHTML = `
        <div class="invoice-items-minimal">
            <div class="item-row-minimal">
                <div class="item-info-pkg">
                    <span class="stat-label">المنتج</span>
                    <span class="item-name-pkg">${p.product_name}</span>
                </div>
            </div>
            <div class="form-row">
                <div class="item-row-minimal">
                    <div class="item-info-pkg">
                        <span class="stat-label">الكمية</span>
                        <span class="item-name-pkg">${p.quantity} ${
    p.unit_type === "main" ? p.unit_name || "كرتون" : p.sub_unit_name || "حبة"
  }</span>
                    </div>
                </div>
                <div class="item-row-minimal">
                    <div class="item-info-pkg">
                        <span class="stat-label">سعر الفاتورة</span>
                        <span class="item-name-pkg">${formatCurrency(
                          p.invoice_price
                        )}</span>
                    </div>
                </div>
            </div>
            <div class="form-row">
                <div class="item-row-minimal">
                    <div class="item-info-pkg">
                        <span class="stat-label">تاريخ الإنتاج</span>
                        <span class="item-name-pkg">${
                          p.production_date || "غير محدد"
                        }</span>
                    </div>
                </div>
                <div class="item-row-minimal">
                    <div class="item-info-pkg">
                        <span class="stat-label">تاريخ الانتهاء</span>
                        <span class="item-name-pkg">${
                          p.expiry_date || "غير محدد"
                        }</span>
                    </div>
                </div>
            </div>
            <div class="item-row-minimal">
                <div class="item-info-pkg">
                    <span class="stat-label">تاريخ الشراء</span>
                    <span class="item-name-pkg">${formatDate(
                      p.purchase_date
                    )}</span>
                </div>
            </div>
        </div>
    `;
  openDialog("view-dialog");
}

function editPurchase(id) {
  const p = purchases.find((item) => item.id == id);
  if (!p) return;

  currentPurchaseId = id;
  const title = document.getElementById("purchase-dialog-title");
  if (title) title.textContent = "تعديل بيانات الشراء";

  document.getElementById("purchase-product").value = p.product_id;
  document.getElementById("purchase-unit-type").value = p.unit_type || "sub";
  document.getElementById("purchase-quantity").value = p.quantity;
  document.getElementById("purchase-price").value = p.invoice_price;
  document.getElementById("purchase-production").value =
    p.production_date || "";
  document.getElementById("purchase-expiry").value = p.expiry_date || "";
  document.getElementById("purchase-date").value = new Date(p.purchase_date)
    .toISOString()
    .slice(0, 16);
  onPurchaseUnitChange();

  setFormDisabled(false);
  const saveBtn = document.getElementById("save-purchase-btn");
  if (saveBtn) saveBtn.style.display = "inline-flex";

  openDialog("purchase-dialog");
}

function setFormDisabled(disabled) {
  const form = document.getElementById("purchase-form");
  if (!form) return;
  const elements = form.querySelectorAll("input, select");
  elements.forEach((el) => (el.disabled = disabled));
}

async function savePurchase() {
  const product_id = document.getElementById("purchase-product").value;
  const quantity = document.getElementById("purchase-quantity").value;
  const unit_type = document.getElementById("purchase-unit-type").value;
  const invoice_price = document.getElementById("purchase-price").value;
  const production_date = document.getElementById("purchase-production").value;
  const expiry_date = document.getElementById("purchase-expiry").value;
  const purchase_date = document.getElementById("purchase-date").value;

  if (!product_id || !quantity || !invoice_price || !expiry_date) {
    showAlert(
      "alert-container",
      "يرجى ملء جميع الحقول المطلوبة بما في ذلك تاريخ الانتهاء",
      "error"
    );
    return;
  }

  const btn = document.getElementById("save-purchase-btn");
  if (btn) btn.disabled = true;

  try {
    const method = currentPurchaseId ? "PUT" : "POST";
    const body = {
      product_id: parseInt(product_id),
      quantity: parseInt(quantity),
      unit_type: unit_type,
      invoice_price: parseFloat(invoice_price),
      production_date: production_date || null,
      expiry_date: expiry_date,
      purchase_date: purchase_date + ":00",
    };
    if (currentPurchaseId) body.id = currentPurchaseId;

    const response = await fetch(`${API_BASE}?action=purchases`, {
      method: method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    const result = await response.json();
    if (result.success) {
      showAlert("alert-container", "تم الحفظ بنجاح", "success");
      closeDialog("purchase-dialog");
      await loadPurchases();
    } else {
      showAlert("alert-container", result.message, "error");
    }
  } catch (e) {
    showAlert("alert-container", "خطأ في الاتصال بالسيرفر", "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function deletePurchase(id) {
  if (!(await showConfirm("هل أنت متأكد من حذف هذا السجل؟"))) return;

  try {
    const response = await fetch(`${API_BASE}?action=purchases&id=${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const result = await response.json();
    if (result.success) {
      showAlert("alert-container", "تم الحذف بنجاح", "success");
      await loadPurchases();
    } else {
      showAlert("alert-container", result.message, "error");
    }
  } catch (e) {
    showAlert("alert-container", "خطأ في الحذف", "error");
  }
}

// Purchase Requests Management
async function openRequestsDialog() {
  openDialog("requests-dialog");
  await loadRequests();
}

async function loadRequests() {
  const tbody = document.getElementById("requests-table-body");
  tbody.innerHTML =
    '<tr><td colspan="6" class="text-center">جاري التحميل...</td></tr>';

  try {
    let res = await fetchAPI("requests");
    if (res.success) {
      renderRequestsTable(res.data);
    } else {
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center text-danger">فشل تحميل البيانات</td></tr>';
    }
  } catch (e) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="text-center text-danger">خطأ في الاتصال</td></tr>';
  }
}

function renderRequestsTable(requests) {
  const tbody = document.getElementById("requests-table-body");
  if (!requests || requests.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="text-center">لا توجد طلبات معلقة</td></tr>';
    return;
  }

  tbody.innerHTML = requests
    .map(
      (r) => `
        <tr class="${r.status === "completed" ? "bg-light text-muted" : ""}">
            <td>${r.display_name || r.product_name || "-"}</td>
            <td>${r.quantity}</td>
            <td>${r.notes || "-"}</td>
            <td><span class="badge badge-info">${
              r.requester || "System"
            }</span></td>
            <td>
                <span class="badge badge-${
                  r.status === "completed" ? "success" : "warning"
                }">
                    ${r.status === "completed" ? "مكتمل" : "معلق"}
                </span>
            </td>
            <td>
                ${
                  r.status !== "completed"
                    ? `
                <button class="btn btn-sm btn-primary" onclick="convertToPurchase(${r.id}, '${r.display_name}', ${r.product_id}, ${r.quantity})">
                    <i class="fas fa-arrow-right"></i> شراء
                </button>
                <button class="btn btn-sm btn-success" onclick="markRequestDone(${r.id})" title="Mark as Done">
                    <i class="fas fa-check"></i>
                </button>
                `
                    : '<i class="fas fa-check text-success"></i>'
                }
            </td>
        </tr>
    `
    )
    .join("");
}

function convertToPurchase(reqId, name, prodId, qty) {
  closeDialog("requests-dialog");
  openAddDialog();

  // Pre-fill
  if (prodId) {
    const select = document.getElementById("purchase-product");
    select.value = prodId;
    onPurchaseUnitChange();
  }
  document.getElementById("purchase-quantity").value = qty;

  // We could store reqId to mark it done automatically after save?
  // For now, let's keep it manual or simple.
}

async function markRequestDone(id) {
  if (!confirm("هل تريد تغيير الحالة إلى مكتمل؟")) return;

  const res = await fetchAPI("requests", "PUT", {
    id: id,
    status: "completed",
  });
  if (res.success) {
    loadRequests(); // Reload list
  } else {
    alert("Failed");
  }
}

function printRequests() {
  const tableBody = document.getElementById("requests-table-body");
  if (
    !tableBody ||
    (tableBody.rows.length <= 1 && tableBody.rows[0].cells.length === 6)
  ) {
    // Simple check if empty or loading
    if (tableBody.textContent.includes("لا توجد")) {
      showToast("لا توجد بيانات للطباعة", "error");
      return;
    }
  }

  // Clone table to new window/iframe or build string
  // Let's build a simple HTML string for the popup
  const requests = Array.from(tableBody.querySelectorAll("tr"))
    .map((tr) => {
      const cells = tr.querySelectorAll("td");
      // If it's a message row
      if (cells.length === 1) return null;

      return {
        product: cells[0].textContent,
        qty: cells[1].textContent,
        notes: cells[2].textContent,
        requester: cells[3].textContent,
        status: cells[4].textContent.trim(),
      };
    })
    .filter((r) => r);

  const now = new Date().toLocaleString("ar-SA");

  const printContent = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>طباعة طلبات الشراء</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px; direction: rtl; }
                h2 { text-align: center; margin-bottom: 20px; }
                .meta { text-align: center; color: #666; margin-bottom: 30px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
                th { background-color: #f8f9fa; }
                @media print {
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <h2>قائمة طلبات الشراء / النواقص</h2>
            <div class="meta">تاريخ الطباعة: ${now}</div>
            
            <table>
                <thead>
                    <tr>
                        <th>المنتج / الصنف</th>
                        <th>الكمية المطلوبة</th>
                        <th>ملاحظات</th>
                        <th>مقدم الطلب</th>
                        <th>الحالة</th>
                    </tr>
                </thead>
                <tbody>
                    ${requests
                      .map(
                        (r) => `
                        <tr>
                            <td>${r.product}</td>
                            <td>${r.qty}</td>
                            <td>${r.notes}</td>
                            <td>${r.requester}</td>
                            <td>${r.status}</td>
                        </tr>
                    `
                      )
                      .join("")}
                </tbody>
            </table>

            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `;

  const printWindow = window.open("", "_blank", "width=800,height=600");
  printWindow.document.write(printContent);
  printWindow.document.close();
}
