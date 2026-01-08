"use client";

import { useState, useEffect, useCallback } from "react";
import { MainLayout, PageHeader } from "@/components/layout";
import { showToast, TabNavigation } from "@/components/ui";
import { fetchAPI } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { User, getStoredUser, checkAuth } from "@/lib/auth";
import { getIcon } from "@/lib/icons";

interface BalanceSheetData {
    assets: {
        cash_estimate: number;
        stock_value: number;
        fixed_assets: number;
        accounts_receivable: number;
        total_assets: number;
    };
    income_statement: {
        total_sales: number;
        other_revenues: number;
        total_purchases: number;
        total_expenses: number;
        net_profit: number;
    };
}

interface ProfitLossData {
    total_revenue: number;
    total_cogs: number;
    total_expenses: number;
    net_profit: number;
}

interface CashFlowData {
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

interface ComparativeData {
    current_period: {
        revenue: number;
        expenses: number;
        net_profit: number;
    };
    previous_period: {
        revenue: number;
        expenses: number;
        net_profit: number;
    };
    changes: {
        revenue: { amount: number; percentage: number };
        expenses: { amount: number; percentage: number };
        net_profit: { amount: number; percentage: number };
    };
}

export default function ReportsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState<"balance_sheet" | "profit_loss" | "cash_flow" | "comparative">("balance_sheet");
    const [isLoading, setIsLoading] = useState(false);

    // Date filters
    const [plStartDate, setPlStartDate] = useState("");
    const [plEndDate, setPlEndDate] = useState("");
    const [cfStartDate, setCfStartDate] = useState("");
    const [cfEndDate, setCfEndDate] = useState("");
    const [compCurrentStart, setCompCurrentStart] = useState("");
    const [compCurrentEnd, setCompCurrentEnd] = useState("");
    const [compPreviousStart, setCompPreviousStart] = useState("");
    const [compPreviousEnd, setCompPreviousEnd] = useState("");

    useEffect(() => {
        const today = new Date().toISOString().split("T")[0];
        const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

        // Set default dates
        setPlStartDate(firstDay);
        setPlEndDate(today);
        setCfStartDate(firstDay);
        setCfEndDate(today);
        setCompCurrentStart(firstDay);
        setCompCurrentEnd(today);
        // Previous period defaults (optional, maybe previous month?)
        const prevMonthFirst = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split("T")[0];
        const prevMonthLast = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split("T")[0];
        setCompPreviousStart(prevMonthFirst);
        setCompPreviousEnd(prevMonthLast);
    }, []);

    // Report Data
    const [balanceSheet, setBalanceSheet] = useState<BalanceSheetData | null>(null);
    const [profitLoss, setProfitLoss] = useState<ProfitLossData | null>(null);
    const [cashFlow, setCashFlow] = useState<CashFlowData | null>(null);
    const [comparative, setComparative] = useState<ComparativeData | null>(null);

