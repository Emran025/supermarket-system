
import { useState } from "react";
import { Dialog, showAlert } from "@/components/ui";
import { fetchAPI } from "@/lib/api";
import { parseNumber } from "@/lib/utils";

interface AccrualDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void; // Callback to reload data in parent/siblings if needed
}

export function CreateAccrualDialog({ isOpen, onClose, onSuccess }: AccrualDialogProps) {
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
            onSuccess();
            onClose();
          } else {
            showAlert("alert-container", response.message || "فشل حفظ القيد", "error");
          }
        } catch {
          showAlert("alert-container", "خطأ في حفظ القيد", "error");
        }
      };

    return (
        <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title={
          accrualType === "payroll"
            ? "إضافة كشف مرتب"
            : accrualType === "prepayment"
            ? "إضافة دفعة مقدمة"
            : "إضافة إيراد غير مكتسب"
        }
        footer={
          <>
            <button className="btn btn-secondary" onClick={onClose}>
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
    );
}
