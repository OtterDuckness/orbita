"use client";

import { useEffect, useRef, useState, useTransition, type KeyboardEvent, type PointerEvent } from "react";
import Link from "next/link";
import { hrefTareaPanel, horaCorta, type ReunionAgenda, type TareaAgenda } from "@/lib/agenda";
import { vencimiento } from "@/lib/tareas-mock";
import { alternarCompletadaAction } from "./tareas/acciones";

export type HoyResumenProps = {
  reuniones: ReunionAgenda[];
  tareas: TareaAgenda[];
  googleEstado: "ok" | "sin_tokens" | "error" | "omitido";
};

const SPLIT_KEY = "orbita.inicio.hoySplit.v2";
const SPLIT_DEFAULT = 32;
const SPLIT_MIN = 18;
const SPLIT_MAX = 82;

function Chip({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="inline-flex items-center justify-center min-w-[1.35rem] h-[1.2rem] px-1.5 rounded-md bg-magenta-suave text-magenta-texto font-mono text-[10.5px] font-semibold tabular-nums">
      {n}
    </span>
  );
}

function leerSplit(): number {
  if (typeof window === "undefined") return SPLIT_DEFAULT;
  try {
    const v = Number(window.localStorage.getItem(SPLIT_KEY));
    if (Number.isFinite(v) && v >= SPLIT_MIN && v <= SPLIT_MAX) return v;
  } catch {
    /* ignore */
  }
  return SPLIT_DEFAULT;
}

function guardarSplit(pct: number) {
  try {
    window.localStorage.setItem(SPLIT_KEY, String(Math.round(pct)));
  } catch {
    /* ignore */
  }
}

function clampSplit(pct: number) {
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, pct));
}

function CabeceraBloque({
  titulo,
  n,
}: {
  titulo: string;
  n: number;
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0 mb-1.5">
      <h3 className="etiqueta">{titulo}</h3>
      <Chip n={n} />
    </div>
  );
}

function TarjetaReunion({ r }: { r: ReunionAgenda }) {
  const hora = r.todoElDia ? "Todo el día" : horaCorta(r.inicio);
  const href = r.enlaceReunion || r.htmlLink;
  return (
    <li className="rounded-lg border border-linea bg-papel px-1.5 py-1 grid gap-0.5 min-w-0 content-start hover:border-magenta-borde transition">
      <span className="font-mono text-apagado text-[10px] tabular-nums leading-none">
        {hora ?? "—"}
      </span>
      <span className="font-medium text-[12px] leading-tight line-clamp-2">{r.titulo}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-magenta-texto hover:underline truncate leading-tight w-fit"
        >
          {r.enlaceReunion ? "Unirse" : "Abrir"}
        </a>
      ) : null}
    </li>
  );
}

