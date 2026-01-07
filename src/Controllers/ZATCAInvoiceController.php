<?php

require_once __DIR__ . '/Controller.php';
require_once __DIR__ . '/../Services/LedgerService.php';

/**
 * ZATCA Phase 2 E-Invoicing Controller
 * 
 * Note: Full implementation requires:
 * - XML generation library (e.g., SimpleXML or DOMDocument)
 * - Cryptographic signing library (e.g., OpenSSL)
 * - ZATCA API integration
 * - Compliance with ZATCA Phase 2 specifications
 */
class ZATCAInvoiceController extends Controller
{
    private $ledgerService;

    public function __construct()
    {
        parent::__construct();
        $this->ledgerService = new LedgerService();
    }

    public function handle()
    {
        if (!is_logged_in()) {
            $this->errorResponse('Unauthorized', 401);
        }

        $method = $_SERVER['REQUEST_METHOD'];

        if ($method === 'GET') {
            $action = $_GET['action'] ?? '';
            if ($action === 'generate') {
                $this->generateEInvoice();
            } elseif ($action === 'sign') {
                $this->signEInvoice();
            } else {
                $this->getEInvoices();
            }
        } elseif ($method === 'POST') {
            $this->submitToZATCA();
        }
    }

    private function getEInvoices()
    {
        $params = $this->getPaginationParams();
        $limit = $params['limit'];
        $offset = $params['offset'];
        $invoice_id = $_GET['invoice_id'] ?? null;

        $where = "WHERE 1=1";
        if ($invoice_id) {
            $inv_esc = intval($invoice_id);
            $where .= " AND invoice_id = $inv_esc";
        }

        $result = mysqli_query(
            $this->conn,
            "SELECT ei.*, i.invoice_number, i.total_amount, i.vat_amount
             FROM zatca_einvoices ei
             JOIN invoices i ON ei.invoice_id = i.id
             $where
             ORDER BY ei.created_at DESC
             LIMIT $limit OFFSET $offset"
        );

        $einvoices = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $einvoices[] = $row;
        }

        $countResult = mysqli_query($this->conn, "SELECT COUNT(*) as total FROM zatca_einvoices $where");
        $total = mysqli_fetch_assoc($countResult)['total'];

