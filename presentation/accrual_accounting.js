let currentTab = 'payroll';
let currentPage = 1;
let itemsPerPage = 20;

document.addEventListener("DOMContentLoaded", async function () {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  updateDateTime();
  setInterval(updateDateTime, 1000);

  await loadCurrentTab();
});

function updateDateTime() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const timeStr = now.toLocaleTimeString('ar-SA', {
    hour: '2-digit',
    minute: '2-digit'
  });
  const dateEl = document.getElementById('current-date');
  if (dateEl) {
    dateEl.textContent = `${dateStr} - ${timeStr}`;
  }
}

function switchTab(tab) {
  currentTab = tab;
  
  // Update tab buttons
  document.querySelectorAll('.ledger-tab').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  // Show/hide tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.style.display = 'none';
  });
  document.getElementById(`tab-${tab}`).style.display = 'block';
  
  loadCurrentTab();
}

async function loadCurrentTab() {
  switch(currentTab) {
    case 'payroll':
      await loadPayroll();
      break;
    case 'prepayments':
      await loadPrepayments();
      break;
    case 'unearned':
      await loadUnearnedRevenue();
      break;
  }
}

async function loadPayroll(page = 1) {
  currentPage = page;
  try {
    const result = await fetchAPI(`accrual?module=payroll&page=${page}&limit=${itemsPerPage}`);
    if (result.success) {
      const payrolls = result.data || [];
      const total = result.total || 0;
      
      const tbody = document.getElementById('payroll-table-body');
      tbody.innerHTML = '';
      
      if (payrolls.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">لا توجد كشوف مرتبات</td></tr>';
      } else {
        payrolls.forEach(payroll => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${formatDate(payroll.payroll_date)}</td>
            <td>${formatCurrency(payroll.gross_pay || payroll.salary_amount || 0)}</td>
            <td>${formatCurrency(payroll.deductions || 0)}</td>
            <td><strong>${formatCurrency(payroll.net_pay || payroll.salary_amount || 0)}</strong></td>
            <td>${payroll.description || payroll.employee_name || ''}</td>
            <td>
              <div class="action-buttons">
                <button class="icon-btn view" onclick="viewPayroll(${payroll.id})" title="عرض">
                  ${getIcon("eye")}
                </button>
              </div>
            </td>
          `;
          tbody.appendChild(row);
        });
      }
      
      renderPagination('payroll-pagination', currentPage, Math.ceil(total / itemsPerPage), loadPayroll);
    } else {
      showAlert('alert-container', result.message || 'فشل تحميل كشوف المرتبات', 'error');
    }
  } catch (error) {
    console.error('Error loading payroll:', error);
    showAlert('alert-container', 'خطأ في الاتصال بالسيرفر', 'error');
  }
}

async function loadPrepayments(page = 1) {
  currentPage = page;
  try {
    const result = await fetchAPI(`accrual?module=prepayments&page=${page}&limit=${itemsPerPage}`);
    if (result.success) {
      const prepayments = result.data || [];
      const total = result.total || 0;
      
      const tbody = document.getElementById('prepayments-table-body');
      tbody.innerHTML = '';
      
      if (prepayments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">لا توجد مدفوعات مقدمة</td></tr>';
      } else {
        prepayments.forEach(prep => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${formatDate(prep.prepayment_date || prep.payment_date)}</td>
            <td>${formatCurrency(prep.total_amount)}</td>
            <td>${prep.months || prep.amortization_periods || 1}</td>
            <td>${prep.description || ''}</td>
            <td>${prep.expense_account_code || ''}</td>
            <td>
              <div class="action-buttons">
                <button class="icon-btn view" onclick="viewPrepayment(${prep.id})" title="عرض">
                  ${getIcon("eye")}
                </button>
                <button class="icon-btn edit" onclick="amortizePrepayment(${prep.id})" title="استهلاك">
                  ${getIcon("edit")}
                </button>
              </div>
            </td>
          `;
          tbody.appendChild(row);
        });
      }
      
      renderPagination('prepayments-pagination', currentPage, Math.ceil(total / itemsPerPage), loadPrepayments);
    } else {
      showAlert('alert-container', result.message || 'فشل تحميل المدفوعات المقدمة', 'error');
    }
  } catch (error) {
    console.error('Error loading prepayments:', error);
    showAlert('alert-container', 'خطأ في الاتصال بالسيرفر', 'error');
  }
}

