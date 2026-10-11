"use client";

import { useEffect } from "react";

/** Registers the service worker (public/sw.js) in production, which makes ARC installable as an app. */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => { /* not installable, still works as a site */ });
  }, []);
  return null;
}
