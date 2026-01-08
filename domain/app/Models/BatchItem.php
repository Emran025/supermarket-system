<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BatchItem extends Model
{
    protected $table = 'batch_items';

    protected $fillable = [
        'batch_id', 'item_index', 'status', 'reference_id',
        'voucher_number', 'error_message'
    ];

    protected $casts = [
        'item_index' => 'integer',
        'reference_id' => 'integer',
    ];

    public function batch(): BelongsTo
    {
        return $this->belongsTo(BatchProcessing::class, 'batch_id');
    }
}
