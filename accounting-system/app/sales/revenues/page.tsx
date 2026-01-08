"use client";

import { useState, useEffect, useCallback } from "react";
import { MainLayout, PageHeader } from "@/components/layout";
import { Table, Dialog, ConfirmDialog, showToast, Column } from "@/components/ui";
import { fetchAPI } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { User, getStoredUser, getStoredPermissions, Permission, canAccess } from "@/lib/auth";
import { getIcon } from "@/lib/icons";

interface Revenue {
    id: number;
    description: string;
    amount: number;
    category: string;
    revenue_date: string;
    notes?: string;
    created_at: string;
}

const revenueCategories = [
    { value: "sales", label: "مبيعات" },
    { value: "services", label: "خدمات" },
    { value: "rental", label: "إيجار" },
    { value: "investment", label: "استثمار" },
    { value: "other", label: "أخرى" },
];

export default function RevenuesPage() {
    const [user, setUser] = useState<User | null>(null);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [revenues, setRevenues] = useState<Revenue[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Dialogs
    const [formDialog, setFormDialog] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState(false);
    const [selectedRevenue, setSelectedRevenue] = useState<Revenue | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    // Form
    const [formData, setFormData] = useState({
        description: "",
        amount: "",
        category: "sales",
        revenue_date: new Date().toISOString().split("T")[0],
        notes: "",
    });

    const itemsPerPage = 10;

    const loadRevenues = useCallback(async (page: number = 1, search: string = "") => {
        try {
            setIsLoading(true);
            const response = await fetchAPI(
                `/api/revenues?page=${page}&limit=${itemsPerPage}&search=${encodeURIComponent(search)}`
            );
            setRevenues((response.revenues as Revenue[]) || []);
            setTotalPages(Math.ceil((Number(response.total) || 0) / itemsPerPage));
            setCurrentPage(page);
        } catch {
            showToast("خطأ في تحميل الإيرادات", "error");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const storedUser = getStoredUser();
        const storedPermissions = getStoredPermissions();
        setUser(storedUser);
        setPermissions(storedPermissions);
        loadRevenues();
    }, [loadRevenues]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchTerm(value);
        loadRevenues(1, value);
    };

    const openAddDialog = () => {
        setSelectedRevenue(null);
        setFormData({
            description: "",
            amount: "",
            category: "sales",
            revenue_date: new Date().toISOString().split("T")[0],
            notes: "",
        });
        setFormDialog(true);
    };

    const openEditDialog = (revenue: Revenue) => {
        setSelectedRevenue(revenue);
        setFormData({
            description: revenue.description,
            amount: String(revenue.amount),
            category: revenue.category,
            revenue_date: revenue.revenue_date.split("T")[0],
            notes: revenue.notes || "",
        });
        setFormDialog(true);
    };

    const handleSubmit = async () => {
        if (!formData.description.trim() || !formData.amount) {
            showToast("يرجى ملء جميع الحقول المطلوبة", "error");
            return;
        }

        try {
            if (selectedRevenue) {
                await fetchAPI(`/api/revenues/${selectedRevenue.id}`, {
                    method: "PUT",
                    body: JSON.stringify({
                        ...formData,
                        amount: parseFloat(formData.amount),
                    }),
                });
                showToast("تم تحديث الإيراد بنجاح", "success");
            } else {
                await fetchAPI("/api/revenues", {
                    method: "POST",
                    body: JSON.stringify({
                        ...formData,
                        amount: parseFloat(formData.amount),
                    }),
                });
                showToast("تمت إضافة الإيراد بنجاح", "success");
            }
            setFormDialog(false);
            loadRevenues(currentPage, searchTerm);
        } catch {
            showToast("خطأ في حفظ الإيراد", "error");
        }
    };

    const confirmDelete = (id: number) => {
        setDeleteId(id);
        setConfirmDialog(true);
    };

    const handleDelete = async () => {
        if (!deleteId) return;

        try {
            await fetchAPI(`/api/revenues/${deleteId}`, { method: "DELETE" });
            showToast("تم حذف الإيراد", "success");
            loadRevenues(currentPage, searchTerm);
        } catch {
            showToast("خطأ في حذف الإيراد", "error");
        }
    };

    const getCategoryLabel = (value: string) => {
        const cat = revenueCategories.find((c) => c.value === value);
        return cat?.label || value;
    };

    const columns: Column<Revenue>[] = [
        { key: "description", header: "الوصف", dataLabel: "الوصف" },
        {
            key: "amount",
            header: "المبلغ",
            dataLabel: "المبلغ",
            render: (item) => <span className="text-success">{formatCurrency(item.amount)}</span>,
        },
        {
            key: "category",
            header: "الفئة",
            dataLabel: "الفئة",
            render: (item) => (
                <span className="badge badge-info">{getCategoryLabel(item.category)}</span>
            ),
        },
        {
            key: "revenue_date",
            header: "التاريخ",
            dataLabel: "التاريخ",
            render: (item) => formatDate(item.revenue_date),
        },
        {
            key: "actions",
            header: "الإجراءات",
            dataLabel: "الإجراءات",
            render: (item) => (
                <div className="action-buttons">
                    {canAccess(permissions, "revenues", "edit") && (
                        <button className="icon-btn edit" onClick={() => openEditDialog(item)} title="تعديل">
                            {getIcon("edit")}
                        </button>
                    )}
                    {canAccess(permissions, "revenues", "delete") && (
                        <button className="icon-btn delete" onClick={() => confirmDelete(item.id)} title="حذف">
                            {getIcon("trash")}
                        </button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <MainLayout requiredModule="revenues">
            <PageHeader
                title="الإيرادات"
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
                    canAccess(permissions, "revenues", "create") && (
                        <button className="btn btn-primary" onClick={openAddDialog}>
                            {getIcon("plus")}
                            إضافة إيراد
                        </button>
                    )
                }
            />

            <div className="sales-card animate-fade">
                <Table
                    columns={columns}
                    data={revenues}
                    keyExtractor={(item) => item.id}
                    emptyMessage="لا توجد إيرادات"
                    isLoading={isLoading}
                    pagination={{
                        currentPage,
                        totalPages,
                        onPageChange: (page) => loadRevenues(page, searchTerm),
                    }}
                />
            </div>

            {/* Form Dialog */}
            <Dialog
                isOpen={formDialog}
                onClose={() => setFormDialog(false)}
                title={selectedRevenue ? "تعديل الإيراد" : "إضافة إيراد جديد"}
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setFormDialog(false)}>
                            إلغاء
                        </button>
                        <button className="btn btn-primary" onClick={handleSubmit}>
                            {selectedRevenue ? "تحديث" : "إضافة"}
                        </button>
                    </>
                }
            >
                <div className="form-group">
                    <label htmlFor="description">الوصف *</label>
                    <input
                        type="text"
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                </div>

                <div className="form-row">
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
                    <div className="form-group">
                        <label htmlFor="category">الفئة</label>
                        <select
                            id="category"
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        >
                            {revenueCategories.map((cat) => (
                                <option key={cat.value} value={cat.value}>
                                    {cat.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="form-group">
                    <label htmlFor="revenue_date">التاريخ</label>
                    <input
                        type="date"
                        id="revenue_date"
                        value={formData.revenue_date}
                        onChange={(e) => setFormData({ ...formData, revenue_date: e.target.value })}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="notes">ملاحظات</label>
                    <textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
                message="هل أنت متأكد من حذف هذا الإيراد؟"
                confirmText="حذف"
                confirmVariant="danger"
            />
        </MainLayout>
    );
}

