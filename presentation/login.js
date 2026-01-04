document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById("login-form");
  const alertContainer = document.getElementById("alert-container");
  const loginBtn = document.getElementById("login-btn");

  function showAlert(message, type) {
    alertContainer.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => {
      alertContainer.innerHTML = "";
    }, 5000);
  }

  // Password Toggle
  const togglePassword = document.getElementById("togglePassword");
  const passwordInput = document.getElementById("password");

  if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", function () {
      const type =
        passwordInput.getAttribute("type") === "password" ? "text" : "password";
      passwordInput.setAttribute("type", type);
      // Toggle Icon
      const icon = this.querySelector("i");
      if (icon) {
        icon.classList.toggle("fa-eye");
        icon.classList.toggle("fa-eye-slash");
      }
    });
  }

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="loading"></span> جاري تسجيل الدخول...';

    try {
      // Try different possible paths
      const apiPath = "../domain/api.php?action=login";
      const response = await fetch(apiPath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("Response error:", text);
        showAlert(
          "Server error: " + response.status + " - " + text.substring(0, 100),
          "error"
        );
        loginBtn.disabled = false;
        loginBtn.innerHTML = "Login";
        return;
      }

      const result = await response.json();

      if (result.success) {
        window.location.href = "products.html";
      } else {
        const errorMsg = result.message || "فشل تسجيل الدخول";
        showAlert(
          errorMsg === "Invalid username or password"
            ? "اسم المستخدم أو كلمة المرور غير صحيحة"
            : errorMsg.includes("locked")
            ? "الحساب مقفل. يرجى الانتظار قبل المحاولة مرة أخرى"
            : errorMsg,
          "error"
        );
        loginBtn.disabled = false;
        loginBtn.innerHTML = "تسجيل الدخول";
      }
    } catch (error) {
      console.error("Login error:", error);
      showAlert("حدث خطأ: " + error.message, "error");
      loginBtn.disabled = false;
      loginBtn.innerHTML = "تسجيل الدخول";
    }
  });
});
