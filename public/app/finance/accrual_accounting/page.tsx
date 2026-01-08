"use client";

import { useState, useEffect, useCallback } from "react";
import { MainLayout, PageHeader } from "@/components/layout";
import { Table, Dialog, ConfirmDialog, showToast, Column, showAlert, TabNavigation } from "@/components/ui";
import { fetchAPI } from "@/lib/api";
import { formatCurrency, formatDate, parseNumber } from "@/lib/utils";
import { User, getStoredUser, checkAuth } from "@/lib/auth";
import { getIcon } from "@/lib/icons";

interface Payroll {
  id: number;
  payroll_date: string;
  gross_pay: number;
  deductions: number;
  net_pay: number;
  description?: string;
  employee_name?: string;
  salary_amount?: number;
}

interface Prepayment {
  id: number;
  prepayment_date: string;
  total_amount: number;
  months: number;
  description?: string;
  expense_account_code?: string;
  payment_date?: string;
  amortization_periods?: number;
}

interface UnearnedRevenue {
  id: number;
  receipt_date: string;
  total_amount: number;
  months: number;
  description?: string;
  revenue_account_code?: string;
}

export default function AccrualAccountingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"payroll" | "prepayments" | "unearned">("payroll");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Data
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [prepayments, setPrepayments] = useState<Prepayment[]>([]);
  const [unearned, setUnearned] = useState<UnearnedRevenue[]>([]);

  // Dialogs
  const [accrualDialog, setAccrualDialog] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: "amortize" | "recognize";
    id: number;
  } | null>(null);

  // Form
  const [accrualType, setAccrualType] = useState<"payroll" | "prepayment" | "unearned">("payroll");
  
  // Payroll fields
  const [payrollDate, setPayrollDate] = useState(new Date().toISOString().split("T")[0]);
  const [grossPay, setGrossPay] = useState("");
  const [deductions, setDeductions] = useState("0");
  const [payrollDescription, setPayrollDescription] = useState("كشف مرتب شهري");
  
  // Prepayment fields
  const [prepaymentDate, setPrepaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [prepaymentAmount, setPrepaymentAmount] = useState("");
  const [prepaymentMonths, setPrepaymentMonths] = useState("1");
  const [prepaymentDescription, setPrepaymentDescription] = useState("");
  const [prepaymentExpenseAccount, setPrepaymentExpenseAccount] = useState("");
  
  // Unearned fields
  const [unearnedDate, setUnearnedDate] = useState(new Date().toISOString().split("T")[0]);
  const [unearnedAmount, setUnearnedAmount] = useState("");
  const [unearnedMonths, setUnearnedMonths] = useState("1");
  const [unearnedDescription, setUnearnedDescription] = useState("");
  const [unearnedRevenueAccount, setUnearnedRevenueAccount] = useState("");

  const itemsPerPage = 20;

  const loadPayroll = useCallback(async (page: number = 1) => {
    try {
      setIsLoading(true);
      const response = await fetchAPI(`accrual?module=payroll&page=${page}&limit=${itemsPerPage}`);
      if (response.success && response.data) {
        setPayrolls(response.data as Payroll[]);
        const total = Number(response.total) || 0;
        setTotalPages(Math.ceil(total / itemsPerPage));
        setCurrentPage(page);
      } else {
        showAlert("alert-container", response.message || "فشل تحميل كشوف المرتبات", "error");
      }
    } catch {
      showAlert("alert-container", "خطأ في الاتصال بالسيرفر", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadPrepayments = useCallback(async (page: number = 1) => {
    try {
      setIsLoading(true);
      const response = await fetchAPI(`accrual?module=prepayments&page=${page}&limit=${itemsPerPage}`);
      if (response.success && response.data) {
        setPrepayments(response.data as Prepayment[]);
        const total = Number(response.total) || 0;
        setTotalPages(Math.ceil(total / itemsPerPage));
        setCurrentPage(page);
      } else {
        showAlert("alert-container", response.message || "فشل تحميل المدفوعات المقدمة", "error");
      }
    } catch {
      showAlert("alert-container", "خطأ في الاتصال بالسيرفر", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadUnearnedRevenue = useCallback(async (page: number = 1) => {
    try {
      setIsLoading(true);
      const response = await fetchAPI(`accrual?module=unearned_revenue&page=${page}&limit=${itemsPerPage}`);
      if (response.success && response.data) {
        setUnearned(response.data as UnearnedRevenue[]);
        const total = Number(response.total) || 0;
        setTotalPages(Math.ceil(total / itemsPerPage));
        setCurrentPage(page);
      } else {
        showAlert("alert-container", response.message || "فشل تحميل الإيرادات غير المكتسبة", "error");
      }
    } catch {
      showAlert("alert-container", "خطأ في الاتصال بالسيرفر", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadCurrentTab = useCallback(() => {
    switch (activeTab) {
      case "payroll":
        loadPayroll(1);
        break;
      case "prepayments":
        loadPrepayments(1);
        break;
      case "unearned":
        loadUnearnedRevenue(1);
        break;
    }
  }, [activeTab, loadPayroll, loadPrepayments, loadUnearnedRevenue]);

  useEffect(() => {
    const init = async () => {
      const authenticated = await checkAuth();
      if (!authenticated) return;
      
      const storedUser = getStoredUser();
      setUser(storedUser);
      await loadCurrentTab();
    };
    init();
  }, [loadCurrentTab]);

  const openCreateDialog = () => {
    setAccrualType("payroll");
    setPayrollDate(new Date().toISOString().split("T")[0]);
    setGrossPay("");
    setDeductions("0");
    setPayrollDescription("كشف مرتب شهري");
    setPrepaymentDate(new Date().toISOString().split("T")[0]);
    setPrepaymentAmount("");
    setPrepaymentMonths("1");
    setPrepaymentDescription("");
    setPrepaymentExpenseAccount("");
    setUnearnedDate(new Date().toISOString().split("T")[0]);
    setUnearnedAmount("");
    setUnearnedMonths("1");
    setUnearnedDescription("");
    setUnearnedRevenueAccount("");
    setAccrualDialog(true);
  };

  const saveAccrual = async () => {
    let data: any = {};

    if (accrualType === "payroll") {
      if (!payrollDate || !grossPay) {
        showAlert("alert-container", "يرجى ملء جميع الحقول المطلوبة", "error");
        return;
      }
      data = {
        payroll_date: payrollDate,
        gross_pay: parseNumber(grossPay),
        deductions: parseNumber(deductions),
        description: payrollDescription,
      };
    } else if (accrualType === "prepayment") {
      if (!prepaymentDate || !prepaymentAmount || !prepaymentMonths) {
        showAlert("alert-container", "يرجى ملء جميع الحقول المطلوبة", "error");
        return;
      }
      data = {
        prepayment_date: prepaymentDate,
        total_amount: parseNumber(prepaymentAmount),
        months: parseInt(prepaymentMonths),
        description: prepaymentDescription,
        expense_account_code: prepaymentExpenseAccount || null,
      };
    } else if (accrualType === "unearned") {
      if (!unearnedDate || !unearnedAmount || !unearnedMonths) {
        showAlert("alert-container", "يرجى ملء جميع الحقول المطلوبة", "error");
        return;
      }
      data = {
        receipt_date: unearnedDate,
        total_amount: parseNumber(unearnedAmount),
        months: parseInt(unearnedMonths),
        description: unearnedDescription,
        revenue_account_code: unearnedRevenueAccount || null,
      };
    }

    try {
      const module =
        accrualType === "payroll"
          ? "payroll"
          : accrualType === "prepayment"
          ? "prepayments"
          : "unearned_revenue";

      const response = await fetchAPI(`accrual?module=${module}`, {
        method: "POST",
        body: JSON.stringify(data),
      });

      if (response.success) {
        showAlert("alert-container", "تم حفظ القيد بنجاح", "success");
        setAccrualDialog(false);
        await loadCurrentTab();
      } else {
        showAlert("alert-container", response.message || "فشل حفظ القيد", "error");
      }
    } catch {
      showAlert("alert-container", "خطأ في حفظ القيد", "error");
    }
  };

  const confirmAmortizePrepayment = (id: number) => {
    setConfirmAction({ type: "amortize", id });
    setConfirmDialog(true);
  };

  const confirmRecognizeRevenue = (id: number) => {
    setConfirmAction({ type: "recognize", id });
    setConfirmDialog(true);
  };

  const executeAction = async () => {
    if (!confirmAction) return;

    try {
      const module = confirmAction.type === "amortize" ? "prepayments" : "unearned_revenue";
      const response = await fetchAPI(`accrual?module=${module}`, {
        method: "PUT",
        body: JSON.stringify({
          id: confirmAction.id,
          [confirmAction.type === "amortize" ? "amortization_date" : "recognition_date"]:
            new Date().toISOString().split("T")[0],
        }),
      });

      if (response.success) {
        showAlert(
          "alert-container",
          confirmAction.type === "amortize"
            ? "تم استهلاك الدفعة المقدمة بنجاح"
            : "تم تحقق الإيراد بنجاح",
          "success"
        );
        setConfirmDialog(false);
        setConfirmAction(null);
        await loadCurrentTab();
      } else {
        showAlert("alert-container", response.message || "فشل العملية", "error");
      }
    } catch {
      showAlert("alert-container", "خطأ في تنفيذ العملية", "error");
    }
  };

  const payrollColumns: Column<Payroll>[] = [
    {
      key: "payroll_date",
      header: "التاريخ",
      dataLabel: "التاريخ",
      render: (item) => formatDate(item.payroll_date),
    },
    {
      key: "gross_pay",
      header: "إجمالي الراتب",
      dataLabel: "إجمالي الراتب",
      render: (item) => formatCurrency(item.gross_pay || item.salary_amount || 0),
    },
    {
      key: "deductions",
      header: "الخصومات",
      dataLabel: "الخصومات",
      render: (item) => formatCurrency(item.deductions || 0),
    },
    {
      key: "net_pay",
      header: "صافي الراتب",
      dataLabel: "صافي الراتب",
      render: (item) => (
        <strong>{formatCurrency(item.net_pay || item.salary_amount || 0)}</strong>
      ),
    },
    {
      key: "description",
      header: "الوصف",
      dataLabel: "الوصف",
      render: (item) => item.description || item.employee_name || "-",
    },
    {
      key: "actions",
      header: "الإجراءات",
      dataLabel: "الإجراءات",
      render: (item) => (
        <div className="action-buttons">
          <button className="icon-btn view" title="عرض">
            {getIcon("eye")}
          </button>
        </div>
      ),
    },
  ];

  const prepaymentColumns: Column<Prepayment>[] = [
    {
      key: "prepayment_date",
      header: "التاريخ",
      dataLabel: "التاريخ",
      render: (item) => formatDate(item.prepayment_date || item.payment_date),
    },
    {
      key: "total_amount",
      header: "المبلغ الإجمالي",
      dataLabel: "المبلغ الإجمالي",
      render: (item) => formatCurrency(item.total_amount),
    },
    {
      key: "months",
      header: "عدد الأشهر",
      dataLabel: "عدد الأشهر",
      render: (item) => item.months || item.amortization_periods || 1,
    },
    {
      key: "description",
      header: "الوصف",
      dataLabel: "الوصف",
      render: (item) => item.description || "-",
    },
    {
      key: "expense_account_code",
      header: "حساب المصروف",
      dataLabel: "حساب المصروف",
      render: (item) => item.expense_account_code || "-",
    },
    {
      key: "actions",
      header: "الإجراءات",
      dataLabel: "الإجراءات",
      render: (item) => (
        <div className="action-buttons">
          <button className="icon-btn view" title="عرض">
            {getIcon("eye")}
          </button>
          <button
            className="icon-btn edit"
            onClick={() => confirmAmortizePrepayment(item.id)}
            title="استهلاك"
          >
            {getIcon("edit")}
          </button>
        </div>
      ),
    },
  ];

  const unearnedColumns: Column<UnearnedRevenue>[] = [
    {
      key: "receipt_date",
      header: "التاريخ",
      dataLabel: "التاريخ",
      render: (item) => formatDate(item.receipt_date),
    },
    {
      key: "total_amount",
      header: "المبلغ الإجمالي",
      dataLabel: "المبلغ الإجمالي",
      render: (item) => formatCurrency(item.total_amount),
    },
    {
      key: "months",
      header: "عدد الأشهر",
      dataLabel: "عدد الأشهر",
      render: (item) => item.months,
    },
    {
      key: "description",
      header: "الوصف",
      dataLabel: "الوصف",
      render: (item) => item.description || "-",
    },
    {
      key: "revenue_account_code",
      header: "حساب الإيراد",
      dataLabel: "حساب الإيراد",
      render: (item) => item.revenue_account_code || "-",
    },
    {
      key: "actions",
      header: "الإجراءات",
      dataLabel: "الإجراءات",
      render: (item) => (
        <div className="action-buttons">
          <button className="icon-btn view" title="عرض">
            {getIcon("eye")}
          </button>
          <button
            className="icon-btn edit"
            onClick={() => confirmRecognizeRevenue(item.id)}
            title="تحقق"
          >
            {getIcon("edit")}
          </button>
        </div>
      ),
    },
  ];

  return (
    <MainLayout requiredModule="accrual_accounting">
      <PageHeader
        title="المحاسبة الاستحقاقية"
        user={user}
        actions={
          <button className="btn btn-primary" onClick={openCreateDialog}>
            {getIcon("plus")}
            إضافة قيد
          </button>
        }
      />

      <div id="alert-container"></div>

      <div className="settings-wrapper animate-fade">
        {/* Tabs */}
        <TabNavigation 
          tabs={[
            { key: "payroll", label: "كشوف المرتبات", icon: "fa-users" },
            { key: "prepayments", label: "المدفوعات المقدمة", icon: "fa-calendar" },
            { key: "unearned", label: "الإيرادات غير المكتسبة", icon: "fa-dollar-sign" }
          ]}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab as typeof activeTab);
            if (tab === "payroll") loadPayroll(1);
            else if (tab === "prepayments") loadPrepayments(1);
            else if (tab === "unearned") loadUnearnedRevenue(1);
          }}
        />

        {/* Payroll Tab */}
        <div className={`tab-content ${activeTab === "payroll" ? "active" : ""}`}>
          <div className="sales-card">
            <Table
              columns={payrollColumns}
              data={payrolls}
              keyExtractor={(item) => item.id}
              emptyMessage="لا توجد كشوف مرتبات"
              isLoading={isLoading}
              pagination={{
                currentPage,
                totalPages,
                onPageChange: loadPayroll,
              }}
            />
          </div>
        </div>

        {/* Prepayments Tab */}
        <div className={`tab-content ${activeTab === "prepayments" ? "active" : ""}`}>
          <div className="sales-card">
            <Table
              columns={prepaymentColumns}
              data={prepayments}
              keyExtractor={(item) => item.id}
              emptyMessage="لا توجد مدفوعات مقدمة"
              isLoading={isLoading}
              pagination={{
                currentPage,
                totalPages,
                onPageChange: loadPrepayments,
              }}
            />
          </div>
        </div>

        {/* Unearned Revenue Tab */}
        <div className={`tab-content ${activeTab === "unearned" ? "active" : ""}`}>
          <div className="sales-card">
            <Table
              columns={unearnedColumns}
              data={unearned}
              keyExtractor={(item) => item.id}
              emptyMessage="لا توجد إيرادات غير مكتسبة"
              isLoading={isLoading}
              pagination={{
                currentPage,
                totalPages,
                onPageChange: loadUnearnedRevenue,
              }}
            />
          </div>
        </div>
      </div>

      {/* Accrual Dialog */}
      <Dialog
        isOpen={accrualDialog}
        onClose={() => setAccrualDialog(false)}
        title={
          accrualType === "payroll"
            ? "إضافة كشف مرتب"
            : accrualType === "prepayment"
            ? "إضافة دفعة مقدمة"
            : "إضافة إيراد غير مكتسب"
        }
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setAccrualDialog(false)}>
              إلغاء
            </button>
            <button className="btn btn-primary" onClick={saveAccrual}>
              حفظ
            </button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveAccrual();
          }}
        >
          <div className="form-group">
            <label htmlFor="accrual-type-select">نوع القيد *</label>
            <select
              id="accrual-type-select"
              value={accrualType}
              onChange={(e) =>
                setAccrualType(e.target.value as typeof accrualType)
              }
            >
              <option value="payroll">كشف مرتبات</option>
              <option value="prepayment">مدفوعات مقدمة</option>
              <option value="unearned">إيرادات غير مكتسبة</option>
            </select>
          </div>

          {/* Payroll Fields */}
          {accrualType === "payroll" && (
            <>
              <div className="form-group">
                <label htmlFor="payroll-date">تاريخ الراتب *</label>
                <input
                  type="date"
                  id="payroll-date"
                  value={payrollDate}
                  onChange={(e) => setPayrollDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="gross-pay">إجمالي الراتب *</label>
                <input
                  type="number"
                  id="gross-pay"
                  value={grossPay}
                  onChange={(e) => setGrossPay(e.target.value)}
                  step="0.01"
                  min="0"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="deductions">الخصومات</label>
                <input
                  type="number"
                  id="deductions"
                  value={deductions}
                  onChange={(e) => setDeductions(e.target.value)}
                  step="0.01"
                  min="0"
                />
              </div>
              <div className="form-group">
                <label htmlFor="payroll-description">الوصف</label>
                <textarea
                  id="payroll-description"
                  value={payrollDescription}
                  onChange={(e) => setPayrollDescription(e.target.value)}
                  rows={2}
                />
              </div>
            </>
          )}

          {/* Prepayment Fields */}
          {accrualType === "prepayment" && (
            <>
              <div className="form-group">
                <label htmlFor="prepayment-date">تاريخ الدفع *</label>
                <input
                  type="date"
                  id="prepayment-date"
                  value={prepaymentDate}
                  onChange={(e) => setPrepaymentDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="prepayment-amount">المبلغ الإجمالي *</label>
                <input
                  type="number"
                  id="prepayment-amount"
                  value={prepaymentAmount}
                  onChange={(e) => setPrepaymentAmount(e.target.value)}
                  step="0.01"
                  min="0"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="prepayment-months">عدد الأشهر *</label>
                <input
                  type="number"
                  id="prepayment-months"
                  value={prepaymentMonths}
                  onChange={(e) => setPrepaymentMonths(e.target.value)}
                  min="1"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="prepayment-expense-account">حساب المصروف</label>
                <input
                  type="text"
                  id="prepayment-expense-account"
                  value={prepaymentExpenseAccount}
                  onChange={(e) => setPrepaymentExpenseAccount(e.target.value)}
                  placeholder="رمز الحساب (اختياري)"
                />
              </div>
              <div className="form-group">
                <label htmlFor="prepayment-description">الوصف *</label>
                <textarea
                  id="prepayment-description"
                  value={prepaymentDescription}
                  onChange={(e) => setPrepaymentDescription(e.target.value)}
                  rows={2}
                  required
                />
              </div>
            </>
          )}

          {/* Unearned Revenue Fields */}
          {accrualType === "unearned" && (
            <>
              <div className="form-group">
                <label htmlFor="unearned-date">تاريخ الاستلام *</label>
                <input
                  type="date"
                  id="unearned-date"
                  value={unearnedDate}
                  onChange={(e) => setUnearnedDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="unearned-amount">المبلغ الإجمالي *</label>
                <input
                  type="number"
                  id="unearned-amount"
                  value={unearnedAmount}
                  onChange={(e) => setUnearnedAmount(e.target.value)}
                  step="0.01"
                  min="0"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="unearned-months">عدد الأشهر *</label>
                <input
                  type="number"
                  id="unearned-months"
                  value={unearnedMonths}
                  onChange={(e) => setUnearnedMonths(e.target.value)}
                  min="1"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="unearned-revenue-account">حساب الإيراد</label>
                <input
                  type="text"
                  id="unearned-revenue-account"
                  value={unearnedRevenueAccount}
                  onChange={(e) => setUnearnedRevenueAccount(e.target.value)}
                  placeholder="رمز الحساب (اختياري)"
                />
              </div>
              <div className="form-group">
                <label htmlFor="unearned-description">الوصف *</label>
                <textarea
                  id="unearned-description"
                  value={unearnedDescription}
                  onChange={(e) => setUnearnedDescription(e.target.value)}
                  rows={2}
                  required
                />
              </div>
            </>
          )}
        </form>
      </Dialog>

      {/* Confirm Action Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog}
        onClose={() => {
          setConfirmDialog(false);
          setConfirmAction(null);
        }}
        onConfirm={executeAction}
        title="تأكيد العملية"
        message={
          confirmAction?.type === "amortize"
            ? "هل تريد استهلاك دفعة مقدمة لهذا الشهر؟"
            : "هل تريد تحقق إيراد غير مكتسب لهذا الشهر؟"
        }
        confirmText="تأكيد"
        confirmVariant="primary"
      />
    </MainLayout>
  );
}

