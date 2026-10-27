"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { PersonaEquipo } from "@/lib/clientes-mock";
import {
  COLOR_DIFICULTAD,
  DIFICULTADES,
  PRIORIDADES,
  inicialesDe,
  vencimiento,
  type Dificultad,
  type Prioridad,
} from "@/lib/tareas-mock";
import type { TareaUsuario } from "@/lib/tablero";
import { useAvisos } from "../avisos-ui";
import { avisoDeMotivo } from "@/lib/avisos";
import { IconoPrioridad } from "../clientes/icono-prioridad";
import { PuntoNovedad } from "../punto-novedad";
import { alternarCompletadaAction, crearTareaPersonal } from "./acciones";
import { DetalleTarea } from "./detalle-tarea";

export type SeccionTareas =
  | "hoy"
  | "manana"
  | "esta_semana"
  | "este_mes"
  | "mas_tarde"
  | "completadas";

type IconoSeccionTipo = "sol" | "luna" | "semana" | "mes" | "bandeja" | "check";
type AmbitoTab = "todas" | "proyecto" | "personal";
type ColumnaOrden = "tarea" | "proyecto" | "prioridad" | "dificultad" | "fecha" | "responsable";
type Direccion = "asc" | "desc";

const selectCls = "control h-[38px] min-w-[9rem]";

const PESO_PRIORIDAD: Record<Prioridad, number> = {
  urgente: 0,
  alta: 1,
  media: 2,
  baja: 3,
};

const AMBITOS: { id: AmbitoTab; etiqueta: string }[] = [
  { id: "todas", etiqueta: "Todas" },
  { id: "proyecto", etiqueta: "Con proyecto" },
  { id: "personal", etiqueta: "Personales" },
];

const COLUMNAS: {
  id: ColumnaOrden;
  etiqueta: string;
  titulo?: string;
  thClass?: string;
}[] = [
  { id: "tarea", etiqueta: "Tarea", thClass: "w-[28%]" },
  { id: "proyecto", etiqueta: "Proyecto", thClass: "w-[20%]" },
  { id: "prioridad", etiqueta: "Prio.", titulo: "Prioridad", thClass: "w-[7%]" },
  { id: "dificultad", etiqueta: "Dif.", titulo: "Dificultad", thClass: "w-[7%]" },
  { id: "fecha", etiqueta: "Fecha límite", thClass: "w-[16%]" },
  { id: "responsable", etiqueta: "Resp.", titulo: "Responsable", thClass: "w-[14%]" },
];

