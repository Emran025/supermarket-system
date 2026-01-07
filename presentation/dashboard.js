document.addEventListener("DOMContentLoaded", async () => {
  // Check auth
  const user = await checkAuth();
  if (!user) return;

  loadDashboardStats();
});

async function loadDashboardStats() {
  try {
    const response = await fetchAPI("dashboard");

    if (!response.success && response.message === "Unauthorized") {
      return;
    }

    if (response.success) {
      const stats = response.data;

      document.getElementById("todaySales").textContent = formatCurrency(
        stats.todays_sales
      );
      document.getElementById("todayCash").textContent =
        "نقد: " + formatCurrency(stats.today_breakdown.cash || 0);
      document.getElementById("todayCredit").textContent =
        "آجل: " + formatCurrency(stats.today_breakdown.credit || 0);

      document.getElementById("totalProducts").textContent =
        stats.total_products;
      document.getElementById("lowStock").textContent =
        stats.low_stock_products;
      if (document.getElementById("expiringSoonCount")) {
        document.getElementById("expiringSoonCount").textContent =
          stats.expiring_products;
      }
      document.getElementById("totalSales").textContent = formatCurrency(
        stats.total_sales
      );

      document.getElementById("totalCash").textContent =
        "نقد: " + formatCurrency(stats.sales_breakdown.cash.value || 0);
      document.getElementById("totalCredit").textContent =
        "آجل: " + formatCurrency(stats.sales_breakdown.credit.value || 0);

      document.getElementById("todaysExpenses").textContent = formatCurrency(
        stats.todays_expenses
      );
      document.getElementById("totalExpenses").textContent = formatCurrency(
        stats.total_expenses
      );
      document.getElementById("todaysRevenues").textContent = formatCurrency(
        stats.todays_revenues
      );
      document.getElementById("totalRevenues").textContent = formatCurrency(
        stats.total_revenues
      );
      document.getElementById("totalAssets").textContent = formatCurrency(
        stats.total_assets
      );

      // Recent Sales
      const tbody = document.getElementById("recentSalesTable");
      tbody.innerHTML = "";

      if (stats.recent_sales && stats.recent_sales.length > 0) {
        stats.recent_sales.forEach((sale) => {
          const row = document.createElement("tr");
          row.innerHTML = `
                        <td data-label="رقم الفاتورة">#${
                          sale.invoice_number
                        }</td>
                        <td data-label="المبلغ" class="amount">${formatCurrency(
                          sale.total_amount
                        )}</td>
                        <td data-label="التاريخ">${formatDate(
                          sale.created_at
                        )}</td>
                    `;
          tbody.appendChild(row);
        });
      } else {
        tbody.innerHTML =
          '<tr><td colspan="3" class="text-center">لا توجد مبيعات حديثة</td></tr>';
      }
    }
  } catch (error) {
    console.error("Error loading dashboard stats:", error);
  }
}

// Low Stock & Request Logic
async function openLowStockDialog() {
  openDialog("lowStockDialog");
  const tbody = document.getElementById("lowStockTableBody");
  tbody.innerHTML =
    '<tr><td colspan="4" class="text-center">جاري التحميل...</td></tr>';

  // Fetch details
  const res = await fetchAPI("dashboard&detail=low_stock");
  if (res.success) {
    tbody.innerHTML = "";
    if (res.data.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="text-center">لا توجد منتجات منخفضة المخزون</td></tr>';
      return;
    }
    res.data.forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td data-label="المنتج">${p.name}</td>
                <td data-label="الفئة">${p.category || "-"}</td>
                <td data-label="الكمية" style="color:#d97706; font-weight:bold">${
                  p.stock_quantity
                } ${p.unit_name}</td>
                <td data-label="إجراء">
                    <button class="btn btn-sm btn-primary" onclick="initiateRestock('${p.name.replace(
                      /'/g,
                      "\\'"
                    )}', ${p.id})">
                        <i class="fas fa-cart-plus"></i> طلب توفير
                    </button>
                </td>
            `;
      tbody.appendChild(tr);
    });
  } else {
    tbody.innerHTML =
      '<tr><td colspan="4" class="text-center text-danger">فشل تحميل البيانات</td></tr>';
  }
}

window.initiateRestock = function (name, id) {
  const nameInput = document.getElementById("reqProductName");
  nameInput.value = name;
  nameInput.dataset.id = id; // Store ID
  document.getElementById("reqQuantity").value = 10; // Default logical amount

  // Close list dialog nicely? Or keep open? Let's keep open for multiple requests?
  // User might want to stack dialogs. Typically overlay z-index handles it, but let's see.
  // styles.css dialog-overlay z-index is 9999. If I open another, it sits on top if DOM order is later.
  // newRequestDialog is after lowStockDialog in DOM, so it should stack on top.
  openDialog("newRequestDialog");
};

window.submitNewRequest = async function () {
  const nameInput = document.getElementById("reqProductName");
  const name = nameInput.value;
  const id = nameInput.dataset.id || null;
  const qty = document.getElementById("reqQuantity").value;
  const notes = document.getElementById("reqNotes").value;

  if (!name) {
    showToast("يرجى إدخال اسم المنتج", "error");
    return;
  }

  const btn = document.querySelector("#newRequestDialog .btn-primary");
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "جاري الإرسال...";

  try {
    const res = await fetchAPI("requests", "POST", {
      product_id: id,
      product_name: name,
      quantity: qty,
      notes: notes,
    });

    if (res.success) {
      showToast("تم إرسال الطلب بنجاح");
      closeDialog("newRequestDialog");
      // Reset form
      nameInput.value = "";
      delete nameInput.dataset.id;
      document.getElementById("reqQuantity").value = 1;
      document.getElementById("reqNotes").value = "";
    } else {
      showToast(res.message || "حدث خطأ", "error");
    }
  } catch (e) {
    showToast("خطأ في الاتصال", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
};
async function openExpiringSoonDialog() {
  openDialog("expiringSoonDialog");
  const tbody = document.getElementById("expiringSoonTableBody");
  tbody.innerHTML =
    '<tr><td colspan="4" class="text-center">جاري التحميل...</td></tr>';

  // Fetch details
  const res = await fetchAPI("dashboard&detail=expiring_soon");
  if (res.success) {
    tbody.innerHTML = "";
    if (res.data.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="text-center">لا توجد منتجات منتهية أو قريبة من الانتهاء</td></tr>';
      return;
    }
    res.data.forEach((p) => {
      const tr = document.createElement("tr");

      const expiryDate = new Date(p.expiry_date);
      const today = new Date();
      const diffTime = expiryDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let statusBadge = "";
      if (diffDays <= 0) {
        statusBadge = '<span class="badge badge-danger">منتهي الصلاحية</span>';
      } else {
        statusBadge = `<span class="badge badge-warning">تنتهي خلال ${diffDays} يوم</span>`;
      }

      tr.innerHTML = `
                <td data-label="المنتج">${p.name}</td>
                <td data-label="الفئة">${p.category || "-"}</td>
                <td data-label="تاريخ الانتهاء">${p.expiry_date}</td>
                <td data-label="الحالة">${statusBadge}</td>
            `;
      tbody.appendChild(tr);
    });
  } else {
    tbody.innerHTML =
      '<tr><td colspan="4" class="text-center text-danger">فشل تحميل البيانات</td></tr>';
  }
}
