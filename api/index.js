// GoldShark API — ตัวกลางส่งต่อคำขอไปที่ Google Apps Script
// เปลี่ยนปลายทางได้ที่ Vercel > Settings > Environment Variables ชื่อ GAS_URL
// (ถ้าไม่ตั้ง จะใช้ URL ด้านล่าง)
const DEFAULT_GAS_URL =
  "https://script.google.com/macros/s/AKfycbzT4n08-GGUTKdEA6ZjUZUAbpREaKiGyCVnvIirNzk_PGGvJLgfTBHC1dfSACnnsEyEfw/exec";

// คำสั่งที่ลองซ้ำได้ปลอดภัย (อ่านข้อมูล) — คำสั่งที่บันทึกข้อมูลจะไม่ลองซ้ำ กันข้อมูลซ้ำ
// EA (hb) ไม่ลองซ้ำที่นี่ เพราะ EA ส่งใหม่เองทุกนาที และรอคำตอบได้จำกัด
const SAFE_RETRY = new Set(["me", "admin_login", "admin_list", "admin_payments", "admin_slip",
  "admin_config", "admin_breaking", "pay_qr"]);

// ดึงข้อความสาเหตุจากหน้าแจ้งข้อผิดพลาดของ Google (ถ้าได้หน้าเว็บแทนข้อมูล)
function reasonFromHtml(html) {
  const pick = re => { const m = html.match(re); return m ? m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : ""; };
  return (pick(/<div[^>]*class="errorMessage"[^>]*>([\s\S]*?)<\/div>/i) || pick(/<title>([\s\S]*?)<\/title>/i) || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).slice(0, 160);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = async (req, res) => {
  const target = process.env.GAS_URL || DEFAULT_GAS_URL;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const isPost = req.method === "POST";
  let body = null;
  if (isPost) {
    const raw = typeof req.body === "string" ? req.body : Buffer.isBuffer(req.body) ? req.body.toString("utf8") : null;
    const isForm = /x-www-form-urlencoded/i.test(req.headers && req.headers["content-type"] || "") || (raw && /^action=/.test(raw));
    if (raw !== null && isForm) body = JSON.stringify(Object.fromEntries(new URLSearchParams(raw)));   // EA ส่งแบบฟอร์ม → แปลงเป็น JSON
    else body = raw !== null ? raw : JSON.stringify(req.body || {});
  }
  let action = "";
  try { action = isPost ? (JSON.parse(body || "{}").action || "") : (new URLSearchParams(qs.slice(1)).get("action") || ""); } catch (e) {}
  const tries = SAFE_RETRY.has(action) ? 3 : 1;
  const started = Date.now();

  let lastErr = "";
  for (let i = 0; i < tries; i++) {
    if (i > 0) await sleep(600 * i);                       // รอสั้นๆ ก่อนลองใหม่ (0.6 วิ, 1.2 วิ)
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Math.max(5000, 55000 - (Date.now() - started)));
    try {
      const upstream = isPost
        ? await fetch(target + qs, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body, redirect: "follow", signal: ctrl.signal })
        : await fetch(target + qs, { redirect: "follow", signal: ctrl.signal });
      const text = await upstream.text();
      try {
        const j = JSON.parse(text);
        // EA: หลังบ้านขัดข้องชั่วคราว → ตอบ 503 ให้ EA ใช้ช่วงผ่อนผัน (ไม่หยุดเทรด) แทนการถือว่าโค้ดใช้ไม่ได้
        if (action === "hb" && j && j.ok === false && j.busy) return res.status(503).send(text);
        return res.status(200).send(text);                  // สำเร็จ
      } catch (e) {
        lastErr = "หลังบ้านตอบกลับผิดรูปแบบ (HTTP " + upstream.status + "): " + (reasonFromHtml(text) || "ไม่มีข้อความ");
      }
    } catch (err) {
      lastErr = err && err.name === "AbortError" ? "หลังบ้านตอบช้าเกินไป" : "เชื่อมต่อหลังบ้านไม่ได้: " + String(err && err.message || err).slice(0, 120);
    } finally {
      clearTimeout(timer);
    }
    if (Date.now() - started > 45000) break;                // เหลือเวลาไม่พอ ไม่ลองต่อ
  }
  res.status(502).send(JSON.stringify({ ok: false, error: lastErr, busy: true }));
};
