
import { formatCurrency } from "@/lib/utils";
import { CashFlowView, APICashFlow } from "../types";
import { fetchAPI } from "@/lib/api";
import { showToast } from "@/components/ui";
import { useState, useCallback, useEffect } from "react";

export function CashFlowTab() {
    const [isLoading, setIsLoading] = useState(false);
    const [cashFlow, setCashFlow] = useState<CashFlowView | null>(null);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    useEffect(() => {
        const today = new Date().toISOString().split("T")[0];
        const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
        setStartDate(firstDay);
        setEndDate(today);
    }, []);

    const loadCashFlow = useCallback(async () => {
        if (!startDate || !endDate) {
            // Wait for input
            return;
        }

        try {
            setIsLoading(true);
            const response = await fetchAPI(
                `reports/cash_flow?start_date=${startDate}&end_date=${endDate}`
            );
            if (response.success && response.data) {
                const apiData = response.data as APICashFlow;
                setCashFlow({
                    operating_activities: {
                        net_profit: Number(apiData.operating_activities.net_income || 0),
                        net_cash_flow: Number(apiData.operating_activities.net_income || 0), // Fallback
                    },
                    investing_activities: {
                        asset_purchases: Number(apiData.investing_activities.total || 0)
                    },
                    financing_activities: {
                        capital: Number(apiData.financing_activities.total || 0)
                    },
                    net_cash_flow: Number(apiData.net_change_in_cash || 0)
                });
            } else {
                showToast(response.message || "فشل تحميل قائمة التدفقات النقدية", "error");
            }
        } catch {
            showToast("خطأ في الاتصال بالسيرفر", "error");
        } finally {
            setIsLoading(false);
        }
    }, [startDate, endDate]);

    return (
        <div className="sales-card">
            <h2><i className="fas fa-money-bill-wave"></i> قائمة التدفقات النقدية</h2>

            <div className="filter-section">
                <div className="filter-group">
                    <label>فترة التقرير</label>
                    <div className="date-range-group">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <span>إلى</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
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
                        <i className="fas fa-money-bill-wave"></i> قائمة التدفقات النقدية ({startDate} إلى {endDate})
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
    );
}
