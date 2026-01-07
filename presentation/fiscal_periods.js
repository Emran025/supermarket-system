let currentPage = 1;
let itemsPerPage = 20;

document.addEventListener("DOMContentLoaded", async function () {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  updateDateTime();
  setInterval(updateDateTime, 1000);

  await loadFiscalPeriods();
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

async function loadFiscalPeriods(page = 1) {
  currentPage = page;
  try {
    const result = await fetchAPI(`fiscal_periods?page=${page}&limit=${itemsPerPage}`);
    if (result.success) {
      const periods = result.data || [];
      const total = result.total || 0;
      
      const tbody = document.getElementById('periods-table-body');
      tbody.innerHTML = '';
      
      if (periods.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">لا توجد فترات مالية</td></tr>';
      } else {
        periods.forEach(period => {
          const row = document.createElement('tr');
          const statusClass = period.is_closed ? 'badge-danger' : period.is_locked ? 'badge-warning' : 'badge-success';
          const statusText = period.is_closed ? 'مغلقة' : period.is_locked ? 'مقفلة' : 'نشطة';
          
          row.innerHTML = `
            <td><strong>${period.period_name}</strong></td>
            <td>${formatDate(period.start_date)}</td>
            <td>${formatDate(period.end_date)}</td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
            <td>${period.is_locked ? '✓' : '✗'}</td>
            <td>${period.is_closed ? '✓' : '✗'}</td>
            <td>
              <div class="action-buttons">
                <button class="icon-btn view" onclick="viewPeriod(${period.id})" title="عرض">
                  ${getIcon("eye")}
                </button>
                ${!period.is_closed ? `
                  <button class="icon-btn ${period.is_locked ? 'edit' : 'delete'}" onclick="${period.is_locked ? 'unlockPeriod' : 'lockPeriod'}(${period.id})" title="${period.is_locked ? 'فتح' : 'قفل'}">
                    ${getIcon(period.is_locked ? 'unlock' : 'lock')}
                  </button>
                ` : ''}
                ${!period.is_closed && !period.is_locked ? `
                  <button class="icon-btn edit" onclick="editPeriod(${period.id})" title="تعديل">
                    ${getIcon("edit")}
                  </button>
                ` : ''}
                ${!period.is_closed ? `
                  <button class="icon-btn edit" onclick="closePeriod(${period.id})" title="إغلاق" style="background: var(--danger-color); color: white;">
                    ${getIcon("check")}
                  </button>
                ` : ''}
              </div>
            </td>
          `;
          tbody.appendChild(row);
        });
      }
      
      renderPagination('periods-pagination', currentPage, Math.ceil(total / itemsPerPage), loadFiscalPeriods);
    } else {
      showAlert('alert-container', result.message || 'فشل تحميل الفترات المالية', 'error');
    }
  } catch (error) {
    console.error('Error loading fiscal periods:', error);
    showAlert('alert-container', 'خطأ في الاتصال بالسيرفر', 'error');
  }
}

function showCreateModal() {
  document.getElementById('modal-title').textContent = 'فترة مالية جديدة';
  document.getElementById('period-form').reset();
  document.getElementById('period-id').value = '';
  document.getElementById('period-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('period-modal').style.display = 'none';
}

async function viewPeriod(id) {
  try {
    const result = await fetchAPI(`fiscal_periods?id=${id}`);
    if (result.success) {
      const period = result.data[0] || result.data;
      if (period) {
        alert(`اسم الفترة: ${period.period_name}\nمن: ${formatDate(period.start_date)}\nإلى: ${formatDate(period.end_date)}\nمقفلة: ${period.is_locked ? 'نعم' : 'لا'}\nمغلقة: ${period.is_closed ? 'نعم' : 'لا'}`);
      }
    }
  } catch (error) {
    console.error('Error loading period:', error);
  }
}

async function editPeriod(id) {
  try {
    const result = await fetchAPI(`fiscal_periods?id=${id}`);
    if (result.success) {
      const period = result.data[0] || result.data;
      if (!period) {
        showAlert('alert-container', 'الفترة غير موجودة', 'error');
        return;
      }
      
      document.getElementById('modal-title').textContent = 'تعديل الفترة';
      document.getElementById('period-id').value = period.id;
      document.getElementById('period-name').value = period.period_name;
      document.getElementById('period-start').value = period.start_date;
      document.getElementById('period-end').value = period.end_date;
      document.getElementById('period-modal').style.display = 'flex';
    }
  } catch (error) {
    console.error('Error loading period:', error);
    showAlert('alert-container', 'خطأ في تحميل الفترة', 'error');
  }
}

async function lockPeriod(id) {
  if (!confirm('هل أنت متأكد من قفل هذه الفترة؟ لن يمكن إضافة قيود جديدة.')) return;
  
  try {
    const result = await fetchAPI('fiscal_periods?action=lock', 'PUT', { id: id });
    if (result.success) {
      showAlert('alert-container', 'تم قفل الفترة بنجاح', 'success');
      loadFiscalPeriods(currentPage);
    } else {
      showAlert('alert-container', result.message || 'فشل قفل الفترة', 'error');
    }
  } catch (error) {
    console.error('Error locking period:', error);
    showAlert('alert-container', 'خطأ في قفل الفترة', 'error');
  }
}

async function unlockPeriod(id) {
  if (!confirm('هل أنت متأكد من فتح هذه الفترة؟ سيتم السماح بإضافة قيود جديدة.')) return;
  
  try {
    const result = await fetchAPI('fiscal_periods?action=unlock', 'PUT', { id: id });
    if (result.success) {
      showAlert('alert-container', 'تم فتح الفترة بنجاح', 'success');
      loadFiscalPeriods(currentPage);
    } else {
      showAlert('alert-container', result.message || 'فشل فتح الفترة', 'error');
    }
  } catch (error) {
    console.error('Error unlocking period:', error);
    showAlert('alert-container', 'خطأ في فتح الفترة', 'error');
  }
}

async function closePeriod(id) {
  if (!confirm('هل أنت متأكد من إغلاق هذه الفترة؟ سيتم إنشاء قيود الإغلاق ولن يمكن تعديل الفترة.')) return;
  
  try {
    const result = await fetchAPI('fiscal_periods?action=close', 'PUT', { id: id });
    if (result.success) {
      showAlert('alert-container', 'تم إغلاق الفترة بنجاح', 'success');
      loadFiscalPeriods(currentPage);
    } else {
      showAlert('alert-container', result.message || 'فشل إغلاق الفترة', 'error');
    }
  } catch (error) {
    console.error('Error closing period:', error);
    showAlert('alert-container', 'خطأ في إغلاق الفترة', 'error');
  }
}

document.getElementById('period-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const id = document.getElementById('period-id').value;
  const data = {
    period_name: document.getElementById('period-name').value,
    start_date: document.getElementById('period-start').value,
    end_date: document.getElementById('period-end').value
  };
  
  try {
    let result;
    if (id) {
      data.id = parseInt(id);
      result = await fetchAPI('fiscal_periods', 'PUT', data);
    } else {
      result = await fetchAPI('fiscal_periods', 'POST', data);
    }
    
    if (result.success) {
      showAlert('alert-container', 'تم حفظ الفترة بنجاح', 'success');
      closeModal();
      loadFiscalPeriods(1);
    } else {
      showAlert('alert-container', result.message || 'فشل حفظ الفترة', 'error');
    }
  } catch (error) {
    console.error('Error saving period:', error);
    showAlert('alert-container', 'خطأ في حفظ الفترة', 'error');
  }
});

