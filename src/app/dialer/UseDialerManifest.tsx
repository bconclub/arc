"use client";

import { useEffect } from "react";

/**
 * Points the page at the dialer's own manifest. The root manifest (ARC) wins
 * in the server-rendered <head>, so the link is swapped here; Chrome reads the
 * link when it offers "Install app", so the phone gets "PROXe Dialer" opening
 * on /dialer rather than ARC.
 */
export function UseDialerManifest() {
  useEffect(() => {
    const href = "/dialer/manifest.webmanifest";
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    if (!link.href.endsWith(href)) link.href = href;
  }, []);
  return null;
}
