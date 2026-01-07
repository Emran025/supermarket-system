let products = [];
let invoiceItems = [];
let invoices = [];
let selectedProduct = null;
let currentPage = 1;
let itemsPerPage = 20;
let totalItems = 0;

// Initialize
document.addEventListener("DOMContentLoaded", async function () {
  // Check authentication first
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  initProductSearch();
  initCustomerSearch(); // Add this
  await loadProducts();
  await loadInvoices();
  generateInvoiceNumber();
});

function generateInvoiceNumber() {
  const invoiceNumberInput = document.getElementById("invoice-number");
  invoiceNumberInput.value = "INV-" + Date.now().toString().slice(-8);
}

// Load products for dropdown
async function loadProducts() {
  try {
    const response = await fetch(
      `${API_BASE}?action=products&include_purchase_price=1&t=${Date.now()}`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    const result = await response.json();
    if (result.success) {
      products = result.data.filter((p) => p.stock_quantity > 0);
      // Removed select filling - handled by searchable search input
    }
  } catch (error) {
    showAlert(
      "alert-container",
      "خطأ في تحميل المنتجات: " + error.message,
      "error"
    );
  }
}

// Handle product selection from dropdown
function onProductSelect() {
  const productId = parseInt(document.getElementById("product-select").value);
  selectedProduct = products.find((p) => p.id == productId);

  if (selectedProduct) {
    // Calculate remaining stock considering items already in cart
    const cartItemEntries = invoiceItems.filter(
      (item) => item.product_id === selectedProduct.id
    );
    const cartQtyInSubUnits = cartItemEntries.reduce(
      (sum, item) => sum + item.total_sub_units,
      0
    );

    const availableStock = selectedProduct.stock_quantity - cartQtyInSubUnits;

    const stockInput = document.getElementById("item-stock");
    if (stockInput) stockInput.value = availableStock;

    const unitTypeSelect = document.getElementById("item-unit-type");
    unitTypeSelect.innerHTML = `
            <option value="sub">${
              selectedProduct.sub_unit_name || "حبة"
            }</option>
            <option value="main">${selectedProduct.unit_name || "كرتون"} (${
      selectedProduct.items_per_unit || 1
    } ${selectedProduct.sub_unit_name || "حبة"})</option>
        `;

    document.getElementById("item-unit-price").value =
      selectedProduct.unit_price;
    document.getElementById("item-quantity").value = 1;

    calculateSubtotal();

    if (availableStock <= 0) {
      document.getElementById("item-quantity").value = 0;
      document.getElementById("item-quantity").disabled = true;
      showAlert(
        "alert-container",
        "هذا المنتج نفد من المخزون (أو موجود بالكامل في الفاتورة)",
        "warning"
      );
    } else {
      document.getElementById("item-quantity").disabled = false;
    }
  } else {
    const stockInput = document.getElementById("item-stock");
    if (stockInput) stockInput.value = "";

    document.getElementById("item-unit-price").value = "";
    document.getElementById("item-quantity").value = 1;
    document.getElementById("item-subtotal").textContent = formatCurrency(0);
    document.getElementById("item-quantity").disabled = false;
    document.getElementById("item-unit-type").innerHTML =
      '<option value="sub">حبة</option><option value="main">كرتون</option>';

    // Reset search input if selection cleared
    const hiddenInput = document.getElementById("product-select");
    if (!hiddenInput.value) {
      document.getElementById("product-search-input").value = "";
    }
  }
}

// --- Product Search Functions ---
function initProductSearch() {
  const searchInput = document.getElementById("product-search-input");
  const optionsList = document.getElementById("product-options-list");

  searchInput.addEventListener("focus", () => {
    if (products.length > 0) renderProductOptions(products);
    optionsList.classList.add("active");
  });

  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.barcode && p.barcode.includes(query))
    );
    renderProductOptions(filtered);
    optionsList.classList.add("active");
  });

  searchInput.addEventListener("keydown", (e) => {
    const items = optionsList.querySelectorAll(".option-item");
    let activeIndex = Array.from(items).findIndex((item) =>
      item.classList.contains("selected")
    );

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (activeIndex < items.length - 1) {
        if (activeIndex >= 0) items[activeIndex].classList.remove("selected");
        activeIndex++;
        items[activeIndex].classList.add("selected");
        items[activeIndex].scrollIntoView({ block: "nearest" });
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (activeIndex > 0) {
        items[activeIndex].classList.remove("selected");
        activeIndex--;
        items[activeIndex].classList.add("selected");
        items[activeIndex].scrollIntoView({ block: "nearest" });
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) {
        items[activeIndex].click();
      }
    }
  });

  // Close when clicking outside
  document.addEventListener("click", (e) => {
    const container = document.getElementById("product-search-container");
    if (container && !container.contains(e.target)) {
      optionsList.classList.remove("active");
    }
  });
}

