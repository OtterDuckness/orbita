"use client";

import { useEffect, useMemo, useState, useTransition, type MouseEvent } from "react";
import {
  agruparPorDia,
  celdasMes,
  diasDeSemana,
  finSemana,
  horaCorta,
  inicioSemana,
  minutosDelDia,
  rangoMes,
  toYmd,
  type ItemAgenda,
  type ReunionAgenda,
  type TareaAgenda,
  type TareaParaAgenda,
} from "@/lib/agenda";
import type { PersonaEquipo } from "@/lib/clientes-mock";
import type { EventoGoogleListado } from "@/lib/google-calendar";
import type { TareaUsuario } from "@/lib/tablero";
import type { Tarea } from "@/lib/tareas-mock";
import { DetalleTarea } from "../tareas/detalle-tarea";
import { alternarCompletadaAction, crearTareaPersonal } from "../tareas/acciones";
import { crearReunionAction } from "./acciones";

const VISTA_KEY = "orbita.calendario.vista";
const DIAS = ["L", "M", "X", "J", "V", "S", "D"] as const;
const MAX_MES = 3;
const HORA_INICIO = 7;
const HORA_FIN = 22;
const PX_POR_HORA = 72;
const ALTURA_REJILLA = (HORA_FIN - HORA_INICIO) * PX_POR_HORA;
const MIN_BLOQUE_PX = 40;
const HORAS = Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => HORA_INICIO + i);

type ModoVista = "semana" | "mes";
type SlotCrear = { ymd: string; horaMin: number | null };

function leerModo(): ModoVista {
  if (typeof window === "undefined") return "semana";
  try {
    const v = window.localStorage.getItem(VISTA_KEY);
    return v === "mes" ? "mes" : "semana";
  } catch {
    return "semana";
  }
}

function aTareaParaAgenda(t: TareaUsuario): TareaParaAgenda {
  return {
    id: t.id,
    nombre: t.nombre,
    fechaMaxima: t.fechaMaxima,
    proyectoId: t.proyectoId,
    esPersonal: t.esPersonal,
    proyectoEtiqueta: t.proyectoEtiqueta,
    clienteNombre: t.clienteNombre,
    completada: Boolean(t.completadaEl),
  };
}

function zonaHorariaLocal(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid";
  } catch {
    return "Europe/Madrid";
  }
}

function botonHref(item: ReunionAgenda): { href: string; etiqueta: string } | null {
  if (item.enlaceReunion) return { href: item.enlaceReunion, etiqueta: "Unirse" };
  if (item.htmlLink) return { href: item.htmlLink, etiqueta: "Abrir" };
  return null;
}

function ItemReunion({ item, compacto }: { item: ReunionAgenda; compacto?: boolean }) {
  if (compacto) {
    const hora = item.todoElDia || !item.inicio ? null : horaCorta(item.inicio);
    return (
      <div className="flex items-center gap-1 min-w-0 overflow-hidden text-[12px] leading-snug">
        {hora ? (
          <span className="shrink-0 font-mono text-apagado tabular-nums">{hora}</span>
        ) : null}
        <span className="min-w-0 flex-1 truncate font-medium" title={item.titulo}>
          {item.titulo}
        </span>
      </div>
    );
  }
  const hora = item.todoElDia ? "Todo el día" : horaCorta(item.inicio);
  const btn = botonHref(item);
  return (
    <div className="flex items-start gap-2 min-w-0 text-[14px]">
      <span className="shrink-0 font-mono text-apagado tabular-nums w-[3.75rem]">
        {hora ?? "—"}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium" title={item.titulo}>
        {item.titulo}
      </span>
      {btn ? (
        <a
          href={btn.href}
          target="_blank"
          rel="noopener noreferrer"
          className="boton-sec text-[12px] px-2 py-0.5 shrink-0 rounded"
          onClick={(e) => e.stopPropagation()}
        >
          {btn.etiqueta}
        </a>
      ) : null}
    </div>
  );
}

