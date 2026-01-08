"use client";

import { useState } from "react";

export interface Tab {
  key: string;
  label: string;
  icon: string;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabKey: string) => void;
  className?: string;
}

// Mobile Tab Dropdown Component
function MobileTabDropdown({ 
  tabs,
  activeTab, 
  onTabChange 
}: { 
  tabs: Tab[];
  activeTab: string; 
  onTabChange: (tab: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (tabKey: string) => {
    onTabChange(tabKey);
    setIsOpen(false);
  };

  const currentTab = tabs.find(t => t.key === activeTab) || tabs[0];

  return (
    <div className="mobile-tab-container">
      <div className={`custom-dropdown ${isOpen ? "active" : ""}`}>
        <button
          className="dropdown-trigger"
          type="button"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>{currentTab?.label || tabs[0]?.label}</span>
          <i className={`fas fa-chevron-down trigger-icon`}></i>
        </button>
        <div className="dropdown-menu">
          {tabs.map((tab) => (
            <div
              key={tab.key}
              className={`dropdown-item ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => handleSelect(tab.key)}
            >
              <i className={`fas ${tab.icon}`}></i> {tab.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TabNavigation({ tabs, activeTab, onTabChange, className = "" }: TabNavigationProps) {
  return (
    <div className={`settings-tabs ${className}`}>
      {/* Mobile Dropdown */}
      <MobileTabDropdown 
        tabs={tabs}
        activeTab={activeTab} 
        onTabChange={onTabChange}
      />

      {/* Desktop Tabs */}
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`tab-btn ${activeTab === tab.key ? "active" : ""}`}
          onClick={() => onTabChange(tab.key)}
        >
          <i className={`fas ${tab.icon}`}></i>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
