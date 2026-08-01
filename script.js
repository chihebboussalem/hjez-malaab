/* ============================================================
   هاذ الملف دابا يهضر مع API حقيقية (server.js) بدل البيانات الوهمية.
   خاصك يكون السيرفر خدام على http://localhost:3000
   ============================================================ */

// ✅ ديناميكي: ياخذ رابط السيرفر الحالي تلقائياً (محلي أو إنتاج، بلا تعديل يدوي)
const API_URL = window.location.origin;

// أسماء الأيام بالعربية
const dayNames = ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];

// أوقات العمل: من 8 صباحا إلى 10 ليلا
const workingHours = [8,9,10,11,12,13,14,15,16,17,18,19,20,21,22];

// نجهز 7 أيام ابتداء من اليوم
const today = new Date();
const days = [];
for (let i = 0; i < 7; i++) {
  const d = new Date(today);
  d.setDate(today.getDate() + i);
  days.push(d);
}

let selectedDayIndex = 0;
let selectedHour = null;
let bookedHoursCache = []; // الأوقات المحجوزة لليوم المختار حاليا

// ---------- تحويل التاريخ لصيغة نصية YYYY-MM-DD (باش نبعثوها للـ API) ----------
function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---------- عرض أزرار الأيام ----------
function renderDays() {
  const container = document.getElementById("daysContainer");
  container.innerHTML = "";

  days.forEach((date, index) => {
    const btn = document.createElement("div");
    btn.className = "day-btn" + (index === selectedDayIndex ? " selected" : "");
    btn.textContent = dayNames[date.getDay()] + " " + date.getDate() + "/" + (date.getMonth() + 1);

    btn.onclick = function () {
      selectedDayIndex = index;
      selectedHour = null;
      renderDays();
      loadSlotsFromServer();
      hideForm();
    };

    container.appendChild(btn);
  });
}

// ============================================================
// نجيبو الأوقات المحجوزة من السيرفر (بدل الدالة الوهمية القديمة)
// ============================================================
async function loadSlotsFromServer() {
  const dayStr = toDateString(days[selectedDayIndex]);

  try {
    const response = await fetch(`${API_URL}/api/slots?day=${dayStr}`);
    const data = await response.json();
    bookedHoursCache = data.bookedHours || [];
  } catch (error) {
    console.error("ماقدرناش نجيبو الأوقات من السيرفر:", error);
    alert("ماقدرناش نتواصلو مع السيرفر. تأكد أن server.js خدام.");
    bookedHoursCache = [];
  }

  renderSlots();
}

// ---------- عرض أزرار الأوقات ----------
function renderSlots() {
  const container = document.getElementById("slotsContainer");
  container.innerHTML = "";

  workingHours.forEach(hour => {
    const isBooked = bookedHoursCache.includes(hour);
    const isSelected = selectedHour === hour;

    const btn = document.createElement("div");
    btn.textContent = hour + ":00";

    let className = "slot-btn ";
    if (isBooked) {
      className += "booked";
    } else if (isSelected) {
      className += "selected";
    } else {
      className += "available";
    }
    btn.className = className;

    if (!isBooked) {
      btn.onclick = function () {
        selectedHour = hour;
        renderSlots();
        showForm();
      };
    }

    container.appendChild(btn);
  });
}

// ---------- إظهار / إخفاء استمارة الحجز ----------
function showForm() {
  document.getElementById("formBox").classList.add("visible");
  document.getElementById("confirmationBox").classList.remove("visible");
}

function hideForm() {
  document.getElementById("formBox").classList.remove("visible");
}

// ============================================================
// تأكيد الحجز — دابا نبعثو طلب POST حقيقي للسيرفر
// ============================================================
async function confirmBooking() {
  const name = document.getElementById("fullName").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const payMethod = document.querySelector('input[name="payMethod"]:checked').value;

  if (!name || !phone) {
    alert("الرجاء إدخال الاسم ورقم الهاتف");
    return;
  }

  const submitBtn = document.querySelector(".submit-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "جارٍ التأكيد...";

  const dayStr = toDateString(days[selectedDayIndex]);

  try {
    const response = await fetch(`${API_URL}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone,
        day: dayStr,
        hour: selectedHour,
        payMethod
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "صار خطأ، حاول مرة أخرى");
      submitBtn.disabled = false;
      submitBtn.textContent = "تأكيد الحجز";
      loadSlotsFromServer();
      return;
    }

    const date = days[selectedDayIndex];
    const dateLabel = dayNames[date.getDay()] + " " + date.getDate() + "/" + (date.getMonth() + 1);
    const payLabel = payMethod === "online" ? "أونلاين" : "في الملعب";

    document.getElementById("confirmDetails").textContent =
      name + " — " + dateLabel + " الساعة " + selectedHour + ":00 — الدفع: " + payLabel +
      " — رمز الحجز: " + data.booking.code;

    document.getElementById("formBox").classList.remove("visible");
    document.getElementById("confirmationBox").classList.add("visible");

  } catch (error) {
    console.error("خطأ فالاتصال بالسيرفر:", error);
    alert("ماقدرناش نتواصلو مع السيرفر. تأكد أن server.js خدام على المنفذ 3000.");
  }

  submitBtn.disabled = false;
  submitBtn.textContent = "تأكيد الحجز";
}

// ---------- بداية التشغيل ----------
renderDays();
loadSlotsFromServer();
