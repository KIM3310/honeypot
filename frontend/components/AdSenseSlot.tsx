import React, { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const ADSENSE_CLIENT = String(import.meta.env.VITE_ADSENSE_CLIENT || "").trim();
const ADSENSE_SLOT = String(import.meta.env.VITE_ADSENSE_SLOT || "").trim();

export default function AdSenseSlot() {
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!ADSENSE_CLIENT || typeof document === "undefined") {
      return;
    }
    if (document.getElementById("honeypot-adsbygoogle-script")) {
      return;
    }
    const script = document.createElement("script");
    script.id = "honeypot-adsbygoogle-script";
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!ADSENSE_CLIENT || !ADSENSE_SLOT || pushedRef.current) {
      return;
    }
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushedRef.current = true;
    } catch (_err) {
      // no-op
    }
  }, []);

  if (!ADSENSE_CLIENT || !ADSENSE_SLOT) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white/80 p-3 text-[11px] text-gray-700">
        Set `VITE_ADSENSE_CLIENT` and `VITE_ADSENSE_SLOT` to enable AdSense.
      </div>
    );
  }

  return (
    <ins
      className="adsbygoogle block w-full overflow-hidden rounded-xl border border-gray-300 bg-white/70 p-1"
      style={{ minHeight: "96px" }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={ADSENSE_SLOT}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
