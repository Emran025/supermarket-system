"use client";

import { useState, useEffect, useCallback } from "react";
import { MainLayout, PageHeader } from "@/components/layout";
import { Table, Dialog, ConfirmDialog, showToast, Column } from "@/components/ui";
import { fetchAPI } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/utils";
import { User, getStoredUser, checkAuth } from "@/lib/auth";
import { getIcon } from "@/lib/icons";

interface Batch {
  id: number;
  batch_name: string;
  batch_type: "journal_entry_import" | "expense_posting" | string;
  status: "pending" | "processing" | "completed" | "completed_with_errors" | "failed";
  total_items: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

interface BatchItem {
  id: number;
  item_data: Record<string, unknown>;
  status: "pending" | "success" | "completed" | "error" | "failed";
  error_message?: string;
}

export default function BatchProcessingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Dialogs
  const [createDialog, setCreateDialog] = useState(false);
  const [itemsDialog, setItemsDialog] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [deleteBatchId, setDeleteBatchId] = useState<number | null>(null);
  const [executeBatchId, setExecuteBatchId] = useState<number | null>(null);
  const [executeBatchType, setExecuteBatchType] = useState<string>("");

  // Selected batch for items view
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Form
  const [batchName, setBatchName] = useState("");
  const [batchType, setBatchType] = useState("");
  const [batchDescription, setBatchDescription] = useState("");

  const itemsPerPage = 20;

  const loadBatches = useCallback(async (page: number = 1) => {
    try {
      setIsLoading(true);
      const response = await fetchAPI(`batch?page=${page}&limit=${itemsPerPage}`);
      if (response.success && response.data) {
        setBatches(response.data as Batch[]);
        const total = Number(response.total) || 0;
        setTotalPages(Math.ceil(total / itemsPerPage));
        setCurrentPage(page);
      } else {
        showToast(response.message || "فشل تحميل الدفعات", "error");
      }
    } catch {
      showToast("خطأ في الاتصال بالسيرفر", "error");
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
      await loadBatches();

      // Auto-refresh every 60 seconds
      const interval = setInterval(() => {
        loadBatches(currentPage);
      }, 30000);

      return () => clearInterval(interval);
    };
    init();
  }, [loadBatches, currentPage]);

