<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayrollEntry extends Model
{
    protected $fillable = [
        'employee_name', 'salary_amount', 'payroll_date', 'description',
        'status', 'payment_date', 'paid_at', 'created_by'
    ];

    protected $casts = [
        'payroll_date' => 'date',
        'payment_date' => 'date',
        'salary_amount' => 'decimal:2',
        'paid_at' => 'datetime',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
