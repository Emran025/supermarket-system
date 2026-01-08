
import { useState, useCallback, useEffect } from "react";
import { fetchAPI } from "@/lib/api";
import { showAlert, Table, Column, ConfirmDialog } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getIcon } from "@/lib/icons";
import { UnearnedRevenue } from "../types";

export function UnearnedRevenueTab() {
  const [unearned, setUnearned] = useState<UnearnedRevenue[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const itemsPerPage = 20;

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

  useEffect(() => {
    loadUnearnedRevenue();
  }, [loadUnearnedRevenue]);

  const confirmRecognizeRevenue = (id: number) => {
    setSelectedId(id);
    setConfirmDialog(true);
  };

  const executeAction = async () => {
    if (!selectedId) return;

    try {
      const response = await fetchAPI(`accrual?module=unearned_revenue`, {
        method: "PUT",
        body: JSON.stringify({
          id: selectedId,
          recognition_date: new Date().toISOString().split("T")[0],
        }),
      });

      if (response.success) {
        showAlert("alert-container", "تم تحقق الإيراد بنجاح", "success");
        setConfirmDialog(false);
        setSelectedId(null);
        await loadUnearnedRevenue(currentPage);
      } else {
        showAlert("alert-container", response.message || "فشل العملية", "error");
      }
    } catch {
      showAlert("alert-container", "خطأ في تنفيذ العملية", "error");
    }
  };

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

      <ConfirmDialog
        isOpen={confirmDialog}
        onClose={() => {
          setConfirmDialog(false);
          setSelectedId(null);
        }}
        onConfirm={executeAction}
        title="تأكيد العملية"
        message="هل تريد تحقق إيراد غير مكتسب لهذا الشهر؟"
        confirmText="تأكيد"
        confirmVariant="primary"
      />
    </div>
  );
}