        $this->paginatedResponse($einvoices, $total, $params['page'], $params['limit']);
    }

    private function generateEInvoice()
    {
        $invoice_id = intval($_GET['invoice_id'] ?? 0);

        if ($invoice_id <= 0) {
            $this->errorResponse('Invoice ID is required');
        }

        // Get invoice details
        $result = mysqli_query(
            $this->conn,
            "SELECT i.*, c.name as customer_name, c.tax_number as customer_tax, c.address as customer_address
             FROM invoices i
             LEFT JOIN ar_customers c ON i.customer_id = c.id
             WHERE i.id = $invoice_id"
        );
        $invoice = mysqli_fetch_assoc($result);

        if (!$invoice) {
            $this->errorResponse('Invoice not found', 404);
        }

        // Get invoice items
        $items_result = mysqli_query(
            $this->conn,
            "SELECT ii.*, p.name as product_name
             FROM invoice_items ii
             JOIN products p ON ii.product_id = p.id
             WHERE ii.invoice_id = $invoice_id"
        );

        $items = [];
        while ($row = mysqli_fetch_assoc($items_result)) {
            $items[] = $row;
        }

        // Get company settings
        $settings_result = mysqli_query(
            $this->conn,
            "SELECT `key`, value FROM settings WHERE `key` IN ('store_name', 'store_address', 'store_phone', 'tax_number', 'vat_number')"
        );
        $settings = [];
        while ($row = mysqli_fetch_assoc($settings_result)) {
            $settings[$row['key']] = $row['value'];
        }

        // Generate XML (simplified structure - full implementation requires ZATCA schema)
        $xml = $this->generateInvoiceXML($invoice, $items, $settings);

        // Calculate hash
        $hash = hash('sha256', $xml);

        // Store e-invoice record
        $stmt = mysqli_prepare(
            $this->conn,
            "INSERT INTO zatca_einvoices (invoice_id, xml_content, hash, status, created_at) 
             VALUES (?, ?, ?, 'generated', NOW())
             ON DUPLICATE KEY UPDATE xml_content = ?, hash = ?, updated_at = NOW()"
        );
        mysqli_stmt_bind_param($stmt, "isssss", $invoice_id, $xml, $hash, $xml, $hash);
        mysqli_stmt_execute($stmt);
        $id = mysqli_insert_id($this->conn);
        mysqli_stmt_close($stmt);

        log_operation('CREATE', 'zatca_einvoices', $id, null, ['invoice_id' => $invoice_id]);
        $this->successResponse([
            'id' => $id,
            'invoice_id' => $invoice_id,
            'hash' => $hash,
            'xml_preview' => substr($xml, 0, 500) . '...',
            'message' => 'E-Invoice XML generated. Ready for signing.'
        ]);
    }

    private function generateInvoiceXML($invoice, $items, $settings)
    {
        // Simplified XML structure - full implementation must comply with ZATCA Phase 2 schema
        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">' . "\n";
        $xml .= '  <ID>' . htmlspecialchars($invoice['invoice_number']) . '</ID>' . "\n";
        $xml .= '  <IssueDate>' . date('Y-m-d', strtotime($invoice['created_at'])) . '</IssueDate>' . "\n";
        $xml .= '  <InvoiceTypeCode>388</InvoiceTypeCode>' . "\n";
        $xml .= '  <DocumentCurrencyCode>SAR</DocumentCurrencyCode>' . "\n";

        // Seller (Company)
        $xml .= '  <AccountingSupplierParty>' . "\n";
        $xml .= '    <Party>' . "\n";
        $xml .= '      <PartyName><Name>' . htmlspecialchars($settings['store_name'] ?? '') . '</Name></PartyName>' . "\n";
        $xml .= '      <PostalAddress><StreetName>' . htmlspecialchars($settings['store_address'] ?? '') . '</StreetName></PostalAddress>' . "\n";
        $xml .= '      <PartyTaxScheme><CompanyID>' . htmlspecialchars($settings['tax_number'] ?? '') . '</CompanyID></PartyTaxScheme>' . "\n";
        $xml .= '    </Party>' . "\n";
        $xml .= '  </AccountingSupplierParty>' . "\n";

        // Buyer (Customer)
        if ($invoice['customer_id']) {
            $xml .= '  <AccountingCustomerParty>' . "\n";
            $xml .= '    <Party>' . "\n";
            $xml .= '      <PartyName><Name>' . htmlspecialchars($invoice['customer_name'] ?? '') . '</Name></PartyName>' . "\n";
            if ($invoice['customer_tax']) {
                $xml .= '      <PartyTaxScheme><CompanyID>' . htmlspecialchars($invoice['customer_tax']) . '</CompanyID></PartyTaxScheme>' . "\n";
            }
            $xml .= '    </Party>' . "\n";
            $xml .= '  </AccountingCustomerParty>' . "\n";
        }

        // Invoice Lines
        $xml .= '  <InvoiceLine>' . "\n";
        foreach ($items as $item) {
            $xml .= '    <Line>' . "\n";
            $xml .= '      <ID>' . $item['id'] . '</ID>' . "\n";
            $xml .= '      <Item><Name>' . htmlspecialchars($item['product_name']) . '</Name></Item>' . "\n";
            $xml .= '      <InvoicedQuantity unitCode="C62">' . $item['quantity'] . '</InvoicedQuantity>' . "\n";
            $xml .= '      <Price><PriceAmount currencyID="SAR">' . number_format($item['unit_price'], 2, '.', '') . '</PriceAmount></Price>' . "\n";
            $xml .= '      <LineExtensionAmount currencyID="SAR">' . number_format($item['subtotal'], 2, '.', '') . '</LineExtensionAmount>' . "\n";
            $xml .= '    </Line>' . "\n";
        }
        $xml .= '  </InvoiceLine>' . "\n";

        // Totals
        $xml .= '  <TaxTotal>' . "\n";
        $xml .= '    <TaxAmount currencyID="SAR">' . number_format($invoice['vat_amount'], 2, '.', '') . '</TaxAmount>' . "\n";
        $xml .= '  </TaxTotal>' . "\n";
        $xml .= '  <LegalMonetaryTotal>' . "\n";
        $xml .= '    <LineExtensionAmount currencyID="SAR">' . number_format($invoice['subtotal'], 2, '.', '') . '</LineExtensionAmount>' . "\n";
        $xml .= '    <TaxExclusiveAmount currencyID="SAR">' . number_format($invoice['subtotal'], 2, '.', '') . '</TaxExclusiveAmount>' . "\n";
        $xml .= '    <TaxInclusiveAmount currencyID="SAR">' . number_format($invoice['total_amount'], 2, '.', '') . '</TaxInclusiveAmount>' . "\n";
        $xml .= '    <PayableAmount currencyID="SAR">' . number_format($invoice['total_amount'], 2, '.', '') . '</PayableAmount>' . "\n";
        $xml .= '  </LegalMonetaryTotal>' . "\n";

        $xml .= '</Invoice>';

        return $xml;
    }

    private function signEInvoice()
    {
        $data = $this->getJsonInput();
        $invoice_id = intval($data['invoice_id'] ?? 0);

        if ($invoice_id <= 0) {
            $this->errorResponse('Invoice ID is required');
        }

        // Get e-invoice record
        $result = mysqli_query(
            $this->conn,
            "SELECT * FROM zatca_einvoices WHERE invoice_id = $invoice_id"
        );
        $einvoice = mysqli_fetch_assoc($result);

        if (!$einvoice) {
            $this->errorResponse('E-Invoice not found. Generate XML first.', 404);
        }

        if ($einvoice['status'] === 'signed') {
            $this->errorResponse('E-Invoice already signed', 400);
        }

        // Sign XML (simplified - full implementation requires cryptographic signing)
        // In production, this would:
        // 1. Load private key
        // 2. Sign the XML using XML Digital Signature standard
        // 3. Embed signature in XML
        // 4. Calculate QR code

        $xml = $einvoice['xml_content'];
        $signed_xml = $this->signXML($xml); // Placeholder
        $qr_code = $this->generateQRCode($einvoice['hash']); // Placeholder

        // Update record
        $stmt = mysqli_prepare(
            $this->conn,
            "UPDATE zatca_einvoices SET signed_xml = ?, qr_code = ?, status = 'signed', signed_at = NOW() WHERE invoice_id = ?"
        );
        mysqli_stmt_bind_param($stmt, "ssi", $signed_xml, $qr_code, $invoice_id);
        mysqli_stmt_execute($stmt);
        mysqli_stmt_close($stmt);

        log_operation('UPDATE', 'zatca_einvoices', $einvoice['id'], null, ['action' => 'sign']);
        $this->successResponse([
            'message' => 'E-Invoice signed successfully',
            'qr_code' => $qr_code,
            'status' => 'signed'
        ]);
    }

    private function signXML($xml)
    {
        // Placeholder - full implementation requires:
        // - OpenSSL or similar library
        // - XML Digital Signature (XMLDSig) implementation
        // - Private key management
        // - ZATCA-specific signing requirements

        return $xml . '<!-- Signed -->';
    }

    private function generateQRCode($hash)
    {
        // Placeholder - full implementation requires QR code generation library
        // ZATCA QR code contains: Seller name, VAT number, Invoice date/time, Total with VAT, VAT amount
        return 'QR:' . substr($hash, 0, 16);
    }

    private function submitToZATCA()
    {
        $data = $this->getJsonInput();
        $invoice_id = intval($data['invoice_id'] ?? 0);

        if ($invoice_id <= 0) {
            $this->errorResponse('Invoice ID is required');
        }

        // Get signed e-invoice
        $result = mysqli_query(
            $this->conn,
            "SELECT * FROM zatca_einvoices WHERE invoice_id = $invoice_id AND status = 'signed'"
        );
        $einvoice = mysqli_fetch_assoc($result);

        if (!$einvoice) {
            $this->errorResponse('Signed e-invoice not found', 404);
        }

        // Submit to ZATCA API (placeholder - requires ZATCA API credentials and integration)
        // In production, this would:
        // 1. Authenticate with ZATCA
        // 2. Submit signed XML
        // 3. Receive UUID and QR code
        // 4. Update invoice record

        $zatca_uuid = 'ZATCA-' . uniqid(); // Placeholder
        $zatca_qr = $this->generateQRCode($einvoice['hash']);

        $stmt = mysqli_prepare(
            $this->conn,
            "UPDATE zatca_einvoices SET zatca_uuid = ?, zatca_qr_code = ?, status = 'submitted', submitted_at = NOW() WHERE invoice_id = ?"
        );
        mysqli_stmt_bind_param($stmt, "ssi", $zatca_uuid, $zatca_qr, $invoice_id);
        mysqli_stmt_execute($stmt);
        mysqli_stmt_close($stmt);

        log_operation('UPDATE', 'zatca_einvoices', $einvoice['id'], null, ['action' => 'submit', 'zatca_uuid' => $zatca_uuid]);
        $this->successResponse([
            'message' => 'E-Invoice submitted to ZATCA',
            'zatca_uuid' => $zatca_uuid,
            'qr_code' => $zatca_qr,
            'status' => 'submitted'
        ]);
    }
}
