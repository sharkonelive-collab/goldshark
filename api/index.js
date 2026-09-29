// GoldShark API — ตัวกลางส่งต่อคำขอไปที่ Google Apps Script
// เปลี่ยนปลายทางได้ที่ Vercel > Settings > Environment Variables ชื่อ GAS_URL
// (ถ้าไม่ตั้ง จะใช้ URL ด้านล่าง)
const DEFAULT_GAS_URL =
  "https://script.google.com/macros/s/AKfycbwXU_nIrl7B_-2ffrDxgzR3xhp1RFsS4ozblYkNeQOb8x94FWWbYkXVnY3tv1ocoNHU/exec";

module.exports = async (req, res) => {
  const target = process.env.GAS_URL || DEFAULT_GAS_URL;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    let upstream;
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
      upstream = await fetch(target, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body,
        redirect: "follow",
      });
    } else {
      const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      upstream = await fetch(target + qs, { redirect: "follow" });
    }
    const text = await upstream.text();
    // Apps Script ตอบกลับเป็น JSON เสมอ ถ้าไม่ใช่ แปลว่าปลายทางมีปัญหา (เช่น สิทธิ์ไม่ใช่ "ทุกคน")
    try {
      JSON.parse(text);
      res.status(200).send(text);
    } catch {
      res.status(502).send(JSON.stringify({ ok: false, error: "เซิร์ฟเวอร์หลังบ้านตอบกลับผิดรูปแบบ" }));
    }
  } catch (err) {
    res.status(502).send(JSON.stringify({ ok: false, error: "เชื่อมต่อเซิร์ฟเวอร์หลังบ้านไม่ได้" }));
  }
};
