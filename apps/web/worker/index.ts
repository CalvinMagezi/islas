// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
// Service worker code — runs in SW global scope, not window scope.
// TypeScript DOM types don't cover SW APIs; @ts-nocheck is standard practice.

export { };


self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: "Islas",
      body: event.data.text(),
      type: "info",
      url: "/",
    };
  }

  const options = {
    body: payload.body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: `islas-${payload.type}-${Date.now()}`,
    data: { url: payload.url },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options).then(() => {
      return self.clients.matchAll({ type: "window" }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: "NOTIFICATION_SOUND",
            payload,
          });
        });
      });
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
