<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Batch extends Model
{
    protected $table = 'batch_processing';

    protected $fillable = [
        'batch_type',
        'description',
        'status',
        'total_items',
        'successful_items',
        'failed_items',
        'created_by',
        'completed_at'
    ];

    protected $casts = [
        'total_items' => 'integer',
        'successful_items' => 'integer',
        'failed_items' => 'integer',
        'completed_at' => 'datetime',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(BatchItem::class, 'batch_id');
    }
}

