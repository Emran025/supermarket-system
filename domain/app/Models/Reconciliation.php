<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Reconciliation extends Model
{
    protected $fillable = [
        'account_code',
        'reconciliation_date',
        'ledger_balance',
        'physical_balance',
        'difference',
        'status',
        'notes',
        'adjustment_notes',
        'reconciled_by'
    ];

    protected $casts = [
        'reconciliation_date' => 'date',
        'ledger_balance' => 'decimal:2',
        'physical_balance' => 'decimal:2',
        'difference' => 'decimal:2',
    ];

    public function reconciledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reconciled_by');
    }
}
