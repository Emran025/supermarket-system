"use client";

import { useState, useEffect, useCallback } from "react";
import { MainLayout, PageHeader } from "@/components/layout";
import { Table, Dialog, ConfirmDialog, showToast, Column, showAlert } from "@/components/ui";
import { fetchAPI } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { User, getStoredUser, checkAuth } from "@/lib/auth";
import { getIcon } from "@/lib/icons";

interface FiscalPeriod {
  id: number;
  period_name: string;
  start_date: string;
  end_date: string;
  is_locked: boolean;
  is_closed: boolean;
}

export default function FiscalPeriodsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Dialogs
  const [periodDialog, setPeriodDialog] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: "lock" | "unlock" | "close";
    periodId: number;
  } | null>(null);

  // Form
  const [currentPeriodId, setCurrentPeriodId] = useState<number | null>(null);
  const [periodName, setPeriodName] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  const itemsPerPage = 20;

  const loadPeriods = useCallback(async (page: number = 1) => {
    try {
      setIsLoading(true);
      const response = await fetchAPI(`fiscal_periods?page=${page}&limit=${itemsPerPage}`);
      if (response.success && response.data) {
        setPeriods(response.data as FiscalPeriod[]);
        const total = Number(response.total) || 0;
        setTotalPages(Math.ceil(total / itemsPerPage));
        setCurrentPage(page);
      } else {
        showAlert("alert-container", response.message || "فشل تحميل الفترات المالية", "error");
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
      await loadPeriods();
    };
    init();
  }, [loadPeriods]);

  const openCreateDialog = () => {
    setCurrentPeriodId(null);
    setPeriodName("");
    setPeriodStart("");
    setPeriodEnd("");
    setPeriodDialog(true);
  };

  const viewPeriod = async (id: number) => {
    try {
      const response = await fetchAPI(`fiscal_periods?id=${id}`);
      if (response.success && response.data) {
        const period = Array.isArray(response.data) ? response.data[0] : response.data;
        if (period) {
          alert(
            `اسم الفترة: ${period.period_name}\nمن: ${formatDate(period.start_date)}\nإلى: ${formatDate(period.end_date)}\nمقفلة: ${period.is_locked ? "نعم" : "لا"}\nمغلقة: ${period.is_closed ? "نعم" : "لا"}`
          );
        }
      }
    } catch {
      showToast("خطأ في تحميل الفترة", "error");
    }
  };

  const editPeriod = async (id: number) => {
    try {
      const response = await fetchAPI(`fiscal_periods?id=${id}`);
      if (response.success && response.data) {
        const period = Array.isArray(response.data) ? response.data[0] : response.data;
        if (!period) {
          showAlert("alert-container", "الفترة غير موجودة", "error");
          return;
        }

        setCurrentPeriodId(period.id);
        setPeriodName(period.period_name);
        setPeriodStart(period.start_date);
        setPeriodEnd(period.end_date);
        setPeriodDialog(true);
      }
    } catch {
      showAlert("alert-container", "خطأ في تحميل الفترة", "error");
    }
  };

  const savePeriod = async () => {
    if (!periodName || !periodStart || !periodEnd) {
      showAlert("alert-container", "يرجى ملء جميع الحقول", "error");
      return;
    }

    try {
      const body: any = {
        period_name: periodName,
        start_date: periodStart,
        end_date: periodEnd,
      };
      if (currentPeriodId) body.id = currentPeriodId;

      const response = await fetchAPI("fiscal_periods", {
        method: currentPeriodId ? "PUT" : "POST",
        body: JSON.stringify(body),
      });

      if (response.success) {
        showAlert("alert-container", "تم الحفظ بنجاح", "success");
        setPeriodDialog(false);
        await loadPeriods(currentPage);
      } else {
        showAlert("alert-container", response.message || "فشل الحفظ", "error");
      }
    } catch {
      showAlert("alert-container", "خطأ في الحفظ", "error");
    }
  };

  const confirmLockPeriod = (id: number) => {
    setConfirmAction({ type: "lock", periodId: id });
    setConfirmDialog(true);
  };

  const confirmUnlockPeriod = (id: number) => {
    setConfirmAction({ type: "unlock", periodId: id });
    setConfirmDialog(true);
  };

  const confirmClosePeriod = (id: number) => {
    setConfirmAction({ type: "close", periodId: id });
    setConfirmDialog(true);
  };

  const executeAction = async () => {
    if (!confirmAction) return;

    const messages = {
      lock: "هل أنت متأكد من قفل هذه الفترة؟ لن يمكن إضافة قيود جديدة.",
      unlock: "هل أنت متأكد من فتح هذه الفترة؟ سيتم السماح بإضافة قيود جديدة.",
      close: "هل أنت متأكد من إغلاق هذه الفترة؟ سيتم إنشاء قيود الإغلاق ولن يمكن تعديل الفترة.",
    };

    try {
      const response = await fetchAPI(
        `fiscal_periods?action=${confirmAction.type}`,
        {
          method: "PUT",
          body: JSON.stringify({ id: confirmAction.periodId }),
        }
      );

      if (response.success) {
        const successMessages = {
          lock: "تم قفل الفترة بنجاح",
          unlock: "تم فتح الفترة بنجاح",
          close: "تم إغلاق الفترة بنجاح",
        };
        showAlert("alert-container", successMessages[confirmAction.type], "success");
        setConfirmDialog(false);
        setConfirmAction(null);
        await loadPeriods(currentPage);
      } else {
        showAlert("alert-container", response.message || "فشل العملية", "error");
      }
    } catch {
      showAlert("alert-container", "خطأ في تنفيذ العملية", "error");
    }
  };

  const getStatusBadge = (period: FiscalPeriod) => {
    if (period.is_closed) {
      return <span className="badge badge-danger">مغلقة</span>;
    } else if (period.is_locked) {
      return <span className="badge badge-warning">مقفلة</span>;
    }
    return <span className="badge badge-success">نشطة</span>;
  };

  const columns: Column<FiscalPeriod>[] = [
    {
      key: "period_name",
      header: "اسم الفترة",
      dataLabel: "اسم الفترة",
      render: (item) => <strong>{item.period_name}</strong>,
    },
    {
      key: "start_date",
      header: "تاريخ البداية",
      dataLabel: "تاريخ البداية",
      render: (item) => formatDate(item.start_date),
    },
    {
      key: "end_date",
      header: "تاريخ النهاية",
      dataLabel: "تاريخ النهاية",
      render: (item) => formatDate(item.end_date),
    },
    {
      key: "status",
      header: "الحالة",
      dataLabel: "الحالة",
      render: (item) => getStatusBadge(item),
    },
    {
      key: "is_locked",
      header: "مقفلة",
      dataLabel: "مقفلة",
      render: (item) => (item.is_locked ? "✓" : "✗"),
    },
    {
      key: "is_closed",
      header: "مغلقة",
      dataLabel: "مغلقة",
      render: (item) => (item.is_closed ? "✓" : "✗"),
    },
    {
      key: "actions",
      header: "الإجراءات",
      dataLabel: "الإجراءات",
      render: (item) => (
        <div className="action-buttons">
          <button className="icon-btn view" onClick={() => viewPeriod(item.id)} title="عرض">
            {getIcon("eye")}
          </button>
          {!item.is_closed && (
            <>
              <button
                className="icon-btn"
                onClick={() => (item.is_locked ? confirmUnlockPeriod(item.id) : confirmLockPeriod(item.id))}
                title={item.is_locked ? "فتح" : "قفل"}
              >
                {getIcon(item.is_locked ? "unlock" : "lock")}
              </button>
              {!item.is_locked && (
                <button className="icon-btn edit" onClick={() => editPeriod(item.id)} title="تعديل">
                  {getIcon("edit")}
                </button>
              )}
              <button
                className="icon-btn"
                onClick={() => confirmClosePeriod(item.id)}
                title="إغلاق"
                style={{ background: "var(--danger-color)", color: "white" }}
              >
                {getIcon("check")}
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout requiredModule="fiscal_periods">
      <PageHeader
        title="الفترات المالية"
        user={user}
        actions={
          <button className="btn btn-primary" onClick={openCreateDialog}>
            {getIcon("plus")}
            فترة جديدة
          </button>
        }
      />

      <div id="alert-container"></div>

      <div className="sales-card animate-fade">
        <Table
          columns={columns}
          data={periods}
          keyExtractor={(item) => item.id}
          emptyMessage="لا توجد فترات مالية"
          isLoading={isLoading}
          pagination={{
            currentPage,
            totalPages,
            onPageChange: loadPeriods,
          }}
        />
      </div>

      {/* Period Dialog */}
      <Dialog
        isOpen={periodDialog}
        onClose={() => setPeriodDialog(false)}
        title={currentPeriodId ? "تعديل الفترة" : "فترة مالية جديدة"}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setPeriodDialog(false)}>
              إلغاء
            </button>
            <button className="btn btn-primary" onClick={savePeriod}>
              حفظ
            </button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            savePeriod();
          }}
        >
          <div className="form-group">
            <label htmlFor="period-name">اسم الفترة *</label>
            <input
              type="text"
              id="period-name"
              value={periodName}
              onChange={(e) => setPeriodName(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="period-start">تاريخ البداية *</label>
              <input
                type="date"
                id="period-start"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="period-end">تاريخ النهاية *</label>
              <input
                type="date"
                id="period-end"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                required
              />
            </div>
          </div>
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
          confirmAction?.type === "lock"
            ? "هل أنت متأكد من قفل هذه الفترة؟ لن يمكن إضافة قيود جديدة."
            : confirmAction?.type === "unlock"
            ? "هل أنت متأكد من فتح هذه الفترة؟ سيتم السماح بإضافة قيود جديدة."
            : "هل أنت متأكد من إغلاق هذه الفترة؟ سيتم إنشاء قيود الإغلاق ولن يمكن تعديل الفترة."
        }
        confirmText="تأكيد"
        confirmVariant={confirmAction?.type === "close" ? "danger" : "primary"}
      />
    </MainLayout>
  );
}

