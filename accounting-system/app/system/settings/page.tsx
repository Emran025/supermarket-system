"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MainLayout, PageHeader } from "@/components/layout";
import { Table, Dialog, ConfirmDialog, showToast, Column } from "@/components/ui";
import { fetchAPI } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/utils";
import { User, getStoredUser, getStoredPermissions, Permission, canAccess } from "@/lib/auth";
import { getIcon } from "@/lib/icons";
import { generateInvoiceHTML, getSettings } from "@/lib/invoice-utils";
import type { InvoiceData } from "@/lib/invoice-utils";

interface StoreSettings {
  store_name: string;
  store_address: string;
  store_phone: string;
  store_email: string;
  tax_number: string;
  cr_number: string;
}

interface InvoiceSettings {
  show_logo: boolean;
  show_qr: boolean;
  footer_text: string;
  terms_text: string;
}

interface Session {
  id: number;
  device: string;
  ip_address: string;
  last_activity: string;
  is_current: boolean;
}

interface Role {
  id: number;
  name: string;
  description?: string;
  permissions: RolePermission[];
}

interface RolePermission {
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface Module {
  name: string;
  label: string;
}

const allModules: Module[] = [
  { name: "dashboard", label: "لوحة التحكم" },
  { name: "sales", label: "المبيعات" },
  { name: "deferred_sales", label: "المبيعات الآجلة" },
  { name: "revenues", label: "الإيرادات" },
  { name: "products", label: "المنتجات" },
  { name: "purchases", label: "المشتريات" },
  { name: "expenses", label: "المصروفات" },
  { name: "users", label: "المستخدمين" },
  { name: "ar_customers", label: "عملاء الآجل" },
  { name: "general_ledger", label: "دفتر الأستاذ" },
  { name: "chart_of_accounts", label: "دليل الحسابات" },
  { name: "journal_vouchers", label: "سندات القيد" },
  { name: "reports", label: "التقارير" },
  { name: "audit_trail", label: "سجل المراجعة" },
  { name: "batch_processing", label: "المعالجة الدفعية" },
  { name: "settings", label: "الإعدادات" },
];

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [activeTab, setActiveTab] = useState("store");
  const [isLoading, setIsLoading] = useState(true);

