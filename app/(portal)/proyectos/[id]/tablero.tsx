"use client";

import {
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type DragEvent,
} from "react";
import {
  ordenarColumnasTablero,
  vencimiento,
  type Columna,
  type Prioridad,
  type Tarea,
} from "@/lib/tareas-mock";
import type { PersonaEquipo } from "@/lib/clientes-mock";
import { fecha } from "@/lib/formato";
import { AvatarUsuario } from "../../avatar-usuario";
import { Cabecera } from "../../cabecera";
import { Boton } from "../../boton";
import { ListaColaboradores } from "../../colaboradores-ui";
import { useAvisos } from "../../avisos-ui";
import { avisoDeMotivo } from "@/lib/avisos";
import {
  alternarCompletadaProyecto,
  borrarApartado,
  borrarTareaProyecto,
  crearApartado,
  crearTareaProyecto,
  mostrarApartado,
  moverTareaProyecto,
  ocultarApartado,
  reordenarApartado,
} from "../acciones";
import { DetalleTarea } from "../../tareas/detalle-tarea";

function avisarError(avisar: (c: string) => void, motivo: string, comoTarea = false) {
  if (comoTarea && motivo === "falta_dato") {
    avisar("tarea_sin_nombre");
    return;
  }
  avisar(avisoDeMotivo(motivo));
}

const TIPO_COLUMNA = "application/x-orbita-columna";

/** Ancho para que quepan exactamente 5 columnas (4 gaps de gap-3 = 3rem). */
const COL_ANCHO =
  "shrink-0 grow-0 basis-[calc((100%-3rem)/5)] max-w-[calc((100%-3rem)/5)] min-w-0 h-full min-h-0";

const COLOR: Record<Prioridad, string> = {
  baja: "bg-[#64748b]/15 text-[#475569] border border-[#64748b]/40",
  media: "bg-[#2563eb]/15 text-[#1d4ed8] border border-[#2563eb]/45",
  alta: "bg-[#d97706] text-white border border-[#d97706]",
  urgente: "bg-mal-boton text-white border border-mal-boton",
};

