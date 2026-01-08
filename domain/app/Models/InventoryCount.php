<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryCount extends Model
{
    protected $fillable = [
        'product_id', 'fiscal_period_id', 'count_date', 'book_quantity',
        'counted_quantity', 'variance', 'notes', 'is_processed',
        'processed_at', 'counted_by'
    ];

    protected $casts = [
        'count_date' => 'date',
        'book_quantity' => 'integer',
        'counted_quantity' => 'integer',
        'variance' => 'integer',
        'is_processed' => 'boolean',
        'processed_at' => 'datetime',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function fiscalPeriod(): BelongsTo
    {
        return $this->belongsTo(FiscalPeriod::class);
    }

    public function countedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'counted_by');
    }
}