    const loadFinancialData = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await fetchAPI("reports?operation=balance_sheet");
            if (response.success && response.data) {
                setBalanceSheet(response.data as BalanceSheetData);
            } else {
                showToast("فشل تحميل البيانات المالية", "error");
            }
        } catch {
            showToast("خطأ في الاتصال بالسيرفر", "error");
        } finally {
            setIsLoading(false);
        }
    }, []);

    const loadProfitLoss = useCallback(async () => {
        if (!plStartDate || !plEndDate) {
            showToast("يرجى تحديد تاريخ البداية والنهاية", "warning");
            return;
        }

        try {
            setIsLoading(true);
            const response = await fetchAPI(
                `reports?operation=profit_loss&start_date=${plStartDate}&end_date=${plEndDate}`
            );
            if (response.success && response.data) {
                setProfitLoss(response.data as ProfitLossData);
            } else {
                showToast(response.message || "فشل تحميل قائمة الدخل", "error");
            }
        } catch {
            showToast("خطأ في الاتصال بالسيرفر", "error");
        } finally {
            setIsLoading(false);
        }
    }, [plStartDate, plEndDate]);

    const loadCashFlow = useCallback(async () => {
        if (!cfStartDate || !cfEndDate) {
            showToast("يرجى تحديد تاريخ البداية والنهاية", "warning");
            return;
        }

        try {
            setIsLoading(true);
            const response = await fetchAPI(
                `reports?operation=cash_flow&start_date=${cfStartDate}&end_date=${cfEndDate}`
            );
            if (response.success && response.data) {
                setCashFlow(response.data as CashFlowData);
            } else {
                showToast(response.message || "فشل تحميل قائمة التدفقات النقدية", "error");
            }
        } catch {
            showToast("خطأ في الاتصال بالسيرفر", "error");
        } finally {
            setIsLoading(false);
        }
    }, [cfStartDate, cfEndDate]);

    const loadComparative = useCallback(async () => {
        if (!compCurrentStart || !compCurrentEnd) {
            showToast("يرجى تحديد الفترة الحالية", "warning");
            return;
        }

        try {
            setIsLoading(true);
            let url = `reports?operation=comparative&current_start=${compCurrentStart}&current_end=${compCurrentEnd}`;
            if (compPreviousStart && compPreviousEnd) {
                url += `&previous_start=${compPreviousStart}&previous_end=${compPreviousEnd}`;
            }

            const response = await fetchAPI(url);
            if (response.success && response.data) {
                setComparative(response.data as ComparativeData);
            } else {
                showToast(response.message || "فشل تحميل المقارنة", "error");
            }
        } catch {
            showToast("خطأ في الاتصال بالسيرفر", "error");
        } finally {
            setIsLoading(false);
        }
    }, [compCurrentStart, compCurrentEnd, compPreviousStart, compPreviousEnd]);

    useEffect(() => {
        const init = async () => {
            const authenticated = await checkAuth();
            if (!authenticated) return;

            const storedUser = getStoredUser();
            setUser(storedUser);

            // Load balance sheet by default
            await loadFinancialData();
        };
        init();
    }, [loadFinancialData]);

    useEffect(() => {
        if (activeTab === "profit_loss") {
            loadProfitLoss();
        } else if (activeTab === "cash_flow") {
            loadCashFlow();
        } else if (activeTab === "comparative") {
            loadComparative();
        }
    }, [activeTab, loadProfitLoss, loadCashFlow, loadComparative]);

    const handleExport = () => {
        window.print();
    };

    return (
        <MainLayout requiredModule="reports">
            <PageHeader
                title="التقارير المالية"
                user={user}
                showDate={true}
                actions={
                    <button className="btn btn-secondary" onClick={handleExport}>
                        {getIcon("download")}
                        طباعة / تصدير
                    </button>
                }
            />

            <div className="settings-wrapper animate-fade">
                {/* Tabs */}
                <TabNavigation 
                    tabs={[
                        { key: "balance_sheet", label: "الميزانية العمومية", icon: "fa-balance-scale" },
                        { key: "profit_loss", label: "قائمة الدخل", icon: "fa-chart-line" },
                        { key: "cash_flow", label: "التدفقات النقدية", icon: "fa-money-bill-wave" },
                        { key: "comparative", label: "المقارنة المالية", icon: "fa-chart-bar" }
                    ]}
                    activeTab={activeTab}
                    onTabChange={(tab) => setActiveTab(tab as typeof activeTab)}
                />

                {/* Balance Sheet Tab */}
                <div className={`tab-content ${activeTab === "balance_sheet" ? "active" : ""}`}>
                    <div className="sales-card">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                            <h2>الميزانية العمومية</h2>
                            <button className="btn btn-primary" onClick={loadFinancialData}>
                                <i className="fas fa-sync"></i> تحديث
                            </button>
                        </div>

                        {isLoading ? (
                            <div style={{ textAlign: "center", padding: "3rem" }}>
                                <i className="fas fa-spinner fa-spin" style={{ fontSize: "2rem", color: "var(--primary-color)" }}></i>
                                <p style={{ marginTop: "1rem" }}>جاري التحميل...</p>
                            </div>
                        ) : balanceSheet ? (
                            <div className="report-grid">
                                {/* Assets Section */}
                                <div className="report-section animate-fade">
                                    <h2><i className="fas fa-wallet"></i> الأصول</h2>
                                    <div className="financial-row">
                                        <span className="report-label">النقدية المقدرة</span>
                                        <span className="report-value">{formatCurrency(balanceSheet.assets.cash_estimate)}</span>
                                    </div>
                                    <div className="financial-row">
                                        <span className="report-label">قيمة المخزون</span>
                                        <span className="report-value">{formatCurrency(balanceSheet.assets.stock_value)}</span>
                                    </div>
                                    <div className="financial-row">
                                        <span className="report-label">الأصول الثابتة</span>
                                        <span className="report-value">{formatCurrency(balanceSheet.assets.fixed_assets)}</span>
                                    </div>
                                    <div className="financial-row">
                                        <span className="report-label">الذمم المدينة</span>
                                        <span className="report-value">{formatCurrency(balanceSheet.assets.accounts_receivable)}</span>
                                    </div>
                                    <div className="financial-row">
                                        <span className="report-label">إجمالي الأصول</span>
                                        <span className="report-value">{formatCurrency(balanceSheet.assets.total_assets)}</span>
                                    </div>
                                </div>

                                {/* Income Statement Section */}
                                <div className="report-section animate-fade">
                                    <h2><i className="fas fa-chart-line"></i> قائمة الدخل</h2>
                                    <div className="financial-row">
                                        <span className="report-label">إجمالي المبيعات</span>
                                        <span className="report-value text-success">{formatCurrency(balanceSheet.income_statement.total_sales)}</span>
                                    </div>
                                    <div className="financial-row">
                                        <span className="report-label">إيرادات أخرى</span>
                                        <span className="report-value text-success">{formatCurrency(balanceSheet.income_statement.other_revenues)}</span>
                                    </div>
                                    <div className="financial-row">
                                        <span className="report-label">إجمالي المشتريات</span>
                                        <span className="report-value text-danger">-{formatCurrency(balanceSheet.income_statement.total_purchases)}</span>
                                    </div>
                                    <div className="financial-row">
                                        <span className="report-label">إجمالي المصروفات</span>
                                        <span className="report-value text-danger">-{formatCurrency(balanceSheet.income_statement.total_expenses)}</span>
                                    </div>
                                    <div className="financial-row">
                                        <span className="report-label">صافي الربح / الخسارة</span>
                                        <span className={`report-value ${balanceSheet.income_statement.net_profit >= 0 ? "profit" : "loss"}`}>
                                            {formatCurrency(balanceSheet.income_statement.net_profit)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>لا توجد بيانات</p>
                        )}
                    </div>
                </div>

                {/* Profit & Loss Tab */}
                <div className={`tab-content ${activeTab === "profit_loss" ? "active" : ""}`}>
                    <div className="sales-card">
                        <h2><i className="fas fa-chart-line"></i> قائمة الدخل</h2>

                        <div className="filter-section">
                            <div className="filter-group">
                                <label>فترة التقرير</label>
                                <div className="date-range-group">
                                    <input
                                        type="date"
                                        value={plStartDate}
                                        onChange={(e) => setPlStartDate(e.target.value)}
                                    />
                                    <span>إلى</span>
                                    <input
                                        type="date"
                                        value={plEndDate}
                                        onChange={(e) => setPlEndDate(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="filter-actions">
                                <button className="btn btn-primary" onClick={loadProfitLoss}>
                                    <i className="fas fa-search"></i> عرض التقرير
                                </button>
                            </div>
                        </div>

                        {isLoading ? (
                            <div style={{ textAlign: "center", padding: "3rem" }}>
                                <i className="fas fa-spinner fa-spin" style={{ fontSize: "2rem" }}></i>
                            </div>
                        ) : profitLoss ? (
                            <div className="report-section animate-fade" style={{ marginTop: "1.5rem" }}>
                                <h2 style={{ marginBottom: "1.5rem" }}>
                                    <i className="fas fa-chart-line"></i> قائمة الدخل ({plStartDate} إلى {plEndDate})
                                </h2>
                                <div className="financial-row">
                                    <span className="report-label">إجمالي الإيرادات</span>
                                    <span className="report-value text-success">{formatCurrency(profitLoss.total_revenue || 0)}</span>
                                </div>
                                <div className="financial-row">
                                    <span className="report-label">تكلفة البضاعة المباعة</span>
                                    <span className="report-value text-danger">-{formatCurrency(profitLoss.total_cogs || 0)}</span>
                                </div>
                                <div className="financial-row">
                                    <span className="report-label">إجمالي الربح</span>
                                    <span className="report-value">{formatCurrency((profitLoss.total_revenue || 0) - (profitLoss.total_cogs || 0))}</span>
                                </div>
                                <div className="financial-row">
                                    <span className="report-label">المصروفات التشغيلية</span>
                                    <span className="report-value text-danger">-{formatCurrency(profitLoss.total_expenses || 0)}</span>
                                </div>
                                <div className="financial-row">
                                    <span className="report-label">صافي الربح / الخسارة</span>
                                    <span className={`report-value ${(profitLoss.net_profit || 0) >= 0 ? "profit" : "loss"}`}>
                                        {formatCurrency(profitLoss.net_profit || 0)}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
                                اختر الفترة الزمنية واضغط على "عرض التقرير"
                            </p>
                        )}
                    </div>
                </div>

                {/* Cash Flow Tab */}
                <div className={`tab-content ${activeTab === "cash_flow" ? "active" : ""}`}>
                    <div className="sales-card">
                        <h2><i className="fas fa-money-bill-wave"></i> قائمة التدفقات النقدية</h2>

                        <div className="filter-section">
                            <div className="filter-group">
                                <label>فترة التقرير</label>
                                <div className="date-range-group">
                                    <input
                                        type="date"
                                        value={cfStartDate}
                                        onChange={(e) => setCfStartDate(e.target.value)}
                                    />
                                    <span>إلى</span>
                                    <input
                                        type="date"
                                        value={cfEndDate}
                                        onChange={(e) => setCfEndDate(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="filter-actions">
                                <button className="btn btn-primary" onClick={loadCashFlow}>
                                    <i className="fas fa-search"></i> عرض التقرير
                                </button>
                            </div>
                        </div>

                        {isLoading ? (
                            <div style={{ textAlign: "center", padding: "3rem" }}>
                                <i className="fas fa-spinner fa-spin" style={{ fontSize: "2rem" }}></i>
                            </div>
                        ) : cashFlow ? (
                            <div className="report-section animate-fade" style={{ marginTop: "1.5rem" }}>
                                <h2 style={{ marginBottom: "1.5rem" }}>
                                    <i className="fas fa-money-bill-wave"></i> قائمة التدفقات النقدية ({cfStartDate} إلى {cfEndDate})
                                </h2>

                                <h3 style={{ marginTop: "1.5rem", marginBottom: "1rem", color: "var(--primary-dark)" }}>الأنشطة التشغيلية</h3>
                                <div className="financial-row">
                                    <span className="report-label">صافي الربح</span>
                                    <span className="report-value">{formatCurrency(cashFlow.operating_activities?.net_profit || 0)}</span>
                                </div>
                                <div className="financial-row">
                                    <span className="report-label">التدفقات النقدية من الأنشطة التشغيلية</span>
                                    <span className="report-value">{formatCurrency(cashFlow.operating_activities?.net_cash_flow || 0)}</span>
                                </div>

                                <h3 style={{ marginTop: "1.5rem", marginBottom: "1rem", color: "var(--primary-dark)" }}>الأنشطة الاستثمارية</h3>
                                <div className="financial-row">
                                    <span className="report-label">شراء الأصول</span>
                                    <span className="report-value text-danger">-{formatCurrency(cashFlow.investing_activities?.asset_purchases || 0)}</span>
                                </div>

                                <h3 style={{ marginTop: "1.5rem", marginBottom: "1rem", color: "var(--primary-dark)" }}>الأنشطة التمويلية</h3>
                                <div className="financial-row">
                                    <span className="report-label">رأس المال</span>
                                    <span className="report-value text-success">{formatCurrency(cashFlow.financing_activities?.capital || 0)}</span>
                                </div>

                                <div className="financial-row">
                                    <span className="report-label">صافي التدفق النقدي</span>
                                    <span className="report-value">{formatCurrency(cashFlow.net_cash_flow || 0)}</span>
                                </div>
                            </div>
                        ) : (
                            <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
                                اختر الفترة الزمنية واضغط على "عرض التقرير"
                            </p>
                        )}
                    </div>
                </div>

                {/* Comparative Tab */}
                <div className={`tab-content ${activeTab === "comparative" ? "active" : ""}`}>
                    <div className="sales-card">
                        <h2><i className="fas fa-chart-bar"></i> المقارنة المالية</h2>

                        <div className="filter-section">
                            <div className="filter-group">
                                <label>الفترة الحالية</label>
                                <div className="date-range-group">
                                    <input
                                        type="date"
                                        value={compCurrentStart}
                                        onChange={(e) => setCompCurrentStart(e.target.value)}
                                    />
                                    <span>إلى</span>
                                    <input
                                        type="date"
                                        value={compCurrentEnd}
                                        onChange={(e) => setCompCurrentEnd(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="filter-group">
                                <label>الفترة السابقة (اختياري)</label>
                                <div className="date-range-group">
                                    <input
                                        type="date"
                                        value={compPreviousStart}
                                        onChange={(e) => setCompPreviousStart(e.target.value)}
                                    />
                                    <span>إلى</span>
                                    <input
                                        type="date"
                                        value={compPreviousEnd}
                                        onChange={(e) => setCompPreviousEnd(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="filter-actions">
                                <button className="btn btn-primary" onClick={loadComparative}>
                                    <i className="fas fa-search"></i> عرض المقارنة
                                </button>
                            </div>
                        </div>

                        {isLoading ? (
                            <div style={{ textAlign: "center", padding: "3rem" }}>
                                <i className="fas fa-spinner fa-spin" style={{ fontSize: "2rem" }}></i>
                            </div>
                        ) : comparative ? (
                            <div className="report-section animate-fade" style={{ marginTop: "1.5rem" }}>
                                <h2 style={{ marginBottom: "1.5rem" }}>
                                    <i className="fas fa-chart-bar"></i> المقارنة المالية
                                </h2>

                                <table className="modern-table" style={{ marginTop: "1.5rem" }}>
                                    <thead>
                                        <tr>
                                            <th>البند</th>
                                            <th>الفترة السابقة</th>
                                            <th>الفترة الحالية</th>
                                            <th>التغيير</th>
                                            <th>نسبة التغيير</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td><strong>الإيرادات</strong></td>
                                            <td>{formatCurrency(comparative.previous_period?.revenue || 0)}</td>
                                            <td>{formatCurrency(comparative.current_period?.revenue || 0)}</td>
                                            <td className={(comparative.changes?.revenue?.amount || 0) >= 0 ? "text-success" : "text-danger"}>
                                                {formatCurrency(comparative.changes?.revenue?.amount || 0)}
                                            </td>
                                            <td style={{ direction: 'ltr', textAlign: 'right' }}>{(comparative.changes?.revenue?.percentage || 0).toFixed(2)}%</td>
                                        </tr>
                                        <tr>
                                            <td><strong>المصروفات</strong></td>
                                            <td>{formatCurrency(comparative.previous_period?.expenses || 0)}</td>
                                            <td>{formatCurrency(comparative.current_period?.expenses || 0)}</td>
                                            <td className={(comparative.changes?.expenses?.amount || 0) >= 0 ? "text-danger" : "text-success"}>
                                                {formatCurrency(comparative.changes?.expenses?.amount || 0)}
                                            </td>
                                            <td style={{ direction: 'ltr', textAlign: 'right' }}>{(comparative.changes?.expenses?.percentage || 0).toFixed(2)}%</td>
                                        </tr>
                                        <tr>
                                            <td><strong>صافي الربح</strong></td>
                                            <td>{formatCurrency(comparative.previous_period?.net_profit || 0)}</td>
                                            <td>{formatCurrency(comparative.current_period?.net_profit || 0)}</td>
                                            <td className={(comparative.changes?.net_profit?.amount || 0) >= 0 ? "text-success" : "text-danger"}>
                                                {formatCurrency(comparative.changes?.net_profit?.amount || 0)}
                                            </td>
                                            <td style={{ direction: 'ltr', textAlign: 'right' }}>{(comparative.changes?.net_profit?.percentage || 0).toFixed(2)}%</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
                                اختر الفترات الزمنية واضغط على "عرض المقارنة"
                            </p>
                        )}
                    </div>
                </div>            </div>
        </MainLayout>
    );
}