function IconoOjo({ cerrado }: { cerrado?: boolean }) {
  if (cerrado) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.8 2.8M9.9 5.1A10.5 10.5 0 0 1 12 5c5 0 9.3 3.1 11 7.5a11.8 11.8 0 0 1-4.2 5.1M6.1 6.1A11.8 11.8 0 0 0 1 12.5C2.7 16.9 7 20 12 20c1.7 0 3.3-.4 4.7-1"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M1 12.5C2.7 8.1 7 5 12 5s9.3 3.1 11 7.5c-1.7 4.4-6 7.5-11 7.5S2.7 16.9 1 12.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12.5" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconoCalendario({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 13h2v2H8v-2Zm3 0h2v2h-2v-2Zm3 0h2v2h-2v-2Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

type Props = {
  proyectoId: string;
  clienteNombre: string;
  tituloProyecto: string;
  finContrato: string | null;
  responsableNombre: string | null;
  colaboradorIds: string[];
  equipo: PersonaEquipo[];
  yoId: string;
  columnasIniciales: Columna[];
  columnasOcultasIniciales: string[];
  tareasIniciales: Tarea[];
  tareaAbiertaInicial?: string;
  puedeGestionarProyecto: boolean;
  puedeCrearTarea: boolean;
  puedeCambiarSolicitante: boolean;
};

function puedeEditarTareaUi(
  t: Tarea,
  yoId: string,
  puedeGestionarProyecto: boolean,
): boolean {
  if (puedeGestionarProyecto) return true;
  if (t.mandadaPorId === yoId) return true;
  return t.responsableIds.includes(yoId);
}

export function TableroCliente({
  proyectoId,
  clienteNombre,
  tituloProyecto,
  finContrato,
  responsableNombre,
  colaboradorIds,
  equipo,
  yoId,
  columnasIniciales,
  columnasOcultasIniciales,
  tareasIniciales,
  tareaAbiertaInicial,
  puedeGestionarProyecto,
  puedeCrearTarea,
  puedeCambiarSolicitante,
}: Props) {
  const { avisar } = useAvisos();
  const [tareas, setTareas] = useState(tareasIniciales);
  const [columnas, setColumnas] = useState(columnasIniciales);
  const [ocultas, setOcultas] = useState(() => new Set(columnasOcultasIniciales));
  const [tareaAbiertaId, setTareaAbiertaId] = useState<string | null>(tareaAbiertaInicial ?? null);
  const [senalId, setSenalId] = useState<string | null>(tareaAbiertaInicial ?? null);

  useEffect(() => {
    setTareas(tareasIniciales);
  }, [tareasIniciales]);

  useEffect(() => {
    setColumnas(columnasIniciales);
  }, [columnasIniciales]);

  useEffect(() => {
    setOcultas(new Set(columnasOcultasIniciales));
  }, [columnasOcultasIniciales]);

  useEffect(() => {
    if (!tareaAbiertaInicial) return;
    setTareaAbiertaId(tareaAbiertaInicial);
    setSenalId(tareaAbiertaInicial);
    const t = tareasIniciales.find((x) => x.id === tareaAbiertaInicial);
    if (t) {
      setOcultas((prev) => {
        if (!prev.has(t.columnaId)) return prev;
        const next = new Set(prev);
        next.delete(t.columnaId);
        return next;
      });
    }
  }, [tareaAbiertaInicial, tareasIniciales]);
  const [arrastrandoId, setArrastrandoId] = useState<string | null>(null);
  const [arrastrandoColumnaId, setArrastrandoColumnaId] = useState<string | null>(null);
  const [huecoColumna, setHuecoColumna] = useState<number | null>(null);
  const [sobreColumnaId, setSobreColumnaId] = useState<string | null>(null);
  const [hueco, setHueco] = useState<{ columnaId: string; indice: number } | null>(null);
  const [pendiente, startTransition] = useTransition();
  const [confirmar, setConfirmar] = useState<
    | { tipo: "tarea"; id: string; nombre: string }
    | { tipo: "apartado"; id: string; nombre: string }
    | null
  >(null);
  const confirmarId = useId();
  const tableroRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ startX: number; scrollLeft: number } | null>(null);
  const [panActivo, setPanActivo] = useState(false);

  const abiertas = useMemo(() => tareas.filter((t) => !t.completadaEl).length, [tareas]);
  const tareaAbierta = tareaAbiertaId ? tareas.find((t) => t.id === tareaAbiertaId) ?? null : null;
  const columnasVisibles = useMemo(
    () => columnas.filter((c) => !ocultas.has(c.id)),
    [columnas, ocultas],
  );
  const columnasOcultasLista = useMemo(
    () => columnas.filter((c) => ocultas.has(c.id)),
    [columnas, ocultas],
  );
  const columnasParaVista = useMemo(
    () => ordenarColumnasTablero(columnasVisibles),
    [columnasVisibles],
  );
  const columnasSinArrastre = useMemo(
    () =>
      arrastrandoColumnaId
        ? columnasParaVista.filter((c) => c.id !== arrastrandoColumnaId)
        : columnasParaVista,
    [columnasParaVista, arrastrandoColumnaId],
  );

  useEffect(() => {
    if (!senalId) return;
    const scroll = window.setTimeout(() => {
      const el = tableroRef.current?.querySelector(`[data-tarea-id="${senalId}"]`);
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      }
    }, 80);
    const clear = window.setTimeout(() => setSenalId(null), 2500);
    return () => {
      window.clearTimeout(scroll);
      window.clearTimeout(clear);
    };
  }, [senalId, columnasVisibles]);

  useEffect(() => {
    if (!tareaAbiertaId && !confirmar) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (confirmar) {
        setConfirmar(null);
        return;
      }
      setTareaAbiertaId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tareaAbiertaId, confirmar]);

  useEffect(() => {
    if (!panActivo) return;
    function onMove(e: MouseEvent) {
      const pan = panRef.current;
      const el = tableroRef.current;
      if (!pan || !el) return;
      el.scrollLeft = pan.scrollLeft - (e.clientX - pan.startX);
    }
    function onUp() {
      panRef.current = null;
      setPanActivo(false);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [panActivo]);

  useEffect(() => {
    const el = tableroRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!el || e.deltaY === 0 || e.deltaX !== 0) return;
      const target = e.target;
      if (target instanceof Element) {
        const lista = target.closest("[data-columna-scroll]");
        if (lista instanceof HTMLElement) {
          const puedeArriba = e.deltaY < 0 && lista.scrollTop > 0;
          const puedeAbajo =
            e.deltaY > 0 && lista.scrollTop + lista.clientHeight < lista.scrollHeight - 1;
          if (puedeArriba || puedeAbajo) return;
        }
      }
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const next = Math.max(0, Math.min(max, el.scrollLeft + e.deltaY));
      if (next === el.scrollLeft) return;
      e.preventDefault();
      el.scrollLeft = next;
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function ejecutarBorrado() {
    if (!confirmar) return;
    if (confirmar.tipo === "tarea") {
      const tareaId = confirmar.id;
      const fd = new FormData();
      fd.set("tarea_id", tareaId);
      setConfirmar(null);
      startTransition(async () => {
        const r = await borrarTareaProyecto(fd);
        if (!r.ok) {
          avisarError(avisar, r.motivo);
          return;
        }
        setTareas(r.tareas);
        if (tareaAbiertaId === tareaId) setTareaAbiertaId(null);
      });
      return;
    }
    const columnaId = confirmar.id;
    const fd = new FormData();
    fd.set("columna_id", columnaId);
    setConfirmar(null);
    startTransition(async () => {
      const r = await borrarApartado(fd);
      if (!r.ok) {
        avisarError(avisar, r.motivo);
        return;
      }
      setColumnas((prev) => prev.filter((c) => c.id !== columnaId));
      setOcultas((prev) => {
        const next = new Set(prev);
        next.delete(columnaId);
        return next;
      });
      setTareas((prev) =>
        prev.map((t) =>
          r.tareasMovidas.includes(t.id)
            ? { ...t, columnaId: r.porHacerId, completadaEl: null }
            : t,
        ),
      );
    });
  }

  function parchearTarea(id: string, patch: Partial<Tarea> | ((t: Tarea) => Tarea)) {
    setTareas((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        return typeof patch === "function" ? patch(t) : { ...t, ...patch };
      }),
    );
  }

  function crearNuevaTareaCabecera() {
    const porHacer =
      columnas.find((c) => c.fija && c.nombre === "Por hacer") ??
      columnasVisibles.find(
        (c) => !(c.fija && (c.nombre === "Terminadas" || c.nombre.startsWith("Rechazadas"))),
      ) ??
      columnasVisibles[0];
    if (!porHacer) return;

    const fd = new FormData();
    fd.set("proyecto_id", proyectoId);
    fd.set("columna_id", porHacer.id);
    fd.set("creada_por_id", yoId);
    fd.set("rapida", "1");
    fd.set("nombre", "Nueva tarea");
    startTransition(async () => {
      const r = await crearTareaProyecto(fd);
      if (!r.ok) {
        avisarError(avisar, r.motivo, true);
        return;
      }
      setTareas(r.tareas);
      setTareaAbiertaId(r.tarea.id);
      if (r.calendarFallo) avisar("calendar_aviso");
    });
  }

  function tareasDeColumna(columnaId: string) {
    return tareas
      .filter((t) => t.columnaId === columnaId)
      .sort((a, b) => a.orden - b.orden || a.creadoEl.localeCompare(b.creadoEl));
  }

  function moverTarjetaDnD(tareaId: string, columnaId: string, indice: number) {
    const actual = tareas.find((t) => t.id === tareaId);
    if (!actual) return;
    if (actual.columnaId === columnaId) {
      // Índice en lista completa ≡ inserción no-op sobre lista sin la tarjeta.
      const cur = tareasDeColumna(columnaId).findIndex((t) => t.id === tareaId);
      if (cur === indice) return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("tarea_id", tareaId);
      fd.set("columna_id", columnaId);
      fd.set("indice", String(indice));
      const r = await moverTareaProyecto(fd);
      if (!r.ok) {
        avisarError(avisar, r.motivo);
        return;
      }
      setTareas(r.tareas);
    });
  }

  function alternarCompletada(tareaId: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("tarea_id", tareaId);
      const r = await alternarCompletadaProyecto(fd);
      if (!r.ok) {
        avisarError(avisar, r.motivo);
        return;
      }
      setTareas(r.tareas);
    });
  }

  function marcarHueco(columnaId: string, indice: number) {
    if (arrastrandoColumnaId) return;
    // Misma columna: no mostrar hueco si el índice de inserción deja la tarjeta igual.
    if (arrastrandoId) {
      const arrastrada = tareas.find((t) => t.id === arrastrandoId);
      if (arrastrada?.columnaId === columnaId) {
        const cur = tareasDeColumna(columnaId).findIndex((t) => t.id === arrastrandoId);
        if (cur === indice) {
          setSobreColumnaId(columnaId);
          setHueco((h) => (h?.columnaId === columnaId ? null : h));
          return;
        }
      }
    }
    setSobreColumnaId(columnaId);
    setHueco((prev) =>
      prev?.columnaId === columnaId && prev.indice === indice ? prev : { columnaId, indice },
    );
  }

  function indiceInsercionPorY(contenedor: HTMLElement, clientY: number) {
    const cards = contenedor.querySelectorAll<HTMLElement>("[data-tarea-card]");
    if (cards.length === 0) return 0;
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return i;
    }
    return cards.length;
  }

  /** Índice de inserción en la lista de vista (sin la columna arrastrada). */
  function indiceInsercionColumna(sobreColId: string, before: boolean) {
    if (!arrastrandoColumnaId) return null;
    const sin = ordenarColumnasTablero(
      columnasVisibles.filter((c) => c.id !== arrastrandoColumnaId),
    );
    const sobreIdx = sin.findIndex((c) => c.id === sobreColId);
    if (sobreIdx < 0) return null;
    return before ? sobreIdx : sobreIdx + 1;
  }

  function moverColumnaDnD(columnaId: string, indiceDestinoVista: number) {
    const col = columnas.find((c) => c.id === columnaId);
    if (!col || col.fija) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("columna_id", columnaId);
      fd.set("indice", String(indiceDestinoVista));
      const r = await reordenarApartado(fd);
      if (!r.ok) {
        avisarError(avisar, r.motivo);
        return;
      }
      setColumnas(r.columnas);
    });
  }

  function ocultarApartadoUi(columnaId: string) {
    setOcultas((prev) => {
      const next = new Set(prev);
      next.add(columnaId);
      return next;
    });
    startTransition(async () => {
      const fd = new FormData();
      fd.set("columna_id", columnaId);
      const r = await ocultarApartado(fd);
      if (!r.ok) {
        setOcultas((prev) => {
          const next = new Set(prev);
          next.delete(columnaId);
          return next;
        });
        avisarError(avisar, r.motivo);
      }
    });
  }

  function mostrarApartadoUi(columnaId: string) {
    setOcultas((prev) => {
      const next = new Set(prev);
      next.delete(columnaId);
      return next;
    });
    startTransition(async () => {
      const fd = new FormData();
      fd.set("columna_id", columnaId);
      const r = await mostrarApartado(fd);
      if (!r.ok) {
        setOcultas((prev) => {
          const next = new Set(prev);
          next.add(columnaId);
          return next;
        });
        avisarError(avisar, r.motivo);
      }
    });
  }

  return (
    <>
      <Cabecera
        etiqueta={clienteNombre}
        titulo={tituloProyecto}
        sello={`${abiertas} ${abiertas === 1 ? "abierta" : "abiertas"}`}
        acciones={
          <div className="flex gap-3 items-center min-w-0 flex-wrap justify-end">
            <div className="flex gap-2 items-center min-w-0">
              <span className="etiqueta shrink-0">Colaboradores</span>
              <ListaColaboradores ids={colaboradorIds} equipo={equipo} />
            </div>
            <button
              type="button"
              className="boton shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={pendiente || !puedeCrearTarea}
              title={
                puedeCrearTarea
                  ? undefined
                  : "No tienes permiso para crear tareas en este proyecto"
              }
              onClick={crearNuevaTareaCabecera}
            >
              Nueva tarea
            </button>
          </div>
        }
      />

      <p className="text-[12.5px] text-apagado mb-3">
        Responsable del proyecto: <b className="text-tinta">{responsableNombre ?? "sin asignar"}</b>
        {finContrato ? ` · fin ${fecha(finContrato)}` : null}
        {pendiente ? <span className="ml-2 etiqueta">Guardando…</span> : null}
      </p>

      <form
        className={`flex flex-wrap gap-2 items-center mb-3 ${
          puedeGestionarProyecto ? "" : "opacity-40"
        }`}
        action={(fd) => {
          if (!puedeGestionarProyecto) return;
          startTransition(async () => {
            const r = await crearApartado(fd);
            if (!r.ok) {
              avisarError(avisar, r.motivo);
              return;
            }
            setColumnas((prev) => [...prev, r.columna].sort((a, b) => a.orden - b.orden));
            const input = document.querySelector<HTMLInputElement>(
              'input[name="nombre"][data-nuevo-apartado]',
            );
            if (input) input.value = "";
          });
        }}
      >
        <input type="hidden" name="proyecto_id" value={proyectoId} />
        <label className="etiqueta shrink-0" htmlFor="nuevo-apartado">
          Añadir apartado
        </label>
        <input
          id="nuevo-apartado"
          name="nombre"
          required
          maxLength={60}
          data-nuevo-apartado
          placeholder="Nombre del apartado"
          disabled={!puedeGestionarProyecto}
          title={
            puedeGestionarProyecto
              ? undefined
              : "Solo el responsable del proyecto puede gestionar apartados"
          }
          className="control h-9 px-3 text-[13px] w-full max-w-xs min-w-0 disabled:cursor-not-allowed"
        />
        <Boton
          className="boton-sec h-9 text-[13px] px-3 disabled:opacity-40 disabled:cursor-not-allowed"
          textoEnviando="Añadiendo…"
          disabled={!puedeGestionarProyecto}
        >
          Añadir
        </Boton>
      </form>

      {columnasOcultasLista.length > 0 ? (
        <div className="flex flex-wrap gap-2 items-center mb-3">
          <span className="etiqueta shrink-0">Ocultos</span>
          {columnasOcultasLista.map((col) => (
            <button
              key={col.id}
              type="button"
              title={`Mostrar ${col.nombre}`}
              aria-label={`Mostrar apartado ${col.nombre}`}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-linea bg-suave text-[12px] text-apagado hover:text-tinta hover:border-linea-fuerte transition"
              onClick={() => mostrarApartadoUi(col.id)}
            >
              <IconoOjo cerrado />
              <span className="max-w-[10rem] truncate">{col.nombre}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div
        ref={tableroRef}
        className={`flex gap-3 overflow-x-auto overflow-y-hidden pb-2 items-stretch min-h-[16rem] h-[calc(100svh-16rem)] max-h-[calc(100svh-14rem)] ${panActivo ? "select-none" : ""}`}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          const t = e.target;
          if (!(t instanceof Element)) return;
          if (t.closest("button, a, input, textarea, select, label, [draggable='true']")) return;
          const el = tableroRef.current;
          if (!el) return;
          e.preventDefault();
          panRef.current = { startX: e.clientX, scrollLeft: el.scrollLeft };
          setPanActivo(true);
        }}
      >
        {columnasParaVista.map((col) => {
          const dentro = tareasDeColumna(col.id);
          const sinArrastre = arrastrandoId ? dentro.filter((t) => t.id !== arrastrandoId) : dentro;
          const recibiendo = !arrastrandoColumnaId && sobreColumnaId === col.id;
          const arrastrandoEsta = arrastrandoColumnaId === col.id;
          const origenArrastre = arrastrandoColumnaId
            ? columnasParaVista.findIndex((c) => c.id === arrastrandoColumnaId)
            : -1;
          const indiceHuecoAntes = indiceInsercionColumna(col.id, true);
          // No pintar hueco en el índice de origen: la columna sigue en el DOM (opacity)
          // y colapsarla cancelaba el drag HTML5 del navegador.
          const mostrarHuecoAntes =
            !!arrastrandoColumnaId &&
            huecoColumna !== null &&
            indiceHuecoAntes !== null &&
            huecoColumna === indiceHuecoAntes &&
            huecoColumna !== origenArrastre &&
            !arrastrandoEsta;

          return (
            <Fragment key={col.id}>
              {mostrarHuecoAntes && indiceHuecoAntes !== null ? (
                <HuecoColumnaDrop
                  onDragOver={(e) => {
                    if (!arrastrandoColumnaId) return;
                    if (![...e.dataTransfer.types].includes(TIPO_COLUMNA)) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setHuecoColumna((prev) =>
                      prev === indiceHuecoAntes ? prev : indiceHuecoAntes,
                    );
                  }}
                  onDrop={(e) => {
                    const columnaId = e.dataTransfer.getData(TIPO_COLUMNA);
                    if (!columnaId) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const dest = huecoColumna ?? indiceHuecoAntes;
                    setArrastrandoColumnaId(null);
                    setHuecoColumna(null);
                    moverColumnaDnD(columnaId, dest);
                  }}
                />
              ) : null}
              <div className={`flex gap-3 items-stretch ${COL_ANCHO}`}>
              <section
                className={`tarjeta p-3 flex-1 min-w-0 overflow-hidden h-full min-h-0 flex flex-col transition ${
                  recibiendo ? "ring-2 ring-inset ring-magenta border-magenta" : ""
                } ${arrastrandoEsta ? "opacity-40" : ""}`}
                onDragOver={(e) => {
                  if (!arrastrandoColumnaId || arrastrandoColumnaId === col.id) return;
                  if (![...e.dataTransfer.types].includes(TIPO_COLUMNA)) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  const rect = e.currentTarget.getBoundingClientRect();
                  const before = e.clientX < rect.left + rect.width / 2;
                  const dest = indiceInsercionColumna(col.id, before);
                  if (dest !== null) setHuecoColumna((prev) => (prev === dest ? prev : dest));
                }}
                onDrop={(e) => {
                  const columnaId = e.dataTransfer.getData(TIPO_COLUMNA);
                  if (!columnaId) return;
                  e.preventDefault();
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const before = e.clientX < rect.left + rect.width / 2;
                  const dest = huecoColumna ?? indiceInsercionColumna(col.id, before) ?? 0;
                  setArrastrandoColumnaId(null);
                  setHuecoColumna(null);
                  moverColumnaDnD(columnaId, dest);
                }}
              >
                <div
                  className={`shrink-0 mb-2 ${col.fija ? "" : "cursor-move"}`}
                  draggable={puedeGestionarProyecto && !col.fija}
                  onDragStart={(e) => {
                    if (!puedeGestionarProyecto || col.fija) {
                      e.preventDefault();
                      return;
                    }
                    if (col.fija) {
                      e.preventDefault();
                      return;
                    }
                    e.stopPropagation();
                    e.dataTransfer.setData(TIPO_COLUMNA, col.id);
                    e.dataTransfer.effectAllowed = "move";
                    const seccion = e.currentTarget.closest("section");
                    if (seccion instanceof HTMLElement) {
                      const rect = seccion.getBoundingClientRect();
                      e.dataTransfer.setDragImage(
                        seccion,
                        Math.max(0, e.clientX - rect.left),
                        Math.max(0, e.clientY - rect.top),
                      );
                    }
                    const origen = columnasParaVista.findIndex((c) => c.id === col.id);
                    setArrastrandoColumnaId(col.id);
                    setHuecoColumna(origen >= 0 ? origen : 0);
                    setArrastrandoId(null);
                    setSobreColumnaId(null);
                    setHueco(null);
                  }}
                  onDragEnd={() => {
                    setArrastrandoColumnaId(null);
                    setHuecoColumna(null);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="etiqueta leading-tight min-w-0 flex-1">{col.nombre}</h2>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono text-[11px] text-apagado">{dentro.length}</span>
                      <button
                        type="button"
                        title="Ocultar apartado"
                        aria-label={`Ocultar apartado ${col.nombre}`}
                        className="p-1 rounded-md text-apagado hover:text-tinta hover:bg-suave transition"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => ocultarApartadoUi(col.id)}
                      >
                        <IconoOjo />
                      </button>
                      {!col.fija ? (
                        <button
                          type="button"
                          title={
                            puedeGestionarProyecto
                              ? "Eliminar apartado"
                              : "Solo el responsable del proyecto puede eliminar apartados"
                          }
                          aria-label={
                            puedeGestionarProyecto
                              ? `Eliminar apartado ${col.nombre}`
                              : "Sin permiso para eliminar apartados"
                          }
                          disabled={!puedeGestionarProyecto}
                          className={`p-1 rounded-md transition ${
                            puedeGestionarProyecto
                              ? "text-apagado hover:text-mal hover:bg-mal-suave"
                              : "text-apagado opacity-40 cursor-not-allowed"
                          }`}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={() => {
                            if (!puedeGestionarProyecto) return;
                            setConfirmar({ tipo: "apartado", id: col.id, nombre: col.nombre });
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path
                              d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {col.fija ? null : (
                    <p className="text-[10px] text-apagado mt-1">
                      Solo este proyecto · arrastra para ordenar
                    </p>
                  )}
                </div>

                <div
                  data-columna-scroll
                  className={`grid grid-cols-[minmax(0,1fr)] gap-2 mb-2 min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-gutter-stable content-start rounded-lg transition ${
                    recibiendo ? "bg-magenta-suave" : ""
                  }`}
                  onDragOver={(e) => {
                    if (arrastrandoColumnaId) return;
                    if ([...e.dataTransfer.types].includes(TIPO_COLUMNA)) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    marcarHueco(col.id, indiceInsercionPorY(e.currentTarget, e.clientY));
                  }}
                  onDragLeave={(e) => {
                    const related = e.relatedTarget as Node | null;
                    if (related && e.currentTarget.contains(related)) return;
                    setSobreColumnaId((id) => (id === col.id ? null : id));
                    setHueco((h) => (h?.columnaId === col.id ? null : h));
                  }}
                  onDrop={(e) => {
                    if (arrastrandoColumnaId || e.dataTransfer.getData(TIPO_COLUMNA)) return;
                    e.preventDefault();
                    const tareaId = e.dataTransfer.getData("text/plain");
                    const indice =
                      hueco?.columnaId === col.id
                        ? hueco.indice
                        : indiceInsercionPorY(e.currentTarget, e.clientY);
                    setSobreColumnaId(null);
                    setHueco(null);
                    setArrastrandoId(null);
                    if (tareaId) moverTarjetaDnD(tareaId, col.id, indice);
                  }}
                >
                  {dentro.length === 0 ? (
                    <>
                      {arrastrandoId && hueco?.columnaId === col.id ? <HuecoDrop /> : null}
                      <p className="text-[12.5px] text-apagado/70 px-1 py-2">
                        {arrastrandoId ? "Suelta aquí" : "Nada por aquí."}
                      </p>
                    </>
                  ) : (
                    <>
                      {dentro.map((t) => {
                        const esArrastrada = t.id === arrastrandoId;
                        const base = sinArrastre.findIndex((x) => x.id === t.id);
                        const curArrastre = arrastrandoId
                          ? dentro.findIndex((x) => x.id === arrastrandoId)
                          : -1;
                        const huecoAntes =
                          !esArrastrada &&
                          base >= 0 &&
                          hueco?.columnaId === col.id &&
                          hueco.indice === base;
                        return (
                          <div key={t.id} className="grid gap-2 min-w-0 max-w-full">
                            {huecoAntes ? <HuecoDrop /> : null}
                            <div
                              data-tarea-card={esArrastrada ? undefined : ""}
                              data-tarea-id={t.id}
                              className="min-w-0 max-w-full"
                              onDragOver={(e) => {
                                if (arrastrandoColumnaId) return;
                                // Sobre la propia tarjeta: no cancelar el drag ni forzar índice al final.
                                if (esArrastrada) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  return;
                                }
                                e.preventDefault();
                                e.stopPropagation();
                                e.dataTransfer.dropEffect = "move";
                                const rect = e.currentTarget.getBoundingClientRect();
                                const before = e.clientY < rect.top + rect.height / 2;
                                if (base < 0) return;
                                let indice = before ? base : base + 1;
                                // Misma columna: toda la tarjeta de arriba = subir;
                                // toda la de abajo = bajar (evita no-ops por mitad).
                                if (curArrastre >= 0) {
                                  if (base === curArrastre - 1) indice = base;
                                  else if (base === curArrastre) indice = base + 1;
                                }
                                marcarHueco(col.id, indice);
                              }}
                            >
                              <TarjetaTarea
                                t={t}
                                equipo={equipo}
                                yoId={yoId}
                                puedeMover={puedeEditarTareaUi(t, yoId, puedeGestionarProyecto)}
                                puedeCompletar={puedeEditarTareaUi(t, yoId, puedeGestionarProyecto)}
                                rechazada={col.fija && col.nombre === "Rechazadas / eliminadas"}
                                arrastrando={esArrastrada}
                                destacada={t.id === senalId}
                                pendiente={pendiente}
                                onAbrir={() => setTareaAbiertaId(t.id)}
                                onBorrar={() =>
                                  setConfirmar({ tipo: "tarea", id: t.id, nombre: t.nombre })
                                }
                                onAlternarCompletada={() => alternarCompletada(t.id)}
                                onDragInicio={() => setArrastrandoId(t.id)}
                                onDragFin={() => {
                                  setArrastrandoId(null);
                                  setSobreColumnaId(null);
                                  setHueco(null);
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                      {hueco?.columnaId === col.id &&
                      hueco.indice === sinArrastre.length ? (
                        <HuecoDrop />
                      ) : null}
                    </>
                  )}
                </div>

                <form
                  className="flex gap-1.5 items-stretch pt-1 border-t border-linea shrink-0"
                  action={(fd) => {
                    startTransition(async () => {
                      const r = await crearTareaProyecto(fd);
                      if (!r.ok) {
                        avisarError(avisar, r.motivo, true);
                        return;
                      }
                      setTareas(r.tareas);
                      setTareaAbiertaId(r.tarea.id);
                      if (r.calendarFallo) avisar("calendar_aviso");
                      const input = document.querySelector<HTMLInputElement>(
                        `input[data-rapida="${col.id}"]`,
                      );
                      if (input) input.value = "";
                    });
                  }}
                >
                  <input type="hidden" name="proyecto_id" value={proyectoId} />
                  <input type="hidden" name="columna_id" value={col.id} />
                  <input type="hidden" name="creada_por_id" value={yoId} />
                  <input type="hidden" name="rapida" value="1" />
                  <input
                    name="nombre"
                    required
                    maxLength={140}
                    data-rapida={col.id}
                    placeholder="Nueva tarea"
                    className="control h-9 px-2 text-[12px] flex-1 min-w-0 rounded-md"
                  />
                  <Boton
                    className="boton-sec h-9 w-9 p-0 shrink-0 grid place-items-center text-[16px] rounded-md"
                    textoEnviando="…"
                  >
                    +
                  </Boton>
                </form>
              </section>
              </div>
            </Fragment>
          );
        })}
        {(() => {
          const ultima = columnasSinArrastre[columnasSinArrastre.length - 1];
          const indiceHuecoFinal = ultima
            ? indiceInsercionColumna(ultima.id, false)
            : arrastrandoColumnaId
              ? 0
              : null;
          const origenArrastre = arrastrandoColumnaId
            ? columnasParaVista.findIndex((c) => c.id === arrastrandoColumnaId)
            : -1;
          const mostrarHuecoFinal =
            !!arrastrandoColumnaId &&
            huecoColumna !== null &&
            indiceHuecoFinal !== null &&
            huecoColumna === indiceHuecoFinal &&
            huecoColumna !== origenArrastre;
          if (!mostrarHuecoFinal || indiceHuecoFinal === null) return null;
          return (
            <HuecoColumnaDrop
              onDragOver={(e) => {
                if (!arrastrandoColumnaId) return;
                if (![...e.dataTransfer.types].includes(TIPO_COLUMNA)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setHuecoColumna((prev) =>
                  prev === indiceHuecoFinal ? prev : indiceHuecoFinal,
                );
              }}
              onDrop={(e) => {
                const columnaId = e.dataTransfer.getData(TIPO_COLUMNA);
                if (!columnaId) return;
                e.preventDefault();
                e.stopPropagation();
                const dest = huecoColumna ?? indiceHuecoFinal;
                setArrastrandoColumnaId(null);
                setHuecoColumna(null);
                moverColumnaDnD(columnaId, dest);
              }}
            />
          );
        })()}
      </div>

      {confirmar ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={confirmarId}
          onClick={() => setConfirmar(null)}
        >
          <div className="flex min-h-[100svh] items-start sm:items-center justify-center p-3 sm:p-4">
          <div
            className="w-full max-w-md max-h-[calc(100svh-3rem)] overflow-y-auto rounded-[12px] bg-papel border border-linea-fuerte shadow-suave p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="min-w-0 flex-1">
                <p className="etiqueta text-mal mb-1">Eliminar</p>
                <h2 id={confirmarId} className="font-display font-bold text-[20px] tracking-tight">
                  {confirmar.tipo === "tarea" ? "¿Eliminar esta tarea?" : "¿Eliminar este apartado?"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setConfirmar(null)}
                className="shrink-0 text-apagado hover:text-tinta text-[18px] leading-none px-1"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <p className="text-[13.5px] text-apagado mb-5">
              {confirmar.tipo === "tarea" ? (
                <>
                  Se eliminará <b className="text-tinta font-semibold">{confirmar.nombre}</b>.
                  Podrás restaurarla en Eliminados durante 30 días.
                </>
              ) : (
                <>
                  Se eliminará el apartado <b className="text-tinta font-semibold">{confirmar.nombre}</b>.
                  Sus tareas volverán a Por hacer.
                </>
              )}
            </p>

            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                className="h-10 px-4 rounded-lg text-[13.5px] font-semibold bg-mal-boton text-white hover:opacity-90"
                onClick={ejecutarBorrado}
              >
                {confirmar.tipo === "tarea" ? "Eliminar tarea" : "Eliminar apartado"}
              </button>
              <button
                type="button"
                className="boton-sec h-10"
                onClick={() => setConfirmar(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
          </div>
        </div>
      ) : null}

      {tareaAbierta ? (
        <DetalleTarea
          t={tareaAbierta}
          proyectoId={proyectoId}
          proyectoColaboradorIds={colaboradorIds}
          equipo={equipo}
          yoId={yoId}
          clienteNombre={clienteNombre}
          proyectoEtiqueta={tituloProyecto}
          puedeGestionarProyecto={puedeGestionarProyecto}
          puedeCambiarSolicitante={puedeCambiarSolicitante}
          onCerrar={() => setTareaAbiertaId(null)}
          onGuardar={(tarea) => {
            parchearTarea(tarea.id, tarea);
          }}
          onBorrar={(tareaId) => {
            setTareas((prev) => prev.filter((x) => x.id !== tareaId));
          }}
          onChecklistAdd={(tareaId, item) => {
            parchearTarea(tareaId, (prev) => ({
              ...prev,
              checklist: [...prev.checklist, item],
            }));
          }}
          onChecklistToggle={(tareaId, item) => {
            parchearTarea(tareaId, (prev) => ({
              ...prev,
              checklist: prev.checklist.map((c) => (c.id === item.id ? item : c)),
            }));
          }}
          startTransition={startTransition}
        />
      ) : null}
    </>
  );
}

function HuecoDrop() {
  return (
    <div
      className="min-h-[72px] rounded-lg border-2 border-dashed border-magenta bg-magenta-suave/60 mx-0.5"
      aria-hidden="true"
    />
  );
}

function HuecoColumnaDrop({
  onDragOver,
  onDrop,
}: {
  onDragOver?: (e: DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className={`${COL_ANCHO} self-stretch rounded-lg border-2 border-dashed border-magenta bg-magenta-suave/60`}
      aria-hidden="true"
      onDragOver={onDragOver}
      onDrop={onDrop}
    />
  );
}

function TarjetaTarea({
  t,
  equipo,
  yoId,
  puedeMover = true,
  puedeCompletar = true,
  rechazada,
  onAbrir,
  onBorrar,
  onAlternarCompletada,
  arrastrando,
  destacada,
  pendiente,
  onDragInicio,
  onDragFin,
}: {
  t: Tarea;
  equipo: PersonaEquipo[];
  yoId: string;
  puedeMover?: boolean;
  puedeCompletar?: boolean;
  rechazada?: boolean;
  onAbrir: () => void;
  onBorrar: () => void;
  onAlternarCompletada: () => void;
  arrastrando?: boolean;
  destacada?: boolean;
  pendiente?: boolean;
  onDragInicio?: () => void;
  onDragFin?: () => void;
}) {
  const v = vencimiento(t.fechaMaxima);
  const responsables = t.responsableIds
    .map((id) => equipo.find((p) => p.id === id) ?? null)
    .filter((p): p is PersonaEquipo => p !== null);
  const esMia = t.responsableIds.includes(yoId);
  const hecha = Boolean(t.completadaEl);
  const omitirClick = useRef(false);

  return (
    <div
      draggable={puedeMover}
      onDragStart={(e) => {
        if (!puedeMover) {
          e.preventDefault();
          return;
        }
        omitirClick.current = true;
        e.dataTransfer.setData("text/plain", t.id);
        e.dataTransfer.effectAllowed = "move";
        onDragInicio?.();
      }}
      onDragEnd={() => onDragFin?.()}
      className={`w-full min-w-0 max-w-full overflow-hidden text-left rounded-lg hover:shadow-suave transition border-l-[3px] ${
        puedeMover ? "cursor-move" : "cursor-pointer"
      } ${hecha || rechazada ? "p-2" : "p-3"} ${
        rechazada
          ? "bg-mal-suave border border-mal-borde border-l-mal hover:border-mal"
          : esMia
            ? "bg-magenta-suave border border-magenta-borde border-l-magenta hover:border-magenta"
            : "bg-papel border border-linea border-l-transparent hover:border-magenta-borde"
      } ${arrastrando ? "opacity-40" : hecha && !rechazada ? "opacity-60" : ""} ${
        destacada ? "ring-2 ring-magenta shadow-suave" : ""
      }`}
    >
      <div className="flex items-start gap-1.5 min-w-0 w-full">
        <button
          type="button"
          title={hecha ? "Reabrir tarea" : "Marcar como completada"}
          aria-label={hecha ? `Reabrir ${t.nombre}` : `Completar ${t.nombre}`}
          aria-pressed={hecha}
          disabled={pendiente || !puedeCompletar}
          draggable={false}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onAlternarCompletada();
          }}
          className={`mt-0.5 size-5 shrink-0 rounded border grid place-items-center transition ${
            hecha
              ? "bg-magenta border-magenta text-white"
              : "border-apagado/80 bg-papel hover:border-magenta-borde text-transparent"
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
        <button
          type="button"
          title={t.nombre}
          onClick={() => {
            if (omitirClick.current) {
              omitirClick.current = false;
              return;
            }
            onAbrir();
          }}
          className={`font-semibold leading-snug flex-1 text-left min-w-0 overflow-hidden ${
            hecha
              ? "text-[12.5px] line-through text-apagado"
              : rechazada
                ? "text-[12.5px] text-apagado"
                : "text-[13.5px]"
          }`}
        >
          <span className="block truncate">{t.nombre}</span>
        </button>
        <div className="flex items-center gap-0.5 shrink-0 relative z-10">
          {rechazada ? (
            <span className="text-[9px] uppercase tracking-wide font-mono px-1.5 py-0.5 rounded bg-mal-suave text-mal border border-mal-borde">
              Rechazada
            </span>
          ) : (
            <span
              className={`text-[9px] uppercase tracking-wide font-mono px-1.5 py-0.5 rounded ${COLOR[t.prioridad]}`}
            >
              {t.prioridad}
            </span>
          )}
          <button
            type="button"
            title="Eliminar tarea"
            aria-label={`Eliminar tarea ${t.nombre}`}
            className="p-1 rounded-md text-apagado hover:text-mal hover:bg-mal-suave transition"
            onClick={(e) => {
              e.stopPropagation();
              onBorrar();
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
      {!hecha ? (
        <button
          type="button"
          onClick={() => {
            if (omitirClick.current) {
              omitirClick.current = false;
              return;
            }
            onAbrir();
          }}
          className="flex items-center gap-2 flex-wrap mt-2.5 text-[11.5px] text-apagado w-full text-left"
        >
          {v ? (
            <span className={v.tarde ? "text-magenta-texto font-semibold" : ""}>{v.texto}</span>
          ) : (
            <span className="text-apagado/60">Sin fecha máx.</span>
          )}
          {responsables.length > 0 ? (
            <span className="inline-flex -space-x-1.5">
              {responsables.slice(0, 3).map((p) => (
                <AvatarUsuario
                  key={p.id}
                  nombre={p.nombre}
                  avatarUrl={p.avatarUrl}
                  tamano="sm"
                  className="ring-2 ring-papel"
                />
              ))}
              {responsables.length > 3 ? (
                <span className="w-6 h-6 rounded-full bg-suave text-apagado grid place-items-center font-mono text-[9px] ring-2 ring-papel border border-linea">
                  +{responsables.length - 3}
                </span>
              ) : null}
            </span>
          ) : (
            <span
              className="w-6 h-6 rounded-full bg-suave text-apagado grid place-items-center font-mono text-[9px] border border-linea"
              title="Sin responsable"
            >
              —
            </span>
          )}
          {t.syncCalendar ? (
            <span title="En Google Calendar" className="text-apagado inline-flex">
              <IconoCalendario className="size-3.5" />
            </span>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}

