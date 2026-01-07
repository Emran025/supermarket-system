let expenses = [];
let currentExpenseId = null;
let currentPage = 1;
let itemsPerPage = 20;

// Initialize
document.addEventListener("DOMContentLoaded", async function () {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  // Setup UI permissions
  if (!canAccess("expenses", "create")) {
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
        currentPage = 1;
        loadExpenses();
      }, 400);
    });
  }

  await loadExpenses();
});

async function loadExpenses() {
  try {
    const searchInput = document.getElementById("params-search");
    const searchValue = searchInput ? searchInput.value : "";

    const response = await fetch(
      `${API_BASE}?action=expenses&page=${currentPage}&limit=${itemsPerPage}&search=${encodeURIComponent(
        searchValue
      )}`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    const result = await response.json();
    if (result.success) {
      expenses = result.data;
      renderExpenses();
      renderPagination(result.pagination, "pagination-controls", (newPage) => {
        currentPage = newPage;
        loadExpenses();
      });
    }
  } catch (error) {
    showAlert("alert-container", "خطأ في تحميل المصروفات", "error");
  }
}

function renderExpenses() {
  const tbody = document.getElementById("expenses-tbody");
  if (!tbody) return;

  if (expenses.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align: center; padding: 2rem;">لا توجد مصروفات مسجلة</td></tr>';
    return;
  }

  tbody.innerHTML = expenses
    .map(
      (e) => `
        <tr class="animate-fade">
            <td>#${e.id}</td>
            <td><span class="badge badge-info">${translateCategory(
              e.category
            )}</span></td>
            <td class="text-danger" style="font-weight: 600;">${formatCurrency(
              e.amount
            )}</td>
            <td>${formatDate(e.expense_date)}</td>
            <td>${e.description || "-"}</td>
            <td><span class="badge badge-secondary">${
              e.recorder_name || "النظام"
            }</span></td>
            <td>
                <div class="action-buttons">
                    ${
                      canAccess("expenses", "edit")
                        ? `<button class="icon-btn edit" onclick="editExpense(${
                            e.id
                          })">${getIcon("edit")}</button>`
                        : ""
                    }
                    ${
                      canAccess("expenses", "delete")
                        ? `<button class="icon-btn delete" onclick="deleteExpense(${
                            e.id
                          })">${getIcon("trash")}</button>`
                        : ""
                    }
                </div>
            </td>
        </tr>
    `
    )
    .join("");
}

function translateCategory(cat) {
  const categories = {
    Salaries: "رواتب",
    Rent: "إيجار",
    Electricity: "كهرباء",
    Water: "مياه",
    Internet: "إنترنت",
    Maintenance: "صيانة",
    Marketing: "تسويق",
    Supplies: "مستلزمات مكتبية",
    Others: "أخرى",
  };
  return categories[cat] || cat;
}

function openAddDialog() {
  currentExpenseId = null;
  document.getElementById("expense-dialog-title").textContent =
    "إضافة مصروف جديد";
  const form = document.getElementById("expense-form");
  form.reset();
  document.getElementById("expense-date").value = new Date()
    .toISOString()
    .slice(0, 16);
  openDialog("expense-dialog");
}

function editExpense(id) {
  const e = expenses.find((item) => item.id == id);
  if (!e) return;

  currentExpenseId = id;
  document.getElementById("expense-dialog-title").textContent = "تعديل مصروف";
  document.getElementById("expense-category").value = e.category;
  document.getElementById("expense-amount").value = e.amount;
  document.getElementById("expense-description").value = e.description || "";
  document.getElementById("expense-date").value = new Date(e.expense_date)
    .toISOString()
    .slice(0, 16);

  openDialog("expense-dialog");
}

async function saveExpense() {
  const category = document.getElementById("expense-category").value;
  const amount = document.getElementById("expense-amount").value;
  const date = document.getElementById("expense-date").value;
  const description = document.getElementById("expense-description").value;

  if (!category || !amount || !date) {
    showAlert("alert-container", "يرجى ملء جميع الحقول المطلوبة", "error");
    return;
  }

  const btn = document.getElementById("save-expense-btn");
  btn.disabled = true;

  try {
    const method = currentExpenseId ? "PUT" : "POST";
    const body = {
      category,
      amount: parseFloat(amount),
      expense_date: date + ":00",
      description,
    };
    if (currentExpenseId) body.id = currentExpenseId;

    const response = await fetch(`${API_BASE}?action=expenses`, {
      method: method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    const result = await response.json();
    if (result.success) {
      showAlert("alert-container", "تم الحفظ بنجاح", "success");
      closeDialog("expense-dialog");
      loadExpenses();
    } else {
      showAlert("alert-container", result.message, "error");
    }
  } catch (e) {
    showAlert("alert-container", "خطأ في الاتصال بالسيرفر", "error");
  } finally {
    btn.disabled = false;
  }
}

async function deleteExpense(id) {
  if (!(await showConfirm("هل أنت متأكد من حذف هذا المصروف؟"))) return;

  try {
    const response = await fetch(`${API_BASE}?action=expenses&id=${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const result = await response.json();
    if (result.success) {
      showAlert("alert-container", "تم الحذف بنجاح", "success");
      loadExpenses();
    } else {
      showAlert("alert-container", result.message, "error");
    }
  } catch (e) {
    showAlert("alert-container", "خطأ في الحذف", "error");
  }
}
