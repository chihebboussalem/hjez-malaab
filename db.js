// ============================================================
// db.js — الاتصال بقاعدة بيانات MySQL (TiDB Cloud)
// ✅ نستعملو mysql2 — المكتبة الأشهر للتواصل مع MySQL فـ Node.js
// ============================================================

const mysql = require("mysql2/promise");

// ---------- إعداد الاتصال (Connection Pool) ----------
// Pool أحسن من اتصال واحد: يدير عدة اتصالات فنفس الوقت بكفاءة

// ✅ SSL خاصو يكون مفعّل غير مع سيرفرات بعيدة كـ TiDB Cloud.
// MySQL محلي (localhost) عادة ما يدعمش SSL، فخليناه اختياري عبر DB_SSL فـ .env
const useSSL = process.env.DB_SSL === "true";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  ...(useSSL && {
    ssl: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: true
    }
  }),

  waitForConnections: true,
  connectionLimit: 10
});

// ============================================================
// إنشاء الجدول (يخدم غير أول مرة — إذا الجدول موجود ما يعاودش يخلقو)
// ============================================================
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS les_inscriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(60) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      day DATE NOT NULL,
      hour INT NOT NULL,
      payMethod VARCHAR(10) NOT NULL DEFAULT 'onsite',
      code VARCHAR(20) NOT NULL UNIQUE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      -- ✅ هاذ السطر هو الحل الجذري لمشكلة الحجز المزدوج:
      -- قاعدة البيانات نفسها ترفض أي صف فيه نفس (day, hour) مرتين
      UNIQUE KEY day_hour_unique (day, hour)
    );
  `);
}

module.exports = { pool, initDb };
