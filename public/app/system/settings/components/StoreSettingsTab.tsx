
import { useState, useEffect, useCallback } from "react";
import { fetchAPI } from "@/lib/api";
import { showToast } from "@/components/ui";
import { StoreSettings } from "../types";

export function StoreSettingsTab() {
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    store_name: "",
    store_address: "",
    store_phone: "",
    store_email: "",
    tax_number: "",
    cr_number: "",
  });

  const loadStoreSettings = useCallback(async () => {
    try {
      const response = await fetchAPI("/api/settings/store");
      if (response.settings) {
        setStoreSettings(response.settings as StoreSettings);
      }
    } catch {
      console.error("Error loading store settings");
    }
  }, []);

  useEffect(() => {
    loadStoreSettings();
  }, [loadStoreSettings]);

  const saveStoreSettings = async () => {
    try {
      await fetchAPI("/api/settings/store", {
        method: "PUT",
        body: JSON.stringify(storeSettings),
      });
      showToast("تم حفظ إعدادات المتجر", "success");
    } catch {
      showToast("خطأ في حفظ الإعدادات", "error");
    }
  };

  return (
    <div className="sales-card">
      <h3>معلومات المتجر</h3>
      <div className="settings-form-grid">
        <div className="form-group">
          <label htmlFor="store_name">اسم المتجر</label>
          <input
            type="text"
            id="store_name"
            value={storeSettings.store_name}
            onChange={(e) => setStoreSettings({ ...storeSettings, store_name: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label htmlFor="store_phone">رقم الهاتف</label>
          <input
            type="tel"
            id="store_phone"
            value={storeSettings.store_phone}
            onChange={(e) => setStoreSettings({ ...storeSettings, store_phone: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label htmlFor="store_email">البريد الإلكتروني</label>
          <input
            type="email"
            id="store_email"
            value={storeSettings.store_email}
            onChange={(e) => setStoreSettings({ ...storeSettings, store_email: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label htmlFor="tax_number">الرقم الضريبي</label>
          <input
            type="text"
            id="tax_number"
            value={storeSettings.tax_number}
            onChange={(e) => setStoreSettings({ ...storeSettings, tax_number: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label htmlFor="cr_number">السجل التجاري</label>
          <input
            type="text"
            id="cr_number"
            value={storeSettings.cr_number}
            onChange={(e) => setStoreSettings({ ...storeSettings, cr_number: e.target.value })}
          />
        </div>
        <div className="form-group full-width">
          <label htmlFor="store_address">العنوان</label>
          <textarea
            id="store_address"
            value={storeSettings.store_address}
            onChange={(e) => setStoreSettings({ ...storeSettings, store_address: e.target.value })}
            rows={2}
          />
        </div>
      </div>
      <button className="btn btn-primary" onClick={saveStoreSettings}>
        حفظ التغييرات
      </button>
    </div>
  );
}
