<?php

require_once __DIR__ . '/../config/db.php';

/**
 * ChartOfAccountsMappingService
 * Provides dynamic mapping of account types to account codes from the database
 * Replaces hardcoded account codes throughout the system
 */
class ChartOfAccountsMappingService
{
    private $conn;
    private static $cache = [];

    public function __construct()
    {
        $this->conn = get_db_connection();
    }

    /**
     * Get account code by account type and optional name pattern
     * @param string $account_type Asset, Liability, Equity, Revenue, Expense
     * @param string|null $name_pattern Optional pattern to match account name (e.g., 'Cash', 'Sales')
     * @return string|null Account code or null if not found
     */
    public function getAccountCode($account_type, $name_pattern = null)
    {
        $cache_key = $account_type . '|' . ($name_pattern ?? '');

        if (isset(self::$cache[$cache_key])) {
            return self::$cache[$cache_key];
        }

        $type_esc = mysqli_real_escape_string($this->conn, $account_type);
        $where = "WHERE account_type = '$type_esc' AND is_active = 1";

        if ($name_pattern) {
            $pattern_esc = mysqli_real_escape_string($this->conn, $name_pattern);
            $where .= " AND (account_name LIKE '%$pattern_esc%' OR account_code LIKE '%$pattern_esc%')";
        }

        // Order by account_code to get the most specific match first
        $result = mysqli_query(
            $this->conn,
            "SELECT account_code FROM chart_of_accounts $where ORDER BY account_code ASC LIMIT 1"
        );

        if ($result && mysqli_num_rows($result) > 0) {
            $row = mysqli_fetch_assoc($result);
            $code = $row['account_code'];
            self::$cache[$cache_key] = $code;
            return $code;
        }

        return null;
    }

    /**
     * Get account code by exact account code
     * @param string $account_code
     * @return string|null Account code if exists and active, null otherwise
     */
    public function validateAccountCode($account_code)
    {
        $code_esc = mysqli_real_escape_string($this->conn, $account_code);
        $result = mysqli_query(
            $this->conn,
            "SELECT account_code FROM chart_of_accounts WHERE account_code = '$code_esc' AND is_active = 1 LIMIT 1"
        );

        if ($result && mysqli_num_rows($result) > 0) {
            $row = mysqli_fetch_assoc($result);
            return $row['account_code'];
        }

        return null;
    }

    /**
     * Get standard account codes with fallback to defaults
     * Returns an array of commonly used account codes
     */
    public function getStandardAccounts()
    {
        return [
            'cash' => $this->getAccountCode('Asset', 'النقدية') ?? $this->getAccountCode('Asset', 'Cash') ?? '1110',
            'accounts_receivable' => $this->getAccountCode('Asset', 'الذمم المدينة') ?? $this->getAccountCode('Asset', 'Receivable') ?? '1120',
            'inventory' => $this->getAccountCode('Asset', 'المخزون') ?? $this->getAccountCode('Asset', 'Inventory') ?? '1130',
            'accounts_payable' => $this->getAccountCode('Liability', 'الذمم الدائنة') ?? $this->getAccountCode('Liability', 'Payable') ?? '2110',
            'output_vat' => $this->getAccountCode('Liability', 'مخرجات') ?? $this->getAccountCode('Liability', 'Output') ?? '2210',
            'input_vat' => $this->getAccountCode('Liability', 'مدخلات') ?? $this->getAccountCode('Liability', 'Input') ?? '2220',
            'capital' => $this->getAccountCode('Equity', 'رأس المال') ?? $this->getAccountCode('Equity', 'Capital') ?? '3100',
            'retained_earnings' => $this->getAccountCode('Equity', 'الأرباح المحتجزة') ?? $this->getAccountCode('Equity', 'Retained') ?? '3200',
            'sales_revenue' => $this->getAccountCode('Revenue', 'مبيعات') ?? $this->getAccountCode('Revenue', 'Sales') ?? '4100',
            'other_revenue' => $this->getAccountCode('Revenue', 'إيرادات أخرى') ?? $this->getAccountCode('Revenue', 'Other') ?? '4200',
            'cogs' => $this->getAccountCode('Expense', 'تكلفة البضاعة') ?? $this->getAccountCode('Expense', 'COGS') ?? '5100',
            'operating_expenses' => $this->getAccountCode('Expense', 'المصروفات التشغيلية') ?? $this->getAccountCode('Expense', 'Operating') ?? '5200',
            'depreciation_expense' => $this->getAccountCode('Expense', 'الإهلاك') ?? $this->getAccountCode('Expense', 'Depreciation') ?? '5300',
        ];
    }

    /**
     * Clear cache (useful after COA updates)
     */
    public static function clearCache()
    {
        self::$cache = [];
    }
}
