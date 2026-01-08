<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    protected $fillable = [
        'name',
        'description',
        'category_id',
        'unit_price',
        'minimum_profit_margin',
        'stock_quantity',
        'unit_name',
        'items_per_unit',
        'sub_unit_name',
        'weighted_average_cost',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'unit_price' => 'decimal:2',
            'minimum_profit_margin' => 'decimal:2',
            'stock_quantity' => 'integer',
            'items_per_unit' => 'integer',
            'weighted_average_cost' => 'decimal:2',
        ];
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function purchases(): HasMany
    {
        return $this->hasMany(Purchase::class);
    }

    public function invoiceItems(): HasMany
    {
        return $this->hasMany(InvoiceItem::class);
    }
}
