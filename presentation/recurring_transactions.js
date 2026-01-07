let currentPage = 1;
let itemsPerPage = 20;

document.addEventListener("DOMContentLoaded", async function () {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  updateDateTime();
  setInterval(updateDateTime, 1000);

  await loadRecurringTransactions();
});

function updateDateTime() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("ar-SA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateEl = document.getElementById("current-date");
  if (dateEl) {
    dateEl.textContent = `${dateStr} - ${timeStr}`;
  }
}

async function loadRecurringTransactions(page = 1) {
  currentPage = page;
  try {
    const result = await fetchAPI(
      `recurring_transactions?page=${page}&limit=${itemsPerPage}`
    );
    if (result.success) {
      const templates = result.data || [];
      const total = result.total || 0;

      const tbody = document.getElementById("recurring-table-body");
      tbody.innerHTML = "";

      if (templates.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="7" style="text-align: center; padding: 2rem;">لا توجد قوالب</td></tr>';
      } else {
        templates.forEach((template) => {
          const row = document.createElement("tr");
          const typeText =
            {
              expense: "مصروف",
              revenue: "إيراد",
              journal_voucher: "سند قيد",
            }[template.type] || template.type;

          const frequencyText =
            {
              daily: "يومي",
              weekly: "أسبوعي",
              monthly: "شهري",
              quarterly: "ربع سنوي",
              annually: "سنوي",
            }[template.frequency] || template.frequency;

          const statusClass =
            template.next_due_date &&
            new Date(template.next_due_date) <= new Date()
              ? "badge-warning"
              : "badge-success";
          const statusText =
            template.next_due_date &&
            new Date(template.next_due_date) <= new Date()
              ? "مستحق"
              : "نشط";

          row.innerHTML = `
            <td><strong>${template.name}</strong></td>
            <td>${typeText}</td>
            <td>${frequencyText}</td>
            <td>${
              template.next_due_date ? formatDate(template.next_due_date) : "-"
            }</td>
            <td>${
              template.last_generated_date
                ? formatDate(template.last_generated_date)
                : "لم ينفذ"
            }</td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
            <td>
              <div class="action-buttons">
                <button class="icon-btn view" onclick="viewTemplate(${
                  template.id
                })" title="عرض">
                  ${getIcon("eye")}
                </button>
                <button class="icon-btn edit" onclick="editTemplate(${
                  template.id
                })" title="تعديل">
                  ${getIcon("edit")}
                </button>
                <button class="icon-btn delete" onclick="deleteTemplate(${
                  template.id
                })" title="حذف">
                  ${getIcon("trash")}
                </button>
                <button class="icon-btn edit" onclick="generateTransaction(${
                  template.id
                })" title="تنفيذ الآن" style="background: var(--success-color); color: white;">
                  ${getIcon("check")}
                </button>
              </div>
            </td>
          `;
          tbody.appendChild(row);
        });
      }

      renderPagination(
        "recurring-pagination",
        currentPage,
        Math.ceil(total / itemsPerPage),
        loadRecurringTransactions
      );
    } else {
      showAlert(
        "alert-container",
        result.message || "فشل تحميل القوالب",
        "error"
      );
    }
  } catch (error) {
    console.error("Error loading recurring transactions:", error);
    showAlert("alert-container", "خطأ في الاتصال بالسيرفر", "error");
  }
}

function showCreateModal() {
  document.getElementById("modal-title").textContent =
    "قالب معاملة متكررة جديد";
  document.getElementById("recurring-form").reset();
  document.getElementById("recurring-id").value = "";
  document.getElementById("next-due-date").value = new Date()
    .toISOString()
    .split("T")[0];
  document.getElementById("expense-fields").style.display = "none";
  document.getElementById("revenue-fields").style.display = "none";
  document.getElementById("journal-fields").style.display = "none";
  document.getElementById("journal-fields").style.display = "none";
  openDialog("recurring-modal");
}

function updateTemplateFields() {
  const type = document.getElementById("template-type").value;

  document.getElementById("expense-fields").style.display =
    type === "expense" ? "block" : "none";
  document.getElementById("revenue-fields").style.display =
    type === "revenue" ? "block" : "none";
  document.getElementById("journal-fields").style.display =
    type === "journal_voucher" ? "block" : "none";

  // Update required fields
  const expenseRequired = type === "expense";
  const revenueRequired = type === "revenue";
  const journalRequired = type === "journal_voucher";

  document.getElementById("expense-account").required = expenseRequired;
  document.getElementById("expense-amount").required = expenseRequired;
  document.getElementById("revenue-account").required = revenueRequired;
  document.getElementById("revenue-amount").required = revenueRequired;
  document.getElementById("journal-entries").required = journalRequired;
}

function closeModal() {
  closeDialog("recurring-modal");
}

async function viewTemplate(id) {
  // Load template details
  try {
    const result = await fetchAPI(`recurring_transactions?id=${id}`);
    if (result.success) {
      const template = result.data[0] || result.data;
      if (template) {
        alert(
          `الاسم: ${template.name}\nالنوع: ${template.type}\nالتكرار: ${template.frequency}\nتاريخ الاستحقاق: ${template.next_due_date}`
        );
      }
    }
  } catch (error) {
    console.error("Error loading template:", error);
  }
}

