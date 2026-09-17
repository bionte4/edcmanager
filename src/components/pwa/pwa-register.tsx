"use client";

import { useEffect } from "react";

/** Registers service worker only — no Install UI (browser native install is enough). */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* ignore */
    });
  }, []);

  return null;
}
