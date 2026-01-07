let products = [];
let currentProductId = null;
let currentPage = 1;
let itemsPerPage = 20;
let totalItems = 0;

// Initialize
document.addEventListener("DOMContentLoaded", async function () {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  // Setup UI permissions
  if (!canAccess("products", "create")) {
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
        loadProducts();
      }, 400); // 400ms debounce
    });
  }

  await loadCategories();
  await loadProducts();
});

// Load categories
async function loadCategories() {
  try {
    const response = await fetch(`${API_BASE}?action=categories`, {
      method: "GET",
      credentials: "include",
    });
    const result = await response.json();
    if (result.success) {
      const select = document.getElementById("product-category");
      if (!select) return;
      const currentValue = select.value;
      select.innerHTML = '<option value="">اختر الفئة...</option>';
      result.data.forEach((cat) => {
        const opt = document.createElement("option");
        opt.value = cat.name;
        opt.textContent = cat.name;
        select.appendChild(opt);
      });
      if (currentValue) select.value = currentValue;
    }
  } catch (error) {
    console.error("Error loading categories", error);
  }
}

// Load products
async function loadProducts() {
  try {
    const searchInput = document.getElementById("params-search");
    const searchValue = searchInput ? searchInput.value : "";

    const response = await fetch(
      `${API_BASE}?action=products&page=${currentPage}&limit=${itemsPerPage}&search=${encodeURIComponent(
        searchValue
      )}`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    const result = await response.json();
    if (result.success) {
      products = result.data;
      totalItems = result.pagination.total_records;
      renderProducts();

      // Centralized numeric pagination
      renderPagination(result.pagination, "pagination-controls", (newPage) => {
        currentPage = newPage;
        loadProducts();
      });
    }
  } catch (error) {
    showAlert("alert-container", "خطأ في تحميل المنتجات", "error");
  }
}

function renderProducts() {
  const tbody = document.getElementById("products-tbody");
  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" style="text-align: center; padding: 2rem;">لا توجد منتجات مسجلة</td></tr>';
    return;
  }

  tbody.innerHTML = products
    .map(
      (p) => `
        <tr class="animate-fade">
            <td data-label="الرقم">#${p.id}</td>
            <td data-label="الاسم"><strong>${escapeHtml(p.name)}</strong></td>
            <td data-label="الفئة">${escapeHtml(p.category) || "-"}</td>
            <td data-label="سعر الوحدة">${formatCurrency(p.unit_price)}</td>
            <td data-label="هامش الربح">${formatCurrency(
              p.minimum_profit_margin
            )}</td>
            <td data-label="المخزون"><span class="stat-value" style="font-size: 1.1rem; color: ${
              p.stock_quantity < 10 ? "var(--danger-color)" : "inherit"
            }">${p.stock_quantity} ${
        escapeHtml(p.sub_unit_name) || "حبة"
      }</span></td>
            <td data-label="بواسطة"><span class="badge badge-secondary">${
              escapeHtml(p.creator_name) || "النظام"
            }</span></td>
            <td data-label="الإجراءات">
                <div class="action-buttons">
                    <button class="icon-btn view" onclick="viewProduct(${
                      p.id
                    })" title="عرض">${getIcon("eye")}</button>
                    ${
                      canAccess("products", "edit")
                        ? `<button class="icon-btn edit" onclick="editProduct(${
                            p.id
                          })" title="تعديل">${getIcon("edit")}</button>`
                        : ""
                    }
                    ${
                      canAccess("products", "delete")
                        ? `<button class="icon-btn delete" onclick="deleteProduct(${
                            p.id
                          })" title="حذف">${getIcon("trash")}</button>`
                        : ""
                    }
                </div>
            </td>
        </tr>
    `
    )
    .join("");
}

function openAddDialog() {
  currentProductId = null;
  const title = document.getElementById("dialog-title");
  if (title) title.textContent = "إضافة منتج جديد";
  const form = document.getElementById("product-form");
  if (form) form.reset();
  const idInput = document.getElementById("product-id");
  if (idInput) idInput.value = "";
  openDialog("product-dialog");
}

function viewProduct(id) {
  const p = products.find((item) => item.id == id);
  if (!p) return;

  const viewBody = document.getElementById("view-dialog-body");
  if (!viewBody) return;

  viewBody.innerHTML = `
        <div class="invoice-items-minimal">
            <div class="item-row-minimal">
                <div class="item-info-pkg">
                    <span class="stat-label">اسم المنتج</span>
                    <span class="item-name-pkg">${escapeHtml(p.name)}</span>
                </div>
                <div class="item-info-pkg">
                    <span class="stat-label">الفئة</span>
                    <span class="item-name-pkg">${
                      escapeHtml(p.category) || "-"
                    }</span>
                </div>
            </div>
            <div class="item-row-minimal">
                <div class="item-info-pkg">
                    <span class="stat-label">الوصف</span>
                    <span class="item-name-pkg">${
                      escapeHtml(p.description) || "لا يوجد وصف"
                    }</span>
                </div>
            </div>
            <div class="form-row">
                <div class="item-row-minimal">
                    <div class="item-info-pkg">
                        <span class="stat-label">سعر الوحدة</span>
                        <span class="item-name-pkg">${formatCurrency(
                          p.unit_price
                        )}</span>
                    </div>
                </div>
                <div class="item-row-minimal">
                    <div class="item-info-pkg">
                        <span class="stat-label">هامش الربح</span>
                        <span class="item-name-pkg">${formatCurrency(
                          p.minimum_profit_margin
                        )}</span>
                    </div>
                </div>
            </div>
            <div class="item-row-minimal">
                <div class="item-info-pkg">
                    <span class="stat-label">تفاصيل الوحدات</span>
                    <span class="item-name-pkg">1 ${
                      escapeHtml(p.unit_name) || "كرتون"
                    } = ${p.items_per_unit || 1} ${
    escapeHtml(p.sub_unit_name) || "حبة"
  }</span>
                </div>
            </div>
            <div class="item-row-minimal" style="background: ${
              p.stock_quantity < 10 ? "#fff1f2" : "var(--surface-hover)"
            }">
                <div class="item-info-pkg">
                    <span class="stat-label">الكمية المتوفرة</span>
                    <span class="item-name-pkg" style="color: ${
                      p.stock_quantity < 10
                        ? "var(--danger-color)"
                        : "var(--primary-color)"
                    }">${p.stock_quantity} ${
    escapeHtml(p.sub_unit_name) || "حبة"
  }</span>
                </div>
            </div>
        </div>
    `;
  openDialog("view-dialog");
}

function editProduct(id) {
  const p = products.find((item) => item.id == id);
  if (!p) return;

  currentProductId = id;
  const title = document.getElementById("dialog-title");
  if (title) title.textContent = "تعديل بيانات المنتج";

  document.getElementById("product-id").value = p.id;
  document.getElementById("product-name").value = p.name;
  document.getElementById("product-category").value = p.category || "";
  document.getElementById("product-description").value = p.description || "";
  document.getElementById("product-unit-price").value = p.unit_price;
  document.getElementById("product-min-margin").value = p.minimum_profit_margin;
  document.getElementById("product-stock").value = p.stock_quantity;
  document.getElementById("product-unit-name").value = p.unit_name || "كرتون";
  document.getElementById("product-items-per-unit").value =
    p.items_per_unit || 1;
  document.getElementById("product-sub-unit-name").value =
    p.sub_unit_name || "حبة";

  openDialog("product-dialog");
}

async function saveProduct() {
  const name = document.getElementById("product-name").value;
  const category = document.getElementById("product-category").value;
  const description = document.getElementById("product-description").value;
  const unit_price = document.getElementById("product-unit-price").value;
  const minimum_profit_margin =
    document.getElementById("product-min-margin").value;
  const stock_quantity = document.getElementById("product-stock").value;
  const unit_name = document.getElementById("product-unit-name").value;
  const items_per_unit = document.getElementById(
    "product-items-per-unit"
  ).value;
  const sub_unit_name = document.getElementById("product-sub-unit-name").value;

  if (!name || !unit_price) {
    showAlert("alert-container", "اسم المنتج والسعر مطلوبان", "error");
    return;
  }

  const btn = document.getElementById("save-product-btn");
  if (btn) btn.disabled = true;

  try {
    const method = currentProductId ? "PUT" : "POST";
    const body = {
      name,
      category,
      description,
      unit_price: parseFloat(unit_price),
      minimum_profit_margin: parseFloat(minimum_profit_margin || 0),
      stock_quantity: parseInt(stock_quantity || 0),
      unit_name,
      items_per_unit: parseInt(items_per_unit || 1),
      sub_unit_name,
    };
    if (currentProductId) body.id = currentProductId;

    const response = await fetch(`${API_BASE}?action=products`, {
      method: method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    const result = await response.json();
    if (result.success) {
      showAlert("alert-container", "تم الحفظ بنجاح", "success");
      closeDialog("product-dialog");
      await loadProducts();
    } else {
      showAlert("alert-container", result.message, "error");
    }
  } catch (e) {
    showAlert("alert-container", "خطأ في الاتصال", "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function deleteProduct(id) {
  if (!(await showConfirm("هل أنت متأكد من حذف هذا المنتج نهائياً؟"))) return;

  try {
    const response = await fetch(`${API_BASE}?action=products&id=${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const result = await response.json();
    if (result.success) {
      showAlert("alert-container", "تم الحذف بنجاح", "success");
      await loadProducts();
    } else {
      showAlert("alert-container", result.message, "error");
    }
  } catch (e) {
    showAlert("alert-container", "خطأ في الحذف", "error");
  }
}

// Category management
function openAddCategoryDialog() {
  const form = document.getElementById("category-form");
  if (form) form.reset();
  openDialog("category-dialog");
}

async function saveCategory() {
  const nameInput = document.getElementById("new-category-name");
  if (!nameInput) return;
  const name = nameInput.value;
  if (!name) return;

  try {
    const response = await fetch(`${API_BASE}?action=categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name }),
    });
    const result = await response.json();
    if (result.success) {
      await loadCategories();
      const catSelect = document.getElementById("product-category");
      if (catSelect) catSelect.value = name;
      closeDialog("category-dialog");
    } else {
      alert(result.message);
    }
  } catch (e) {
    console.error(e);
  }
}
