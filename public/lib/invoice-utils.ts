// Invoice Printing Utilities - Migrated from common.js

import { fetchAPI } from "./api";
import { generateBarcode, generateTLV } from "./api";
import { formatDate } from "./utils";

export interface InvoiceData {
  id: number;
  invoice_number: string;
  total_amount: number;
  created_at: string;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
  salesperson_name?: string;
  customer_name?: string;
  payment_type: "cash" | "credit";
  subtotal?: number;
  vat_amount?: number;
  tax_amount?: number;
  discount_amount?: number;
  discount?: number;
}

export interface InvoiceSettings {
  store_name?: string;
  store_address?: string;
  store_phone?: string;
  tax_number?: string;
  invoice_size?: "thermal" | "a4";
  footer_message?: string;
  currency_symbol?: string;
  show_logo?: boolean;
  show_qr?: boolean;
}

// Global settings cache
let systemSettings: InvoiceSettings | null = null;

/**
 * Get system settings (cached)
 */
export async function getSettings(): Promise<InvoiceSettings> {
  if (systemSettings) return systemSettings;
  try {
    const result = await fetchAPI("/api/settings");
    const data = result.data as InvoiceSettings;
    if (result.success || data.store_name) {
      systemSettings = {
        store_name: data.store_name || data.store_name,
        store_address: data.store_address || data.store_address,
        store_phone: data.store_phone || data.store_phone,
        tax_number: data.tax_number || data.tax_number,
        invoice_size: data.invoice_size || data.invoice_size || "thermal",
        footer_message: data.footer_message || data.footer_message,
        currency_symbol: data.currency_symbol || data.currency_symbol || "ر.س",
        show_logo: data.show_logo !== false,
        show_qr: data.show_qr !== false,
      };
      return systemSettings;
    }
  } catch (e) {
    console.error("Failed to load settings", e);
  }
  return {};
}

/**
 * Simulates checking printer connection for a professional UX
 */
export async function checkPrinterConnection(): Promise<boolean> {
  return new Promise((resolve) => {
    // In a real web app, we might check if a local print agent is responding
    // For now, we simulate success
    setTimeout(() => {
      resolve(true);
    }, 800);
  });
}

/**
 * Generates the HTML content for an invoice based on provided settings and data.
 */
