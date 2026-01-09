<?php

namespace App\Helpers;

class CurrencyHelper
{
    /**
     * Format a number as currency (SAR default)
     */
    public static function format($amount, $currency = 'SAR'): string
    {
        return number_format($amount, 2) . ' ' . $currency;
    }

    /**
     * Round amounts for financial calculations (2 decimals standard)
     */
    public static function round($amount): float
    {
        return round($amount, 2);
    }

    public static function calculateVAT($amount, $rate = null): float
    {
        $taxRate = $rate ?? (float)config('accounting.vat_rate');
        return self::round($amount * $taxRate);
    }
}

