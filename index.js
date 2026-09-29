// GoldShark API — ตัวกลางส่งต่อคำขอไปที่ Google Apps Script
// เปลี่ยนปลายทางได้ที่ Vercel > Settings > Environment Variables ชื่อ GAS_URL
// (ถ้าไม่ตั้ง จะใช้ URL ด้านล่าง)
const DEFAULT_GAS_URL =
  "https://script.google.com/macros/s/AKfycbzT4n08-GGUTKdEA6ZjUZUAbpREaKiGyCVnvIirNzk_PGGvJLgfTBHC1dfSACnnsEyEfw/exec";

// ดึงข้อความสาเหตุจากหน้าแจ้งข้อผิดพลาดของ Google (ถ้าได้หน้าเว็บแทนข้อมูล)
function reasonFromHtml(html) {
  const pick = re => { const m = html.match(re); return m ? m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : ""; };
  return (pick(/<div[^>]*class="errorMessage"[^>]*>([\s\S]*?)<\/div>/i) || pick(/<title>([\s\S]*?)<\/title>/i) || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).slice(0, 160);
}

module.exports = async (req, res) => {
  const target = process.env.GAS_URL || DEFAULT_GAS_URL;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55000);
  try {
    let upstream;
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
      upstream = await fetch(target, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body,
        redirect: "follow",
        signal: ctrl.signal,
      });
    } else {
      const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      upstream = await fetch(target + qs, { redirect: "follow", signal: ctrl.signal });
    }
    const text = await upstream.text();
    try {
      JSON.parse(text);
      res.status(200).send(text);
    } catch {
      const why = reasonFromHtml(text) || "ไม่มีข้อความ";
      res.status(502).send(JSON.stringify({ ok: false, error: "หลังบ้านตอบกลับผิดรูปแบบ (HTTP " + upstream.status + "): " + why }));
    }
  } catch (err) {
    const aborted = err && err.name === "AbortError";
    res.status(504).send(JSON.stringify({ ok: false, error: aborted ? "หลังบ้านตอบช้าเกิน 55 วินาที ลองใหม่อีกครั้ง" : "เชื่อมต่อหลังบ้านไม่ได้: " + String(err && err.message || err).slice(0, 120) }));
  } finally {
    clearTimeout(timer);
  }
};
