let currentTab = 'entries';
let currentPage = 1;
let itemsPerPage = 50;

document.addEventListener("DOMContentLoaded", async function () {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  updateDateTime();
  setInterval(updateDateTime, 1000);

  // Set default dates
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('filter-end-date').value = today;
  document.getElementById('tb-date').value = today;
  document.getElementById('history-end-date').value = today;

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
    case 'entries':
      await loadGLEntries();
      break;
    case 'trial_balance':
      await loadTrialBalance();
      break;
    case 'account_history':
      // Wait for user to enter account code
      break;
  }
}

async function loadGLEntries(page = 1) {
  currentPage = page;
  try {
    const voucher = document.getElementById('filter-voucher').value;
    const account = document.getElementById('filter-account').value;
    const startDate = document.getElementById('filter-start-date').value;
    const endDate = document.getElementById('filter-end-date').value;
    
    let url = `general_ledger?action=entries&page=${page}&limit=${itemsPerPage}`;
    if (voucher) url += `&voucher_number=${encodeURIComponent(voucher)}`;
    if (account) url += `&account_code=${encodeURIComponent(account)}`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;
    
    const result = await fetchAPI(url);
    if (result.success) {
      const entries = result.data || [];
      const total = result.total || 0;
      
      const tbody = document.getElementById('gl-entries-body');
      tbody.innerHTML = '';
      
      if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">لا توجد قيود</td></tr>';
        document.getElementById('entries-pagination').innerHTML = '';
        return;
      } else {
        entries.forEach(entry => {
          const row = document.createElement('tr');
          const debit = entry.entry_type === 'DEBIT' ? parseFloat(entry.amount) : 0;
          const credit = entry.entry_type === 'CREDIT' ? parseFloat(entry.amount) : 0;
          
          row.innerHTML = `
            <td>${formatDate(entry.voucher_date)}</td>
            <td>${entry.voucher_number || ''}</td>
            <td>${entry.account_code || ''}</td>
            <td>${entry.account_name || ''}</td>
            <td>${entry.description || ''}</td>
            <td class="debit-amount">${debit > 0 ? formatCurrency(debit) : '-'}</td>
            <td class="credit-amount">${credit > 0 ? formatCurrency(credit) : '-'}</td>
            <td>
              <div class="action-buttons">
                <button class="icon-btn view" onclick="viewEntry('${entry.voucher_number || ''}')" title="عرض">
                  ${getIcon("eye")}
                </button>
              </div>
            </td>
          `;
          tbody.appendChild(row);
        });
      }
      
      // Pagination
      renderPagination('entries-pagination', currentPage, Math.ceil(total / itemsPerPage), loadGLEntries);
    } else {
      showAlert('alert-container', result.message || 'فشل تحميل القيود', 'error');
    }
  } catch (error) {
    console.error('Error loading GL entries:', error);
    showAlert('alert-container', 'خطأ في الاتصال بالسيرفر', 'error');
  }
}

function viewEntry(voucherNumber) {
  // Navigate to account history or show voucher details
  if (voucherNumber) {
    document.getElementById('history-account-code').value = '';
    switchTab('account_history');
    // Could load voucher details here
  }
}

async function loadTrialBalance() {
  try {
    const asOfDate = document.getElementById('tb-date').value || new Date().toISOString().split('T')[0];
    
    const result = await fetchAPI(`general_ledger?action=trial_balance&as_of_date=${asOfDate}`);
    if (result.success) {
      const data = result.data || {};
      const entries = data.data || [];
      const summary = data.summary || {};
      
      const body = document.getElementById('trial-balance-body');
      body.innerHTML = '';
      
      if (entries.length === 0) {
        body.innerHTML = '<div style="padding: 2rem; text-align: center;">لا توجد حسابات</div>';
      } else {
        entries.forEach(entry => {
          const row = document.createElement('div');
          row.className = 'trial-balance-row';
          
          const balance = entry.debit_balance - entry.credit_balance;
          const balanceClass = balance >= 0 ? 'balance-positive' : 'balance-negative';
          
          row.innerHTML = `
            <div><strong>${entry.account_code}</strong> - ${entry.account_name}</div>
            <div style="text-align: center">${formatCurrency(entry.debit_balance || 0)}</div>
            <div style="text-align: center">${formatCurrency(entry.credit_balance || 0)}</div>
            <div style="text-align: center" class="${balanceClass}">${formatCurrency(balance)}</div>
          `;
          body.appendChild(row);
        });
      }
      
      // Totals
      document.getElementById('tb-total-debits').textContent = formatCurrency(summary.total_debits || 0);
      document.getElementById('tb-total-credits').textContent = formatCurrency(summary.total_credits || 0);
      
      const isBalanced = summary.is_balanced ? '✓ متوازن' : '✗ غير متوازن';
      const balancedClass = summary.is_balanced ? 'balance-positive' : 'balance-negative';
      document.getElementById('tb-is-balanced').innerHTML = `<span class="${balancedClass}">${isBalanced}</span>`;
    } else {
      showAlert('alert-container', result.message || 'فشل تحميل ميزان المراجعة', 'error');
    }
  } catch (error) {
    console.error('Error loading trial balance:', error);
    showAlert('alert-container', 'خطأ في الاتصال بالسيرفر', 'error');
  }
}

async function loadAccountHistory() {
  try {
    const accountCode = document.getElementById('history-account-code').value;
    if (!accountCode) {
      showAlert('alert-container', 'يرجى إدخال رمز الحساب', 'warning');
      return;
    }
    
    const startDate = document.getElementById('history-start-date').value;
    const endDate = document.getElementById('history-end-date').value;
    
    let url = `general_ledger?action=account_details&account_code=${encodeURIComponent(accountCode)}&page=1&limit=1000`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;
    
    const result = await fetchAPI(url);
    if (result.success) {
      const data = result.data || {};
      const history = data.transactions || [];
      
      const tbody = document.getElementById('account-history-body');
      tbody.innerHTML = '';
      
      if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">لا توجد معاملات</td></tr>';
      } else {
        history.forEach(item => {
          const row = document.createElement('tr');
          const debit = item.entry_type === 'DEBIT' ? parseFloat(item.amount || 0) : 0;
          const credit = item.entry_type === 'CREDIT' ? parseFloat(item.amount || 0) : 0;
          const balanceClass = item.running_balance >= 0 ? 'balance-positive' : 'balance-negative';
          
          row.innerHTML = `
            <td>${formatDate(item.voucher_date)}</td>
            <td>${item.voucher_number || ''}</td>
            <td>${item.description || ''}</td>
            <td class="debit-amount">${debit > 0 ? formatCurrency(debit) : '-'}</td>
            <td class="credit-amount">${credit > 0 ? formatCurrency(credit) : '-'}</td>
            <td class="${balanceClass}">${formatCurrency(item.running_balance || 0)}</td>
          `;
          tbody.appendChild(row);
        });
      }
    } else {
      showAlert('alert-container', result.message || 'فشل تحميل تاريخ الحساب', 'error');
    }
  } catch (error) {
    console.error('Error loading account history:', error);
    showAlert('alert-container', 'خطأ في الاتصال بالسيرفر', 'error');
  }
}

function filterEntries() {
  loadGLEntries(1);
}

function clearFilters() {
  document.getElementById('filter-voucher').value = '';
  document.getElementById('filter-account').value = '';
  document.getElementById('filter-start-date').value = '';
  document.getElementById('filter-end-date').value = new Date().toISOString().split('T')[0];
  loadGLEntries(1);
}

function exportLedger() {
  window.print();
}

