"use client";

import { useEffect, useId, useState, useTransition } from "react";
import {
  guardarNotaHistorial,
  obtenerHistorialCliente,
  obtenerHistorialProyecto,
  type HistorialEvento,
} from "./historial-acciones";

const btnSec =
  "boton-sec text-[12px] px-2.5 py-1 shrink-0";

function formatearFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(iso));
}

function PanelNota({
  evento,
  ambito,
  abierto,
  onCerrar,
  onGuardado,
}: {
  evento: HistorialEvento;
  ambito: "cliente" | "proyecto";
  abierto: boolean;
  onCerrar: () => void;
  onGuardado: (patch: Pick<HistorialEvento, "nota" | "notaAutorNombre" | "notaCreadoEn">) => void;
}) {
  const [borrador, setBorrador] = useState(evento.nota ?? "");
  const [error, setError] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const tituloId = useId();

  useEffect(() => {
    if (!abierto) return;
    setBorrador(evento.nota ?? "");
    setError(false);
  }, [abierto, evento.id, evento.nota]);

  function guardar() {
    setError(false);
    startTransition(async () => {
      const r = await guardarNotaHistorial(ambito, evento.id, borrador);
      if (!r.ok) {
        setError(true);
        return;
      }
      onGuardado({
        nota: r.nota,
        notaAutorNombre: r.notaAutorNombre,
        notaCreadoEn: r.notaCreadoEn,
      });
      onCerrar();
    });
  }

  return (
    <aside
      aria-hidden={!abierto}
      aria-labelledby={tituloId}
      className={`absolute top-0 bottom-0 left-full ml-3 z-[55] w-[min(100vw-1.5rem,300px)] flex flex-col rounded-[12px] border border-linea-fuerte bg-papel shadow-suave overflow-hidden transition-all duration-300 ease-out origin-left ${
        abierto
          ? "opacity-100 translate-x-0 pointer-events-auto"
          : "opacity-0 -translate-x-2 pointer-events-none"
      }`}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-linea shrink-0">
        <p id={tituloId} className="text-[13px] font-semibold text-tinta">
          {evento.nota ? "Editar nota" : "Añadir nota"}
        </p>
        <button
          type="button"
          onClick={onCerrar}
          className="text-apagado hover:text-tinta text-[18px] leading-none px-1"
          aria-label="Cerrar nota"
        >
          ×
        </button>
      </div>
      <div className="flex-1 min-h-0 p-3 grid gap-2 content-start">
        <p className="text-[11px] text-apagado break-words">
          {evento.accionEtiqueta}
          {evento.detalle ? ` · ${evento.detalle}` : ""}
        </p>
        <textarea
          value={borrador}
          onChange={(e) => setBorrador(e.target.value)}
          rows={8}
          maxLength={10_000}
          placeholder="Escribe una nota…"
          className="control w-full text-[12.5px] px-2 py-1.5 resize-y min-h-[8rem]"
          disabled={pendiente || !abierto}
        />
        {error ? (
          <p className="text-[11px] text-mal">No se pudo guardar la nota.</p>
        ) : null}
        <div className="flex items-center gap-1.5">
          <button type="button" className={btnSec} onClick={guardar} disabled={pendiente || !abierto}>
            {pendiente ? "Guardando…" : "Guardar"}
          </button>
          <button type="button" className={btnSec} onClick={onCerrar} disabled={pendiente}>
            Cancelar
          </button>
        </div>
      </div>
    </aside>
  );
}

