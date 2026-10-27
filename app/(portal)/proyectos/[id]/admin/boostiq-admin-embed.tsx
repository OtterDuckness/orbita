"use client";

import { useEffect, useState } from "react";

type MintOk = { ok: true; url: string };
type MintFail = { ok: false; motivo?: string; detalle?: string };

const LOG = "[ORBITA_EMBED]";

export function BoostiqAdminEmbed() {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<string[]>([]);

  const push = (line: string) => {
    console.info(LOG, line);
    setDebug((d) => [...d.slice(-10), `${new Date().toISOString().slice(11, 19)} ${line}`]);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      push("GET /api/boostiq/embed…");
      try {
        const res = await fetch("/api/boostiq/embed", { cache: "no-store" });
        const data = (await res.json()) as MintOk | MintFail;
        if (cancelled) return;
        push(`mint HTTP ${res.status} ok=${Boolean(data.ok)}`);
        if (!res.ok || !data.ok || !("url" in data)) {
          const fail = data as MintFail;
          push(`mint fail motivo=${fail.motivo || "?"} detalle=${fail.detalle || ""}`);
          setError(
            fail.detalle ||
              (fail.motivo === "sin_config"
                ? "Falta BOOSTIQ_ADMIN_BASE_URL / BOOSTIQ_EMBED_SECRET"
                : fail.motivo === "sin_permiso"
                  ? "Solo admins de Órbita pueden abrir este panel"
                  : "No se pudo obtener sesión embed de Boostiq"),
          );
          return;
        }
        const hasToken =
          data.url.includes("orbita_embed=") || data.url.includes("token=");
        push(`iframe src listo hasToken=${hasToken} urlLen=${data.url.length}`);
        setSrc(data.url);
      } catch (e) {
        if (!cancelled) {
          push(`mint network error: ${e instanceof Error ? e.message : String(e)}`);
          setError("Error de red al pedir el embed de Boostiq");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const debugBox = (
    <pre className="mt-3 p-3 rounded-md bg-tinta text-apagado text-[11px] overflow-auto max-h-40 whitespace-pre-wrap">
      {debug.join("\n") || "(sin logs)"}
    </pre>
  );

  if (error) {
    return (
      <div className="rounded-lg border border-linea bg-fondo p-6 max-w-xl">
        <h1 className="text-base font-semibold text-tinta mb-2">Admin Boostiq</h1>
        <p className="text-sm text-apagado">{error}</p>
        {debugBox}
      </div>
    );
  }

  if (!src) {
    return (
      <div className="rounded-lg border border-linea bg-fondo p-6 text-sm text-apagado max-w-xl">
        Abriendo admin Boostiq…
        {debugBox}
      </div>
    );
  }

  return (
    <div
      className="w-full rounded-lg border border-linea overflow-hidden bg-blanco -mx-0"
      style={{
        height: "calc(100dvh - 10.5rem)",
        minHeight: 420,
      }}
    >
      <iframe
        title="Admin Boostiq"
        src={src}
        className="w-full h-full border-0 block"
        allow="clipboard-read; clipboard-write"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
