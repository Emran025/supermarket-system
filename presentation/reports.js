let currentReportTab = "balance_sheet";

document.addEventListener("DOMContentLoaded", async function () {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  // 1. Custom Dropdown Logic (Copied from settings.js logic for consistency)
  const dropdownTrigger = document.getElementById("dropdownTrigger");
  const reportsDropdown = document.getElementById("reportsDropdown");
  const dropdownMenu = document.getElementById("dropdownMenu");

  if (dropdownTrigger && reportsDropdown) {
    dropdownTrigger.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      reportsDropdown.classList.toggle("active");
    });

    document.addEventListener("click", function (e) {
      if (
        reportsDropdown.classList.contains("active") &&
        !reportsDropdown.contains(e.target)
      ) {
        reportsDropdown.classList.remove("active");
      }
    });

    if (dropdownMenu) {
      dropdownMenu.addEventListener("click", function (e) {
        const item = e.target.closest(".dropdown-item");
        if (item) {
          e.stopPropagation();
          const tabId = item.getAttribute("data-value");
          switchReportTab(tabId);
          reportsDropdown.classList.remove("active");
        }
      });
    }
  }

  // 2. Tab Buttons Logic
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchReportTab(btn.getAttribute("data-tab"));
    });
  });

  // Set default dates
  const today = new Date().toISOString().split("T")[0];
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split("T")[0];
  document.getElementById("pl-start-date").value = firstDay;
  document.getElementById("pl-end-date").value = today;
  document.getElementById("cf-start-date").value = firstDay;
  document.getElementById("cf-end-date").value = today;

  await loadFinancialData();
});

function switchReportTab(tab) {
  if (!tab) return;
  currentReportTab = tab;

  // Clear any previous alerts
  const alertContainer = document.getElementById("alert-container");
  if (alertContainer) alertContainer.innerHTML = "";

  // 1. Update buttons (for desktop)
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    const isMatched = btn.getAttribute("data-tab") === tab;
    btn.classList.toggle("active", isMatched);
  });

  // 2. Update custom dropdown (for mobile)
  const selectedTabText = document.getElementById("selectedTabText");
  const dropdownMenu = document.getElementById("dropdownMenu");

  if (selectedTabText && dropdownMenu) {
    const activeItem = dropdownMenu.querySelector(
      `.dropdown-item[data-value="${tab}"]`
    );
    if (activeItem) {
      selectedTabText.textContent = activeItem.textContent.trim();

      // Update active state in menu
      dropdownMenu.querySelectorAll(".dropdown-item").forEach((item) => {
        item.classList.toggle(
          "active",
          item.getAttribute("data-value") === tab
        );
      });
    }
  }

  // 3. Show/hide tab content
  document.querySelectorAll(".report-tab-content").forEach((content) => {
    content.style.display = "none";
  });
  const targetContent = document.getElementById(`report-${tab}`);
  if (targetContent) {
    targetContent.style.display = "block";
  }

  // 4. Load data for the tab
  if (tab === "profit_loss") {
    loadProfitLoss();
  } else if (tab === "cash_flow") {
    loadCashFlow();
  } else if (tab === "comparative") {
    loadComparative();
  }
}

async function loadFinancialData() {
  try {
    const result = await fetchAPI("reports?operation=balance_sheet");
    if (result.success) {
      const data = result.data;

      // Populate Assets
      document.getElementById("cash-estimate").textContent = formatCurrency(
        data.assets.cash_estimate
      );
      document.getElementById("stock-value").textContent = formatCurrency(
        data.assets.stock_value
      );
      document.getElementById("fixed-assets").textContent = formatCurrency(
        data.assets.fixed_assets
      );
      document.getElementById("accounts-receivable").textContent =
        formatCurrency(data.assets.accounts_receivable);
      document.getElementById("total-assets").textContent = formatCurrency(
        data.assets.total_assets
      );

      // Populate Income Statement
      document.getElementById("total-sales").textContent = formatCurrency(
        data.income_statement.total_sales
      );
      document.getElementById("other-revenues").textContent = formatCurrency(
        data.income_statement.other_revenues
      );
      document.getElementById("total-purchases").textContent =
        "-" + formatCurrency(data.income_statement.total_purchases);
      document.getElementById("total-expenses").textContent =
        "-" + formatCurrency(data.income_statement.total_expenses);

      const netProfit = data.income_statement.net_profit;
      const netProfitEl = document.getElementById("net-profit");
      netProfitEl.textContent = formatCurrency(netProfit);
      netProfitEl.className = netProfit >= 0 ? "value profit" : "value loss";
    } else {
      showAlert("alert-container", "فشل تحميل البيانات المالية", "error");
    }
  } catch (error) {
    console.error("Error loading financial data", error);
    showAlert("alert-container", "خطأ في الاتصال بالسيرفر", "error");
  }
}

