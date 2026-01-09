<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Setting;
use App\Models\ZatcaEinvoice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use Exception;

class ZATCAInvoiceController extends Controller
{
    /**
     * Submit an invoice to ZATCA.
     *
     * @param Request $request
     * @param int $invoiceId
     * @return \Illuminate\Http\JsonResponse
     */
    public function submit(Request $request, $invoiceId)
    {
        try {
            // 1. Check Feature Flag & Location
            if (!$this->isZatcaEnabled()) {
                return response()->json([
                    'status' => 'skipped',
                    'message' => 'ZATCA integration is disabled or not applicable for this region.'
                ], 200);
            }

            $invoice = Invoice::findOrFail($invoiceId);

            // 2. Check if already submitted
            $existing = ZatcaEinvoice::where('invoice_id', $invoice->id)
                ->where('status', 'submitted')
                ->first();

            if ($existing) {
                return response()->json([
                    'status' => 'already_submitted',
                    'data' => $existing
                ], 200);
            }

            // 3. Process Invoice (Transaction for safety)
            return DB::transaction(function () use ($invoice) {
                // A. Generate XML (Placeholder for complex XML generation logic)
                $xmlContent = $this->generateInvoiceXml($invoice);
                $hash = hash('sha256', $xmlContent);

                // B. Sign XML (Placeholder for Certificate signing)
                $signedXml = $this->signXml($xmlContent);
                
                // C. Submit to ZATCA SDK/API (Mocking the call)
                // In production, this would use Http::withCert(...)
                $apiResponse = $this->sendToZatcaApi($signedXml);

                $status = $apiResponse['valid'] ? 'submitted' : 'rejected';

                $zatcaInvoice = ZatcaEinvoice::updateOrCreate(
                    ['invoice_id' => $invoice->id],
                    [
                        'xml_content' => $xmlContent,
                        'hash' => $hash,
                        'signed_xml' => $signedXml,
                        'qr_code' => substr($apiResponse['qr_code'] ?? '', 0, 255),
                        'zatca_qr_code' => $apiResponse['qr_code'] ?? null,
                        'zatca_uuid' => $apiResponse['uuid'] ?? null,
                        'status' => $status,
                        'signed_at' => now(),
                        'submitted_at' => $status === 'submitted' ? now() : null,
                    ]
                );

                if ($status === 'rejected') {
                    throw new Exception('ZATCA Rejection: ' . ($apiResponse['error_message'] ?? 'Unknown error'));
                }

                return response()->json([
                    'success' => true,
                    'message' => 'Invoice submitted to ZATCA successfully',
                    'data' => $zatcaInvoice
                ]);
            });

        } catch (Exception $e) {
            Log::error("ZATCA Submission Error: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to submit invoice to ZATCA',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Check if ZATCA is enabled in settings.
     */
    private function isZatcaEnabled(): bool
    {
        $enabled = Setting::where('setting_key', 'zatca_enabled')->value('setting_value');
        $country = Setting::where('setting_key', 'company_country')->value('setting_value');

        // Check if explicitly enabled OR if country is SA (and not explicitly disabled)
        // Adjust logic based on strict requirement. Here we assume manual toggle is primary.
        return filter_var($enabled, FILTER_VALIDATE_BOOLEAN); 
    }

    /**
     * Mock XML Generation
     */
    private function generateInvoiceXml(Invoice $invoice): string
    {
        // Construct UBL 2.1 Standard XML
        return "<Invoice><ID>{$invoice->id}</ID><Total>{$invoice->total}</Total></Invoice>";
    }

    /**
     * Mock Signing
     */
    private function signXml(string $xml): string
    {
        // Use OpenSSL or specialized library here
        return $xml . "<!-- Signed -->";
    }

    /**
     * Mock API Call
     */
    private function sendToZatcaApi(string $xml): array
    {
        // Simulate API call
        // return Http::post('...')->json();
        
        return [
            'valid' => true,
            'uuid' => 'urn:uuid:' . \Illuminate\Support\Str::uuid(),
            'qr_code' => 'base64_qr_code_string_here'
        ];
    }
    
    public function getStatus($invoiceId)
    {
         $zatca = ZatcaEinvoice::where('invoice_id', $invoiceId)->first();
         
         if (!$zatca) {
             return response()->json(['status' => 'not_generated']);
         }
         
         return response()->json(['status' => $zatca->status, 'data' => $zatca]);
    }
}
