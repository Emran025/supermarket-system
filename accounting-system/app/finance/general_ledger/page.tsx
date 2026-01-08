"use client";

import { useState, useEffect, useCallback } from "react";
import { MainLayout, PageHeader } from "@/components/layout";
import { Table, showToast, Column } from "@/components/ui";
import { fetchAPI } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { User, getStoredUser } from "@/lib/auth";
import { getIcon } from "@/lib/icons";

interface JournalEntry {
  id: number;
  entry_number: string;
  entry_date: string;
  description: string;
  debit_account: string;
  credit_account: string;
  amount: number;
  reference?: string;
  created_at: string;
}

interface TrialBalanceItem {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  balance: number;
}

interface AccountHistoryItem {
  id: number;
  entry_date: string;
  description: string;
  debit: number;
  credit: number;
  running_balance: number;
}

interface Account {
  id: number;
  code: string;
  name: string;
}

export default function GeneralLedgerPage() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"journal" | "trial" | "history">("journal");
  const [isLoading, setIsLoading] = useState(true);

  // Journal Entries
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalPage, setJournalPage] = useState(1);
  const [journalTotalPages, setJournalTotalPages] = useState(1);
  const [journalDateFrom, setJournalDateFrom] = useState("");
  const [journalDateTo, setJournalDateTo] = useState("");

  // Trial Balance
  const [trialBalance, setTrialBalance] = useState<TrialBalanceItem[]>([]);
  const [trialTotals, setTrialTotals] = useState({ debit: 0, credit: 0, balance: 0 });

  // Account History
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [accountHistory, setAccountHistory] = useState<AccountHistoryItem[]>([]);
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");

  const itemsPerPage = 15;

  const loadJournalEntries = useCallback(async (page: number = 1) => {
    try {
      setIsLoading(true);
      let url = `/api/journal-entries?page=${page}&limit=${itemsPerPage}`;
      if (journalDateFrom) url += `&date_from=${journalDateFrom}`;
      if (journalDateTo) url += `&date_to=${journalDateTo}`;
      
      const response = await fetchAPI(url);
      setJournalEntries(response.entries as JournalEntry[] || []);
      setJournalTotalPages(Math.ceil((response.total as number || 0) / itemsPerPage));
      setJournalPage(page);
    } catch {
      showToast("خطأ في تحميل القيود", "error");
    } finally {
      setIsLoading(false);
    }
  }, [journalDateFrom, journalDateTo]);

  const loadTrialBalance = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetchAPI("/api/trial-balance");
      setTrialBalance(response.items as TrialBalanceItem[] || []);
      setTrialTotals({
        debit: response.total_debit as number || 0,
        credit: response.total_credit as number || 0,
        balance: response.balance as number || 0,
      });
    } catch {
      showToast("خطأ في تحميل ميزان المراجعة", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      const response = await fetchAPI("/api/accounts");
      setAccounts(response.accounts as Account[] || []);
    } catch {
      console.error("Error loading accounts");
    }
  }, []);

  const loadAccountHistory = useCallback(async () => {
    if (!selectedAccountId) return;
    
    try {
      setIsLoading(true);
      let url = `/api/accounts/${selectedAccountId}/history`;
      const params = [];
      if (historyDateFrom) params.push(`date_from=${historyDateFrom}`);
      if (historyDateTo) params.push(`date_to=${historyDateTo}`);
      if (params.length) url += `?${params.join("&")}`;
      
      const response = await fetchAPI(url);
      setAccountHistory(response.history as AccountHistoryItem[] || []);
    } catch {
      showToast("خطأ في تحميل سجل الحساب", "error");
    } finally {
      setIsLoading(false);
    }
  }, [selectedAccountId, historyDateFrom, historyDateTo]);

  useEffect(() => {
    const storedUser = getStoredUser();
    setUser(storedUser);
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (activeTab === "journal") {
      loadJournalEntries();
    } else if (activeTab === "trial") {
      loadTrialBalance();
    } else if (activeTab === "history" && selectedAccountId) {
      loadAccountHistory();
    }
  }, [activeTab, loadJournalEntries, loadTrialBalance, loadAccountHistory, selectedAccountId]);

  const handleExport = () => {
    showToast("جاري تصدير البيانات...", "info");
    // Export logic would go here
  };

  const handleRefresh = () => {
    if (activeTab === "journal") {
      loadJournalEntries(journalPage);
    } else if (activeTab === "trial") {
      loadTrialBalance();
    } else if (activeTab === "history") {
      loadAccountHistory();
    }
  };

  const journalColumns: Column<JournalEntry>[] = [
    { key: "entry_number", header: "رقم القيد", dataLabel: "رقم القيد" },
    {
      key: "entry_date",
      header: "التاريخ",
      dataLabel: "التاريخ",
      render: (item) => formatDate(item.entry_date),
    },
    { key: "description", header: "البيان", dataLabel: "البيان" },
    { key: "debit_account", header: "الحساب المدين", dataLabel: "الحساب المدين" },
    { key: "credit_account", header: "الحساب الدائن", dataLabel: "الحساب الدائن" },
    {
      key: "amount",
      header: "المبلغ",
      dataLabel: "المبلغ",
      render: (item) => formatCurrency(item.amount),
    },
    { key: "reference", header: "المرجع", dataLabel: "المرجع" },
  ];

  const trialColumns: Column<TrialBalanceItem>[] = [
    { key: "account_code", header: "رقم الحساب", dataLabel: "رقم الحساب" },
    { key: "account_name", header: "اسم الحساب", dataLabel: "اسم الحساب" },
    {
      key: "debit",
      header: "مدين",
      dataLabel: "مدين",
      render: (item) => (item.debit > 0 ? formatCurrency(item.debit) : "-"),
    },
    {
      key: "credit",
      header: "دائن",
      dataLabel: "دائن",
      render: (item) => (item.credit > 0 ? formatCurrency(item.credit) : "-"),
    },
    {
      key: "balance",
      header: "الرصيد",
      dataLabel: "الرصيد",
      render: (item) => (
        <span className={item.balance >= 0 ? "text-success" : "text-danger"}>
          {formatCurrency(Math.abs(item.balance))} {item.balance >= 0 ? "مدين" : "دائن"}
        </span>
      ),
    },
  ];

  const historyColumns: Column<AccountHistoryItem>[] = [
    {
      key: "entry_date",
      header: "التاريخ",
      dataLabel: "التاريخ",
      render: (item) => formatDate(item.entry_date),
    },
    { key: "description", header: "البيان", dataLabel: "البيان" },
    {
      key: "debit",
      header: "مدين",
      dataLabel: "مدين",
      render: (item) => (item.debit > 0 ? formatCurrency(item.debit) : "-"),
    },
    {
      key: "credit",
      header: "دائن",
      dataLabel: "دائن",
      render: (item) => (item.credit > 0 ? formatCurrency(item.credit) : "-"),
    },
    {
      key: "running_balance",
      header: "الرصيد",
      dataLabel: "الرصيد",
      render: (item) => (
        <span className={item.running_balance >= 0 ? "text-success" : "text-danger"}>
          {formatCurrency(Math.abs(item.running_balance))}
        </span>
      ),
    },
  ];

  return (
    <MainLayout requiredModule="general_ledger">
      <PageHeader
        title="دفتر الأستاذ العام"
        user={user}
        actions={
          <>
            <button className="btn btn-secondary" onClick={handleExport}>
              {getIcon("download")}
              تصدير
            </button>
            <button className="btn btn-secondary" onClick={handleRefresh}>
              <i className="fas fa-sync-alt"></i>
              تحديث
            </button>
          </>
        }
      />

      <div className="settings-wrapper animate-fade">
        {/* Tabs */}
        <div className="settings-tabs">
          <button
            className={`tab-btn ${activeTab === "journal" ? "active" : ""}`}
            onClick={() => setActiveTab("journal")}
          >
            <i className="fas fa-book"></i>
            القيود اليومية
          </button>
          <button
            className={`tab-btn ${activeTab === "trial" ? "active" : ""}`}
            onClick={() => setActiveTab("trial")}
          >
            <i className="fas fa-balance-scale"></i>
            ميزان المراجعة
          </button>
          <button
            className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            <i className="fas fa-history"></i>
            سجل الحساب
          </button>
        </div>

        {/* Journal Entries Tab */}
        <div className={`tab-content ${activeTab === "journal" ? "active" : ""}`}>
          <div className="sales-card">
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>من تاريخ</label>
                <input
                  type="date"
                  value={journalDateFrom}
                  onChange={(e) => setJournalDateFrom(e.target.value)}
                  style={{ width: "150px" }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>إلى تاريخ</label>
                <input
                  type="date"
                  value={journalDateTo}
                  onChange={(e) => setJournalDateTo(e.target.value)}
                  style={{ width: "150px" }}
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={() => loadJournalEntries(1)}
                style={{ alignSelf: "flex-end" }}
              >
                بحث
              </button>
            </div>

            <Table
              columns={journalColumns}
              data={journalEntries}
              keyExtractor={(item) => item.id}
              emptyMessage="لا توجد قيود"
              isLoading={isLoading}
              pagination={{
                currentPage: journalPage,
                totalPages: journalTotalPages,
                onPageChange: loadJournalEntries,
              }}
            />
          </div>
        </div>

        {/* Trial Balance Tab */}
        <div className={`tab-content ${activeTab === "trial" ? "active" : ""}`}>
          <div className="sales-card">
            <Table
              columns={trialColumns}
              data={trialBalance}
              keyExtractor={(item) => item.account_code}
              emptyMessage="لا توجد بيانات"
              isLoading={isLoading}
            />

            {trialBalance.length > 0 && (
              <div className="summary-stat-box" style={{ marginTop: "1.5rem" }}>
                <div className="stat-item">
                  <span className="stat-label">إجمالي المدين</span>
                  <span className="stat-value">{formatCurrency(trialTotals.debit)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">إجمالي الدائن</span>
                  <span className="stat-value">{formatCurrency(trialTotals.credit)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">الفرق</span>
                  <span className={`stat-value ${trialTotals.balance === 0 ? "text-success" : "text-danger"}`}>
                    {formatCurrency(trialTotals.balance)}
                    {trialTotals.balance === 0 && " ✓"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Account History Tab */}
        <div className={`tab-content ${activeTab === "history" ? "active" : ""}`}>
          <div className="sales-card">
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
              <div className="form-group" style={{ marginBottom: 0, minWidth: "200px" }}>
                <label>الحساب</label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                >
                  <option value="">اختر حساب</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} - {acc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>من تاريخ</label>
                <input
                  type="date"
                  value={historyDateFrom}
                  onChange={(e) => setHistoryDateFrom(e.target.value)}
                  style={{ width: "150px" }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>إلى تاريخ</label>
                <input
                  type="date"
                  value={historyDateTo}
                  onChange={(e) => setHistoryDateTo(e.target.value)}
                  style={{ width: "150px" }}
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={loadAccountHistory}
                style={{ alignSelf: "flex-end" }}
                disabled={!selectedAccountId}
              >
                عرض
              </button>
            </div>

            {selectedAccountId ? (
              <Table
                columns={historyColumns}
                data={accountHistory}
                keyExtractor={(item) => item.id}
                emptyMessage="لا توجد حركات"
                isLoading={isLoading}
              />
            ) : (
              <p style={{ textAlign: "center", color: "var(--text-secondary)", padding: "2rem" }}>
                اختر حساب لعرض سجل الحركات
              </p>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