function ItemTarea({
  item,
  onToggle,
  onAbrir,
  pending,
  compacto,
}: {
  item: TareaAgenda;
  onToggle: (id: string) => void;
  onAbrir: (id: string) => void;
  pending: boolean;
  compacto?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 min-w-0 overflow-hidden ${
        compacto ? "text-[12px] leading-snug" : "text-[14px] items-start gap-2"
      } ${item.completada ? "opacity-70" : ""}`}
    >
      <input
        type="checkbox"
        checked={item.completada}
        disabled={pending}
        onChange={() => onToggle(item.id)}
        onClick={(e) => e.stopPropagation()}
        className={`accent-[var(--magenta)] shrink-0 ${compacto ? "size-3.5" : "mt-0.5 size-4"}`}
        aria-label={item.completada ? "Reabrir tarea" : "Completar tarea"}
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAbrir(item.id);
        }}
        className={`min-w-0 flex-1 truncate text-left hover:text-magenta-texto ${
          item.completada ? "line-through text-apagado" : "font-medium"
        }`}
        title={item.nombre}
      >
        {!compacto && item.atrasada && !item.completada ? (
          <span className="text-mal font-semibold mr-1">Atrasada</span>
        ) : null}
        {item.nombre}
        {!compacto ? (
          <span className="text-apagado font-normal"> · {item.proyectoEtiqueta}</span>
        ) : null}
      </button>
    </div>
  );
}

function ListaDia({
  items,
  onToggle,
  onAbrir,
  onVerMas,
  pending,
  compacto,
  max,
}: {
  items: ItemAgenda[];
  onToggle: (id: string) => void;
  onAbrir: (id: string) => void;
  onVerMas?: () => void;
  pending: boolean;
  compacto?: boolean;
  max?: number;
}) {
  const visibles = max != null ? items.slice(0, max) : items;
  const resto = max != null ? items.length - visibles.length : 0;
  return (
    <ul className="grid gap-1 min-w-0 overflow-hidden w-full">
      {visibles.map((it) => (
        <li key={`${it.tipo}-${it.id}`} className="min-w-0 overflow-hidden">
          {it.tipo === "reunion" ? (
            <ItemReunion item={it} compacto={compacto} />
          ) : (
            <ItemTarea
              item={it}
              onToggle={onToggle}
              onAbrir={onAbrir}
              pending={pending}
              compacto={compacto}
            />
          )}
        </li>
      ))}
      {resto > 0 ? (
        <li className="min-w-0">
          <button
            type="button"
            className="text-[12px] text-magenta-texto font-medium hover:underline truncate"
            onClick={(e) => {
              e.stopPropagation();
              onVerMas?.();
            }}
          >
            +{resto} más
          </button>
        </li>
      ) : null}
    </ul>
  );
}

function ModalDiaCompleto({
  ymd,
  items,
  onCerrar,
  onToggle,
  onAbrir,
  onCrear,
  pending,
}: {
  ymd: string;
  items: ItemAgenda[];
  onCerrar: () => void;
  onToggle: (id: string) => void;
  onAbrir: (id: string) => void;
  onCrear: () => void;
  pending: boolean;
}) {
  const d = new Date(`${ymd}T12:00:00`);
  const titulo = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center p-3 sm:p-4 bg-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dia-completo-titulo"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-md max-h-[calc(100svh-3rem)] overflow-hidden rounded-[12px] bg-papel border border-linea-fuerte shadow-suave p-5 grid gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2
              id="dia-completo-titulo"
              className="font-display font-bold text-[17px] capitalize"
            >
              {titulo}
            </h2>
            <p className="text-[12px] text-apagado mt-0.5">
              {items.length} {items.length === 1 ? "elemento" : "elementos"}
            </p>
          </div>
          <button
            type="button"
            className="text-[13px] text-apagado hover:text-ink"
            onClick={onCerrar}
          >
            Cerrar
          </button>
        </div>

        <div className="overflow-y-auto min-h-0 max-h-[55vh] pr-0.5">
          {items.length === 0 ? (
            <p className="text-[13px] text-apagado">Nada en este día.</p>
          ) : (
            <ListaDia
              items={items}
              onToggle={onToggle}
              onAbrir={(id) => {
                onAbrir(id);
                onCerrar();
              }}
              pending={pending}
            />
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1 border-t border-linea">
          <button
            type="button"
            className="text-[13px] rounded-lg px-3 py-1.5 bg-magenta text-white font-medium"
            onClick={() => {
              onCerrar();
              onCrear();
            }}
          >
            Crear…
          </button>
        </div>
      </div>
    </div>
  );
}

function partirDia(items: ItemAgenda[]): {
  franja: ItemAgenda[];
  timed: ReunionAgenda[];
} {
  const franja: ItemAgenda[] = [];
  const timed: ReunionAgenda[] = [];
  for (const it of items) {
    if (it.tipo === "tarea") franja.push(it);
    else if (it.todoElDia || !it.inicio) franja.push(it);
    else timed.push(it);
  }
  return { franja, timed };
}

function layoutBloque(item: ReunionAgenda): { top: number; height: number } | null {
  if (!item.inicio) return null;
  const startMin = minutosDelDia(item.inicio);
  if (startMin == null) return null;
  const endMin =
    item.fin != null ? (minutosDelDia(item.fin) ?? startMin + 60) : startMin + 60;

  const ventanaInicio = HORA_INICIO * 60;
  const ventanaFin = HORA_FIN * 60;
  const clampedStart = Math.max(startMin, ventanaInicio);
  const clampedEnd = Math.min(Math.max(endMin, clampedStart + 15), ventanaFin);
  if (clampedStart >= ventanaFin || clampedEnd <= ventanaInicio) return null;

  const top = ((clampedStart - ventanaInicio) / 60) * PX_POR_HORA;
  const height = Math.max(
    ((clampedEnd - clampedStart) / 60) * PX_POR_HORA,
    MIN_BLOQUE_PX,
  );
  return { top, height };
}

type DatosCrearReunion = {
  titulo: string;
  horaInicio: string; // HH:MM
  horaFin: string;
  invitados: string[];
  notificarInvitados: boolean;
};

function minAHora(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function horaAMin(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function ModalCrear({
  slot,
  equipo,
  yoId,
  onCerrar,
  onCrearTarea,
  onCrearReunion,
  pending,
  error,
}: {
  slot: SlotCrear;
  equipo: PersonaEquipo[];
  yoId: string;
  onCerrar: () => void;
  onCrearTarea: (titulo: string) => void;
  onCrearReunion: (datos: DatosCrearReunion) => void;
  pending: boolean;
  error: string | null;
}) {
  const inicioDefault = minAHora(slot.horaMin ?? 10 * 60);
  const finDefault = minAHora((slot.horaMin ?? 10 * 60) + 60);
  const [tipo, setTipo] = useState<"tarea" | "reunion">("tarea");
  const [titulo, setTitulo] = useState("");
  const [horaInicio, setHoraInicio] = useState(inicioDefault);
  const [horaFin, setHoraFin] = useState(finDefault);
  const [invitados, setInvitados] = useState<string[]>([]);
  const [emailExtra, setEmailExtra] = useState("");
  const [mostrarEquipo, setMostrarEquipo] = useState(false);
  const [notificarInvitados, setNotificarInvitados] = useState(true);

  const equipoInvitable = equipo.filter(
    (p) => p.id !== yoId && p.email?.trim() && !invitados.includes(p.email.trim().toLowerCase()),
  );

  function anadirEmail(raw: string) {
    const email = raw.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    setInvitados((prev) => (prev.includes(email) ? prev : [...prev, email]));
    setEmailExtra("");
  }

  function confirmar() {
    if (!titulo.trim() || pending) return;
    if (tipo === "tarea") {
      onCrearTarea(titulo);
      return;
    }
    onCrearReunion({
      titulo,
      horaInicio,
      horaFin,
      invitados,
      notificarInvitados,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center p-3 sm:p-4 bg-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crear-agenda-titulo"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-md max-h-[calc(100svh-3rem)] overflow-y-auto rounded-[12px] bg-papel border border-linea-fuerte shadow-suave p-5 grid gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 id="crear-agenda-titulo" className="font-display font-bold text-[17px]">
              Crear en agenda
            </h2>
            <p className="text-[12.5px] text-apagado mt-0.5">{slot.ymd}</p>
          </div>
          <button
            type="button"
            className="text-[13px] text-apagado hover:text-ink"
            onClick={onCerrar}
          >
            Cerrar
          </button>
        </div>

        <div className="flex gap-1.5" role="group" aria-label="Tipo">
          <button
            type="button"
            className={`flex-1 text-[13px] py-1.5 rounded-lg border font-medium transition ${
              tipo === "tarea"
                ? "bg-magenta text-white border-magenta shadow-suave"
                : "border-linea hover:border-magenta-borde hover:bg-magenta-suave"
            }`}
            onClick={() => setTipo("tarea")}
          >
            Tarea
          </button>
          <button
            type="button"
            className={`flex-1 text-[13px] py-1.5 rounded-lg border font-medium transition ${
              tipo === "reunion"
                ? "bg-magenta text-white border-magenta shadow-suave"
                : "border-linea hover:border-magenta-borde hover:bg-magenta-suave"
            }`}
            onClick={() => setTipo("reunion")}
          >
            Reunión
          </button>
        </div>

        <label className="grid gap-1">
          <span className="etiqueta">Título</span>
          <input
            autoFocus
            className="border border-linea rounded-lg px-3 py-2 text-[14px] bg-papel"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={tipo === "tarea" ? "Nombre de la tarea" : "Nombre de la reunión"}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmar();
            }}
          />
        </label>

        {tipo === "tarea" ? (
          <p className="text-[12px] text-apagado">
            Se crea como tarea personal con fecha máxima {slot.ymd}.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1">
                <span className="etiqueta">Inicio</span>
                <input
                  type="time"
                  className="border border-linea rounded-lg px-3 py-2 text-[14px] bg-papel"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                />
              </label>
              <label className="grid gap-1">
                <span className="etiqueta">Fin</span>
                <input
                  type="time"
                  className="border border-linea rounded-lg px-3 py-2 text-[14px] bg-papel"
                  value={horaFin}
                  onChange={(e) => setHoraFin(e.target.value)}
                />
              </label>
            </div>

            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="etiqueta">Invitados</span>
                <button
                  type="button"
                  className="text-[12px] text-magenta-texto hover:underline"
                  onClick={() => setMostrarEquipo((v) => !v)}
                >
                  {mostrarEquipo ? "Ocultar equipo" : "Añadir del equipo"}
                </button>
              </div>

              {invitados.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {invitados.map((email) => (
                    <li
                      key={email}
                      className="inline-flex items-center gap-1 rounded-full border border-linea bg-suave/50 px-2 py-0.5 text-[12px]"
                    >
                      <span className="truncate max-w-[12rem]">{email}</span>
                      <button
                        type="button"
                        className="text-apagado hover:text-mal"
                        aria-label={`Quitar ${email}`}
                        onClick={() =>
                          setInvitados((prev) => prev.filter((e) => e !== email))
                        }
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {mostrarEquipo && equipoInvitable.length > 0 ? (
                <ul className="max-h-28 overflow-y-auto rounded-lg border border-linea divide-y divide-linea">
                  {equipoInvitable.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="w-full text-left px-2.5 py-1.5 text-[13px] hover:bg-fila-hover rounded-md transition"
                        onClick={() => anadirEmail(p.email)}
                      >
                        <span className="font-medium">{p.nombre}</span>
                        <span className="text-apagado text-[12px] block truncate">
                          {p.email}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="flex gap-1.5">
                <input
                  type="email"
                  className="flex-1 min-w-0 border border-linea rounded-lg px-3 py-2 text-[13px] bg-papel"
                  placeholder="email@ejemplo.com"
                  value={emailExtra}
                  onChange={(e) => setEmailExtra(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      anadirEmail(emailExtra);
                    }
                  }}
                />
                <button
                  type="button"
                  className="boton-sec shrink-0 text-[12px] px-2.5 py-1.5"
                  onClick={() => anadirEmail(emailExtra)}
                >
                  Añadir
                </button>
              </div>

              {invitados.length > 0 ? (
                <label className="flex items-start gap-2 text-[12.5px] cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-[var(--magenta)]"
                    checked={notificarInvitados}
                    onChange={(e) => setNotificarInvitados(e.target.checked)}
                  />
                  <span>
                    Enviar invitación por correo (Google Calendar).
                    {!notificarInvitados ? (
                      <span className="text-apagado block">
                        El evento se crea sin notificar a los invitados.
                      </span>
                    ) : null}
                  </span>
                </label>
              ) : (
                <p className="text-[11px] text-apagado">
                  Añade al menos un invitado (distinto de ti) para que Google envíe el correo.
                </p>
              )}
            </div>
          </>
        )}

        {error ? <p className="text-[13px] text-mal">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            className="boton-sec text-[13px] px-3 py-1.5"
            onClick={onCerrar}
            disabled={pending}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="boton text-[13px] px-3 py-1.5 disabled:opacity-50"
            disabled={pending || !titulo.trim()}
            onClick={confirmar}
          >
            {pending ? "Creando…" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}

function VistaSemanaRejilla({
  dias,
  porDia,
  hoyYmd,
  onToggle,
  onAbrir,
  onCrearSlot,
  onVerDia,
  pending,
}: {
  dias: string[];
  porDia: Map<string, ItemAgenda[]>;
  hoyYmd: string;
  onToggle: (id: string) => void;
  onAbrir: (id: string) => void;
  onCrearSlot: (slot: SlotCrear) => void;
  onVerDia: (ymd: string) => void;
  pending: boolean;
}) {
  const ahora = new Date();
  const ahoraMin = ahora.getHours() * 60 + ahora.getMinutes();
  const mostrarAhora =
    toYmd(ahora) === hoyYmd &&
    ahoraMin >= HORA_INICIO * 60 &&
    ahoraMin < HORA_FIN * 60;
  const ahoraTop = ((ahoraMin - HORA_INICIO * 60) / 60) * PX_POR_HORA;

  function clickHueco(ymd: string, e: MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("[data-evento]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutosDesdeInicio =
      (Math.max(0, Math.min(ALTURA_REJILLA - 1, y)) / PX_POR_HORA) * 60;
    const totalMin = HORA_INICIO * 60 + minutosDesdeInicio;
    const redondeado = Math.round(totalMin / 30) * 30;
    onCrearSlot({ ymd, horaMin: redondeado });
  }

  return (
    <div className="rounded-lg border border-linea bg-papel overflow-x-auto">
      <div className="min-w-[820px]">
        <div
          className="grid border-b border-linea"
          style={{ gridTemplateColumns: "3.75rem repeat(7, minmax(0, 1fr))" }}
        >
          <div className="border-r border-linea" />
          {dias.map((ymd, i) => {
            const esHoy = ymd === hoyYmd;
            const d = new Date(`${ymd}T12:00:00`);
            return (
              <div
                key={ymd}
                className={`px-2 py-2.5 text-center border-r border-linea last:border-r-0 ${
                  esHoy ? "bg-magenta/5" : ""
                }`}
              >
                <span className="text-[12px] font-semibold uppercase tracking-wide text-apagado block">
                  {DIAS[i]}
                </span>
                <span
                  className={`inline-flex items-center justify-center size-8 rounded-full font-mono text-[15px] mt-0.5 ${
                    esHoy ? "bg-magenta text-white font-bold" : ""
                  }`}
                >
                  {d.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        <div
          className="grid border-b border-linea"
          style={{ gridTemplateColumns: "3.75rem repeat(7, minmax(0, 1fr))" }}
        >
          <div className="border-r border-linea px-1 py-2 text-[11px] text-apagado leading-tight">
            Todo el día
          </div>
          {dias.map((ymd) => {
            const { franja } = partirDia(porDia.get(ymd) ?? []);
            const esHoy = ymd === hoyYmd;
            return (
              <div
                key={ymd}
                role="button"
                tabIndex={0}
                aria-label={`Crear el ${ymd}`}
                className={`min-h-[72px] max-h-[120px] overflow-y-auto overflow-x-hidden border-r border-linea last:border-r-0 p-2 cursor-pointer hover:bg-fila-hover ${
                  esHoy ? "bg-magenta/5" : ""
                }`}
                onClick={() => onCrearSlot({ ymd, horaMin: null })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onCrearSlot({ ymd, horaMin: null });
                }}
              >
                {franja.length > 0 ? (
                  <ListaDia
                    items={franja}
                    onToggle={onToggle}
                    onAbrir={onAbrir}
                    onVerMas={() => onVerDia(ymd)}
                    pending={pending}
                    compacto
                    max={4}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        <div
          className="grid"
          style={{ gridTemplateColumns: "3.75rem repeat(7, minmax(0, 1fr))" }}
        >
          <div className="relative border-r border-linea" style={{ height: ALTURA_REJILLA }}>
            {HORAS.map((h) => (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-linea/70"
                style={{ top: (h - HORA_INICIO) * PX_POR_HORA }}
              >
                <span className="absolute -top-2.5 left-0.5 font-mono text-[11px] text-apagado tabular-nums">
                  {String(h).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {dias.map((ymd) => {
            const { timed } = partirDia(porDia.get(ymd) ?? []);
            const esHoy = ymd === hoyYmd;
            return (
              <div
                key={ymd}
                role="button"
                tabIndex={0}
                aria-label={`Añadir en ${ymd}`}
                className={`relative border-r border-linea last:border-r-0 cursor-pointer hover:bg-fila-hover ${
                  esHoy ? "bg-magenta/[0.03]" : ""
                }`}
                style={{ height: ALTURA_REJILLA }}
                onClick={(e) => clickHueco(ymd, e)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onCrearSlot({ ymd, horaMin: HORA_INICIO * 60 });
                }}
              >
                {HORAS.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-linea/50 pointer-events-none"
                    style={{ top: (h - HORA_INICIO) * PX_POR_HORA, height: PX_POR_HORA }}
                  />
                ))}

                {esHoy && mostrarAhora ? (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none"
                    style={{ top: ahoraTop }}
                  >
                    <div className="h-0.5 bg-mal relative">
                      <span className="absolute -left-1 -top-1 size-2.5 rounded-full bg-mal" />
                    </div>
                  </div>
                ) : null}

                {timed.map((ev) => {
                  const lay = layoutBloque(ev);
                  if (!lay) return null;
                  const btn = botonHref(ev);
                  const horaIni = horaCorta(ev.inicio);
                  const horaFin = ev.fin ? horaCorta(ev.fin) : null;
                  const compacto = lay.height < 52;
                  const rango =
                    horaIni && horaFin ? `${horaIni} – ${horaFin}` : horaIni ?? "";
                  return (
                    <div
                      key={ev.id}
                      data-evento
                      className="absolute left-1 right-1 z-10 box-border rounded-md border border-magenta/40 bg-[#fdf2f8] px-2 overflow-hidden shadow-sm"
                      style={{
                        top: lay.top,
                        height: lay.height,
                        paddingTop: compacto ? 5 : 7,
                        paddingBottom: 4,
                      }}
                      title={`${rango} ${ev.titulo}`.trim()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-start gap-1 min-w-0 h-full">
                        <div className="min-w-0 flex-1 overflow-hidden">
                          {compacto ? (
                            <p className="font-semibold text-[12px] text-ink truncate leading-none">
                              {horaIni ? (
                                <span className="font-mono font-normal text-apagado tabular-nums mr-1">
                                  {horaIni}
                                </span>
                              ) : null}
                              {ev.titulo}
                            </p>
                          ) : (
                            <>
                              <p className="font-semibold text-[13px] text-ink truncate leading-tight">
                                {ev.titulo}
                              </p>
                              {rango ? (
                                <p className="font-mono text-[11px] text-apagado tabular-nums mt-0.5 leading-none truncate">
                                  {rango}
                                </p>
                              ) : null}
                            </>
                          )}
                        </div>
                        {btn && lay.height >= 44 ? (
                          <a
                            href={btn.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-[11px] font-medium text-magenta-texto underline leading-none pt-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {btn.etiqueta}
                          </a>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export type FlagsProyectoUi = {
  puedeGestionarProyecto: boolean;
  puedeCambiarSolicitante: boolean;
};

export function VistaCalendario({
  tareasIniciales,
  equipo,
  yoId,
  personalProyectoId,
  colaboradorIdsPorProyecto,
  flagsPorProyecto = {},
}: {
  tareasIniciales: TareaUsuario[];
  equipo: PersonaEquipo[];
  yoId: string;
  personalProyectoId: string;
  colaboradorIdsPorProyecto: Record<string, string[]>;
  flagsPorProyecto?: Record<string, FlagsProyectoUi>;
}) {
  const hoy = useMemo(() => new Date(), []);
  const hoyYmd = toYmd(hoy);
  const [modo, setModo] = useState<ModoVista>("semana");
  const [ancla, setAncla] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
  const [tareas, setTareas] = useState(tareasIniciales);
  const [eventos, setEventos] = useState<EventoGoogleListado[]>([]);
  const [googleEstado, setGoogleEstado] = useState<"idle" | "cargando" | "sin_tokens" | "error">(
    "idle",
  );
  const [pending, startTransition] = useTransition();
  const [tareaAbiertaId, setTareaAbiertaId] = useState<string | null>(null);
  const [slotCrear, setSlotCrear] = useState<SlotCrear | null>(null);
  const [crearError, setCrearError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [avisoAgenda, setAvisoAgenda] = useState<string | null>(null);
  const [diaExpandido, setDiaExpandido] = useState<string | null>(null);

  useEffect(() => {
    setModo(leerModo());
  }, []);

  function cambiarModo(m: ModoVista) {
    setModo(m);
    try {
      window.localStorage.setItem(VISTA_KEY, m);
    } catch {
      /* ignore */
    }
  }

  const rango = useMemo(() => {
    if (modo === "semana") {
      return { from: inicioSemana(ancla), to: finSemana(ancla) };
    }
    return rangoMes(ancla.getFullYear(), ancla.getMonth());
  }, [modo, ancla]);

  useEffect(() => {
    let cancelado = false;
    setGoogleEstado("cargando");
    const timeMin = rango.from.toISOString();
    const timeMax = rango.to.toISOString();
    fetch(
      `/api/calendar/google?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`,
    )
      .then(async (res) => {
        const data = (await res.json()) as {
          error?: string;
          eventos?: EventoGoogleListado[];
        };
        if (cancelado) return;
        if (data.error === "sin_tokens") {
          setEventos([]);
          setGoogleEstado("sin_tokens");
          return;
        }
        if (!res.ok || data.error === "calendar_fallo") {
          setEventos([]);
          setGoogleEstado("error");
          return;
        }
        setEventos(data.eventos ?? []);
        setGoogleEstado("idle");
      })
      .catch(() => {
        if (cancelado) return;
        setEventos([]);
        setGoogleEstado("error");
      });
    return () => {
      cancelado = true;
    };
  }, [rango.from, rango.to]);

  const paraAgenda = useMemo(() => tareas.map(aTareaParaAgenda), [tareas]);
  const porDia = useMemo(
    () => agruparPorDia(paraAgenda, eventos, { hoyYmd }),
    [paraAgenda, eventos, hoyYmd],
  );

  const tareaAbierta = tareas.find((t) => t.id === tareaAbiertaId) ?? null;

  function toggleTarea(id: string) {
    const prev = tareas;
    setTareas((lista) =>
      lista.map((t) =>
        t.id === id
          ? { ...t, completadaEl: t.completadaEl ? null : new Date().toISOString() }
          : t,
      ),
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
        lista.map((t) => (t.id === id ? { ...t, completadaEl: r.tarea.completadaEl } : t)),
      );
    });
  }

  function actualizarTareaLocal(tarea: Tarea) {
    setTareas((prev) =>
      prev.map((x) =>
        x.id === tarea.id
          ? {
              ...x,
              ...tarea,
              proyectoEtiqueta: x.proyectoEtiqueta,
              clienteNombre: x.clienteNombre,
              esPersonal: x.esPersonal,
            }
          : x,
      ),
    );
  }

  async function crearTareaDesdeSlot(titulo: string) {
    if (!slotCrear) return;
    setCreando(true);
    setCrearError(null);
    const fd = new FormData();
    fd.set("nombre", titulo.trim());
    fd.set("fecha_maxima", slotCrear.ymd);
    fd.set("sync_calendar", "on");
    const r = await crearTareaPersonal(fd);
    setCreando(false);
    if (!r.ok) {
      setCrearError(
        r.motivo === "falta_dato" ? "Escribe un título." : "No se pudo crear la tarea.",
      );
      return;
    }
    const nueva =
      r.tareas.find((t) => t.id === r.tarea.id) ??
      ({
        ...r.tarea,
        proyectoEtiqueta: "Personal",
        clienteNombre: null,
        esPersonal: true,
        columnaFija: true,
        columnaNombre: "Por hacer",
      } satisfies TareaUsuario);
    setTareas((prev) => [nueva, ...prev.filter((t) => t.id !== nueva.id)]);
    setSlotCrear(null);
    setTareaAbiertaId(nueva.id);
  }

  async function crearReunionDesdeSlot(datos: DatosCrearReunion) {
    if (!slotCrear) return;
    setCreando(true);
    setCrearError(null);
    const iniMin = horaAMin(datos.horaInicio);
    const finMin = horaAMin(datos.horaFin);
    if (iniMin == null || finMin == null || finMin <= iniMin) {
      setCreando(false);
      setCrearError("Revisa la hora de inicio y fin.");
      return;
    }
    const [yy, mm, dd] = slotCrear.ymd.split("-").map(Number);
    const inicio = new Date(
      yy,
      mm - 1,
      dd,
      Math.floor(iniMin / 60),
      iniMin % 60,
      0,
      0,
    );
    const fin = new Date(
      yy,
      mm - 1,
      dd,
      Math.floor(finMin / 60),
      finMin % 60,
      0,
      0,
    );
    const r = await crearReunionAction({
      titulo: datos.titulo.trim(),
      inicioIso: inicio.toISOString(),
      finIso: fin.toISOString(),
      timeZone: zonaHorariaLocal(),
      invitados: datos.invitados,
      notificarInvitados: datos.notificarInvitados,
    });
    setCreando(false);
    if (!r.ok) {
      const msg =
        r.motivo === "sin_tokens"
          ? "No hay tokens de Google. Vuelve a iniciar sesión para crear reuniones."
          : r.motivo === "sin_titulo"
            ? "Escribe un título."
            : r.motivo === "rango_invalido"
              ? "Revisa la hora de inicio y fin."
              : "No se pudo crear la reunión.";
      setCrearError(msg);
      return;
    }
    setEventos((prev) => [...prev, r.evento]);
    setSlotCrear(null);
    const n = r.invitadosConfirmados.length;
    if (datos.invitados.length > 0 && n === 0) {
      setAvisoAgenda(
        "Reunión creada, pero Google no registró invitados (¿te autoinvitaste?). Prueba otro correo.",
      );
    } else if (r.notificado) {
      setAvisoAgenda(
        `Reunión creada. Google envía la invitación a ${n} ${n === 1 ? "correo" : "correos"} (revisa spam si no llega).`,
      );
    } else if (n > 0) {
      setAvisoAgenda("Reunión creada con invitados, sin enviar correo.");
    } else {
      setAvisoAgenda("Reunión creada.");
    }
  }

  function irHoy() {
    setAncla(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
  }

  function anterior() {
    setAncla((a) => {
      const d = new Date(a);
      if (modo === "semana") d.setDate(d.getDate() - 7);
      else d.setMonth(d.getMonth() - 1);
      return d;
    });
  }

  function siguiente() {
    setAncla((a) => {
      const d = new Date(a);
      if (modo === "semana") d.setDate(d.getDate() + 7);
      else d.setMonth(d.getMonth() + 1);
      return d;
    });
  }

  const titulo =
    modo === "semana"
      ? (() => {
          const ini = inicioSemana(ancla);
          const fin = finSemana(ancla);
          const fmt = new Intl.DateTimeFormat("es-ES", {
            day: "numeric",
            month: "short",
          });
          return `${fmt.format(ini)} – ${fmt.format(fin)}`;
        })()
      : new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(
          new Date(ancla.getFullYear(), ancla.getMonth(), 1),
        );

  const diasSemana = useMemo(
    () => (modo === "semana" ? diasDeSemana(inicioSemana(ancla)) : []),
    [modo, ancla],
  );

  const celdas = useMemo(
    () => (modo === "mes" ? celdasMes(ancla.getFullYear(), ancla.getMonth()) : []),
    [modo, ancla],
  );

  const btnModo = "chip text-[13px] px-3 py-1.5 border";
  const btnModoActivo = "activo";
  const btnModoInactivo = "border-linea bg-papel text-tinta";

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="segmentado" role="group" aria-label="Vista">
          <button
            type="button"
            className={`${btnModo} ${modo === "semana" ? btnModoActivo : btnModoInactivo}`}
            onClick={() => cambiarModo("semana")}
            aria-pressed={modo === "semana"}
          >
            Semana
          </button>
          <button
            type="button"
            className={`${btnModo} ${modo === "mes" ? btnModoActivo : btnModoInactivo}`}
            onClick={() => cambiarModo("mes")}
            aria-pressed={modo === "mes"}
          >
            Mes
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-display font-bold text-[19px] tracking-tight capitalize min-w-0">
            {titulo}
          </p>
          <button
            type="button"
            className="boton-sec text-[13px] px-3 py-1.5"
            onClick={irHoy}
          >
            Hoy
          </button>
          <button
            type="button"
            aria-label="Anterior"
            className="boton-sec h-9 w-9 p-0 grid place-items-center text-[16px]"
            onClick={anterior}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Siguiente"
            className="boton-sec h-9 w-9 p-0 grid place-items-center text-[16px]"
            onClick={siguiente}
          >
            ›
          </button>
        </div>
      </div>

      {avisoAgenda ? (
        <p className="text-[13px] rounded-lg border border-linea-fuerte bg-suave/40 px-3 py-2 flex items-start justify-between gap-2">
          <span>{avisoAgenda}</span>
          <button
            type="button"
            className="shrink-0 text-apagado hover:text-ink text-[12px]"
            onClick={() => setAvisoAgenda(null)}
          >
            Cerrar
          </button>
        </p>
      ) : null}

      {googleEstado === "sin_tokens" ? (
        <p className="text-[12.5px] text-apagado">
          No hay tokens de Google. Vuelve a iniciar sesión con Google para ver y crear reuniones.
        </p>
      ) : null}
      {googleEstado === "error" ? (
        <p className="text-[12.5px] text-apagado">No se pudo cargar Google Calendar.</p>
      ) : null}
      {googleEstado === "cargando" ? (
        <p className="text-[12.5px] text-apagado">Cargando Google…</p>
      ) : null}

      {modo === "semana" ? (
        <VistaSemanaRejilla
          dias={diasSemana}
          porDia={porDia}
          hoyYmd={hoyYmd}
          onToggle={toggleTarea}
          onAbrir={setTareaAbiertaId}
          onCrearSlot={(s) => {
            setCrearError(null);
            setSlotCrear(s);
          }}
          onVerDia={setDiaExpandido}
          pending={pending}
        />
      ) : (
        <div className="rounded-[10px] border border-linea-fuerte bg-papel p-3 sm:p-4 shadow-suave">
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {DIAS.map((d) => (
              <div
                key={d}
                className="text-[12px] font-semibold uppercase tracking-wide text-apagado text-center py-1.5"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {celdas.map((c) => {
              const items = porDia.get(c.ymd) ?? [];
              const esHoy = c.ymd === hoyYmd;
              return (
                <div
                  key={c.ymd}
                  role="button"
                  tabIndex={0}
                  aria-label={`Ver el ${c.ymd}`}
                  className={`min-h-[120px] min-w-0 overflow-hidden rounded-md border p-1.5 flex flex-col gap-1 cursor-pointer hover:border-magenta-borde ${
                    !c.enMes
                      ? "border-transparent opacity-40"
                      : esHoy
                        ? "border-magenta bg-magenta/5"
                        : "border-linea bg-suave/20"
                  }`}
                  onClick={() => {
                    if (!c.enMes) return;
                    setDiaExpandido(c.ymd);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && c.enMes) {
                      setDiaExpandido(c.ymd);
                    }
                  }}
                >
                  <span
                    className={`font-mono text-[13px] self-end shrink-0 ${
                      esHoy ? "text-magenta-texto font-bold" : "text-apagado"
                    }`}
                  >
                    {c.dia}
                  </span>
                  {items.length > 0 ? (
                    <ListaDia
                      items={items}
                      onToggle={toggleTarea}
                      onAbrir={setTareaAbiertaId}
                      onVerMas={() => setDiaExpandido(c.ymd)}
                      pending={pending}
                      compacto
                      max={MAX_MES}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {diaExpandido ? (
        <ModalDiaCompleto
          ymd={diaExpandido}
          items={porDia.get(diaExpandido) ?? []}
          onCerrar={() => setDiaExpandido(null)}
          onToggle={toggleTarea}
          onAbrir={setTareaAbiertaId}
          onCrear={() => {
            setCrearError(null);
            setSlotCrear({ ymd: diaExpandido, horaMin: null });
          }}
          pending={pending}
        />
      ) : null}

      {slotCrear ? (
        <ModalCrear
          slot={slotCrear}
          equipo={equipo}
          yoId={yoId}
          onCerrar={() => {
            setSlotCrear(null);
            setCrearError(null);
          }}
          onCrearTarea={crearTareaDesdeSlot}
          onCrearReunion={crearReunionDesdeSlot}
          pending={creando}
          error={crearError}
        />
      ) : null}

      {tareaAbierta ? (
        <DetalleTarea
          t={tareaAbierta}
          proyectoId={tareaAbierta.proyectoId}
          proyectoColaboradorIds={
            colaboradorIdsPorProyecto[tareaAbierta.proyectoId] ??
            (tareaAbierta.proyectoId === personalProyectoId ? [yoId] : [])
          }
          equipo={equipo}
          yoId={yoId}
          clienteNombre={tareaAbierta.clienteNombre}
          proyectoEtiqueta={tareaAbierta.proyectoEtiqueta}
          puedeGestionarProyecto={
            flagsPorProyecto[tareaAbierta.proyectoId]?.puedeGestionarProyecto ?? false
          }
          puedeCambiarSolicitante={
            flagsPorProyecto[tareaAbierta.proyectoId]?.puedeCambiarSolicitante ?? false
          }
          onCerrar={() => setTareaAbiertaId(null)}
          onGuardar={actualizarTareaLocal}
          onBorrar={(tareaId) => {
            setTareas((prev) => prev.filter((x) => x.id !== tareaId));
          }}
          onChecklistAdd={(tareaId, item) => {
            setTareas((prev) =>
              prev.map((x) =>
                x.id === tareaId ? { ...x, checklist: [...x.checklist, item] } : x,
              ),
            );
          }}
          onChecklistToggle={(tareaId, item) => {
            setTareas((prev) =>
              prev.map((x) =>
                x.id === tareaId
                  ? {
                      ...x,
                      checklist: x.checklist.map((c) => (c.id === item.id ? item : c)),
                    }
                  : x,
              ),
            );
          }}
          startTransition={startTransition}
        />
      ) : null}
    </div>
  );
}
