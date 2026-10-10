"use client";

import { useEffect, useRef } from "react";

/**
 * Lets the phone's Back gesture (or the browser back button) close an overlay
 * instead of leaving the page. Opening adds one history entry; Back pops it and
 * closes. Closing any other way removes that entry again, so history stays clean.
 *
 * Open overlays share one entry (counted here), and the entry is only removed a
 * tick after the last one closes, so React's mount/unmount/mount in development
 * (and one overlay replacing another) never fires a stray Back.
 */
let open = 0;

export function useBackToClose(onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    open++;
    let poppedByBack = false;
    if (!window.history.state?.studioOverlay) window.history.pushState({ ...(window.history.state || {}), studioOverlay: true }, "");
    const onPop = () => {
      if (window.history.state?.studioOverlay) return; // still on an overlay entry
      poppedByBack = true;
      close.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      open--;
      window.removeEventListener("popstate", onPop);
      window.setTimeout(() => {
        if (!poppedByBack && open === 0 && window.history.state?.studioOverlay) window.history.back();
      }, 0);
    };
  }, []);
}
