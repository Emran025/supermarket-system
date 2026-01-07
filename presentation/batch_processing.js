let currentPage = 1;
let itemsPerPage = 20;
let currentBatchId = null;

document.addEventListener("DOMContentLoaded", async function () {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  updateDateTime();
  setInterval(updateDateTime, 1000);

  await loadBatches();
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

async function loadBatches(page = 1) {
  currentPage = page;
  try {
    const result = await fetchAPI(`batch?page=${page}&limit=${itemsPerPage}`);
    if (result.success) {
      const batches = result.data || [];
      const total = result.total || 0;
      
      const tbody = document.getElementById('batches-table-body');
      tbody.innerHTML = '';
      
      if (batches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">لا توجد دفعات</td></tr>';
      } else {
      batches.forEach(batch => {
        const row = document.createElement('tr');
        const typeText = {
          'journal_entry_import': 'استيراد قيود يومية',
          'expense_posting': 'ترحيل مصروفات'
        }[batch.batch_type] || batch.batch_type;
        
        const statusClass = {
          'pending': 'badge-secondary',
          'processing': 'badge-info',
          'completed': 'badge-success',
          'completed_with_errors': 'badge-warning',
          'failed': 'badge-danger'
        }[batch.status?.toLowerCase()] || 'badge-secondary';
        
        const statusText = {
          'pending': 'معلقة',
          'processing': 'قيد المعالجة',
          'completed': 'مكتملة',
          'completed_with_errors': 'مكتملة مع أخطاء',
          'failed': 'فشلت'
        }[batch.status?.toLowerCase()] || batch.status;
        
        const itemsCount = batch.total_items || 0;
        const isPending = (batch.status?.toLowerCase() === 'pending');
        
        row.innerHTML = `
            <td><strong>${batch.batch_name}</strong></td>
            <td>${typeText}</td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
            <td>${itemsCount}</td>
            <td>${formatDate(batch.created_at)}</td>
            <td>${batch.started_at ? formatDate(batch.started_at) : '-'}</td>
            <td>${batch.completed_at ? formatDate(batch.completed_at) : '-'}</td>
            <td>
              <div class="action-buttons">
                <button class="icon-btn view" onclick="viewBatchItems(${batch.id})" title="عرض العناصر">
                  ${getIcon("eye")}
                </button>
                ${isPending ? `
                  <button class="icon-btn edit" onclick="executeBatch(${batch.id}, '${batch.batch_type}')" title="تنفيذ">
                    ${getIcon("check")}
                  </button>
                ` : ''}
                ${isPending ? `
                  <button class="icon-btn delete" onclick="deleteBatch(${batch.id})" title="حذف">
                    ${getIcon("trash")}
                  </button>
                ` : ''}
              </div>
            </td>
          `;
        tbody.appendChild(row);
      });
      }
      
      renderPagination('batches-pagination', currentPage, Math.ceil(total / itemsPerPage), loadBatches);
    } else {
      showAlert('alert-container', result.message || 'فشل تحميل الدفعات', 'error');
    }
  } catch (error) {
    console.error('Error loading batches:', error);
    showAlert('alert-container', 'خطأ في الاتصال بالسيرفر', 'error');
  }
}

function showCreateModal() {
  document.getElementById('batch-form').reset();
  document.getElementById('batch-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('batch-modal').style.display = 'none';
}

function closeItemsModal() {
  document.getElementById('items-modal').style.display = 'none';
  currentBatchId = null;
}

async function viewBatchItems(batchId) {
  currentBatchId = batchId;
  try {
    const result = await fetchAPI(`batch?action=status&batch_id=${batchId}`);
    if (result.success) {
      const data = result.data || {};
      const items = data.items || [];
      
      const tbody = document.getElementById('items-table-body');
      tbody.innerHTML = '';
      
      if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;">لا توجد عناصر</td></tr>';
      } else {
        items.forEach((item, index) => {
          const row = document.createElement('tr');
          const statusClass = {
            'pending': 'badge-secondary',
            'success': 'badge-success',
            'completed': 'badge-success',
            'error': 'badge-danger',
            'failed': 'badge-danger'
          }[item.status?.toLowerCase()] || 'badge-secondary';
          
          const statusText = {
            'pending': 'معلقة',
            'success': 'مكتملة',
            'completed': 'مكتملة',
            'error': 'فشلت',
            'failed': 'فشلت'
          }[item.status?.toLowerCase()] || item.status;
          
          const itemData = item.item_data || {};
          const itemDataStr = JSON.stringify(itemData, null, 2).substring(0, 100) + (JSON.stringify(itemData).length > 100 ? '...' : '');
          
          row.innerHTML = `
            <td>${index + 1}</td>
            <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${JSON.stringify(itemData)}">${itemDataStr}</td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
            <td>${item.error_message || '-'}</td>
          `;
          tbody.appendChild(row);
        });
      }
      
      document.getElementById('items-modal').style.display = 'flex';
    } else {
      showAlert('alert-container', result.message || 'فشل تحميل العناصر', 'error');
    }
  } catch (error) {
    console.error('Error loading batch items:', error);
    showAlert('alert-container', 'خطأ في تحميل العناصر', 'error');
  }
}

async function executeBatch(batchId, batchType) {
  if (!confirm('هل أنت متأكد من تنفيذ هذه الدفعة؟')) return;
  
  try {
    const action = batchType === 'journal_entry_import' ? 'journal_entries' : 'expenses';
    const result = await fetchAPI(`batch?action=${action}`, 'POST', { batch_id: batchId });
    if (result.success) {
      showAlert('alert-container', `تم تنفيذ الدفعة بنجاح`, 'success');
      loadBatches(currentPage);
    } else {
      showAlert('alert-container', result.message || 'فشل تنفيذ الدفعة', 'error');
    }
  } catch (error) {
    console.error('Error executing batch:', error);
    showAlert('alert-container', 'خطأ في تنفيذ الدفعة', 'error');
  }
}

async function deleteBatch(batchId) {
  if (!confirm('هل أنت متأكد من حذف هذه الدفعة؟')) return;
  
  try {
    const result = await fetchAPI(`batch?id=${batchId}`, 'DELETE');
    if (result.success) {
      showAlert('alert-container', 'تم حذف الدفعة بنجاح', 'success');
      loadBatches(currentPage);
    } else {
      showAlert('alert-container', result.message || 'فشل حذف الدفعة', 'error');
    }
  } catch (error) {
    console.error('Error deleting batch:', error);
    showAlert('alert-container', 'خطأ في حذف الدفعة', 'error');
  }
}

document.getElementById('batch-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const data = {
    batch_name: document.getElementById('batch-name').value,
    batch_type: document.getElementById('batch-type').value,
    description: document.getElementById('batch-description').value
  };
  
  try {
    const result = await fetchAPI('batch', 'POST', data);
    if (result.success) {
      showAlert('alert-container', 'تم إنشاء الدفعة بنجاح. يمكنك الآن إضافة العناصر.', 'success');
      closeModal();
      loadBatches(1);
      
      // Optionally open items modal to add items
      if (result.data?.id) {
        setTimeout(() => {
          viewBatchItems(result.data.id);
        }, 500);
      }
    } else {
      showAlert('alert-container', result.message || 'فشل إنشاء الدفعة', 'error');
    }
  } catch (error) {
    console.error('Error creating batch:', error);
    showAlert('alert-container', 'خطأ في إنشاء الدفعة', 'error');
  }
});

