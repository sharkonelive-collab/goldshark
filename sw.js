// GoldShark: service worker เบาๆ ให้ติดตั้งลงหน้าจอได้ — ไม่เก็บแคช ดึงของใหม่จากเว็บทุกครั้ง
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
