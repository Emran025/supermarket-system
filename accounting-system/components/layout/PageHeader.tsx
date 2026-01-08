"use client";

import { ReactNode } from "react";
import { getCurrentDate, getRoleBadgeText, getRoleBadgeClass } from "@/lib/utils";
import { User } from "@/lib/auth";

interface PageHeaderProps {
  title: string;
  user?: User | null;
  showDate?: boolean;
  actions?: ReactNode;
  searchInput?: ReactNode;
}

export function PageHeader({
  title,
  user,
  showDate = true,
  actions,
  searchInput,
}: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {showDate && (
          <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            {getCurrentDate()}
          </span>
        )}
      </div>

      <div className="header-actions">
        {searchInput}
        
        {actions}

        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontWeight: 600 }}>{user.full_name}</span>
            <span className={`badge ${getRoleBadgeClass(user.role)}`}>
              {getRoleBadgeText(user.role)}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

