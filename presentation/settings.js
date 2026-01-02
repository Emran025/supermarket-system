document.addEventListener("DOMContentLoaded", async function () {
  const user = await checkAuth();
  if (!user || user.role !== "admin") {
    window.location.href = "dashboard.html";
    return;
  }

  await loadSettings();

  document
    .getElementById("save-settings-btn")
    .addEventListener("click", saveSettings);

  document
    .getElementById("preview-invoice-btn")
    .addEventListener("click", previewInvoice);
});

async function previewInvoice() {
  const previewBtn = document.getElementById("preview-invoice-btn");
  const originalHtml = previewBtn.innerHTML;
  previewBtn.disabled = true;
  previewBtn.innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> جاري التحضير...';

  // Gather unsaved settings from form
  const keys = [
    "store_name",
    "store_address",
    "store_phone",
    "tax_number",
    "invoice_size",
    "footer_message",
    "currency_symbol",
  ];
  const settings = {};
  keys.forEach((key) => {
    const input = document.getElementById(key);
    if (input) settings[key] = input.value;
  });

  try {
    // 1. Fetch a sample invoice for the preview (latest one)
    const res = await fetchAPI("invoices?page=1&per_page=1");
    if (!res.success || !res.data || res.data.length === 0) {
      showToast("لا توجد مبيعات سابقة لإجراء المعاينة", "error");
      return;
    }

    // 2. Fetch full details of that sample invoice
    const sampleId = res.data[0].id;
    const detailRes = await fetchAPI(`invoice_details&id=${sampleId}`);
    if (!detailRes.success) {
      showToast("فشل تحميل بيانات المعاينة", "error");
      return;
    }

    const inv = detailRes.data;

    // 3. Generate HTML using UNSAVED settings
    const content = generateInvoiceHTML(inv, settings);

    // 4. Print/Preview
    const printFrame = document.createElement("iframe");
    printFrame.style.display = "none";
    document.body.appendChild(printFrame);

    printFrame.contentDocument.open();
    printFrame.contentDocument.write(content);
    printFrame.contentDocument.close();

    setTimeout(() => {
      printFrame.contentWindow.focus();
      printFrame.contentWindow.print();
      setTimeout(() => {
        if (printFrame.parentNode) document.body.removeChild(printFrame);
      }, 1000);
    }, 500);
  } catch (error) {
    console.error("Preview error", error);
    showToast("حدث خطأ أثناء المعاينة", "error");
  } finally {
    previewBtn.disabled = false;
    previewBtn.innerHTML = originalHtml;
  }
}

async function loadSettings() {
  const result = await fetchAPI("settings");
  if (result.success) {
    const settings = result.data;
    for (const key in settings) {
      const input = document.getElementById(key);
      if (input) {
        input.value = settings[key];
      }
    }
  } else {
    showToast("فشل تحميل الإعدادات", "error");
  }
}

async function saveSettings() {
  const saveBtn = document.getElementById("save-settings-btn");
  const originalText = saveBtn.textContent;
  saveBtn.disabled = true;
  saveBtn.textContent = "جاري الحفظ...";

  const keys = [
    "store_name",
    "store_address",
    "store_phone",
    "tax_number",
    "invoice_size",
    "footer_message",
    "currency_symbol",
  ];
  const data = {};

  keys.forEach((key) => {
    const input = document.getElementById(key);
    if (input) {
      data[key] = input.value;
    }
  });

  try {
    const result = await fetchAPI("settings", "POST", data);
    if (result.success) {
      showToast("تم حفظ الإعدادات بنجاح", "success");
      // Clear cache in common.js
      if (typeof systemSettings !== "undefined") {
        systemSettings = null;
      }
    } else {
      showToast(result.message || "حدث خطأ أثناء الحفظ", "error");
    }
  } catch (error) {
    showToast("خطأ في الاتصال بالخادم", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = originalText;
  }
}
