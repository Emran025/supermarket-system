let currentTab = "payroll";
let currentPage = 1;
let itemsPerPage = 20;

document.addEventListener("DOMContentLoaded", async function () {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  // 1. Custom Dropdown Logic (Consistent with Settings design)
  const dropdownTrigger = document.getElementById("dropdownTrigger");
  const accrualDropdown = document.getElementById("accrualDropdown");
  const dropdownMenu = document.getElementById("dropdownMenu");

  if (dropdownTrigger && accrualDropdown) {
    dropdownTrigger.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      accrualDropdown.classList.toggle("active");
    });

    document.addEventListener("click", function (e) {
      if (
        accrualDropdown.classList.contains("active") &&
        !accrualDropdown.contains(e.target)
      ) {
        accrualDropdown.classList.remove("active");
      }
    });

    if (dropdownMenu) {
      dropdownMenu.addEventListener("click", function (e) {
        const item = e.target.closest(".dropdown-item");
        if (item) {
          e.stopPropagation();
          const tabId = item.getAttribute("data-value");
          switchTab(tabId);
          accrualDropdown.classList.remove("active");
        }
      });
    }
  }

  // 2. Tab Buttons Logic
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.getAttribute("data-tab"));
    });
  });

  await loadCurrentTab();
});

function switchTab(tab) {
  if (!tab) return;
  currentTab = tab;

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
  document.querySelectorAll(".tab-content").forEach((content) => {
    content.style.display = "none";
  });
  const targetContent = document.getElementById(`tab-${tab}`);
  if (targetContent) {
    targetContent.style.display = "block";
  }

  loadCurrentTab();
}

async function loadCurrentTab() {
  switch (currentTab) {
    case "payroll":
      await loadPayroll();
      break;
    case "prepayments":
      await loadPrepayments();
      break;
    case "unearned":
      await loadUnearnedRevenue();
      break;
  }
}

async function loadPayroll(page = 1) {
  currentPage = page;
  try {
    const result = await fetchAPI(
      `accrual?module=payroll&page=${page}&limit=${itemsPerPage}`
    );
    if (result.success) {
      const payrolls = result.data || [];
      const total = result.total || 0;

      const tbody = document.getElementById("payroll-table-body");
      tbody.innerHTML = "";

      if (payrolls.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="6" style="text-align: center; padding: 2rem;">لا توجد كشوف مرتبات</td></tr>';
      } else {
        payrolls.forEach((payroll) => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${formatDate(payroll.payroll_date)}</td>
            <td>${formatCurrency(
              payroll.gross_pay || payroll.salary_amount || 0
            )}</td>
            <td>${formatCurrency(payroll.deductions || 0)}</td>
            <td><strong>${formatCurrency(
              payroll.net_pay || payroll.salary_amount || 0
            )}</strong></td>
            <td>${payroll.description || payroll.employee_name || ""}</td>
            <td>
              <div class="action-buttons">
                <button class="icon-btn view" onclick="viewPayroll(${
                  payroll.id
                })" title="عرض">
                  ${getIcon("eye")}
                </button>
              </div>
            </td>
          `;
          tbody.appendChild(row);
        });
      }

      renderPagination(
        "payroll-pagination",
        currentPage,
        Math.ceil(total / itemsPerPage),
        loadPayroll
      );
    } else {
      showAlert(
        "alert-container",
        result.message || "فشل تحميل كشوف المرتبات",
        "error"
      );
    }
  } catch (error) {
    console.error("Error loading payroll:", error);
    showAlert("alert-container", "خطأ في الاتصال بالسيرفر", "error");
  }
}

async function loadPrepayments(page = 1) {
  currentPage = page;
  try {
    const result = await fetchAPI(
      `accrual?module=prepayments&page=${page}&limit=${itemsPerPage}`
    );
    if (result.success) {
      const prepayments = result.data || [];
      const total = result.total || 0;

      const tbody = document.getElementById("prepayments-table-body");
      tbody.innerHTML = "";

      if (prepayments.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="6" style="text-align: center; padding: 2rem;">لا توجد مدفوعات مقدمة</td></tr>';
      } else {
        prepayments.forEach((prep) => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${formatDate(prep.prepayment_date || prep.payment_date)}</td>
            <td>${formatCurrency(prep.total_amount)}</td>
            <td>${prep.months || prep.amortization_periods || 1}</td>
            <td>${prep.description || ""}</td>
            <td>${prep.expense_account_code || ""}</td>
            <td>
              <div class="action-buttons">
                <button class="icon-btn view" onclick="viewPrepayment(${
                  prep.id
                })" title="عرض">
                  ${getIcon("eye")}
                </button>
                <button class="icon-btn edit" onclick="amortizePrepayment(${
                  prep.id
                })" title="استهلاك">
                  ${getIcon("edit")}
                </button>
              </div>
            </td>
          `;
          tbody.appendChild(row);
        });
      }

      renderPagination(
        "prepayments-pagination",
        currentPage,
        Math.ceil(total / itemsPerPage),
        loadPrepayments
      );
    } else {
      showAlert(
        "alert-container",
        result.message || "فشل تحميل المدفوعات المقدمة",
        "error"
      );
    }
  } catch (error) {
    console.error("Error loading prepayments:", error);
    showAlert("alert-container", "خطأ في الاتصال بالسيرفر", "error");
  }
}

