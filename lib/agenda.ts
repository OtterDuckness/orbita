import type { EventoGoogleListado } from "@/lib/google-calendar";
import { ZONA } from "@/lib/formato";

export type ReunionAgenda = {
  tipo: "reunion";
  id: string;
  titulo: string;
  dia: string;
  inicio: string | null;
  fin: string | null;
  todoElDia: boolean;
  enlaceReunion: string | null;
  htmlLink: string | null;
  ubicacion: string | null;
};

export type TareaAgenda = {
  tipo: "tarea";
  id: string;
  nombre: string;
  dia: string;
  proyectoId: string;
  esPersonal: boolean;
  proyectoEtiqueta: string;
  clienteNombre: string | null;
  completada: boolean;
  atrasada: boolean;
};

export type ItemAgenda = ReunionAgenda | TareaAgenda;

export type TareaParaAgenda = {
  id: string;
  nombre: string;
  fechaMaxima: string | null;
  proyectoId: string;
  esPersonal: boolean;
  proyectoEtiqueta: string;
  clienteNombre: string | null;
  completada: boolean;
};

/** Personal → /tareas; resto → tablero del proyecto con modal. */
export function hrefTareaPanel(opts: {
  id: string;
  proyectoId: string;
  esPersonal: boolean;
}): string {
  const id = encodeURIComponent(opts.id);
  if (opts.esPersonal) return `/tareas?tarea=${id}`;
  return `/proyectos/${encodeURIComponent(opts.proyectoId)}?tarea=${id}`;
}

export function toYmd(d: Date, timeZone: string = ZONA): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Resta días a un YMD civil (mediodía UTC, sin DST). */
export function restarDiasYmd(ymd: string, dias: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! - dias, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

/** Lunes de la semana que contiene `d` (hora local). */
export function inicioSemana(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const offset = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - offset);
  return out;
}

export function finSemana(d: Date): Date {
  const out = inicioSemana(d);
  out.setDate(out.getDate() + 6);
  out.setHours(23, 59, 59, 999);
  return out;
}

export function rangoMes(year: number, month: number): { from: Date; to: Date } {
  const from = new Date(year, month, 1, 0, 0, 0, 0);
  const to = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

export function celdasMes(year: number, month: number): { ymd: string; dia: number; enMes: boolean }[] {
  const primero = new Date(year, month, 1);
  const offset = (primero.getDay() + 6) % 7;
  const diasMes = new Date(year, month + 1, 0).getDate();
  const diasPrev = new Date(year, month, 0).getDate();
  const celdas: { ymd: string; dia: number; enMes: boolean }[] = [];

  for (let i = 0; i < offset; i++) {
    const dia = diasPrev - offset + i + 1;
    celdas.push({ ymd: toYmd(new Date(year, month - 1, dia)), dia, enMes: false });
  }
  for (let dia = 1; dia <= diasMes; dia++) {
    celdas.push({ ymd: toYmd(new Date(year, month, dia)), dia, enMes: true });
  }
  let next = 1;
  while (celdas.length % 7 !== 0) {
    celdas.push({ ymd: toYmd(new Date(year, month + 1, next)), dia: next, enMes: false });
    next += 1;
  }
  return celdas;
}

export function diasDeSemana(inicio: Date): string[] {
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    out.push(toYmd(d));
  }
  return out;
}

/** Hoy (siempre) + siguientes días laborables (lun–vie), hasta `total` columnas. */
export function diasLaborablesDesde(inicio: Date, total: number = 7): string[] {
  const out: string[] = [];
  let ymd = toYmd(inicio);
  out.push(ymd);
  while (out.length < total) {
    const [y, m, d] = ymd.split("-").map(Number);
    const next = new Date(Date.UTC(y!, m! - 1, d! + 1, 12, 0, 0));
    ymd = next.toISOString().slice(0, 10);
    const dow = next.getUTCDay();
    if (dow !== 0 && dow !== 6) out.push(ymd);
  }
  return out;
}

