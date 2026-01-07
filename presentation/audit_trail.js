let currentPage = 1;
let itemsPerPage = 50;

document.addEventListener("DOMContentLoaded", async function () {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  // Set default dates (last 30 days)
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  
  document.getElementById('filter-date-to').value = today.toISOString().split('T')[0];
  document.getElementById('filter-date-from').value = thirtyDaysAgo.toISOString().split('T')[0];

  await loadAuditLogs();
});

async function loadAuditLogs(page = 1) {
  currentPage = page;
  try {
    const search = document.getElementById('filter-search').value;
    const operation = document.getElementById('filter-operation').value;
    const table = document.getElementById('filter-table').value;
    const dateFrom = document.getElementById('filter-date-from').value;
    const dateTo = document.getElementById('filter-date-to').value;
    
    let url = `audit_trail?page=${page}&limit=${itemsPerPage}`;
    if (search) {
      // Search across multiple fields - backend may need to handle this
      url += `&table_name=${encodeURIComponent(search)}`;
    }
    if (operation) url += `&operation=${encodeURIComponent(operation)}`;
    if (table) url += `&table_name=${encodeURIComponent(table)}`;
    if (dateFrom) url += `&start_date=${dateFrom}`;
    if (dateTo) url += `&end_date=${dateTo}`;
    
    const result = await fetchAPI(url);
    if (result.success) {
      // Handle paginated response structure
      const logs = (result.data && result.data.logs) ? result.data.logs : (result.data || []);
      const total = (result.pagination && result.pagination.total_records) ? result.pagination.total_records : (result.total || 0);
      
      const tbody = document.getElementById('audit-table-body');
      tbody.innerHTML = '';
      
      if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">لا توجد سجلات</td></tr>';
      } else {
        logs.forEach(log => {
          const row = document.createElement('tr');
          const oldValues = log.old_values || {};
          const newValues = log.new_values || {};
          
          let oldValuesStr = Object.keys(oldValues).length > 0 
            ? JSON.stringify(oldValues, null, 2).substring(0, 100) + '...'
            : '-';
          let newValuesStr = Object.keys(newValues).length > 0
            ? JSON.stringify(newValues, null, 2).substring(0, 100) + '...'
            : '-';
          
          row.innerHTML = `
            <td>${formatDateTime(log.created_at)}</td>
            <td>${log.user_name || 'غير معروف'}</td>
            <td><span class="badge badge-${getOperationBadgeClass(log.operation)}">${getOperationText(log.operation)}</span></td>
            <td>${log.table_name || ''}</td>
            <td>${log.record_id || ''}</td>
            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${oldValuesStr}">${oldValuesStr}</td>
            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${newValuesStr}">${newValuesStr}</td>
          `;
          tbody.appendChild(row);
        });
      }
      
      const totalPages = (result.pagination && result.pagination.total_pages) ? result.pagination.total_pages : Math.ceil(total / itemsPerPage);
      renderPagination('audit-pagination', currentPage, totalPages, loadAuditLogs);
    } else {
      showAlert('alert-container', result.message || 'فشل تحميل سجل التدقيق', 'error');
    }
  } catch (error) {
    console.error('Error loading audit logs:', error);
    showAlert('alert-container', 'خطأ في الاتصال بالسيرفر', 'error');
  }
}

function getOperationText(operation) {
  const ops = {
    'CREATE': 'إنشاء',
    'UPDATE': 'تعديل',
    'DELETE': 'حذف',
    'GENERATE': 'إنشاء',
    'EXECUTE': 'تنفيذ'
  };
  return ops[operation] || operation;
}

function getOperationBadgeClass(operation) {
  const classes = {
    'CREATE': 'success',
    'UPDATE': 'info',
    'DELETE': 'danger',
    'GENERATE': 'success',
    'EXECUTE': 'info'
  };
  return classes[operation] || 'secondary';
}

function clearFilters() {
  document.getElementById('filter-search').value = '';
  document.getElementById('filter-operation').value = '';
  document.getElementById('filter-table').value = '';
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  document.getElementById('filter-date-to').value = today.toISOString().split('T')[0];
  document.getElementById('filter-date-from').value = thirtyDaysAgo.toISOString().split('T')[0];
  loadAuditLogs(1);
}

function exportAuditLog() {
  window.print();
}

function formatDateTime(dateTimeStr) {
  if (!dateTimeStr) return '';
  const date = new Date(dateTimeStr);
  return date.toLocaleString('ar-SA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