async function loadProfitLoss() {
  try {
    const startDate = document.getElementById("pl-start-date").value;
    const endDate = document.getElementById("pl-end-date").value;

    if (!startDate || !endDate) {
      showAlert(
        "alert-container",
        "يرجى تحديد تاريخ البداية والنهاية",
        "warning"
      );
      return;
    }

    const result = await fetchAPI(
      `reports?operation=profit_loss&start_date=${startDate}&end_date=${endDate}`
    );
    if (result.success) {
      const data = result.data || {};
      const content = document.getElementById("profit-loss-content");

      content.innerHTML = `
        <h2><i class="fas fa-chart-line"></i> قائمة الدخل (${startDate} إلى ${endDate})</h2>
        <div class="financial-row">
          <span class="label">إجمالي الإيرادات</span>
          <span class="value text-success">${formatCurrency(
            data.total_revenue || 0
          )}</span>
        </div>
        <div class="financial-row">
          <span class="label">تكلفة البضاعة المباعة</span>
          <span class="value text-danger">-${formatCurrency(
            data.total_cogs || 0
          )}</span>
        </div>
        <div class="financial-row">
          <span class="label">إجمالي الربح</span>
          <span class="value">${formatCurrency(
            (data.total_revenue || 0) - (data.total_cogs || 0)
          )}</span>
        </div>
        <div class="financial-row">
          <span class="label">المصروفات التشغيلية</span>
          <span class="value text-danger">-${formatCurrency(
            data.total_expenses || 0
          )}</span>
        </div>
        <div class="financial-row">
          <span class="label">صافي الربح / الخسارة</span>
          <span class="value ${
            (data.net_profit || 0) >= 0 ? "profit" : "loss"
          }">${formatCurrency(data.net_profit || 0)}</span>
        </div>
      `;
    } else {
      showAlert(
        "alert-container",
        result.message || "فشل تحميل قائمة الدخل",
        "error"
      );
    }
  } catch (error) {
    console.error("Error loading profit loss:", error);
    showAlert("alert-container", "خطأ في الاتصال بالسيرفر", "error");
  }
}

async function loadCashFlow() {
  try {
    const startDate = document.getElementById("cf-start-date").value;
    const endDate = document.getElementById("cf-end-date").value;

    if (!startDate || !endDate) {
      showAlert(
        "alert-container",
        "يرجى تحديد تاريخ البداية والنهاية",
        "warning"
      );
      return;
    }

    const result = await fetchAPI(
      `reports?operation=cash_flow&start_date=${startDate}&end_date=${endDate}`
    );
    if (result.success) {
      const data = result.data || {};
      const content = document.getElementById("cash-flow-content");

      content.innerHTML = `
        <h2><i class="fas fa-money-bill-wave"></i> قائمة التدفقات النقدية (${startDate} إلى ${endDate})</h2>
        <h3 style="margin-top: 1.5rem; margin-bottom: 1rem;">الأنشطة التشغيلية</h3>
        <div class="financial-row">
          <span class="label">صافي الربح</span>
          <span class="value">${formatCurrency(
            data.operating_activities?.net_profit || 0
          )}</span>
        </div>
        <div class="financial-row">
          <span class="label">التدفقات النقدية من الأنشطة التشغيلية</span>
          <span class="value">${formatCurrency(
            data.operating_activities?.net_cash_flow || 0
          )}</span>
        </div>
        <h3 style="margin-top: 1.5rem; margin-bottom: 1rem;">الأنشطة الاستثمارية</h3>
        <div class="financial-row">
          <span class="label">شراء الأصول</span>
          <span class="value text-danger">-${formatCurrency(
            data.investing_activities?.asset_purchases || 0
          )}</span>
        </div>
        <h3 style="margin-top: 1.5rem; margin-bottom: 1rem;">الأنشطة التمويلية</h3>
        <div class="financial-row">
          <span class="label">رأس المال</span>
          <span class="value text-success">${formatCurrency(
            data.financing_activities?.capital || 0
          )}</span>
        </div>
        <div class="financial-row">
          <span class="label">صافي التدفق النقدي</span>
          <span class="value">${formatCurrency(data.net_cash_flow || 0)}</span>
        </div>
      `;
    } else {
      showAlert(
        "alert-container",
        result.message || "فشل تحميل قائمة التدفقات النقدية",
        "error"
      );
    }
  } catch (error) {
    console.error("Error loading cash flow:", error);
    showAlert("alert-container", "خطأ في الاتصال بالسيرفر", "error");
  }
}

