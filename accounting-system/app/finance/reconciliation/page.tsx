"use client";

import { useState, useEffect, useCallback } from "react";
import { MainLayout, PageHeader } from "@/components/layout";
import { Table, Dialog, ConfirmDialog, showToast, Column, showAlert } from "@/components/ui";
import { fetchAPI } from "@/lib/api";
import { formatCurrency, formatDate, parseNumber } from "@/lib/utils";
import { User, getStoredUser, checkAuth } from "@/lib/auth";
import { getIcon } from "@/lib/icons";

interface Reconciliation {
  id: number;
  reconciliation_date: string;
  bank_balance: number;
  ledger_balance: number;
  difference: number;
  notes?: string;
}

export default function ReconciliationPage() {
  const [user, setUser] = useState<User | null>(null);
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Dialogs
  const [createDialog, setCreateDialog] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [selectedReconciliation, setSelectedReconciliation] = useState<Reconciliation | null>(null);

  // Form
  const [reconciliationDate, setReconciliationDate] = useState(new Date().toISOString().split("T")[0]);
  const [bankBalance, setBankBalance] = useState("");
  const [reconciliationNotes, setReconciliationNotes] = useState("");
  const [ledgerBalance, setLedgerBalance] = useState(0);

  const itemsPerPage = 20;

  const loadReconciliations = useCallback(async (page: number = 1) => {
    try {
      setIsLoading(true);
      const response = await fetchAPI(`reconciliation?page=${page}&limit=${itemsPerPage}`);
      if (response.success && response.data) {
        setReconciliations(response.data as Reconciliation[]);
        const total = Number(response.total) || 0;
        setTotalPages(Math.ceil(total / itemsPerPage));
        setCurrentPage(page);
      } else {
        showAlert("alert-container", response.message || "فشل تحميل التسويات", "error");
      }
    } catch {
      showAlert("alert-container", "خطأ في الاتصال بالسيرفر", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const authenticated = await checkAuth();
      if (!authenticated) return;
      
      const storedUser = getStoredUser();
      setUser(storedUser);
      await loadReconciliations();
    };
    init();
  }, [loadReconciliations]);

  const openCreateDialog = () => {
    setReconciliationDate(new Date().toISOString().split("T")[0]);
    setBankBalance("");
    setReconciliationNotes("");
    setLedgerBalance(0);
    setCreateDialog(true);
  };

  const calculateReconciliation = async () => {
    if (!reconciliationDate) {
      showAlert("alert-container", "يرجى إدخال تاريخ التسوية", "warning");
      return;
    }

    try {
      // Get ledger balance from API
      const response = await fetchAPI(`reconciliation?action=calculate&date=${reconciliationDate}`);
      if (response.success && response.data ) {
        setLedgerBalance((response.data as Reconciliation).ledger_balance|| 0);
      }
    } catch {
      // Ignore - will show in form
    }
  };

  const saveReconciliation = async () => {
    if (!reconciliationDate) {
      showAlert("alert-container", "يرجى إدخال تاريخ التسوية", "warning");
      return;
    }

    try {
      const response = await fetchAPI("reconciliation", {
        method: "POST",
        body: JSON.stringify({
          reconciliation_date: reconciliationDate,
          bank_balance: parseNumber(bankBalance),
          notes: reconciliationNotes,
        }),
      });

      if (response.success) {
        showAlert("alert-container", "تم حفظ التسوية بنجاح", "success");
        setCreateDialog(false);
        await loadReconciliations(1);
      } else {
        showAlert("alert-container", response.message || "فشل حفظ التسوية", "error");
      }
    } catch {
      showAlert("alert-container", "خطأ في حفظ التسوية", "error");
    }
  };

  const viewReconciliation = (reconciliation: Reconciliation) => {
    setSelectedReconciliation(reconciliation);
    setViewDialog(true);
  };

  const createAdjustment = async (reconciliationId: number) => {
    const amount = prompt("أدخل مبلغ قيد التسوية:");
    if (!amount || parseNumber(amount) <= 0) return;

    const description = prompt("أدخل وصف قيد التسوية:");
    if (!description) return;

    const entryType = confirm("هل هذا مبلغ مدين؟ (نعم = مدين، لا = دائن)")
      ? "DEBIT"
      : "CREDIT";

    try {
      const response = await fetchAPI("reconciliation?action=adjust", {
        method: "PUT",
        body: JSON.stringify({
          reconciliation_id: reconciliationId,
          amount: parseNumber(amount),
          entry_type: entryType,
          description: description,
        }),
      });

      if (response.success) {
        showAlert("alert-container", "تم إنشاء قيد التسوية بنجاح", "success");
        await loadReconciliations(currentPage);
      } else {
        showAlert("alert-container", response.message || "فشل إنشاء قيد التسوية", "error");
      }
    } catch {
      showAlert("alert-container", "خطأ في إنشاء قيد التسوية", "error");
    }
  };

  const getDifferenceClass = (diff: number) => {
    return Math.abs(diff) < 0.01 ? "text-success" : "text-danger";
  };

  const columns: Column<Reconciliation>[] = [
    {
      key: "reconciliation_date",
      header: "التاريخ",
      dataLabel: "التاريخ",
      render: (item) => formatDate(item.reconciliation_date),
    },
    {
      key: "bank_balance",
      header: "رصيد البنك",
      dataLabel: "رصيد البنك",
      render: (item) => formatCurrency(item.bank_balance),
    },
    {
      key: "ledger_balance",
      header: "رصيد الدفتر",
      dataLabel: "رصيد الدفتر",
      render: (item) => formatCurrency(item.ledger_balance),
    },
    {
      key: "difference",
      header: "الفرق",
      dataLabel: "الفرق",
      render: (item) => (
        <span className={getDifferenceClass(item.difference)}>
          {formatCurrency(item.difference)}
        </span>
      ),
    },
    {
      key: "notes",
      header: "ملاحظات",
      dataLabel: "ملاحظات",
      render: (item) => item.notes || "-",
    },
    {
      key: "actions",
      header: "الإجراءات",
      dataLabel: "الإجراءات",
      render: (item) => (
        <div className="action-buttons">
          <button
            className="icon-btn view"
            onClick={() => viewReconciliation(item)}
            title="عرض"
          >
            {getIcon("eye")}
          </button>
          {Math.abs(item.difference) > 0.01 && (
            <button
              className="icon-btn edit"
              onClick={() => createAdjustment(item.id)}
              title="إنشاء قيد تسوية"
            >
              {getIcon("edit")}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout requiredModule="reconciliation">
      <PageHeader
        title="التسوية البنكية"
        user={user}
        actions={
          <button className="btn btn-primary" onClick={openCreateDialog}>
            {getIcon("plus")}
            تسوية جديدة
          </button>
        }
      />

      <div id="alert-container"></div>

      <div className="sales-card animate-fade">
        <Table
          columns={columns}
          data={reconciliations}
          keyExtractor={(item) => item.id}
          emptyMessage="لا توجد تسويات"
          isLoading={isLoading}
          pagination={{
            currentPage,
            totalPages,
            onPageChange: loadReconciliations,
          }}
        />
      </div>

      {/* Create Reconciliation Dialog */}
      <Dialog
        isOpen={createDialog}
        onClose={() => setCreateDialog(false)}
        title="تسوية جديدة"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setCreateDialog(false)}>
              إلغاء
            </button>
            <button className="btn btn-primary" onClick={saveReconciliation}>
              حفظ
            </button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveReconciliation();
          }}
        >
          <div className="form-group">
            <label htmlFor="reconciliation-date">تاريخ التسوية *</label>
            <input
              type="date"
              id="reconciliation-date"
              value={reconciliationDate}
              onChange={(e) => {
                setReconciliationDate(e.target.value);
                calculateReconciliation();
              }}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="bank-balance">رصيد البنك *</label>
            <input
              type="number"
              id="bank-balance"
              value={bankBalance}
              onChange={(e) => setBankBalance(e.target.value)}
              step="0.01"
              required
            />
          </div>

          {ledgerBalance > 0 && (
            <div className="summary-stat-box" style={{ marginBottom: "1rem" }}>
              <div className="stat-item">
                <span className="stat-label">رصيد الدفتر</span>
                <span className="stat-value">{formatCurrency(ledgerBalance)}</span>
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="reconciliation-notes">ملاحظات</label>
            <textarea
              id="reconciliation-notes"
              value={reconciliationNotes}
              onChange={(e) => setReconciliationNotes(e.target.value)}
              rows={3}
            />
          </div>
        </form>
      </Dialog>

      {/* View Reconciliation Dialog */}
      <Dialog
        isOpen={viewDialog}
        onClose={() => setViewDialog(false)}
        title="تفاصيل التسوية"
      >
        {selectedReconciliation && (
          <div>
            <div className="summary-stat-box">
              <div className="stat-item">
                <span className="stat-label">رصيد البنك</span>
                <span className="stat-value">
                  {formatCurrency(selectedReconciliation.bank_balance)}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">رصيد الدفتر</span>
                <span className="stat-value">
                  {formatCurrency(selectedReconciliation.ledger_balance)}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">الفرق</span>
                <span className={`stat-value ${getDifferenceClass(selectedReconciliation.difference)}`}>
                  {formatCurrency(selectedReconciliation.difference)}
                </span>
              </div>
            </div>
            {selectedReconciliation.notes && (
              <p style={{ marginTop: "1rem" }}>
                <strong>ملاحظات:</strong> {selectedReconciliation.notes}
              </p>
            )}
          </div>
        )}
      </Dialog>
    </MainLayout>
  );
}

