/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

const sanitize = (value) => String(value || "").trim().replace(/^['"]|['"]$/g, "");
const PUSH_DEBUG_PREFIX = "[push-sw]";

const getNotificationKey = (payload) =>
  payload?.data?.notificationId ||
  payload?.data?.messageId ||
  payload?.messageId ||
  [
    payload?.notification?.title || payload?.data?.title || "",
    payload?.notification?.body || payload?.data?.body || "",
    payload?.data?.orderId || "",
    payload?.data?.targetUrl || payload?.data?.link || "",
  ].join("::");

async function notifyOpenClients(payload) {
  try {
    const windowClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
    windowClients.forEach((client) => {
      client.postMessage({
        type: "push-notification-received",
        payload,
      });
    });
  } catch (e) {
    console.error(PUSH_DEBUG_PREFIX, "Error notifying open clients:", e);
  }
}

async function loadFirebaseWebConfig() {
  const candidates = [
    "/firebase-web-config.json",
    "/api/v1/food/public/env",
  ];
  for (const url of candidates) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;
      const json = await response.json();
      const data = url.endsWith(".json") ? (json || {}) : ((json && json.data) || {});
      const config = {
        apiKey: sanitize(data.VITE_FIREBASE_API_KEY || data.FIREBASE_API_KEY),
        authDomain: sanitize(data.VITE_FIREBASE_AUTH_DOMAIN || data.FIREBASE_AUTH_DOMAIN),
        projectId: sanitize(data.VITE_FIREBASE_PROJECT_ID || data.FIREBASE_PROJECT_ID),
        appId: sanitize(data.VITE_FIREBASE_APP_ID || data.FIREBASE_APP_ID),
        messagingSenderId: sanitize(data.VITE_FIREBASE_MESSAGING_SENDER_ID || data.FIREBASE_MESSAGING_SENDER_ID),
        storageBucket: sanitize(data.VITE_FIREBASE_STORAGE_BUCKET || data.FIREBASE_STORAGE_BUCKET),
        measurementId: sanitize(data.VITE_FIREBASE_MEASUREMENT_ID || data.FIREBASE_MEASUREMENT_ID),
      };

      if (config.apiKey && config.projectId && config.appId && config.messagingSenderId) {
        return config;
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}

(async () => {
  const config = await loadFirebaseWebConfig();
  if (!config || !config.apiKey || !config.projectId || !config.appId || !config.messagingSenderId) {
    return;
  }

  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(async (payload) => {
    console.log(PUSH_DEBUG_PREFIX, "Received Firebase background message", payload);
  });
})();

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    console.log(PUSH_DEBUG_PREFIX, "Received raw push event payload:", payload);

    const title =
      payload?.notification?.title ||
      payload?.data?.title ||
      payload?.data?.heading ||
      "New Notification";
    const body =
      payload?.notification?.body ||
      payload?.data?.body ||
      payload?.data?.message ||
      "";
    const image =
      payload?.notification?.image ||
      payload?.data?.image ||
      payload?.data?.imageUrl ||
      undefined;

    const notificationKey = getNotificationKey(payload);

    event.waitUntil(
      Promise.all([
        self.registration.showNotification(title, {
          body,
          icon: "/FC%20-%20Logo%201.png",
          image,
          tag: notificationKey || undefined,
          renotify: true,
          silent: false,
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 300],
          data: payload?.data || {},
        }),
        notifyOpenClients(payload)
      ])
    );
  } catch (error) {
    console.error(PUSH_DEBUG_PREFIX, "Error displaying push notification:", error);
  }
});

self.addEventListener("notificationclick", (event) => {
  console.log(PUSH_DEBUG_PREFIX, "Notification click received", event?.notification?.data || {});
  event.notification.close();
  const rawLink =
    event?.notification?.data?.link ||
    event?.notification?.data?.click_action ||
    event?.notification?.data?.targetUrl ||
    "/admin/food-approval";
  const targetUrl = String(rawLink || "/admin/food-approval").startsWith("/") ? String(rawLink || "/admin/food-approval") : "/admin/food-approval";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      const client = windowClients.find((c) => c.url.includes(self.location.origin));
      if (client) {
        client.focus();
        return client.navigate(targetUrl);
      }
      return clients.openWindow(targetUrl);
    }),
  );
});
