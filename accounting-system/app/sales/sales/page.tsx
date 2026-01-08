"use client";

import { useState, useEffect, useCallback } from "react";
import { MainLayout, PageHeader } from "@/components/layout";
import { Table, Dialog, ConfirmDialog, SearchableSelect, SelectOption, showToast, Column } from "@/components/ui";
import { fetchAPI } from "@/lib/api";
import { formatCurrency, formatDate, parseNumber } from "@/lib/utils";
import { User, getStoredUser, canAccess, getStoredPermissions, Permission } from "@/lib/auth";
import { getIcon } from "@/lib/icons";
import { printInvoice, generateInvoiceHTML, getSettings } from "@/lib/invoice-utils";

interface Product {
    id: number;
    name: string;
    barcode: string;
    stock: number;
    selling_price: number;
    unit_type: string;
    units_per_package: number;
    package_price: number;
}

interface InvoiceItem {
    product_id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    unit_type: string;
    subtotal: number;
}

interface Invoice {
    id: number;
    invoice_number: string;
    total_amount: number;
    payment_type: string;
    customer_name?: string;
    created_at: string;
    items?: InvoiceItem[];
}

export default function SalesPage() {
    const [user, setUser] = useState<User | null>(null);
    const [permissions, setPermissions] = useState<Permission[]>([]);

    // Products
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    // Invoice form
    const [quantity, setQuantity] = useState("1");
    const [unitType, setUnitType] = useState("piece");
    const [unitPrice, setUnitPrice] = useState("");
    const [subtotal, setSubtotal] = useState(0);

    // Current invoice items
    const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
    const [invoiceNumber, setInvoiceNumber] = useState("");

    // Invoice history
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const itemsPerPage = 10;

    // Dialogs
    const [viewDialog, setViewDialog] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [deleteInvoiceId, setDeleteInvoiceId] = useState<number | null>(null);

    const [isLoading, setIsLoading] = useState(true);

    const loadProducts = useCallback(async () => {
        try {
            const response = await fetchAPI("/api/products");
            setProducts((response.products as Product[]) || []);
        } catch {
            showToast("خطأ في تحميل المنتجات", "error");
        }
    }, []);

    const loadInvoices = useCallback(async (page: number = 1) => {
        try {
            const response = await fetchAPI(`/api/invoices?page=${page}&limit=${itemsPerPage}`);
            setInvoices((response.invoices as Invoice[]) || []);
            setTotalPages(Math.ceil((Number(response.total) || 0) / itemsPerPage));
            setCurrentPage(page);
        } catch {
            showToast("خطأ في تحميل الفواتير", "error");
        }
    }, []);

    const generateInvoiceNumber = useCallback(() => {
        const now = new Date();
        const num = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
        setInvoiceNumber(num);
    }, []);

    useEffect(() => {
        const storedUser = getStoredUser();
        const storedPermissions = getStoredPermissions();
        setUser(storedUser);
        setPermissions(storedPermissions);

        const loadData = async () => {
            await Promise.all([loadProducts(), loadInvoices()]);
            generateInvoiceNumber();
            setIsLoading(false);
        };

        loadData();
    }, [loadProducts, loadInvoices, generateInvoiceNumber]);

    // Calculate subtotal when quantity or price changes
    useEffect(() => {
        const qty = parseNumber(quantity);
        const price = parseNumber(unitPrice);
        setSubtotal(qty * price);
    }, [quantity, unitPrice]);

    // Update price when product or unit type changes
    useEffect(() => {
        if (selectedProduct) {
            if (unitType === "package" && selectedProduct.package_price) {
                setUnitPrice(String(selectedProduct.package_price));
            } else {
                setUnitPrice(String(selectedProduct.selling_price));
            }
        }
    }, [selectedProduct, unitType]);

    const productOptions: SelectOption[] = products.map((p) => ({
        value: p.id,
        label: p.name,
        subtitle: `المخزون: ${p.stock}`,
    }));

    const handleProductSelect = (value: string | number | null) => {
        if (value === null) {
            setSelectedProduct(null);
            setUnitPrice("");
            return;
        }
        const product = products.find((p) => p.id === value);
        if (product) {
            setSelectedProduct(product);
            setUnitType("piece");
            setUnitPrice(String(product.selling_price));
            setQuantity("1");
        }
    };

    const addToInvoice = () => {
        if (!selectedProduct) {
            showToast("يرجى اختيار منتج", "error");
            return;
        }

        const qty = parseNumber(quantity);
        if (qty <= 0) {
            showToast("يرجى إدخال كمية صحيحة", "error");
            return;
        }

        // Check stock
        const stockNeeded = unitType === "package"
            ? qty * (selectedProduct.units_per_package || 1)
            : qty;

        if (stockNeeded > selectedProduct.stock) {
            showToast("الكمية المطلوبة أكبر من المخزون المتاح", "error");
            return;
        }

        const newItem: InvoiceItem = {
            product_id: selectedProduct.id,
            product_name: selectedProduct.name,
            quantity: qty,
            unit_price: parseNumber(unitPrice),
            unit_type: unitType,
            subtotal: subtotal,
        };

        // Check if product already in invoice
        const existingIndex = invoiceItems.findIndex(
            (item) => item.product_id === selectedProduct.id && item.unit_type === unitType
        );

        if (existingIndex >= 0) {
            const updated = [...invoiceItems];
            updated[existingIndex].quantity += qty;
            updated[existingIndex].subtotal += subtotal;
            setInvoiceItems(updated);
        } else {
            setInvoiceItems([...invoiceItems, newItem]);
        }

        // Reset form
        setSelectedProduct(null);
        setQuantity("1");
        setUnitPrice("");
        setSubtotal(0);

        showToast("تمت إضافة المنتج للفاتورة", "success");
    };

    const removeFromInvoice = (index: number) => {
        setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
    };

    const getTotalAmount = () => {
        return invoiceItems.reduce((sum, item) => sum + item.subtotal, 0);
    };

    const finishInvoice = async (paymentType: "cash" | "credit") => {
        if (invoiceItems.length === 0) {
            showToast("الفاتورة فارغة", "error");
            return;
        }

        try {
            const response = await fetchAPI("/api/invoices", {
                method: "POST",
                body: JSON.stringify({
                    invoice_number: invoiceNumber,
                    items: invoiceItems,
                    total_amount: getTotalAmount(),
                    payment_type: paymentType,
                }),
            });

            if (response.success && response.id) {
                showToast("تم حفظ الفاتورة بنجاح. جاري الطباعة...", "success");

                // Auto-print invoice
                try {
                    await printInvoice(response.id as number);
                } catch (printError) {
                    console.error("Print error:", printError);
                    // Don't fail the invoice save if print fails
                }

                // Reset
                setInvoiceItems([]);
                generateInvoiceNumber();
                loadInvoices();
                loadProducts(); // Refresh stock
            } else {
                showToast(response.message || "خطأ في حفظ الفاتورة", "error");
            }
        } catch {
            showToast("خطأ في حفظ الفاتورة", "error");
        }
    };

    const viewInvoice = async (invoice: Invoice) => {
        try {
            const response = await fetchAPI(`/api/invoices/${invoice.id}`);
            setSelectedInvoice((response.invoice as Invoice) || invoice);
            setViewDialog(true);
        } catch {
            showToast("خطأ في تحميل تفاصيل الفاتورة", "error");
        }
    };

    const confirmDeleteInvoice = (id: number) => {
        setDeleteInvoiceId(id);
        setConfirmDialog(true);
    };

    const deleteInvoice = async () => {
        if (!deleteInvoiceId) return;

        try {
            await fetchAPI(`/api/invoices/${deleteInvoiceId}`, { method: "DELETE" });
            showToast("تم حذف الفاتورة", "success");
            loadInvoices(currentPage);
            loadProducts();
        } catch {
            showToast("خطأ في حذف الفاتورة", "error");
        }
    };

    const handlePrintInvoice = async (invoiceId: number) => {
        try {
            await printInvoice(invoiceId);
        } catch (error) {
            showToast(
                error instanceof Error ? error.message : "خطأ في طباعة الفاتورة",
                "error"
            );
        }
    };

    const invoiceColumns: Column<Invoice>[] = [
        { key: "invoice_number", header: "رقم الفاتورة", dataLabel: "رقم الفاتورة" },
        {
            key: "total_amount",
            header: "المبلغ",
            dataLabel: "المبلغ",
            render: (item) => formatCurrency(item.total_amount),
        },
        {
            key: "payment_type",
            header: "نوع الدفع",
            dataLabel: "نوع الدفع",
            render: (item) => (
                <span className={`badge ${item.payment_type === "cash" ? "badge-success" : "badge-warning"}`}>
                    {item.payment_type === "cash" ? "نقدي" : "آجل"}
                </span>
            ),
        },
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
                    <button className="icon-btn view" onClick={() => viewInvoice(item)} title="عرض">
                        {getIcon("eye")}
                    </button>
                    <button
                        className="icon-btn edit"
                        onClick={() => handlePrintInvoice(item.id)}
                        title="طباعة"
                    >
                        {getIcon("print")}
                    </button>
                    {canAccess(permissions, "sales", "delete") && (
                        <button className="icon-btn delete" onClick={() => confirmDeleteInvoice(item.id)} title="حذف">
                            {getIcon("trash")}
                        </button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <MainLayout requiredModule="sales">
            <PageHeader title="المبيعات" user={user} />

            <div className="sales-layout">
                <div className="sales-top-grids">
                    {/* Add Product Form */}
                    <div className="sales-card compact">
                        <div className="card-header-flex">
                            <h3>إضافة منتج للفاتورة</h3>
                            <div className="invoice-badge">
                                <span className="stat-label">رقم الفاتورة</span>
                                <input
                                    type="text"
                                    className="minimal-input"
                                    value={invoiceNumber}
                                    readOnly
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>اختر المنتج</label>
                            <SearchableSelect
                                options={productOptions}
                                value={selectedProduct?.id || null}
                                onChange={handleProductSelect}
                                placeholder="ابحث عن منتج..."
                            />
                        </div>

                        <div className="form-row tight">
                            <div className="form-group">
                                <label>الكمية</label>
                                <input
                                    type="number"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    min="1"
                                />
                            </div>
                            <div className="form-group">
                                <label>نوع الوحدة</label>
                                <select value={unitType} onChange={(e) => setUnitType(e.target.value)}>
                                    <option value="piece">قطعة</option>
                                    <option value="package">صندوق</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-row tight">
                            <div className="form-group">
                                <label>سعر الوحدة</label>
                                <input
                                    type="number"
                                    value={unitPrice}
                                    onChange={(e) => setUnitPrice(e.target.value)}
                                    className="highlight-input"
                                />
                            </div>
                            <div className="form-group">
                                <label>المجموع الفرعي</label>
                                <input
                                    type="text"
                                    value={formatCurrency(subtotal)}
                                    readOnly
                                    className="highlight-input"
                                />
                            </div>
                        </div>

                        <button className="btn btn-primary btn-add" onClick={addToInvoice} style={{ width: "100%" }}>
                            {getIcon("plus")}
                            إضافة للفاتورة
                        </button>
                    </div>

                    {/* Current Invoice Items */}
                    <div className="sales-card">
                        <h3>عناصر الفاتورة الحالية</h3>

                        {invoiceItems.length === 0 ? (
                            <p style={{ textAlign: "center", color: "var(--text-secondary)", padding: "2rem" }}>
                                لا توجد منتجات في الفاتورة
                            </p>
                        ) : (
                            <div className="invoice-items-minimal">
                                {invoiceItems.map((item, index) => (
                                    <div key={index} className="item-row-minimal">
                                        <div>
                                            <span className="item-name-pkg">{item.product_name}</span>
                                            <span style={{ color: "var(--text-secondary)", marginRight: "0.5rem" }}>
                                                ({item.quantity} {item.unit_type === "piece" ? "قطعة" : "صندوق"} × {formatCurrency(item.unit_price)})
                                            </span>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                                            <span style={{ fontWeight: 700 }}>{formatCurrency(item.subtotal)}</span>
                                            <button
                                                className="icon-btn delete"
                                                onClick={() => removeFromInvoice(index)}
                                            >
                                                {getIcon("trash")}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="summary-stat-box">
                            <div className="stat-item">
                                <span className="stat-label">إجمالي الفاتورة</span>
                                <span className="stat-value highlight">{formatCurrency(getTotalAmount())}</span>
                            </div>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button
                                    className="btn btn-success"
                                    onClick={() => finishInvoice("cash")}
                                    disabled={invoiceItems.length === 0}
                                >
                                    نقدي
                                </button>
                                <button
                                    className="btn btn-warning"
                                    onClick={() => finishInvoice("credit")}
                                    disabled={invoiceItems.length === 0}
                                    style={{ background: "var(--warning-color)", color: "white" }}
                                >
                                    آجل
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Invoice History */}
                <div className="sales-card" style={{ marginTop: "2rem" }}>
                    <h3>سجل الفواتير السابقة</h3>
                    <Table
                        columns={invoiceColumns}
                        data={invoices}
                        keyExtractor={(item) => item.id}
                        emptyMessage="لا توجد فواتير"
                        isLoading={isLoading}
                        pagination={{
                            currentPage,
                            totalPages,
                            onPageChange: loadInvoices,
                        }}
                    />
                </div>
            </div>

            {/* View Invoice Dialog */}
            <Dialog
                isOpen={viewDialog}
                onClose={() => setViewDialog(false)}
                title={`فاتورة رقم ${selectedInvoice?.invoice_number || ""}`}
                maxWidth="600px"
            >
                {selectedInvoice && (
                    <div>
                        <div style={{ marginBottom: "1.5rem" }}>
                            <p><strong>التاريخ:</strong> {formatDate(selectedInvoice.created_at)}</p>
                            <p>
                                <strong>نوع الدفع:</strong>{" "}
                                <span className={`badge ${selectedInvoice.payment_type === "cash" ? "badge-success" : "badge-warning"}`}>
                                    {selectedInvoice.payment_type === "cash" ? "نقدي" : "آجل"}
                                </span>
                            </p>
                            {selectedInvoice.customer_name && (
                                <p><strong>العميل:</strong> {selectedInvoice.customer_name}</p>
                            )}
                        </div>

                        <h4 style={{ marginBottom: "1rem" }}>العناصر:</h4>
                        <div className="invoice-items-minimal">
                            {selectedInvoice.items?.map((item, index) => (
                                <div key={index} className="item-row-minimal">
                                    <div>
                                        <span className="item-name-pkg">{item.product_name}</span>
                                        <span style={{ color: "var(--text-secondary)", marginRight: "0.5rem" }}>
                                            ({item.quantity} × {formatCurrency(item.unit_price)})
                                        </span>
                                    </div>
                                    <span style={{ fontWeight: 700 }}>{formatCurrency(item.subtotal)}</span>
                                </div>
                            ))}
                        </div>

                        <div className="summary-stat-box">
                            <div className="stat-item">
                                <span className="stat-label">الإجمالي</span>
                                <span className="stat-value highlight">{formatCurrency(selectedInvoice.total_amount)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </Dialog>

            {/* Confirm Delete Dialog */}
            <ConfirmDialog
                isOpen={confirmDialog}
                onClose={() => setConfirmDialog(false)}
                onConfirm={deleteInvoice}
                title="تأكيد الحذف"
                message="هل أنت متأكد من حذف هذه الفاتورة؟"
                confirmText="حذف"
                confirmVariant="danger"
            />
        </MainLayout>
    );
}