export function horaCorta(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

/** Minutos desde medianoche en Europe/Madrid (0–1439). */
export function minutosDelDia(iso: string | Date): number | null {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("es-ES", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value);
  const m = Number(parts.find((p) => p.type === "minute")?.value);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function stampLocalGoogle(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${y}${m}${day}T${h}${min}${s}`;
}

/** URL de plantilla de Google Calendar (crear evento, sin API). */
export function urlCrearEventoGoogle(opts: { inicio: Date; fin: Date; titulo?: string }): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    dates: `${stampLocalGoogle(opts.inicio)}/${stampLocalGoogle(opts.fin)}`,
  });
  if (opts.titulo?.trim()) params.set("text", opts.titulo.trim());
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function esAtrasada(fechaMaxima: string, hoyYmd: string, completada: boolean): boolean {
  return !completada && fechaMaxima < hoyYmd;
}

/**
 * Orden del día:
 * 1) reuniones con hora (por hora de inicio)
 * 2) eventos de todo el día
 * 3) tareas abiertas
 * 4) tareas completadas (tachadas al final)
 */
export function ordenarDia(items: ItemAgenda[]): ItemAgenda[] {
  return [...items].sort((a, b) => {
    const rango = (it: ItemAgenda): number => {
      if (it.tipo === "reunion") return it.todoElDia || !it.inicio ? 1 : 0;
      return it.completada ? 3 : 2;
    };
    const ra = rango(a);
    const rb = rango(b);
    if (ra !== rb) return ra - rb;

    if (a.tipo === "reunion" && b.tipo === "reunion") {
      const ia = a.inicio ?? "";
      const ib = b.inicio ?? "";
      if (ia !== ib) return ia.localeCompare(ib);
      return a.titulo.localeCompare(b.titulo, "es");
    }

    if (a.tipo === "tarea" && b.tipo === "tarea") {
      if (a.atrasada !== b.atrasada) return a.atrasada ? -1 : 1;
      return a.nombre.localeCompare(b.nombre, "es");
    }

    return 0;
  });
}

export function reunionDesdeEvento(e: EventoGoogleListado): ReunionAgenda {
  return {
    tipo: "reunion",
    id: e.id,
    titulo: e.titulo,
    dia: e.diaInicio,
    inicio: e.inicio,
    fin: e.fin,
    todoElDia: e.todoElDia,
    enlaceReunion: e.enlaceReunion,
    htmlLink: e.htmlLink,
    ubicacion: e.ubicacion,
  };
}

function tituloComparable(s: string) {
  return s.replace(/^\s*✓\s*/, "").trim().toLowerCase();
}

function idEnOrbita(id: string, idsOrbita: Set<string>) {
  if (idsOrbita.has(id)) return true;
  const base = id.split("_")[0];
  return Boolean(base) && idsOrbita.has(base);
}

/**
 * Un evento de Google es reunión si no es el all-day que Orbita crea al sincronizar una tarea.
 */
export function esEventoTareaOrbita(
  e: EventoGoogleListado,
  idsOrbita: Set<string>,
  tareas: Pick<TareaParaAgenda, "nombre" | "fechaMaxima">[],
): boolean {
  if (e.origenOrbitaTarea) return true;
  if (idEnOrbita(e.id, idsOrbita)) return true;
  if (e.recurringEventId && idEnOrbita(e.recurringEventId, idsOrbita)) return true;
  if (!e.todoElDia) return false;
  const titulo = tituloComparable(e.titulo);
  if (!titulo) return false;
  return tareas.some(
    (t) => t.fechaMaxima === e.diaInicio && tituloComparable(t.nombre) === titulo,
  );
}

export function filtrarEventosReunion(
  eventos: EventoGoogleListado[],
  idsOrbita: Set<string>,
  tareas: Pick<TareaParaAgenda, "nombre" | "fechaMaxima">[],
): EventoGoogleListado[] {
  return eventos.filter((e) => !esEventoTareaOrbita(e, idsOrbita, tareas));
}

export function tareaDesdeAgenda(t: TareaParaAgenda, hoyYmd: string): TareaAgenda | null {
  if (!t.fechaMaxima) return null;
  return {
    tipo: "tarea",
    id: t.id,
    nombre: t.nombre,
    dia: t.fechaMaxima,
    proyectoId: t.proyectoId,
    esPersonal: t.esPersonal,
    proyectoEtiqueta: t.proyectoEtiqueta,
    clienteNombre: t.clienteNombre,
    completada: t.completada,
    atrasada: esAtrasada(t.fechaMaxima, hoyYmd, t.completada),
  };
}

export function agruparPorDia(
  tareas: TareaParaAgenda[],
  eventos: EventoGoogleListado[],
  opts?: { hoyYmd?: string },
): Map<string, ItemAgenda[]> {
  const hoyYmd = opts?.hoyYmd ?? toYmd(new Date());
  const mapa = new Map<string, ItemAgenda[]>();

  function push(dia: string, item: ItemAgenda) {
    const lista = mapa.get(dia);
    if (lista) lista.push(item);
    else mapa.set(dia, [item]);
  }

  for (const e of eventos) {
    push(e.diaInicio, reunionDesdeEvento(e));
  }
  for (const t of tareas) {
    const item = tareaDesdeAgenda(t, hoyYmd);
    if (item) push(item.dia, item);
  }

  for (const [dia, items] of mapa) {
    mapa.set(dia, ordenarDia(items));
  }
  return mapa;
}

/** Tareas de hoy + las de ayer aún abiertas, para el checklist de Inicio. */
export function tareasParaHoy(
  tareas: TareaParaAgenda[],
  hoyYmd: string = toYmd(new Date()),
): TareaAgenda[] {
  const ayerYmd = restarDiasYmd(hoyYmd, 1);
  const items: TareaAgenda[] = [];
  for (const t of tareas) {
    if (!t.fechaMaxima) continue;
    const esHoy = t.fechaMaxima === hoyYmd;
    const esAyerAbierta = !t.completada && t.fechaMaxima === ayerYmd;
    if (!esHoy && !esAyerAbierta) continue;
    const item = tareaDesdeAgenda(t, hoyYmd);
    if (item) items.push(item);
  }
  return ordenarDia(items).filter((i): i is TareaAgenda => i.tipo === "tarea");
}