  // Store Settings
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    store_name: "",
    store_address: "",
    store_phone: "",
    store_email: "",
    tax_number: "",
    cr_number: "",
  });

  // Invoice Settings
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>({
    show_logo: true,
    show_qr: true,
    footer_text: "",
    terms_text: "",
  });

  // Password Change
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  // Sessions
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [sessionsTotalPages, setSessionsTotalPages] = useState(1);

  // Roles & Permissions
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleDialog, setRoleDialog] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [deleteRoleId, setDeleteRoleId] = useState<number | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");

  // Invoice Preview
  const [previewDialog, setPreviewDialog] = useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);

  const loadStoreSettings = useCallback(async () => {
    try {
      const response = await fetchAPI("/api/settings/store");
      if (response.settings) {
        setStoreSettings(response.settings as StoreSettings);
      }
    } catch {
      console.error("Error loading store settings");
    }
  }, []);

  const loadInvoiceSettings = useCallback(async () => {
    try {
      const response = await fetchAPI("/api/settings/invoice");
      if (response.settings) {
        setInvoiceSettings(response.settings as InvoiceSettings);
      }
    } catch {
      console.error("Error loading invoice settings");
    }
  }, []);

  const loadSessions = useCallback(async (page: number = 1) => {
    try {
      const response = await fetchAPI(`/api/sessions?page=${page}&limit=10`);
      if (response.sessions && Array.isArray(response.sessions)) {
        setSessions(response.sessions as Session[]);
      }
      const total = Number(response.total) || 0;
      setSessionsTotalPages(Math.ceil(total / 10));
      setSessionsPage(page);
    } catch {
      console.error("Error loading sessions");
    }
  }, []);

  const loadRoles = useCallback(async () => {
    try {
      const response = await fetchAPI("/api/roles");
      if (response.roles && Array.isArray(response.roles)) {
        setRoles(response.roles as Role[]);
      }
    } catch {
      console.error("Error loading roles");
    }
  }, []);

  useEffect(() => {
    const storedUser = getStoredUser();
    const storedPermissions = getStoredPermissions();
    setUser(storedUser);
    setPermissions(storedPermissions);

    const loadData = async () => {
      await Promise.all([
        loadStoreSettings(),
        loadInvoiceSettings(),
        loadSessions(),
        loadRoles(),
      ]);
      setIsLoading(false);
    };

    loadData();
  }, [loadStoreSettings, loadInvoiceSettings, loadSessions, loadRoles]);

  const saveStoreSettings = async () => {
    try {
      await fetchAPI("/api/settings/store", {
        method: "PUT",
        body: JSON.stringify(storeSettings),
      });
      showToast("تم حفظ إعدادات المتجر", "success");
    } catch {
      showToast("خطأ في حفظ الإعدادات", "error");
    }
  };

  const saveInvoiceSettings = async () => {
    try {
      await fetchAPI("/api/settings/invoice", {
        method: "PUT",
        body: JSON.stringify(invoiceSettings),
      });
      showToast("تم حفظ إعدادات الفاتورة", "success");
    } catch {
      showToast("خطأ في حفظ الإعدادات", "error");
    }
  };

  const changePassword = async () => {
    if (!passwordData.current_password || !passwordData.new_password) {
      showToast("يرجى ملء جميع الحقول", "error");
      return;
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      showToast("كلمة المرور الجديدة غير متطابقة", "error");
      return;
    }

    if (passwordData.new_password.length < 6) {
      showToast("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "error");
      return;
    }

    try {
      await fetchAPI("/api/users/change-password", {
        method: "POST",
        body: JSON.stringify({
          current_password: passwordData.current_password,
          new_password: passwordData.new_password,
        }),
      });
      showToast("تم تغيير كلمة المرور بنجاح", "success");
      setPasswordData({ current_password: "", new_password: "", confirm_password: "" });
    } catch {
      showToast("خطأ في تغيير كلمة المرور", "error");
    }
  };

  const terminateSession = async (sessionId: number) => {
    try {
      await fetchAPI(`/api/sessions/${sessionId}`, { method: "DELETE" });
      showToast("تم إنهاء الجلسة", "success");
      loadSessions(sessionsPage);
    } catch {
      showToast("خطأ في إنهاء الجلسة", "error");
    }
  };

  const selectRole = (role: Role) => {
    setSelectedRole(role);
  };

  const updateRolePermission = (moduleName: string, field: keyof RolePermission, value: boolean) => {
    if (!selectedRole) return;

    const updatedPermissions = [...selectedRole.permissions];
    const permIndex = updatedPermissions.findIndex((p) => p.module === moduleName);

    if (permIndex >= 0) {
      updatedPermissions[permIndex] = { ...updatedPermissions[permIndex], [field]: value };
    } else {
      updatedPermissions.push({
        module: moduleName,
        can_view: field === "can_view" ? value : false,
        can_create: field === "can_create" ? value : false,
        can_edit: field === "can_edit" ? value : false,
        can_delete: field === "can_delete" ? value : false,
      });
    }

    setSelectedRole({ ...selectedRole, permissions: updatedPermissions });
  };

  const saveRolePermissions = async () => {
    if (!selectedRole) return;

    try {
      await fetchAPI(`/api/roles/${selectedRole.id}/permissions`, {
        method: "PUT",
        body: JSON.stringify({ permissions: selectedRole.permissions }),
      });
      showToast("تم حفظ الصلاحيات", "success");
      loadRoles();
    } catch {
      showToast("خطأ في حفظ الصلاحيات", "error");
    }
  };

  const openCreateRoleDialog = () => {
    setNewRoleName("");
    setNewRoleDescription("");
    setRoleDialog(true);
  };

  const createRole = async () => {
    if (!newRoleName.trim()) {
      showToast("يرجى إدخال اسم الدور", "error");
      return;
    }

    try {
      await fetchAPI("/api/roles", {
        method: "POST",
        body: JSON.stringify({ name: newRoleName, description: newRoleDescription }),
      });
      showToast("تم إنشاء الدور بنجاح", "success");
      setRoleDialog(false);
      loadRoles();
    } catch {
      showToast("خطأ في إنشاء الدور", "error");
    }
  };

  const confirmDeleteRole = (roleId: number) => {
    setDeleteRoleId(roleId);
    setConfirmDialog(true);
  };

  const deleteRole = async () => {
    if (!deleteRoleId) return;

    try {
      await fetchAPI(`/api/roles/${deleteRoleId}`, { method: "DELETE" });
      showToast("تم حذف الدور", "success");
      if (selectedRole?.id === deleteRoleId) {
        setSelectedRole(null);
      }
      loadRoles();
    } catch {
      showToast("خطأ في حذف الدور", "error");
    }
  };

  const previewInvoice = async () => {
    setIsGeneratingPreview(true);
    try {
      // Get latest invoice for preview
      const invoicesResponse = await fetchAPI("/api/invoices?page=1&limit=1");
      const invoices = invoicesResponse.invoices as InvoiceData[] | undefined;
      if (!invoicesResponse.success || !invoices || invoices.length === 0) {
        showToast("لا توجد فواتير سابقة لإجراء المعاينة", "error");
        return;
      }

      const sampleInvoice = invoices[0];
      const detailResponse = await fetchAPI(`/api/invoices/${sampleInvoice.id}`);
      if (!detailResponse.success && !detailResponse.invoice) {
        showToast("فشل تحميل تفاصيل الفاتورة", "error");
        return;
      }

      const invoice = detailResponse.invoice as InvoiceData;

      // Combine current form settings with store settings
      const settings: import("@/lib/invoice-utils").InvoiceSettings = {
        store_name: storeSettings.store_name,
        store_address: storeSettings.store_address,
        store_phone: storeSettings.store_phone,
        tax_number: storeSettings.tax_number,
        invoice_size: (invoiceSettings.show_qr ? "thermal" : "a4") as "thermal" | "a4",
        footer_message: invoiceSettings.footer_text,
        currency_symbol: "ر.ي",
        show_logo: invoiceSettings.show_logo,
        show_qr: invoiceSettings.show_qr,
      };

      // Generate preview HTML
      const content = generateInvoiceHTML(invoice, settings);

      // Render in iframe
      if (previewIframeRef.current) {
        const doc = previewIframeRef.current.contentDocument || previewIframeRef.current.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(content);
          doc.close();
        }
      }

      setPreviewDialog(true);
    } catch (error) {
      console.error("Preview error", error);
      showToast("حدث خطأ أثناء المعاينة", "error");
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const getPermissionValue = (moduleName: string, field: keyof RolePermission): boolean => {
    if (!selectedRole) return false;
    const perm = selectedRole.permissions.find((p) => p.module === moduleName);
    return perm ? (perm[field] as boolean) : false;
  };

  const sessionColumns: Column<Session>[] = [
    { key: "device", header: "الجهاز", dataLabel: "الجهاز" },
    { key: "ip_address", header: "عنوان IP", dataLabel: "عنوان IP" },
    {
      key: "last_activity",
      header: "آخر نشاط",
      dataLabel: "آخر نشاط",
      render: (item) => formatDateTime(item.last_activity),
    },
    {
      key: "is_current",
      header: "الحالة",
      dataLabel: "الحالة",
      render: (item) =>
        item.is_current ? (
          <span className="badge badge-success">الجلسة الحالية</span>
        ) : null,
    },
    {
      key: "actions",
      header: "الإجراءات",
      dataLabel: "الإجراءات",
      render: (item) =>
        !item.is_current && (
          <button
            className="btn btn-sm btn-danger"
            onClick={() => terminateSession(item.id)}
          >
            إنهاء
          </button>
        ),
    },
  ];

  return (
    <MainLayout requiredModule="settings">
      <PageHeader title="الإعدادات" user={user} showDate={false} />

      <div className="settings-wrapper animate-fade">
        {/* Tabs */}
        <div className="settings-tabs">
          <button
            className={`tab-btn ${activeTab === "store" ? "active" : ""}`}
            onClick={() => setActiveTab("store")}
          >
            <i className="fas fa-store"></i>
            معلومات المتجر
          </button>
          <button
            className={`tab-btn ${activeTab === "invoice" ? "active" : ""}`}
            onClick={() => setActiveTab("invoice")}
          >
            <i className="fas fa-file-invoice"></i>
            إعدادات الفاتورة
          </button>
          <button
            className={`tab-btn ${activeTab === "security" ? "active" : ""}`}
            onClick={() => setActiveTab("security")}
          >
            <i className="fas fa-lock"></i>
            الحساب والأمان
          </button>
          <button
            className={`tab-btn ${activeTab === "sessions" ? "active" : ""}`}
            onClick={() => setActiveTab("sessions")}
          >
            <i className="fas fa-desktop"></i>
            الجلسات النشطة
          </button>
          {canAccess(permissions, "settings", "edit") && (
            <button
              className={`tab-btn ${activeTab === "roles" ? "active" : ""}`}
              onClick={() => setActiveTab("roles")}
            >
              <i className="fas fa-user-shield"></i>
              الأدوار والصلاحيات
            </button>
          )}
        </div>

        {/* Store Info Tab */}
        <div className={`tab-content ${activeTab === "store" ? "active" : ""}`}>
          <div className="sales-card">
            <h3>معلومات المتجر</h3>
            <div className="settings-form-grid">
              <div className="form-group">
                <label htmlFor="store_name">اسم المتجر</label>
                <input
                  type="text"
                  id="store_name"
                  value={storeSettings.store_name}
                  onChange={(e) => setStoreSettings({ ...storeSettings, store_name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="store_phone">رقم الهاتف</label>
                <input
                  type="tel"
                  id="store_phone"
                  value={storeSettings.store_phone}
                  onChange={(e) => setStoreSettings({ ...storeSettings, store_phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="store_email">البريد الإلكتروني</label>
                <input
                  type="email"
                  id="store_email"
                  value={storeSettings.store_email}
                  onChange={(e) => setStoreSettings({ ...storeSettings, store_email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="tax_number">الرقم الضريبي</label>
                <input
                  type="text"
                  id="tax_number"
                  value={storeSettings.tax_number}
                  onChange={(e) => setStoreSettings({ ...storeSettings, tax_number: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="cr_number">السجل التجاري</label>
                <input
                  type="text"
                  id="cr_number"
                  value={storeSettings.cr_number}
                  onChange={(e) => setStoreSettings({ ...storeSettings, cr_number: e.target.value })}
                />
              </div>
              <div className="form-group full-width">
                <label htmlFor="store_address">العنوان</label>
                <textarea
                  id="store_address"
                  value={storeSettings.store_address}
                  onChange={(e) => setStoreSettings({ ...storeSettings, store_address: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
            <button className="btn btn-primary" onClick={saveStoreSettings}>
              حفظ التغييرات
            </button>
          </div>
        </div>

        {/* Invoice Settings Tab */}
        <div className={`tab-content ${activeTab === "invoice" ? "active" : ""}`}>
          <div className="sales-card">
            <h3>إعدادات الفاتورة</h3>
            <div className="settings-form-grid">
              <div className="form-group">
                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    id="show_logo"
                    checked={invoiceSettings.show_logo}
                    onChange={(e) => setInvoiceSettings({ ...invoiceSettings, show_logo: e.target.checked })}
                  />
                  <label htmlFor="show_logo">عرض الشعار</label>
                </div>
              </div>
              <div className="form-group">
                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    id="show_qr"
                    checked={invoiceSettings.show_qr}
                    onChange={(e) => setInvoiceSettings({ ...invoiceSettings, show_qr: e.target.checked })}
                  />
                  <label htmlFor="show_qr">عرض رمز QR</label>
                </div>
              </div>
              <div className="form-group full-width">
                <label htmlFor="footer_text">نص التذييل</label>
                <textarea
                  id="footer_text"
                  value={invoiceSettings.footer_text}
                  onChange={(e) => setInvoiceSettings({ ...invoiceSettings, footer_text: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="form-group full-width">
                <label htmlFor="terms_text">الشروط والأحكام</label>
                <textarea
                  id="terms_text"
                  value={invoiceSettings.terms_text}
                  onChange={(e) => setInvoiceSettings({ ...invoiceSettings, terms_text: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
              <button className="btn btn-secondary" onClick={previewInvoice} disabled={isGeneratingPreview}>
                {isGeneratingPreview ? "جاري التحميل..." : "معاينة الفاتورة"}
              </button>
              <button className="btn btn-primary" onClick={saveInvoiceSettings}>
                حفظ التغييرات
              </button>
            </div>
          </div>
        </div>

        {/* Security Tab */}
        <div className={`tab-content ${activeTab === "security" ? "active" : ""}`}>
          <div className="sales-card">
            <h3>تغيير كلمة المرور</h3>
            <div className="settings-form-narrow">
              <div className="form-group">
                <label htmlFor="current_password">كلمة المرور الحالية</label>
                <input
                  type="password"
                  id="current_password"
                  value={passwordData.current_password}
                  onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="new_password">كلمة المرور الجديدة</label>
                <input
                  type="password"
                  id="new_password"
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="confirm_password">تأكيد كلمة المرور</label>
                <input
                  type="password"
                  id="confirm_password"
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                />
              </div>
              <button className="btn btn-primary" onClick={changePassword}>
                تغيير كلمة المرور
              </button>
            </div>
          </div>
        </div>

        {/* Sessions Tab */}
        <div className={`tab-content ${activeTab === "sessions" ? "active" : ""}`}>
          <div className="sales-card">
            <h3>الجلسات النشطة</h3>
            <Table
              columns={sessionColumns}
              data={sessions}
              keyExtractor={(item) => item.id}
              emptyMessage="لا توجد جلسات"
              isLoading={isLoading}
              pagination={{
                currentPage: sessionsPage,
                totalPages: sessionsTotalPages,
                onPageChange: loadSessions,
              }}
            />
          </div>
        </div>

        {/* Roles & Permissions Tab */}
        <div className={`tab-content ${activeTab === "roles" ? "active" : ""}`}>
          <div className="sales-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h3 style={{ margin: 0 }}>الأدوار والصلاحيات</h3>
              <button className="btn btn-primary" onClick={openCreateRoleDialog}>
                {getIcon("plus")}
                إنشاء دور جديد
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "250px 1fr", gap: "1.5rem" }}>
              {/* Roles List */}
              <div style={{ borderLeft: "1px solid var(--border-color)", paddingLeft: "1.5rem" }}>
                <h4 style={{ marginBottom: "1rem" }}>الأدوار</h4>
                {roles.map((role) => (
                  <div
                    key={role.id}
                    style={{
                      padding: "0.75rem",
                      marginBottom: "0.5rem",
                      borderRadius: "var(--radius-md)",
                      cursor: "pointer",
                      background: selectedRole?.id === role.id ? "var(--primary-subtle)" : "transparent",
                      border: selectedRole?.id === role.id ? "1px solid var(--primary-light)" : "1px solid transparent",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                    onClick={() => selectRole(role)}
                  >
                    <span style={{ fontWeight: selectedRole?.id === role.id ? 700 : 400 }}>
                      {role.name}
                    </span>
                    {role.name !== "admin" && (
                      <button
                        className="icon-btn delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmDeleteRole(role.id);
                        }}
                        style={{ padding: "4px" }}
                      >
                        {getIcon("trash")}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Permissions Grid */}
              <div>
                {selectedRole ? (
                  <>
                    <h4 style={{ marginBottom: "1rem" }}>صلاحيات دور: {selectedRole.name}</h4>
                    <div style={{ overflowX: "auto" }}>
                      <table className="modern-table">
                        <thead>
                          <tr>
                            <th>الوحدة</th>
                            <th style={{ textAlign: "center" }}>عرض</th>
                            <th style={{ textAlign: "center" }}>إنشاء</th>
                            <th style={{ textAlign: "center" }}>تعديل</th>
                            <th style={{ textAlign: "center" }}>حذف</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allModules.map((module) => (
                            <tr key={module.name}>
                              <td>{module.label}</td>
                              <td style={{ textAlign: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={getPermissionValue(module.name, "can_view")}
                                  onChange={(e) => updateRolePermission(module.name, "can_view", e.target.checked)}
                                />
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={getPermissionValue(module.name, "can_create")}
                                  onChange={(e) => updateRolePermission(module.name, "can_create", e.target.checked)}
                                />
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={getPermissionValue(module.name, "can_edit")}
                                  onChange={(e) => updateRolePermission(module.name, "can_edit", e.target.checked)}
                                />
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={getPermissionValue(module.name, "can_delete")}
                                  onChange={(e) => updateRolePermission(module.name, "can_delete", e.target.checked)}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button className="btn btn-primary" onClick={saveRolePermissions} style={{ marginTop: "1.5rem" }}>
                      حفظ الصلاحيات
                    </button>
                  </>
                ) : (
                  <p style={{ textAlign: "center", color: "var(--text-secondary)", padding: "2rem" }}>
                    اختر دور لعرض وتعديل صلاحياته
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Role Dialog */}
      <Dialog
        isOpen={roleDialog}
        onClose={() => setRoleDialog(false)}
        title="إنشاء دور جديد"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setRoleDialog(false)}>
              إلغاء
            </button>
            <button className="btn btn-primary" onClick={createRole}>
              إنشاء
            </button>
          </>
        }
      >
        <div className="form-group">
          <label htmlFor="role_name">اسم الدور *</label>
          <input
            type="text"
            id="role_name"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="role_description">الوصف</label>
          <textarea
            id="role_description"
            value={newRoleDescription}
            onChange={(e) => setNewRoleDescription(e.target.value)}
            rows={2}
          />
        </div>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog}
        onClose={() => setConfirmDialog(false)}
        onConfirm={deleteRole}
        title="تأكيد الحذف"
        message="هل أنت متأكد من حذف هذا الدور؟"
        confirmText="حذف"
        confirmVariant="danger"
      />

      {/* Invoice Preview Dialog */}
      <Dialog
        isOpen={previewDialog}
        onClose={() => setPreviewDialog(false)}
        title="معاينة الفاتورة"
        maxWidth="900px"
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => {
                if (previewIframeRef.current?.contentWindow) {
                  previewIframeRef.current.contentWindow.focus();
                  previewIframeRef.current.contentWindow.print();
                }
              }}
            >
              {getIcon("print")} طباعة
            </button>
            <button className="btn btn-primary" onClick={() => setPreviewDialog(false)}>
              إغلاق
            </button>
          </>
        }
      >
        <div style={{ position: "relative", background: "#e2e8f0", padding: "1rem", borderRadius: "8px", height: "70vh", overflow: "auto" }}>
          <iframe
            ref={previewIframeRef}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              background: "white",
              borderRadius: "4px",
            }}
            title="Invoice Preview"
          />
        </div>
      </Dialog>
    </MainLayout>
  );
}

