<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ZatcaEinvoice extends Model
{
    protected $table = 'zatca_einvoices';

    protected $fillable = [
        'invoice_id', 'xml_content', 'hash', 'signed_xml', 'qr_code',
        'zatca_uuid', 'zatca_qr_code', 'status', 'signed_at', 'submitted_at'
    ];

    protected $casts = [
        'signed_at' => 'datetime',
        'submitted_at' => 'datetime',
    ];

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}
