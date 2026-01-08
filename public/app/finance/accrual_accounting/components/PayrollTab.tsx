
import { useState, useCallback, useEffect } from "react";
import { fetchAPI } from "@/lib/api";
import { showAlert, Table, Column } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getIcon } from "@/lib/icons";
import { Payroll } from "../types";

export function PayrollTab() {
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
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

  useEffect(() => {
    loadPayroll();
  }, [loadPayroll]);

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

  return (
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
  );
}
