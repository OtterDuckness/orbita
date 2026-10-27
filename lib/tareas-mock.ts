import type { Proyecto } from "./clientes-mock";

export type Prioridad = "baja" | "media" | "alta" | "urgente";

/** Escala 1–5; 5 = más difícil. */
export type Dificultad = 1 | 2 | 3 | 4 | 5;

export type Columna = {
  id: string;
  proyectoId: string;
  nombre: string;
  fija: boolean;
  orden: number;
};

export type NotaTarea = {
  id: string;
  texto: string;
  autorId: string;
  creadoEl: string;
};

export type ItemChecklist = {
  id: string;
  texto: string;
  hecho: boolean;
};

export type Tarea = {
  id: string;
  proyectoId: string;
  columnaId: string;
  nombre: string;
  fechaPrevista: string | null;
  fechaMaxima: string | null;
  syncCalendar: boolean;
  /** Si true, se envía correo a los asignados nuevos (solo lo activa el solicitante). */
  notificarAsignado: boolean;
  calendarEventId: string | null;
  responsableIds: string[];
  mandadaPorId: string | null;
  prioridad: Prioridad;
  dificultad: Dificultad;
  notas: NotaTarea[];
  checklist: ItemChecklist[];
  completadaEl: string | null;
  orden: number;
  creadoEl: string;
};

export const COLUMNAS_FIJAS: { id: string; nombre: string }[] = [
  { id: "por_hacer", nombre: "Por hacer" },
  { id: "en_curso", nombre: "En curso" },
  { id: "en_revision", nombre: "En revisión" },
  { id: "terminadas", nombre: "Terminadas" },
  { id: "rechazadas", nombre: "Rechazadas / eliminadas" },
];

const NOMBRES_FLUJO = COLUMNAS_FIJAS.filter(
  (c) => c.nombre !== "Rechazadas / eliminadas",
).map((c) => c.nombre);

/** Vista del tablero: flujo fijo → custom → Rechazadas. */
export function ordenarColumnasTablero(lista: Columna[]): Columna[] {
  const flujo = NOMBRES_FLUJO.map((nombre) =>
    lista.find((c) => c.fija && c.nombre === nombre),
  ).filter((c): c is Columna => Boolean(c));
  const custom = lista.filter((c) => !c.fija).sort((a, b) => a.orden - b.orden);
  const rechazadas = lista.filter(
    (c) => c.fija && c.nombre === "Rechazadas / eliminadas",
  );
  return [...flujo, ...custom, ...rechazadas];
}

export const PRIORIDADES: Prioridad[] = ["baja", "media", "alta", "urgente"];

export const DIFICULTADES: Dificultad[] = [1, 2, 3, 4, 5];

/** Colores: 1 fácil (verde) → 5 más difícil (rojo). */
export const COLOR_DIFICULTAD: Record<Dificultad, string> = {
  1: "bg-[#16a34a]/15 text-[#15803d] border border-[#16a34a]/40",
  2: "bg-[#65a30d]/15 text-[#4d7c0f] border border-[#65a30d]/45",
  3: "bg-[#d97706]/15 text-[#b45309] border border-[#d97706]/45",
  4: "bg-[#ea580c]/15 text-[#c2410c] border border-[#ea580c]/50",
  5: "bg-mal-boton text-white border border-mal-boton",
};

export type ProyectoVista = Proyecto & {
  /** Título a mostrar: nombre propio, o tipo si no hay nombre. */
  titulo: string;
  tipo: string;
  clienteNombre: string;
  responsableNombre: string | null;
  tareasAbiertas: number;
  /** Preferencia del usuario: aparece en el submenú del sidemenu. */
  esFavorito?: boolean;
  /** Admin, responsable de proyecto/cliente o dueño personal. */
  puedeGestionar?: boolean;
};

/** Enriquece proyectos de BD con nombres y conteo de tareas abiertas. */
export function enriquecerProyectosVista(
  proyectos: Proyecto[],
  nombresTipo?: Map<string, string>,
  nombresPersona?: Map<string, string>,
  nombresCliente?: Map<string, string>,
  tareasAbiertas?: Map<string, number>,
): ProyectoVista[] {
  return proyectos.map((p) => {
    const nombreCuenta = p.clienteId ? nombresCliente?.get(p.clienteId) : undefined;
    const tipo = p.tipoId ? (nombresTipo?.get(p.tipoId) ?? "—") : "—";
    const titulo = (p.nombre?.trim() || tipo || "Proyecto").trim();
    return {
      ...p,
      titulo,
      tipo,
      clienteNombre: nombreCuenta ?? (p.ambito === "interno" ? "Interno" : "—"),
      responsableNombre: p.responsableId ? (nombresPersona?.get(p.responsableId) ?? null) : null,
      tareasAbiertas: tareasAbiertas?.get(p.id) ?? 0,
    };
  });
}

export function inicialesDe(nombre: string | null | undefined): string {
  if (!nombre?.trim()) return "?";
  return nombre
    .split(/\s+/)
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function vencimiento(f: string | null) {
  if (!f) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dia = new Date(`${f}T00:00:00`);
  const dias = Math.round((dia.getTime() - hoy.getTime()) / 86400000);
  if (dias < 0) return { texto: dias === -1 ? "Ayer" : `Hace ${Math.abs(dias)} días`, tarde: true };
  if (dias === 0) return { texto: "Hoy", tarde: true };
  if (dias === 1) return { texto: "Mañana", tarde: false };
  return { texto: `En ${dias} días`, tarde: false };
}
