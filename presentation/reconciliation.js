let currentPage = 1;
let itemsPerPage = 20;

document.addEventListener("DOMContentLoaded", async function () {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  await loadReconciliations();
});

async function loadReconciliations(page = 1) {
  currentPage = page;
  try {
    const result = await fetchAPI(
      `reconciliation?page=${page}&limit=${itemsPerPage}`
    );
    if (result.success) {
      const reconciliations = result.data || [];
      const total = result.total || 0;

      const tbody = document.getElementById("reconciliation-table-body");
      tbody.innerHTML = "";

      if (reconciliations.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="6" style="text-align: center; padding: 2rem;">لا توجد تسويات</td></tr>';
      } else {
        reconciliations.forEach((rec) => {
          const row = document.createElement("tr");
          const diff = parseFloat(rec.difference || 0);
          const diffClass =
            Math.abs(diff) < 0.01 ? "balance-positive" : "balance-negative";

          row.innerHTML = `
            <td>${formatDate(rec.reconciliation_date)}</td>
            <td>${formatCurrency(rec.bank_balance)}</td>
            <td>${formatCurrency(rec.ledger_balance)}</td>
            <td class="${diffClass}">${formatCurrency(diff)}</td>
            <td>${rec.notes || ""}</td>
            <td>
              <button class="btn-icon" onclick="viewReconciliation(${
                rec.id
              })" title="عرض">
                <i class="fas fa-eye"></i>
              </button>
              ${
                Math.abs(diff) > 0.01
                  ? `
                <button class="btn-icon text-info" onclick="createAdjustment(${rec.id})" title="إنشاء قيد تسوية">
                  <i class="fas fa-adjust"></i>
                </button>
              `
                  : ""
              }
            </td>
          `;
          tbody.appendChild(row);
        });
      }

      renderPagination(
        "reconciliation-pagination",
        currentPage,
        Math.ceil(total / itemsPerPage),
        loadReconciliations
      );
    } else {
      showAlert(
        "alert-container",
        result.message || "فشل تحميل التسويات",
        "error"
      );
    }
  } catch (error) {
    console.error("Error loading reconciliations:", error);
    showAlert("alert-container", "خطأ في الاتصال بالسيرفر", "error");
  }
}

function showCreateModal() {
  document.getElementById("reconciliation-form").reset();
  document.getElementById("reconciliation-date").value = new Date()
    .toISOString()
    .split("T")[0];
  document.getElementById("reconciliation-results").style.display = "none";
  openDialog("reconciliation-modal");
}

async function calculateReconciliation() {
  const date = document.getElementById("reconciliation-date").value;
  const bankBalance = parseFloat(
    document.getElementById("bank-balance").value || 0
  );

  if (!date) {
    showAlert("alert-container", "يرجى إدخال تاريخ التسوية", "warning");
    return;
  }

  try {
    // Get ledger balance from API (this would need to be implemented in backend)
    // For now, we'll calculate it when saving
    document.getElementById("bank-balance-display").textContent =
      formatCurrency(bankBalance);
    document.getElementById("reconciliation-results").style.display = "block";
  } catch (error) {
    console.error("Error calculating reconciliation:", error);
  }
}

async function createAdjustment(reconciliationId) {
  const amount = prompt("أدخل مبلغ قيد التسوية:");
  if (!amount || parseFloat(amount) <= 0) return;

  const description = prompt("أدخل وصف قيد التسوية:");
  if (!description) return;

  const entryType = confirm("هل هذا مبلغ مدين؟ (نعم = مدين، لا = دائن)")
    ? "DEBIT"
    : "CREDIT";

  try {
    const result = await fetchAPI("reconciliation?action=adjust", "PUT", {
      reconciliation_id: reconciliationId,
      amount: parseFloat(amount),
      entry_type: entryType,
      description: description,
    });

    if (result.success) {
      showAlert("alert-container", "تم إنشاء قيد التسوية بنجاح", "success");
      loadReconciliations(currentPage);
    } else {
      showAlert(
        "alert-container",
        result.message || "فشل إنشاء قيد التسوية",
        "error"
      );
    }
  } catch (error) {
    console.error("Error creating adjustment:", error);
    showAlert("alert-container", "خطأ في إنشاء قيد التسوية", "error");
  }
}

function viewReconciliation(id) {
  // Implementation for viewing reconciliation details
  showAlert("alert-container", "عرض تفاصيل التسوية", "info");
}

function closeModal() {
  closeDialog("reconciliation-modal");
}

document
  .getElementById("reconciliation-form")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const data = {
      reconciliation_date: document.getElementById("reconciliation-date").value,
      bank_balance: parseFloat(
        document.getElementById("bank-balance").value || 0
      ),
      notes: document.getElementById("reconciliation-notes").value,
    };

    try {
      const result = await fetchAPI("reconciliation", "POST", data);
      if (result.success) {
        showAlert("alert-container", "تم حفظ التسوية بنجاح", "success");
        closeModal();
        loadReconciliations(1);
      } else {
        showAlert(
          "alert-container",
          result.message || "فشل حفظ التسوية",
          "error"
        );
      }
    } catch (error) {
      console.error("Error saving reconciliation:", error);
      showAlert("alert-container", "خطأ في حفظ التسوية", "error");
    }
  });
