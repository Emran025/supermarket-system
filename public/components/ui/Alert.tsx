"use client";

import { getIcon } from "@/lib/icons";
import { showToast } from "./Toast";

export type AlertType = "success" | "error" | "warning" | "info";

interface AlertProps {
  type: AlertType;
  message: string;
  onClose?: () => void;
}

export function Alert({ type, message, onClose }: AlertProps) {
  const iconName = type === "success" ? "check" : type === "error" ? "x" : "alert";
  
  return (
    <div className={`alert alert-${type}`}>
      {getIcon(iconName)}
      <span>{message}</span>
      {onClose && (
        <button 
          onClick={onClose} 
          className="close-btn"
          style={{ position: "relative", left: "auto", marginRight: "auto" }}
        >
          ×
        </button>
      )}
    </div>
  );
}

/**
 * Show alert in a container (matches original showAlert behavior)
 * Falls back to toast if container not found
 */
export function showAlert(containerId: string, message: string, type: AlertType = "success"): void {
  if (typeof document === "undefined") {
    showToast(message, type);
    return;
  }

  const container = document.getElementById(containerId);
  if (!container) {
    showToast(message, type);
    return;
  }

  const alertDiv = document.createElement("div");
  alertDiv.className = `alert alert-${type} animate-fade`;
  alertDiv.style.margin = "1rem 0";
  alertDiv.style.padding = "1rem";
  alertDiv.style.borderRadius = "var(--radius-md)";
  alertDiv.style.backgroundColor = type === "error" ? "#fee2e2" : type === "warning" ? "#fef3c7" : "#dcfce7";
  alertDiv.style.color = type === "error" ? "#991b1b" : type === "warning" ? "#92400e" : "#166534";
  alertDiv.style.border = `1px solid ${
    type === "error" ? "#fecaca" : type === "warning" ? "#fde68a" : "#bbf7d0"
  }`;
  alertDiv.textContent = message;

  container.innerHTML = "";
  container.appendChild(alertDiv);

  if (type !== "error") {
    setTimeout(() => {
      alertDiv.style.opacity = "0";
      alertDiv.style.transition = "opacity 0.5s ease";
      setTimeout(() => alertDiv.remove(), 500);
    }, 5000);
  }
}

