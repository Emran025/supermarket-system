"use client";

import { useState, useEffect } from "react";
import { Table, Column, Dialog, showToast } from "@/components/ui";
import { fetchAPI } from "@/lib/api";
import { PayrollCycle, PayrollItem, Employee } from "../types";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { getIcon } from "@/lib/icons";

interface PayrollItemExtended extends PayrollItem {
  employee_name?: string;
  paid_amount?: number;
  remaining_balance?: number;
  advance_amount?: number;
  net_after_advance?: number;
  status: 'active' | 'on_hold';
}

interface PayrollTransaction {
  id: number;
  amount: number;
  transaction_type: 'payment' | 'advance';
  transaction_date: string;
  notes: string;
}

interface Account {
    id: number;
    code: string;
    name: string;
    type: string;
}

export function PayrollTab() {
  const [payrollCycles, setPayrollCycles] = useState<PayrollCycle[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<PayrollCycle | null>(null);
  const [payrollItems, setPayrollItems] = useState<PayrollItemExtended[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Dialog States
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showBulkPaymentDialog, setShowBulkPaymentDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showCreateCycleDialog, setShowCreateCycleDialog] = useState(false);
  const [showEditItemDialog, setShowEditItemDialog] = useState(false);
  
  // Selection States
  const [selectedItem, setSelectedItem] = useState<PayrollItemExtended | null>(null);
  const [transactions, setTransactions] = useState<PayrollTransaction[]>([]);
  
  // Create Cycle Form State
  const [newCycle, setNewCycle] = useState({
    payment_nature: 'salary' as 'salary' | 'bonus' | 'incentive' | 'other',
    cycle_name: '',
    period_start: new Date().toISOString().split('T')[0],
    period_end: new Date().toISOString().split('T')[0],
    payment_date: new Date().toISOString().split('T')[0],
    target_type: 'all' as 'all' | 'selected' | 'excluded',
    employee_ids: [] as number[],
    base_amount: "",
    description: ""
  });

  // Edit Item Form State
  const [editItemData, setEditItemData] = useState({
    base_salary: 0,
    total_allowances: 0,
    total_deductions: 0,
    notes: ""
  });

  // Individual Form States
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Filter States
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadUser();
    loadPayrollCycles();
    loadAccounts();
    loadAllEmployees();
  }, []);

  const loadUser = async () => {
    try {
      const res: any = await fetchAPI('/api/check');
      setCurrentUser(res.user || res);
    } catch (e) {
      console.error(e);
    }
  };

  const loadAllEmployees = async () => {
    try {
      const res: any = await fetchAPI('/api/employees');
      setAllEmployees(res.data || res || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadAccounts = async () => {
      try {
          const res: any = await fetchAPI('/api/accounts');
          const data = res.accounts as Account[] || [];
          
          // Filter for Asset accounts (banks, cash, etc.)
          // Note: account_type from controller is lowercase 'asset'
          const assetAccounts = data.filter(acc => 
            acc.type === 'asset' || 
            acc.code.startsWith('1')
          );
          
          setAccounts(assetAccounts);
          
          const cashAcc = assetAccounts.find(a => a.code === '1110');
          if (cashAcc) setSelectedAccountId(cashAcc.id.toString());
          else if (assetAccounts.length > 0) setSelectedAccountId(assetAccounts[0].id.toString());
      } catch (e) {
          console.error("Failed to load accounts", e);
      }
  };

  const loadPayrollCycles = async () => {
    setIsLoading(true);
    try {
      const res: any = await fetchAPI('/api/payroll/cycles');
      const data = res.data?.data || res.data || res || [];
      setPayrollCycles(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      showToast("خطأ في تحميل دورات الرواتب", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const loadCycleDetails = async (cycleId: number) => {
    try {
      const res: any = await fetchAPI(`/api/payroll/cycles/${cycleId}/items`);
      setPayrollItems(res.data as PayrollItemExtended[] || []);
      
      if (res.cycle) {
        setSelectedCycle(res.cycle as PayrollCycle);
      }
      
      setShowDetailsDialog(true);
    } catch (error) {
      console.error(error);
      showToast("خطأ في تحميل تفاصيل الدورة", "error");
    }
  };

  const loadItemHistory = async (item: PayrollItemExtended) => {
    try {
      setSelectedItem(item);
      const res: any = await fetchAPI(`/api/payroll/items/${item.id}/transactions`);
      setTransactions(res.data as PayrollTransaction[] || []);
      setShowHistoryDialog(true);
    } catch (error) {
      console.error(error);
      showToast("خطأ في تحميل سجل التحويلات", "error");
    }
  };

  const handleCreateCycle = async () => {
    if (newCycle.payment_nature !== 'salary' && !newCycle.cycle_name) {
      showToast("يرجى إدخال اسم المسير", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const res: any = await fetchAPI('/api/payroll/generate', {
        method: 'POST',
        body: JSON.stringify({
          ...newCycle,
          base_amount: parseFloat(newCycle.base_amount) || 0
        })
      });
      if (res.success !== false) {
        showToast("تم إنشاء المسير بنجاح", "success");
        setShowCreateCycleDialog(false);
        loadPayrollCycles();
      } else {
        showToast("فشل إنشاء المسير: " + res.message, "error");
      }
    } catch (e) {
      console.error(e);
      showToast("حدث خطأ غير متوقع", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (id: number) => {
    if (!confirm("هل أنت متأكد من الموافقة على مسير الرواتب ونقله للمرحلة التالية؟")) return;
    try {
      const res: any = await fetchAPI(`/api/payroll/${id}/approve`, { method: 'POST' });
      if (res.success !== false) {
        showToast("تمت الموافقة بنجاح", "success");
        loadPayrollCycles();
        setShowDetailsDialog(false);
      } else {
        showToast("فشل الموافقة: " + res.message, "error");
      }
    } catch (e) {
      console.error(e);
      showToast("حدث خطأ", "error");
    }
  };

  const handleBulkPayment = async () => {
    if (!selectedCycle || !selectedAccountId) {
        showToast("يرجى اختيار حساب الصرف", "error");
        return;
    }

    if (!confirm("هل أنت متأكد من صرف جميع الرواتب لهذا المسير؟ سيتم إنشاء قيود الصرف المحاسبية.")) return;

    setIsSubmitting(true);
    try {
      const res: any = await fetchAPI(`/api/payroll/${selectedCycle.id}/process-payment`, { 
          method: 'POST',
          body: JSON.stringify({ account_id: selectedAccountId })
      });
      if (res.success !== false) {
        showToast("تم ترحيل وصرف الرواتب بنجاح", "success");
        setShowBulkPaymentDialog(false);
        loadPayrollCycles();
        if (showDetailsDialog) loadCycleDetails(selectedCycle.id);
      } else {
        showToast("فشل الصرف: " + res.message, "error");
      }
    } catch (e) {
      console.error(e);
      showToast("حدث خطأ", "error");
    } finally {
        setIsSubmitting(false);
    }
  };

  const toggleStopSalary = async (item: PayrollItemExtended) => {
    try {
      const res: any = await fetchAPI(`/api/payroll/items/${item.id}/toggle-status`, { method: 'POST' });
      if (res) {
        showToast(res.status === 'on_hold' ? "تم إيقاف صرف الراتب مؤقتاً" : "تم تفعيل صرف الراتب", "info");
        loadCycleDetails(item.payroll_cycle_id);
      }
    } catch (e) {
      console.error(e);
      showToast("حدث خطأ", "error");
    }
  };

  const handleUpdateItem = async () => {
    if (!selectedItem) return;
    setIsSubmitting(true);
    try {
      const res: any = await fetchAPI(`/api/payroll/items/${selectedItem.id}`, {
        method: 'PUT',
        body: JSON.stringify(editItemData)
      });
      if (res.id) {
        showToast("تم تحديث بيانات الموظف بنجاح", "success");
        setShowEditItemDialog(false);
        loadCycleDetails(selectedItem.payroll_cycle_id);
        // Refresh cycles list for totals
        loadPayrollCycles();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPaymentDialog = (item: PayrollItemExtended) => {
    if (item.status === 'on_hold') {
      showToast("لا يمكن صرف الراتب لموظف موقوف", "error");
      return;
    }
    setSelectedItem(item);
    setPaymentAmount(item.remaining_balance?.toString() || item.net_salary.toString());
    setPaymentNotes("");
    setShowPaymentDialog(true);
  };

  const handleIndividualPayment = async () => {
    if (!selectedItem || !paymentAmount) {
      showToast("يرجى إدخال المبلغ", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const res: any = await fetchAPI(`/api/payroll/items/${selectedItem.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({
          amount: parseFloat(paymentAmount),
          notes: paymentNotes,
          account_id: selectedAccountId
        })
      });

      if (res.success !== false) {
        showToast("تم تسجيل عملية التحويل بنجاح", "success");
        setShowPaymentDialog(false);
        if (selectedCycle) {
          loadCycleDetails(selectedCycle.id);
        }
      } else {
        showToast(res.message || res.error || "فشل تسجيل التحويل", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("حدث خطأ", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const cycleColumns: Column<PayrollCycle>[] = [
    { key: "cycle_name", header: "الدورة/المناسبة", dataLabel: "الدورة" },
    { 
      key: "status", 
      header: "الحالة والموافقة", 
      dataLabel: "الحالة", 
      render: (item: any) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span className={`badge ${item.status === 'paid' ? 'badge-success' : item.status === 'approved' ? 'badge-info' : item.status === 'pending_approval' ? 'badge-warning' : 'badge-secondary'}`}>
            {item.status === 'draft' ? 'مسودة' : item.status === 'pending_approval' ? 'بانتظار الموافقة' : item.status === 'approved' ? 'معتمد' : item.status === 'paid' ? 'مدفوع' : item.status}
          </span>
          {item.status === 'pending_approval' && item.current_approver && (
            <small className="text-muted">المعني حالياً: {item.current_approver.full_name}</small>
          )}
        </div>
      )
    },
    { 
      key: "cycle_type", 
      header: "النوع", 
      dataLabel: "النوع", 
      render: (item: any) => {
        const typeMap: any = { salary: 'راتب شهري', bonus: 'مكافأة', incentive: 'حافز', other: 'أخرى' };
        return <span className={`badge ${item.cycle_type === 'salary' ? 'badge-primary' : 'badge-info'}`}>{typeMap[item.cycle_type] || item.cycle_type}</span>;
      }
    },
    { key: "payment_date", header: "تاريخ الصرف", dataLabel: "تاريخ الصرف", render: (item) => formatDate(item.payment_date) },
    { key: "total_net", header: "المبلغ الإجمالي", dataLabel: "صافي المبلغ", render: (item) => <strong>{formatCurrency(item.total_net)}</strong> },
    {
      key: "id", header: "الإجراءات", dataLabel: "الإجراءات", render: (item: any) => (
        <div className="action-buttons">
          <button className="icon-btn view" title="التفاصيل والمراجعة" onClick={() => { setSelectedCycle(item); loadCycleDetails(item.id); }}>
            {getIcon("eye")}
          </button>
          
          {(item.status === 'draft' && item.created_by == currentUser?.id) && (
            <button className="icon-btn success" title="بدأ مسار الاعتماد" onClick={() => handleApprove(item.id)}>
              {getIcon("rocket")}
            </button>
          )}
          
          {(item.status === 'pending_approval' && item.current_approver_id == currentUser?.id) && (
            <button className="icon-btn success" title="موافقة وتمرير" onClick={() => handleApprove(item.id)}>
              {getIcon("check")}
            </button>
          )}

          {item.status === 'approved' && (
            <button className="icon-btn primary" title="صرف الكل" onClick={() => { setSelectedCycle(item); setShowBulkPaymentDialog(true); }}>
              {getIcon("dollar")}
            </button>
          )}
        </div>
      )
    },
  ];

  const filteredItems = payrollItems.filter(item => {
    const name = item.employee_name || item.employee?.full_name || "";
    const matchesSearch = !searchTerm || name.toLowerCase().includes(searchTerm.toLowerCase());
    const remaining = (item.remaining_balance !== undefined) ? item.remaining_balance : item.net_salary;
    const matchesStatus = filterStatus === "all" || 
      (filterStatus === "paid" && remaining <= 0) ||
      (filterStatus === "unpaid" && remaining > 0);
    return matchesSearch && matchesStatus;
  });

  const isUserApprover = selectedCycle?.status === 'pending_approval' && selectedCycle?.current_approver_id == currentUser?.id;
  const isDraftCreator = selectedCycle?.status === 'draft' && selectedCycle?.created_by == currentUser?.id;

  const itemColumns: Column<PayrollItemExtended>[] = [
    { key: "employee_name", header: "الموظف", dataLabel: "الموظف", render: (item) => (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontWeight: 600 }}>{item.employee_name || item.employee?.full_name || "-"}</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.employee?.employee_code || ""}</span>
      </div>
    )},
    { key: "net_salary", header: "صافي المستحق", dataLabel: "المستحق", render: (item) => formatCurrency(item.net_salary) },
    { 
        key: "status", 
        header: "حالة الصرف", 
        dataLabel: "الحالة", 
        render: (item) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`badge ${item.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                    {item.status === 'active' ? 'نشط' : 'موقوف'}
                </span>
                {(isUserApprover || isDraftCreator) && (
                    <button 
                        onClick={() => toggleStopSalary(item)} 
                        className={`btn btn-xs ${item.status === 'active' ? 'btn-outline-danger' : 'btn-outline-success'}`}
                        style={{ fontSize: '0.7rem', padding: '2px 5px' }}
                    >
                        {item.status === 'active' ? 'إيقاف' : 'تفعيل'}
                    </button>
                )}
            </div>
        )
    },
    { key: "paid_amount", header: "المحول", dataLabel: "المحول", render: (item) => (
      <button className="text-link" onClick={() => loadItemHistory(item)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary-color)', cursor: 'pointer', textDecoration: 'underline' }}>
        {formatCurrency(item.paid_amount || 0)}
      </button>
    )},
    {
      key: "actions", header: "الإجراءات", dataLabel: "الإجراءات", render: (item) => {
        const remaining = (item.remaining_balance !== undefined) ? item.remaining_balance : item.net_salary;
        return (
          <div className="action-buttons">
            {(isUserApprover || isDraftCreator) && (
               <button className="icon-btn edit" title="تعديل المبالغ" onClick={() => {
                   setSelectedItem(item);
                   setEditItemData({
                       base_salary: item.base_salary,
                       total_allowances: item.total_allowances,
                       total_deductions: item.total_deductions,
                       notes: item.notes || ""
                   });
                   setShowEditItemDialog(true);
               }}>
                 {getIcon("edit")}
               </button>
            )}

            {remaining > 0 && selectedCycle?.status === 'approved' && item.status === 'active' && (
              <button className="btn btn-sm btn-outline-primary" onClick={() => openPaymentDialog(item)} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                {getIcon("dollar")} تحويل
              </button>
            )}
            <button className="icon-btn view" title="سجل التحويلات" onClick={() => loadItemHistory(item)}>
              {getIcon("history")}
            </button>
          </div>
        );
      }
    },
  ];

  const toggleEmployeeSelection = (id: number) => {
    setNewCycle(prev => ({
      ...prev,
      employee_ids: prev.employee_ids.includes(id) 
        ? prev.employee_ids.filter(eid => eid !== id)
        : [...prev.employee_ids, id]
    }));
  };

  const transactionColumns: Column<PayrollTransaction>[] = [
    { key: "transaction_date", header: "التاريخ", dataLabel: "التاريخ", render: (item) => formatDateTime(item.transaction_date) },
    { key: "amount", header: "المبلغ", dataLabel: "المبلغ", render: (item) => formatCurrency(item.amount) },
    { key: "transaction_type", header: "النوع", dataLabel: "النوع", render: (item) => item.transaction_type === 'payment' ? 'صرف' : 'سلفة' },
    { key: "notes", header: "ملاحظات", dataLabel: "ملاحظات" },
  ];

  return (
    <>
      <div className="sales-card animate-fade">
        <div className="card-header-flex" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>{getIcon("dollar")} إدارة الرواتب واعتمادات الصرف</h3>
          <button className="btn btn-primary" onClick={() => setShowCreateCycleDialog(true)}>
            {getIcon("plus")} صرف جديد (مكافأة/حافز/راتب)
          </button>
        </div>

        <Table
          columns={cycleColumns}
          data={payrollCycles}
          keyExtractor={(item) => item.id}
          emptyMessage="لا توجد دورات رواتب مسجلة"
          isLoading={isLoading}
        />
      </div>

      {/* Create Cycle Dialog */}
      <Dialog
        isOpen={showCreateCycleDialog}
        onClose={() => setShowCreateCycleDialog(false)}
        title="إعداد أمر صرف جديد"
        maxWidth="900px"
        footer={
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowCreateCycleDialog(false)}>إلغاء</button>
              <button className="btn btn-primary" onClick={handleCreateCycle} disabled={isSubmitting}>
                {isSubmitting ? "جاري الإنشاء..." : "إنشاء المسودة"}
              </button>
            </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gap: '1rem' }}>
                <div className="form-group">
                    <label className="form-label">طبيعة الصرف</label>
                    <select 
                        className="form-control" 
                        value={newCycle.payment_nature} 
                        onChange={(e: any) => setNewCycle({...newCycle, payment_nature: e.target.value, cycle_name: e.target.value === 'salary' ? '' : newCycle.cycle_name})}
                    >
                        <option value="salary">راتب شهري أساسي</option>
                        <option value="incentive">حافز أداء</option>
                        <option value="bonus">مكافأة استثنائية</option>
                        <option value="other">أخرى</option>
                    </select>
                </div>

                {newCycle.payment_nature !== 'salary' && (
                    <div className="form-group">
                        <label className="form-label">عنوان المسير / المناسبة</label>
                        <input 
                            type="text" 
                            className="form-control" 
                            placeholder="مثال: حوافز مبيعات شهر يناير"
                            value={newCycle.cycle_name}
                            onChange={(e) => setNewCycle({...newCycle, cycle_name: e.target.value})}
                        />
                    </div>
                )}

                <div className="form-group">
                    <label className="form-label">تاريخ الاستحقاق/الصرف</label>
                    <input 
                        type="date" 
                        className="form-control" 
                        value={newCycle.payment_date}
                        onChange={(e) => setNewCycle({...newCycle, payment_date: e.target.value})}
                    />
                </div>

                {newCycle.payment_nature !== 'salary' && (
                    <div className="form-group">
                        <label className="form-label">المبلغ الموحد (اختياري)</label>
                        <div className="input-with-icon">
                            <input 
                                type="number" 
                                className="form-control" 
                                placeholder="0.00"
                                value={newCycle.base_amount}
                                onChange={(e) => setNewCycle({...newCycle, base_amount: e.target.value})}
                            />
                            <span className="icon-right">ر.س</span>
                        </div>
                    </div>
                )}
            </div>

            <div style={{ border: '1px solid #eee', borderRadius: '8px', padding: '1rem', background: '#fcfcfc' }}>
                <label className="form-label" style={{ fontWeight: 600, marginBottom: '1rem', display: 'block' }}>تخصيص الموظفين المشمولين</label>
                
                <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                        <label className="radio-label">
                            <input type="radio" checked={newCycle.target_type === 'all'} onChange={() => setNewCycle({...newCycle, target_type: 'all', employee_ids: []})} /> الكل
                        </label>
                        <label className="radio-label">
                            <input type="radio" checked={newCycle.target_type === 'selected'} onChange={() => setNewCycle({...newCycle, target_type: 'selected'})} /> محددين
                        </label>
                        <label className="radio-label">
                            <input type="radio" checked={newCycle.target_type === 'excluded'} onChange={() => setNewCycle({...newCycle, target_type: 'excluded'})} /> استثناء
                        </label>
                    </div>

                    {(newCycle.target_type === 'selected' || newCycle.target_type === 'excluded') && (
                        <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #eee', padding: '5px' }}>
                            {allEmployees.map(emp => (
                                <div key={emp.id} style={{ display: 'flex', gap: '10px', padding: '5px', borderBottom: '1px solid #f9f9f9' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={newCycle.employee_ids.includes(emp.id)}
                                        onChange={() => toggleEmployeeSelection(emp.id)}
                                    />
                                    <span style={{ fontSize: '0.85rem' }}>{emp.full_name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </Dialog>

      {/* Cycle Details Dialog */}
      <Dialog
        isOpen={showDetailsDialog}
        onClose={() => setShowDetailsDialog(false)}
        title={`تفاصيل واعتماد المسير: ${selectedCycle?.cycle_name || ""}`}
        maxWidth="1200px"
        footer={
           <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', width: '100%' }}>
              <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
                 <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>الحالة:</span>
                 <span className={`badge ${selectedCycle?.status === 'approved' ? 'badge-success' : 'badge-warning'}`}>
                    {selectedCycle?.status === 'draft' ? 'مسودة' : selectedCycle?.status === 'pending_approval' ? 'بانتظار الموافقة' : 'معتمد'}
                 </span>
              </div>
              <button className="btn btn-secondary" onClick={() => setShowDetailsDialog(false)}>إغلاق</button>
              
              {isUserApprover && (
                <button className="btn btn-primary" onClick={() => handleApprove(selectedCycle!.id)}>
                   {getIcon("check")} اعتماد وتمرير
                </button>
              )}
              
              {isDraftCreator && (
                <button className="btn btn-primary" onClick={() => handleApprove(selectedCycle!.id)}>
                   {getIcon("rocket")} تقديم للاعتماد
                </button>
              )}
           </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '1.5rem' }}>
            <div>
               <div style={{ marginBottom: '1.5rem' }}>
                <div className="form-row" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <div className="input-group" style={{ display: 'flex', position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                        {getIcon("search")}
                        </span>
                        <input
                        type="text"
                        className="form-control"
                        style={{ paddingLeft: '35px' }}
                        placeholder="بحث موظف..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div className="stat-card" style={{ background: '#f0f7ff', padding: '1rem', borderRadius: '8px', border: '1px solid #cce5ff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>إجمالي المستحقات</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{formatCurrency(selectedCycle?.total_net || 0)}</div>
                    </div>
                    <div className="stat-card" style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '8px', border: '1px solid #eee' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>بانتظار الصرف</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{formatCurrency(payrollItems.reduce((acc, item) => acc + (item.status === 'active' ? (item.remaining_balance || 0) : 0), 0))}</div>
                    </div>
                    <div className="stat-card" style={{ background: '#e8f5e9', padding: '1rem', borderRadius: '8px', border: '1px solid #c3e6cb' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>تم صرفه</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#28a745' }}>{formatCurrency(payrollItems.reduce((acc, item) => acc + (item.paid_amount || 0), 0))}</div>
                    </div>
                </div>
                </div>

                <div className="table-responsive">
                    <Table
                        columns={itemColumns}
                        data={filteredItems}
                        keyExtractor={(item) => item.id}
                        emptyMessage="لا توجد بيانات"
                    />
                </div>
            </div>

            <div style={{ borderRight: '1px solid #eee', paddingRight: '1rem' }}>
                <h5 style={{ marginBottom: '1rem', borderBottom: '2px solid var(--primary-color)', paddingBottom: '0.5rem' }}>مسار الاعتمادات</h5>
                {selectedCycle?.approval_trail && selectedCycle.approval_trail.length > 0 ? (
                   <div style={{ display: 'grid', gap: '15px' }}>
                      {selectedCycle.approval_trail.map((step, idx) => (
                        <div key={idx} style={{ position: 'relative', paddingLeft: '20px', borderLeft: '2px solid #28a745' }}>
                           <div style={{ position: 'absolute', left: '-7px', top: '0', width: '12px', height: '12px', borderRadius: '50%', background: '#28a745' }}></div>
                           <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{step.user_name}</div>
                           <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{formatDateTime(step.timestamp)}</div>
                           <div style={{ fontSize: '0.75rem', color: '#28a745' }}>تمت الموافقة</div>
                        </div>
                      ))}
                      {selectedCycle?.status === 'pending_approval' && selectedCycle?.current_approver && (
                        <div style={{ position: 'relative', paddingLeft: '20px', borderLeft: '2px dashed #fbc02d' }}>
                           <div style={{ position: 'absolute', left: '-7px', top: '0', width: '12px', height: '12px', borderRadius: '50%', background: '#fbc02d' }}></div>
                           <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{selectedCycle?.current_approver?.full_name}</div>
                           <div style={{ fontSize: '0.75rem', color: '#fbc02d' }}>بانتظار الموافقة الحالية</div>
                        </div>
                      )}
                   </div>
                ) : (
                   <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>لا توجد حركات سابقة</div>
                )}
            </div>
        </div>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog
        isOpen={showEditItemDialog}
        onClose={() => setShowEditItemDialog(false)}
        title={`تعديل مبالغ: ${selectedItem?.employee_name}`}
        footer={
           <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowEditItemDialog(false)}>إلغاء</button>
              <button className="btn btn-primary" onClick={handleUpdateItem} disabled={isSubmitting}>حفظ التغييرات</button>
           </div>
        }
      >
         <div style={{ display: 'grid', gap: '1rem' }}>
            <div className="form-group">
               <label className="form-label">الراتب الأساسي / المبلغ الأساسي</label>
               <input type="number" className="form-control" value={editItemData.base_salary} onChange={(e) => setEditItemData({...editItemData, base_salary: parseFloat(e.target.value)})} />
            </div>
            <div className="form-group">
               <label className="form-label">إجمالي البدلات / الإضافات</label>
               <input type="number" className="form-control" value={editItemData.total_allowances} onChange={(e) => setEditItemData({...editItemData, total_allowances: parseFloat(e.target.value)})} />
            </div>
            <div className="form-group">
               <label className="form-label">إجمالي الاستقطاعات</label>
               <input type="number" className="form-control" value={editItemData.total_deductions} onChange={(e) => setEditItemData({...editItemData, total_deductions: parseFloat(e.target.value)})} />
            </div>
            <div className="form-group">
               <label className="form-label">ملاحظات على المبالغ</label>
               <textarea className="form-control" value={editItemData.notes} onChange={(e) => setEditItemData({...editItemData, notes: e.target.value})} rows={2}></textarea>
            </div>
            <div style={{ padding: '10px', background: '#f0f7ff', borderRadius: '6px' }}>
               <strong>الصافي الجديد: {formatCurrency(editItemData.base_salary + editItemData.total_allowances - editItemData.total_deductions)}</strong>
            </div>
         </div>
      </Dialog>

      {/* Other dialogs (Payment, History, Bulk) remain largely the same or minor edits */}
      <Dialog
        isOpen={showHistoryDialog}
        onClose={() => setShowHistoryDialog(false)}
        title={`سجل التحويلات: ${selectedItem?.employee_name || ""}`}
        maxWidth="800px"
      >
        <Table columns={transactionColumns} data={transactions} keyExtractor={(item) => item.id} />
      </Dialog>

      <Dialog
        isOpen={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        title="تحويل مبلغ للموظف"
        footer={
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
             <button className="btn btn-secondary" onClick={() => setShowPaymentDialog(false)}>إلغاء</button>
             <button className="btn btn-primary" onClick={handleIndividualPayment} disabled={isSubmitting}>تأكيد الصرف</button>
          </div>
        }
      >
         <div className="form-group">
            <label className="form-label">طريقة الصرف</label>
            <select className="form-control" value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)}>
                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
            </select>
         </div>
         <div className="form-group">
            <label className="form-label">المبلغ</label>
            <input type="number" className="form-control" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
         </div>
      </Dialog>

      <Dialog
        isOpen={showBulkPaymentDialog}
        onClose={() => setShowBulkPaymentDialog(false)}
        title="صرف المسير بالكامل"
        footer={
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
             <button className="btn btn-secondary" onClick={() => setShowBulkPaymentDialog(false)}>إلغاء</button>
             <button className="btn btn-primary" onClick={handleBulkPayment} disabled={isSubmitting}>تأكيد صرف الكل</button>
          </div>
        }
      >
         <div className="form-group">
            <label className="form-label">الصرف من حساب</label>
            <select className="form-control" value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)}>
                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
            </select>
         </div>
         <div style={{ padding: '15px', background: '#e8f5e9', borderRadius: '8px', marginTop: '10px' }}>
            إجمالي المبلغ: <strong>{formatCurrency(selectedCycle?.total_net || 0)}</strong>
         </div>
      </Dialog>
    </>
  );
}
