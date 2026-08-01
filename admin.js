/* ============================================================
   admin.js — منطق صفحة لوحة التحكم
   ============================================================ */

// ✅ ديناميكي: ياخذ رابط السيرفر الحالي تلقائياً (محلي أو إنتاج، بلا تعديل يدوي)
const API_URL = window.location.origin;

const dayNames = ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];

// نخزنو كلمة السر فـ sessionStorage — تنمسح وحدها كي تسكر التبويب
// (ماشي localStorage باش ما تبقاش محفوظة للأبد على الجهاز)
function getPassword() {
  return sessionStorage.getItem("adminPassword");
}

function setPassword(pw) {
  sessionStorage.setItem("adminPassword", pw);
}

// ---------- تسجيل الدخول ----------
async function login() {
  const pw = document.getElementById("adminPassword").value.trim();
  const errorMsg = document.getElementById("loginError");

  if (!pw) {
    errorMsg.textContent = "دخل كلمة السر";
    return;
  }

  setPassword(pw);
  errorMsg.textContent = "";

  const ok = await loadBookings();
  if (ok) {
    document.getElementById("loginBox").style.display = "none";
    document.getElementById("adminPanel").classList.add("visible");
  }
}

// ---------- جلب الحجوزات من السيرفر ----------
async function loadBookings() {
  const errorMsg = document.getElementById("loginError");

  try {
    const response = await fetch(`${API_URL}/api/admin/bookings`, {
      headers: { "x-admin-password": getPassword() || "" }
    });

    if (response.status === 401) {
      errorMsg.textContent = "كلمة السر غير صحيحة";
      sessionStorage.removeItem("adminPassword");
      return false;
    }

    const bookings = await response.json();
    renderBookings(bookings);
    return true;

  } catch (error) {
    console.error("خطأ فجلب الحجوزات:", error);
    errorMsg.textContent = "ماقدرناش نتواصلو مع السيرفر";
    return false;
  }
}

// ---------- عرض الحجوزات فالجدول ----------
function renderBookings(bookings) {
  const body = document.getElementById("bookingsBody");
  const countLabel = document.getElementById("bookingsCount");
  const emptyMsg = document.getElementById("emptyMsg");

  body.innerHTML = "";
  countLabel.textContent = `عدد الحجوزات: ${bookings.length}`;

  if (bookings.length === 0) {
    emptyMsg.style.display = "block";
    return;
  }
  emptyMsg.style.display = "none";

  bookings.forEach(b => {
    const date = new Date(b.day);
    const dayLabel = isNaN(date) ? b.day : (dayNames[date.getDay()] + " " + b.day);

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${dayLabel}</td>
      <td>${b.hour}:00</td>
      <td>${escapeHtml(b.name)}</td>
      <td>${escapeHtml(b.phone)}</td>
      <td>${b.payMethod === "online" ? "أونلاين" : "فالملعب"}</td>
      <td>${escapeHtml(b.code)}</td>
      <td><button class="cancel-btn" data-id="${b.id}">إلغاء</button></td>
    `;

    row.querySelector(".cancel-btn").onclick = () => cancelBooking(b.id);
    body.appendChild(row);
  });
}

// ---------- إلغاء حجز ----------
async function cancelBooking(id) {
  if (!confirm("متأكد باغي تلغي هاذ الحجز؟")) return;

  try {
    const response = await fetch(`${API_URL}/api/admin/bookings/${id}`, {
      method: "DELETE",
      headers: { "x-admin-password": getPassword() || "" }
    });

    if (!response.ok) {
      alert("ماقدرناش نلغيو الحجز");
      return;
    }

    loadBookings();

  } catch (error) {
    console.error("خطأ فإلغاء الحجز:", error);
    alert("ماقدرناش نتواصلو مع السيرفر");
  }
}

// ---------- حماية بسيطة من XSS عند عرض بيانات المستخدمين ----------
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- إذا كلمة السر محفوظة من قبل، ندخلو مباشرة ----------
(async function init() {
  if (getPassword()) {
    const ok = await loadBookings();
    if (ok) {
      document.getElementById("loginBox").style.display = "none";
      document.getElementById("adminPanel").classList.add("visible");
    }
  }
})();
