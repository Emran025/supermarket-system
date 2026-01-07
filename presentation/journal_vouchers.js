let currentPage = 1;
let itemsPerPage = 20;
let accounts = [];

document.addEventListener("DOMContentLoaded", async function () {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  await loadAccounts();
  await loadJournalVouchers();
});

async function loadAccounts() {
  try {
    const result = await fetchAPI('chart_of_accounts');
    if (result.success) {
      accounts = result.data || [];
    }
  } catch (error) {
    console.error('Error loading accounts:', error);
  }
}

async function loadJournalVouchers(page = 1) {
  currentPage = page;
  try {
    const search = document.getElementById('search-jv').value;
    let url = `journal_vouchers?page=${page}&limit=${itemsPerPage}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    
    const result = await fetchAPI(url);
    if (result.success) {
      const jvs = result.data || [];
      const total = result.total || 0;
      
      const tbody = document.getElementById('jv-table-body');
      tbody.innerHTML = '';
      
      if (jvs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">لا توجد سندات قيد</td></tr>';
      } else {
        jvs.forEach(jv => {
          const entries = jv.entries || [];
          const totalAmount = entries.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
          
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${formatDate(jv.voucher_date)}</td>
            <td><strong>${jv.voucher_number}</strong></td>
            <td>${jv.description || ''}</td>
            <td>${entries.length}</td>
            <td>${formatCurrency(totalAmount)}</td>
            <td>${jv.created_by_name || ''}</td>
            <td>
              <button class="btn-icon" onclick="viewJV(${jv.id})" title="عرض">
                <i class="fas fa-eye"></i>
              </button>
              <button class="btn-icon" onclick="editJV(${jv.id})" title="تعديل">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn-icon text-danger" onclick="deleteJV(${jv.id})" title="حذف">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          `;
          tbody.appendChild(row);
        });
      }
      
      renderPagination('jv-pagination', currentPage, Math.ceil(total / itemsPerPage), loadJournalVouchers);
    } else {
      showAlert('alert-container', result.message || 'فشل تحميل السندات', 'error');
    }
  } catch (error) {
    console.error('Error loading journal vouchers:', error);
    showAlert('alert-container', 'خطأ في الاتصال بالسيرفر', 'error');
  }
}

function searchJournalVouchers() {
  loadJournalVouchers(1);
}