// --- Customer Search Functions ---
let customerSearchDebounce;
function initCustomerSearch() {
  const searchInput = document.getElementById("customer-search-input");
  const optionsList = document.getElementById("customer-options-list");

  if (!searchInput) return; // Not on deferred sales page

  searchInput.addEventListener("input", (e) => {
    const query = e.target.value;
    clearTimeout(customerSearchDebounce);

    if (query.length < 2) {
      optionsList.classList.remove("active");
      return;
    }

    customerSearchDebounce = setTimeout(async () => {
      try {
        const result = await fetchAPI(`ar_customers?limit=10&search=${query}`);
        if (result.success) {
          renderCustomerOptions(result.data);
          optionsList.classList.add("active");
        }
      } catch (e) {
        console.error(e);
      }
    }, 300);
  });

  // Close when clicking outside
  document.addEventListener("click", (e) => {
    const container = document.getElementById("customer-search-container");
    if (container && !container.contains(e.target)) {
      optionsList.classList.remove("active");
    }
  });
}

function renderCustomerOptions(customers) {
  const optionsList = document.getElementById("customer-options-list");
  optionsList.innerHTML = "";

  if (customers.length === 0) {
    optionsList.innerHTML = '<div class="no-results">لا يوجد عملاء</div>';
    return;
  }

  customers.forEach((customer) => {
    const div = document.createElement("div");
    div.className = "option-item";
    div.innerHTML = `
            <span class="option-name">${customer.name}</span>
            <span class="option-stock">${customer.phone || ""}</span>
        `;
    div.onclick = () => selectCustomer(customer);
    optionsList.appendChild(div);
  });
}

function selectCustomer(customer) {
  document.getElementById("customer-search-input").value = customer.name;
  document.getElementById("customer-select").value = customer.id;
  document.getElementById("customer-options-list").classList.remove("active");
}

function renderProductOptions(filteredProducts) {
  const optionsList = document.getElementById("product-options-list");
  optionsList.innerHTML = "";

  if (filteredProducts.length === 0) {
    optionsList.innerHTML =
      '<div class="no-results">لا توجد منتجات مطابقة</div>';
    return;
  }

  filteredProducts.slice(0, 50).forEach((product) => {
    const div = document.createElement("div");
    div.className = "option-item";
    div.innerHTML = `
            <span class="option-name">${product.name}</span>
            <span class="option-stock">${product.stock_quantity} ${
      product.sub_unit_name || "حبة"
    }</span>
        `;
    div.onclick = () => selectProduct(product);
    optionsList.appendChild(div);
  });
}

function selectProduct(product) {
  const searchInput = document.getElementById("product-search-input");
  const hiddenInput = document.getElementById("product-select");
  const optionsList = document.getElementById("product-options-list");

  searchInput.value = product.name;
  hiddenInput.value = product.id;
  optionsList.classList.remove("active");

  onProductSelect();
}

function calculateSubtotal() {
  if (!selectedProduct) return;
  const qty = parseInt(document.getElementById("item-quantity").value) || 0;
  const unitPrice =
    parseFloat(document.getElementById("item-unit-price").value) || 0;
  const unitType = document.getElementById("item-unit-type").value;

  let subtotal = 0;
  if (unitType === "main") {
    subtotal = qty * unitPrice * (selectedProduct.items_per_unit || 1);
  } else {
    subtotal = qty * unitPrice;
  }

  document.getElementById("item-subtotal").textContent =
    formatCurrency(subtotal);
}

