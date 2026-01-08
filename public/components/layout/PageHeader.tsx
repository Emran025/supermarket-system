"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentDate, getRoleBadgeText, getRoleBadgeClass } from "@/lib/utils";
import { User, getStoredPermissions, canAccess } from "@/lib/auth";
import { getIcon } from "@/lib/icons";

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
  const [canShowSettings, setCanShowSettings] = useState(false);

  useEffect(() => {
    if (user) {
        const perms = getStoredPermissions();
        if (
            canAccess(perms, "settings") || 
            canAccess(perms, "roles_permissions") || // mapped to 'users' or 'settings' usually, but custom check here
            canAccess(perms, "audit_trail")
        ) {
            setCanShowSettings(true);
        }
    }
  }, [user]);

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

        {/* Global Settings Button */}
        {canShowSettings && (
          <Link 
            href="/system/settings" 
            className="icon-btn view" 
            title="إعدادات النظام"
            style={{
              marginLeft: "10px",
              padding: "10px",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--primary-color)",
              backgroundColor: "var(--primary-subtle)",
              border: "1px solid var(--border-color)",
              transition: "all 0.2s ease",
              width: "40px",
              height: "40px"
            }}
          >
            {getIcon("settings")}
          </Link>
        )}

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

