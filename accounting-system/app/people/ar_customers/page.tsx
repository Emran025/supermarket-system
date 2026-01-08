"use client";

import { useState, useEffect, useCallback } from "react";
import { MainLayout, PageHeader } from "@/components/layout";
import { Table, Dialog, ConfirmDialog, showToast, Column } from "@/components/ui";
import { fetchAPI } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { User, getStoredUser, getStoredPermissions, Permission, canAccess } from "@/lib/auth";
import { getIcon } from "@/lib/icons";

interface Customer {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  total_debt: number;
  total_paid: number;
  balance: number;
  created_at: string;
}

export default function ARCustomersPage() {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Dialogs
  const [formDialog, setFormDialog] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Form
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
  });

  const itemsPerPage = 10;

  const loadCustomers = useCallback(async (page: number = 1, search: string = "") => {
    try {
      setIsLoading(true);
      const response = await fetchAPI(
        `/api/customers?page=${page}&limit=${itemsPerPage}&search=${encodeURIComponent(search)}`
      );
      setCustomers(response.customers as Customer[] || []);
      setTotalPages(Math.ceil((response.total as number || 0) / itemsPerPage));
      setCurrentPage(page);
    } catch {
      showToast("خطأ في تحميل العملاء", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedUser = getStoredUser();
    const storedPermissions = getStoredPermissions();
    setUser(storedUser);
    setPermissions(storedPermissions);
    loadCustomers();
  }, [loadCustomers]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    loadCustomers(1, value);
  };

  const openAddDialog = () => {
    setSelectedCustomer(null);
    setFormData({
      name: "",
      phone: "",
      address: "",
    });
    setFormDialog(true);
  };

  const openEditDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || "",
      address: customer.address || "",
    });
    setFormDialog(true);
  };

  const openViewDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setViewDialog(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      showToast("يرجى إدخال اسم العميل", "error");
      return;
    }

    try {
      if (selectedCustomer) {
        await fetchAPI(`/api/customers/${selectedCustomer.id}`, {
          method: "PUT",
          body: JSON.stringify(formData),
        });
        showToast("تم تحديث العميل بنجاح", "success");
      } else {
        await fetchAPI("/api/customers", {
          method: "POST",
          body: JSON.stringify(formData),
        });
        showToast("تمت إضافة العميل بنجاح", "success");
      }
      setFormDialog(false);
      loadCustomers(currentPage, searchTerm);
    } catch {
      showToast("خطأ في حفظ العميل", "error");
    }
  };

  const confirmDelete = (id: number) => {
    setDeleteId(id);
    setConfirmDialog(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await fetchAPI(`/api/customers/${deleteId}`, { method: "DELETE" });
      showToast("تم حذف العميل", "success");
      loadCustomers(currentPage, searchTerm);
    } catch {
      showToast("خطأ في حذف العميل", "error");
    }
  };

  const columns: Column<Customer>[] = [
    { key: "name", header: "اسم العميل", dataLabel: "اسم العميل" },
    { key: "phone", header: "الهاتف", dataLabel: "الهاتف" },
    {
      key: "total_debt",
      header: "إجمالي الدين",
      dataLabel: "إجمالي الدين",
      render: (item) => formatCurrency(item.total_debt),
    },
    {
      key: "total_paid",
      header: "إجمالي المدفوع",
      dataLabel: "إجمالي المدفوع",
      render: (item) => <span className="text-success">{formatCurrency(item.total_paid)}</span>,
    },
    {
      key: "balance",
      header: "الرصيد المتبقي",
      dataLabel: "الرصيد المتبقي",
      render: (item) => (
        <span className={item.balance > 0 ? "text-danger" : "text-success"}>
          {formatCurrency(item.balance)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "الإجراءات",
      dataLabel: "الإجراءات",
      render: (item) => (
        <div className="action-buttons">
          <button className="icon-btn view" onClick={() => openViewDialog(item)} title="عرض">
            {getIcon("eye")}
          </button>
          {canAccess(permissions, "ar_customers", "edit") && (
            <button className="icon-btn edit" onClick={() => openEditDialog(item)} title="تعديل">
              {getIcon("edit")}
            </button>
          )}
          {canAccess(permissions, "ar_customers", "delete") && (
            <button className="icon-btn delete" onClick={() => confirmDelete(item.id)} title="حذف">
              {getIcon("trash")}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout requiredModule="ar_customers">
      <PageHeader
        title="عملاء الآجل"
        user={user}
        searchInput={
          <input
            type="text"
            placeholder="بحث بالاسم أو الهاتف..."
            value={searchTerm}
            onChange={handleSearch}
            style={{ width: "250px" }}
          />
        }
        actions={
          canAccess(permissions, "ar_customers", "create") && (
            <button className="btn btn-primary" onClick={openAddDialog}>
              {getIcon("plus")}
              إضافة عميل
            </button>
          )
        }
      />

      <div className="sales-card animate-fade">
        <Table
          columns={columns}
          data={customers as Customer[]}
          keyExtractor={(item) => item.id}
          emptyMessage="لا يوجد عملاء"
          isLoading={isLoading}
          pagination={{
            currentPage,
            totalPages,
            onPageChange: (page) => loadCustomers(page, searchTerm),
          }}
        />
      </div>

      {/* Form Dialog */}
      <Dialog
        isOpen={formDialog}
        onClose={() => setFormDialog(false)}
        title={selectedCustomer ? "تعديل العميل" : "إضافة عميل جديد"}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setFormDialog(false)}>
              إلغاء
            </button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              {selectedCustomer ? "تحديث" : "إضافة"}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label htmlFor="name">اسم العميل *</label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label htmlFor="phone">رقم الهاتف</label>
          <input
            type="tel"
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label htmlFor="address">العنوان</label>
          <textarea
            id="address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            rows={2}
          />
        </div>
      </Dialog>

      {/* View Dialog */}
      <Dialog
        isOpen={viewDialog}
        onClose={() => setViewDialog(false)}
        title="تفاصيل العميل"
        maxWidth="500px"
      >
        {selectedCustomer && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
              <div>
                <p className="stat-label">اسم العميل</p>
                <p style={{ fontWeight: 700 }}>{selectedCustomer.name}</p>
              </div>
              <div>
                <p className="stat-label">الهاتف</p>
                <p>{selectedCustomer.phone || "-"}</p>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <p className="stat-label">العنوان</p>
                <p>{selectedCustomer.address || "-"}</p>
              </div>
              <div>
                <p className="stat-label">تاريخ الإضافة</p>
                <p>{formatDate(selectedCustomer.created_at)}</p>
              </div>
            </div>

            <div className="summary-stat-box">
              <div className="stat-item">
                <span className="stat-label">إجمالي الدين</span>
                <span className="stat-value">{formatCurrency(selectedCustomer.total_debt)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">المدفوع</span>
                <span className="stat-value text-success">{formatCurrency(selectedCustomer.total_paid)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">المتبقي</span>
                <span className={`stat-value ${selectedCustomer.balance > 0 ? "text-danger" : "text-success"}`}>
                  {formatCurrency(selectedCustomer.balance)}
                </span>
              </div>
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
        message="هل أنت متأكد من حذف هذا العميل؟"
        confirmText="حذف"
        confirmVariant="danger"
      />
    </MainLayout>
  );
}

