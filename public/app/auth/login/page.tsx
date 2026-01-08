"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { login } from "@/lib/auth";
import { Alert } from "@/components/ui";
import { getIcon } from "@/lib/icons";

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!username.trim() || !password.trim()) {
            setError("يرجى إدخال اسم المستخدم وكلمة المرور");
            return;
        }

        setIsLoading(true);

        try {
            const result = await login(username, password);

            if (result.success) {
                router.push("/system/dashboard");
            } else {
                setError(result.error || "فشل تسجيل الدخول");
            }
        } catch {
            setError("حدث خطأ في الاتصال بالخادم");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card animate-slide-up">
                <Image
                    src="/logo.svg"
                    alt="Logo"
                    width={80}
                    height={80}
                    style={{ margin: "0 auto 1.5rem", display: "block" }}
                    priority
                />

                <h1>تسجيل الدخول إلى النظام</h1>

                {error && <Alert type="error" message={error} />}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="username">اسم المستخدم</label>
                        <div className="user-name-container">
                            <input
                                type="text"
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="أدخل اسم المستخدم"
                                autoComplete="username"
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                className="user-name-toggle"
                            >
                                {getIcon("user")}
                            </button>
                        </div>
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">كلمة المرور</label>
                        <div className="password-container">
                            <input
                                type={showPassword ? "text" : "password"}
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="أدخل كلمة المرور"
                                autoComplete="current-password"
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                            >
                                {showPassword ? getIcon("unlock") : getIcon("lock")}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: "100%", marginTop: "1rem" }}
                        disabled={isLoading}
                    >
                        {isLoading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
                    </button>
                </form>
            </div>
        </div>
    );
}

