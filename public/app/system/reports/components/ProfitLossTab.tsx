
import { formatCurrency } from "@/lib/utils";
import { ProfitLossView, APIProfitLoss } from "../types";
import { fetchAPI } from "@/lib/api";
import { showToast } from "@/components/ui";
import { useState, useCallback, useEffect } from "react";

export function ProfitLossTab() {
    const [isLoading, setIsLoading] = useState(false);
    const [profitLoss, setProfitLoss] = useState<ProfitLossView | null>(null);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    // Initialize defaults on mount
    useEffect(() => {
        const today = new Date().toISOString().split("T")[0];
        const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
        setStartDate(firstDay);
        setEndDate(today);
    }, []);

    const loadProfitLoss = useCallback(async () => {
        if (!startDate || !endDate) {
            // Wait for initialization or user input
            return;
        }

        try {
            setIsLoading(true);
            const response = await fetchAPI(
                `reports/profit_loss?start_date=${startDate}&end_date=${endDate}`
            );
            if (response.success && response.data) {
                const apiData = response.data as APIProfitLoss;
                setProfitLoss({
                    total_revenue: Number(apiData.revenue.total || 0),
                    total_expenses: Number(apiData.expenses.total || 0),
                    net_profit: Number(apiData.net_income || 0)
                });
            } else {
                showToast(response.message || "فشل تحميل قائمة الدخل", "error");
            }
        } catch {
            showToast("خطأ في الاتصال بالسيرفر", "error");
        } finally {
            setIsLoading(false);
        }
    }, [startDate, endDate]);

    return (
        <div className="sales-card">
            <h2><i className="fas fa-chart-line"></i> قائمة الدخل</h2>

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
                        <i className="fas fa-chart-line"></i> قائمة الدخل ({startDate} إلى {endDate})
                    </h2>
                    <div className="financial-row">
                        <span className="report-label">إجمالي الإيرادات</span>
                        <span className="report-value text-success">{formatCurrency(profitLoss.total_revenue || 0)}</span>
                    </div>
                    <div className="financial-row">
                        <span className="report-label">المصروفات</span>
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
    );
}