// Add item to invoice
async function addItemToInvoice() {
  if (!selectedProduct) {
    showAlert("alert-container", "يرجى اختيار منتج أولاً", "error");
    return;
  }

  const quantity = parseInt(document.getElementById("item-quantity").value);
  const unitPrice = parseFloat(
    document.getElementById("item-unit-price").value
  );
  const unitType = document.getElementById("item-unit-type").value;

  const itemsPerUnit = parseInt(selectedProduct.items_per_unit || 1);
  const totalSubUnits =
    unitType === "main" ? quantity * itemsPerUnit : quantity;

  // Validate real available stock
  const cartItemEntries = invoiceItems.filter(
    (item) => item.product_id === selectedProduct.id
  );
  const cartQtyInSubUnits = cartItemEntries.reduce(
    (sum, item) => sum + item.total_sub_units,
    0
  );
  const totalQtyInSubUnits = cartQtyInSubUnits + totalSubUnits;

  if (quantity <= 0 || totalQtyInSubUnits > selectedProduct.stock_quantity) {
    showAlert(
      "alert-container",
      `الكمية غير صحيحة. المخزون المتاح: ${
        selectedProduct.stock_quantity - cartQtyInSubUnits
      }`,
      "error"
    );
    return;
  }

  // Check minimum profit margin
  const latestPurchasePrice =
    parseFloat(selectedProduct.latest_purchase_price) || 0;
  const minProfitMargin =
    parseFloat(selectedProduct.minimum_profit_margin) || 0;
  const minAllowedPrice = latestPurchasePrice + minProfitMargin;

  if (latestPurchasePrice > 0 && unitPrice < minAllowedPrice) {
    const confirmMsg = `تحذير: السعر (${formatCurrency(
      unitPrice
    )}) أقل من الحد الأدنى للبيع (${formatCurrency(
      minAllowedPrice
    )}).\n(سعر الشراء: ${formatCurrency(
      latestPurchasePrice
    )} + هامش الربح: ${formatCurrency(minProfitMargin)})\n\nهل تريد الاستمرار؟`;
    const confirmed = await showConfirm(confirmMsg);
    if (!confirmed) {
      return;
    }
  }

  const subtotal =
    unitType === "main"
      ? quantity * unitPrice * itemsPerUnit
      : quantity * unitPrice;
  const unitName =
    unitType === "main"
      ? selectedProduct.unit_name
      : selectedProduct.sub_unit_name;

  invoiceItems.push({
    product_id: selectedProduct.id,
    product_name: selectedProduct.name,
    display_name: `${selectedProduct.name} (${quantity} ${unitName})`,
    quantity: quantity,
    unit_type: unitType,
    unit_name: unitName,
    total_sub_units: totalSubUnits,
    unit_price: unitPrice,
    subtotal: subtotal,
  });

  renderInvoiceItems();
  updateTotal();

  // Reset selection form
  document.getElementById("product-select").value = "";
  document.getElementById("product-search-input").value = "";
  onProductSelect();
}

function removeInvoiceItem(index) {
  invoiceItems.splice(index, 1);
  renderInvoiceItems();
  updateTotal();
}

function renderInvoiceItems() {
  const tbody = document.getElementById("invoice-items-tbody");

  if (invoiceItems.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">لا توجد عناصر مضافة</td></tr>';
    return;
  }

  tbody.innerHTML = invoiceItems
    .map(
      (item, index) => `
        <tr class="animate-slide-up">
            <td data-label="المنتج">${item.display_name}</td>
            <td data-label="الكمية">${item.quantity} ${item.unit_name}</td>
            <td data-label="السعر">${formatCurrency(item.unit_price)}</td>
            <td data-label="المجموع">${formatCurrency(item.subtotal)}</td>
            <td data-label="الإجراءات">
                <button class="icon-btn delete" onclick="removeInvoiceItem(${index})">${getIcon(
        "trash"
      )}</button>
            </td>
        </tr>
    `
    )
    .join("");
}

function updateTotal() {
  const total = invoiceItems.reduce((sum, item) => sum + item.subtotal, 0);
  document.getElementById("total-amount").textContent = formatCurrency(total);
}

