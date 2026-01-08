"use client";

import { useState, useEffect } from "react";
import { MainLayout, PageHeader } from "@/components/layout";
import { TabNavigation } from "@/components/ui";
import { User, getStoredUser, getStoredPermissions, Permission, canAccess } from "@/lib/auth";
import { getIcon } from "@/lib/icons";

import { StoreSettingsTab } from "./components/StoreSettingsTab";
import { InvoiceSettingsTab } from "./components/InvoiceSettingsTab";
import { SecurityTab } from "./components/SecurityTab";
import { SessionsTab } from "./components/SessionsTab";
import { RolesTab } from "./components/RolesTab";

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [activeTab, setActiveTab] = useState("store");

  useEffect(() => {
    const storedUser = getStoredUser();
    const storedPermissions = getStoredPermissions();
    setUser(storedUser);
    setPermissions(storedPermissions);
  }, []);

  return (
    <MainLayout requiredModule="settings">
      <PageHeader title="الإعدادات" user={user} showDate={true} />

      <div className="settings-wrapper animate-fade">
        <TabNavigation 
          tabs={[
            { key: "store", label: "معلومات المتجر", icon: "fa-store" },
            { key: "invoice", label: "إعدادات الفاتورة", icon: "fa-file-invoice" },
            { key: "security", label: "الحساب والأمان", icon: "fa-lock" },
            { key: "sessions", label: "الجلسات النشطة", icon: "fa-desktop" },
            ...(canAccess(permissions, "settings", "edit") 
              ? [{ key: "roles", label: "الأدوار والصلاحيات", icon: "fa-user-shield" }]
              : []
            )
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <div style={{ marginTop: "1rem" }}>
            {activeTab === "store" && <StoreSettingsTab />}
            {activeTab === "invoice" && <InvoiceSettingsTab />}
            {activeTab === "security" && <SecurityTab />}
            {activeTab === "sessions" && <SessionsTab />}
            {activeTab === "roles" && canAccess(permissions, "settings", "edit") && <RolesTab />}
        </div>
      </div>
    </MainLayout>
  );
}
