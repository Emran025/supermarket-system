"use client";

import { useState, useEffect, useCallback } from "react";
import { MainLayout, PageHeader } from "@/components/layout";
import { Table, Dialog, ConfirmDialog, showToast, Column } from "@/components/ui";
import { fetchAPI } from "@/lib/api";
import { formatCurrency, formatDate, translateExpenseCategory } from "@/lib/utils";
import { User, getStoredUser, getStoredPermissions, Permission, canAccess } from "@/lib/auth";
import { getIcon } from "@/lib/icons";

interface Expense {
  id: number;
  category: string;
  amount: number;
  expense_date: string;
  description?: string;
  created_at: string;
}

const expenseCategories = [
  { value: "rent", label: "إيجار" },
  { value: "utilities", label: "مرافق" },
  { value: "salaries", label: "رواتب" },
  { value: "maintenance", label: "صيانة" },
  { value: "supplies", label: "مستلزمات" },
  { value: "marketing", label: "تسويق" },
  { value: "transport", label: "نقل" },
  { value: "other", label: "أخرى" },
];

export default function ExpensesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Dialogs
  const [formDialog, setFormDialog] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Form
  const [formData, setFormData] = useState({
    category: "other",
    amount: "",
    expense_date: new Date().toISOString().split("T")[0],
    description: "",
  });

  const itemsPerPage = 10;

  const loadExpenses = useCallback(async (page: number = 1, search: string = "") => {
    try {
      setIsLoading(true);
      const response = await fetchAPI(
        `/api/expenses?page=${page}&limit=${itemsPerPage}&search=${encodeURIComponent(search)}`
      );
      setExpenses(response.expenses as Expense[] || []);
      setTotalPages(Math.ceil((response.total as number || 0) / itemsPerPage));
      setCurrentPage(page);
    } catch {
      showToast("خطأ في تحميل المصروفات", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedUser = getStoredUser();
    const storedPermissions = getStoredPermissions();
    setUser(storedUser);
    setPermissions(storedPermissions);
    loadExpenses();
  }, [loadExpenses]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    loadExpenses(1, value);
  };

  const openAddDialog = () => {
    setSelectedExpense(null);
    setFormData({
      category: "other",
      amount: "",
      expense_date: new Date().toISOString().split("T")[0],
      description: "",
    });
    setFormDialog(true);
  };

  const openEditDialog = (expense: Expense) => {
    setSelectedExpense(expense);
    setFormData({
      category: expense.category,
      amount: String(expense.amount),
      expense_date: expense.expense_date.split("T")[0],
      description: expense.description || "",
    });
    setFormDialog(true);
  };

  const handleSubmit = async () => {
    if (!formData.amount) {
      showToast("يرجى إدخال المبلغ", "error");
      return;
    }

    const payload = {
      category: formData.category,
      amount: parseFloat(formData.amount),
      expense_date: formData.expense_date,
      description: formData.description,
    };

    try {
      if (selectedExpense) {
        await fetchAPI(`/api/expenses/${selectedExpense.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        showToast("تم تحديث المصروف بنجاح", "success");
      } else {
        await fetchAPI("/api/expenses", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        showToast("تمت إضافة المصروف بنجاح", "success");
      }
      setFormDialog(false);
      loadExpenses(currentPage, searchTerm);
    } catch {
      showToast("خطأ في حفظ المصروف", "error");
    }
  };

  const confirmDelete = (id: number) => {
    setDeleteId(id);
    setConfirmDialog(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await fetchAPI(`/api/expenses/${deleteId}`, { method: "DELETE" });
      showToast("تم حذف المصروف", "success");
      loadExpenses(currentPage, searchTerm);
    } catch {
      showToast("خطأ في حذف المصروف", "error");
    }
  };

  const columns: Column<Expense>[] = [
    {
      key: "category",
      header: "الفئة",
      dataLabel: "الفئة",
      render: (item) => (
        <span className="badge badge-secondary">{translateExpenseCategory(item.category)}</span>
      ),
    },
    {
      key: "amount",
      header: "المبلغ",
      dataLabel: "المبلغ",
      render: (item) => <span className="text-danger">{formatCurrency(item.amount)}</span>,
    },
    {
      key: "expense_date",
      header: "التاريخ",
      dataLabel: "التاريخ",
      render: (item) => formatDate(item.expense_date),
    },
    {
      key: "description",
      header: "الوصف",
      dataLabel: "الوصف",
      render: (item) => item.description || "-",
    },
    {
      key: "actions",
      header: "الإجراءات",
      dataLabel: "الإجراءات",
      render: (item) => (
        <div className="action-buttons">
          {canAccess(permissions, "expenses", "edit") && (
            <button className="icon-btn edit" onClick={() => openEditDialog(item)} title="تعديل">
              {getIcon("edit")}
            </button>
          )}
          {canAccess(permissions, "expenses", "delete") && (
            <button className="icon-btn delete" onClick={() => confirmDelete(item.id)} title="حذف">
              {getIcon("trash")}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout requiredModule="expenses">
      <PageHeader
        title="المصروفات"
        user={user}
        searchInput={
          <input
            type="text"
            placeholder="بحث..."
            value={searchTerm}
            onChange={handleSearch}
            style={{ width: "200px" }}
          />
        }
        actions={
          canAccess(permissions, "expenses", "create") && (
            <button className="btn btn-primary" onClick={openAddDialog}>
              {getIcon("plus")}
              إضافة مصروف
            </button>
          )
        }
      />

      <div className="sales-card animate-fade">
        <Table
          columns={columns}
          data={expenses}
          keyExtractor={(item) => item.id}
          emptyMessage="لا توجد مصروفات"
          isLoading={isLoading}
          pagination={{
            currentPage,
            totalPages,
            onPageChange: (page) => loadExpenses(page, searchTerm),
          }}
        />
      </div>

      {/* Form Dialog */}
      <Dialog
        isOpen={formDialog}
        onClose={() => setFormDialog(false)}
        title={selectedExpense ? "تعديل المصروف" : "إضافة مصروف جديد"}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setFormDialog(false)}>
              إلغاء
            </button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              {selectedExpense ? "تحديث" : "إضافة"}
            </button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="category">الفئة</label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            >
              {expenseCategories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="amount">المبلغ *</label>
            <input
              type="number"
              id="amount"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              min="0"
              step="0.01"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="expense_date">التاريخ</label>
          <input
            type="date"
            id="expense_date"
            value={formData.expense_date}
            onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">الوصف</label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
        </div>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog}
        onClose={() => setConfirmDialog(false)}
        onConfirm={handleDelete}
        title="تأكيد الحذف"
        message="هل أنت متأكد من حذف هذا المصروف؟"
        confirmText="حذف"
        confirmVariant="danger"
      />
    </MainLayout>
  );
}

