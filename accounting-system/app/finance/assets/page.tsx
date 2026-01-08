"use client";

import { useState, useEffect, useCallback } from "react";
import { MainLayout, PageHeader } from "@/components/layout";
import { Table, Dialog, ConfirmDialog, showToast, Column, showAlert } from "@/components/ui";
import { fetchAPI } from "@/lib/api";
import { formatCurrency, formatDate, parseNumber } from "@/lib/utils";
import { User, getStoredUser, canAccess, getStoredPermissions, Permission, checkAuth } from "@/lib/auth";
import { getIcon } from "@/lib/icons";

interface Asset {
    id: number;
    name: string;
    value: number;
    purchase_date: string;
    depreciation_rate: number;
    status: "active" | "maintenance" | "disposed";
    description?: string;
    recorder_name?: string;
}

export default function AssetsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Dialogs
    const [assetDialog, setAssetDialog] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState(false);
    const [deleteAssetId, setDeleteAssetId] = useState<number | null>(null);

    // Form
    const [currentAssetId, setCurrentAssetId] = useState<number | null>(null);
    const [assetName, setAssetName] = useState("");
    const [assetValue, setAssetValue] = useState("");
    const [assetDate, setAssetDate] = useState(new Date().toISOString().split("T")[0]);
    const [assetDepreciation, setAssetDepreciation] = useState("0");
    const [assetStatus, setAssetStatus] = useState<"active" | "maintenance" | "disposed">("active");
    const [assetDescription, setAssetDescription] = useState("");

    const itemsPerPage = 20;

    const loadAssets = useCallback(async (page: number = 1, search: string = "") => {
        try {
            setIsLoading(true);
            const response = await fetchAPI(
                `assets?page=${page}&limit=${itemsPerPage}&search=${encodeURIComponent(search)}`
            );
            if (response.success && response.data) {
                setAssets(response.data as Asset[]);
                const total = Number(response.total) || 0;
                setTotalPages(Math.ceil(total / itemsPerPage));
                setCurrentPage(page);
            } else {
                showAlert("alert-container", response.message || "فشل تحميل الأصول", "error");
            }
        } catch {
            showAlert("alert-container", "خطأ في الاتصال بالسيرفر", "error");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            const authenticated = await checkAuth();
            if (!authenticated) return;

            const storedUser = getStoredUser();
            const storedPermissions = getStoredPermissions();
            setUser(storedUser);
            setPermissions(storedPermissions);
            await loadAssets();
        };
        init();
    }, [loadAssets]);

    // Search debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            loadAssets(1, searchTerm);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm, loadAssets]);

    const translateStatus = (status: string) => {
        const statuses: Record<string, string> = {
            active: "نشط",
            maintenance: "في الصيانة",
            disposed: "مستبعد",
        };
        return statuses[status] || status;
    };

    const getStatusClass = (status: string) => {
        const classes: Record<string, string> = {
            active: "badge-success",
            maintenance: "badge-warning",
            disposed: "badge-danger",
        };
        return classes[status] || "badge-secondary";
    };

    const openAddDialog = () => {
        setCurrentAssetId(null);
        setAssetName("");
        setAssetValue("");
        setAssetDate(new Date().toISOString().split("T")[0]);
        setAssetDepreciation("0");
        setAssetStatus("active");
        setAssetDescription("");
        setAssetDialog(true);
    };

    const editAsset = (id: number) => {
        const asset = assets.find((a) => a.id === id);
        if (!asset) return;

        setCurrentAssetId(id);
        setAssetName(asset.name);
        setAssetValue(String(asset.value));
        setAssetDate(asset.purchase_date);
        setAssetDepreciation(String(asset.depreciation_rate || 0));
        setAssetStatus(asset.status);
        setAssetDescription(asset.description || "");
        setAssetDialog(true);
    };

    const saveAsset = async () => {
        if (!assetName || !assetValue || !assetDate) {
            showAlert("alert-container", "يرجى ملء جميع الحقول المطلوبة", "error");
            return;
        }

        try {
            const method = currentAssetId ? "PUT" : "POST";
            const body: any = {
                name: assetName,
                value: parseNumber(assetValue),
                purchase_date: assetDate,
                depreciation_rate: parseNumber(assetDepreciation),
                status: assetStatus,
                description: assetDescription,
            };
            if (currentAssetId) body.id = currentAssetId;

            const response = await fetchAPI("assets", {
                method,
                body: JSON.stringify(body),
            });

            if (response.success) {
                showAlert("alert-container", "تم الحفظ بنجاح", "success");
                setAssetDialog(false);
                await loadAssets(currentPage, searchTerm);
            } else {
                showAlert("alert-container", response.message || "فشل الحفظ", "error");
            }
        } catch {
            showAlert("alert-container", "خطأ في الاتصال بالسيرفر", "error");
        }
    };

    const confirmDeleteAsset = (id: number) => {
        setDeleteAssetId(id);
        setConfirmDialog(true);
    };

    const deleteAsset = async () => {
        if (!deleteAssetId) return;

        try {
            const response = await fetchAPI(`assets?id=${deleteAssetId}`, { method: "DELETE" });
            if (response.success) {
                showAlert("alert-container", "تم الحذف بنجاح", "success");
                setConfirmDialog(false);
                setDeleteAssetId(null);
                await loadAssets(currentPage, searchTerm);
            } else {
                showAlert("alert-container", response.message || "فشل الحذف", "error");
            }
        } catch {
            showAlert("alert-container", "خطأ في الحذف", "error");
        }
    };

    const columns: Column<Asset>[] = [
        {
            key: "id",
            header: "#",
            dataLabel: "#",
            render: (item) => `#${item.id}`,
        },
        {
            key: "name",
            header: "الاسم",
            dataLabel: "الاسم",
            render: (item) => <strong>{item.name}</strong>,
        },
        {
            key: "value",
            header: "القيمة",
            dataLabel: "القيمة",
            render: (item) => formatCurrency(item.value),
        },
        {
            key: "purchase_date",
            header: "تاريخ الشراء",
            dataLabel: "تاريخ الشراء",
            render: (item) => formatDate(item.purchase_date),
        },
        {
            key: "depreciation_rate",
            header: "نسبة الإهلاك",
            dataLabel: "نسبة الإهلاك",
            render: (item) => `${item.depreciation_rate || 0}%`,
        },
        {
            key: "status",
            header: "الحالة",
            dataLabel: "الحالة",
            render: (item) => (
                <span className={`badge ${getStatusClass(item.status)}`}>
                    {translateStatus(item.status)}
                </span>
            ),
        },
        {
            key: "recorder_name",
            header: "بواسطة",
            dataLabel: "بواسطة",
            render: (item) => (
                <span className="badge badge-secondary">{item.recorder_name || "النظام"}</span>
            ),
        },
        {
            key: "actions",
            header: "الإجراءات",
            dataLabel: "الإجراءات",
            render: (item) => (
                <div className="action-buttons">
                    {canAccess(permissions, "assets", "edit") && (
                        <button className="icon-btn edit" onClick={() => editAsset(item.id)} title="تعديل">
                            {getIcon("edit")}
                        </button>
                    )}
                    {canAccess(permissions, "assets", "delete") && (
                        <button
                            className="icon-btn delete"
                            onClick={() => confirmDeleteAsset(item.id)}
                            title="حذف"
                        >
                            {getIcon("trash")}
                        </button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <MainLayout requiredModule="assets">
            <PageHeader
                title="إدارة الأصول"
                user={user}
                searchInput={
                    <input
                        type="text"
                        id="params-search"
                        placeholder="بحث في الاسم أو الوصف..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: "300px" }}
                    />
                }
                actions={
                    canAccess(permissions, "assets", "create") && (
                        <button className="btn btn-primary" onClick={openAddDialog}>
                            {getIcon("plus")}
                            أصل جديد
                        </button>
                    )
                }
            />

            <div id="alert-container"></div>

            <div className="sales-card animate-fade">
                <Table
                    columns={columns}
                    data={assets}
                    keyExtractor={(item) => item.id}
                    emptyMessage="لا توجد أصول مسجلة"
                    isLoading={isLoading}
                    pagination={{
                        currentPage,
                        totalPages,
                        onPageChange: (page) => loadAssets(page, searchTerm),
                    }}
                />
            </div>

            {/* Asset Dialog */}
            <Dialog
                isOpen={assetDialog}
                onClose={() => setAssetDialog(false)}
                title={currentAssetId ? "تعديل بيانات الأصل" : "إضافة أصل جديد"}
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setAssetDialog(false)}>
                            إلغاء
                        </button>
                        <button className="btn btn-primary" onClick={saveAsset}>
                            حفظ
                        </button>
                    </>
                }
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        saveAsset();
                    }}
                >
                    <div className="form-group">
                        <label htmlFor="asset-name">اسم الأصل *</label>
                        <input
                            type="text"
                            id="asset-name"
                            value={assetName}
                            onChange={(e) => setAssetName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="asset-value">القيمة *</label>
                            <input
                                type="number"
                                id="asset-value"
                                value={assetValue}
                                onChange={(e) => setAssetValue(e.target.value)}
                                min="0"
                                step="0.01"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="asset-date">تاريخ الشراء *</label>
                            <input
                                type="date"
                                id="asset-date"
                                value={assetDate}
                                onChange={(e) => setAssetDate(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="asset-depreciation">نسبة الإهلاك (%)</label>
                            <input
                                type="number"
                                id="asset-depreciation"
                                value={assetDepreciation}
                                onChange={(e) => setAssetDepreciation(e.target.value)}
                                min="0"
                                max="100"
                                step="0.1"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="asset-status">الحالة</label>
                            <select
                                id="asset-status"
                                value={assetStatus}
                                onChange={(e) => setAssetStatus(e.target.value as typeof assetStatus)}
                            >
                                <option value="active">نشط</option>
                                <option value="maintenance">في الصيانة</option>
                                <option value="disposed">مستبعد</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="asset-description">الوصف</label>
                        <textarea
                            id="asset-description"
                            value={assetDescription}
                            onChange={(e) => setAssetDescription(e.target.value)}
                            rows={3}
                        />
                    </div>
                </form>
            </Dialog>

            {/* Confirm Delete Dialog */}
            <ConfirmDialog
                isOpen={confirmDialog}
                onClose={() => setConfirmDialog(false)}
                onConfirm={deleteAsset}
                title="تأكيد الحذف"
                message="هل أنت متأكد من حذف هذا الأصل؟"
                confirmText="حذف"
                confirmVariant="danger"
            />
        </MainLayout>
    );
}