function showCreateModal() {
  document.getElementById('modal-title').textContent = 'سند قيد جديد';
  document.getElementById('jv-form').reset();
  document.getElementById('jv-id').value = '';
  document.getElementById('jv-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('jv-entries-container').innerHTML = '';
  addEntryRow();
  addEntryRow();
  updateTotals();
  document.getElementById('jv-modal').style.display = 'flex';
}

function addEntryRow() {
  const container = document.getElementById('jv-entries-container');
  const row = document.createElement('div');
  row.className = 'jv-entry-row';
  const rowId = Date.now();
  
  let accountsOptions = '<option value="">اختر الحساب</option>';
  accounts.forEach(acc => {
    accountsOptions += `<option value="${acc.account_code}">${acc.account_code} - ${acc.account_name}</option>`;
  });
  
  row.innerHTML = `
    <select class="form-input entry-account" onchange="updateTotals()">
      ${accountsOptions}
    </select>
    <div class="debit-credit-toggle">
      <button type="button" class="entry-type active" data-type="DEBIT" onclick="toggleEntryType(this)">مدين</button>
      <button type="button" class="entry-type" data-type="CREDIT" onclick="toggleEntryType(this)">دائن</button>
    </div>
    <input type="number" class="form-input entry-amount" step="0.01" min="0" placeholder="المبلغ" oninput="updateTotals()" />
    <input type="text" class="form-input entry-description" placeholder="الوصف" />
    <button type="button" class="btn-icon text-danger" onclick="removeEntryRow(this)">
      <i class="fas fa-trash"></i>
    </button>
  `;
  container.appendChild(row);
}

function removeEntryRow(btn) {
  btn.closest('.jv-entry-row').remove();
  updateTotals();
}

function toggleEntryType(btn) {
  const row = btn.closest('.jv-entry-row');
  row.querySelectorAll('.entry-type').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  updateTotals();
}

function updateTotals() {
  const rows = document.querySelectorAll('.jv-entry-row');
  let totalDebit = 0;
  let totalCredit = 0;
  
  rows.forEach(row => {
    const amount = parseFloat(row.querySelector('.entry-amount').value || 0);
    const typeBtn = row.querySelector('.entry-type.active');
    const type = typeBtn ? typeBtn.dataset.type : 'DEBIT';
    
    if (type === 'DEBIT') {
      totalDebit += amount;
    } else {
      totalCredit += amount;
    }
  });
  
  document.getElementById('total-debit').textContent = formatCurrency(totalDebit);
  document.getElementById('total-credit').textContent = formatCurrency(totalCredit);
  
  const diff = totalDebit - totalCredit;
  const diffEl = document.getElementById('total-diff');
  diffEl.textContent = formatCurrency(Math.abs(diff));
  diffEl.className = diff === 0 ? 'balance-positive' : 'balance-negative';
}

async function viewJV(id) {
  try {
    const result = await fetchAPI(`journal_vouchers?id=${id}`);
    if (result.success) {
      const jv = result.data[0] || result.data;
      if (!jv) {
        showAlert('alert-container', 'السند غير موجود', 'error');
        return;
      }
      
      // Show in modal as read-only
      document.getElementById('modal-title').textContent = `عرض السند: ${jv.voucher_number}`;
      document.getElementById('jv-id').value = jv.id;
      document.getElementById('jv-date').value = jv.voucher_date;
      document.getElementById('jv-description').value = jv.description || '';
      document.getElementById('jv-date').disabled = true;
      document.getElementById('jv-description').disabled = true;
      
      const container = document.getElementById('jv-entries-container');
      container.innerHTML = '';
      
      (jv.entries || []).forEach(entry => {
        const row = document.createElement('div');
        row.className = 'jv-entry-row';
        row.innerHTML = `
          <div><strong>${entry.account_code}</strong> - ${entry.account_name}</div>
          <div>${entry.entry_type === 'DEBIT' ? 'مدين' : 'دائن'}</div>
          <div>${formatCurrency(entry.amount)}</div>
          <div>${entry.description || ''}</div>
          <div></div>
        `;
        container.appendChild(row);
      });
      
      updateTotals();
      document.getElementById('jv-modal').style.display = 'flex';
      document.getElementById('jv-form').querySelector('button[type="submit"]').style.display = 'none';
    }
  } catch (error) {
    console.error('Error loading JV:', error);
    showAlert('alert-container', 'خطأ في تحميل السند', 'error');
  }
}

async function editJV(id) {
  await viewJV(id);
  document.getElementById('modal-title').textContent = `تعديل السند`;
  document.getElementById('jv-date').disabled = false;
  document.getElementById('jv-description').disabled = false;
  document.getElementById('jv-form').querySelector('button[type="submit"]').style.display = 'block';
  
  // Convert to editable rows
  const container = document.getElementById('jv-entries-container');
  const rows = container.querySelectorAll('.jv-entry-row');
  // For simplicity, we'll reload the form with editable fields
  // In production, you'd convert the view rows to editable inputs
}

async function deleteJV(id) {
  if (!confirm('هل أنت متأكد من حذف هذا السند؟ سيتم إنشاء قيد عكسي.')) return;
  
  try {
    const result = await fetchAPI(`journal_vouchers?id=${id}`, 'DELETE');
    if (result.success) {
      showAlert('alert-container', 'تم حذف السند بنجاح', 'success');
      loadJournalVouchers(currentPage);
    } else {
      showAlert('alert-container', result.message || 'فشل حذف السند', 'error');
    }
  } catch (error) {
    console.error('Error deleting JV:', error);
    showAlert('alert-container', 'خطأ في حذف السند', 'error');
  }
}

function closeModal() {
  document.getElementById('jv-modal').style.display = 'none';
  document.getElementById('jv-form').reset();
}

document.getElementById('jv-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const entries = [];
  const rows = document.querySelectorAll('.jv-entry-row');
  
  rows.forEach(row => {
    const accountCode = row.querySelector('.entry-account').value;
    const amount = parseFloat(row.querySelector('.entry-amount').value || 0);
    const description = row.querySelector('.entry-description').value;
    const typeBtn = row.querySelector('.entry-type.active');
    const type = typeBtn ? typeBtn.dataset.type : 'DEBIT';
    
    if (accountCode && amount > 0) {
      entries.push({
        account_code: accountCode,
        entry_type: type,
        amount: amount,
        description: description
      });
    }
  });
  
  if (entries.length < 2) {
    showAlert('alert-container', 'يجب إضافة قيدين على الأقل', 'warning');
    return;
  }
  
  const totalDebit = entries.filter(e => e.entry_type === 'DEBIT').reduce((sum, e) => sum + e.amount, 0);
  const totalCredit = entries.filter(e => e.entry_type === 'CREDIT').reduce((sum, e) => sum + e.amount, 0);
  
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    showAlert('alert-container', 'يجب أن يتساوى إجمالي المدين والدائن', 'warning');
    return;
  }
  
  const jvId = document.getElementById('jv-id').value;
  const data = {
    voucher_date: document.getElementById('jv-date').value,
    description: document.getElementById('jv-description').value,
    entries: entries
  };
  
  try {
    let result;
    if (jvId) {
      data.id = parseInt(jvId);
      result = await fetchAPI('journal_vouchers', 'PUT', data);
    } else {
      result = await fetchAPI('journal_vouchers', 'POST', data);
    }
    
    if (result.success) {
      showAlert('alert-container', 'تم حفظ السند بنجاح', 'success');
      closeModal();
      loadJournalVouchers(1);
    } else {
      showAlert('alert-container', result.message || 'فشل حفظ السند', 'error');
    }
  } catch (error) {
    console.error('Error saving JV:', error);
    showAlert('alert-container', 'خطأ في حفظ السند', 'error');
  }
});