// Finish and Save Invoice
async function finishInvoice() {
  if (invoiceItems.length === 0) {
    showAlert("alert-container", "الفاتورة فارغة!", "error");
    return;
  }

  const finishBtn = document.getElementById("finish-btn");
  const originalText = finishBtn.innerHTML;
  finishBtn.disabled = true;
  finishBtn.innerHTML = "جاري الحفظ...";

  try {
    const invoiceData = {
      invoice_number: document.getElementById("invoice-number").value,
      items: invoiceItems.map((item) => ({
        product_id: item.product_id,
        quantity: item.total_sub_units,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      })),
    };

    // Check for Deferred Sales Customer
    const customerSelect = document.getElementById("customer-select");
    if (customerSelect) {
      // We are on deferred sales page
      const customerId = customerSelect.value;
      if (!customerId) {
        showAlert(
          "alert-container",
          "يرجى اختيار العميل للفاتورة الآجلة",
          "error"
        );
        finishBtn.disabled = false;
        finishBtn.innerHTML = originalText;
        return;
      }
      invoiceData.payment_type = "credit";
      invoiceData.customer_id = customerId;

      // Add amount paid if provided
      const amountPaidInput = document.getElementById("amount-paid");
      if (amountPaidInput) {
        invoiceData.amount_paid = parseFloat(amountPaidInput.value || 0);
      }
    } else {
      invoiceData.payment_type = "cash";
    }

    const response = await fetch(`${API_BASE}?action=invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(invoiceData),
    });

    const result = await response.json();

    if (result.success) {
      showAlert(
        "alert-container",
        "تمت العملية بنجاح. جاري الطباعة...",
        "success"
      );

      // Auto-print
      printInvoice(result.id);

      // Reset
      invoiceItems = [];
      renderInvoiceItems();
      updateTotal();
      generateInvoiceNumber();
      await loadProducts(); // Refresh stock
      await loadInvoices(); // Refresh history
    } else {
      showAlert(
        "alert-container",
        result.message || "فشل حفظ الفاتورة",
        "error"
      );
    }
  } catch (error) {
    showAlert("alert-container", "خطأ: " + error.message, "error");
  } finally {
    finishBtn.disabled = false;
    finishBtn.innerHTML = originalText;
  }
}

// Load History
async function loadInvoices() {
  try {
    const isDeferred = window.location.pathname.includes("deferred_sales.html");
    const paymentType = isDeferred ? "credit" : "cash";

    const response = await fetch(
      `${API_BASE}?action=invoices&page=${currentPage}&limit=${itemsPerPage}&payment_type=${paymentType}&t=${Date.now()}`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    const result = await response.json();
    if (result.success) {
      invoices = result.data;
      totalItems = result.pagination.total_records;
      renderInvoiceHistory();

      // Centralized numeric pagination
      renderPagination(result.pagination, "pagination-controls", (newPage) => {
        currentPage = newPage;
        loadInvoices();
      });
    }
  } catch (error) {
    showAlert("alert-container", "خطأ في تحميل السجل", "error");
  }
}

function renderInvoiceHistory() {
  const tbody = document.getElementById("invoices-tbody");
  const isDeferred = window.location.pathname.includes("deferred_sales.html");

  if (invoices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">لا توجد فواتير سابقة</td></tr>`;
    return;
  }

  tbody.innerHTML = invoices
    .map((inv) => {
      const createdDate = new Date(inv.created_at);
      const hoursDiff = (new Date() - createdDate) / (1000 * 60 * 60);
      const canDelete = hoursDiff < 48;

      if (isDeferred) {
        return `
            <tr>
                <td data-label="رقم الفاتورة"><strong>${
                  inv.invoice_number
                }</strong> <span class="badge badge-warning" style="font-size:0.7em">آجل</span></td>
                <td data-label="المبلغ الإجمالي">${formatCurrency(
                  inv.total_amount
                )}</td>
                <td data-label="المدفوع/المتبقي">
                    <div style="font-size: 0.85rem;">
                        <span class="text-success">${formatCurrency(
                          inv.amount_paid || 0
                        )}</span> / 
                        <span class="text-danger">${formatCurrency(
                          inv.total_amount - (inv.amount_paid || 0)
                        )}</span>
                    </div>
                </td>
                <td data-label="العميل">${inv.customer_name || "-"}</td>
                <td data-label="التاريخ والوقت">${formatDate(
                  inv.created_at,
                  true
                )}</td>
                <td data-label="الإجراءات">
                    <div class="action-buttons">
                        <button class="icon-btn view" onclick="viewInvoice(${
                          inv.id
                        })" title="عرض">${getIcon("eye")}</button>
                        ${
                          canDelete
                            ? `<button class="icon-btn delete" onclick="deleteInvoice(${
                                inv.id
                              })" title="حذف">${getIcon("trash")}</button>`
                            : ""
                        }
                    </div>
                </td>
            </tr>`;
      } else {
        return `
            <tr>
                <td data-label="رقم الفاتورة"><strong>${
                  inv.invoice_number
                }</strong></td>
                <td data-label="المبلغ الإجمالي">${formatCurrency(
                  inv.total_amount
                )}</td>
                <td data-label="عدد العناصر">${inv.item_count}</td>
                <td data-label="التاريخ والوقت">${formatDate(
                  inv.created_at,
                  true
                )}</td>
                <td data-label="البائع"><span class="badge badge-secondary">${
                  inv.salesperson_name || "النظام"
                }</span></td>
                <td data-label="الإجراءات">
                    <div class="action-buttons">
                        <button class="icon-btn view" onclick="viewInvoice(${
                          inv.id
                        })" title="عرض">${getIcon("eye")}</button>
                        ${
                          canDelete
                            ? `<button class="icon-btn delete" onclick="deleteInvoice(${
                                inv.id
                              })" title="حذف">${getIcon("trash")}</button>`
                            : ""
                        }
                    </div>
                </td>
            </tr>`;
      }
    })
    .join("");
}

// View Detailed Invoice
async function viewInvoice(id) {
  try {
    const response = await fetch(
      `${API_BASE}?action=invoice_details&id=${id}`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    const result = await response.json();
    if (result.success) {
      const inv = result.data;
      const viewBody = document.getElementById("view-dialog-body");

      viewBody.innerHTML = `
                <div class="invoice-details-header" style="margin-bottom: 2rem; border-bottom: 2px solid var(--border-color); padding-bottom: 1rem;">
                    <div class="form-row">
                        <div class="summary-stat">
                            <span class="stat-label">رقم الفاتورة</span>
                            <span class="stat-value">${
                              inv.invoice_number
                            }</span>
                        </div>
                        <div class="summary-stat">
                            <span class="stat-label">التاريخ</span>
                            <span class="stat-value">${formatDate(
                              inv.created_at,
                              true
                            )}</span>
                        </div>
                        ${
                          inv.payment_type === "credit"
                            ? `
                            <div class="summary-stat">
                                <span class="stat-label">نوع الدفع</span>
                                <span class="stat-value"><span class="badge badge-warning">آجل (ذمم)</span></span>
                            </div>
                            `
                            : `
                            <div class="summary-stat">
                                <span class="stat-label">نوع الدفع</span>
                                <span class="stat-value"><span class="badge badge-success">نقدي</span></span>
                            </div>
                            `
                        }
                    </div>
                    ${
                      inv.customer_name
                        ? `
                        <div class="form-row" style="margin-top: 1rem; background: var(--surface-hover); padding: 1rem; border-radius: var(--radius-md);">
                            <div class="summary-stat">
                                <span class="stat-label">العميل</span>
                                <span class="stat-value">${
                                  inv.customer_name
                                }</span>
                            </div>
                            ${
                              inv.customer_phone
                                ? `
                                <div class="summary-stat">
                                    <span class="stat-label">الهاتف</span>
                                    <span class="stat-value">${inv.customer_phone}</span>
                                </div>
                            `
                                : ""
                            }
                            ${
                              inv.customer_tax
                                ? `
                                <div class="summary-stat">
                                    <span class="stat-label">الرقم الضريبي</span>
                                    <span class="stat-value">${inv.customer_tax}</span>
                                </div>
                            `
                                : ""
                            }
                        </div>
                    `
                        : ""
                    }
                    ${
                      inv.payment_type === "credit"
                        ? `
                        <div class="form-row" style="margin-top: 1rem;">
                            <div class="summary-stat">
                                <span class="stat-label">المبلغ المدفوع</span>
                                <span class="stat-value" style="color: var(--success-color);">${formatCurrency(
                                  inv.amount_paid || 0
                                )}</span>
                            </div>
                            <div class="summary-stat">
                                <span class="stat-label">المبلغ المتبقي</span>
                                <span class="stat-value" style="color: var(--danger-color); font-weight: 700;">${formatCurrency(
                                  inv.total_amount - (inv.amount_paid || 0)
                                )}</span>
                            </div>
                        </div>
                    `
                        : ""
                    }
                </div>

                <div class="invoice-items-minimal">
                    <h4 style="margin-bottom: 1rem;">المنتجات المباعة:</h4>
                    ${inv.items
                      .map(
                        (item) => `
                        <div class="item-row-minimal">
                            <div class="item-info-pkg">
                                <span class="item-name-pkg">${
                                  item.product_name
                                }</span>
                                <span class="item-meta-pkg">سعر الوحدة: ${formatCurrency(
                                  item.unit_price
                                )}</span>
                            </div>
                            <div class="item-info-pkg" style="text-align: left;">
                                <span class="item-name-pkg">${formatCurrency(
                                  item.subtotal
                                )}</span>
                                <span class="item-meta-pkg">الكمية: ${
                                  item.quantity
                                }</span>
                            </div>
                        </div>
                    `
                      )
                      .join("")}
                </div>

                <div class="sales-summary-bar" style="margin-top: 2rem; background: var(--grad-primary); color: white;">
                    <div class="summary-stat">
                        <span class="stat-label" style="color: rgba(255,255,255,0.8);">المبلغ الإجمالي</span>
                        <span class="stat-value highlight" style="color: white;">${formatCurrency(
                          inv.total_amount
                        )}</span>
                    </div>
                    <button type="button" class="btn" style="background: white; color: var(--primary-color);" onclick="printInvoice(${
                      inv.id
                    })">
                        ${getIcon("print")} طباعة نسخة
                    </button>
                </div>
            `;
      openDialog("view-dialog");
    }
  } catch (error) {
    showAlert("alert-container", "خطأ في جلب التفاصيل", "error");
  }
}

async function deleteInvoice(id) {
  if (
    !(await showConfirm(
      "هل أنت متأكد من حذف هذه الفاتورة؟ سيتم إرجاع المنتجات للمخزون."
    ))
  )
    return;

  try {
    const response = await fetch(`${API_BASE}?action=invoices&id=${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const result = await response.json();
    if (result.success) {
      showAlert("alert-container", "تم الحذف بنجاح", "success");
      await loadInvoices();
      await loadProducts();
    } else {
      showAlert("alert-container", result.message, "error");
    }
  } catch (error) {
    showAlert("alert-container", "خطأ في الحذف", "error");
  }
}

