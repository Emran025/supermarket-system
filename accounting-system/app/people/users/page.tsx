"use client";

import { useState, useEffect, useCallback } from "react";
import { MainLayout, PageHeader } from "@/components/layout";
import { Table, Dialog, showToast, Column } from "@/components/ui";
import { fetchAPI } from "@/lib/api";
import { formatDate, getRoleBadgeText, getRoleBadgeClass } from "@/lib/utils";
import { User, getStoredUser, getStoredPermissions, Permission, canAccess } from "@/lib/auth";
import { getIcon } from "@/lib/icons";

interface Role {
  id: number;
  name: string;
}

interface Manager {
  id: number;
  full_name: string;
}

interface UserRecord {
  id: number;
  username: string;
  full_name: string;
  role_id: number;
  role_name: string;
  manager_id?: number;
  manager_name?: string;
  is_active: boolean;
  created_at: string;
}

export default function UsersPage() {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Dialogs
  const [addDialog, setAddDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);

  // Add Form
  const [addFormData, setAddFormData] = useState({
    username: "",
    password: "",
    full_name: "",
    role_id: "",
    manager_id: "",
    is_active: true,
  });

  // Edit Form
  const [editFormData, setEditFormData] = useState({
    full_name: "",
    role_id: "",
    manager_id: "",
    is_active: true,
    password: "",
  });

  const itemsPerPage = 10;

  const loadUsers = useCallback(async (page: number = 1) => {
    try {
      setIsLoading(true);
      const response = await fetchAPI(`/api/users?page=${page}&limit=${itemsPerPage}`);
      setUsers(response.users as UserRecord[] || []);
      setTotalPages(Math.ceil((response.total as number || 0) / itemsPerPage));
      setCurrentPage(page);
    } catch {
      showToast("خطأ في تحميل المستخدمين", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadRoles = useCallback(async () => {
    try {
      const response = await fetchAPI("/api/roles");
      setRoles(response.roles as Role[] || []);
    } catch {
      console.error("Error loading roles");
    }
  }, []);

  const loadManagers = useCallback(async () => {
    try {
      const response = await fetchAPI("/api/users/managers");
      setManagers(response.managers as Manager[] || []);
    } catch {
      console.error("Error loading managers");
    }
  }, []);

  useEffect(() => {
    const storedUser = getStoredUser();
    const storedPermissions = getStoredPermissions();
    setUser(storedUser);
    setPermissions(storedPermissions);
    loadUsers();
    loadRoles();
    loadManagers();
  }, [loadUsers, loadRoles, loadManagers]);

  const openAddDialog = () => {
    setAddFormData({
      username: "",
      password: "",
      full_name: "",
      role_id: roles[0]?.id?.toString() || "",
      manager_id: "",
      is_active: true,
    });
    setAddDialog(true);
  };

  const openEditDialog = (userRecord: UserRecord) => {
    setSelectedUser(userRecord);
    setEditFormData({
      full_name: userRecord.full_name,
      role_id: String(userRecord.role_id),
      manager_id: userRecord.manager_id ? String(userRecord.manager_id) : "",
      is_active: userRecord.is_active,
      password: "",
    });
    setEditDialog(true);
  };

  const handleAddSubmit = async () => {
    if (!addFormData.username.trim() || !addFormData.password.trim() || !addFormData.full_name.trim()) {
      showToast("يرجى ملء جميع الحقول المطلوبة", "error");
      return;
    }

    try {
      await fetchAPI("/api/users", {
        method: "POST",
        body: JSON.stringify({
          username: addFormData.username,
          password: addFormData.password,
          full_name: addFormData.full_name,
          role_id: parseInt(addFormData.role_id),
          manager_id: addFormData.manager_id ? parseInt(addFormData.manager_id) : null,
          is_active: addFormData.is_active,
        }),
      });
      showToast("تمت إضافة المستخدم بنجاح", "success");
      setAddDialog(false);
      loadUsers(currentPage);
      loadManagers();
    } catch {
      showToast("خطأ في إضافة المستخدم", "error");
    }
  };

  const handleEditSubmit = async () => {
    if (!selectedUser || !editFormData.full_name.trim()) {
      showToast("يرجى ملء جميع الحقول المطلوبة", "error");
      return;
    }

    const payload: Record<string, unknown> = {
      full_name: editFormData.full_name,
      role_id: parseInt(editFormData.role_id),
      manager_id: editFormData.manager_id ? parseInt(editFormData.manager_id) : null,
      is_active: editFormData.is_active,
    };

    if (editFormData.password.trim()) {
      payload.password = editFormData.password;
    }

    try {
      await fetchAPI(`/api/users/${selectedUser.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      showToast("تم تحديث المستخدم بنجاح", "success");
      setEditDialog(false);
      loadUsers(currentPage);
      loadManagers();
    } catch {
      showToast("خطأ في تحديث المستخدم", "error");
    }
  };

  const columns: Column<UserRecord>[] = [
    { key: "username", header: "اسم المستخدم", dataLabel: "اسم المستخدم" },
    { key: "full_name", header: "الاسم الكامل", dataLabel: "الاسم الكامل" },
    {
      key: "role_name",
      header: "الدور",
      dataLabel: "الدور",
      render: (item) => (
        <span className={`badge ${getRoleBadgeClass(item.role_name)}`}>
          {getRoleBadgeText(item.role_name)}
        </span>
      ),
    },
    {
      key: "manager_name",
      header: "المدير",
      dataLabel: "المدير",
      render: (item) => item.manager_name || "-",
    },
    {
      key: "is_active",
      header: "الحالة",
      dataLabel: "الحالة",
      render: (item) => (
        <span className={`badge ${item.is_active ? "badge-success" : "badge-danger"}`}>
          {item.is_active ? "نشط" : "غير نشط"}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "تاريخ الإنشاء",
      dataLabel: "تاريخ الإنشاء",
      render: (item) => formatDate(item.created_at),
    },
    {
      key: "actions",
      header: "الإجراءات",
      dataLabel: "الإجراءات",
      render: (item) => (
        <div className="action-buttons">
          {canAccess(permissions, "users", "edit") && (
            <button className="icon-btn edit" onClick={() => openEditDialog(item)} title="تعديل">
              {getIcon("edit")}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout requiredModule="users">
      <PageHeader
        title="المستخدمين"
        user={user}
        actions={
          canAccess(permissions, "users", "create") && (
            <button className="btn btn-primary" onClick={openAddDialog}>
              {getIcon("plus")}
              إضافة مستخدم
            </button>
          )
        }
      />

      <div className="sales-card animate-fade">
        <Table
          columns={columns}
          data={users}
          keyExtractor={(item) => item.id}
          emptyMessage="لا يوجد مستخدمين"
          isLoading={isLoading}
          pagination={{
            currentPage,
            totalPages,
            onPageChange: loadUsers,
          }}
        />
      </div>

      {/* Add User Dialog */}
      <Dialog
        isOpen={addDialog}
        onClose={() => setAddDialog(false)}
        title="إضافة مستخدم جديد"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setAddDialog(false)}>
              إلغاء
            </button>
            <button className="btn btn-primary" onClick={handleAddSubmit}>
              إضافة
            </button>
          </>
        }
      >
        <div className="form-group">
          <label htmlFor="add_username">اسم المستخدم *</label>
          <input
            type="text"
            id="add_username"
            value={addFormData.username}
            onChange={(e) => setAddFormData({ ...addFormData, username: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label htmlFor="add_password">كلمة المرور *</label>
          <input
            type="password"
            id="add_password"
            value={addFormData.password}
            onChange={(e) => setAddFormData({ ...addFormData, password: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label htmlFor="add_full_name">الاسم الكامل *</label>
          <input
            type="text"
            id="add_full_name"
            value={addFormData.full_name}
            onChange={(e) => setAddFormData({ ...addFormData, full_name: e.target.value })}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="add_role_id">الدور</label>
            <select
              id="add_role_id"
              value={addFormData.role_id}
              onChange={(e) => setAddFormData({ ...addFormData, role_id: e.target.value })}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {getRoleBadgeText(role.name)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="add_manager_id">المدير</label>
            <select
              id="add_manager_id"
              value={addFormData.manager_id}
              onChange={(e) => setAddFormData({ ...addFormData, manager_id: e.target.value })}
            >
              <option value="">بدون مدير</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <div className="checkbox-group">
            <input
              type="checkbox"
              id="add_is_active"
              checked={addFormData.is_active}
              onChange={(e) => setAddFormData({ ...addFormData, is_active: e.target.checked })}
            />
            <label htmlFor="add_is_active">نشط</label>
          </div>
        </div>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog
        isOpen={editDialog}
        onClose={() => setEditDialog(false)}
        title="تعديل المستخدم"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setEditDialog(false)}>
              إلغاء
            </button>
            <button className="btn btn-primary" onClick={handleEditSubmit}>
              تحديث
            </button>
          </>
        }
      >
        <div className="form-group">
          <label htmlFor="edit_full_name">الاسم الكامل *</label>
          <input
            type="text"
            id="edit_full_name"
            value={editFormData.full_name}
            onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label htmlFor="edit_password">كلمة المرور الجديدة (اتركها فارغة للإبقاء على الحالية)</label>
          <input
            type="password"
            id="edit_password"
            value={editFormData.password}
            onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="edit_role_id">الدور</label>
            <select
              id="edit_role_id"
              value={editFormData.role_id}
              onChange={(e) => setEditFormData({ ...editFormData, role_id: e.target.value })}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {getRoleBadgeText(role.name)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="edit_manager_id">المدير</label>
            <select
              id="edit_manager_id"
              value={editFormData.manager_id}
              onChange={(e) => setEditFormData({ ...editFormData, manager_id: e.target.value })}
            >
              <option value="">بدون مدير</option>
              {managers.filter((m) => m.id !== selectedUser?.id).map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <div className="checkbox-group">
            <input
              type="checkbox"
              id="edit_is_active"
              checked={editFormData.is_active}
              onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.checked })}
            />
            <label htmlFor="edit_is_active">نشط</label>
          </div>
        </div>
      </Dialog>
    </MainLayout>
  );
}

