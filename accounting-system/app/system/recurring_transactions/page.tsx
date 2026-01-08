"use client";

import { useState, useEffect, useCallback } from "react";
import { MainLayout, PageHeader } from "@/components/layout";
import { Table, Dialog, ConfirmDialog, showToast, Column, showAlert } from "@/components/ui";
import { fetchAPI } from "@/lib/api";
import { formatDate, parseNumber } from "@/lib/utils";
import { User, getStoredUser, checkAuth } from "@/lib/auth";
import { getIcon } from "@/lib/icons";

interface RecurringTemplate {
    id: number;
    name: string;
    type: "expense" | "revenue" | "journal_voucher";
    frequency: "daily" | "weekly" | "monthly" | "quarterly" | "annually";
    next_due_date: string;
    last_generated_date?: string;
    template_data?: any;
}

export default function RecurringTransactionsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    // Dialogs
    const [templateDialog, setTemplateDialog] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState(false);
    const [deleteTemplateId, setDeleteTemplateId] = useState<number | null>(null);
    const [generateTemplateId, setGenerateTemplateId] = useState<number | null>(null);

    // Form
    const [currentTemplateId, setCurrentTemplateId] = useState<number | null>(null);
    const [templateName, setTemplateName] = useState("");
    const [templateType, setTemplateType] = useState<"expense" | "revenue" | "journal_voucher">("expense");
    const [templateFrequency, setTemplateFrequency] = useState<"daily" | "weekly" | "monthly" | "quarterly" | "annually">("monthly");
    const [nextDueDate, setNextDueDate] = useState(new Date().toISOString().split("T")[0]);

    // Expense fields
    const [expenseAccount, setExpenseAccount] = useState("");
    const [expenseAmount, setExpenseAmount] = useState("");
    const [expenseDescription, setExpenseDescription] = useState("");

    // Revenue fields
    const [revenueAccount, setRevenueAccount] = useState("");
    const [revenueAmount, setRevenueAmount] = useState("");
    const [revenueDescription, setRevenueDescription] = useState("");

    // Journal fields
    const [journalEntries, setJournalEntries] = useState("");

    const itemsPerPage = 20;

    const loadTemplates = useCallback(async (page: number = 1) => {
        try {
            setIsLoading(true);
            const response = await fetchAPI(`recurring_transactions?page=${page}&limit=${itemsPerPage}`);
            if (response.success && response.data) {
                setTemplates(response.data as RecurringTemplate[]);
                const total = Number(response.total) || 0;
                setTotalPages(Math.ceil(total / itemsPerPage));
                setCurrentPage(page);
            } else {
                showAlert("alert-container", response.message || "فشل تحميل القوالب", "error");
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
            setUser(storedUser);
            await loadTemplates();
        };
        init();
    }, [loadTemplates]);

    const openCreateDialog = () => {
        setCurrentTemplateId(null);
        setTemplateName("");
        setTemplateType("expense");
        setTemplateFrequency("monthly");
        setNextDueDate(new Date().toISOString().split("T")[0]);
        setExpenseAccount("");
        setExpenseAmount("");
        setExpenseDescription("");
        setRevenueAccount("");
        setRevenueAmount("");
        setRevenueDescription("");
        setJournalEntries("");
        setTemplateDialog(true);
    };

    const viewTemplate = async (id: number) => {
        try {
            const response = await fetchAPI(`recurring_transactions?id=${id}`);
            if (response.success && response.data) {
                const template = Array.isArray(response.data) ? response.data[0] : response.data;
                if (template) {
                    alert(
                        `الاسم: ${template.name}\nالنوع: ${template.type}\nالتكرار: ${template.frequency}\nتاريخ الاستحقاق: ${formatDate(template.next_due_date)}`
                    );
                }
            }
        } catch {
            showToast("خطأ في تحميل القالب", "error");
        }
    };

    const editTemplate = async (id: number) => {
        try {
            const response = await fetchAPI(`recurring_transactions?id=${id}`);
            if (response.success && response.data) {
                const template = Array.isArray(response.data) ? response.data[0] : response.data;
                if (!template) {
                    showAlert("alert-container", "القالب غير موجود", "error");
                    return;
                }

                setCurrentTemplateId(template.id);
                setTemplateName(template.name);
                setTemplateType(template.type);
                setTemplateFrequency(template.frequency);
                setNextDueDate(template.next_due_date);

                const templateData = template.template_data || {};
                if (template.type === "expense") {
                    setExpenseAccount(templateData.account_code || "");
                    setExpenseAmount(String(templateData.amount || ""));
                    setExpenseDescription(templateData.description || "");
                } else if (template.type === "revenue") {
                    setRevenueAccount(templateData.account_code || "");
                    setRevenueAmount(String(templateData.amount || ""));
                    setRevenueDescription(templateData.description || "");
                } else if (template.type === "journal_voucher") {
                    setJournalEntries(JSON.stringify(templateData.entries || [], null, 2));
                }

                setTemplateDialog(true);
            }
        } catch {
            showAlert("alert-container", "خطأ في تحميل القالب", "error");
        }
    };

    const saveTemplate = async () => {
        if (!templateName || !nextDueDate) {
            showAlert("alert-container", "يرجى ملء جميع الحقول المطلوبة", "error");
            return;
        }

        let templateData: any = {};
        if (templateType === "expense") {
            if (!expenseAccount || !expenseAmount) {
                showAlert("alert-container", "يرجى ملء حساب المصروف والمبلغ", "error");
                return;
            }
            templateData = {
                account_code: expenseAccount,
                amount: parseNumber(expenseAmount),
                description: expenseDescription,
            };
        } else if (templateType === "revenue") {
            if (!revenueAccount || !revenueAmount) {
                showAlert("alert-container", "يرجى ملء حساب الإيراد والمبلغ", "error");
                return;
            }
            templateData = {
                account_code: revenueAccount,
                amount: parseNumber(revenueAmount),
                description: revenueDescription,
            };
        } else if (templateType === "journal_voucher") {
            if (!journalEntries) {
                showAlert("alert-container", "يرجى إدخال القيود", "error");
                return;
            }
            try {
                templateData = { entries: JSON.parse(journalEntries) };
            } catch {
                showAlert("alert-container", "صيغة JSON غير صحيحة", "error");
                return;
            }
        }

        try {
            const body: any = {
                name: templateName,
                type: templateType,
                frequency: templateFrequency,
                next_due_date: nextDueDate,
                template_data: templateData,
            };
            if (currentTemplateId) body.id = currentTemplateId;

            const response = await fetchAPI("recurring_transactions", {
                method: currentTemplateId ? "PUT" : "POST",
                body: JSON.stringify(body),
            });

            if (response.success) {
                showAlert("alert-container", "تم الحفظ بنجاح", "success");
                setTemplateDialog(false);
                await loadTemplates(currentPage);
            } else {
                showAlert("alert-container", response.message || "فشل الحفظ", "error");
            }
        } catch {
            showAlert("alert-container", "خطأ في الحفظ", "error");
        }
    };

    const confirmDeleteTemplate = (id: number) => {
        setDeleteTemplateId(id);
        setConfirmDialog(true);
    };

    const deleteTemplate = async () => {
        if (!deleteTemplateId) return;

        try {
            const response = await fetchAPI(`recurring_transactions?id=${deleteTemplateId}`, {
                method: "DELETE",
            });
            if (response.success) {
                showAlert("alert-container", "تم حذف القالب بنجاح", "success");
                setConfirmDialog(false);
                setDeleteTemplateId(null);
                await loadTemplates(currentPage);
            } else {
                showAlert("alert-container", response.message || "فشل حذف القالب", "error");
            }
        } catch {
            showAlert("alert-container", "خطأ في حذف القالب", "error");
        }
    };

    const confirmGenerateTransaction = (id: number) => {
        setGenerateTemplateId(id);
        setConfirmDialog(true);
    };

    const generateTransaction = async () => {
        if (!generateTemplateId) return;

        try {
            const response = await fetchAPI("recurring_transactions?action=process", {
                method: "POST",
                body: JSON.stringify({
                    template_id: generateTemplateId,
                    generation_date: new Date().toISOString().split("T")[0],
                }),
            });

            if (response.success && response.data) {
                
                showAlert(
                    "alert-container",
                    `تم تنفيذ المعاملة بنجاح. رقم السند: `,//${response.data.voucher_number as Number || ""}
                    "success"
                );
                setConfirmDialog(false);
                setGenerateTemplateId(null);
                await loadTemplates(currentPage);
            } else {
                showAlert("alert-container", response.message || "فشل تنفيذ المعاملة", "error");
            }
        } catch {
            showAlert("alert-container", "خطأ في تنفيذ المعاملة", "error");
        }
    };

    const getTypeText = (type: string) => {
        const types: Record<string, string> = {
            expense: "مصروف",
            revenue: "إيراد",
            journal_voucher: "سند قيد",
        };
        return types[type] || type;
    };

    const getFrequencyText = (frequency: string) => {
        const frequencies: Record<string, string> = {
            daily: "يومي",
            weekly: "أسبوعي",
            monthly: "شهري",
            quarterly: "ربع سنوي",
            annually: "سنوي",
        };
        return frequencies[frequency] || frequency;
    };

    const getStatusBadge = (template: RecurringTemplate) => {
        const isDue =
            template.next_due_date && new Date(template.next_due_date) <= new Date();
        return (
            <span className={`badge ${isDue ? "badge-warning" : "badge-success"}`}>
                {isDue ? "مستحق" : "نشط"}
            </span>
        );
    };

    const handleConfirm = () => {
        if (deleteTemplateId) {
            deleteTemplate();
        } else if (generateTemplateId) {
            generateTransaction();
        }
    };

    const columns: Column<RecurringTemplate>[] = [
        {
            key: "name",
            header: "الاسم",
            dataLabel: "الاسم",
            render: (item) => <strong>{item.name}</strong>,
        },
        {
            key: "type",
            header: "النوع",
            dataLabel: "النوع",
            render: (item) => getTypeText(item.type),
        },
        {
            key: "frequency",
            header: "التكرار",
            dataLabel: "التكرار",
            render: (item) => getFrequencyText(item.frequency),
        },
        {
            key: "next_due_date",
            header: "تاريخ الاستحقاق القادم",
            dataLabel: "تاريخ الاستحقاق القادم",
            render: (item) => (item.next_due_date ? formatDate(item.next_due_date) : "-"),
        },
        {
            key: "last_generated_date",
            header: "آخر تنفيذ",
            dataLabel: "آخر تنفيذ",
            render: (item) =>
                item.last_generated_date ? formatDate(item.last_generated_date) : "لم ينفذ",
        },
        {
            key: "status",
            header: "الحالة",
            dataLabel: "الحالة",
            render: (item) => getStatusBadge(item),
        },
        {
            key: "actions",
            header: "الإجراءات",
            dataLabel: "الإجراءات",
            render: (item) => (
                <div className="action-buttons">
                    <button className="icon-btn view" onClick={() => viewTemplate(item.id)} title="عرض">
                        {getIcon("eye")}
                    </button>
                    <button className="icon-btn edit" onClick={() => editTemplate(item.id)} title="تعديل">
                        {getIcon("edit")}
                    </button>
                    <button
                        className="icon-btn delete"
                        onClick={() => confirmDeleteTemplate(item.id)}
                        title="حذف"
                    >
                        {getIcon("trash")}
                    </button>
                    <button
                        className="icon-btn"
                        onClick={() => confirmGenerateTransaction(item.id)}
                        title="تنفيذ الآن"
                        style={{ background: "var(--success-color)", color: "white" }}
                    >
                        {getIcon("check")}
                    </button>
                </div>
            ),
        },
    ];

    return (
        <MainLayout requiredModule="recurring_transactions">
            <PageHeader
                title="المعاملات المتكررة"
                user={user}
                actions={
                    <button className="btn btn-primary" onClick={openCreateDialog}>
                        {getIcon("plus")}
                        قالب جديد
                    </button>
                }
            />

            <div id="alert-container"></div>

            <div className="sales-card animate-fade">
                <Table
                    columns={columns}
                    data={templates}
                    keyExtractor={(item) => item.id}
                    emptyMessage="لا توجد قوالب"
                    isLoading={isLoading}
                    pagination={{
                        currentPage,
                        totalPages,
                        onPageChange: loadTemplates,
                    }}
                />
            </div>

            {/* Template Dialog */}
            <Dialog
                isOpen={templateDialog}
                onClose={() => setTemplateDialog(false)}
                title={currentTemplateId ? "تعديل القالب" : "قالب معاملة متكررة جديد"}
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setTemplateDialog(false)}>
                            إلغاء
                        </button>
                        <button className="btn btn-primary" onClick={saveTemplate}>
                            حفظ
                        </button>
                    </>
                }
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        saveTemplate();
                    }}
                >
                    <div className="form-group">
                        <label htmlFor="template-name">اسم القالب *</label>
                        <input
                            type="text"
                            id="template-name"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="template-type">نوع المعاملة *</label>
                            <select
                                id="template-type"
                                value={templateType}
                                onChange={(e) =>
                                    setTemplateType(e.target.value as typeof templateType)
                                }
                                required
                            >
                                <option value="expense">مصروف</option>
                                <option value="revenue">إيراد</option>
                                <option value="journal_voucher">سند قيد</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="template-frequency">التكرار *</label>
                            <select
                                id="template-frequency"
                                value={templateFrequency}
                                onChange={(e) =>
                                    setTemplateFrequency(e.target.value as typeof templateFrequency)
                                }
                                required
                            >
                                <option value="daily">يومي</option>
                                <option value="weekly">أسبوعي</option>
                                <option value="monthly">شهري</option>
                                <option value="quarterly">ربع سنوي</option>
                                <option value="annually">سنوي</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="next-due-date">تاريخ الاستحقاق القادم *</label>
                        <input
                            type="date"
                            id="next-due-date"
                            value={nextDueDate}
                            onChange={(e) => setNextDueDate(e.target.value)}
                            required
                        />
                    </div>

                    {/* Expense Fields */}
                    {templateType === "expense" && (
                        <div>
                            <div className="form-group">
                                <label htmlFor="expense-account">حساب المصروف *</label>
                                <input
                                    type="text"
                                    id="expense-account"
                                    value={expenseAccount}
                                    onChange={(e) => setExpenseAccount(e.target.value)}
                                    placeholder="رمز الحساب"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="expense-amount">المبلغ *</label>
                                <input
                                    type="number"
                                    id="expense-amount"
                                    value={expenseAmount}
                                    onChange={(e) => setExpenseAmount(e.target.value)}
                                    step="0.01"
                                    min="0"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="expense-description">الوصف</label>
                                <textarea
                                    id="expense-description"
                                    value={expenseDescription}
                                    onChange={(e) => setExpenseDescription(e.target.value)}
                                    rows={2}
                                />
                            </div>
                        </div>
                    )}

                    {/* Revenue Fields */}
                    {templateType === "revenue" && (
                        <div>
                            <div className="form-group">
                                <label htmlFor="revenue-account">حساب الإيراد *</label>
                                <input
                                    type="text"
                                    id="revenue-account"
                                    value={revenueAccount}
                                    onChange={(e) => setRevenueAccount(e.target.value)}
                                    placeholder="رمز الحساب"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="revenue-amount">المبلغ *</label>
                                <input
                                    type="number"
                                    id="revenue-amount"
                                    value={revenueAmount}
                                    onChange={(e) => setRevenueAmount(e.target.value)}
                                    step="0.01"
                                    min="0"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="revenue-description">الوصف</label>
                                <textarea
                                    id="revenue-description"
                                    value={revenueDescription}
                                    onChange={(e) => setRevenueDescription(e.target.value)}
                                    rows={2}
                                />
                            </div>
                        </div>
                    )}

                    {/* Journal Fields */}
                    {templateType === "journal_voucher" && (
                        <div>
                            <div className="form-group">
                                <label htmlFor="journal-entries">القيود (JSON) *</label>
                                <textarea
                                    id="journal-entries"
                                    value={journalEntries}
                                    onChange={(e) => setJournalEntries(e.target.value)}
                                    rows={6}
                                    placeholder='[{"account_code":"1110","entry_type":"DEBIT","amount":1000,"description":"..."},{"account_code":"5200","entry_type":"CREDIT","amount":1000,"description":"..."}]'
                                    required
                                />
                                <small style={{ color: "var(--text-secondary)" }}>
                                    يجب أن يكون إجمالي المدين = إجمالي الدائن
                                </small>
                            </div>
                        </div>
                    )}
                </form>
            </Dialog>

            {/* Confirm Dialog */}
            <ConfirmDialog
                isOpen={confirmDialog}
                onClose={() => {
                    setConfirmDialog(false);
                    setDeleteTemplateId(null);
                    setGenerateTemplateId(null);
                }}
                onConfirm={handleConfirm}
                title="تأكيد"
                message={
                    deleteTemplateId
                        ? "هل أنت متأكد من حذف هذا القالب؟"
                        : "هل تريد تنفيذ هذه المعاملة الآن؟"
                }
                confirmText="تأكيد"
                confirmVariant={deleteTemplateId ? "danger" : "primary"}
            />
        </MainLayout>
    );
}