async function editTemplate(id) {
  try {
    const result = await fetchAPI(`recurring_transactions?id=${id}`);
    if (result.success) {
      const template = result.data[0] || result.data;
      if (!template) {
        showAlert("alert-container", "القالب غير موجود", "error");
        return;
      }

      document.getElementById("modal-title").textContent = "تعديل القالب";
      document.getElementById("recurring-id").value = template.id;
      document.getElementById("template-name").value = template.name;
      document.getElementById("template-type").value = template.type;
      document.getElementById("template-frequency").value = template.frequency;
      document.getElementById("next-due-date").value = template.next_due_date;

      updateTemplateFields();

      const templateData = template.template_data || {};

      if (template.type === "expense") {
        document.getElementById("expense-account").value =
          templateData.account_code || "";
        document.getElementById("expense-amount").value =
          templateData.amount || "";
        document.getElementById("expense-description").value =
          templateData.description || "";
      } else if (template.type === "revenue") {
        document.getElementById("revenue-account").value =
          templateData.account_code || "";
        document.getElementById("revenue-amount").value =
          templateData.amount || "";
        document.getElementById("revenue-description").value =
          templateData.description || "";
      } else if (template.type === "journal_voucher") {
        document.getElementById("journal-entries").value = JSON.stringify(
          templateData.entries || [],
          null,
          2
        );
      }

      openDialog("recurring-modal");
    }
  } catch (error) {
    console.error("Error loading template:", error);
    showAlert("alert-container", "خطأ في تحميل القالب", "error");
  }
}

async function deleteTemplate(id) {
  if (!confirm("هل أنت متأكد من حذف هذا القالب؟")) return;

  try {
    const result = await fetchAPI(`recurring_transactions?id=${id}`, "DELETE");
    if (result.success) {
      showAlert("alert-container", "تم حذف القالب بنجاح", "success");
      loadRecurringTransactions(currentPage);
    } else {
      showAlert("alert-container", result.message || "فشل حذف القالب", "error");
    }
  } catch (error) {
    console.error("Error deleting template:", error);
    showAlert("alert-container", "خطأ في حذف القالب", "error");
  }
}

async function generateTransaction(id) {
  if (!confirm("هل تريد تنفيذ هذه المعاملة الآن؟")) return;

  try {
    const result = await fetchAPI(
      "recurring_transactions?action=process",
      "POST",
      {
        template_id: id,
        generation_date: new Date().toISOString().split("T")[0],
      }
    );

    if (result.success) {
      showAlert(
        "alert-container",
        `تم تنفيذ المعاملة بنجاح. رقم السند: ${
          result.data?.voucher_number || ""
        }`,
        "success"
      );
      loadRecurringTransactions(currentPage);
    } else {
      showAlert(
        "alert-container",
        result.message || "فشل تنفيذ المعاملة",
        "error"
      );
    }
  } catch (error) {
    console.error("Error generating transaction:", error);
    showAlert("alert-container", "خطأ في تنفيذ المعاملة", "error");
  }
}

document
  .getElementById("recurring-form")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const type = document.getElementById("template-type").value;
    const id = document.getElementById("recurring-id").value;

    let templateData = {};

    if (type === "expense") {
      templateData = {
        category: "Recurring Expense",
        account_code: document.getElementById("expense-account").value,
        amount: parseFloat(document.getElementById("expense-amount").value),
        description: document.getElementById("expense-description").value,
      };
    } else if (type === "revenue") {
      templateData = {
        source: "Recurring Revenue",
        account_code: document.getElementById("revenue-account").value,
        amount: parseFloat(document.getElementById("revenue-amount").value),
        description: document.getElementById("revenue-description").value,
      };
    } else if (type === "journal_voucher") {
      try {
        const entries = JSON.parse(
          document.getElementById("journal-entries").value
        );
        templateData = { entries: entries };
      } catch (error) {
        showAlert("alert-container", "صيغة JSON غير صحيحة", "error");
        return;
      }
    }

    const data = {
      name: document.getElementById("template-name").value,
      type: type,
      frequency: document.getElementById("template-frequency").value,
      next_due_date: document.getElementById("next-due-date").value,
      template_data: templateData,
    };

    try {
      let result;
      if (id) {
        data.id = parseInt(id);
        result = await fetchAPI("recurring_transactions", "PUT", data);
      } else {
        result = await fetchAPI("recurring_transactions", "POST", data);
      }

      if (result.success) {
        showAlert("alert-container", "تم حفظ القالب بنجاح", "success");
        closeModal();
        loadRecurringTransactions(1);
      } else {
        showAlert(
          "alert-container",
          result.message || "فشل حفظ القالب",
          "error"
        );
      }
    } catch (error) {
      console.error("Error saving template:", error);
      showAlert("alert-container", "خطأ في حفظ القالب", "error");
    }
  });
