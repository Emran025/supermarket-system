
import { formatCurrency } from "@/lib/utils";
import { APIComparative } from "../types";
import { fetchAPI } from "@/lib/api";
import { showToast } from "@/components/ui";
import { useState, useCallback, useEffect } from "react";

export function ComparativeTab() {
    const [isLoading, setIsLoading] = useState(false);
    const [comparative, setComparative] = useState<APIComparative | null>(null);
    
    const [currentStart, setCurrentStart] = useState("");
    const [currentEnd, setCurrentEnd] = useState("");
    const [previousStart, setPreviousStart] = useState("");
    const [previousEnd, setPreviousEnd] = useState("");

    useEffect(() => {
        const today = new Date().toISOString().split("T")[0];
        const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
        setCurrentStart(firstDay);
        setCurrentEnd(today);

        // Previous period defaults
        const prevMonthFirst = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split("T")[0];
        const prevMonthLast = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split("T")[0];
        setPreviousStart(prevMonthFirst);
        setPreviousEnd(prevMonthLast);
    }, []);

    const loadComparative = useCallback(async () => {
        if (!currentStart || !currentEnd) {
            // Wait for input
            return;
        }

        try {
            setIsLoading(true);
            let url = `reports/comparative?current_start=${currentStart}&current_end=${currentEnd}`;
            if (previousStart && previousEnd) {
                url += `&previous_start=${previousStart}&previous_end=${previousEnd}`;
            }

            const response = await fetchAPI(url);
            if (response.success && response.data) {
                setComparative(response.data as APIComparative);
            } else {
                showToast(response.message || "فشل تحميل المقارنة", "error");
            }
        } catch {
            showToast("خطأ في الاتصال بالسيرفر", "error");
        } finally {
            setIsLoading(false);
        }
    }, [currentStart, currentEnd, previousStart, previousEnd]);

    return (
        <div className="sales-card">
            <h2><i className="fas fa-chart-bar"></i> المقارنة المالية</h2>

            <div className="filter-section">
                <div className="filter-group">
                    <label>الفترة الحالية</label>
                    <div className="date-range-group">
                        <input
                            type="date"
                            value={currentStart}
                            onChange={(e) => setCurrentStart(e.target.value)}
                        />
                        <span>إلى</span>
                        <input
                            type="date"
                            value={currentEnd}
                            onChange={(e) => setCurrentEnd(e.target.value)}
                        />
                    </div>
                </div>
                <div className="filter-group">
                    <label>الفترة السابقة (اختياري)</label>
                    <div className="date-range-group">
                        <input
                            type="date"
                            value={previousStart}
                            onChange={(e) => setPreviousStart(e.target.value)}
                        />
                        <span>إلى</span>
                        <input
                            type="date"
                            value={previousEnd}
                            onChange={(e) => setPreviousEnd(e.target.value)}
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
    );
}
