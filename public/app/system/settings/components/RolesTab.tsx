
import { useState, useEffect, useCallback } from "react";
import { fetchAPI } from "@/lib/api";
import { showToast, Dialog, ConfirmDialog } from "@/components/ui";
import { getIcon } from "@/lib/icons";
import { Role, RolePermission, ModuleData } from "../types";

export function RolesTab() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleDialog, setRoleDialog] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [deleteRoleId, setDeleteRoleId] = useState<number | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Modules state
  const [modulesByCategory, setModulesByCategory] = useState<Record<string, ModuleData[]>>({});
  const [flatModules, setFlatModules] = useState<ModuleData[]>([]);

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
    const init = async () => {
        setIsLoading(true);
        await Promise.all([loadRoles(), loadModules()]);
        setIsLoading(false);
    };
    init();
  }, [loadRoles, loadModules]);

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

  return (
    <>
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
    </>
  );
}
