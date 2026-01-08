
import { useState, useCallback, useEffect } from "react";
import { fetchAPI } from "@/lib/api";
import { showToast, Table, Column } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { Session } from "../types";

export function SessionsTab() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [sessionsTotalPages, setSessionsTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const loadSessions = useCallback(async (page: number = 1) => {
    setIsLoading(true);
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
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const terminateSession = async (sessionId: number) => {
    try {
      await fetchAPI(`/api/sessions/${sessionId}`, { method: "DELETE" });
      showToast("تم إنهاء الجلسة", "success");
      loadSessions(sessionsPage);
    } catch {
      showToast("خطأ في إنهاء الجلسة", "error");
    }
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
  );
}
