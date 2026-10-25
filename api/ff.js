// GoldShark — ทางสำรองดึงปฏิทินข่าว ForexFactory ผ่าน Vercel
// Apps Script ใช้ IP ร่วมกับคนทั้งโลก เลยโดน ForexFactory จำกัด (429) / บล็อกบ่อย
// ตัวนี้ดึงจาก IP ของ Vercel แล้วให้ CDN ของ Vercel เก็บแคชไว้ 30 นาที (เรียกต้นทางจริงไม่เกินชั่วโมงละ ~2 ครั้ง)
const SOURCES = [
  "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
  "https://cdn-nfs.faireconomy.media/ff_calendar_thisweek.json",
];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
let mem = null;   // { body, t } แคชในเครื่องที่ยังอุ่นอยู่ (กันยิงต้นทางซ้ำ)

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (mem && Date.now() - mem.t < 30 * 60 * 1000) {
    res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=3600");
    res.setHeader("X-GS-Source", "memory");
    return res.status(200).send(mem.body);
  }
  const errors = [];
  for (const url of SOURCES) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json,text/plain,*/*" }, signal: ctrl.signal });
      const text = await r.text();
      const body = text.trim();
      if (r.status === 200 && body.charAt(0) === "[") {
        JSON.parse(body);                                    // ตรวจว่าเป็นข้อมูลจริง
        mem = { body, t: Date.now() };
        res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=3600");
        res.setHeader("X-GS-Source", url.includes("cdn-") ? "backup" : "main");
        return res.status(200).send(body);
      }
      errors.push(`${url.includes("cdn-") ? "สำรอง" : "หลัก"} HTTP ${r.status}${r.status === 200 ? " (ได้หน้าเว็บแทนข้อมูล)" : ""}`);
    } catch (e) {
      errors.push(`${url.includes("cdn-") ? "สำรอง" : "หลัก"} ${e && e.name === "AbortError" ? "ตอบช้าเกินไป" : String(e && e.message || e).slice(0, 80)}`);
    } finally { clearTimeout(timer); }
  }
  // ต้นทางล่ม: ถ้ามีของเก่าในเครื่อง ส่งของเก่าไปก่อน (ดีกว่าไม่มีข่าวเลย)
  if (mem) {
    res.setHeader("Cache-Control", "public, s-maxage=120");
    res.setHeader("X-GS-Source", "stale");
    return res.status(200).send(mem.body);
  }
  res.setHeader("Cache-Control", "public, s-maxage=60");
  return res.status(502).send(JSON.stringify({ ok: false, error: errors.join(" · ") || "ดึงข่าวไม่ได้" }));
};