function TarjetaTarea({
  t,
  pending,
  onToggle,
}: {
  t: TareaAgenda;
  pending: boolean;
  onToggle: (id: string) => void;
}) {
  const etiquetaAtraso =
    t.atrasada && !t.completada ? vencimiento(t.dia)?.texto ?? "Atrasada" : null;

  return (
    <li
      className={`rounded-lg border border-linea bg-papel px-2 py-1.5 flex items-start gap-1.5 min-w-0 hover:border-magenta-borde transition ${
        t.completada ? "opacity-55" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={t.completada}
        disabled={pending}
        onChange={() => onToggle(t.id)}
        className="mt-0.5 accent-[var(--magenta)] size-3.5 shrink-0"
        aria-label={t.completada ? "Reabrir tarea" : "Completar tarea"}
      />
      <Link
        href={hrefTareaPanel(t)}
        className={`min-w-0 flex-1 ${
          t.completada ? "line-through text-apagado" : "hover:text-magenta-texto"
        }`}
      >
        {etiquetaAtraso ? (
          <span className="text-mal font-semibold text-[11px] block leading-none mb-0.5">
            {etiquetaAtraso}
          </span>
        ) : null}
        <span
          className={`text-[12.5px] leading-tight line-clamp-2 block ${
            t.completada ? "" : "font-medium"
          }`}
        >
          {t.nombre}
        </span>
        <span className="text-apagado text-[10.5px] block truncate leading-tight mt-0.5">
          {t.proyectoEtiqueta}
          {t.clienteNombre ? ` · ${t.clienteNombre}` : ""}
        </span>
      </Link>
    </li>
  );
}

const gridCards =
  "grid gap-1.5 content-start grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] min-h-0 flex-1 overflow-y-auto overflow-x-hidden";

export function HoyResumen({
  reuniones: reunionesIniciales,
  tareas: tareasIniciales,
  googleEstado,
}: HoyResumenProps) {
  const [tareas, setTareas] = useState(tareasIniciales);
  const [pending, startTransition] = useTransition();
  const [split, setSplit] = useState(SPLIT_DEFAULT);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const arrastrando = useRef(false);
  const splitRef = useRef(SPLIT_DEFAULT);

  useEffect(() => {
    const guardado = leerSplit();
    setSplit(guardado);
    splitRef.current = guardado;
  }, []);

  useEffect(() => {
    splitRef.current = split;
  }, [split]);

  function toggleTarea(id: string) {
    const prev = tareas;
    setTareas((lista) =>
      lista.map((t) => (t.id === id ? { ...t, completada: !t.completada } : t)),
    );
    startTransition(async () => {
      const fd = new FormData();
      fd.set("tarea_id", id);
      const r = await alternarCompletadaAction(fd);
      if (!r.ok) {
        setTareas(prev);
        return;
      }
      setTareas((lista) =>
        lista.map((t) =>
          t.id === id ? { ...t, completada: Boolean(r.tarea.completadaEl) } : t,
        ),
      );
    });
  }

  function actualizarSplitDesdeX(clientX: number) {
    const el = contenedorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const next = clampSplit(((clientX - rect.left) / rect.width) * 100);
    splitRef.current = next;
    setSplit(next);
  }

  function onSeparatorPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    arrastrando.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    actualizarSplitDesdeX(e.clientX);
  }

  function onSeparatorPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!arrastrando.current) return;
    actualizarSplitDesdeX(e.clientX);
  }

  function onSeparatorPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (!arrastrando.current) return;
    arrastrando.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    guardarSplit(splitRef.current);
  }

  function onSeparatorKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 5 : 2;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const next = clampSplit(splitRef.current - step);
      splitRef.current = next;
      setSplit(next);
      guardarSplit(next);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = clampSplit(splitRef.current + step);
      splitRef.current = next;
      setSplit(next);
      guardarSplit(next);
    } else if (e.key === "Home") {
      e.preventDefault();
      splitRef.current = SPLIT_MIN;
      setSplit(SPLIT_MIN);
      guardarSplit(SPLIT_MIN);
    } else if (e.key === "End") {
      e.preventDefault();
      splitRef.current = SPLIT_MAX;
      setSplit(SPLIT_MAX);
      guardarSplit(SPLIT_MAX);
    }
  }

  const abiertas = tareas.filter((t) => !t.completada).length;

  function bloqueReuniones() {
    return (
      <>
        <CabeceraBloque titulo="Reuniones" n={reunionesIniciales.length} />
        {googleEstado === "sin_tokens" ? (
          <p className="text-[13px] text-apagado py-1">
            Conecta Google (vuelve a iniciar sesión) para ver tus reuniones.
          </p>
        ) : googleEstado === "error" ? (
          <p className="text-[13px] text-apagado py-1">No se pudo cargar Google Calendar.</p>
        ) : reunionesIniciales.length === 0 ? (
          <p className="text-[13px] text-apagado py-1">Sin reuniones hoy.</p>
        ) : (
          <ul className={gridCards}>
            {reunionesIniciales.map((r) => (
              <TarjetaReunion key={r.id} r={r} />
            ))}
          </ul>
        )}
      </>
    );
  }

  function bloqueTareas() {
    return (
      <>
        <CabeceraBloque titulo="Tareas" n={abiertas} />
        {tareas.length === 0 ? (
          <p className="text-[13px] text-apagado py-1">Nada pendiente para hoy.</p>
        ) : (
          <ul className={gridCards}>
            {tareas.map((t) => (
              <TarjetaTarea key={t.id} t={t} pending={pending} onToggle={toggleTarea} />
            ))}
          </ul>
        )}
      </>
    );
  }

  return (
    <section className="tarjeta p-3.5 flex flex-col min-h-0 h-full">
      <div className="flex items-baseline justify-between gap-2 flex-wrap shrink-0 pb-2.5 mb-3 border-b border-linea">
        <div>
          <p className="etiqueta text-magenta-texto mb-0.5">Hoy</p>
          <div className="flex items-center gap-2">
            <h2 className="font-display font-bold text-[16px] tracking-tight">Tu día</h2>
            <Chip n={reunionesIniciales.length + abiertas} />
          </div>
        </div>
        <Link
          href="/calendario"
          className="text-[12.5px] text-magenta-texto hover:underline shrink-0"
        >
          Ver calendario
        </Link>
      </div>

      {/* Móvil: apilado */}
      <div className="grid gap-4 min-[720px]:hidden min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 min-h-0 flex flex-col overflow-hidden">{bloqueReuniones()}</div>
        <div className="min-w-0 min-h-0 flex flex-col overflow-hidden">{bloqueTareas()}</div>
      </div>

      {/* Desktop: paneles con divisor arrastrable */}
      <div
        ref={contenedorRef}
        className="hidden min-[720px]:flex min-h-0 flex-1 overflow-hidden select-none"
      >
        <div
          className="min-w-0 min-h-0 flex flex-col overflow-hidden pr-1"
          style={{ width: `${split}%` }}
        >
          {bloqueReuniones()}
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuemin={SPLIT_MIN}
          aria-valuemax={SPLIT_MAX}
          aria-valuenow={Math.round(split)}
          aria-label="Ajustar espacio entre reuniones y tareas"
          title="Arrastra para cambiar el tamaño"
          tabIndex={0}
          onPointerDown={onSeparatorPointerDown}
          onPointerMove={onSeparatorPointerMove}
          onPointerUp={onSeparatorPointerUp}
          onPointerCancel={onSeparatorPointerUp}
          onKeyDown={onSeparatorKeyDown}
          className="group relative w-2.5 shrink-0 cursor-col-resize touch-none outline-none
                     focus-visible:ring-2 focus-visible:ring-anillo"
        >
          <span
            aria-hidden
            className="absolute inset-y-2 left-1/2 -translate-x-1/2 w-[3px] rounded-full bg-linea-fuerte
                       group-hover:bg-magenta group-focus-visible:bg-magenta
                       group-active:bg-magenta transition-colors"
          />
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-[3px] pointer-events-none"
          >
            <span className="size-1 rounded-full bg-apagado group-hover:bg-papel group-focus-visible:bg-papel group-active:bg-papel" />
            <span className="size-1 rounded-full bg-apagado group-hover:bg-papel group-focus-visible:bg-papel group-active:bg-papel" />
            <span className="size-1 rounded-full bg-apagado group-hover:bg-papel group-focus-visible:bg-papel group-active:bg-papel" />
          </span>
        </div>

        <div className="min-w-0 min-h-0 flex-1 flex flex-col overflow-hidden pl-1">
          {bloqueTareas()}
        </div>
      </div>
    </section>
  );
}
