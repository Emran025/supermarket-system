
import { useState } from "react";
import { fetchAPI } from "@/lib/api";
import { showToast } from "@/components/ui";

export function SecurityTab() {
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const changePassword = async () => {
    if (!passwordData.current_password || !passwordData.new_password) {
      showToast("يرجى ملء جميع الحقول", "error");
      return;
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      showToast("كلمة المرور الجديدة غير متطابقة", "error");
      return;
    }

    if (passwordData.new_password.length < 6) {
      showToast("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "error");
      return;
    }

    try {
      await fetchAPI("/api/users/change-password", {
        method: "POST",
        body: JSON.stringify({
          current_password: passwordData.current_password,
          new_password: passwordData.new_password,
        }),
      });
      showToast("تم تغيير كلمة المرور بنجاح", "success");
      setPasswordData({ current_password: "", new_password: "", confirm_password: "" });
    } catch {
      showToast("خطأ في تغيير كلمة المرور", "error");
    }
  };

  return (
    <div className="sales-card">
      <h3>تغيير كلمة المرور</h3>
      <div className="settings-form-narrow">
        <div className="form-group">
          <label htmlFor="current_password">كلمة المرور الحالية</label>
          <input
            type="password"
            id="current_password"
            value={passwordData.current_password}
            onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label htmlFor="new_password">كلمة المرور الجديدة</label>
          <input
            type="password"
            id="new_password"
            value={passwordData.new_password}
            onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label htmlFor="confirm_password">تأكيد كلمة المرور</label>
          <input
            type="password"
            id="confirm_password"
            value={passwordData.confirm_password}
            onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
          />
        </div>
        <button className="btn btn-primary" onClick={changePassword}>
          تغيير كلمة المرور
        </button>
      </div>
    </div>
  );
}
