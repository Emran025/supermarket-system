"use client";

import { useState, useEffect } from "react";
import { MainLayout, PageHeader } from "@/components/layout";
import { TabNavigation } from "@/components/ui";
import { User, getStoredUser, checkAuth } from "@/lib/auth";
import { getIcon } from "@/lib/icons";
import { BalanceSheetTab } from "./components/BalanceSheetTab";
import { ProfitLossTab } from "./components/ProfitLossTab";
import { CashFlowTab } from "./components/CashFlowTab";
import { ComparativeTab } from "./components/ComparativeTab";

export default function ReportsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState<"balance_sheet" | "profit_loss" | "cash_flow" | "comparative">("balance_sheet");

    useEffect(() => {
        const init = async () => {
            const authenticated = await checkAuth();
            if (!authenticated) return;
            const storedUser = getStoredUser();
            setUser(storedUser);
        };
        init();
    }, []);

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

                {/* Tab Content */}
                {/* Using a simple visibility toggle approach to keep state if desired, or conditional rendering */}
                {/* Conditional rendering is cleaner for fetching behavior typically, but let's stick to the previous 'tab-content' class style if we want precise DOM matching, OR just render the active component for React simplcity. Given the previous file used `display: none` effectively via classes, I will try to replicate that or just render conditionally. 
                   Actually, looking at previous code: <div className={`tab-content ${activeTab === "balance_sheet" ? "active" : ""}`}>
                   React's conditional rendering is better to avoid mounting everything at once if we want to save resources, BUT the components fetch on mount.
                   If we unmount them (conditional rendering), they re-fetch when clicked. This is usually desired for fresh data. 
                   Let's use conditional rendering which is cleaner in React.
                */}
                
                <div style={{ marginTop: "1.5rem" }}>
                    {activeTab === "balance_sheet" && <BalanceSheetTab />}
                    {activeTab === "profit_loss" && <ProfitLossTab />}
                    {activeTab === "cash_flow" && <CashFlowTab />}
                    {activeTab === "comparative" && <ComparativeTab />}
                </div>
            </div>
        </MainLayout>
    );
}