export function generateInvoiceHTML(
  inv: InvoiceData,
  settings: InvoiceSettings,
  qrDataUrl?: string
): string {
  const isThermal = (settings.invoice_size || "thermal") === "thermal";
  const currencySymbol = settings.currency_symbol || "ر.س";

  // Format currency locally for the invoice
  const localFormatCurrency = (amount: number): string => {
    return (
      new Intl.NumberFormat("ar-SA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount) +
      " " +
      currencySymbol
    );
  };

  // E-Invoicing Data Preparation
  const dateObj = inv.created_at ? new Date(inv.created_at) : new Date();
  const isoTimestamp = dateObj.toISOString().split(".")[0] + "Z";
  const formattedTotal = parseFloat(String(inv.total_amount || 0)).toFixed(2);
  const formattedVat = parseFloat(
    String(inv.vat_amount || inv.tax_amount || 0)
  ).toFixed(2);

  // Compute amounts
  const subtotalAmount =
    inv.subtotal !== undefined
      ? parseFloat(String(inv.subtotal))
      : inv.items
      ? inv.items.reduce(
          (s, it) =>
            s +
            parseFloat(
              String(
                (it.subtotal ?? (it.quantity * (it.unit_price || 0))) || 0
              )
            ),
          0
        )
      : parseFloat(String(inv.total_amount || 0));

  const taxAmount =
    inv.vat_amount !== undefined
      ? parseFloat(String(inv.vat_amount))
      : inv.tax_amount !== undefined
      ? parseFloat(String(inv.tax_amount))
      : 0;

  const discountAmount =
    inv.discount_amount !== undefined
      ? parseFloat(String(inv.discount_amount))
      : inv.discount !== undefined
      ? parseFloat(String(inv.discount))
      : 0;

  const finalTotal = parseFloat(
    String(inv.total_amount || subtotalAmount - discountAmount + taxAmount)
  );

  // Generate TLV
  const tlvData = generateTLV({
    1: settings.store_name || "سوبر ماركت",
    2: settings.tax_number || "",
    3: isoTimestamp,
    4: finalTotal.toFixed(2),
    5: (taxAmount || 0).toFixed(2),
  });

  // Generate QR locally if not provided
  const qrUrl = qrDataUrl || generateBarcode(tlvData, isThermal ? 12 : 28);

  const style = `
        <style>
            :root{ --accent: #0f172a; --muted:#6b7280; --surface:#ffffff }
            @page { 
                margin: 0; 
                size: ${isThermal ? "80mm auto" : "A4"};
            }
            body { 
                font-family: 'Cairo', 'Outfit', sans-serif; 
                direction: rtl; 
                margin: 0; 
                padding: ${isThermal ? "6mm" : "18mm"};
                color: #0b1220;
                background: var(--surface);
                line-height: 1.45;
                -webkit-font-smoothing:antialiased;
            }

            .invoice-container{
                width: ${isThermal ? "70mm" : "100%"};
                max-width: ${isThermal ? "70mm" : "820px"};
                margin: 0 auto;
                box-sizing: border-box;
                color: inherit;
            }

            .header{
              text-align:center;
              margin-bottom:14px;
              padding-bottom:10px;
              border-bottom:1px solid #e6e9ef
            }

            .header h1{
              margin:0 0 6px 0;
              font-size:${isThermal ? "1rem" : "1.6rem"};
              font-weight:700;
              color:var(--accent)
            }
            .header p{
              margin:0;
              font-size:0.85rem;
              color:var(--muted)
            }

            .invoice-meta{
              display:flex;
              justify-content:space-between;
              gap:12px;
              margin:14px 0;
              font-size:0.86rem
            }
            .invoice-meta div{
              color:var(--muted)
            }

            table{ width:100%;
              border-collapse:collapse;
              margin-bottom:14px;
              font-size:0.9rem
            }
            thead th{ text-align:right;
              font-weight:700;
              padding:8px 6px;
              background:#f7fafc;
              color:#0b1220;
              border-bottom:1px solid #e6e9ef }
            tbody td{
              padding:10px 6px;
              border-bottom:1px solid #f1f5f9;
              vertical-align:middle
            }

            tbody tr:nth-child(even) td{
              background: #fbfdff
            }

            td.numeric{
              text-align:left;
              font-variant-numeric: tabular-nums
            }
            td.center{
              text-align:center
            }

            .totals{
              margin-top:10px;
              padding-top:10px;
              border-top:1px solid #e6e9ef
            }
            .total-row{
              display:flex;
              justify-content:space-between;
              align-items:center;
              padding:6px 0;
              color:var(--muted)
            }
            .total-row small{
              display:block;
              font-size:0.8rem;
              color:#94a3b8 }

            .total-row.grand-total{
              font-weight:800;
              font-size:1.05rem;
              color:var(--accent);
              border-top:2px dashed #e6e9ef;
              padding-top:10px
            }

            .footer{
              text-align:center;
              margin-top:22px;
              font-size:0.82rem;
              color:var(--muted);
              border-top:1px dashed #e6e9ef;
              padding-top:12px
            }

            .barcode{
              margin:16px auto;
              display:block;
              max-width: 100%;
              height:50px;
            }

            .watermark{
              position:fixed;
              bottom:10px;
              left:10px;
              font-size:0.62rem;
              color:#e6e9ef
            }

            @media print{
                body{
                  padding:${isThermal ? "2mm" : "15mm"}
                }
                .invoice-container{
                  width:100%
                }
                thead th{
                  background-color:#f7fafc;
                  -webkit-print-color-adjust:exact
                }
            }
        </style>
    `;

  return `
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Invoice ${inv.invoice_number}</title>
            ${style}
        </head>
        <body>
            <div class="invoice-container">
                <div class="header">
                    <h1>${settings.store_name || "سوبر ماركت"}</h1>
                    <p>${settings.store_address || ""}</p>
                    <p>هاتف: ${settings.store_phone || ""}</p>
                    ${
                      settings.tax_number
                        ? `<p>الرقم الضريبي: <strong>${settings.tax_number}</strong></p>`
                        : ""
                    }
                </div>

                <div class="invoice-meta">
                    <div>
                        <strong>رقم الفاتورة:</strong> #${inv.invoice_number}
                    </div>
                    <div>
                        <strong>التاريخ:</strong> ${formatDate(inv.created_at)}
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>الصنف</th>
                            <th style="text-align:center">الكمية</th>
                            <th style="text-align:left">السعر</th>
                            <th style="text-align:left">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${inv.items
                          .map(
                            (i) => `
                            <tr>
                                <td>${i.product_name}</td>
                                <td style="text-align:center">${i.quantity}</td>
                                <td style="text-align:left">${localFormatCurrency(i.unit_price)}</td>
                                <td style="text-align:left">${localFormatCurrency(i.subtotal)}</td>
                            </tr>
                        `
                          )
                          .join("")}
                    </tbody>
                </table>

                <div class="totals">
                    <div class="total-row grand-total">
                        <span>الإجمالي النهائي:</span>
                        <span>${localFormatCurrency(finalTotal)}</span>
                    </div>
                </div>

                <div class="footer">
                    ${settings.show_qr !== false ? `<img src="${qrUrl}" class="barcode" alt="Barcode">` : ""}

                    <p><strong>${
                      settings.footer_message || "شكراً لزيارتكم!"
                    }</strong></p>
                    <p>الموظف: ${inv.salesperson_name || "المسؤول"}</p>
                    <p style="font-size: 0.7rem;
              color: #777;">نظام إدارة السوبر ماركت الذكي</p>
                </div>
            </div>
            <div class="watermark">Supermarket System v1.0</div>
        </body>
        </html>
    `;
}

/**
 * Print invoice by creating an iframe and triggering print dialog
 */
export async function printInvoice(invoiceId: number): Promise<void> {
  // Verify printer connection (simulated)
  const isPrinterReady = await checkPrinterConnection();
  if (!isPrinterReady) {
    throw new Error("فشل الاتصال بالطابعة. يرجى التحقق من الكابلات.");
  }

  // Get settings
  const settings = await getSettings();

  // Fetch invoice details
  const response = await fetchAPI(`/api/invoices/${invoiceId}`);
  if (!response.success && !response.invoice) {
    throw new Error("فشل تحميل تفاصيل الفاتورة");
  }

  const inv = response.invoice as InvoiceData;

  // Generate invoice HTML
  const content = generateInvoiceHTML(inv, settings);

  // Create iframe for printing
  const printFrame = document.createElement("iframe");
  printFrame.style.display = "none";
  document.body.appendChild(printFrame);

  try {
    printFrame.contentDocument?.open();
    printFrame.contentDocument?.write(content);
    printFrame.contentDocument?.close();

    // Wait for images to load
    const waitForImages = (): Promise<void> => {
      return new Promise((resolve) => {
        const imgs = printFrame.contentDocument?.images;
        if (!imgs || imgs.length === 0) return resolve();
        let remaining = imgs.length;
        for (const img of Array.from(imgs)) {
          if (img.complete) {
            remaining--;
            if (remaining === 0) return resolve();
          } else {
            img.addEventListener("load", () => {
              remaining--;
              if (remaining === 0) resolve();
            });
            img.addEventListener("error", () => {
              remaining--;
              if (remaining === 0) resolve();
            });
          }
        }
      });
    };

    await waitForImages();

    // Trigger print
    printFrame.contentWindow?.focus();
    printFrame.contentWindow?.print();

    // Auto-cleanup
    setTimeout(() => {
      if (printFrame.parentNode) {
        document.body.removeChild(printFrame);
      }
    }, 1000);
  } catch (e) {
    console.error("Print error", e);
    throw new Error("خطأ أثناء تحضير الفاتورة للطباعة");
  }
}

