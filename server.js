// ============================================================
// سيرفر بـ Node.js + Express + MySQL (TiDB Cloud)
// دوره: يستقبل طلبات من الموقع (الفرونت-إند) ويرد عليها
// ============================================================

try {
  process.loadEnvFile();
} catch {
  // ماكاش ملف .env — عادي (فـ production الإعدادات تجي من لوحة تحكم المنصة)
}

const express = require("express");
const cors = require("cors");
const path = require("path");
const { body, param, query, validationResult } = require("express-validator");
const rateLimit = require("express-rate-limit");
const { pool, initDb } = require("./db");

const app = express();

app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

if (!process.env.ADMIN_PASSWORD) {
  console.warn("⚠️  تحذير: ما حطيتش ADMIN_PASSWORD فملف .env — كلمة السر الافتراضية هي 'admin123'. بدلها قبل النشر!");
}

app.use(cors());
app.use(express.json());

// ============================================================
// Rate limiting
// ============================================================
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "طلبات كثيرة، حاول مرة أخرى بعد شوية" },
  standardHeaders: true,
  legacyHeaders: false
});
app.use("/api", generalLimiter);

const bookingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: { error: "حاولت تحجز بزاف فوقت قصير، استنى شوية وعاود حاول" },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================================
// Middleware
// ============================================================
function requireAdmin(req, res, next) {
  const password = req.headers["x-admin-password"];
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "كلمة السر غير صحيحة" });
  }
  next();
}

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
}

// ============================================================
// قواعد الـ validation
// ============================================================
const MIN_HOUR = 8;
const MAX_HOUR = 22;
const ALGERIA_PHONE_REGEX = /^(0|\+213|00213)[567][0-9]{8}$/;

const slotsValidation = [
  query("day")
    .isISO8601().withMessage("صيغة التاريخ غير صحيحة")
    .bail()
    .custom(value => /^\d{4}-\d{2}-\d{2}$/.test(value))
    .withMessage("صيغة التاريخ خاصها تكون YYYY-MM-DD")
];

const bookingValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 60 }).withMessage("الاسم خاصو يكون بين 2 و60 حرف"),

  body("phone")
    .trim()
    .matches(ALGERIA_PHONE_REGEX).withMessage("رقم الهاتف غير صحيح (مثال: 0555123456)"),

  body("day")
    .isISO8601().withMessage("صيغة التاريخ غير صحيحة")
    .bail()
    .custom(value => /^\d{4}-\d{2}-\d{2}$/.test(value)).withMessage("صيغة التاريخ خاصها تكون YYYY-MM-DD")
    .bail()
    .custom(value => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const inputDate = new Date(value + "T00:00:00");
      return inputDate >= today;
    }).withMessage("ما يمكنش تحجز فتاريخ فات"),

  body("hour")
    .isInt({ min: MIN_HOUR, max: MAX_HOUR }).withMessage(`الساعة خاصها تكون بين ${MIN_HOUR} و ${MAX_HOUR}`)
    .toInt(),

  body("payMethod")
    .optional()
    .isIn(["online", "onsite"]).withMessage("طريقة الدفع غير صحيحة")
];

const codeValidation = [
  param("code")
    .trim()
    .matches(/^MLB-[A-Z0-9]{6}$/).withMessage("صيغة الكود غير صحيحة")
];

// ============================================================
// المسار 1: GET /api/slots
// ============================================================
app.get("/api/slots", slotsValidation, handleValidationErrors, async (req, res) => {
  const day = req.query.day;

  try {
    const [rows] = await pool.query("SELECT hour FROM les_inscriptions WHERE day = ?", [day]);
    const bookedHours = rows.map(r => r.hour);
    res.json({ day, bookedHours });
  } catch (err) {
    console.error("خطأ فقاعدة البيانات:", err);
    res.status(500).json({ error: "صار خطأ فالسيرفر، حاول مرة أخرى" });
  }
});

// ============================================================
// المسار 2: POST /api/bookings
// ============================================================
app.post("/api/bookings", bookingLimiter, bookingValidation, handleValidationErrors, async (req, res) => {
  const { name, phone, day, hour, payMethod } = req.body;
  const finalPayMethod = payMethod || "onsite";
  const code = "MLB-" + Math.random().toString(36).slice(2, 8).toUpperCase();

  try {
    const [result] = await pool.query(
      "INSERT INTO les_inscriptions (name, phone, day, hour, payMethod, code) VALUES (?, ?, ?, ?, ?, ?)",
      [name, phone, day, hour, finalPayMethod, code]
    );

    res.status(201).json({
      message: "تم تأكيد الحجز",
      booking: { id: result.insertId, name, phone, day, hour, payMethod: finalPayMethod, code }
    });

  } catch (err) {
    // ER_DUP_ENTRY = MySQL رفض الإدراج بسبب الـ UNIQUE KEY (day, hour)
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "هاذ الوقت تحجز من واحد آخر، اختر وقت آخر" });
    }

    console.error("خطأ فقاعدة البيانات:", err);
    res.status(500).json({ error: "صار خطأ فالسيرفر، حاول مرة أخرى" });
  }
});

// ============================================================
// المسار 3: GET /api/bookings/:code
// ============================================================
app.get("/api/bookings/:code", codeValidation, handleValidationErrors, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM les_inscriptions WHERE code = ?", [req.params.code]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "ما لقيناش حجز بهاذ الكود" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("خطأ فقاعدة البيانات:", err);
    res.status(500).json({ error: "صار خطأ فالسيرفر، حاول مرة أخرى" });
  }
});

// ============================================================
// المسار 4 (admin): GET /api/admin/bookings
// ============================================================
app.get("/api/admin/bookings", requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM les_inscriptions ORDER BY day ASC, hour ASC");
    res.json(rows);
  } catch (err) {
    console.error("خطأ فقاعدة البيانات:", err);
    res.status(500).json({ error: "صار خطأ فالسيرفر، حاول مرة أخرى" });
  }
});

// ============================================================
// المسار 5 (admin): DELETE /api/admin/bookings/:id
// ============================================================
app.delete("/api/admin/bookings/:id",
  requireAdmin,
  param("id").isInt({ min: 1 }).withMessage("id غير صحيح"),
  handleValidationErrors,
  async (req, res) => {
    try {
      const [result] = await pool.query("DELETE FROM les_inscriptions WHERE id = ?", [req.params.id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "ماكانش حجز بهاذ الـ id" });
      }

      res.json({ message: "تم إلغاء الحجز" });
    } catch (err) {
      console.error("خطأ فقاعدة البيانات:", err);
      res.status(500).json({ error: "صار خطأ فالسيرفر، حاول مرة أخرى" });
    }
  }
);

// ============================================================
// تشغيل السيرفر — خاصنا نتأكدو من قاعدة البيانات قبل ما نبداو نستقبلو طلبات
// ============================================================
async function start() {
  try {
    await initDb();
    console.log("✅ قاعدة البيانات (MySQL / TiDB Cloud) متصلة وجاهزة");

    app.listen(PORT, () => {
      console.log(`السيرفر خدام على: http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ ماقدرناش نتصلو بقاعدة البيانات:", err.message);
    process.exit(1);
  }
}

start();
