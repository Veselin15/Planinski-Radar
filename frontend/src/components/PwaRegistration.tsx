"use client";

import { useEffect } from "react";

export default function PwaRegistration() {
  useEffect(() => {
    // Register service worker for offline map and API caching.
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const isLocalhost = window.location.hostname === "localhost";
    if (!window.isSecureContext && !isLocalhost) {
      return;
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
      } catch (error) {
        console.error("Service worker registration failed:", error);
      }
    };

    void register();
  }, []);

  return null;
}
