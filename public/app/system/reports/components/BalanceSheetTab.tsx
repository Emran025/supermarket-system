
import { formatCurrency } from "@/lib/utils";
import { BalanceSheetView, APIBalanceSheet, APIAccountSummary } from "../types";
import { fetchAPI } from "@/lib/api";
import { showToast } from "@/components/ui";
import { useState, useCallback } from "react";

export function BalanceSheetTab({ onLoad }: { onLoad?: () => void }) {
    const [isLoading, setIsLoading] = useState(false);
    const [balanceSheet, setBalanceSheet] = useState<BalanceSheetView | null>(null);

    const loadFinancialData = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await fetchAPI("reports/balance_sheet");
            
            if (response.success && response.data) {
                const apiData = response.data as APIBalanceSheet;
                
                const assetsAccounts = apiData.assets.accounts || [];
                const liabilitiesAccounts = apiData.liabilities.accounts || [];
                const equityAccounts = apiData.equity.accounts || [];
                
                // Helper to sum accounts based on criteria without double counting within a category
                const getSum = (accounts: APIAccountSummary[], criteria: { start?: string, has?: string }[]) => {
                    const uniqueAccounts = new Set<string>();
                    return accounts.filter(a => {
                        const match = criteria.some(c => 
                            (c.start && a.account_code.startsWith(c.start)) || 
                            (c.has && a.account_name.toLowerCase().includes(c.has))
                        );
                        if (match && !uniqueAccounts.has(a.account_code)) {
                            uniqueAccounts.add(a.account_code);
                            return true;
                        }
                        return false;
                    }).reduce((sum, a) => sum + Number(a.balance), 0);
                };

                // Assets Mapping
                const cash = getSum(assetsAccounts, [
                    { start: '101' }, { start: '111' }, { has: 'cash' }, { has: 'نقدية' }, { has: 'بنك' }, { has: 'صندوق' }
                ]);
                const stock = getSum(assetsAccounts, [
                    { start: '113' }, { has: 'inventory' }, { has: 'مخزون' }, { has: 'بضاعة' }
                ]);
                const fixed = getSum(assetsAccounts, [
                    { start: '12' }, { start: '15' }, { has: 'fixed' }, { has: 'أصول ثابتة' }, { has: 'معدات' }, { has: 'سيارات' }
                ]);
                const ar = getSum(assetsAccounts, [
                    { start: '112' }, { has: 'receivable' }, { has: 'عملاء' }, { has: 'ذمم مدينة' }
                ]);
                
                const totalAssets = Number(apiData.assets.total || 0);

                // Liabilities Mapping
                const payable = getSum(liabilitiesAccounts, [
                    { start: '211' }, { has: 'payable' }, { has: 'موردين' }, { has: 'ذمم دائنة' }
                ]);
                const tax = getSum(liabilitiesAccounts, [
                    { start: '22' }, { has: 'vat' }, { has: 'tax' }, { has: 'ضريبة' }, { has: 'زكاة' }
                ]);
                const loans = getSum(liabilitiesAccounts, [
                    { start: '23' }, { has: 'loan' }, { has: 'bank' }, { has: 'قروض' }, { has: 'تمويل' }
                ]);
                
                const totalLiabilities = Number(apiData.liabilities.total || 0);

                // Equity Mapping
                const capital = getSum(equityAccounts, [
                    { start: '31' }, { has: 'capital' }, { has: 'رأس المال' }
                ]);
                const retained = getSum(equityAccounts, [
                    { start: '32' }, { has: 'retained' }, { has: 'أرباح مبقاة' }, { has: 'أرباح محتجزة' }
                ]);
                
                const totalEquity = Number(apiData.equity.total || 0);

                const mappedData: BalanceSheetView = {
                    assets: {
                        cash_estimate: cash,
                        stock_value: stock,
                        fixed_assets: fixed,
                        accounts_receivable: ar,
                        other_assets: Math.max(0, totalAssets - (cash + stock + fixed + ar)), 
                        total_assets: totalAssets,
                    },
                    liabilities: {
                        accounts_payable: payable,
                        tax_payable: tax,
                        loans: loans,
                        other_liabilities: Math.max(0, totalLiabilities - (payable + tax + loans)),
                        total_liabilities: totalLiabilities,
                    },
                    equity: {
                        capital: capital,
                        retained_earnings: retained,
                        other_equity: Math.max(0, totalEquity - (capital + retained)),
                        total_equity: totalEquity,
                    },
                    total_liabilities_and_equity: Number(apiData.total_liabilities_and_equity || 0),
                    is_balanced: apiData.is_balanced
                };
                setBalanceSheet(mappedData);
                if (onLoad) onLoad();
            } else {
                showToast("فشل تحميل البيانات المالية", "error");
            }
        } catch (error) {
            console.error(error);
            showToast("خطأ في الاتصال بالسيرفر", "error");
        } finally {
            setIsLoading(false);
        }
    }, [onLoad]);

    // Initial load? Consider checking if user wants auto-load or manual
    // For now we expose the load function via a button and maybe useEffect in parent if needed, 
    // but the tab structure usually implies loading on mount or demand.
    // The previous implementation loaded on mount of the page.
    
    // We can use useEffect to load on mount
    useState(() => {
        loadFinancialData();
    });

    return (
        <div className="balance-sheet-wrapper">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
                <div>
                    <h2 style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>الميزانية العمومية</h2>
                    <p style={{ color: "var(--text-secondary)" }}>الوضع المالي للمؤسسة كما هو في {new Date().toLocaleDateString('ar-SA')}</p>
                </div>
                <button className="btn btn-primary" onClick={loadFinancialData}>
                    <i className="fas fa-sync"></i> تحديث البيانات
                </button>
            </div>

            {isLoading ? (
                <div style={{ textAlign: "center", padding: "5rem" }}>
                    <i className="fas fa-spinner fa-spin" style={{ fontSize: "2.5rem", color: "var(--primary-color)" }}></i>
                    <p style={{ marginTop: "1rem", fontSize: "1.1rem" }}>جاري تحميل البيانات المالية...</p>
                </div>
            ) : balanceSheet ? (
                <div className="animate-fade">
                    {/* Summary Cards Row */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
                        <div className="sales-card" style={{ borderTop: "4px solid var(--success-color)", padding: "1.5rem" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div>
                                    <h3 style={{ fontSize: "1rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>إجمالي الأصول</h3>
                                    <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "var(--success-color)" }}>
                                        {formatCurrency(balanceSheet.assets.total_assets)}
                                    </div>
                                </div>
                                <div style={{ backgroundColor: "rgba(var(--success-rgb), 0.1)", padding: "1rem", borderRadius: "50%" }}>
                                    <i className="fas fa-wallet fa-lg" style={{ color: "var(--success-color)" }}></i>
                                </div>
                            </div>
                        </div>
                        <div className="sales-card" style={{ borderTop: "4px solid var(--danger-color)", padding: "1.5rem" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div>
                                    <h3 style={{ fontSize: "1rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>إجمالي الخصوم</h3>
                                    <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "var(--danger-color)" }}>
                                        {formatCurrency(balanceSheet.liabilities.total_liabilities)}
                                    </div>
                                </div>
                                <div style={{ backgroundColor: "rgba(var(--danger-rgb), 0.1)", padding: "1rem", borderRadius: "50%" }}>
                                    <i className="fas fa-file-invoice-dollar fa-lg" style={{ color: "var(--danger-color)" }}></i>
                                </div>
                            </div>
                        </div>
                        <div className="sales-card" style={{ borderTop: "4px solid var(--primary-color)", padding: "1.5rem" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div>
                                    <h3 style={{ fontSize: "1rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>إجمالي حقوق الملكية</h3>
                                    <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "var(--primary-color)" }}>
                                        {formatCurrency(balanceSheet.equity.total_equity)}
                                    </div>
                                </div>
                                <div style={{ backgroundColor: "rgba(var(--primary-rgb), 0.1)", padding: "1rem", borderRadius: "50%" }}>
                                    <i className="fas fa-piggy-bank fa-lg" style={{ color: "var(--primary-color)" }}></i>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Report Layout */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "2rem" }}>
                        {/* Assets Column */}
                        <div className="sales-card h-full">
                            <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "1rem", marginBottom: "1rem" }}>
                                <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <i className="fas fa-cubes text-success"></i> الأصول (الممتلكات)
                                </h2>
                            </div>
                            
                            <div className="financial-section">
                                <div className="financial-row">
                                    <span className="report-label">النقدية وما في حكمها</span>
                                    <span className="report-value">{formatCurrency(balanceSheet.assets.cash_estimate)}</span>
                                </div>
                                <div className="financial-row">
                                    <span className="report-label">المخزون السلعي</span>
                                    <span className="report-value">{formatCurrency(balanceSheet.assets.stock_value)}</span>
                                </div>
                                <div className="financial-row">
                                    <span className="report-label">الذمم المدينة (العملاء)</span>
                                    <span className="report-value">{formatCurrency(balanceSheet.assets.accounts_receivable)}</span>
                                </div>
                                <div className="financial-row">
                                    <span className="report-label">الأصول الثابتة (بالصافي)</span>
                                    <span className="report-value">{formatCurrency(balanceSheet.assets.fixed_assets)}</span>
                                </div>
                                {balanceSheet.assets.other_assets > 0 && (
                                    <div className="financial-row">
                                        <span className="report-label">أصول أخرى</span>
                                        <span className="report-value">{formatCurrency(balanceSheet.assets.other_assets)}</span>
                                    </div>
                                )}
                                <div className="financial-row total-row" style={{ marginTop: "2rem", borderTop: "2px dashed var(--border-color)", paddingTop: "1rem" }}>
                                    <span className="report-label font-bold text-lg">إجمالي الأصول</span>
                                    <span className="report-value text-success font-bold text-lg">{formatCurrency(balanceSheet.assets.total_assets)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Liabilities & Equity Column */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                            {/* Liabilities */}
                            <div className="sales-card">
                                <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "1rem", marginBottom: "1rem" }}>
                                    <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <i className="fas fa-hand-holding-usd text-danger"></i> الخصوم (الالتزامات)
                                    </h2>
                                </div>
                                <div className="financial-section">
                                    <div className="financial-row">
                                        <span className="report-label">الذمم الدائنة (الموردين)</span>
                                        <span className="report-value">{formatCurrency(balanceSheet.liabilities.accounts_payable)}</span>
                                    </div>
                                    <div className="financial-row">
                                        <span className="report-label">الضرائب والرسوم المستحقة</span>
                                        <span className="report-value">{formatCurrency(balanceSheet.liabilities.tax_payable)}</span>
                                    </div>
                                    {balanceSheet.liabilities.loans > 0 && (
                                        <div className="financial-row">
                                            <span className="report-label">القروض والتمويلات</span>
                                            <span className="report-value">{formatCurrency(balanceSheet.liabilities.loans)}</span>
                                        </div>
                                    )}
                                    {balanceSheet.liabilities.other_liabilities > 0 && (
                                        <div className="financial-row">
                                            <span className="report-label">التزامات أخرى</span>
                                            <span className="report-value">{formatCurrency(balanceSheet.liabilities.other_liabilities)}</span>
                                        </div>
                                    )}
                                    <div className="financial-row total-row" style={{ marginTop: "1rem", borderTop: "1px solid var(--border-color)", paddingTop: "0.5rem" }}>
                                        <span className="report-label font-bold">إجمالي الخصوم</span>
                                        <span className="report-value text-danger font-bold">{formatCurrency(balanceSheet.liabilities.total_liabilities)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Equity */}
                            <div className="sales-card">
                                <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "1rem", marginBottom: "1rem" }}>
                                    <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <i className="fas fa-balance-scale text-primary"></i> حقوق الملكية
                                    </h2>
                                </div>
                                <div className="financial-section">
                                    <div className="financial-row">
                                        <span className="report-label">رأس المال</span>
                                        <span className="report-value">{formatCurrency(balanceSheet.equity.capital)}</span>
                                    </div>
                                    <div className="financial-row">
                                        <span className="report-label">الأرباح المبقاة</span>
                                        <span className="report-value">{formatCurrency(balanceSheet.equity.retained_earnings)}</span>
                                    </div>
                                    {balanceSheet.equity.other_equity > 0 && (
                                        <div className="financial-row">
                                            <span className="report-label">بنود حقوق ملكية أخرى</span>
                                            <span className="report-value">{formatCurrency(balanceSheet.equity.other_equity)}</span>
                                        </div>
                                    )}
                                    <div className="financial-row total-row" style={{ marginTop: "1rem", borderTop: "1px solid var(--border-color)", paddingTop: "0.5rem" }}>
                                        <span className="report-label font-bold">إجمالي حقوق الملكية</span>
                                        <span className="report-value text-primary font-bold">{formatCurrency(balanceSheet.equity.total_equity)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Balance Check Bar */}
                    <div className={`sales-card ${balanceSheet.is_balanced ? 'border-l-4 border-success' : 'border-l-4 border-danger'}`} style={{ marginTop: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.5rem" }}>
                        <div>
                            <h3 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>معادلة الميزانية</h3>
                            <p style={{ color: "var(--text-secondary)" }}>يجب أن تتساوى الأصول مع مجموع الخصوم وحقوق الملكية</p>
                        </div>
                        <div style={{ textAlign: "left" }}>
                            <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--primary-dark)" }}>
                                {formatCurrency(balanceSheet.total_liabilities_and_equity)}
                            </div>
                            <div style={{ fontSize: "0.9rem", color: balanceSheet.is_balanced ? "var(--success-color)" : "var(--danger-color)" }}>
                                {balanceSheet.is_balanced ? (
                                    <span><i className="fas fa-check-circle"></i> الميزانية متوازنة</span>
                                ) : (
                                    <span><i className="fas fa-exclamation-triangle"></i> فارق: {formatCurrency(balanceSheet.assets.total_assets - balanceSheet.total_liabilities_and_equity)}</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>لا توجد بيانات</p>
            )}
        </div>
    );
}