async function loadComparative() {
  try {
    const currentStart = document.getElementById("comp-current-start").value;
    const currentEnd = document.getElementById("comp-current-end").value;
    const previousStart = document.getElementById("comp-previous-start").value;
    const previousEnd = document.getElementById("comp-previous-end").value;

    if (!currentStart || !currentEnd) {
      showAlert("alert-container", "يرجى تحديد الفترة الحالية", "warning");
      return;
    }

    let url = `reports?operation=comparative&current_start=${currentStart}&current_end=${currentEnd}`;
    if (previousStart && previousEnd) {
      url += `&previous_start=${previousStart}&previous_end=${previousEnd}`;
    }

    const result = await fetchAPI(url);
    if (result.success) {
      const data = result.data || {};
      const current = data.current_period || {};
      const previous = data.previous_period || {};
      const changes = data.changes || {};

      const content = document.getElementById("comparative-content");

      content.innerHTML = `
        <h2><i class="fas fa-chart-bar"></i> المقارنة المالية</h2>
        <table class="data-table" style="margin-top: 1.5rem;">
          <thead>
            <tr>
              <th>البند</th>
              <th>الفترة السابقة</th>
              <th>الفترة الحالية</th>
              <th>التغيير</th>
              <th>نسبة التغيير</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>الإيرادات</strong></td>
              <td>${formatCurrency(previous.revenue || 0)}</td>
              <td>${formatCurrency(current.revenue || 0)}</td>
              <td class="${
                (changes.revenue?.amount || 0) >= 0
                  ? "text-success"
                  : "text-danger"
              }">
                ${formatCurrency(changes.revenue?.amount || 0)}
              </td>
              <td>${(changes.revenue?.percentage || 0).toFixed(2)}%</td>
            </tr>
            <tr>
              <td><strong>المصروفات</strong></td>
              <td>${formatCurrency(previous.expenses || 0)}</td>
              <td>${formatCurrency(current.expenses || 0)}</td>
              <td class="${
                (changes.expenses?.amount || 0) >= 0
                  ? "text-danger"
                  : "text-success"
              }">
                ${formatCurrency(changes.expenses?.amount || 0)}
              </td>
              <td>${(changes.expenses?.percentage || 0).toFixed(2)}%</td>
            </tr>
            <tr>
              <td><strong>صافي الربح</strong></td>
              <td>${formatCurrency(previous.net_profit || 0)}</td>
              <td>${formatCurrency(current.net_profit || 0)}</td>
              <td class="${
                (changes.net_profit?.amount || 0) >= 0
                  ? "text-success"
                  : "text-danger"
              }">
                ${formatCurrency(changes.net_profit?.amount || 0)}
              </td>
              <td>${(changes.net_profit?.percentage || 0).toFixed(2)}%</td>
            </tr>
          </tbody>
        </table>
      `;
    } else {
      showAlert(
        "alert-container",
        result.message || "فشل تحميل المقارنة",
        "error"
      );
    }
  } catch (error) {
    console.error("Error loading comparative:", error);
    showAlert("alert-container", "خطأ في الاتصال بالسيرفر", "error");
  }
}

function exportReport() {
  window.print();
}
