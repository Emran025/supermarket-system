"use client";

import { useState, useEffect, useCallback } from "react";
import { MainLayout, PageHeader } from "@/components/layout";
import { Table, Dialog, ConfirmDialog, SearchableSelect, SelectOption, showToast, Column } from "@/components/ui";
import { fetchAPI } from "@/lib/api";
import { formatCurrency, formatDate, parseNumber } from "@/lib/utils";
import { User, getStoredUser, canAccess, getStoredPermissions, Permission } from "@/lib/auth";
import { getIcon } from "@/lib/icons";
import { printInvoice } from "@/lib/invoice-utils";

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

interface Customer {
  id: number;
  name: string;
  phone?: string;
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
  amount_paid: number;
  remaining_amount: number;
  customer_name?: string;
  customer_id?: number;
  created_at: string;
  items?: InvoiceItem[];
}

export default function DeferredSalesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  
  // Products
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Customers
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  
  // Invoice form
  const [quantity, setQuantity] = useState("1");
  const [unitType, setUnitType] = useState("piece");
  const [unitPrice, setUnitPrice] = useState("");
  const [subtotal, setSubtotal] = useState(0);
  const [amountPaid, setAmountPaid] = useState("");
  
  // Current invoice items
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  
  // Invoice history
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Dialogs
  const [viewDialog, setViewDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [deleteInvoiceId, setDeleteInvoiceId] = useState<number | null>(null);
  
  // Payment form
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [payments, setPayments] = useState<Array<{ id: number; amount: number; payment_date: string; notes?: string }>>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const itemsPerPage = 10;

  const generateInvoiceNumber = useCallback(() => {
    const now = new Date();
    const num = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    setInvoiceNumber(num);
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const response = await fetchAPI("/api/products");
      setProducts((response.products as Product[]) || []);
    } catch {
      showToast("خطأ في تحميل المنتجات", "error");
    }
  }, []);

  const loadCustomers = useCallback(async (search: string = "") => {
    try {
      const response = await fetchAPI(`/api/customers?limit=10&search=${encodeURIComponent(search)}`);
      setCustomers((response.customers as Customer[]) || []);
    } catch {
      // Ignore - customers are optional
    }
  }, []);

  const loadInvoices = useCallback(async (page: number = 1, search: string = "") => {
    try {
      setIsLoading(true);
      const response = await fetchAPI(
        `/api/invoices?page=${page}&limit=${itemsPerPage}&payment_type=credit&search=${encodeURIComponent(search)}`
      );
      setInvoices((response.invoices as Invoice[]) || []);
      setTotalPages(Math.ceil((Number(response.total) || 0) / itemsPerPage));
      setCurrentPage(page);
    } catch {
      showToast("خطأ في تحميل الفواتير", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedUser = getStoredUser();
    const storedPermissions = getStoredPermissions();
    setUser(storedUser);
    setPermissions(storedPermissions);
    
    const loadData = async () => {
      await Promise.all([loadProducts(), loadCustomers(), loadInvoices()]);
      generateInvoiceNumber();
      setIsLoading(false);
    };
    
    loadData();
  }, [loadProducts, loadCustomers, loadInvoices, generateInvoiceNumber]);

  // Customer search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (customerSearchTerm.length >= 2) {
        loadCustomers(customerSearchTerm);
      } else {
        setCustomers([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearchTerm, loadCustomers]);

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

  const customerOptions: SelectOption[] = customers.map((c) => ({
    value: c.id,
    label: c.name,
    subtitle: c.phone || "",
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

  const handleCustomerSelect = (value: string | number | null) => {
    if (value === null) {
      setSelectedCustomer(null);
      return;
    }
    const customer = customers.find((c) => c.id === value);
    if (customer) {
      setSelectedCustomer(customer);
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

  const finishInvoice = async () => {
    if (invoiceItems.length === 0) {
      showToast("الفاتورة فارغة", "error");
      return;
    }

    if (!selectedCustomer) {
      showToast("يرجى اختيار العميل للفاتورة الآجلة", "error");
      return;
    }

    try {
      const response = await fetchAPI("/api/invoices", {
        method: "POST",
        body: JSON.stringify({
          invoice_number: invoiceNumber,
          items: invoiceItems,
          total_amount: getTotalAmount(),
          payment_type: "credit",
          customer_id: selectedCustomer.id,
          amount_paid: parseNumber(amountPaid) || 0,
        }),
      });

      if (response.success && response.id) {
        showToast("تم حفظ الفاتورة بنجاح. جاري الطباعة...", "success");
        
        // Auto-print invoice
        try {
          await printInvoice(response.id as number);
        } catch (printError) {
          console.error("Print error:", printError);
        }
        
        // Reset
        setInvoiceItems([]);
        setSelectedCustomer(null);
        setAmountPaid("");
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
      const invoiceData = (response.invoice as Invoice) || invoice;
      setSelectedInvoice(invoiceData);
      
      // Load payments if available
      try {
        const paymentsResponse = await fetchAPI(`/api/deferred-sales/${invoice.id}/payments`);
        setPayments((paymentsResponse.payments as typeof payments) || []);
      } catch {
        setPayments([]);
      }
      
      setViewDialog(true);
    } catch {
      showToast("خطأ في تحميل تفاصيل الفاتورة", "error");
    }
  };

  const openPaymentDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPaymentAmount("");
    setPaymentNotes("");
    setPaymentDialog(true);
  };

  const submitPayment = async () => {
    if (!selectedInvoice || !paymentAmount) {
      showToast("يرجى إدخال مبلغ الدفعة", "error");
      return;
    }

    const amount = parseFloat(paymentAmount);
    const remaining = selectedInvoice.total_amount - (selectedInvoice.amount_paid || 0);
    if (amount <= 0 || amount > remaining) {
      showToast("مبلغ الدفعة غير صالح", "error");
      return;
    }

    try {
      await fetchAPI(`/api/deferred-sales/${selectedInvoice.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount,
          notes: paymentNotes,
        }),
      });
      showToast("تم تسجيل الدفعة بنجاح", "success");
      setPaymentDialog(false);
      loadInvoices(currentPage, searchTerm);
    } catch {
      showToast("خطأ في تسجيل الدفعة", "error");
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
      loadInvoices(currentPage, searchTerm);
      loadProducts();
    } catch {
      showToast("خطأ في حذف الفاتورة", "error");
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    loadInvoices(1, value);
  };

  const getStatusBadge = (invoice: Invoice) => {
    const remaining = invoice.total_amount - (invoice.amount_paid || 0);
    if (remaining <= 0) {
      return <span className="badge badge-success">مدفوعة</span>;
    } else if (invoice.amount_paid > 0) {
      return <span className="badge badge-warning">جزئية</span>;
    }
    return <span className="badge badge-danger">معلقة</span>;
  };

  const invoiceColumns: Column<Invoice>[] = [
    { key: "invoice_number", header: "رقم الفاتورة", dataLabel: "رقم الفاتورة" },
    { key: "customer_name", header: "العميل", dataLabel: "العميل" },
    {
      key: "total_amount",
      header: "المبلغ الإجمالي",
      dataLabel: "المبلغ الإجمالي",
      render: (item) => formatCurrency(item.total_amount),
    },
    {
      key: "amount_paid",
      header: "المدفوع",
      dataLabel: "المدفوع",
      render: (item) => (
        <span className="text-success">{formatCurrency(item.amount_paid || 0)}</span>
      ),
    },
    {
      key: "remaining_amount",
      header: "المتبقي",
      dataLabel: "المتبقي",
      render: (item) => (
        <span className="text-danger">
          {formatCurrency(item.total_amount - (item.amount_paid || 0))}
        </span>
      ),
    },
    {
      key: "status",
      header: "الحالة",
      dataLabel: "الحالة",
      render: (item) => getStatusBadge(item),
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
      render: (item) => {
        const remaining = item.total_amount - (item.amount_paid || 0);
        return (
          <div className="action-buttons">
            <button className="icon-btn view" onClick={() => viewInvoice(item)} title="عرض">
              {getIcon("eye")}
            </button>
            {remaining > 0 && canAccess(permissions, "deferred_sales", "edit") && (
              <button className="icon-btn edit" onClick={() => openPaymentDialog(item)} title="تسجيل دفعة">
                {getIcon("dollar")}
              </button>
            )}
            {canAccess(permissions, "sales", "delete") && (
              <button className="icon-btn delete" onClick={() => confirmDeleteInvoice(item.id)} title="حذف">
                {getIcon("trash")}
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const paymentColumns: Column<typeof payments[0]>[] = [
    {
      key: "amount",
      header: "المبلغ",
      dataLabel: "المبلغ",
      render: (item) => formatCurrency(item.amount),
    },
    {
      key: "payment_date",
      header: "التاريخ",
      dataLabel: "التاريخ",
      render: (item) => formatDate(item.payment_date),
    },
    { key: "notes", header: "ملاحظات", dataLabel: "ملاحظات" },
  ];

  return (
    <MainLayout requiredModule="deferred_sales">
      <PageHeader
        title="المبيعات الآجلة"
        user={user}
        searchInput={
          <input
            type="text"
            placeholder="بحث بالعميل أو رقم الفاتورة..."
            value={searchTerm}
            onChange={handleSearch}
            style={{ width: "250px" }}
          />
        }
      />

      <div className="sales-layout">
        <div className="sales-top-grids">
          {/* Left: Add Product Form */}
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

          {/* Right: Customer Info & Current Invoice Items */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Customer Info Card */}
            <div className="sales-card compact">
              <h3>بيانات العميل</h3>
              <div className="form-group">
                <label>اختر العميل *</label>
                <div style={{ position: "relative" }}>
                  <SearchableSelect
                    options={customerOptions}
                    value={selectedCustomer?.id || null}
                    onChange={handleCustomerSelect}
                    placeholder="ابحث عن عميل..."
                  />
                </div>
              </div>
              <div className="form-group">
                <label>المبلغ المدفوع (نقدًا)</label>
                <input
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="highlight-input"
                />
                <small style={{ color: "var(--text-secondary)", display: "block", marginTop: "0.5rem" }}>
                  المبلغ الذي سيسدده العميل حالياً من قيمة الفاتورة
                </small>
              </div>
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
                <button
                  className="btn btn-primary"
                  onClick={finishInvoice}
                  disabled={invoiceItems.length === 0 || !selectedCustomer}
                >
                  حفظ الفاتورة (آجل)
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
            emptyMessage="لا توجد فواتير آجلة"
            isLoading={isLoading}
            pagination={{
              currentPage,
              totalPages,
              onPageChange: (page) => loadInvoices(page, searchTerm),
            }}
          />
        </div>
      </div>

      {/* View Invoice Dialog */}
      <Dialog
        isOpen={viewDialog}
        onClose={() => setViewDialog(false)}
        title={`فاتورة رقم ${selectedInvoice?.invoice_number || ""}`}
        maxWidth="700px"
      >
        {selectedInvoice && (
          <div>
            <div style={{ marginBottom: "1.5rem" }}>
              <p><strong>العميل:</strong> {selectedInvoice.customer_name || "-"}</p>
              <p><strong>التاريخ:</strong> {formatDate(selectedInvoice.created_at)}</p>
              <p><strong>الحالة:</strong> {getStatusBadge(selectedInvoice)}</p>
            </div>

            <div className="summary-stat-box" style={{ marginBottom: "1.5rem" }}>
              <div className="stat-item">
                <span className="stat-label">الإجمالي</span>
                <span className="stat-value">{formatCurrency(selectedInvoice.total_amount)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">المدفوع</span>
                <span className="stat-value text-success">{formatCurrency(selectedInvoice.amount_paid || 0)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">المتبقي</span>
                <span className="stat-value text-danger">
                  {formatCurrency(selectedInvoice.total_amount - (selectedInvoice.amount_paid || 0))}
                </span>
              </div>
            </div>

            {selectedInvoice.items && selectedInvoice.items.length > 0 && (
              <>
                <h4 style={{ marginBottom: "1rem" }}>العناصر:</h4>
                <div className="invoice-items-minimal">
                  {selectedInvoice.items.map((item, index) => (
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
              </>
            )}

            {payments.length > 0 && (
              <>
                <h4 style={{ marginTop: "1.5rem", marginBottom: "1rem" }}>سجل الدفعات:</h4>
                <Table
                  columns={paymentColumns}
                  data={payments}
                  keyExtractor={(item) => item.id}
                  emptyMessage="لا توجد دفعات"
                />
              </>
            )}
          </div>
        )}
      </Dialog>

      {/* Payment Dialog */}
      <Dialog
        isOpen={paymentDialog}
        onClose={() => setPaymentDialog(false)}
        title="تسجيل دفعة جديدة"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setPaymentDialog(false)}>
              إلغاء
            </button>
            <button className="btn btn-primary" onClick={submitPayment}>
              تسجيل الدفعة
            </button>
          </>
        }
      >
        {selectedInvoice && (
          <div>
            <p style={{ marginBottom: "1rem" }}>
              <strong>المتبقي:</strong>{" "}
              <span className="text-danger">
                {formatCurrency(selectedInvoice.total_amount - (selectedInvoice.amount_paid || 0))}
              </span>
            </p>

            <div className="form-group">
              <label htmlFor="paymentAmount">مبلغ الدفعة *</label>
              <input
                type="number"
                id="paymentAmount"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                max={selectedInvoice.total_amount - (selectedInvoice.amount_paid || 0)}
                min="0.01"
                step="0.01"
              />
            </div>

            <div className="form-group">
              <label htmlFor="paymentNotes">ملاحظات</label>
              <textarea
                id="paymentNotes"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                rows={3}
              />
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
