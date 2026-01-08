<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Purchase extends Model
{
    protected $fillable = [
        'product_id',
        'quantity',
        'invoice_price',
        'unit_type',
        'production_date',
        'expiry_date',
        'user_id',
        'supplier_id',
        'voucher_number',
        'notes',
        'vat_rate',
        'vat_amount',
        'approval_status',
        'approved_by',
        'approved_at',
        'is_reversed',
        'reversed_at',
        'reversed_by',
        'purchase_date',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'invoice_price' => 'decimal:2',
            'vat_rate' => 'decimal:2',
            'vat_amount' => 'decimal:2',
            'is_reversed' => 'boolean',
            'production_date' => 'date',
            'expiry_date' => 'date',
            'approved_at' => 'datetime',
            'reversed_at' => 'datetime',
            'purchase_date' => 'datetime',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(ApSupplier::class, 'supplier_id');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function reversedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reversed_by');
    }
}
