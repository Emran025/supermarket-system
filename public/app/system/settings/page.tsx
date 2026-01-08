"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MainLayout, PageHeader } from "@/components/layout";
import { Table, Dialog, ConfirmDialog, showToast, Column, TabNavigation, Tab } from "@/components/ui";
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

interface ModuleData {
  id: number;
  module_key: string;
  name_ar: string;
  name_en: string;
  category: string;
}

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

  // Modules state
  const [modulesByCategory, setModulesByCategory] = useState<Record<string, ModuleData[]>>({});
  const [flatModules, setFlatModules] = useState<ModuleData[]>([]);

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
      const response = await fetchAPI("/api/roles?action=roles");
      if (response.data && Array.isArray(response.data)) {
        // Map backend fields to frontend Role interface
        const mappedRoles = response.data.map((r: any) => ({
          id: r.id,
          name: r.role_name_ar || r.role_key,
          description: r.description,
          permissions: [] // Will be loaded on selection
        }));
        setRoles(mappedRoles);
      }
    } catch {
      console.error("Error loading roles");
    }
  }, []);

  const loadModules = useCallback(async () => {
    try {
      const response = await fetchAPI("/api/roles?action=modules");
      if (response.data) {
        // response.data is grouped by category: { "sales": [...], "inventory": [...] }
        setModulesByCategory(response.data as Record<string, ModuleData[]>);
        
        const flat: ModuleData[] = [];
        Object.values(response.data).forEach((categoryModules: any) => {
          flat.push(...categoryModules);
        });
        setFlatModules(flat);
      }
    } catch {
      console.error("Error loading modules");
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
        loadModules(),
      ]);
      setIsLoading(false);
    };

    loadData();
  }, [loadStoreSettings, loadInvoiceSettings, loadSessions, loadRoles, loadModules]);

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

  const selectRole = async (role: Role) => {
    setSelectedRole(role);
    try {
      const response = await fetchAPI(`/api/roles?action=role_permissions&role_id=${role.id}`);
      if (response.data && Array.isArray(response.data)) {
        const mappedPermissions: RolePermission[] = response.data.map((p: any) => ({
          module: p.module_key,
          can_view: Boolean(Number(p.can_view)),
          can_create: Boolean(Number(p.can_create)),
          can_edit: Boolean(Number(p.can_edit)),
          can_delete: Boolean(Number(p.can_delete)),
        }));
        setSelectedRole({ ...role, permissions: mappedPermissions });
      }
    } catch {
      showToast("خطأ في تحميل الصلاحيات", "error");
    }
  };

  const updateRolePermission = (moduleName: string, field: keyof RolePermission, value: boolean) => {
    if (!selectedRole) return;

    const currentPermissions = Array.isArray(selectedRole.permissions) ? selectedRole.permissions : [];
    const updatedPermissions = [...currentPermissions];
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
    if (!selectedRole || !Array.isArray(selectedRole.permissions)) return;

    try {
      await fetchAPI(`/api/roles?action=update_permissions`, {
        method: "POST",
        body: JSON.stringify({ 
          role_id: selectedRole.id,
          permissions: (selectedRole.permissions || []).map(p => {
            const moduleInfo = flatModules.find((m) => m.module_key === p.module);
            return {
              module_id: moduleInfo?.id,
              can_view: p.can_view ? 1 : 0,
              can_create: p.can_create ? 1 : 0,
              can_edit: p.can_edit ? 1 : 0,
              can_delete: p.can_delete ? 1 : 0
            };
          }).filter(p => p.module_id)
        }),
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
    if (!selectedRole || !Array.isArray(selectedRole.permissions)) return false;
    const perm = selectedRole.permissions.find((p) => p.module === moduleName);
    return perm ? (perm[field] as boolean) : false;
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      dashboard: "لوحة التحكم",
      sales: "المبيعات",
      inventory: "المخزون",
      purchases: "المشتريات",
      finance: "المالية",
      hr: "الموارد البشرية",
      reports: "التقارير",
      system: "النظام",
      users: "المستخدمين"
    };
    return labels[category] || category;
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
      <PageHeader title="الإعدادات" user={user} showDate={true} />

      <div className="settings-wrapper animate-fade">
        {/* Tabs */}
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
          <div className="roles-container">
            {/* Roles List */}
            <div className="roles-list-card">
              <div className="section-header" style={{ padding: "1.25rem", borderBottom: "1px solid var(--border-color)" }}>
                <h3>الأدوار الوظيفية</h3>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={openCreateRoleDialog}
                >
                  {getIcon("plus")} دور جديد
                </button>
              </div>
              <div className="roles-list" id="rolesList">
                {isLoading ? (
                  <div className="empty-state">
                     <i className="fas fa-spinner fa-spin"></i>
                     <p>جاري تحميل الأدوار...</p>
                  </div>
                ) : roles.length === 0 ? (
                  <div className="empty-state">
                     <p>لا توجد أدوار مضافة</p>
                  </div>
                ) : (
                  roles.map((role) => (
                    <div
                      key={role.id}
                      className={`role-item ${selectedRole?.id === role.id ? "active" : ""}`}
                      onClick={() => selectRole(role)}
                    >
                      <div className="role-info">
                        <h4>
                           {role.name}
                           {/* Add system badge if needed, though interface doesn't strictly have is_system yet */}
                           {role.name === 'admin' && <span className="badge-system">نظام</span>}
                        </h4>
                        <p>{role.description || "لا يوجد وصف"}</p>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        {role.name !== "admin" && (
                          <button
                            className="icon-btn delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmDeleteRole(role.id);
                            }}
                            title="حذف الدور"
                          >
                            {/* SVG trash icon usually, assuming getIcon returns SVG or we use FA */}
                            <i className="fas fa-trash"></i>
                          </button>
                        )}
                        <i className="fas fa-chevron-left" style={{ opacity: 0.5 }}></i>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Permissions Grid */}
            <div className="permissions-card">
               {!selectedRole ? (
                  <div className="empty-state" style={{ height: "100%", justifyContent: "center" , alignItems: "center"  }}>
                    <i className="fas fa-shield-halved" style={{ fontSize: "4rem", marginBottom: "1.5rem", color: "var(--primary-light)", opacity: 0.3 }}></i>
                    <h3>لوحة التحكم بالصلاحيات</h3>
                    <p>يرجى اختيار دور وظيفي لعرض وتعديل الصلاحيات الممنوحة له.</p>
                  </div>
               ) : (
                 <>
                  <div className="section-header" style={{ padding: "1.25rem", borderBottom: "1px solid var(--border-color)" }}>
                    <div className="title-with-icon">
                      <i className="fas fa-user-tag text-primary" style={{ fontSize: "1.5rem" }}></i>
                      <div>
                        <h3 style={{ margin: 0 }}>{selectedRole.name}</h3>
                        <p className="text-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                          {selectedRole.description || "لا يوجد وصف"}
                        </p>
                      </div>
                    </div>
                    <div className="header-actions">
                       <button className="btn btn-primary btn-sm" onClick={saveRolePermissions}>
                         <i className="fas fa-save"></i> حفظ التغييرات
                       </button>
                    </div>
                  </div>

                  <div className="permissions-grid">
                    {Object.entries(modulesByCategory).map(([category, modules]) => (
                      <div key={category} className="permission-group">
                        <div className="group-title">
                          {getCategoryLabel(category)}
                        </div>
                        {modules.map((module) => (
                          <div key={module.module_key} className="module-row">
                            <div className="module-name">{module.name_ar || module.name_en}</div>
                            <div className="actions-grid">
                              <label className="action-checkbox">
                                <input
                                  type="checkbox"
                                  checked={getPermissionValue(module.module_key, "can_view")}
                                  onChange={(e) => updateRolePermission(module.module_key, "can_view", e.target.checked)}
                                /> عرض
                              </label>
                              <label className="action-checkbox">
                                <input
                                  type="checkbox"
                                  checked={getPermissionValue(module.module_key, "can_create")}
                                  onChange={(e) => updateRolePermission(module.module_key, "can_create", e.target.checked)}
                                /> إضافة
                              </label>
                              <label className="action-checkbox">
                                <input
                                  type="checkbox"
                                  checked={getPermissionValue(module.module_key, "can_edit")}
                                  onChange={(e) => updateRolePermission(module.module_key, "can_edit", e.target.checked)}
                                /> تعديل
                              </label>
                              <label className="action-checkbox">
                                <input
                                  type="checkbox"
                                  checked={getPermissionValue(module.module_key, "can_delete")}
                                  onChange={(e) => updateRolePermission(module.module_key, "can_delete", e.target.checked)}
                                /> حذف
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                 </>
               )}
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
