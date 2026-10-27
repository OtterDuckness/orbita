"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { AdjuntoTarea } from "@/lib/tarea-chat";
import { useAvisos } from "../avisos-ui";
import {
  borrarAdjuntoTareaAction,
  listarAdjuntosTareaAction,
  subirAdjuntoTareaAction,
} from "./acciones-chat";

function IconoClip() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 12.5V8a5 5 0 0 0-10 0v9a3 3 0 0 0 6 0V9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function bytesLegibles(n: number | null) {
  if (n == null || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdjuntosTarea({ tareaId }: { tareaId: string; yoId: string }) {
  const { avisar } = useAvisos();
  const [adjuntos, setAdjuntos] = useState<AdjuntoTarea[]>([]);
  const [cargando, setCargando] = useState(true);
  const [pendiente, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    void listarAdjuntosTareaAction(tareaId).then((r) => {
      if (!vivo) return;
      if (r.ok) setAdjuntos(r.adjuntos);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [tareaId]);

  function onArchivo(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("tarea_id", tareaId);
    fd.set("archivo", file);
    startTransition(async () => {
      const r = await subirAdjuntoTareaAction(fd);
      if (!r.ok) {
        avisar(r.aviso);
        return;
      }
      setAdjuntos((prev) => [...prev, r.adjunto]);
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  function borrar(adjuntoId: string) {
    const fd = new FormData();
    fd.set("tarea_id", tareaId);
    fd.set("adjunto_id", adjuntoId);
    startTransition(async () => {
      const r = await borrarAdjuntoTareaAction(fd);
      if (!r.ok) {
        avisar(r.aviso);
        return;
      }
      setAdjuntos((prev) => prev.filter((a) => a.id !== adjuntoId));
    });
  }

  return (
    <section className="border border-linea-fuerte rounded-xl overflow-hidden bg-papel shadow-suave">
      <div className="px-3 py-2 border-b border-linea flex items-center justify-between gap-2">
        <h3 className="etiqueta !normal-case tracking-normal font-semibold text-tinta">Archivos</h3>
        <div className="flex items-center gap-2">
          {cargando || pendiente ? (
            <span className="text-[11px] text-apagado">{pendiente ? "Subiendo…" : "Cargando…"}</span>
          ) : null}
          <button
            type="button"
            className="boton-sec h-7 px-2 text-[11.5px]"
            onClick={() => fileRef.current?.click()}
            disabled={pendiente}
          >
            <IconoClip />
            Añadir
          </button>
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,application/pdf,image/*"
            onChange={(e) => onArchivo(e.target.files)}
          />
        </div>
      </div>
      {adjuntos.length === 0 && !cargando ? (
        <p className="text-[12.5px] text-apagado px-3 py-3">Sin archivos.</p>
      ) : (
        <ul className="divide-y divide-linea">
          {adjuntos.map((a) => (
            <li key={a.id} className="flex items-center gap-2 px-3 py-2 text-[12.5px]">
              <a
                href={a.href}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate font-medium hover:text-magenta-texto"
              >
                {a.nombre}
              </a>
              <span className="text-[11px] text-apagado shrink-0">
                {bytesLegibles(a.tamanoBytes)}
              </span>
              <button
                type="button"
                className="text-apagado hover:text-mal px-1"
                aria-label={`Eliminar ${a.nombre}`}
                onClick={() => borrar(a.id)}
                disabled={pendiente}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
