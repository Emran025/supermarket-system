<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JournalVoucher extends Model
{
    protected $fillable = [
        'voucher_number', 'voucher_date', 'account_id', 'entry_type',
        'amount', 'description', 'created_by'
    ];

    protected $casts = [
        'voucher_date' => 'date',
        'amount' => 'decimal:2',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(ChartOfAccount::class, 'account_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
