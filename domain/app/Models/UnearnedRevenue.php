<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UnearnedRevenue extends Model
{
    protected $table = 'unearned_revenue';

    protected $fillable = [
        'description', 'total_amount', 'received_date', 'revenue_account_code',
        'recognized_amount', 'created_by'
    ];

    protected $casts = [
        'received_date' => 'date',
        'total_amount' => 'decimal:2',
        'recognized_amount' => 'decimal:2',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
