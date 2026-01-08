"use client";

import { useState, useEffect, useCallback } from "react";
import { MainLayout, PageHeader } from "@/components/layout";
import { Table, Dialog, ConfirmDialog, SearchableSelect, SelectOption, showToast, Column } from "@/components/ui";
import { fetchAPI } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { User, getStoredUser, getStoredPermissions, Permission, canAccess } from "@/lib/auth";
import { getIcon } from "@/lib/icons";

interface Product {
    id: number;
    name: string;
    stock: number;
    purchase_price: number;
}

interface Purchase {
    id: number;
    product_id: number;
    product_name: string;
    quantity: number;
    unit_type: string;
    unit_price: number;
    total_price: number;
    supplier?: string;
    purchase_date: string;
    expiry_date?: string;
    notes?: string;
    created_at: string;
}

interface PurchaseRequest {
    id: number;
    product_name: string;
    quantity: number;
    notes?: string;
    status: "pending" | "approved" | "done";
    created_at: string;
}

export default function PurchasesPage() {
    const [user, setUser] = useState<User | null>(null);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Dialogs
    const [purchaseDialog, setPurchaseDialog] = useState(false);
    const [viewDialog, setViewDialog] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState(false);
    const [requestsDialog, setRequestsDialog] = useState(false);
    const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    // Requests
    const [requests, setRequests] = useState<PurchaseRequest[]>([]);

    // Form
    const [formData, setFormData] = useState({
        product_id: "",
        quantity: "",
        unit_type: "piece",
        unit_price: "",
        supplier: "",
        purchase_date: new Date().toISOString().split("T")[0],
        expiry_date: "",
        notes: "",
    });

    const itemsPerPage = 10;

    const loadPurchases = useCallback(async (page: number = 1, search: string = "") => {
        try {
            setIsLoading(true);
            const response = await fetchAPI(
                `/api/purchases?page=${page}&limit=${itemsPerPage}&search=${encodeURIComponent(search)}`
            );
            setPurchases((response.purchases as Purchase[]) || []);
            setTotalPages(Math.ceil((Number(response.total) || 0) / itemsPerPage));
            setCurrentPage(page);
        } catch {
            showToast("خطأ في تحميل المشتريات", "error");
        } finally {
            setIsLoading(false);
        }
    }, []);

    const loadProducts = useCallback(async () => {
        try {
            const response = await fetchAPI("/api/products?limit=1000");
            setProducts((response.products as Product[]) || []);
        } catch {
            console.error("Error loading products");
        }
    }, []);

    const loadRequests = useCallback(async () => {
        try {
            const response = await fetchAPI("/api/requests?status=pending");
            setRequests((response.requests as PurchaseRequest[]) || []);
        } catch {
            console.error("Error loading requests");
        }
    }, []);

    useEffect(() => {
        const storedUser = getStoredUser();
        const storedPermissions = getStoredPermissions();
        setUser(storedUser);
        setPermissions(storedPermissions);
        loadPurchases();
        loadProducts();
    }, [loadPurchases, loadProducts]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchTerm(value);
        loadPurchases(1, value);
    };

    const productOptions: SelectOption[] = products.map((p) => ({
        value: p.id,
        label: p.name,
        subtitle: `المخزون: ${p.stock}`,
    }));

    const openAddDialog = () => {
        setSelectedPurchase(null);
        setFormData({
            product_id: "",
            quantity: "",
            unit_type: "piece",
            unit_price: "",
            supplier: "",
            purchase_date: new Date().toISOString().split("T")[0],
            expiry_date: "",
            notes: "",
        });
        setPurchaseDialog(true);
    };

    const openEditDialog = (purchase: Purchase) => {
        setSelectedPurchase(purchase);
        setFormData({
            product_id: String(purchase.product_id),
            quantity: String(purchase.quantity),
            unit_type: purchase.unit_type,
            unit_price: String(purchase.unit_price),
            supplier: purchase.supplier || "",
            purchase_date: purchase.purchase_date.split("T")[0],
            expiry_date: purchase.expiry_date?.split("T")[0] || "",
            notes: purchase.notes || "",
        });
        setPurchaseDialog(true);
    };

    const openViewDialog = (purchase: Purchase) => {
        setSelectedPurchase(purchase);
        setViewDialog(true);
    };

    const handleProductSelect = (value: string | number | null) => {
        if (value === null) {
            setFormData({ ...formData, product_id: "", unit_price: "" });
            return;
        }
        const product = products.find((p) => p.id === value);
        if (product) {
            setFormData({
                ...formData,
                product_id: String(product.id),
                unit_price: String(product.purchase_price),
            });
        }
    };

    const handleSubmit = async () => {
        if (!formData.product_id || !formData.quantity || !formData.unit_price) {
            showToast("يرجى ملء جميع الحقول المطلوبة", "error");
            return;
        }

        const payload = {
            product_id: parseInt(formData.product_id),
            quantity: parseInt(formData.quantity),
            unit_type: formData.unit_type,
            unit_price: parseFloat(formData.unit_price),
            total_price: parseInt(formData.quantity) * parseFloat(formData.unit_price),
            supplier: formData.supplier,
            purchase_date: formData.purchase_date,
            expiry_date: formData.expiry_date || null,
            notes: formData.notes,
        };

        try {
            if (selectedPurchase) {
                await fetchAPI(`/api/purchases/${selectedPurchase.id}`, {
                    method: "PUT",
                    body: JSON.stringify(payload),
                });
                showToast("تم تحديث المشترى بنجاح", "success");
            } else {
                await fetchAPI("/api/purchases", {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
                showToast("تمت إضافة المشترى بنجاح", "success");
            }
            setPurchaseDialog(false);
            loadPurchases(currentPage, searchTerm);
            loadProducts(); // Refresh stock
        } catch {
            showToast("خطأ في حفظ المشترى", "error");
        }
    };

    const confirmDelete = (id: number) => {
        setDeleteId(id);
        setConfirmDialog(true);
    };

    const handleDelete = async () => {
        if (!deleteId) return;

        try {
            await fetchAPI(`/api/purchases/${deleteId}`, { method: "DELETE" });
            showToast("تم حذف المشترى", "success");
            loadPurchases(currentPage, searchTerm);
            loadProducts();
        } catch {
            showToast("خطأ في حذف المشترى", "error");
        }
    };

    const openRequestsDialog = async () => {
        await loadRequests();
        setRequestsDialog(true);
    };

    const convertRequestToPurchase = (request: PurchaseRequest) => {
        setFormData({
            product_id: "",
            quantity: String(request.quantity),
            unit_type: "piece",
            unit_price: "",
            supplier: "",
            purchase_date: new Date().toISOString().split("T")[0],
            expiry_date: "",
            notes: `من طلب: ${request.product_name} - ${request.notes || ""}`,
        });
        setRequestsDialog(false);
        setPurchaseDialog(true);
    };

    const markRequestDone = async (requestId: number) => {
        try {
            await fetchAPI(`/api/requests/${requestId}`, {
                method: "PUT",
                body: JSON.stringify({ status: "done" }),
            });
            showToast("تم تحديث حالة الطلب", "success");
            loadRequests();
        } catch {
            showToast("خطأ في تحديث الطلب", "error");
        }
    };

    const columns: Column<Purchase>[] = [
        { key: "product_name", header: "المنتج", dataLabel: "المنتج" },
        {
            key: "quantity",
            header: "الكمية",
            dataLabel: "الكمية",
            render: (item) => `${item.quantity} ${item.unit_type === "piece" ? "قطعة" : "صندوق"}`,
        },
        {
            key: "unit_price",
            header: "سعر الوحدة",
            dataLabel: "سعر الوحدة",
            render: (item) => formatCurrency(item.unit_price),
        },
        {
            key: "total_price",
            header: "الإجمالي",
            dataLabel: "الإجمالي",
            render: (item) => formatCurrency(item.total_price),
        },
        { key: "supplier", header: "المورد", dataLabel: "المورد" },
        {
            key: "purchase_date",
            header: "التاريخ",
            dataLabel: "التاريخ",
            render: (item) => formatDate(item.purchase_date),
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
                    {canAccess(permissions, "purchases", "edit") && (
                        <button className="icon-btn edit" onClick={() => openEditDialog(item)} title="تعديل">
                            {getIcon("edit")}
                        </button>
                    )}
                    {canAccess(permissions, "purchases", "delete") && (
                        <button className="icon-btn delete" onClick={() => confirmDelete(item.id)} title="حذف">
                            {getIcon("trash")}
                        </button>
                    )}
                </div>
            ),
        },
    ];

    const requestColumns: Column<PurchaseRequest>[] = [
        { key: "product_name", header: "المنتج", dataLabel: "المنتج" },
        { key: "quantity", header: "الكمية", dataLabel: "الكمية" },
        { key: "notes", header: "ملاحظات", dataLabel: "ملاحظات" },
        {
            key: "created_at",
            header: "التاريخ",
            dataLabel: "التاريخ",
            render: (item) => formatDate(item.created_at),
        },
        {
            key: "actions",
            header: "الإجراءات",
            dataLabel: "الإجراءات",
            render: (item) => (
                <div className="action-buttons">
                    <button
                        className="btn btn-sm btn-primary"
                        onClick={() => convertRequestToPurchase(item)}
                    >
                        تحويل لمشترى
                    </button>
                    <button
                        className="btn btn-sm btn-success"
                        onClick={() => markRequestDone(item.id)}
                    >
                        {getIcon("check")}
                    </button>
                </div>
            ),
        },
    ];

    return (
        <MainLayout requiredModule="purchases">
            <PageHeader
                title="المشتريات"
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
                    <>
                        <button className="btn btn-secondary" onClick={openRequestsDialog}>
                            <i className="fas fa-clipboard-list"></i>
                            طلبات الشراء
                        </button>
                        {canAccess(permissions, "purchases", "create") && (
                            <button className="btn btn-primary" onClick={openAddDialog}>
                                {getIcon("plus")}
                                إضافة مشترى
                            </button>
                        )}
                    </>
                }
            />

            <div className="sales-card animate-fade">
                <Table
                    columns={columns}
                    data={purchases}
                    keyExtractor={(item) => item.id}
                    emptyMessage="لا توجد مشتريات"
                    isLoading={isLoading}
                    pagination={{
                        currentPage,
                        totalPages,
                        onPageChange: (page) => loadPurchases(page, searchTerm),
                    }}
                />
            </div>

            {/* Purchase Dialog */}
            <Dialog
                isOpen={purchaseDialog}
                onClose={() => setPurchaseDialog(false)}
                title={selectedPurchase ? "تعديل المشترى" : "إضافة مشترى جديد"}
                maxWidth="600px"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setPurchaseDialog(false)}>
                            إلغاء
                        </button>
                        <button className="btn btn-primary" onClick={handleSubmit}>
                            {selectedPurchase ? "تحديث" : "إضافة"}
                        </button>
                    </>
                }
            >
                <div className="form-group">
                    <label>المنتج *</label>
                    <SearchableSelect
                        options={productOptions}
                        value={formData.product_id ? parseInt(formData.product_id) : null}
                        onChange={handleProductSelect}
                        placeholder="ابحث عن منتج..."
                    />
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="quantity">الكمية *</label>
                        <input
                            type="number"
                            id="quantity"
                            value={formData.quantity}
                            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                            min="1"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="unit_type">نوع الوحدة</label>
                        <select
                            id="unit_type"
                            value={formData.unit_type}
                            onChange={(e) => setFormData({ ...formData, unit_type: e.target.value })}
                        >
                            <option value="piece">قطعة</option>
                            <option value="package">صندوق</option>
                        </select>
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="unit_price">سعر الوحدة *</label>
                        <input
                            type="number"
                            id="unit_price"
                            value={formData.unit_price}
                            onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                            min="0"
                            step="0.01"
                        />
                    </div>
                    <div className="form-group">
                        <label>الإجمالي</label>
                        <input
                            type="text"
                            value={formatCurrency(
                                (parseInt(formData.quantity) || 0) * (parseFloat(formData.unit_price) || 0)
                            )}
                            readOnly
                            className="highlight-input"
                        />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="supplier">المورد</label>
                        <input
                            type="text"
                            id="supplier"
                            value={formData.supplier}
                            onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="purchase_date">تاريخ الشراء</label>
                        <input
                            type="date"
                            id="purchase_date"
                            value={formData.purchase_date}
                            onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label htmlFor="expiry_date">تاريخ الانتهاء</label>
                    <input
                        type="date"
                        id="expiry_date"
                        value={formData.expiry_date}
                        onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="notes">ملاحظات</label>
                    <textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={2}
                    />
                </div>
            </Dialog>

            {/* View Dialog */}
            <Dialog
                isOpen={viewDialog}
                onClose={() => setViewDialog(false)}
                title="تفاصيل المشترى"
                maxWidth="500px"
            >
                {selectedPurchase && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                        <div>
                            <p className="stat-label">المنتج</p>
                            <p style={{ fontWeight: 700 }}>{selectedPurchase.product_name}</p>
                        </div>
                        <div>
                            <p className="stat-label">الكمية</p>
                            <p>{selectedPurchase.quantity} {selectedPurchase.unit_type === "piece" ? "قطعة" : "صندوق"}</p>
                        </div>
                        <div>
                            <p className="stat-label">سعر الوحدة</p>
                            <p>{formatCurrency(selectedPurchase.unit_price)}</p>
                        </div>
                        <div>
                            <p className="stat-label">الإجمالي</p>
                            <p style={{ fontWeight: 700, color: "var(--primary-color)" }}>
                                {formatCurrency(selectedPurchase.total_price)}
                            </p>
                        </div>
                        <div>
                            <p className="stat-label">المورد</p>
                            <p>{selectedPurchase.supplier || "-"}</p>
                        </div>
                        <div>
                            <p className="stat-label">تاريخ الشراء</p>
                            <p>{formatDate(selectedPurchase.purchase_date)}</p>
                        </div>
                        <div>
                            <p className="stat-label">تاريخ الانتهاء</p>
                            <p>{selectedPurchase.expiry_date ? formatDate(selectedPurchase.expiry_date) : "-"}</p>
                        </div>
                        {selectedPurchase.notes && (
                            <div style={{ gridColumn: "span 2" }}>
                                <p className="stat-label">ملاحظات</p>
                                <p>{selectedPurchase.notes}</p>
                            </div>
                        )}
                    </div>
                )}
            </Dialog>

            {/* Requests Dialog */}
            <Dialog
                isOpen={requestsDialog}
                onClose={() => setRequestsDialog(false)}
                title="طلبات الشراء"
                maxWidth="800px"
            >
                <Table
                    columns={requestColumns}
                    data={requests}
                    keyExtractor={(item) => item.id}
                    emptyMessage="لا توجد طلبات معلقة"
                />
            </Dialog>

            {/* Confirm Delete Dialog */}
            <ConfirmDialog
                isOpen={confirmDialog}
                onClose={() => setConfirmDialog(false)}
                onConfirm={handleDelete}
                title="تأكيد الحذف"
                message="هل أنت متأكد من حذف هذا المشترى؟"
                confirmText="حذف"
                confirmVariant="danger"
            />
        </MainLayout>
    );
}

