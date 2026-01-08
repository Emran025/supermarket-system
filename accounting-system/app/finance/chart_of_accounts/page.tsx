"use client";

import { useState, useEffect, useCallback } from "react";
import { MainLayout, PageHeader } from "@/components/layout";
import { Table, Dialog, ConfirmDialog, showToast, Column } from "@/components/ui";
import { fetchAPI } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { User, getStoredUser, getStoredPermissions, Permission, canAccess } from "@/lib/auth";
import { getIcon } from "@/lib/icons";

interface Account {
  id: number;
  code: string;
  name: string;
  type: string;
  parent_id?: number;
  parent_name?: string;
  balance: number;
  is_active: boolean;
  description?: string;
}

const accountTypes = [
  { value: "asset", label: "أصول" },
  { value: "liability", label: "خصوم" },
  { value: "equity", label: "حقوق ملكية" },
  { value: "revenue", label: "إيرادات" },
  { value: "expense", label: "مصروفات" },
];

export default function ChartOfAccountsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Dialogs
  const [formDialog, setFormDialog] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Form
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "asset",
    parent_id: "",
    description: "",
    is_active: true,
  });

  const loadAccounts = useCallback(async (search: string = "") => {
    try {
      setIsLoading(true);
      const response = await fetchAPI(`/api/accounts?search=${encodeURIComponent(search)}`);
      setAccounts(response.accounts as Account[] || []);
    } catch {
      showToast("خطأ في تحميل الحسابات", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedUser = getStoredUser();
    const storedPermissions = getStoredPermissions();
    setUser(storedUser);
    setPermissions(storedPermissions);
    loadAccounts();
  }, [loadAccounts]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    loadAccounts(value);
  };

  const openAddDialog = () => {
    setSelectedAccount(null);
    setFormData({
      code: "",
      name: "",
      type: "asset",
      parent_id: "",
      description: "",
      is_active: true,
    });
    setFormDialog(true);
  };

  const openEditDialog = (account: Account) => {
    setSelectedAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      type: account.type,
      parent_id: account.parent_id ? String(account.parent_id) : "",
      description: account.description || "",
      is_active: account.is_active,
    });
    setFormDialog(true);
  };

  const handleSubmit = async () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      showToast("يرجى ملء جميع الحقول المطلوبة", "error");
      return;
    }

    const payload = {
      code: formData.code,
      name: formData.name,
      type: formData.type,
      parent_id: formData.parent_id ? parseInt(formData.parent_id) : null,
      description: formData.description,
      is_active: formData.is_active,
    };

    try {
      if (selectedAccount) {
        await fetchAPI(`/api/accounts/${selectedAccount.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        showToast("تم تحديث الحساب بنجاح", "success");
      } else {
        await fetchAPI("/api/accounts", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        showToast("تمت إضافة الحساب بنجاح", "success");
      }
      setFormDialog(false);
      loadAccounts(searchTerm);
    } catch {
      showToast("خطأ في حفظ الحساب", "error");
    }
  };

  const confirmDelete = (id: number) => {
    setDeleteId(id);
    setConfirmDialog(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await fetchAPI(`/api/accounts/${deleteId}`, { method: "DELETE" });
      showToast("تم حذف الحساب", "success");
      loadAccounts(searchTerm);
    } catch {
      showToast("خطأ في حذف الحساب", "error");
    }
  };

  const getTypeLabel = (type: string) => {
    const found = accountTypes.find((t) => t.value === type);
    return found?.label || type;
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case "asset":
        return "badge-primary";
      case "liability":
        return "badge-danger";
      case "equity":
        return "badge-info";
      case "revenue":
        return "badge-success";
      case "expense":
        return "badge-warning";
      default:
        return "badge-secondary";
    }
  };

  const columns: Column<Account>[] = [
    { key: "code", header: "رقم الحساب", dataLabel: "رقم الحساب" },
    { key: "name", header: "اسم الحساب", dataLabel: "اسم الحساب" },
    {
      key: "type",
      header: "النوع",
      dataLabel: "النوع",
      render: (item) => (
        <span className={`badge ${getTypeBadgeClass(item.type)}`}>
          {getTypeLabel(item.type)}
        </span>
      ),
    },
    {
      key: "parent_name",
      header: "الحساب الرئيسي",
      dataLabel: "الحساب الرئيسي",
      render: (item) => item.parent_name || "-",
    },
    {
      key: "balance",
      header: "الرصيد",
      dataLabel: "الرصيد",
      render: (item) => (
        <span className={item.balance >= 0 ? "text-success" : "text-danger"}>
          {formatCurrency(Math.abs(item.balance))}
        </span>
      ),
    },
    {
      key: "is_active",
      header: "الحالة",
      dataLabel: "الحالة",
      render: (item) => (
        <span className={`badge ${item.is_active ? "badge-success" : "badge-secondary"}`}>
          {item.is_active ? "نشط" : "غير نشط"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "الإجراءات",
      dataLabel: "الإجراءات",
      render: (item) => (
        <div className="action-buttons">
          {canAccess(permissions, "chart_of_accounts", "edit") && (
            <button className="icon-btn edit" onClick={() => openEditDialog(item)} title="تعديل">
              {getIcon("edit")}
            </button>
          )}
          {canAccess(permissions, "chart_of_accounts", "delete") && (
            <button className="icon-btn delete" onClick={() => confirmDelete(item.id)} title="حذف">
              {getIcon("trash")}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout requiredModule="chart_of_accounts">
      <PageHeader
        title="دليل الحسابات"
        user={user}
        searchInput={
          <input
            type="text"
            placeholder="بحث بالرقم أو الاسم..."
            value={searchTerm}
            onChange={handleSearch}
            style={{ width: "250px" }}
          />
        }
        actions={
          canAccess(permissions, "chart_of_accounts", "create") && (
            <button className="btn btn-primary" onClick={openAddDialog}>
              {getIcon("plus")}
              إضافة حساب
            </button>
          )
        }
      />

      <div className="sales-card animate-fade">
        <Table
          columns={columns}
          data={accounts}
          keyExtractor={(item) => item.id}
          emptyMessage="لا توجد حسابات"
          isLoading={isLoading}
        />
      </div>

      {/* Form Dialog */}
      <Dialog
        isOpen={formDialog}
        onClose={() => setFormDialog(false)}
        title={selectedAccount ? "تعديل الحساب" : "إضافة حساب جديد"}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setFormDialog(false)}>
              إلغاء
            </button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              {selectedAccount ? "تحديث" : "إضافة"}
            </button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="code">رقم الحساب *</label>
            <input
              type="text"
              id="code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="type">النوع *</label>
            <select
              id="type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              {accountTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="name">اسم الحساب *</label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label htmlFor="parent_id">الحساب الرئيسي</label>
          <select
            id="parent_id"
            value={formData.parent_id}
            onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
          >
            <option value="">بدون حساب رئيسي</option>
            {accounts
              .filter((acc) => acc.id !== selectedAccount?.id)
              .map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} - {acc.name}
                </option>
              ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="description">الوصف</label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={2}
          />
        </div>

        <div className="form-group">
          <div className="checkbox-group">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
            />
            <label htmlFor="is_active">نشط</label>
          </div>
        </div>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog}
        onClose={() => setConfirmDialog(false)}
        onConfirm={handleDelete}
        title="تأكيد الحذف"
        message="هل أنت متأكد من حذف هذا الحساب؟"
        confirmText="حذف"
        confirmVariant="danger"
      />
    </MainLayout>
  );
}