export function HistorialLightbox({
  ambito,
  entidadId,
  titulo,
  className = btnSec,
}: {
  ambito: "cliente" | "proyecto";
  entidadId: string;
  titulo: string;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [eventos, setEventos] = useState<HistorialEvento[] | null>(null);
  const [error, setError] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const [notaAbiertaId, setNotaAbiertaId] = useState<string | null>(null);
  const tituloId = useId();

  const eventoNota = notaAbiertaId
    ? eventos?.find((e) => e.id === notaAbiertaId) ?? null
    : null;

  useEffect(() => {
    if (!abierto) return;
    const onTecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (notaAbiertaId) {
        setNotaAbiertaId(null);
        return;
      }
      setAbierto(false);
    };
    window.addEventListener("keydown", onTecla);
    return () => window.removeEventListener("keydown", onTecla);
  }, [abierto, notaAbiertaId]);

  function abrir() {
    setAbierto(true);
    setError(false);
    setEventos(null);
    setNotaAbiertaId(null);
    startTransition(async () => {
      const r =
        ambito === "cliente"
          ? await obtenerHistorialCliente(entidadId)
          : await obtenerHistorialProyecto(entidadId);
      if (!r.ok) {
        setError(true);
        setEventos([]);
        return;
      }
      setEventos(r.eventos);
    });
  }

  function cerrarTodo() {
    setNotaAbiertaId(null);
    setAbierto(false);
  }

  function actualizarNota(
    id: string,
    patch: Pick<HistorialEvento, "nota" | "notaAutorNombre" | "notaCreadoEn">,
  ) {
    setEventos((prev) =>
      prev ? prev.map((ev) => (ev.id === id ? { ...ev, ...patch } : ev)) : prev,
    );
  }

  return (
    <>
      <button type="button" className={className} onClick={abrir} title="Ver historial de cambios">
        Historial
      </button>

      {abierto ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center p-3 sm:p-4 bg-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={tituloId}
          onClick={cerrarTodo}
        >
          <div className="relative w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="max-h-[calc(100svh-3rem)] overflow-y-auto rounded-[12px] bg-papel border border-linea-fuerte shadow-suave p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="min-w-0 flex-1">
                  <p className="etiqueta text-magenta-texto mb-1">Historial</p>
                  <h2 id={tituloId} className="font-display font-bold text-[20px] tracking-tight">
                    {titulo}
                  </h2>
                  <p className="text-[12.5px] text-apagado mt-1">
                    {ambito === "cliente"
                      ? "Incluye cambios del cliente, sus proyectos y sus tareas."
                      : "Incluye cambios del proyecto y de sus tareas."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cerrarTodo}
                  className="shrink-0 text-apagado hover:text-tinta text-[18px] leading-none px-1"
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>

              {pendiente && eventos === null ? (
                <p className="text-[13px] text-apagado py-6 text-center">Cargando…</p>
              ) : error ? (
                <p className="text-[13px] text-mal py-6 text-center">No se pudo cargar el historial.</p>
              ) : !eventos || eventos.length === 0 ? (
                <p className="text-[13px] text-apagado py-6 text-center">Aún no hay eventos registrados.</p>
              ) : (
                <ul className="divide-y divide-linea border border-linea-fuerte rounded-lg overflow-hidden">
                  {eventos.map((ev) => (
                    <li key={ev.id} className="px-3 py-2.5 bg-suave/40 grid gap-0.5">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="font-mono text-[11px] text-apagado">
                          {formatearFecha(ev.creadoEn)}
                        </span>
                        <span className="etiqueta">{ev.areaEtiqueta}</span>
                        <b className="text-[13px]">{ev.accionEtiqueta}</b>
                      </div>
                      <p className="text-[12.5px] text-apagado break-words">
                        {ev.detalle ?? "—"}
                      </p>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="font-mono text-[11px] text-apagado truncate min-w-0">
                          {ev.actorCorreo}
                        </p>
                        <button
                          type="button"
                          className={btnSec}
                          onClick={() =>
                            setNotaAbiertaId((id) => (id === ev.id ? null : ev.id))
                          }
                          aria-expanded={notaAbiertaId === ev.id}
                        >
                          {ev.nota ? "Editar nota" : "Añadir nota"}
                        </button>
                      </div>
                      {ev.nota ? (
                        <div className="mt-1.5 rounded-md border border-amber-200/80 bg-amber-50 px-2 py-1.5 grid gap-0.5">
                          <p className="text-[12.5px] break-words whitespace-pre-wrap">{ev.nota}</p>
                          <p className="font-mono text-[11px] text-apagado">
                            {ev.notaAutorNombre ?? "—"}
                            {ev.notaCreadoEn ? ` · ${formatearFecha(ev.notaCreadoEn)}` : ""}
                          </p>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {eventoNota ? (
              <PanelNota
                key={eventoNota.id}
                evento={eventoNota}
                ambito={ambito}
                abierto={Boolean(notaAbiertaId)}
                onCerrar={() => setNotaAbiertaId(null)}
                onGuardado={(patch) => actualizarNota(eventoNota.id, patch)}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
