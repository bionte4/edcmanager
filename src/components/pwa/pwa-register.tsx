"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function PwaRegister() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [swReady, setSwReady] = useState(false);
  const [openHelp, setOpenHelp] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          setSwReady(Boolean(reg));
          return reg.update();
        })
        .catch(() => setSwReady(false));
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      setOpenHelp(false);
    };

    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function onInstallClick() {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      return;
    }
    setOpenHelp(true);
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-10 gap-1.5 shadow-md md:h-8"
        onClick={() => void onInstallClick()}
      >
        <Download className="h-3.5 w-3.5" />
        Install App
      </Button>

      {openHelp && (
        <div className="pointer-events-auto fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div className="w-full max-w-md rounded-lg border border-border bg-background p-4 shadow-xl">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Install EDC Manager</p>
                <p className="text-[11px] text-muted-foreground">
                  {swReady
                    ? "Service worker aktif. Pakai menu browser jika prompt otomatis belum muncul."
                    : "Service worker belum terdeteksi — pastikan akses via https://netmon.click dan app sudah di-rebuild."}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setOpenHelp(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ol className="list-decimal space-y-1.5 pl-4 text-xs text-muted-foreground">
              <li>
                Pastikan URL: <span className="font-mono text-foreground">https://netmon.click</span>{" "}
                (ada gembok).
              </li>
              <li>
                <strong className="text-foreground">Chrome desktop:</strong> menu ⋮ →{" "}
                <em>Cast, save and share</em> → <em>Install page as app…</em>
                {" "}(atau ikon komputer+panah di address bar).
              </li>
              <li>
                <strong className="text-foreground">Android Chrome:</strong> menu ⋮ →{" "}
                <em>Install app</em> / <em>Add to Home screen</em>.
              </li>
              <li>
                <strong className="text-foreground">iPhone Safari:</strong> Share →{" "}
                <em>Add to Home Screen</em>.
              </li>
            </ol>
            <div className="mt-3 flex justify-end">
              <Button type="button" size="sm" onClick={() => setOpenHelp(false)}>
                Mengerti
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