function diaLocal(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoDia(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Lunes (inicio) de la semana laboral de `d`. */
function lunesDe(d: Date) {
  const x = diaLocal(d);
  const dow = x.getDay(); // 0=dom … 6=sáb
  const atras = dow === 0 ? 6 : dow - 1;
  x.setDate(x.getDate() - atras);
  return x;
}

/** Viernes de la semana laboral de `d`. */
function viernesDe(d: Date) {
  const x = lunesDe(d);
  x.setDate(x.getDate() + 4);
  return x;
}

/** Día local (YYYY-MM-DD) de un ISO datetime, o null. */
function diaDeCompletada(completadaEl: string | null): string | null {
  if (!completadaEl) return null;
  const d = new Date(completadaEl);
  if (Number.isNaN(d.getTime())) return null;
  return isoDia(diaLocal(d));
}

type MarcosFecha = {
  hoyIso: string;
  mananaIso: string;
  lunesIso: string;
  viernesIso: string;
  mesPrefijo: string;
  finMesIso: string;
};

function perteneceASeccion(
  fechaMaxima: string | null,
  seccion: Exclude<SeccionTareas, "completadas">,
  m: MarcosFecha,
): boolean {
  if (seccion === "hoy") return Boolean(fechaMaxima && fechaMaxima <= m.hoyIso);
  if (seccion === "manana") return fechaMaxima === m.mananaIso;
  if (seccion === "esta_semana") {
    return Boolean(fechaMaxima && fechaMaxima >= m.lunesIso && fechaMaxima <= m.viernesIso);
  }
  if (seccion === "este_mes") {
    return Boolean(fechaMaxima && fechaMaxima.startsWith(m.mesPrefijo));
  }
  // Más tarde: sin fecha o después de este mes
  return !fechaMaxima || fechaMaxima > m.finMesIso;
}

function coincideBusqueda(t: TareaUsuario, q: string) {
  if (!q) return true;
  const haystack = [t.nombre, t.proyectoEtiqueta, t.clienteNombre ?? ""]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function pasaPrioridad(t: TareaUsuario, filtroPrioridad: Prioridad | "") {
  return !filtroPrioridad || t.prioridad === filtroPrioridad;
}

function pasaDificultad(t: TareaUsuario, filtroDificultad: Dificultad | "") {
  return !filtroDificultad || t.dificultad === filtroDificultad;
}

function pasaAmbito(t: TareaUsuario, ambito: AmbitoTab) {
  if (ambito === "proyecto") return !t.esPersonal;
  if (ambito === "personal") return t.esPersonal;
  return true;
}

/** Abiertas en /tareas: solo «Por hacer» y apartados custom (p. ej. Ideas a futuro). */
function pasaColumnaLista(t: TareaUsuario) {
  if (t.completadaEl) return true;
  return !t.columnaFija || t.columnaNombre === "Por hacer";
}

function etiquetaProyecto(t: TareaUsuario) {
  if (t.esPersonal) return "Personal";
  return t.clienteNombre ? `${t.clienteNombre} · ${t.proyectoEtiqueta}` : t.proyectoEtiqueta;
}

function nombresResponsables(t: TareaUsuario, equipo: PersonaEquipo[]) {
  return t.responsableIds
    .map((id) => equipo.find((p) => p.id === id)?.nombre)
    .filter((n): n is string => Boolean(n));
}

function textoResponsables(t: TareaUsuario, equipo: PersonaEquipo[]) {
  const nombres = nombresResponsables(t, equipo);
  if (nombres.length === 0) return "—";
  return nombres.map((n) => inicialesDe(n)).join(" ");
}

function valorTexto(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? "").localeCompare(b ?? "", "es", { sensitivity: "base" });
}

function comparar(
  a: TareaUsuario,
  b: TareaUsuario,
  col: ColumnaOrden,
  equipo: PersonaEquipo[],
  direccion: Direccion,
): number {
  const signo = direccion === "asc" ? 1 : -1;
  switch (col) {
    case "tarea":
      return signo * valorTexto(a.nombre, b.nombre);
    case "proyecto":
      return signo * valorTexto(etiquetaProyecto(a), etiquetaProyecto(b));
    case "prioridad":
      return signo * (PESO_PRIORIDAD[a.prioridad] - PESO_PRIORIDAD[b.prioridad]);
    case "dificultad":
      return signo * (a.dificultad - b.dificultad);
    case "fecha": {
      // Sin fecha siempre al final, en ambas direcciones.
      if (!a.fechaMaxima && !b.fechaMaxima) return a.creadoEl.localeCompare(b.creadoEl);
      if (!a.fechaMaxima) return 1;
      if (!b.fechaMaxima) return -1;
      return (
        signo * a.fechaMaxima.localeCompare(b.fechaMaxima) || a.creadoEl.localeCompare(b.creadoEl)
      );
    }
    case "responsable": {
      const na = nombresResponsables(a, equipo)[0] ?? "";
      const nb = nombresResponsables(b, equipo)[0] ?? "";
      return signo * valorTexto(na, nb);
    }
  }
}

function CabeceraOrdenable({
  id,
  etiqueta,
  titulo,
  activa,
  direccion,
  thClass,
  onOrdenar,
}: {
  id: ColumnaOrden;
  etiqueta: string;
  titulo?: string;
  activa: boolean;
  direccion: Direccion;
  thClass?: string;
  onOrdenar: (id: ColumnaOrden) => void;
}) {
  return (
    <th
      className={thClass}
      aria-sort={activa ? (direccion === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        title={titulo}
        onClick={() => onOrdenar(id)}
        className={`inline-flex items-center gap-1 hover:text-magenta-texto transition ${
          activa ? "text-tinta" : "text-inherit"
        }`}
      >
        {etiqueta}
        <span className="font-mono text-[10px] text-apagado w-3" aria-hidden="true">
          {activa ? (direccion === "asc" ? "▲" : "▼") : ""}
        </span>
      </button>
    </th>
  );
}

const SECCIONES: {
  id: SeccionTareas;
  nombre: string;
  icono: IconoSeccionTipo;
}[] = [
  { id: "hoy", nombre: "Hoy", icono: "sol" },
  { id: "manana", nombre: "Mañana", icono: "luna" },
  { id: "esta_semana", nombre: "Esta semana", icono: "semana" },
  { id: "este_mes", nombre: "Este mes", icono: "mes" },
  { id: "mas_tarde", nombre: "Más tarde", icono: "bandeja" },
  { id: "completadas", nombre: "Completadas", icono: "check" },
];

function IconoSeccion({ tipo }: { tipo: IconoSeccionTipo }) {
  if (tipo === "sol") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (tipo === "luna") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (tipo === "semana") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M7 13h2M11 13h2M15 13h2M7 16.5h2M11 16.5h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (tipo === "mes") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path
          d="M7.5 13h2v2h-2zM11.5 13h2v2h-2zM15.5 13h2v2h-2zM7.5 16.5h2v2h-2zM11.5 16.5h2v2h-2z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (tipo === "check") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.5" y="3.5" width="17" height="17" rx="3" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M7.5 12.5l3 3 6-6.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h16l-1.5 12a2 2 0 0 1-2 1.8H7.5a2 2 0 0 1-2-1.8L4 7z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M9 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export type FlagsProyectoUi = {
  puedeGestionarProyecto: boolean;
  puedeCambiarSolicitante: boolean;
};

function puedeEditarTareaLista(
  t: { proyectoId: string; mandadaPorId: string | null; responsableIds: string[] },
  yoId: string,
  flagsPorProyecto: Record<string, FlagsProyectoUi>,
): boolean {
  if (flagsPorProyecto[t.proyectoId]?.puedeGestionarProyecto) return true;
  if (t.mandadaPorId === yoId) return true;
  return t.responsableIds.includes(yoId);
}

type Props = {
  tareasIniciales: TareaUsuario[];
  equipo: PersonaEquipo[];
  yoId: string;
  personalProyectoId: string;
  colaboradorIdsPorProyecto: Record<string, string[]>;
  flagsPorProyecto?: Record<string, FlagsProyectoUi>;
  tareaAbiertaInicial?: string;
  tareaIdsNuevas?: string[];
  tareaIdsChatSinLeer?: string[];
};

export function ListaTareas({
  tareasIniciales,
  equipo,
  yoId,
  personalProyectoId,
  colaboradorIdsPorProyecto,
  flagsPorProyecto = {},
  tareaAbiertaInicial,
  tareaIdsNuevas = [],
  tareaIdsChatSinLeer = [],
}: Props) {
  const { avisar } = useAvisos();
  const [tareas, setTareas] = useState(tareasIniciales);
  const [seccion, setSeccion] = useState<SeccionTareas>("hoy");
  const [consulta, setConsulta] = useState("");
  const [filtroPrioridad, setFiltroPrioridad] = useState<Prioridad | "">("");
  const [filtroDificultad, setFiltroDificultad] = useState<Dificultad | "">("");
  const [ambito, setAmbito] = useState<AmbitoTab>("todas");
  const [columna, setColumna] = useState<ColumnaOrden>("fecha");
  const [direccion, setDireccion] = useState<Direccion>("asc");
  const [tareaAbiertaId, setTareaAbiertaId] = useState<string | null>(tareaAbiertaInicial ?? null);
  const [pendiente, startTransition] = useTransition();
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [idsNuevas, setIdsNuevas] = useState(() => new Set(tareaIdsNuevas));
  const [idsChat, setIdsChat] = useState(() => new Set(tareaIdsChatSinLeer));

  const q = consulta.trim().toLowerCase();
  const hayFiltro = Boolean(q || filtroPrioridad || filtroDificultad || ambito !== "todas");

  useEffect(() => {
    setTareas(tareasIniciales);
  }, [tareasIniciales]);

  useEffect(() => {
    if (tareaAbiertaInicial) setTareaAbiertaId(tareaAbiertaInicial);
  }, [tareaAbiertaInicial]);

  const hoy = diaLocal();
  const manana = diaLocal();
  manana.setDate(manana.getDate() + 1);
  const finMes = diaLocal(hoy);
  finMes.setMonth(finMes.getMonth() + 1, 0);
  const hoyIso = isoDia(hoy);
  const mananaIso = isoDia(manana);
  const lunesIso = isoDia(lunesDe(hoy));
  const viernesIso = isoDia(viernesDe(hoy));
  const mesPrefijo = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  const finMesIso = isoDia(finMes);
  const marcos: MarcosFecha = {
    hoyIso,
    mananaIso,
    lunesIso,
    viernesIso,
    mesPrefijo,
    finMesIso,
  };

  const baseFiltro = useMemo(
    () =>
      tareas.filter(
        (t) =>
          coincideBusqueda(t, q) &&
          pasaPrioridad(t, filtroPrioridad) &&
          pasaDificultad(t, filtroDificultad) &&
          pasaAmbito(t, ambito) &&
          pasaColumnaLista(t),
      ),
    [tareas, q, filtroPrioridad, filtroDificultad, ambito],
  );

  const contadores = useMemo(() => {
    const c: Record<SeccionTareas, number> = {
      hoy: 0,
      manana: 0,
      esta_semana: 0,
      este_mes: 0,
      mas_tarde: 0,
      completadas: 0,
    };
    for (const t of baseFiltro) {
      if (t.completadaEl) {
        c.completadas += 1;
        continue;
      }
      for (const s of SECCIONES) {
        if (s.id === "completadas") continue;
        if (perteneceASeccion(t.fechaMaxima, s.id, marcos)) c[s.id] += 1;
      }
    }
    return c;
  }, [baseFiltro, hoyIso, mananaIso, lunesIso, viernesIso, mesPrefijo, finMesIso]);

  const enSeccion = useMemo(() => {
    if (seccion === "completadas") {
      return tareas.filter(
        (t) =>
          t.completadaEl &&
          coincideBusqueda(t, q) &&
          pasaPrioridad(t, filtroPrioridad) &&
          pasaDificultad(t, filtroDificultad),
      );
    }
    const abiertas: TareaUsuario[] = [];
    const hechasHoy: TareaUsuario[] = [];
    for (const t of tareas) {
      if (
        !coincideBusqueda(t, q) ||
        !pasaPrioridad(t, filtroPrioridad) ||
        !pasaDificultad(t, filtroDificultad) ||
        !pasaColumnaLista(t)
      ) {
        continue;
      }
      if (!perteneceASeccion(t.fechaMaxima, seccion, marcos)) continue;
      if (!t.completadaEl) {
        abiertas.push(t);
        continue;
      }
      if (diaDeCompletada(t.completadaEl) === hoyIso) hechasHoy.push(t);
    }
    return [...abiertas, ...hechasHoy];
  }, [
    tareas,
    seccion,
    q,
    filtroPrioridad,
    filtroDificultad,
    hoyIso,
    mananaIso,
    lunesIso,
    viernesIso,
    mesPrefijo,
    finMesIso,
  ]);

  const contadoresAmbito = useMemo(() => {
    const c = { todas: 0, proyecto: 0, personal: 0 };
    for (const t of enSeccion) {
      c.todas += 1;
      if (t.esPersonal) c.personal += 1;
      else c.proyecto += 1;
    }
    return c;
  }, [enSeccion]);

  const visibles = useMemo(() => {
    const filtradas = enSeccion.filter((t) => pasaAmbito(t, ambito));
    if (seccion === "completadas") {
      return [...filtradas].sort((a, b) => {
        const d = comparar(a, b, columna, equipo, direccion);
        return d !== 0 ? d : (b.completadaEl ?? "").localeCompare(a.completadaEl ?? "");
      });
    }

    const abiertas = filtradas.filter((t) => !t.completadaEl);
    const hechasHoy = filtradas.filter((t) => t.completadaEl);
    abiertas.sort((a, b) => comparar(a, b, columna, equipo, direccion));
    hechasHoy.sort((a, b) => (a.completadaEl ?? "").localeCompare(b.completadaEl ?? ""));
    return [...abiertas, ...hechasHoy];
  }, [enSeccion, ambito, seccion, columna, direccion, equipo]);

  function ordenarPor(id: ColumnaOrden) {
    if (columna === id) {
      setDireccion((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setColumna(id);
      setDireccion("asc");
    }
  }

  const tareaAbierta = tareaAbiertaId
    ? (tareas.find((t) => t.id === tareaAbiertaId) ?? null)
    : null;

  function crearRapida(e: React.FormEvent) {
    e.preventDefault();
    if (seccion === "completadas") return;
    const nombre = nombreNuevo.trim();
    if (!nombre) return;
    const fd = new FormData();
    fd.set("nombre", nombre);
    fd.set("seccion", seccion);
    startTransition(async () => {
      const r = await crearTareaPersonal(fd);
      if (!r.ok) {
        avisar(r.motivo === "falta_dato" ? "tarea_sin_nombre" : avisoDeMotivo(r.motivo));
        return;
      }
      setTareas(r.tareas);
      setNombreNuevo("");
      setTareaAbiertaId(r.tarea.id);
    });
  }

  function alternarCompletada(tareaId: string) {
    const fd = new FormData();
    fd.set("tarea_id", tareaId);
    startTransition(async () => {
      const r = await alternarCompletadaAction(fd);
      if (!r.ok) {
        avisar(avisoDeMotivo(r.motivo));
        return;
      }
      setTareas(r.tareas);
    });
  }

  function abrirTarea(tareaId: string) {
    setTareaAbiertaId(tareaId);
    setIdsNuevas((prev) => {
      if (!prev.has(tareaId)) return prev;
      const next = new Set(prev);
      next.delete(tareaId);
      return next;
    });
  }

  const etiquetaSeccion = SECCIONES.find((s) => s.id === seccion)?.nombre ?? "Hoy";

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] items-start">
      <aside className="grid gap-1">
        {SECCIONES.map((s) => {
          const activa = seccion === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSeccion(s.id)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13.5px] text-left border transition ${
                activa
                  ? "bg-magenta-suave border-magenta-borde text-magenta-texto font-semibold shadow-suave"
                  : "border-transparent text-apagado hover:bg-suave hover:text-tinta hover:border-linea"
              }`}
            >
              <span className="shrink-0 opacity-80">
                <IconoSeccion tipo={s.icono} />
              </span>
              <span className="flex-1 min-w-0 truncate">{s.nombre}</span>
              <span className="font-mono text-[11px] text-apagado">{contadores[s.id]}</span>
            </button>
          );
        })}
      </aside>

      <section className="min-w-0 grid gap-3">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="grid gap-1.5 min-w-[12rem] flex-1 max-w-md">
            <span className="etiqueta">Buscar</span>
            <input
              type="search"
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              placeholder="Tarea, proyecto, cliente…"
              className="control h-[38px]"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="etiqueta">Prioridad</span>
            <select
              value={filtroPrioridad}
              onChange={(e) => setFiltroPrioridad(e.target.value as Prioridad | "")}
              className={selectCls}
            >
              <option value="">Todas</option>
              {[...PRIORIDADES].reverse().map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="etiqueta">Dificultad</span>
            <select
              value={filtroDificultad}
              onChange={(e) =>
                setFiltroDificultad(
                  e.target.value === "" ? "" : (Number(e.target.value) as Dificultad),
                )
              }
              className={selectCls}
            >
              <option value="">Todas</option>
              {[...DIFICULTADES].reverse().map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>

        <nav
          className="flex flex-wrap gap-1 border-b border-linea"
          aria-label="Ámbito de tareas"
        >
          {AMBITOS.map((a) => {
            const cantidad = contadoresAmbito[a.id];
            const activa = ambito === a.id;
            return (
              <button
                key={a.id}
                type="button"
                aria-current={activa ? "page" : undefined}
                onClick={() => setAmbito(a.id)}
                className={`px-3.5 py-2 text-[13.5px] border-b-2 -mb-px transition inline-flex items-baseline gap-2 ${
                  activa
                    ? "border-magenta text-magenta-texto font-semibold"
                    : "border-transparent text-apagado hover:text-tinta hover:border-linea"
                }`}
              >
                <span>{a.etiqueta}</span>
                <span className="font-mono text-[11px] font-normal text-apagado">{cantidad}</span>
              </button>
            );
          })}
        </nav>

        {visibles.length === 0 ? (
          <p className="text-[13.5px] text-apagado px-1 py-6">
            {hayFiltro
              ? `Ninguna tarea con esos filtros en ${etiquetaSeccion.toLowerCase()}.`
              : seccion === "completadas"
                ? "Todavía no hay tareas completadas."
                : `Nada en ${etiquetaSeccion.toLowerCase()}. Escribe abajo y pulsa Enter.`}
          </p>
        ) : (
          <div className="overflow-x-auto border border-linea-fuerte rounded-[10px] shadow-suave">
            <table className="tabla w-full table-fixed text-[13px] [&_th]:px-1.5 [&_td]:px-1.5 [&_th]:py-2 [&_td]:py-2">
              <thead className="bg-suave">
                <tr>
                  <th className="w-[40px] !normal-case !tracking-normal" aria-label="Completar" />
                  {COLUMNAS.map((c) => (
                    <CabeceraOrdenable
                      key={c.id}
                      id={c.id}
                      etiqueta={c.etiqueta}
                      titulo={c.titulo}
                      activa={columna === c.id}
                      direccion={direccion}
                      thClass={c.thClass}
                      onOrdenar={ordenarPor}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibles.map((t) => {
                  const v = vencimiento(t.fechaMaxima);
                  const hecha = Boolean(t.completadaEl);
                  const tieneNovedad = idsNuevas.has(t.id) || idsChat.has(t.id);
                  const resp = textoResponsables(t, equipo);
                  const respTitle = nombresResponsables(t, equipo).join(", ") || undefined;
                  const puedeEditar = puedeEditarTareaLista(t, yoId, flagsPorProyecto);
                  return (
                    <tr key={t.id} className={hecha ? "opacity-70" : undefined}>
                      <td>
                        <button
                          type="button"
                          title={
                            !puedeEditar
                              ? "No tienes permiso para completar esta tarea"
                              : hecha
                                ? "Reabrir tarea"
                                : "Marcar como completada"
                          }
                          aria-label={hecha ? `Reabrir ${t.nombre}` : `Completar ${t.nombre}`}
                          aria-pressed={hecha}
                          disabled={pendiente || !puedeEditar}
                          onClick={() => {
                            if (!puedeEditar) return;
                            alternarCompletada(t.id);
                          }}
                          className={`size-5 shrink-0 rounded border grid place-items-center transition disabled:opacity-40 disabled:cursor-not-allowed ${
                            hecha
                              ? "bg-magenta border-magenta text-white"
                              : "border-linea hover:border-magenta-borde text-transparent"
                          }`}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path
                              d="M5 13l4 4L19 7"
                              stroke="currentColor"
                              strokeWidth="2.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </td>
                      <td className="min-w-0">
                        <button
                          type="button"
                          onClick={() => abrirTarea(t.id)}
                          title={t.nombre}
                          className="font-semibold hover:text-magenta-texto transition truncate flex items-center gap-1.5 min-w-0 max-w-full text-left"
                        >
                          {tieneNovedad ? <PuntoNovedad /> : null}
                          <span
                            className={`truncate ${hecha ? "line-through text-apagado" : ""}`}
                          >
                            {t.nombre}
                          </span>
                        </button>
                      </td>
                      <td className="min-w-0">
                        {!t.esPersonal ? (
                          <Link
                            href={`/proyectos/${t.proyectoId}`}
                            title={etiquetaProyecto(t)}
                            className="truncate block hover:text-magenta-texto transition"
                          >
                            {etiquetaProyecto(t)}
                          </Link>
                        ) : (
                          <span className="text-apagado">Personal</span>
                        )}
                      </td>
                      <td>
                        <IconoPrioridad prioridad={t.prioridad} />
                      </td>
                      <td>
                        <span
                          className={`inline-block text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded ${COLOR_DIFICULTAD[t.dificultad]}`}
                          title={`Dificultad ${t.dificultad}`}
                        >
                          {t.dificultad}
                        </span>
                      </td>
                      <td className="whitespace-nowrap">
                        {v ? (
                          <span
                            className={
                              v.tarde && !hecha ? "text-magenta-texto font-semibold" : "text-apagado"
                            }
                          >
                            {v.texto}
                          </span>
                        ) : (
                          <span className="text-apagado">—</span>
                        )}
                      </td>
                      <td className="min-w-0">
                        <span className="truncate block font-mono text-[12px]" title={respTitle}>
                          {resp}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {seccion !== "completadas" ? (
          <form
            onSubmit={crearRapida}
            className="flex items-center gap-2 border border-linea-fuerte rounded-xl bg-papel px-3 py-2.5 shadow-suave focus-within:border-magenta-borde transition"
          >
            <button
              type="submit"
              aria-label="Agregar tarea"
              disabled={pendiente}
              className="size-7 rounded-lg bg-magenta text-white grid place-items-center text-[16px] shrink-0 disabled:opacity-60"
            >
              +
            </button>
            <input
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              maxLength={140}
              placeholder={`${etiquetaSeccion} · Agregar tarea`}
              className="flex-1 min-w-0 bg-transparent border-0 text-[14px] focus:outline-none placeholder:text-apagado"
              disabled={pendiente}
            />
            {pendiente ? <span className="etiqueta shrink-0">Creando…</span> : null}
          </form>
        ) : null}
      </section>

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
          chatSinLeer={idsChat.has(tareaAbierta.id)}
          onChatLeido={() => {
            setIdsChat((prev) => {
              if (!prev.has(tareaAbierta.id)) return prev;
              const next = new Set(prev);
              next.delete(tareaAbierta.id);
              return next;
            });
          }}
          onCerrar={() => setTareaAbiertaId(null)}
          onGuardar={(tarea) => {
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
          }}
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
