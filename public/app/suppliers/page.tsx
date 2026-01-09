"use client";

import { useState, useEffect, useCallback } from "react";
import { MainLayout, PageHeader } from "@/components/layout";
import { Table, Dialog, ConfirmDialog, showToast, Column } from "@/components/ui";
import { fetchAPI } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { User, getStoredUser, getStoredPermissions, Permission, canAccess } from "@/lib/auth";
import { Icon } from "@/lib/icons";

interface Supplier {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  tax_number?: string;
  credit_limit: number;
  payment_terms: number;
  current_balance: number;
  created_at: string;
}

export default function SuppliersPage() {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Dialogs
  const [formDialog, setFormDialog] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Form
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    tax_number: "",
    credit_limit: "0",
    payment_terms: "30",
  });

  const itemsPerPage = 10;

  const loadSuppliers = useCallback(async (page: number = 1, search: string = "") => {
    try {
      setIsLoading(true);
      // Using ap_suppliers action from api.php
      const response = await fetchAPI(
        `ap_suppliers?page=${page}&limit=${itemsPerPage}&search=${encodeURIComponent(search)}`
      );
      setSuppliers(response.data as Supplier[] || []);
      setTotalPages((response.pagination as any)?.total_pages || 1);
      setCurrentPage(page);
    } catch {
      showToast("خطأ في تحميل الموردين", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedUser = getStoredUser();
    const storedPermissions = getStoredPermissions();
    setUser(storedUser);
    setPermissions(storedPermissions);
    loadSuppliers();
  }, [loadSuppliers]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    loadSuppliers(1, value);
  };

  const openAddDialog = () => {
    setSelectedSupplier(null);
    setFormData({
      name: "",
      phone: "",
      email: "",
      address: "",
      tax_number: "",
      credit_limit: "0",
      payment_terms: "30",
    });
    setFormDialog(true);
  };

  const openEditDialog = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setFormData({
      name: supplier.name,
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      tax_number: supplier.tax_number || "",
      credit_limit: String(supplier.credit_limit),
      payment_terms: String(supplier.payment_terms),
    });
    setFormDialog(true);
  };

  const openViewDialog = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setViewDialog(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      showToast("يرجى إدخال اسم المورد", "error");
      return;
    }

    try {
      if (selectedSupplier) {
        await fetchAPI(`ap_suppliers`, {
          method: "PUT",
          body: JSON.stringify({ ...formData, id: selectedSupplier.id }),
        });
        showToast("تم تحديث المورد بنجاح", "success");
      } else {
        await fetchAPI("ap_suppliers", {
          method: "POST",
          body: JSON.stringify(formData),
        });
        showToast("تمت إضافة المورد بنجاح", "success");
      }
      setFormDialog(false);
      loadSuppliers(currentPage, searchTerm);
    } catch (error) {
      showToast("خطأ في حفظ المورد", "error");
    }
  };

  const confirmDelete = (id: number) => {
    setDeleteId(id);
    setConfirmDialog(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await fetchAPI(`ap_suppliers&id=${deleteId}`, { method: "DELETE" });
      showToast("تم حذف المورد", "success");
      loadSuppliers(currentPage, searchTerm);
    } catch {
      showToast("خطأ في حذف المورد", "error");
    }
  };

  const columns: Column<Supplier>[] = [
    { key: "name", header: "اسم المورد", dataLabel: "اسم المورد" },
    { key: "phone", header: "الهاتف", dataLabel: "الهاتف" },
    {
      key: "current_balance",
      header: "الرصيد المستحق",
      dataLabel: "الرصيد المستحق",
      render: (item) => (
        <span className={item.current_balance > 0 ? "text-danger" : "text-success"}>
          {formatCurrency(item.current_balance)}
        </span>
      ),
    },
    {
      key: "payment_terms",
      header: "شروط الدفع (يوم)",
      dataLabel: "شروط الدفع",
    },
    {
      key: "actions",
      header: "الإجراءات",
      dataLabel: "الإجراءات",
      render: (item) => (
        <div className="action-buttons">
          <button className="icon-btn view" onClick={() => openViewDialog(item)} title="عرض">
            <Icon name="eye" />
          </button>
          {canAccess(permissions, "ap_suppliers", "edit") && (
            <button className="icon-btn edit" onClick={() => openEditDialog(item)} title="تعديل">
              <Icon name="edit" />
            </button>
          )}
          {canAccess(permissions, "ap_suppliers", "delete") && (
            <button className="icon-btn delete" onClick={() => confirmDelete(item.id)} title="حذف">
              <Icon name="trash" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout requiredModule="ap_suppliers">
      <PageHeader
        title="إدارة الموردين (المدفوعات)"
        user={user}
        searchInput={
          <input
            type="text"
            placeholder="بحث بالاسم أو الهاتف..."
            value={searchTerm}
            onChange={handleSearch}
            className="search-input"
            style={{ width: "250px" }}
          />
        }
        actions={
          canAccess(permissions, "ap_suppliers", "create") && (
            <button className="btn btn-primary" onClick={openAddDialog}>
              <Icon name="plus" />
              إضافة مورد
            </button>
          )
        }
      />

      <div className="sales-card animate-fade">
        <Table
          columns={columns}
          data={suppliers}
          keyExtractor={(item) => item.id}
          emptyMessage="لا يوجد موردين"
          isLoading={isLoading}
          pagination={{
            currentPage,
            totalPages,
            onPageChange: (page) => loadSuppliers(page, searchTerm),
          }}
        />
      </div>

      {/* Form Dialog */}
      <Dialog
        isOpen={formDialog}
        onClose={() => setFormDialog(false)}
        title={selectedSupplier ? "تعديل المورد" : "إضافة مورد جديد"}
        footer={
          <div className="flex gap-2 justify-end">
            <button className="btn btn-secondary" onClick={() => setFormDialog(false)}>
              إلغاء
            </button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              {selectedSupplier ? "تحديث" : "إضافة"}
            </button>
          </div>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div className="form-group" style={{ gridColumn: "span 2" }}>
            <label>اسم المورد *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>رقم الهاتف</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>البريد الإلكتروني</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>الحد الائتماني</label>
            <input
              type="number"
              value={formData.credit_limit}
              onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>شروط الدفع (بالأيام)</label>
            <input
              type="number"
              value={formData.payment_terms}
              onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ gridColumn: "span 2" }}>
            <label>الرقم الضريبي</label>
            <input
              type="text"
              value={formData.tax_number}
              onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ gridColumn: "span 2" }}>
            <label>العنوان</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={2}
            />
          </div>
        </div>
      </Dialog>

      {/* View Dialog */}
      <Dialog
        isOpen={viewDialog}
        onClose={() => setViewDialog(false)}
        title="تفاصيل المورد"
        maxWidth="600px"
      >
        {selectedSupplier && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "2rem" }}>
              <div>
                <p className="stat-label">اسم المورد</p>
                <p style={{ fontWeight: 700, fontSize: "1.1rem" }}>{selectedSupplier.name}</p>
              </div>
              <div>
                <p className="stat-label">الهاتف</p>
                <p>{selectedSupplier.phone || "-"}</p>
              </div>
              <div>
                <p className="stat-label">البريد الإلكتروني</p>
                <p>{selectedSupplier.email || "-"}</p>
              </div>
              <div>
                <p className="stat-label">الرقم الضريبي</p>
                <p>{selectedSupplier.tax_number || "-"}</p>
              </div>
              <div>
                <p className="stat-label">الحد الائتماني</p>
                <p>{formatCurrency(selectedSupplier.credit_limit)}</p>
              </div>
              <div>
                <p className="stat-label">شروط الدفع</p>
                <p>{selectedSupplier.payment_terms} يوم</p>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <p className="stat-label">العنوان</p>
                <p>{selectedSupplier.address || "-"}</p>
              </div>
            </div>

            <div className="summary-stat-box" style={{ background: "var(--primary-subtle)", borderStyle: "solid" }}>
              <div className="stat-item">
                <span className="stat-label">الرصيد المستحق الحالي</span>
                <span className={`stat-value ${selectedSupplier.current_balance > 0 ? "text-danger" : "text-success"}`} style={{ fontSize: "1.5rem" }}>
                  {formatCurrency(selectedSupplier.current_balance)}
                </span>
              </div>
              <button 
                className="btn btn-primary"
                onClick={() => window.location.href = `/finance/ap_ledger?supplier_id=${selectedSupplier.id}`}
              >
                عرض الدفتر والمدفوعات
              </button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog}
        onClose={() => setConfirmDialog(false)}
        onConfirm={handleDelete}
        title="تأكيد الحذف"
        message="هل أنت متأكد من حذف هذا المورد؟ لا يمكن تراجع عن هذا الإجراء إذا كان هناك معاملات مرتبطة."
        confirmText="حذف"
        confirmVariant="danger"
      />
    </MainLayout>
  );
}
