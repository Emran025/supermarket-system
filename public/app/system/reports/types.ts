
// --- API Response Interfaces (Matching Controller Output) ---

export interface APIAccountSummary {
    account_code: string;
    account_name: string;
    balance: number;
}

export interface APIBalanceSheet {
    assets: {
        accounts: APIAccountSummary[];
        total: number;
    };
    liabilities: {
        accounts: APIAccountSummary[];
        total: number;
    };
    equity: {
        accounts: APIAccountSummary[];
        total: number;
    };
    total_liabilities_and_equity: number;
    is_balanced: boolean;
}

export interface APIProfitLoss {
    revenue: {
        accounts: APIAccountSummary[];
        total: number;
    };
    expenses: {
        accounts: APIAccountSummary[];
        total: number;
    };
    net_income: number;
}

export interface APICashFlow {
    operating_activities: {
        net_income: number;
        net_cash_flow?: number; // Corrected to match earlier usage which might be missing from direct API response but used in View
    };
    investing_activities: {
        total: number;
        asset_purchases?: number;
    };
    financing_activities: {
        total: number;
        capital?: number;
    };
    net_change_in_cash: number;
    beginning_cash: number;
    ending_cash: number;
}

export interface APIComparative {
    current_period: {
        revenue: number;
        expenses: number;
        net_profit: number;
    };
    previous_period: {
        revenue: number;
        expenses: number;
        net_profit: number;
    } | null;
    changes: {
        revenue: { amount: number; percentage: number };
        expenses: { amount: number; percentage: number };
        net_profit: { amount: number; percentage: number };
    } | null;
}

// --- UI View Models ---

export interface BalanceSheetView {
    assets: {
        cash_estimate: number;
        stock_value: number;
        fixed_assets: number;
        accounts_receivable: number;
        other_assets: number;
        total_assets: number;
    };
    liabilities: {
        accounts_payable: number;
        tax_payable: number;
        loans: number;
        other_liabilities: number;
        total_liabilities: number;
    };
    equity: {
        capital: number;
        retained_earnings: number;
        other_equity: number;
        total_equity: number;
    };
    total_liabilities_and_equity: number;
    is_balanced: boolean;
}

export interface ProfitLossView {
    total_revenue: number;
    total_expenses: number;
    net_profit: number;
}

export interface CashFlowView {
    operating_activities: {
        net_profit: number;
        net_cash_flow: number;
    };
    investing_activities: {
        asset_purchases: number;
    };
    financing_activities: {
        capital: number;
    };
    net_cash_flow: number;
}
