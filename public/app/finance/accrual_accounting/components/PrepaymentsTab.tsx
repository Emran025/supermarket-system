
import { useState, useCallback, useEffect } from "react";
import { fetchAPI } from "@/lib/api";
import { showAlert, Table, Column, ConfirmDialog } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getIcon } from "@/lib/icons";
import { Prepayment } from "../types";

export function PrepaymentsTab() {
  const [prepayments, setPrepayments] = useState<Prepayment[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  
  const itemsPerPage = 20;

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

  useEffect(() => {
    loadPrepayments();
  }, [loadPrepayments]);

  const confirmAmortizePrepayment = (id: number) => {
    setSelectedId(id);
    setConfirmDialog(true);
  };

  const executeAction = async () => {
    if (!selectedId) return;

    try {
      const response = await fetchAPI(`accrual?module=prepayments`, {
        method: "PUT",
        body: JSON.stringify({
          id: selectedId,
          amortization_date: new Date().toISOString().split("T")[0],
        }),
      });

      if (response.success) {
        showAlert("alert-container", "تم استهلاك الدفعة المقدمة بنجاح", "success");
        setConfirmDialog(false);
        setSelectedId(null);
        await loadPrepayments(currentPage);
      } else {
        showAlert("alert-container", response.message || "فشل العملية", "error");
      }
    } catch {
      showAlert("alert-container", "خطأ في تنفيذ العملية", "error");
    }
  };

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

  return (
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

      <ConfirmDialog
        isOpen={confirmDialog}
        onClose={() => {
          setConfirmDialog(false);
          setSelectedId(null);
        }}
        onConfirm={executeAction}
        title="تأكيد العملية"
        message="هل تريد استهلاك دفعة مقدمة لهذا الشهر؟"
        confirmText="تأكيد"
        confirmVariant="primary"
      />
    </div>
  );
}