async function loadUnearnedRevenue(page = 1) {
  currentPage = page;
  try {
    const result = await fetchAPI(
      `accrual?module=unearned_revenue&page=${page}&limit=${itemsPerPage}`
    );
    if (result.success) {
      const unearned = result.data || [];
      const total = result.total || 0;

      const tbody = document.getElementById("unearned-table-body");
      tbody.innerHTML = "";

      if (unearned.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="6" style="text-align: center; padding: 2rem;">لا توجد إيرادات غير مكتسبة</td></tr>';
      } else {
        unearned.forEach((ur) => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${formatDate(ur.receipt_date)}</td>
            <td>${formatCurrency(ur.total_amount)}</td>
            <td>${ur.months}</td>
            <td>${ur.description || ""}</td>
            <td>${ur.revenue_account_code || ""}</td>
            <td>
              <div class="action-buttons">
                <button class="icon-btn view" onclick="viewUnearned(${
                  ur.id
                })" title="عرض">
                  ${getIcon("eye")}
                </button>
                <button class="icon-btn edit" onclick="recognizeRevenue(${
                  ur.id
                })" title="تحقق">
                  ${getIcon("edit")}
                </button>
              </div>
            </td>
          `;
          tbody.appendChild(row);
        });
      }

      renderPagination(
        "unearned-pagination",
        currentPage,
        Math.ceil(total / itemsPerPage),
        loadUnearnedRevenue
      );
    } else {
      showAlert(
        "alert-container",
        result.message || "فشل تحميل الإيرادات غير المكتسبة",
        "error"
      );
    }
  } catch (error) {
    console.error("Error loading unearned revenue:", error);
    showAlert("alert-container", "خطأ في الاتصال بالسيرفر", "error");
  }
}

function showCreateModal() {
  document.getElementById("accrual-form").reset();
  document.getElementById("accrual-id").value = "";

  // Default to payroll
  document.getElementById("accrual-type-select").value = "payroll";
  updateAccrualFields();

  const today = new Date().toISOString().split("T")[0];
  document.getElementById("payroll-date").value = today;
  document.getElementById("prepayment-date").value = today;
  document.getElementById("unearned-date").value = today;

  openDialog("accrual-modal");
}

function updateAccrualFields() {
  const type = document.getElementById("accrual-type-select").value;
  document.getElementById("accrual-type").value = type;

  // Hide all fields first
  document.getElementById("payroll-fields").style.display = "none";
  document.getElementById("prepayment-fields").style.display = "none";
  document.getElementById("unearned-fields").style.display = "none";

  // Show selected fields and update title
  const modalTitle = document.getElementById("modal-title");

  if (type === "payroll") {
    modalTitle.textContent = "إضافة كشف مرتب";
    document.getElementById("payroll-fields").style.display = "block";
  } else if (type === "prepayment") {
    modalTitle.textContent = "إضافة دفعة مقدمة";
    document.getElementById("prepayment-fields").style.display = "block";
  } else if (type === "unearned") {
    modalTitle.textContent = "إضافة إيراد غير مكتسب";
    document.getElementById("unearned-fields").style.display = "block";
  }
}

function closeModal() {
  closeDialog("accrual-modal");
}

function viewPayroll(id) {
  // Implementation for viewing payroll details
  showAlert("alert-container", "عرض تفاصيل كشف المرتب", "info");
}

function viewPrepayment(id) {
  showAlert("alert-container", "عرض تفاصيل الدفعة المقدمة", "info");
}

function viewUnearned(id) {
  showAlert("alert-container", "عرض تفاصيل الإيراد غير المكتسب", "info");
}

async function amortizePrepayment(id) {
  if (!confirm("هل تريد استهلاك دفعة مقدمة لهذا الشهر؟")) return;

  try {
    const result = await fetchAPI("accrual?module=prepayments", "PUT", {
      id: id,
      amortization_date: new Date().toISOString().split("T")[0],
    });

    if (result.success) {
      showAlert(
        "alert-container",
        "تم استهلاك الدفعة المقدمة بنجاح",
        "success"
      );
      loadPrepayments(currentPage);
    } else {
      showAlert(
        "alert-container",
        result.message || "فشل استهلاك الدفعة المقدمة",
        "error"
      );
    }
  } catch (error) {
    console.error("Error amortizing prepayment:", error);
    showAlert("alert-container", "خطأ في استهلاك الدفعة المقدمة", "error");
  }
}

async function recognizeRevenue(id) {
  if (!confirm("هل تريد تحقق إيراد غير مكتسب لهذا الشهر؟")) return;

  try {
    const result = await fetchAPI("accrual?module=unearned_revenue", "PUT", {
      id: id,
      recognition_date: new Date().toISOString().split("T")[0],
    });

    if (result.success) {
      showAlert("alert-container", "تم تحقق الإيراد بنجاح", "success");
      loadUnearnedRevenue(currentPage);
    } else {
      showAlert(
        "alert-container",
        result.message || "فشل تحقق الإيراد",
        "error"
      );
    }
  } catch (error) {
    console.error("Error recognizing revenue:", error);
    showAlert("alert-container", "خطأ في تحقق الإيراد", "error");
  }
}

document
  .getElementById("accrual-form")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const type = document.getElementById("accrual-type").value;
    const id = document.getElementById("accrual-id").value;

    let data = {};

    if (type === "payroll") {
      data = {
        payroll_date: document.getElementById("payroll-date").value,
        gross_pay: parseFloat(document.getElementById("gross-pay").value),
        deductions: parseFloat(
          document.getElementById("deductions").value || 0
        ),
        description: document.getElementById("payroll-description").value,
      };
    } else if (type === "prepayment") {
      data = {
        prepayment_date: document.getElementById("prepayment-date").value,
        total_amount: parseFloat(
          document.getElementById("prepayment-amount").value
        ),
        months: parseInt(document.getElementById("prepayment-months").value),
        description: document.getElementById("prepayment-description").value,
        expense_account_code:
          document.getElementById("prepayment-expense-account").value || null,
      };
    } else if (type === "unearned") {
      data = {
        receipt_date: document.getElementById("unearned-date").value,
        total_amount: parseFloat(
          document.getElementById("unearned-amount").value
        ),
        months: parseInt(document.getElementById("unearned-months").value),
        description: document.getElementById("unearned-description").value,
        revenue_account_code:
          document.getElementById("unearned-revenue-account").value || null,
      };
    }

    try {
      let result;
      const module =
        type === "payroll"
          ? "payroll"
          : type === "prepayment"
          ? "prepayments"
          : "unearned_revenue";

      if (id) {
        data.id = parseInt(id);
        result = await fetchAPI(`accrual?module=${module}`, "PUT", data);
      } else {
        result = await fetchAPI(`accrual?module=${module}`, "POST", data);
      }

      if (result.success) {
        showAlert("alert-container", "تم حفظ القيد بنجاح", "success");
        closeModal();
        loadCurrentTab();
      } else {
        showAlert(
          "alert-container",
          result.message || "فشل حفظ القيد",
          "error"
        );
      }
    } catch (error) {
      console.error("Error saving accrual:", error);
      showAlert("alert-container", "خطأ في حفظ القيد", "error");
    }
  });
