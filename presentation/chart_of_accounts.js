let accounts = [];

document.addEventListener("DOMContentLoaded", async function () {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  await loadAccounts();
});

async function loadAccounts() {
  try {
    const type = document.getElementById("filter-type").value;
    let url = "chart_of_accounts";
    if (type) url += `?type=${encodeURIComponent(type)}`;

    const result = await fetchAPI(url);
    if (result.success) {
      accounts = result.data || [];
      renderAccounts();
    } else {
      showAlert(
        "alert-container",
        result.message || "فشل تحميل الحسابات",
        "error"
      );
    }
  } catch (error) {
    console.error("Error loading accounts:", error);
    showAlert("alert-container", "خطأ في الاتصال بالسيرفر", "error");
  }
}

function renderAccounts() {
  const tbody = document.getElementById("accounts-table-body");
  tbody.innerHTML = "";

  if (accounts.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align: center; padding: 2rem;">لا توجد حسابات</td></tr>';
  } else {
    accounts.forEach((account) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${account.account_code}</strong></td>
        <td>${account.account_name}</td>
        <td>${account.account_type}</td>
        <td>${account.parent_id ? "نعم" : "لا"}</td>
        <td><span class="badge ${
          account.is_active ? "badge-success" : "badge-danger"
        }">${account.is_active ? "نشط" : "غير نشط"}</span></td>
            <td>
              <div class="action-buttons">
                <button class="icon-btn edit" onclick="editAccount(${
                  account.id
                })" title="تعديل">
                  ${getIcon("edit")}
                </button>
                <button class="icon-btn delete" onclick="deleteAccount(${
                  account.id
                })" title="حذف">
                  ${getIcon("trash")}
                </button>
              </div>
            </td>
      `;
      tbody.appendChild(row);
    });
  }
}

function showCreateModal() {
  document.getElementById("modal-title").textContent = "حساب جديد";
  document.getElementById("account-form").reset();
  document.getElementById("account-id").value = "";
  loadParentAccounts();
  openDialog("account-modal");
}

function loadParentAccounts() {
  const select = document.getElementById("account-parent");
  select.innerHTML = '<option value="">لا يوجد</option>';
  accounts.forEach((acc) => {
    select.innerHTML += `<option value="${acc.id}">${acc.account_code} - ${acc.account_name}</option>`;
  });
}

async function editAccount(id) {
  const account = accounts.find((a) => a.id === id);
  if (!account) return;

  document.getElementById("modal-title").textContent = "تعديل الحساب";
  document.getElementById("account-id").value = account.id;
  document.getElementById("account-code").value = account.account_code;
  document.getElementById("account-code").disabled = true; // Can't change code
  document.getElementById("account-name").value = account.account_name;
  document.getElementById("account-type").value = account.account_type;
  document.getElementById("account-type").disabled = true; // Can't change type
  document.getElementById("account-description").value =
    account.description || "";
  loadParentAccounts();
  document.getElementById("account-parent").value = account.parent_id || "";
  document.getElementById("account-modal").style.display = "flex";
}

async function deleteAccount(id) {
  if (!confirm("هل أنت متأكد من حذف هذا الحساب؟")) return;

  try {
    const result = await fetchAPI(`chart_of_accounts?id=${id}`, "DELETE");
    if (result.success) {
      showAlert("alert-container", "تم حذف الحساب بنجاح", "success");
      loadAccounts();
    } else {
      showAlert("alert-container", result.message || "فشل حذف الحساب", "error");
    }
  } catch (error) {
    console.error("Error deleting account:", error);
    showAlert("alert-container", "خطأ في حذف الحساب", "error");
  }
}

function closeModal() {
  closeDialog("account-modal");
  document.getElementById("account-form").reset();
  document.getElementById("account-code").disabled = false;
  document.getElementById("account-type").disabled = false;
}

async function loadAccountBalances() {
  try {
    const result = await fetchAPI("chart_of_accounts?action=balances");
    if (result.success) {
      const data = result.data || {};
      const accounts = data.accounts || [];

      // Show in modal or new page
      let content =
        '<h2>أرصدة الحسابات</h2><table class="data-table"><thead><tr><th>الحساب</th><th>المدين</th><th>الدائن</th><th>الرصيد</th></tr></thead><tbody>';

      accounts.forEach((acc) => {
        if (Math.abs(acc.balance) > 0.01) {
          content += `<tr>
            <td><strong>${acc.account_code}</strong> - ${acc.account_name}</td>
            <td>${formatCurrency(acc.total_debits)}</td>
            <td>${formatCurrency(acc.total_credits)}</td>
            <td class="${
              acc.balance >= 0 ? "balance-positive" : "balance-negative"
            }">${formatCurrency(acc.balance)}</td>
          </tr>`;
        }
      });

      content += "</tbody></table>";

      // Create and show modal
      const modal = document.createElement("div");
      modal.className = "modal";
      modal.style.display = "flex";
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px">
          <div class="modal-header">
            <h2>أرصدة الحسابات</h2>
            <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
          </div>
          <div class="modal-body">
            ${content}
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
  } catch (error) {
    console.error("Error loading balances:", error);
    showAlert("alert-container", "خطأ في تحميل الأرصدة", "error");
  }
}

document
  .getElementById("account-form")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const accountId = document.getElementById("account-id").value;
    const data = {
      account_code: document.getElementById("account-code").value,
      account_name: document.getElementById("account-name").value,
      account_type: document.getElementById("account-type").value,
      parent_id: document.getElementById("account-parent").value || null,
      description: document.getElementById("account-description").value,
    };

    try {
      let result;
      if (accountId) {
        data.id = parseInt(accountId);
        result = await fetchAPI("chart_of_accounts", "PUT", data);
      } else {
        result = await fetchAPI("chart_of_accounts", "POST", data);
      }

      if (result.success) {
        showAlert("alert-container", "تم حفظ الحساب بنجاح", "success");
        closeModal();
        loadAccounts();
      } else {
        showAlert(
          "alert-container",
          result.message || "فشل حفظ الحساب",
          "error"
        );
      }
    } catch (error) {
      console.error("Error saving account:", error);
      showAlert("alert-container", "خطأ في حفظ الحساب", "error");
    }
  });
