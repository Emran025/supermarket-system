
export interface Payroll {
    id: number;
    payroll_date: string;
    gross_pay: number;
    deductions: number;
    net_pay: number;
    description?: string;
    employee_name?: string;
    salary_amount?: number;
}
  
export interface Prepayment {
    id: number;
    prepayment_date: string;
    total_amount: number;
    months: number;
    description?: string;
    expense_account_code?: string;
    payment_date?: string;
    amortization_periods?: number;
}
  
export interface UnearnedRevenue {
    id: number;
    receipt_date: string;
    total_amount: number;
    months: number;
    description?: string;
    revenue_account_code?: string;
}
