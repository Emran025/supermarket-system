"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { getIcon } from "@/lib/icons";
import { Permission, getSidebarLinks, logout } from "@/lib/auth";

interface SidebarProps {
  permissions: Permission[];
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({ permissions, onCollapsedChange }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();

  const links = getSidebarLinks(permissions);

  useEffect(() => {
    // Check for saved collapsed state
    const saved = localStorage.getItem("sidebarCollapsed");
    if (saved === "true") {
      setIsCollapsed(true);
      onCollapsedChange?.(true);
    }
  }, [onCollapsedChange]);

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("sidebarCollapsed", String(newState));
    onCollapsedChange?.(newState);
    
    // Update body class for global styling
    if (newState) {
      document.body.classList.add("sidebar-is-collapsed");
    } else {
      document.body.classList.remove("sidebar-is-collapsed");
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const closeMobileSidebar = () => {
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${isMobileOpen ? "active" : ""}`}
        onClick={closeMobileSidebar}
      />

      {/* Toggle button */}
      <button
        className="sidebar-toggle-btn"
        onClick={toggleCollapse}
        aria-label={isCollapsed ? "توسيع القائمة" : "طي القائمة"}
      >
        {getIcon("chevronRight")}
      </button>

      {/* Sidebar */}
      <aside className={`sidebar ${isCollapsed ? "collapsed" : ""} ${isMobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-header">
          <Image
            src="/logo.svg"
            alt="Logo"
            width={50}
            height={50}
            className="logo-img"
            priority
          />
          <h2>نظام السوبرماركت</h2>
        </div>

        <nav className="sidebar-nav">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? "active" : ""}
              onClick={closeMobileSidebar}
            >
              {getIcon(link.icon)}
              <span>{link.label}</span>
            </Link>
          ))}

          <a
            href="#"
            className="logout-btn"
            onClick={(e) => {
              e.preventDefault();
              handleLogout();
            }}
          >
            {getIcon("logout")}
            <span>تسجيل الخروج</span>
          </a>
        </nav>
      </aside>
    </>
  );
}

