"use strict";
// No offline cache: a cached control screen must never masquerade as live washer state.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  event.waitUntil(self.registration.showNotification(data.title || "Minha Lavadora", {
    body: data.body || "Há uma atualização da sua lavadora.",
    icon: "/assets/icon-192.png", badge: "/assets/icon-192.png",
    tag: data.tag || "washer", renotify: false,
    data: { url: ["/#status", "/#notifications"].includes(data.url) ? data.url : "/#status" }
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/#status", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const window of windows) {
      if (new URL(window.url).origin === self.location.origin) {
        await window.navigate(url); return window.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