async function printInvoice(id) {
  // 1. Verify printer connection (Simulated)
  const isPrinterReady = await checkPrinterConnection();
  if (!isPrinterReady) {
    showToast("فشل الاتصال بالطابعة. يرجى التحقق من الكابلات.", "error");
    return;
  }

  const settings = await getSettings();

  const response = await fetch(
    `${API_BASE}?action=invoice_details&id=${id}&t=${Date.now()}`,
    {
      credentials: "include",
    }
  );
  const res = await response.json();

  if (!res.success) {
    showToast("فشل تحميل تفاصيل الفاتورة", "error");
    return;
  }

  const inv = res.data;
  const printFrame = document.createElement("iframe");
  printFrame.style.display = "none";
  document.body.appendChild(printFrame);

  const content = generateInvoiceHTML(inv, settings);

  try {
    printFrame.contentDocument.open();
    printFrame.contentDocument.write(content);
    printFrame.contentDocument.close();

    // Print after all resources (images) in the iframe have loaded (fixes Chrome timing issue)
    const waitForImages = () => {
      return new Promise((resolve) => {
        const imgs = printFrame.contentDocument.images;
        if (!imgs || imgs.length === 0) return resolve();
        let remaining = imgs.length;
        for (const img of imgs) {
          if (img.complete) {
            remaining--;
            if (remaining === 0) return resolve();
          } else {
            img.addEventListener("load", () => {
              remaining--;
              if (remaining === 0) resolve();
            });
            img.addEventListener("error", () => {
              remaining--;
              if (remaining === 0) resolve();
            });
          }
        }
      });
    };

    waitForImages().then(() => {
      printFrame.contentWindow.focus();
      printFrame.contentWindow.print();
      // Auto-cleanup
      setTimeout(() => {
        if (printFrame.parentNode) {
          document.body.removeChild(printFrame);
        }
      }, 1000);
    });
  } catch (e) {
    console.error("Print error", e);
    showToast("خطأ أثناء تحضير الفاتورة للطباعة", "error");
  }
}