async function loadUnearnedRevenue(page = 1) {
  currentPage = page;
  try {
    const result = await fetchAPI(`accrual?module=unearned_revenue&page=${page}&limit=${itemsPerPage}`);
    if (result.success) {
      const unearned = result.data || [];
      const total = result.total || 0;
      
      const tbody = document.getElementById('unearned-table-body');
      tbody.innerHTML = '';
      
      if (unearned.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">لا توجد إيرادات غير مكتسبة</td></tr>';
      } else {
        unearned.forEach(ur => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${formatDate(ur.receipt_date)}</td>
            <td>${formatCurrency(ur.total_amount)}</td>
            <td>${ur.months}</td>
            <td>${ur.description || ''}</td>
            <td>${ur.revenue_account_code || ''}</td>
            <td>
              <div class="action-buttons">
                <button class="icon-btn view" onclick="viewUnearned(${ur.id})" title="عرض">
                  ${getIcon("eye")}
                </button>
                <button class="icon-btn edit" onclick="recognizeRevenue(${ur.id})" title="تحقق">
                  ${getIcon("edit")}
                </button>
              </div>
            </td>
          `;
          tbody.appendChild(row);
        });
      }
      
      renderPagination('unearned-pagination', currentPage, Math.ceil(total / itemsPerPage), loadUnearnedRevenue);
    } else {
      showAlert('alert-container', result.message || 'فشل تحميل الإيرادات غير المكتسبة', 'error');
    }
  } catch (error) {
    console.error('Error loading unearned revenue:', error);
    showAlert('alert-container', 'خطأ في الاتصال بالسيرفر', 'error');
  }
}

function showCreateModal() {
  // Show type selection first
  const type = prompt('اختر نوع القيد:\n1 - كشف مرتب\n2 - دفعة مقدمة\n3 - إيراد غير مكتسب', '1');
  if (!type) return;
  
  document.getElementById('accrual-form').reset();
  document.getElementById('accrual-id').value = '';
  
  // Hide all fields
  document.getElementById('payroll-fields').style.display = 'none';
  document.getElementById('prepayment-fields').style.display = 'none';
  document.getElementById('unearned-fields').style.display = 'none';
  
  const today = new Date().toISOString().split('T')[0];
  
  if (type === '1') {
    document.getElementById('modal-title').textContent = 'إضافة كشف مرتب';
    document.getElementById('accrual-type').value = 'payroll';
    document.getElementById('payroll-fields').style.display = 'block';
    document.getElementById('payroll-date').value = today;
  } else if (type === '2') {
    document.getElementById('modal-title').textContent = 'إضافة دفعة مقدمة';
    document.getElementById('accrual-type').value = 'prepayment';
    document.getElementById('prepayment-fields').style.display = 'block';
    document.getElementById('prepayment-date').value = today;
  } else if (type === '3') {
    document.getElementById('modal-title').textContent = 'إضافة إيراد غير مكتسب';
    document.getElementById('accrual-type').value = 'unearned';
    document.getElementById('unearned-fields').style.display = 'block';
    document.getElementById('unearned-date').value = today;
  } else {
    showAlert('alert-container', 'نوع غير صحيح', 'warning');
    return;
  }
  
  document.getElementById('accrual-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('accrual-modal').style.display = 'none';
}

function viewPayroll(id) {
  // Implementation for viewing payroll details
  showAlert('alert-container', 'عرض تفاصيل كشف المرتب', 'info');
}

function viewPrepayment(id) {
  showAlert('alert-container', 'عرض تفاصيل الدفعة المقدمة', 'info');
}

function viewUnearned(id) {
  showAlert('alert-container', 'عرض تفاصيل الإيراد غير المكتسب', 'info');
}

async function amortizePrepayment(id) {
  if (!confirm('هل تريد استهلاك دفعة مقدمة لهذا الشهر؟')) return;
  
  try {
    const result = await fetchAPI('accrual?module=prepayments', 'PUT', {
      id: id,
      amortization_date: new Date().toISOString().split('T')[0]
    });
    
    if (result.success) {
      showAlert('alert-container', 'تم استهلاك الدفعة المقدمة بنجاح', 'success');
      loadPrepayments(currentPage);
    } else {
      showAlert('alert-container', result.message || 'فشل استهلاك الدفعة المقدمة', 'error');
    }
  } catch (error) {
    console.error('Error amortizing prepayment:', error);
    showAlert('alert-container', 'خطأ في استهلاك الدفعة المقدمة', 'error');
  }
}

async function recognizeRevenue(id) {
  if (!confirm('هل تريد تحقق إيراد غير مكتسب لهذا الشهر؟')) return;
  
  try {
    const result = await fetchAPI('accrual?module=unearned_revenue', 'PUT', {
      id: id,
      recognition_date: new Date().toISOString().split('T')[0]
    });
    
    if (result.success) {
      showAlert('alert-container', 'تم تحقق الإيراد بنجاح', 'success');
      loadUnearnedRevenue(currentPage);
    } else {
      showAlert('alert-container', result.message || 'فشل تحقق الإيراد', 'error');
    }
  } catch (error) {
    console.error('Error recognizing revenue:', error);
    showAlert('alert-container', 'خطأ في تحقق الإيراد', 'error');
  }
}

document.getElementById('accrual-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const type = document.getElementById('accrual-type').value;
  const id = document.getElementById('accrual-id').value;
  
  let data = {};
  
  if (type === 'payroll') {
    data = {
      payroll_date: document.getElementById('payroll-date').value,
      gross_pay: parseFloat(document.getElementById('gross-pay').value),
      deductions: parseFloat(document.getElementById('deductions').value || 0),
      description: document.getElementById('payroll-description').value
    };
  } else if (type === 'prepayment') {
    data = {
      prepayment_date: document.getElementById('prepayment-date').value,
      total_amount: parseFloat(document.getElementById('prepayment-amount').value),
      months: parseInt(document.getElementById('prepayment-months').value),
      description: document.getElementById('prepayment-description').value,
      expense_account_code: document.getElementById('prepayment-expense-account').value || null
    };
  } else if (type === 'unearned') {
    data = {
      receipt_date: document.getElementById('unearned-date').value,
      total_amount: parseFloat(document.getElementById('unearned-amount').value),
      months: parseInt(document.getElementById('unearned-months').value),
      description: document.getElementById('unearned-description').value,
      revenue_account_code: document.getElementById('unearned-revenue-account').value || null
    };
  }
  
  try {
    let result;
    const module = type === 'payroll' ? 'payroll' : type === 'prepayment' ? 'prepayments' : 'unearned_revenue';
    
    if (id) {
      data.id = parseInt(id);
      result = await fetchAPI(`accrual?module=${module}`, 'PUT', data);
    } else {
      result = await fetchAPI(`accrual?module=${module}`, 'POST', data);
    }
    
    if (result.success) {
      showAlert('alert-container', 'تم حفظ القيد بنجاح', 'success');
      closeModal();
      loadCurrentTab();
    } else {
      showAlert('alert-container', result.message || 'فشل حفظ القيد', 'error');
    }
  } catch (error) {
    console.error('Error saving accrual:', error);
    showAlert('alert-container', 'خطأ في حفظ القيد', 'error');
  }
});

