"use client";

import { useState, useEffect, useCallback } from "react";
import { MainLayout, PageHeader } from "@/components/layout";
import { Table, Dialog, ConfirmDialog, showToast, Column } from "@/components/ui";
import { fetchAPI } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { User, getStoredUser, getStoredPermissions, Permission, canAccess } from "@/lib/auth";
import { getIcon } from "@/lib/icons";
import { Pagination as PaginationType } from "@/lib/types";

interface Category {
    id: number;
    name: string;
}

interface Product {
    id: number;
    name: string;
    barcode: string;
    category_id: number;
    category_name?: string;
    purchase_price: number;
    selling_price: number;
    stock: number;
    min_stock: number;
    unit_type: string;
    units_per_package: number;
    package_price: number;
    profit_margin: number;
    description?: string;
    expiry_date?: string;
    created_at: string;
}

export default function ProductsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Dialogs
    const [productDialog, setProductDialog] = useState(false);
    const [categoryDialog, setCategoryDialog] = useState(false);
    const [viewDialog, setViewDialog] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    // Product Form
    const [formData, setFormData] = useState({
        name: "",
        barcode: "",
        category_id: "",
        purchase_price: "",
        selling_price: "",
        stock: "",
        min_stock: "10",
        unit_type: "piece",
        units_per_package: "1",
        package_price: "",
        profit_margin: "",
        description: "",
        expiry_date: "",
    });

    // Category Form
    const [newCategoryName, setNewCategoryName] = useState("");

    const itemsPerPage = 10;

    const loadProducts = useCallback(async (page: number = 1, search: string = "") => {
        try {
            setIsLoading(true);
            const response = await fetchAPI(
                `products?page=${page}&limit=${itemsPerPage}&search=${encodeURIComponent(search)}`
            );
            setProducts((response.data as Product[]) || []);
            setTotalPages((response.pagination as PaginationType)?.total_pages || 1);
            setCurrentPage(page);
        } catch {
            showToast("خطأ في تحميل المنتجات", "error");
        } finally {
            setIsLoading(false);
        }
    }, []);

    const loadCategories = useCallback(async () => {
        try {
            const response = await fetchAPI("categories");
            setCategories((response.data as Category[]) || (response.categories as Category[]) || []);
        } catch {
            console.error("Error loading categories");
        }
    }, []);

    useEffect(() => {
        const storedUser = getStoredUser();
        const storedPermissions = getStoredPermissions();
        setUser(storedUser);
        setPermissions(storedPermissions);
        loadProducts();
        loadCategories();
    }, [loadProducts, loadCategories]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchTerm(value);
        loadProducts(1, value);
    };

    const openAddDialog = () => {
        setSelectedProduct(null);
        setFormData({
            name: "",
            barcode: "",
            category_id: categories[0]?.id?.toString() || "",
            purchase_price: "",
            selling_price: "",
            stock: "",
            min_stock: "10",
            unit_type: "piece",
            units_per_package: "1",
            package_price: "",
            profit_margin: "",
            description: "",
            expiry_date: "",
        });
        setProductDialog(true);
    };

    const openEditDialog = (product: Product) => {
        setSelectedProduct(product);
        setFormData({
            name: product.name,
            barcode: product.barcode || "",
            category_id: String(product.category_id),
            purchase_price: String(product.purchase_price),
            selling_price: String(product.selling_price),
            stock: String(product.stock),
            min_stock: String(product.min_stock),
            unit_type: product.unit_type,
            units_per_package: String(product.units_per_package),
            package_price: String(product.package_price || ""),
            profit_margin: String(product.profit_margin || ""),
            description: product.description || "",
            expiry_date: product.expiry_date?.split("T")[0] || "",
        });
        setProductDialog(true);
    };

    const openViewDialog = (product: Product) => {
        setSelectedProduct(product);
        setViewDialog(true);
    };

    const calculatePrices = (field: string, value: string) => {
        const newData = { ...formData, [field]: value };
        const purchasePrice = parseFloat(newData.purchase_price) || 0;
        const sellingPrice = parseFloat(newData.selling_price) || 0;
        const margin = parseFloat(newData.profit_margin) || 0;

        if (field === "profit_margin" && purchasePrice > 0) {
            newData.selling_price = String((purchasePrice * (1 + margin / 100)).toFixed(2));
        } else if (field === "selling_price" && purchasePrice > 0) {
            newData.profit_margin = String((((sellingPrice - purchasePrice) / purchasePrice) * 100).toFixed(2));
        } else if (field === "purchase_price" && margin > 0) {
            newData.selling_price = String((purchasePrice * (1 + margin / 100)).toFixed(2));
        }

        // Calculate package price
        const unitsPerPackage = parseFloat(newData.units_per_package) || 1;
        const unitSellingPrice = parseFloat(newData.selling_price) || 0;
        newData.package_price = String((unitSellingPrice * unitsPerPackage).toFixed(2));

        setFormData(newData);
    };

    const handleSubmit = async () => {
        if (!formData.name.trim() || !formData.purchase_price || !formData.selling_price) {
            showToast("يرجى ملء جميع الحقول المطلوبة", "error");
            return;
        }

        const payload = {
            name: formData.name,
            barcode: formData.barcode,
            category_id: parseInt(formData.category_id),
            purchase_price: parseFloat(formData.purchase_price),
            selling_price: parseFloat(formData.selling_price),
            stock: parseInt(formData.stock) || 0,
            min_stock: parseInt(formData.min_stock) || 10,
            unit_type: formData.unit_type,
            units_per_package: parseInt(formData.units_per_package) || 1,
            package_price: parseFloat(formData.package_price) || 0,
            profit_margin: parseFloat(formData.profit_margin) || 0,
            description: formData.description,
            expiry_date: formData.expiry_date || null,
        };

        try {
            if (selectedProduct) {
                await fetchAPI(`products`, {
                    method: "PUT",
                    body: JSON.stringify({ ...payload, id: selectedProduct.id }),
                });
                showToast("تم تحديث المنتج بنجاح", "success");
            } else {
                await fetchAPI("products", {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
                showToast("تمت إضافة المنتج بنجاح", "success");
            }
            setProductDialog(false);
            loadProducts(currentPage, searchTerm);
        } catch {
            showToast("خطأ في حفظ المنتج", "error");
        }
    };

    const addCategory = async () => {
        if (!newCategoryName.trim()) {
            showToast("يرجى إدخال اسم الفئة", "error");
            return;
        }

        try {
            await fetchAPI("/api/categories", {
                method: "POST",
                body: JSON.stringify({ name: newCategoryName }),
            });
            showToast("تمت إضافة الفئة بنجاح", "success");
            setCategoryDialog(false);
            setNewCategoryName("");
            loadCategories();
        } catch {
            showToast("خطأ في إضافة الفئة", "error");
        }
    };

    const confirmDelete = (id: number) => {
        setDeleteId(id);
        setConfirmDialog(true);
    };

    const handleDelete = async () => {
        if (!deleteId) return;

        try {
            await fetchAPI(`products?id=${deleteId}`, { method: "DELETE" });
            showToast("تم حذف المنتج", "success");
            loadProducts(currentPage, searchTerm);
        } catch {
            showToast("خطأ في حذف المنتج", "error");
        }
    };

    const getStockStatus = (product: Product) => {
        if (product.stock <= 0) {
            return <span className="badge badge-danger">نفذ</span>;
        } else if (product.stock <= product.min_stock) {
            return <span className="badge badge-warning">منخفض</span>;
        }
        return <span className="badge badge-success">متوفر</span>;
    };

    const columns: Column<Product>[] = [
        { key: "name", header: "اسم المنتج", dataLabel: "اسم المنتج" },
        { key: "barcode", header: "الباركود", dataLabel: "الباركود" },
        { key: "category_name", header: "الفئة", dataLabel: "الفئة" },
        {
            key: "selling_price",
            header: "سعر البيع",
            dataLabel: "سعر البيع",
            render: (item) => formatCurrency(item.selling_price),
        },
        {
            key: "stock",
            header: "المخزون",
            dataLabel: "المخزون",
            render: (item) => (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span>{item.stock}</span>
                    {getStockStatus(item)}
                </div>
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
                    {canAccess(permissions, "products", "edit") && (
                        <button className="icon-btn edit" onClick={() => openEditDialog(item)} title="تعديل">
                            {getIcon("edit")}
                        </button>
                    )}
                    {canAccess(permissions, "products", "delete") && (
                        <button className="icon-btn delete" onClick={() => confirmDelete(item.id)} title="حذف">
                            {getIcon("trash")}
                        </button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <MainLayout requiredModule="products">
            <PageHeader
                title="المنتجات"
                user={user}
                actions={
                    canAccess(permissions, "products", "create") && (
                        <button className="btn btn-primary" onClick={openAddDialog}>
                            {getIcon("plus")}
                            إضافة منتج
                        </button>
                    )
                }
            />

            <div className="filter-section animate-fade" style={{ marginBottom: "1.5rem" }}>
                <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                    <input
                        type="text"
                        placeholder="بحث بالاسم أو الباركود..."
                        value={searchTerm}
                        onChange={handleSearch}
                    />
                </div>
            </div>

            <div className="sales-card animate-fade">
                <Table
                    columns={columns}
                    data={products}
                    keyExtractor={(item) => item.id}
                    emptyMessage="لا توجد منتجات"
                    isLoading={isLoading}
                    pagination={{
                        currentPage,
                        totalPages,
                        onPageChange: (page) => loadProducts(page, searchTerm),
                    }}
                />
            </div>

            {/* Product Dialog */}
            <Dialog
                isOpen={productDialog}
                onClose={() => setProductDialog(false)}
                title={selectedProduct ? "تعديل المنتج" : "إضافة منتج جديد"}
                maxWidth="700px"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setProductDialog(false)}>
                            إلغاء
                        </button>
                        <button className="btn btn-primary" onClick={handleSubmit}>
                            {selectedProduct ? "تحديث" : "إضافة"}
                        </button>
                    </>
                }
            >
                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="name">اسم المنتج *</label>
                        <input
                            type="text"
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="barcode">الباركود</label>
                        <input
                            type="text"
                            id="barcode"
                            value={formData.barcode}
                            onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                        />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="category_id">الفئة</label>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            <select
                                id="category_id"
                                value={formData.category_id}
                                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                style={{ flex: 1 }}
                            >
                                {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setCategoryDialog(true)}
                            >
                                {getIcon("plus")}
                            </button>
                        </div>
                    </div>
                    <div className="form-group">
                        <label htmlFor="unit_type">نوع الوحدة</label>
                        <select
                            id="unit_type"
                            value={formData.unit_type}
                            onChange={(e) => setFormData({ ...formData, unit_type: e.target.value })}
                        >
                            <option value="piece">قطعة</option>
                            <option value="kg">كيلو</option>
                            <option value="liter">لتر</option>
                            <option value="meter">متر</option>
                        </select>
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="purchase_price">سعر الشراء *</label>
                        <input
                            type="number"
                            id="purchase_price"
                            value={formData.purchase_price}
                            onChange={(e) => calculatePrices("purchase_price", e.target.value)}
                            min="0"
                            step="0.01"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="profit_margin">هامش الربح (%)</label>
                        <input
                            type="number"
                            id="profit_margin"
                            value={formData.profit_margin}
                            onChange={(e) => calculatePrices("profit_margin", e.target.value)}
                            min="0"
                            step="0.1"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="selling_price">سعر البيع *</label>
                        <input
                            type="number"
                            id="selling_price"
                            value={formData.selling_price}
                            onChange={(e) => calculatePrices("selling_price", e.target.value)}
                            min="0"
                            step="0.01"
                        />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="units_per_package">وحدات/صندوق</label>
                        <input
                            type="number"
                            id="units_per_package"
                            value={formData.units_per_package}
                            onChange={(e) => calculatePrices("units_per_package", e.target.value)}
                            min="1"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="package_price">سعر الصندوق</label>
                        <input
                            type="number"
                            id="package_price"
                            value={formData.package_price}
                            readOnly
                            className="highlight-input"
                        />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label htmlFor="stock">المخزون</label>
                        <input
                            type="number"
                            id="stock"
                            value={formData.stock}
                            onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                            min="0"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="min_stock">الحد الأدنى</label>
                        <input
                            type="number"
                            id="min_stock"
                            value={formData.min_stock}
                            onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                            min="0"
                        />
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
            </Dialog>

            {/* Category Dialog */}
            <Dialog
                isOpen={categoryDialog}
                onClose={() => setCategoryDialog(false)}
                title="إضافة فئة جديدة"
                maxWidth="400px"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setCategoryDialog(false)}>
                            إلغاء
                        </button>
                        <button className="btn btn-primary" onClick={addCategory}>
                            إضافة
                        </button>
                    </>
                }
            >
                <div className="form-group">
                    <label htmlFor="categoryName">اسم الفئة *</label>
                    <input
                        type="text"
                        id="categoryName"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                    />
                </div>
            </Dialog>

            {/* View Dialog */}
            <Dialog
                isOpen={viewDialog}
                onClose={() => setViewDialog(false)}
                title="تفاصيل المنتج"
                maxWidth="500px"
            >
                {selectedProduct && (
                    <div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                            <div>
                                <p className="stat-label">اسم المنتج</p>
                                <p style={{ fontWeight: 700 }}>{selectedProduct.name}</p>
                            </div>
                            <div>
                                <p className="stat-label">الباركود</p>
                                <p>{selectedProduct.barcode || "-"}</p>
                            </div>
                            <div>
                                <p className="stat-label">الفئة</p>
                                <p>{selectedProduct.category_name || "-"}</p>
                            </div>
                            <div>
                                <p className="stat-label">نوع الوحدة</p>
                                <p>{selectedProduct.unit_type === "piece" ? "قطعة" : selectedProduct.unit_type}</p>
                            </div>
                            <div>
                                <p className="stat-label">سعر الشراء</p>
                                <p>{formatCurrency(selectedProduct.purchase_price)}</p>
                            </div>
                            <div>
                                <p className="stat-label">سعر البيع</p>
                                <p>{formatCurrency(selectedProduct.selling_price)}</p>
                            </div>
                            <div>
                                <p className="stat-label">هامش الربح</p>
                                <p>{selectedProduct.profit_margin}%</p>
                            </div>
                            <div>
                                <p className="stat-label">المخزون</p>
                                <p>
                                    {selectedProduct.stock} {getStockStatus(selectedProduct)}
                                </p>
                            </div>
                            <div>
                                <p className="stat-label">الحد الأدنى</p>
                                <p>{selectedProduct.min_stock}</p>
                            </div>
                            <div>
                                <p className="stat-label">تاريخ الانتهاء</p>
                                <p>{selectedProduct.expiry_date ? formatDate(selectedProduct.expiry_date) : "-"}</p>
                            </div>
                        </div>
                        {selectedProduct.description && (
                            <div style={{ marginTop: "1rem" }}>
                                <p className="stat-label">الوصف</p>
                                <p>{selectedProduct.description}</p>
                            </div>
                        )}
                    </div>
                )}
            </Dialog>

            {/* Confirm Delete Dialog */}
            <ConfirmDialog
                isOpen={confirmDialog}
                onClose={() => setConfirmDialog(false)}
                onConfirm={handleDelete}
                title="تأكيد الحذف"
                message="هل أنت متأكد من حذف هذا المنتج؟"
                confirmText="حذف"
                confirmVariant="danger"
            />
        </MainLayout>
    );
}