  const getBatchTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      journal_entry_import: "استيراد قيود يومية",
      expense_posting: "ترحيل مصروفات",
    };
    return types[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { class: string; text: string }> = {
      pending: { class: "badge-secondary", text: "معلقة" },
      processing: { class: "badge-info", text: "قيد المعالجة" },
      completed: { class: "badge-success", text: "مكتملة" },
      completed_with_errors: { class: "badge-warning", text: "مكتملة مع أخطاء" },
      failed: { class: "badge-danger", text: "فشلت" },
    };

    const statusLower = status?.toLowerCase() || "pending";
    const statusInfo = statusMap[statusLower] || { class: "badge-secondary", text: status };

    return <span className={`badge ${statusInfo.class}`}>{statusInfo.text}</span>;
  };

  const openCreateDialog = () => {
    setBatchName("");
    setBatchType("");
    setBatchDescription("");
    setCreateDialog(true);
  };

  const closeCreateDialog = () => {
    setCreateDialog(false);
  };

  const closeItemsDialog = () => {
    setItemsDialog(false);
    setSelectedBatchId(null);
    setBatchItems([]);
  };

  const createBatch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!batchName || !batchType) {
      showToast("يرجى إدخال اسم الدفعة ونوعها", "error");
      return;
    }

    try {
      const response = await fetchAPI("batch", {
        method: "POST",
        body: JSON.stringify({
          batch_name: batchName,
          batch_type: batchType,
          description: batchDescription,
        }),
      });

      if (response.success && response.data) {
        const data = response.data as Batch;
        showToast("تم إنشاء الدفعة بنجاح. يمكنك الآن إضافة العناصر.", "success");
        setCreateDialog(false);
        await loadBatches(1);

        // Optionally open items modal
        if (data?.id) {
          setTimeout(() => {
            viewBatchItems(data.id);
          }, 500);
        }
      } else {
        showToast(response.message || "فشل إنشاء الدفعة", "error");
      }
    } catch {
      showToast("خطأ في إنشاء الدفعة", "error");
    }
  };

  const viewBatchItems = async (batchId: number) => {
    setSelectedBatchId(batchId);
    setIsLoadingItems(true);
    setItemsDialog(true);

    try {
      const response = await fetchAPI(`batch?action=status&batch_id=${batchId}`);
      if (response.success && response.data) {
        const items = (response.data as { items?: BatchItem[] }).items || [];
        setBatchItems(items);
      } else {
        showToast(response.message || "فشل تحميل العناصر", "error");
        setItemsDialog(false);
      }
    } catch {
      showToast("خطأ في تحميل العناصر", "error");
      setItemsDialog(false);
    } finally {
      setIsLoadingItems(false);
    }
  };

  const confirmExecuteBatch = (batchId: number, batchType: string) => {
    setExecuteBatchId(batchId);
    setExecuteBatchType(batchType);
    setConfirmDialog(true);
  };

  const executeBatch = async () => {
    if (!executeBatchId) return;

    try {
      const action = executeBatchType === "journal_entry_import" ? "journal_entries" : "expenses";
      const response = await fetchAPI(`batch?action=${action}`, {
        method: "POST",
        body: JSON.stringify({ batch_id: executeBatchId }),
      });

      if (response.success) {
        showToast("تم تنفيذ الدفعة بنجاح", "success");
        setConfirmDialog(false);
        setExecuteBatchId(null);
        await loadBatches(currentPage);
      } else {
        showToast(response.message || "فشل تنفيذ الدفعة", "error");
      }
    } catch {
      showToast("خطأ في تنفيذ الدفعة", "error");
    }
  };

  const confirmDeleteBatch = (batchId: number) => {
    setDeleteBatchId(batchId);
    setConfirmDialog(true);
  };

  const deleteBatch = async () => {
    if (!deleteBatchId) return;

    try {
      const response = await fetchAPI(`batch?id=${deleteBatchId}`, { method: "DELETE" });

      if (response.success) {
        showToast("تم حذف الدفعة بنجاح", "success");
        setConfirmDialog(false);
        setDeleteBatchId(null);
        await loadBatches(currentPage);
      } else {
        showToast(response.message || "فشل حذف الدفعة", "error");
      }
    } catch {
      showToast("خطأ في حذف الدفعة", "error");
    }
  };

  const handleConfirm = () => {
    if (deleteBatchId) {
      deleteBatch();
    } else if (executeBatchId) {
      executeBatch();
    }
  };

  const getItemStatusBadge = (status: string) => {
    const statusMap: Record<string, { class: string; text: string }> = {
      pending: { class: "badge-secondary", text: "معلقة" },
      success: { class: "badge-success", text: "مكتملة" },
      completed: { class: "badge-success", text: "مكتملة" },
      error: { class: "badge-danger", text: "فشلت" },
      failed: { class: "badge-danger", text: "فشلت" },
    };

    const statusLower = status?.toLowerCase() || "pending";
    const statusInfo = statusMap[statusLower] || { class: "badge-secondary", text: status };

    return <span className={`badge ${statusInfo.class}`}>{statusInfo.text}</span>;
  };

  const columns: Column<Batch>[] = [
    {
      key: "batch_name",
      header: "اسم الدفعة",
      dataLabel: "اسم الدفعة",
      render: (item) => <strong>{item.batch_name}</strong>,
    },
    {
      key: "batch_type",
      header: "نوع الدفعة",
      dataLabel: "نوع الدفعة",
      render: (item) => getBatchTypeLabel(item.batch_type),
    },
    {
      key: "status",
      header: "الحالة",
      dataLabel: "الحالة",
      render: (item) => getStatusBadge(item.status),
    },
    {
      key: "total_items",
      header: "عدد العناصر",
      dataLabel: "عدد العناصر",
      render: (item) => item.total_items || 0,
    },
    {
      key: "created_at",
      header: "تاريخ الإنشاء",
      dataLabel: "تاريخ الإنشاء",
      render: (item) => formatDate(item.created_at),
    },
    {
      key: "started_at",
      header: "تاريخ البدء",
      dataLabel: "تاريخ البدء",
      render: (item) => item.started_at ? formatDate(item.started_at) : "-",
    },
    {
      key: "completed_at",
      header: "تاريخ الاكتمال",
      dataLabel: "تاريخ الاكتمال",
      render: (item) => item.completed_at ? formatDate(item.completed_at) : "-",
    },
    {
      key: "actions",
      header: "الإجراءات",
      dataLabel: "الإجراءات",
      render: (item) => {
        const isPending = item.status?.toLowerCase() === "pending";
        return (
          <div className="action-buttons">
            <button
              className="icon-btn view"
              onClick={() => viewBatchItems(item.id)}
              title="عرض العناصر"
            >
              {getIcon("eye")}
            </button>
            {isPending && (
              <>
                <button
                  className="icon-btn edit"
                  onClick={() => confirmExecuteBatch(item.id, item.batch_type)}
                  title="تنفيذ"
                >
                  {getIcon("check")}
                </button>
                <button
                  className="icon-btn delete"
                  onClick={() => confirmDeleteBatch(item.id)}
                  title="حذف"
                >
                  {getIcon("trash")}
                </button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  const itemColumns: Column<BatchItem>[] = [
    {
      key: "id",
      header: "#",
      dataLabel: "#",
      render: (item, index) => index + 1,
    },
    {
      key: "item_data",
      header: "بيانات العنصر",
      dataLabel: "بيانات العنصر",
      render: (item) => {
        const dataStr = JSON.stringify(item.item_data || {}, null, 2);
        const truncated = dataStr.length > 100 ? dataStr.substring(0, 100) + "..." : dataStr;
        return (
          <span title={dataStr} style={{ maxWidth: "300px", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {truncated}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "الحالة",
      dataLabel: "الحالة",
      render: (item) => getItemStatusBadge(item.status),
    },
    {
      key: "error_message",
      header: "رسالة الخطأ",
      dataLabel: "رسالة الخطأ",
      render: (item) => item.error_message || "-",
    },
  ];

  return (
    <MainLayout requiredModule="batch_processing">
      <PageHeader
        title="المعالجة الدفعية"
        user={user}
        showDate={true}
        actions={
          <button className="btn btn-primary" onClick={openCreateDialog}>
            {getIcon("plus")}
            دفعة جديدة
          </button>
        }
      />

      <div className="sales-card animate-fade">
        <Table
          columns={columns}
          data={batches}
          keyExtractor={(item) => item.id}
          emptyMessage="لا توجد دفعات"
          isLoading={isLoading}
          pagination={{
            currentPage,
            totalPages,
            onPageChange: loadBatches,
          }}
        />
      </div>

      {/* Create Batch Dialog */}
      <Dialog
        isOpen={createDialog}
        onClose={closeCreateDialog}
        title="إنشاء دفعة جديدة"
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeCreateDialog}>
              إلغاء
            </button>
            <button className="btn btn-primary" onClick={createBatch}>
              إنشاء
            </button>
          </>
        }
      >
        <form onSubmit={createBatch}>
          <div className="form-group">
            <label htmlFor="batch-name">اسم الدفعة *</label>
            <input
              type="text"
              id="batch-name"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="batch-type">نوع الدفعة *</label>
            <select
              id="batch-type"
              value={batchType}
              onChange={(e) => setBatchType(e.target.value)}
              required
            >
              <option value="">اختر نوع الدفعة</option>
              <option value="journal_entry_import">استيراد قيود يومية</option>
              <option value="expense_posting">ترحيل مصروفات</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="batch-description">الوصف</label>
            <textarea
              id="batch-description"
              value={batchDescription}
              onChange={(e) => setBatchDescription(e.target.value)}
              rows={3}
            />
          </div>
        </form>
      </Dialog>

      {/* View Items Dialog */}
      <Dialog
        isOpen={itemsDialog}
        onClose={closeItemsDialog}
        title="عناصر الدفعة"
        maxWidth="900px"
      >
        {isLoadingItems ? (
          <div style={{ textAlign: "center", padding: "3rem" }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: "2rem" }}></i>
            <p style={{ marginTop: "1rem" }}>جاري التحميل...</p>
          </div>
        ) : batchItems.length === 0 ? (
          <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
            لا توجد عناصر
          </p>
        ) : (
          <Table
            columns={itemColumns}
            data={batchItems}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            emptyMessage="لا توجد عناصر"
          />
        )}
      </Dialog>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog}
        onClose={() => {
            setConfirmDialog(false);
            setDeleteBatchId(null);
            setExecuteBatchId(null);
        }}
        onConfirm={handleConfirm}
        title="تأكيد"
        message={
            deleteBatchId 
                ? "هل أنت متأكد من حذف هذه الدفعة؟" 
                : "هل أنت متأكد من تنفيذ هذه الدفعة؟"
        }
        confirmText={deleteBatchId ? "حذف" : "تنفيذ"}
        confirmVariant={deleteBatchId ? "danger" : "primary"}
      />
    </MainLayout>
  );
}
