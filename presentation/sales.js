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

  updateDateTime();
  setInterval(updateDateTime, 1000);

  updateDateTime();
  setInterval(updateDateTime, 1000);

  await loadProducts();
  await loadInvoices();
  generateInvoiceNumber();
});

function updateDateTime() {
  const now = new Date();
  document.getElementById("current-date").textContent =
    now.toLocaleString("ar-YE");
}

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
      const select = document.getElementById("product-select");

      // Clear except first option
      select.innerHTML = '<option value="">-- اختر منتجاً --</option>';

      products.forEach((product) => {
        const option = document.createElement("option");
        option.value = product.id;
        option.textContent = `${product.name} (المخزون: ${product.stock_quantity})`;
        select.appendChild(option);
      });
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
  }
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
        <tr class="animate-fade">
            <td>${item.display_name}</td>
            <td>${item.quantity} ${item.unit_name}</td>
            <td>${formatCurrency(item.unit_price)}</td>
            <td>${formatCurrency(item.subtotal)}</td>
            <td>
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
    const response = await fetch(
      `${API_BASE}?action=invoices&page=${currentPage}&limit=${itemsPerPage}&t=${Date.now()}`,
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

  if (invoices.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align: center; padding: 2rem;">لا توجد فواتير سابقة</td></tr>';
    return;
  }

  tbody.innerHTML = invoices
    .map((inv) => {
      // Restriction: Edit/Delete check (48 hours)
      const createdDate = new Date(inv.created_at);
      const hoursDiff = (new Date() - createdDate) / (1000 * 60 * 60);
      const canDelete = hoursDiff < 48;

      return `
            <tr>
                <td><strong>${inv.invoice_number}</strong></td>
                <td>${formatCurrency(inv.total_amount)}</td>
                <td>${inv.item_count}</td>
                <td>${formatDate(inv.created_at, true)}</td>
                <td><span class="badge badge-secondary">${
                  inv.salesperson_name || "النظام"
                }</span></td>
                <td>

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
            </tr>
        `;
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
                    </div>
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

    // "Direct print" effect
    setTimeout(() => {
      printFrame.contentWindow.focus();
      printFrame.contentWindow.print();
      // Auto-cleanup
      setTimeout(() => {
        if (printFrame.parentNode) {
          document.body.removeChild(printFrame);
        }
      }, 1000);
    }, 500);
  } catch (e) {
    console.error("Print error", e);
    showToast("خطأ أثناء تحضير الفاتورة للطباعة", "error");
  }
}
