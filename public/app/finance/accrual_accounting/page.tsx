"use client";

import { useState, useEffect } from "react";
import { MainLayout, PageHeader } from "@/components/layout";
import { TabNavigation } from "@/components/ui";
import { User, getStoredUser, checkAuth } from "@/lib/auth";
import { getIcon } from "@/lib/icons";

import { PayrollTab } from "./components/PayrollTab";
import { PrepaymentsTab } from "./components/PrepaymentsTab";
import { UnearnedRevenueTab } from "./components/UnearnedRevenueTab";
import { CreateAccrualDialog } from "./components/CreateAccrualDialog";

export default function AccrualAccountingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"payroll" | "prepayments" | "unearned">("payroll");
  const [accrualDialog, setAccrualDialog] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const init = async () => {
      const authenticated = await checkAuth();
      if (!authenticated) return;
      const storedUser = getStoredUser();
      setUser(storedUser);
    };
    init();
  }, []);

  const handleCreateSuccess = () => {
      // Force children to refresh via key prop or context, 
      // but since we render active tab conditionally, 
      // simple way is to pass a refresh trigger or use a context.
      // Easiest is to force re-mount or expose a refresh method, 
      // but we will simply toggle the key to force re-render of current tab component.
      setRefreshKey(prev => prev + 1);
  };

  return (
    <MainLayout requiredModule="accrual_accounting">
      <PageHeader
        title="المحاسبة الاستحقاقية"
        user={user}
        actions={
          <button className="btn btn-primary" onClick={() => setAccrualDialog(true)}>
            {getIcon("plus")}
            إضافة قيد
          </button>
        }
      />

      <div id="alert-container"></div>

      <div className="settings-wrapper animate-fade">
        <TabNavigation 
          tabs={[
            { key: "payroll", label: "كشوف المرتبات", icon: "fa-users" },
            { key: "prepayments", label: "المدفوعات المقدمة", icon: "fa-calendar" },
            { key: "unearned", label: "الإيرادات غير المكتسبة", icon: "fa-dollar-sign" }
          ]}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as typeof activeTab)}
        />

        <div style={{ marginTop: "1rem" }}>
            {activeTab === "payroll" && <PayrollTab key={`payroll-${refreshKey}`} />}
            {activeTab === "prepayments" && <PrepaymentsTab key={`prepayments-${refreshKey}`} />}
            {activeTab === "unearned" && <UnearnedRevenueTab key={`unearned-${refreshKey}`} />}
        </div>
      </div>

      <CreateAccrualDialog 
        isOpen={accrualDialog} 
        onClose={() => setAccrualDialog(false)} 
        onSuccess={handleCreateSuccess}
      />
    </MainLayout>
  );
}
