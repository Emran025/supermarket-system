"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MainLayout, PageHeader } from "@/components/layout";
import { Table, Dialog, ConfirmDialog, showToast, Column, showAlert } from "@/components/ui";
import { fetchAPI } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, parseNumber } from "@/lib/utils";
import { User, getStoredUser, canAccess, getStoredPermissions, Permission, checkAuth } from "@/lib/auth";
import { Icon } from "@/lib/icons";
import { printInvoice, generateInvoiceHTML, getSettings } from "@/lib/invoice-utils";

interface Product {
  id: number;
  name: string;
  barcode?: string;
  stock_quantity: number;
  unit_price: number;
  items_per_unit: number;
  unit_name: string;
  sub_unit_name: string;
  latest_purchase_price?: number;
  minimum_profit_margin?: number;
}

interface Pagination {
  total_records: number;
  total_pages: number;
  current_page: number;
}
interface Customer {
  id: number;
  name: string;
  phone?: string;
}

interface InvoiceItem {
  product_id: number;
  product_name: string;
  display_name: string;
  quantity: number;
  unit_type: "sub" | "main";
  unit_name: string;
  total_sub_units: number;
  unit_price: number;
  subtotal: number;
}

interface Invoice {
  id: number;
  invoice_number: string;
  total_amount: number;
  amount_paid: number;
  customer_name?: string;
  customer_phone?: string;
  customer_tax?: string;
  created_at: string;
  items?: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
  subtotal?: number;
  discount_amount?: number;
  payment_type: string;
}

