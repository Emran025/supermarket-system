"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { MainLayout, PageHeader } from "@/components/layout";
import { Table, Dialog, ConfirmDialog, showToast, Column } from "@/components/ui";
import { fetchAPI } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, parseNumber } from "@/lib/utils";
import { User, getStoredUser, checkAuth } from "@/lib/auth";
import { Icon } from "@/lib/icons";

interface LedgerTransaction {
  id: number;
  transaction_date: string;
  type: "invoice" | "payment" | "return";
  description?: string;
  amount: number;
  running_balance?: number;
  days_outstanding?: number;
  created_by_name?: string;
  reference_type?: string;
  reference_id?: number;
}

interface Supplier {
  id: number;
  name: string;
  phone?: string;
  tax_number?: string;
  current_balance: number;
}

interface AgingBuckets {
  current: number;
  days_30_60: number;
  days_60_90: number;
  over_90: number;
  total: number;
}

interface APLedgerResponse {
  supplier: Supplier;
  transactions: LedgerTransaction[];
  aging: AgingBuckets;
}

function APLedgerPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supplierId = searchParams.get("supplier_id");

  const [user, setUser] = useState<User | null>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [aging, setAging] = useState<AgingBuckets>({
    current: 0,
    days_30_60: 0,
    days_60_90: 0,
    over_90: 0,
    total: 0,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Dialogs
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionDescription, setTransactionDescription] = useState("");

  const itemsPerPage = 20;

  useEffect(() => {
    if (!supplierId) {
      router.push("/people/suppliers");
      return;
    }
  }, [supplierId, router]);

  const loadLedger = useCallback(async (page: number = 1) => {
    if (!supplierId) return;

    try {
      setIsLoading(true);
      const limit = itemsPerPage;
      const offset = (page - 1) * limit;
      
      const response = await fetchAPI(
        `ap_ledger?supplier_id=${supplierId}&limit=${limit}&offset=${offset}`
      );
      
      if (response.success && response.data) {
        const data = response.data as APLedgerResponse;
        setSupplier(data.supplier as Supplier);
        setTransactions(data.transactions as LedgerTransaction[] || []);
        setAging(data.aging as AgingBuckets);
        setTotalPages(Math.ceil((response.total as number || 0) / limit));
        setCurrentPage(page);
      }
    } catch {
      showToast("خطأ في تحميل كشف الحساب", "error");
    } finally {
      setIsLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    const init = async () => {
      const authenticated = await checkAuth();
      if (!authenticated) return;
      setUser(getStoredUser());
      loadLedger();
    };
    init();
  }, [loadLedger]);

  const handlePayment = async () => {
    if (!transactionAmount || parseNumber(transactionAmount) <= 0) {
      showToast("يرجى إدخال مبلغ صحيح", "error");
      return;
    }

    try {
      const response = await fetchAPI("ap_payments", {
        method: "POST",
        body: JSON.stringify({
          supplier_id: supplierId,
          amount: parseNumber(transactionAmount),
          description: transactionDescription,
        }),
      });

      if (response.success) {
        showToast("تم تسجيل الدفعة بنجاح", "success");
        setPaymentDialog(false);
        setTransactionAmount("");
        setTransactionDescription("");
        loadLedger(1);
      } else {
        showToast(response.message || "خطأ في تسجيل الدفعة", "error");
      }
    } catch {
      showToast("خطأ في الاتصال بالخادم", "error");
    }
  };

  const columns: Column<LedgerTransaction>[] = [
    {
      key: "transaction_date",
      header: "التاريخ",
      dataLabel: "التاريخ",
      render: (item) => formatDateTime(item.transaction_date),
    },
    {
      key: "type",
      header: "نوع العملية",
      dataLabel: "النوع",
      render: (item) => (
        <span className={`badge ${item.type === 'invoice' ? 'badge-danger' : 'badge-success'}`}>
          {item.type === 'invoice' ? 'فاتورة مشتريات' : item.type === 'payment' ? 'سند صرف' : 'مرتجع'}
        </span>
      ),
    },
    { key: "description", header: "البيان / الوصف", dataLabel: "الوصف" },
    {
      key: "debit",
      header: "مدين (دفعات)",
      dataLabel: "مدين",
      render: (item) => item.type !== 'invoice' ? <span className="text-success">{formatCurrency(item.amount)}</span> : "-",
    },
    {
      key: "credit",
      header: "دائن (التزام)",
      dataLabel: "دائن",
      render: (item) => item.type === 'invoice' ? <span className="text-danger">{formatCurrency(item.amount)}</span> : "-",
    },
    {
      key: "running_balance",
      header: "الرصيد التراكمي",
      dataLabel: "الرصيد",
      render: (item) => formatCurrency(item.running_balance || 0),
    },
  ];

  return (
    <MainLayout requiredModule="fiscal_periods">
      <PageHeader
        title={`دفتر المورد: ${supplier?.name || "..."}`}
        user={user}
        actions={
          <button className="btn btn-primary" onClick={() => setPaymentDialog(true)}>
            <Icon name="plus" />
            صرف دفعة للمورد
          </button>
        }
      />

      {/* Aging & Summary Section */}
      <div className="dashboard-stats animate-fade" style={{ marginBottom: "2rem" }}>
        <div className="stat-card">
          <div className="stat-info">
            <h3>الرصيد المستحق</h3>
            <p className="text-danger" style={{ fontSize: "1.5rem" }}>{formatCurrency(aging.total)}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <h3>مستحق حالي (30 يوم)</h3>
            <p>{formatCurrency(aging.current)}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <h3>متأخر (30-60 يوم)</h3>
            <p className="text-warning">{formatCurrency(aging.days_30_60)}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <h3>متأخر جداً (+90 يوم)</h3>
            <p className="text-danger">{formatCurrency(aging.over_90)}</p>
          </div>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="sales-card animate-fade">
        <Table
          columns={columns}
          data={transactions}
          keyExtractor={(item) => item.id}
          emptyMessage="لا يوجد عمليات مسجلة"
          isLoading={isLoading}
          pagination={{
            currentPage,
            totalPages,
            onPageChange: loadLedger,
          }}
        />
      </div>

      {/* Payment Dialog */}
      <Dialog
        isOpen={paymentDialog}
        onClose={() => setPaymentDialog(false)}
        title="صرف دفعة مالية للمورد"
        footer={
          <div className="flex gap-2 justify-end">
            <button className="btn btn-secondary" onClick={() => setPaymentDialog(false)}>
              إلغاء
            </button>
            <button className="btn btn-primary" onClick={handlePayment}>
              تأكيد الصرف
            </button>
          </div>
        }
      >
        <div className="form-group">
          <label>المبلغ *</label>
          <input
            type="number"
            value={transactionAmount}
            onChange={(e) => setTransactionAmount(e.target.value)}
            placeholder="0.00"
            autoFocus
          />
        </div>
        <div className="form-group">
          <label>الوصف / رقم السند</label>
          <textarea
            value={transactionDescription}
            onChange={(e) => setTransactionDescription(e.target.value)}
            rows={3}
            placeholder="مثلاً: دفعة عن فاتورة رقم 123"
          />
        </div>
        <div style={{ marginTop: "1rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
          * سيتم خصم هذا المبلغ من رصيد المورد وتأثيره على حساب النقدية في دفتر الأستاذ العام.
        </div>
      </Dialog>
    </MainLayout>
  );
}

export default function APLedgerPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <APLedgerPageContent />
    </Suspense>
  );
}
