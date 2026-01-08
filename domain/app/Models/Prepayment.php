<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Prepayment extends Model
{
    protected $fillable = [
        'description', 'total_amount', 'payment_date', 'expense_account_code',
        'amortization_periods', 'amortized_amount', 'created_by'
    ];

    protected $casts = [
        'payment_date' => 'date',
        'total_amount' => 'decimal:2',
        'amortization_periods' => 'integer',
        'amortized_amount' => 'decimal:2',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