export default function DeferredSalesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);

  // Products
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [productOptionsVisible, setProductOptionsVisible] = useState(false);
  const productSearchRef = useRef<HTMLDivElement>(null);

  // Customers
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [customerOptionsVisible, setCustomerOptionsVisible] = useState(false);
  const customerSearchRef = useRef<HTMLDivElement>(null);

  // Invoice form
  const [quantity, setQuantity] = useState("1");
  const [unitType, setUnitType] = useState<"sub" | "main">("sub");
  const [unitPrice, setUnitPrice] = useState("");
  const [itemStock, setItemStock] = useState("");
  const [subtotal, setSubtotal] = useState(0);
  const [discountValue, setDiscountValue] = useState("0");
  const [discountType, setDiscountType] = useState<"fixed" | "percent">("fixed");
  const [amountPaid, setAmountPaid] = useState("");

  // Current invoice items
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");

  // Invoice history
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;

  // Dialogs
  const [viewDialog, setViewDialog] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [deleteInvoiceId, setDeleteInvoiceId] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const itemsTotal = invoiceItems.reduce((sum, item) => sum + item.subtotal, 0);

  const calculatedDiscount = useCallback(() => {
    const val = parseNumber(discountValue);
    if (discountType === "percent") {
      return (itemsTotal * val) / 100;
    }
    return val;
  }, [discountValue, discountType, itemsTotal]);

  const finalTotal = (itemsTotal - calculatedDiscount()) * 1.15;

  const generateInvoiceNumber = useCallback(() => {
    const num = "INV-" + Date.now().toString().slice(-8);
    setInvoiceNumber(num);
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const response = await fetchAPI(`products?include_purchase_price=1`);
      if (response.success && response.data) {
        const filtered = (response.data as Product[]).filter((p) => p.stock_quantity > 0);
        setProducts(filtered);
      }
    } catch (error) {
      showAlert("alert-container", "خطأ في تحميل المنتجات", "error");
    }
  }, []);

  const loadCustomers = useCallback(async (search: string = "") => {
    if (search.length < 2) {
      setCustomers([]);
      return;
    }
    try {
      const response = await fetchAPI(`ar_customers?limit=10&search=${encodeURIComponent(search)}`);
      if (response.success && response.data) {
        setCustomers(response.data as Customer[]);
      }
    } catch {
      // Ignore errors
    }
  }, []);

  const loadInvoices = useCallback(async (page: number = 1) => {
    try {
      setIsLoading(true);
      const response = await fetchAPI(`invoices?page=${page}&limit=${itemsPerPage}&payment_type=credit`);
      if (response.success && response.data) {
        setInvoices(response.data as Invoice[]);

        setTotalPages((response.pagination as any)?.total_pages || 1);
        setCurrentPage(page);
      }
    } catch {
      showAlert("alert-container", "خطأ في تحميل السجل", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const authenticated = await checkAuth();
      if (!authenticated) return;

      const storedUser = getStoredUser();
      const storedPermissions = getStoredPermissions();
      setUser(storedUser);
      setPermissions(storedPermissions);

      await Promise.all([loadProducts(), loadInvoices()]);
      generateInvoiceNumber();
      setIsLoading(false);
    };
    init();
  }, [loadProducts, loadInvoices, generateInvoiceNumber]);

  // Customer search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers(customerSearchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearchTerm, loadCustomers]);

  // Calculate subtotal
  useEffect(() => {
    if (!selectedProduct) {
      setSubtotal(0);
      return;
    }
    const qty = parseNumber(quantity);
    const price = parseNumber(unitPrice);
    let calcSubtotal = 0;
    if (unitType === "main") {
      calcSubtotal = qty * price * (selectedProduct.items_per_unit || 1);
    } else {
      calcSubtotal = qty * price;
    }
    setSubtotal(calcSubtotal);
  }, [quantity, unitPrice, unitType, selectedProduct]);

  // Update stock and price when product selected
  useEffect(() => {
    if (selectedProduct) {
      const cartItemEntries = invoiceItems.filter(
        (item) => item.product_id === selectedProduct.id
      );
      const cartQtyInSubUnits = cartItemEntries.reduce(
        (sum, item) => sum + item.total_sub_units,
        0
      );
      const availableStock = selectedProduct.stock_quantity - cartQtyInSubUnits;
      setItemStock(String(availableStock));

      setUnitPrice(String(selectedProduct.unit_price));
      setQuantity("1");

      if (availableStock <= 0) {
        setQuantity("0");
      }
    } else {
      setItemStock("");
      setUnitPrice("");
      setQuantity("1");
    }
  }, [selectedProduct, invoiceItems]);

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (productSearchRef.current && !productSearchRef.current.contains(e.target as Node)) {
        setProductOptionsVisible(false);
      }
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) {
        setCustomerOptionsVisible(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
      (p.barcode && p.barcode.includes(productSearchTerm))
  ).slice(0, 50);

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setProductSearchTerm(product.name);
    setProductOptionsVisible(false);
  };

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearchTerm(customer.name);
    setCustomerOptionsVisible(false);
  };

  const calculateSubtotal = () => {
    if (!selectedProduct) return;
    const qty = parseNumber(quantity);
    const price = parseNumber(unitPrice);
    let calcSubtotal = 0;
    if (unitType === "main") {
      calcSubtotal = qty * price * (selectedProduct.items_per_unit || 1);
    } else {
      calcSubtotal = qty * price;
    }
    setSubtotal(calcSubtotal);
  };

  const addItemToInvoice = async () => {
    if (!selectedProduct) {
      showAlert("alert-container", "يرجى اختيار منتج أولاً", "error");
      return;
    }

    const qty = parseNumber(quantity);
    const price = parseNumber(unitPrice);
    const itemsPerUnit = selectedProduct.items_per_unit || 1;
    const totalSubUnits = unitType === "main" ? qty * itemsPerUnit : qty;

    // Validate stock
    const cartItemEntries = invoiceItems.filter(
      (item) => item.product_id === selectedProduct.id
    );
    const cartQtyInSubUnits = cartItemEntries.reduce(
      (sum, item) => sum + item.total_sub_units,
      0
    );
    const totalQtyInSubUnits = cartQtyInSubUnits + totalSubUnits;

    if (qty <= 0 || totalQtyInSubUnits > selectedProduct.stock_quantity) {
      showAlert(
        "alert-container",
        `الكمية غير صحيحة. المخزون المتاح: ${selectedProduct.stock_quantity - cartQtyInSubUnits}`,
        "error"
      );
      return;
    }

    // Check minimum profit margin
    const latestPurchasePrice = parseNumber(selectedProduct.latest_purchase_price);
    const minProfitMargin = parseNumber(selectedProduct.minimum_profit_margin);
    const minAllowedPrice = latestPurchasePrice + minProfitMargin;

    if (latestPurchasePrice > 0 && price < minAllowedPrice) {
      const confirmMsg = `تحذير: السعر (${formatCurrency(price)}) أقل من الحد الأدنى للبيع (${formatCurrency(minAllowedPrice)}).\n(سعر الشراء: ${formatCurrency(latestPurchasePrice)} + هامش الربح: ${formatCurrency(minProfitMargin)})\n\nهل تريد الاستمرار؟`;
      const confirmed = window.confirm(confirmMsg);
      if (!confirmed) {
        return;
      }
    }

    const calcSubtotal = unitType === "main" ? qty * price * itemsPerUnit : qty * price;
    const unitName = unitType === "main" ? selectedProduct.unit_name : selectedProduct.sub_unit_name;

    const newItem: InvoiceItem = {
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      display_name: `${selectedProduct.name} (${qty} ${unitName})`,
      quantity: qty,
      unit_type: unitType,
      unit_name: unitName,
      total_sub_units: totalSubUnits,
      unit_price: price,
      subtotal: calcSubtotal,
    };

    setInvoiceItems([...invoiceItems, newItem]);

    // Reset form
    setSelectedProduct(null);
    setProductSearchTerm("");
    setQuantity("1");
    setUnitPrice("");
    setItemStock("");
  };

  const removeInvoiceItem = (index: number) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  };


  const finishInvoice = async () => {
    if (invoiceItems.length === 0) {
      showAlert("alert-container", "الفاتورة فارغة!", "error");
      return;
    }

    if (!selectedCustomer) {
      showAlert("alert-container", "يرجى اختيار العميل للفاتورة الآجلة", "error");
      return;
    }

    try {
      const invoiceData = {
        invoice_number: invoiceNumber,
        items: invoiceItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.total_sub_units,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
        })),
        payment_type: "credit",
        customer_id: selectedCustomer.id,
        amount_paid: parseNumber(amountPaid),
        discount_amount: calculatedDiscount(),
        subtotal: itemsTotal,
      };

      const response = await fetchAPI("invoices", {
        method: "POST",
        body: JSON.stringify(invoiceData),
      });

      if (response.success) {
        showAlert("alert-container", "تمت العملية بنجاح. جاري الطباعة...", "success");

        // Auto-print
        if (response.id) {
          try {
            await printInvoice(response.id as number);
          } catch (printError) {
            console.error("Print error:", printError);
          }
        }

        // Reset
        setInvoiceItems([]);
        setDiscountValue("0");
        setSelectedCustomer(null);
        setCustomerSearchTerm("");
        setAmountPaid("");
        generateInvoiceNumber();
        await loadProducts();
        await loadInvoices();
      } else {
        showAlert("alert-container", response.message || "فشل حفظ الفاتورة", "error");
      }
    } catch (error) {
      showAlert("alert-container", "خطأ: " + (error instanceof Error ? error.message : "خطأ غير معروف"), "error");
    }
  };

  const viewInvoice = async (id: number) => {
    try {
      const response = await fetchAPI(`invoice_details?id=${id}`);
      if (response.success && response.data) {
        setSelectedInvoice(response.data as Invoice);
        setViewDialog(true);
      }
    } catch {
      showAlert("alert-container", "خطأ في جلب التفاصيل", "error");
    }
  };

  const confirmDeleteInvoice = (id: number) => {
    setDeleteInvoiceId(id);
    setConfirmDialog(true);
  };

  const deleteInvoice = async () => {
    if (!deleteInvoiceId) return;

    const confirmed = window.confirm("هل أنت متأكد من حذف هذه الفاتورة؟ سيتم إرجاع المنتجات للمخزون.");
    if (!confirmed) {
      setConfirmDialog(false);
      setDeleteInvoiceId(null);
      return;
    }

    try {
      const response = await fetchAPI(`invoices?id=${deleteInvoiceId}`, {
        method: "DELETE",
      });
      if (response.success) {
        showAlert("alert-container", "تم الحذف بنجاح", "success");
        await loadInvoices();
        await loadProducts();
      } else {
        showAlert("alert-container", response.message || "فشل الحذف", "error");
      }
    } catch {
      showAlert("alert-container", "خطأ في الحذف", "error");
    } finally {
      setConfirmDialog(false);
      setDeleteInvoiceId(null);
    }
  };

  const invoiceColumns: Column<Invoice>[] = [
    {
      key: "invoice_number",
      header: "رقم الفاتورة",
      dataLabel: "رقم الفاتورة",
      render: (item) => (
        <>
          <strong>{item.invoice_number}</strong>{" "}
          <span className="badge badge-warning" style={{ fontSize: "0.7em" }}>
            آجل
          </span>
        </>
      ),
    },
    {
      key: "total_amount",
      header: "المبلغ الإجمالي",
      dataLabel: "المبلغ الإجمالي",
      render: (item) => formatCurrency(item.total_amount),
    },
    {
      key: "amount_paid",
      header: "المدفوع / المتبقي",
      dataLabel: "المدفوع / المتبقي",
      render: (item) => (
        <div style={{ fontSize: "0.85rem" }}>
          <span className="text-success">{formatCurrency(item.amount_paid || 0)}</span> /{" "}
          <span className="text-danger">
            {formatCurrency(item.total_amount - (item.amount_paid || 0))}
          </span>
        </div>
      ),
    },
    {
      key: "customer_name",
      header: "العميل",
      dataLabel: "العميل",
      render: (item) => item.customer_name || "-",
    },
    {
      key: "created_at",
      header: "التاريخ والوقت",
      dataLabel: "التاريخ والوقت",
      render: (item) => formatDateTime(item.created_at),
    },
    {
      key: "actions",
      header: "الإجراءات",
      dataLabel: "الإجراءات",
      render: (item) => {
        const hoursDiff = (new Date().getTime() - new Date(item.created_at).getTime()) / (1000 * 60 * 60);
        const canDelete = hoursDiff < 48;
        return (
          <div className="action-buttons">
            <button className="icon-btn view" onClick={() => viewInvoice(item.id)} title="عرض">
              <Icon name="eye" />
            </button>
            {canDelete && canAccess(permissions, "sales", "delete") && (
              <button
                className="icon-btn delete"
                onClick={() => confirmDeleteInvoice(item.id)}
                title="حذف"
              >
                <Icon name="trash" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <MainLayout requiredModule="deferred_sales">
      <PageHeader title="المبيعات الآجلة (ذمم)" user={user} />

      <div id="alert-container"></div>

      <div className="sales-layout">
        <div className="sales-top-grids">
          {/* Left: Input Panels */}
          <div className="side-panel">
            <div className="sales-card compact animate-slide">
              <div className="card-header-flex" style={{ marginBottom: "1rem" }}>
                <h3 style={{ margin: 0 }}>إضافة منتجات</h3>
                <div className="invoice-badge">
                  <span className="stat-label">رقم الفاتورة:</span>
                  <input
                    type="text"
                    id="invoice-number"
                    value={invoiceNumber}
                    readOnly
                    className="minimal-input"
                  />
                </div>
              </div>

              <form
                id="invoice-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  addItemToInvoice();
                }}
              >
                <div className="form-group">
                  <label htmlFor="product-select">اختر المنتج *</label>
                  <div className="searchable-select" id="product-search-container" ref={productSearchRef}>
                    <input
                      type="text"
                      id="product-search-input"
                      value={productSearchTerm}
                      onChange={(e) => {
                        setProductSearchTerm(e.target.value);
                        setProductOptionsVisible(true);
                      }}
                      onFocus={() => setProductOptionsVisible(true)}
                      placeholder="ابحث عن منتج..."
                      autoComplete="off"
                    />
                    <div
                      className={`options-list ${productOptionsVisible ? "active" : ""}`}
                      id="product-options-list"
                    >
                      {filteredProducts.length === 0 ? (
                        <div className="no-results">لا توجد منتجات مطابقة</div>
                      ) : (
                        filteredProducts.map((product) => (
                          <div
                            key={product.id}
                            className="option-item"
                            onClick={() => handleProductSelect(product)}
                          >
                            <span className="option-name">{product.name}</span>
                            <span className="option-stock">
                              {product.stock_quantity} {product.sub_unit_name || "حبة"}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                    <input type="hidden" id="product-select" value={selectedProduct?.id || ""} required />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="item-unit-type">نوع الوحدة</label>
                    <select
                      id="item-unit-type"
                      value={unitType}
                      onChange={(e) => {
                        setUnitType(e.target.value as "sub" | "main");
                        calculateSubtotal();
                      }}
                      className="glass"
                    >
                      <option value="sub">{selectedProduct?.sub_unit_name || "حبة"}</option>
                      <option value="main">
                        {selectedProduct?.unit_name || "كرتون"} (
                        {selectedProduct?.items_per_unit || 1}{" "}
                        {selectedProduct?.sub_unit_name || "حبة"})
                      </option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="item-stock">المخزون المتوفر</label>
                    <input
                      type="text"
                      id="item-stock"
                      value={itemStock}
                      readOnly
                      className="glass highlight-input"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="item-quantity">الكمية *</label>
                    <input
                      type="number"
                      id="item-quantity"
                      min="1"
                      value={quantity}
                      onChange={(e) => {
                        setQuantity(e.target.value);
                        calculateSubtotal();
                      }}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="item-unit-price">سعر بيع الوحدة *</label>
                    <input
                      type="number"
                      id="item-unit-price"
                      step="0.01"
                      min="0"
                      value={unitPrice}
                      onChange={(e) => {
                        setUnitPrice(e.target.value);
                        calculateSubtotal();
                      }}
                      required
                    />
                  </div>
                </div>

                <div className="summary-stat-box" style={{ marginTop: "1rem" }}>
                  <div className="stat-item">
                    <span className="stat-label">المجموع الفرعي</span>
                    <span id="item-subtotal" className="stat-value highlight">
                      {formatCurrency(subtotal)}
                    </span>
                  </div>
                  <button type="button" className="btn btn-primary btn-add" onClick={addItemToInvoice} data-icon="plus">
                    إضافة
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right: Customer Info & Current Invoice Items */}
          <div className="side-panel" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Card 1: Customer Info */}
            <div className="sales-card compact animate-slide">
              <h3>بيانات العميل</h3>
              <div className="form-row" style={{ marginTop: "1rem" }}>
                <div className="form-group">
                  <label htmlFor="customer-select">اختر العميل *</label>
                  <div className="searchable-select" id="customer-search-container" ref={customerSearchRef}>
                    <input
                      type="text"
                      id="customer-search-input"
                      value={customerSearchTerm}
                      onChange={(e) => {
                        setCustomerSearchTerm(e.target.value);
                        setCustomerOptionsVisible(true);
                      }}
                      onFocus={() => {
                        if (customerSearchTerm.length >= 2) {
                          setCustomerOptionsVisible(true);
                        }
                      }}
                      placeholder="ابحث عن عميل..."
                      autoComplete="off"
                    />
                    <div
                      className={`options-list ${customerOptionsVisible ? "active" : ""}`}
                      id="customer-options-list"
                    >
                      {customers.length === 0 ? (
                        <div className="no-results">لا يوجد عملاء</div>
                      ) : (
                        customers.map((customer) => (
                          <div
                            key={customer.id}
                            className="option-item"
                            onClick={() => handleCustomerSelect(customer)}
                          >
                            <span className="option-name">{customer.name}</span>
                            {customer.phone && <span className="option-stock">{customer.phone}</span>}
                          </div>
                        ))
                      )}
                    </div>
                    <input type="hidden" id="customer-select" value={selectedCustomer?.id || ""} required />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="amount-paid">المبلغ المدفوع (نقدًا)</label>
                  <input
                    type="number"
                    id="amount-paid"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="highlight-input"
                  />
                </div>
              </div>
              <small style={{ color: "var(--text-light)", display: "block" }}>
                المبلغ الذي سيسدده العميل حالياً من قيمة الفاتورة
              </small>
            </div>

            {/* Card 3: Current Invoice Items */}
            <div className="sales-card animate-slide" style={{ animationDelay: "0.1s" }}>
              <h3>عناصر الفاتورة الحالية</h3>
              <div className="table-container" style={{ maxHeight: "430px", overflowY: "auto" }}>
                <table id="invoice-items-table">
                  <thead>
                    <tr>
                      <th>المنتج</th>
                      <th>الكمية</th>
                      <th>السعر</th>
                      <th>المجموع</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody id="invoice-items-tbody">
                    {invoiceItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          style={{
                            textAlign: "center",
                            padding: "2rem",
                            color: "var(--text-secondary)",
                          }}
                        >
                          لا توجد عناصر مضافة
                        </td>
                      </tr>
                    ) : (
                      invoiceItems.map((item, index) => (
                        <tr key={index} className="animate-slide-up">
                          <td data-label="المنتج">{item.display_name}</td>
                          <td data-label="الكمية">
                            {item.quantity} {item.unit_name}
                          </td>
                          <td data-label="السعر">{formatCurrency(item.unit_price)}</td>
                          <td data-label="المجموع">{formatCurrency(item.subtotal)}</td>
                          <td data-label="الإجراءات">
                            <button className="icon-btn delete" onClick={() => removeInvoiceItem(index)}>
                              <Icon name="trash" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="sales-summary-bar">
                <div className="summary-stat">
                  <span className="stat-label">مجموع العناصر</span>
                  <span className="stat-value">{formatCurrency(itemsTotal)}</span>
                </div>
                
                <div className="summary-stat">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: "4px" }}>
                    <span className="stat-label">الخصم</span>
                    <div className="discount-type-toggle">
                      <button 
                        className={discountType === "fixed" ? "active" : ""} 
                        onClick={() => setDiscountType("fixed")}
                        type="button"
                      >$</button>
                      <button 
                        className={discountType === "percent" ? "active" : ""} 
                        onClick={() => setDiscountType("percent")}
                        type="button"
                      >%</button>
                    </div>
                  </div>
                  <div style={{ position: "relative" }}>
                    <input
                      type="number"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="minimal-input"
                      style={{ width: "100%", textAlign: "center", paddingBottom: "4px" }}
                      min="0"
                    />
                    {calculatedDiscount() > 0 && (
                      <div style={{ fontSize: "10px", color: "var(--text-secondary)", position: "absolute", bottom: "-14px", width: "100%", textAlign: "center" }}>
                        مبلغ الخصم: {formatCurrency(calculatedDiscount())}
                      </div>
                    )}
                  </div>
                </div>

                <div className="summary-stat">
                  <span className="stat-label">المبلغ الإجمالي</span>
                  <span id="total-amount" className="stat-value highlight">
                    {formatCurrency(finalTotal)}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={finishInvoice}
                  id="finish-btn"
                  data-icon="check"
                  style={{ height: "100%", padding: "0 2rem" }}
                >
                  حفظ الفاتورة
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Invoice History */}
        <div className="sales-card animate-slide" style={{ animationDelay: "0.2s" }}>
          <h3>سجل الفواتير السابقة</h3>
          <div className="table-container">
            <div className="table-wrapper">
              <Table
                columns={invoiceColumns}
                data={invoices}
                keyExtractor={(item) => item.id}
                emptyMessage="لا توجد فواتير سابقة"
                isLoading={isLoading}
                pagination={{
                  currentPage,
                  totalPages,
                  onPageChange: loadInvoices,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* View Invoice Dialog */}
      <Dialog
        isOpen={viewDialog}
        onClose={() => setViewDialog(false)}
        title="تفاصيل الفاتورة"
      >
        {selectedInvoice && (
          <div id="view-dialog-body">
            <div
              className="invoice-details-header"
              style={{
                marginBottom: "2rem",
                borderBottom: "2px solid var(--border-color)",
                paddingBottom: "1rem",
              }}
            >
              <div className="form-row">
                <div className="summary-stat">
                  <span className="stat-label">رقم الفاتورة</span>
                  <span className="stat-value">{selectedInvoice.invoice_number}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">التاريخ</span>
                  <span className="stat-value">{formatDateTime(selectedInvoice.created_at)}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">نوع الدفع</span>
                  <span className="stat-value">
                    <span className="badge badge-warning">آجل (ذمم)</span>
                  </span>
                </div>
              </div>
              {selectedInvoice.customer_name && (
                <div
                  className="form-row"
                  style={{
                    marginTop: "1rem",
                    background: "var(--surface-hover)",
                    padding: "1rem",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <div className="summary-stat">
                    <span className="stat-label">العميل</span>
                    <span className="stat-value">{selectedInvoice.customer_name}</span>
                  </div>
                  {selectedInvoice.customer_phone && (
                    <div className="summary-stat">
                      <span className="stat-label">الهاتف</span>
                      <span className="stat-value">{selectedInvoice.customer_phone}</span>
                    </div>
                  )}
                  {selectedInvoice.customer_tax && (
                    <div className="summary-stat">
                      <span className="stat-label">الرقم الضريبي</span>
                      <span className="stat-value">{selectedInvoice.customer_tax}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="form-row" style={{ marginTop: "1rem" }}>
                <div className="summary-stat">
                  <span className="stat-label">المبلغ المدفوع</span>
                  <span className="stat-value" style={{ color: "var(--success-color)" }}>
                    {formatCurrency(selectedInvoice.amount_paid || 0)}
                  </span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">المبلغ المتبقي</span>
                  <span className="stat-value" style={{ color: "var(--danger-color)", fontWeight: 700 }}>
                    {formatCurrency(selectedInvoice.total_amount - (selectedInvoice.amount_paid || 0))}
                  </span>
                </div>
              </div>
            </div>

            <div className="invoice-items-minimal">
              <h4 style={{ marginBottom: "1rem" }}>المنتجات المباعة:</h4>
              {selectedInvoice.items?.map((item, index) => (
                <div key={index} className="item-row-minimal">
                  <div className="item-info-pkg">
                    <span className="item-name-pkg">{item.product_name}</span>
                    <span className="item-meta-pkg">سعر الوحدة: {formatCurrency(item.unit_price)}</span>
                  </div>
                  <div className="item-info-pkg" style={{ textAlign: "left" }}>
                    <span className="item-name-pkg">{formatCurrency(item.subtotal)}</span>
                    <span className="item-meta-pkg">الكمية: {item.quantity}</span>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="sales-summary-bar"
              style={{ marginTop: "2rem", background: "var(--grad-primary)", color: "white" }}
            >
              <div className="summary-stat">
                <span className="stat-label" style={{ color: "rgba(255,255,255,0.8)" }}>
                  مجموع العناصر: {formatCurrency(selectedInvoice.subtotal || 0)}
                </span>
                {selectedInvoice.discount_amount && selectedInvoice.discount_amount > 0 && (
                  <span className="stat-label" style={{ color: "rgba(255,255,255,0.8)" }}>
                    الخصم: {formatCurrency(selectedInvoice.discount_amount)}
                  </span>
                )}
                <span className="stat-label" style={{ color: "rgba(255,255,255,0.8)" }}>
                  المبلغ الإجمالي (شامل الضريبة)
                </span>
                <span className="stat-value highlight" style={{ color: "white" }}>
                  {formatCurrency(selectedInvoice.total_amount)}
                </span>
              </div>
              <button
                type="button"
                className="btn"
                style={{ background: "white", color: "var(--primary-color)" }}
                onClick={async () => {
                  if (selectedInvoice.id) {
                    try {
                      await printInvoice(selectedInvoice.id);
                    } catch (error) {
                      console.error("Print error:", error);
                    }
                  }
                }}
              >
                <Icon name="print" /> طباعة نسخة
              </button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog}
        onClose={() => {
          setConfirmDialog(false);
          setDeleteInvoiceId(null);
        }}
        onConfirm={deleteInvoice}
        title="تأكيد الحذف"
        message="هل أنت متأكد من حذف هذه الفاتورة؟ سيتم إرجاع المنتجات للمخزون."
        confirmText="نعم، متابعة"
        confirmVariant="primary"
      />
    </MainLayout>
  );
}
