"use client";

import { useEffect, useRef, useState } from "react";
import {
  COLOR_DIFICULTAD,
  DIFICULTADES,
  PRIORIDADES,
  type Dificultad,
  type Prioridad,
  type Tarea,
} from "@/lib/tareas-mock";
import type { PersonaEquipo } from "@/lib/clientes-mock";
import { fecha } from "@/lib/formato";
import { CampoFecha } from "../campo-fecha";
import { Boton } from "../boton";
import { useAvisos } from "../avisos-ui";
import { avisoDeMotivo } from "@/lib/avisos";
import {
  alternarChecklist,
  anadirItemChecklist,
  borrarTareaProyecto,
  editarTareaProyecto,
  guardarResponsablesTarea,
  guardarNotasTarea,
} from "../proyectos/acciones";
import { marcarTareaVistaAction } from "./acciones";
import { marcarChatTareaVistoAction } from "./acciones-chat";
import { ChatTarea } from "./chat-tarea";
import { AdjuntosTarea } from "./adjuntos-tarea";
import { PuntoNovedad } from "../punto-novedad";

const COLOR: Record<Prioridad, string> = {
  baja: "bg-[#64748b]/15 text-[#475569] border border-[#64748b]/40",
  media: "bg-[#2563eb]/15 text-[#1d4ed8] border border-[#2563eb]/45",
  alta: "bg-[#d97706] text-white border border-[#d97706]",
  urgente: "bg-mal-boton text-white border border-mal-boton",
};

function avisarError(avisar: (c: string) => void, motivo: string, comoTarea = false) {
  if (comoTarea && motivo === "falta_dato") {
    avisar("tarea_sin_nombre");
    return;
  }
  avisar(avisoDeMotivo(motivo));
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

function IconoPapelera({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DetalleTarea({
  t,
  proyectoId,
  proyectoColaboradorIds,
  equipo,
  yoId,
  clienteNombre = null,
  proyectoEtiqueta = null,
  chatSinLeer = false,
  puedeGestionarProyecto = false,
  puedeCambiarSolicitante = false,
  onChatLeido,
  onCerrar,
  onGuardar,
  onBorrar,
  onChecklistAdd,
  onChecklistToggle,
  startTransition,
}: {
  t: Tarea;
  proyectoId: string;
  proyectoColaboradorIds: string[];
  equipo: PersonaEquipo[];
  yoId: string;
  clienteNombre?: string | null;
  proyectoEtiqueta?: string | null;
  chatSinLeer?: boolean;
  /** Responsable de cliente/proyecto o dueño personal. */
  puedeGestionarProyecto?: boolean;
  puedeCambiarSolicitante?: boolean;
  onChatLeido?: () => void;
  onCerrar: () => void;
  onGuardar: (tarea: Tarea) => void;
  onBorrar?: (tareaId: string) => void;
  onChecklistAdd: (tareaId: string, item: Tarea["checklist"][number]) => void;
  onChecklistToggle: (tareaId: string, item: Tarea["checklist"][number]) => void;
  startTransition: (cb: () => void) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const notasRef = useRef<HTMLTextAreaElement>(null);
  const debounceNombreRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceNotasRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCerrarRef = useRef(onCerrar);
  const onGuardarRef = useRef(onGuardar);
  const startTransitionRef = useRef(startTransition);
  const { avisar } = useAvisos();
  const avisarRef = useRef(avisar);
  onCerrarRef.current = onCerrar;
  onGuardarRef.current = onGuardar;
  startTransitionRef.current = startTransition;
  avisarRef.current = avisar;

  const textoNotasInicial = t.notas.map((n) => n.texto).join("\n\n");
  const [fechaPrevista, setFechaPrevista] = useState(t.fechaPrevista ?? "");
  const [fechaMaxima, setFechaMaxima] = useState(t.fechaMaxima ?? "");
  const [syncCalendar, setSyncCalendar] = useState(t.syncCalendar);
  const [notificarAsignado, setNotificarAsignado] = useState(t.notificarAsignado);
  const [prioridad, setPrioridad] = useState<Prioridad>(t.prioridad);
  const [dificultad, setDificultad] = useState<Dificultad>(t.dificultad);
  const [responsables, setResponsables] = useState(t.responsableIds);
  const [menu, setMenu] = useState<null | "prioridad" | "dificultad" | "extras" | "responsables">(
    null,
  );
  const [chatAbierto, setChatAbierto] = useState(true);
  const [chatPendiente, setChatPendiente] = useState(chatSinLeer);
  const [confirmandoBorrar, setConfirmandoBorrar] = useState(false);
  const formId = `editar-tarea-${t.id}`;

  const esSolicitante = t.mandadaPorId === yoId;
  const esAsignado = t.responsableIds.includes(yoId);
  const puedeEditar = puedeGestionarProyecto || esSolicitante || esAsignado;
  const puedeBorrar = puedeGestionarProyecto || esSolicitante;
  const puedeCambiarAsignadosUi = puedeGestionarProyecto || esSolicitante;
  const puedeToggleNotificar = puedeGestionarProyecto || esSolicitante;
  const soloLectura = !puedeEditar;

  useEffect(() => {
    void marcarTareaVistaAction(t.id);
  }, [t.id]);

  useEffect(() => {
    setChatPendiente(chatSinLeer);
  }, [t.id, chatSinLeer]);

  function abrirChat() {
    setChatAbierto(true);
    setChatPendiente(false);
    onChatLeido?.();
    void marcarChatTareaVistoAction(t.id);
  }

  useEffect(() => {
    setChatAbierto(true);
    setChatPendiente(false);
    onChatLeido?.();
    void marcarChatTareaVistoAction(t.id);
    // Solo al abrir/cambiar tarea; onChatLeido suele ser inline en el padre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.id]);

  function ejecutarBorrado() {
    const fd = new FormData();
    fd.set("tarea_id", t.id);
    setConfirmandoBorrar(false);
    startTransition(async () => {
      const r = await borrarTareaProyecto(fd);
      if (!r.ok) {
        avisarError(avisar, r.motivo);
        return;
      }
      avisar("tarea_eliminada");
      onBorrar?.(t.id);
      onCerrar();
    });
  }

  const poolProyecto = equipo.filter((p) => proyectoColaboradorIds.includes(p.id));

  function guardarResponsables(ids: string[]) {
    setResponsables(ids);
    const fd = new FormData();
    fd.set("tarea_id", t.id);
    for (const id of ids) fd.append("responsable_ids", id);
    startTransitionRef.current(async () => {
      const r = await guardarResponsablesTarea(fd);
      if (!r.ok) {
        avisarError(avisarRef.current, r.motivo);
        return;
      }
      onGuardarRef.current(r.tarea);
    });
  }

  function guardarDatos(extra?: {
    prevista?: string;
    maxima?: string;
    prioridad?: Prioridad;
    dificultad?: Dificultad;
    syncCalendar?: boolean;
    notificarAsignado?: boolean;
  }) {
    if (soloLectura) return;
    const form = formRef.current;
    if (!form || !form.checkValidity()) return;
    const fd = new FormData(form);
    if (extra?.prevista !== undefined) fd.set("fecha_prevista", extra.prevista);
    if (extra?.maxima !== undefined) fd.set("fecha_maxima", extra.maxima);
    if (extra?.prioridad !== undefined) fd.set("prioridad", extra.prioridad);
    if (extra?.dificultad !== undefined) fd.set("dificultad", String(extra.dificultad));
    if (extra?.syncCalendar !== undefined) {
      if (extra.syncCalendar) fd.set("sync_calendar", "on");
      else fd.delete("sync_calendar");
    }
    if (extra?.notificarAsignado !== undefined) {
      if (extra.notificarAsignado) fd.set("notificar_asignado", "on");
      else fd.delete("notificar_asignado");
    }
    startTransitionRef.current(async () => {
      const r = await editarTareaProyecto(fd);
      if (!r.ok) {
        avisarError(avisarRef.current, r.motivo, true);
        return;
      }
      onGuardarRef.current(r.tarea);
      if (r.calendarFallo) avisarRef.current("calendar_aviso");
    });
  }

  function onFechaPrevista(v: string) {
    if (soloLectura) return;
    const next = fechaMaxima && v && v > fechaMaxima ? fechaMaxima : v;
    setFechaPrevista(next);
    if (debounceNombreRef.current) {
      clearTimeout(debounceNombreRef.current);
      debounceNombreRef.current = null;
    }
    guardarDatos({ prevista: next, maxima: fechaMaxima });
  }

  function onFechaMaxima(v: string) {
    if (soloLectura) return;
    setFechaMaxima(v);
    let prevista = fechaPrevista;
    if (prevista && v && prevista > v) {
      prevista = v;
      setFechaPrevista(prevista);
    }
    const sync = v ? true : syncCalendar;
    if (v) setSyncCalendar(true);
    if (debounceNombreRef.current) {
      clearTimeout(debounceNombreRef.current);
      debounceNombreRef.current = null;
    }
    guardarDatos({ prevista, maxima: v, syncCalendar: sync });
  }

  function onPrioridad(p: Prioridad) {
    setPrioridad(p);
    if (debounceNombreRef.current) {
      clearTimeout(debounceNombreRef.current);
      debounceNombreRef.current = null;
    }
    guardarDatos({ prioridad: p });
    setMenu(null);
  }

  function onDificultad(d: Dificultad) {
    setDificultad(d);
    if (debounceNombreRef.current) {
      clearTimeout(debounceNombreRef.current);
      debounceNombreRef.current = null;
    }
    guardarDatos({ dificultad: d });
    setMenu(null);
  }

  function guardarNotas() {
    const area = notasRef.current;
    if (!area) return;
    const fd = new FormData();
    fd.set("tarea_id", t.id);
    fd.set("texto", area.value);
    fd.set("autor_id", yoId);
    startTransitionRef.current(async () => {
      const r = await guardarNotasTarea(fd);
      if (!r.ok) {
        avisarError(avisarRef.current, r.motivo);
        return;
      }
      onGuardarRef.current(r.tarea);
    });
  }

  function flushPendientes() {
    if (debounceNombreRef.current) {
      clearTimeout(debounceNombreRef.current);
      debounceNombreRef.current = null;
      guardarDatos();
    }
    if (debounceNotasRef.current) {
      clearTimeout(debounceNotasRef.current);
      debounceNotasRef.current = null;
      guardarNotas();
    }
  }

  function onCambioInmediato() {
    if (debounceNombreRef.current) {
      clearTimeout(debounceNombreRef.current);
      debounceNombreRef.current = null;
    }
    guardarDatos();
  }

  function onCambioNombre() {
    if (debounceNombreRef.current) clearTimeout(debounceNombreRef.current);
    debounceNombreRef.current = setTimeout(() => {
      debounceNombreRef.current = null;
      guardarDatos();
    }, 400);
  }

  function ajustarAlturaNotas() {
    const area = notasRef.current;
    if (!area) return;
    area.style.height = "auto";
    area.style.height = `${Math.max(area.scrollHeight, 140)}px`;
  }

  function onCambioNotas() {
    ajustarAlturaNotas();
    if (debounceNotasRef.current) clearTimeout(debounceNotasRef.current);
    debounceNotasRef.current = setTimeout(() => {
      debounceNotasRef.current = null;
      guardarNotas();
    }, 400);
  }

  function cerrar() {
    flushPendientes();
    setChatAbierto(false);
    onCerrar();
  }

  const flushRef = useRef(flushPendientes);
  flushRef.current = flushPendientes;

  useEffect(() => {
    setResponsables(t.responsableIds);
    setFechaPrevista(t.fechaPrevista ?? "");
    setFechaMaxima(t.fechaMaxima ?? "");
    setSyncCalendar(t.syncCalendar);
    setNotificarAsignado(t.notificarAsignado);
    setPrioridad(t.prioridad);
    setDificultad(t.dificultad);
  }, [
    t.id,
    t.responsableIds,
    t.fechaPrevista,
    t.fechaMaxima,
    t.syncCalendar,
    t.notificarAsignado,
    t.prioridad,
    t.dificultad,
  ]);

  useEffect(() => {
    ajustarAlturaNotas();
  }, [t.id, textoNotasInicial]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (menu) {
        e.stopImmediatePropagation();
        setMenu(null);
        return;
      }
      if (chatAbierto) {
        e.stopImmediatePropagation();
        setChatAbierto(false);
        return;
      }
      e.stopImmediatePropagation();
      flushRef.current();
      onCerrarRef.current();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [menu, chatAbierto]);

  useEffect(() => {
    if (!menu && !confirmandoBorrar) return;
    function onDoc(e: MouseEvent) {
      const nodo = e.target as HTMLElement | null;
      if (nodo?.closest("[data-menu-tarea]")) return;
      setMenu(null);
      setConfirmandoBorrar(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menu, confirmandoBorrar]);

  const btnHeader =
    "boton-sec h-11 px-2.5 text-[12.5px] leading-none shrink-0";
  const labelCampo = "text-[12px] font-semibold uppercase tracking-wide text-apagado";
  const inputCampo =
    "control h-11 w-full text-[14px]";
  const metaProyecto = [clienteNombre, proyectoEtiqueta].filter(Boolean).join(" · ");

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`tarea-${t.id}-titulo`}
      onClick={cerrar}
    >
      <div className="flex min-h-[100svh] items-start sm:items-center justify-center py-3 px-3 sm:py-4 sm:px-4">
      <div
        className={`relative flex flex-col xl:flex-row gap-3 w-full items-stretch my-auto ${
          chatAbierto ? "max-w-[min(100%,calc(48rem+0.75rem+20rem))]" : "max-w-3xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full max-w-3xl min-h-0 max-h-[calc(100svh-3rem)] overflow-y-auto rounded-[14px] bg-papel border border-linea-fuerte shadow-suave p-4 sm:p-5">
        <div className="grid gap-3 mb-5">
          <div className="min-w-0 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="etiqueta text-magenta-texto mb-1.5">Tarea</p>
              <input
                id={`tarea-${t.id}-titulo`}
                form={formId}
                name="nombre"
                required
                maxLength={140}
                defaultValue={t.nombre}
                key={`nombre-${t.id}`}
                readOnly={soloLectura}
                onChange={soloLectura ? undefined : onCambioNombre}
                onBlur={soloLectura ? undefined : onCambioInmediato}
                aria-label="Nombre de la tarea"
                className={`w-full bg-transparent border-0 border-b border-transparent rounded-none px-0 py-1 font-display font-bold text-[22px] sm:text-[24px] tracking-tight leading-tight text-tinta focus:outline-none ${
                  soloLectura ? "cursor-default" : "focus:border-magenta-borde"
                }`}
              />
            </div>
            <button
              type="button"
              onClick={cerrar}
              className="shrink-0 text-apagado hover:text-tinta text-[22px] leading-none px-1.5 mt-0.5"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>

          <div className="grid gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-x-5">
              <div className="grid gap-0.5 min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-apagado">
                  Creada
                </span>
                <p className="text-[12.5px] text-tinta whitespace-nowrap">
                  {fecha(t.creadoEl)}
                </p>
              </div>

              {t.completadaEl ? (
                <span
                  className="inline-flex h-11 items-center rounded-lg border border-bien-borde bg-bien-suave px-2.5 text-[12.5px] font-semibold leading-none text-bien shrink-0"
                  title={`Completada el ${fecha(t.completadaEl)}`}
                  aria-label={`Completada el ${fecha(t.completadaEl)}`}
                >
                  Completada
                </span>
              ) : null}

              <label
                className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-linea bg-papel px-2.5 transition shrink-0 ${
                  soloLectura
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer hover:border-magenta-borde"
                }`}
                title="Sincronizar fecha límite con Google Calendar"
              >
                <input
                  form={formId}
                  type="checkbox"
                  name="sync_calendar"
                  checked={syncCalendar}
                  disabled={soloLectura}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setSyncCalendar(next);
                    if (debounceNombreRef.current) {
                      clearTimeout(debounceNombreRef.current);
                      debounceNombreRef.current = null;
                    }
                    guardarDatos({ syncCalendar: next });
                  }}
                  className="accent-[var(--magenta)] size-3.5 shrink-0"
                  aria-label="Sincronizar con Google Calendar"
                />
                <IconoCalendario className="shrink-0 size-4 text-tinta" />
              </label>

              <div className="relative" data-menu-tarea>
                <button
                  type="button"
                  disabled={soloLectura}
                  className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[12.5px] leading-none transition shrink-0 hover:brightness-95 disabled:opacity-60 disabled:cursor-not-allowed ${COLOR[prioridad]}`}
                  aria-expanded={menu === "prioridad"}
                  onClick={() => setMenu((m) => (m === "prioridad" ? null : "prioridad"))}
                >
                  <span className="opacity-80 font-medium">Prioridad</span>
                  <span className="font-semibold uppercase tracking-wide">{prioridad}</span>
                </button>
                {menu === "prioridad" ? (
                  <div className="absolute left-0 top-full mt-1 z-[60] min-w-[160px] rounded-xl border border-linea-fuerte bg-papel p-2 shadow-suave grid gap-1">
                    {PRIORIDADES.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => onPrioridad(p)}
                        className={`text-left px-3 py-2 rounded-lg text-[13.5px] hover:bg-fila-hover transition ${
                          p === prioridad ? "bg-suave font-semibold" : ""
                        }`}
                      >
                        <span
                          className={`inline-block text-[11px] uppercase font-mono px-1.5 py-0.5 rounded ${COLOR[p]}`}
                        >
                          {p}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="relative" data-menu-tarea>
                <button
                  type="button"
                  disabled={soloLectura}
                  className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[12.5px] leading-none transition shrink-0 hover:brightness-95 disabled:opacity-60 disabled:cursor-not-allowed ${COLOR_DIFICULTAD[dificultad]}`}
                  aria-expanded={menu === "dificultad"}
                  onClick={() => setMenu((m) => (m === "dificultad" ? null : "dificultad"))}
                >
                  <span className="opacity-80 font-medium">Dificultad</span>
                  <span className="font-semibold font-mono tracking-wide">{dificultad}</span>
                </button>
                {menu === "dificultad" ? (
                  <div className="absolute left-0 top-full mt-1 z-[60] min-w-[160px] rounded-xl border border-linea-fuerte bg-papel p-2 shadow-suave grid gap-1">
                    {DIFICULTADES.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => onDificultad(d)}
                        className={`text-left px-3 py-2 rounded-lg text-[13.5px] hover:bg-fila-hover transition ${
                          d === dificultad ? "bg-suave font-semibold" : ""
                        }`}
                      >
                        <span
                          className={`inline-block text-[11px] font-mono px-1.5 py-0.5 rounded ${COLOR_DIFICULTAD[d]}`}
                        >
                          {d}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                className={`${btnHeader} relative ${chatAbierto ? "border-magenta text-magenta-texto" : ""}`}
                aria-expanded={chatAbierto}
                aria-controls={`chat-panel-${t.id}`}
                onClick={() => (chatAbierto ? setChatAbierto(false) : abrirChat())}
              >
                Chat
                {chatPendiente ? (
                  <PuntoNovedad className="absolute -top-0.5 -right-0.5" />
                ) : null}
              </button>
            </div>
            {metaProyecto ? (
              <p
                className="text-[11.5px] text-apagado truncate max-w-[min(100%,20rem)]"
                title={metaProyecto}
              >
                {metaProyecto}
              </p>
            ) : null}
          </div>
        </div>

        <div className="min-w-0 grid gap-4 content-start">
          <form
            id={formId}
            ref={formRef}
            key={`edit-${t.id}`}
            className="grid gap-3"
            onSubmit={(e) => e.preventDefault()}
          >
            <input type="hidden" name="tarea_id" value={t.id} />
            <input type="hidden" name="fecha_prevista" value={fechaPrevista} />
            <input type="hidden" name="fecha_maxima" value={fechaMaxima} />
            <input type="hidden" name="prioridad" value={prioridad} />
            <input type="hidden" name="dificultad" value={dificultad} />
            <label className="grid gap-1.5">
              <span className={labelCampo}>Notas</span>
              <textarea
                ref={notasRef}
                key={`notas-${t.id}`}
                rows={7}
                maxLength={10000}
                defaultValue={textoNotasInicial}
                onChange={onCambioNotas}
                onBlur={() => {
                  if (debounceNotasRef.current) {
                    clearTimeout(debounceNotasRef.current);
                    debounceNotasRef.current = null;
                  }
                  guardarNotas();
                }}
                placeholder="Escribe notas…"
                className="control rounded-xl px-3.5 py-3 text-[14.5px] leading-relaxed resize-none overflow-hidden min-h-[7rem]"
              />
            </label>
          </form>

          <div className="grid gap-3">
            <div className="grid gap-1.5 relative min-w-0 content-start" data-menu-tarea>
              <span className={labelCampo}>Asignado</span>
              <button
                type="button"
                disabled={!puedeCambiarAsignadosUi}
                className={`${inputCampo} inline-flex items-center justify-between gap-2 text-left transition disabled:opacity-60 disabled:cursor-not-allowed ${
                  puedeCambiarAsignadosUi ? "hover:border-magenta-borde hover:bg-magenta-suave" : ""
                }`}
                aria-expanded={menu === "responsables"}
                onClick={() => {
                  if (!puedeCambiarAsignadosUi) return;
                  setMenu((m) => (m === "responsables" ? null : "responsables"));
                }}
              >
                <span className={responsables.length ? "text-tinta truncate" : "text-apagado"}>
                  {responsables.length
                    ? responsables
                        .map((id) => equipo.find((p) => p.id === id)?.nombre)
                        .filter(Boolean)
                        .join(", ")
                    : "Elegir…"}
                </span>
                <span className="text-apagado font-mono text-[12px] shrink-0 min-w-[1.25rem] text-center">
                  {responsables.length || ""}
                </span>
              </button>
              {menu === "responsables" ? (
                <div className="absolute left-0 right-0 bottom-full mb-1 z-[60] rounded-xl border border-linea-fuerte bg-papel p-3 shadow-suave max-h-[min(50vh,280px)] overflow-y-auto">
                  {poolProyecto.length === 0 ? (
                    <p className="text-[13px] text-apagado">
                      Añade colaboradores al proyecto para poder asignar responsables.
                    </p>
                  ) : (
                    <ul className="grid gap-2">
                      {poolProyecto.map((p) => {
                        const marcado = responsables.includes(p.id);
                        return (
                          <li key={p.id}>
                            <label className="flex items-center gap-2.5 text-[14px] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={marcado}
                                className="accent-[var(--magenta)] size-4"
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...responsables, p.id]
                                    : responsables.filter((id) => id !== p.id);
                                  guardarResponsables(next);
                                }}
                              />
                              <span className="min-w-0 truncate">{p.nombre}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>

            <label
              className={`inline-flex items-center gap-2.5 text-[13.5px] ${
                puedeToggleNotificar
                  ? "cursor-pointer text-tinta"
                  : "cursor-not-allowed text-apagado"
              }`}
              title={
                puedeToggleNotificar
                  ? "Avisar por correo a los asignados"
                  : "Solo el solicitante o gestores del proyecto pueden activar la notificación"
              }
            >
              <input
                form={formId}
                type="checkbox"
                name="notificar_asignado"
                checked={notificarAsignado}
                disabled={!puedeToggleNotificar}
                onChange={(e) => {
                  const next = e.target.checked;
                  setNotificarAsignado(next);
                  if (debounceNombreRef.current) {
                    clearTimeout(debounceNombreRef.current);
                    debounceNombreRef.current = null;
                  }
                  guardarDatos({ notificarAsignado: next });
                }}
                className="accent-[var(--magenta)] size-4 shrink-0 disabled:opacity-50"
                aria-label="Notificar por correo a los asignados"
              />
              <span>Notificar por correo a los asignados</span>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 min-w-0 content-start">
                <span className={labelCampo}>Solicitante</span>
                <select
                  form={formId}
                  name="mandada_por_id"
                  defaultValue={t.mandadaPorId ?? ""}
                  key={`mandada-${t.id}-${t.mandadaPorId ?? ""}`}
                  disabled={!puedeCambiarSolicitante}
                  onChange={puedeCambiarSolicitante ? onCambioInmediato : undefined}
                  className={`${inputCampo} disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  <option value="">—</option>
                  {poolProyecto.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                  {t.mandadaPorId &&
                  !poolProyecto.some((p) => p.id === t.mandadaPorId) ? (
                    <option value={t.mandadaPorId}>
                      {equipo.find((p) => p.id === t.mandadaPorId)?.nombre ??
                        "Solicitante actual"}
                    </option>
                  ) : null}
                </select>
              </label>

              <div className="grid gap-1.5 min-w-0 content-start">
                <span className={labelCampo}>Fecha límite</span>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <CampoFecha
                      etiqueta="Fecha máxima"
                      mostrarEtiqueta={false}
                      value={fechaMaxima}
                      min={fechaPrevista || undefined}
                      onChange={onFechaMaxima}
                      disabled={soloLectura}
                      botonClassName="!h-11 text-[14px] px-3"
                    />
                  </div>
                  <div className="relative shrink-0 flex items-center gap-1.5" data-menu-tarea>
                    <button
                      type="button"
                      className={`h-11 w-11 inline-flex items-center justify-center rounded-lg border border-linea bg-papel text-[22px] leading-none text-apagado hover:border-magenta-borde hover:bg-magenta-suave hover:text-tinta transition ${
                        menu === "extras" ? "border-magenta text-tinta" : ""
                      }`}
                      aria-label="Extras"
                      aria-expanded={menu === "extras"}
                      onClick={() => {
                        setConfirmandoBorrar(false);
                        setMenu((m) => (m === "extras" ? null : "extras"));
                      }}
                    >
                      ⋯
                    </button>
                    <div className="relative">
                      {puedeBorrar ? (
                        <>
                          <button
                            type="button"
                            title="Eliminar tarea"
                            aria-label={`Eliminar tarea ${t.nombre}`}
                            aria-expanded={confirmandoBorrar}
                            className={`h-11 w-11 inline-flex items-center justify-center rounded-lg border bg-papel transition ${
                              confirmandoBorrar
                                ? "border-mal-borde text-mal bg-mal-suave"
                                : "border-linea text-apagado hover:text-mal hover:bg-mal-suave hover:border-mal-borde"
                            }`}
                            onClick={() => {
                              setMenu(null);
                              setConfirmandoBorrar((v) => !v);
                            }}
                          >
                            <IconoPapelera />
                          </button>
                          {confirmandoBorrar ? (
                            <div className="absolute right-0 bottom-full mb-1 z-[60] w-[220px] rounded-xl border border-linea bg-papel p-3 shadow-xl grid gap-2">
                              <p className="text-[13px] text-tinta leading-snug">
                                ¿Eliminar esta tarea? Podrás restaurarla en Eliminados (30 días).
                              </p>
                              <div className="flex gap-2 justify-end">
                                <button
                                  type="button"
                                  className="px-2.5 py-1.5 rounded-lg border border-linea text-[12.5px] text-apagado hover:text-tinta transition"
                                  onClick={() => setConfirmandoBorrar(false)}
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  className="px-2.5 py-1.5 rounded-lg bg-mal-boton text-white text-[12.5px] font-semibold hover:opacity-90 transition"
                                  onClick={ejecutarBorrado}
                                >
                                  Eliminar
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                    {menu === "extras" ? (
                      <div className="absolute right-0 bottom-full mb-1 z-[60] w-[min(100vw-2rem,360px)] rounded-xl border border-linea-fuerte bg-papel p-3.5 shadow-suave grid gap-4 max-h-[min(70vh,520px)] overflow-y-auto">
                        <AdjuntosTarea tareaId={t.id} yoId={yoId} />

                        <div className="grid gap-1.5">
                          <CampoFecha
                            etiqueta="Fecha prevista"
                            value={fechaPrevista}
                            max={fechaMaxima || undefined}
                            onChange={onFechaPrevista}
                            disabled={soloLectura}
                          />
                        </div>

                        <div className="grid gap-1.5">
                          <span className={labelCampo}>Checklist</span>
                          <ul className="grid gap-1.5 mb-1 max-h-52 overflow-y-auto">
                            {t.checklist.length === 0 ? (
                              <li className="text-apagado text-[13px]">Vacío.</li>
                            ) : (
                              t.checklist.map((item) => (
                                <li key={item.id}>
                                  {soloLectura ? (
                                    <p
                                      className={`text-[13.5px] ${
                                        item.hecho ? "line-through text-apagado" : ""
                                      }`}
                                    >
                                      {item.hecho ? "☑" : "☐"} {item.texto}
                                    </p>
                                  ) : (
                                    <form
                                      action={(fd) => {
                                        startTransition(async () => {
                                          const r = await alternarChecklist(fd);
                                          if (!r.ok) {
                                            avisarError(avisar, r.motivo);
                                            return;
                                          }
                                          onChecklistToggle(t.id, r.item);
                                        });
                                      }}
                                    >
                                      <input type="hidden" name="proyecto_id" value={proyectoId} />
                                      <input type="hidden" name="tarea_id" value={t.id} />
                                      <input type="hidden" name="item_id" value={item.id} />
                                      <button
                                        type="submit"
                                        className={`text-left w-full text-[13.5px] ${
                                          item.hecho ? "line-through text-apagado" : ""
                                        }`}
                                      >
                                        {item.hecho ? "☑" : "☐"} {item.texto}
                                      </button>
                                    </form>
                                  )}
                                </li>
                              ))
                            )}
                          </ul>
                          {!soloLectura ? (
                            <form
                              className="flex gap-1.5 items-stretch"
                              action={(fd) => {
                                startTransition(async () => {
                                  const r = await anadirItemChecklist(fd);
                                  if (!r.ok) {
                                    avisarError(avisar, r.motivo);
                                    return;
                                  }
                                  onChecklistAdd(t.id, r.item);
                                });
                                queueMicrotask(() => {
                                  const input = document.querySelector<HTMLInputElement>(
                                    `input[name="texto"][data-tarea="${t.id}"]`,
                                  );
                                  if (input) input.value = "";
                                });
                              }}
                            >
                              <input type="hidden" name="proyecto_id" value={proyectoId} />
                              <input type="hidden" name="tarea_id" value={t.id} />
                              <input
                                name="texto"
                                required
                                maxLength={500}
                                data-tarea={t.id}
                                placeholder="Nuevo ítem"
                                className="control h-10 px-2.5 text-[13px] flex-1 min-w-0"
                              />
                              <Boton
                                className="boton-sec h-10 w-10 p-0 shrink-0 grid place-items-center text-[16px]"
                                textoEnviando="…"
                              >
                                +
                              </Boton>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>

        <aside
          id={`chat-panel-${t.id}`}
          aria-hidden={!chatAbierto}
          className={`w-full xl:w-80 shrink-0 flex flex-col rounded-[14px] border border-linea-fuerte bg-papel shadow-suave overflow-hidden max-h-[min(20rem,calc(100svh-3rem))] xl:max-h-[calc(100svh-3rem)] transition-opacity duration-300 ease-out ${
            chatAbierto ? "opacity-100" : "hidden"
          }`}
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-linea shrink-0">
            <p className="text-[13px] font-semibold text-tinta">Chat de la tarea</p>
            <button
              type="button"
              onClick={() => setChatAbierto(false)}
              className="text-apagado hover:text-tinta text-[20px] leading-none px-1"
              aria-label="Cerrar chat"
            >
              ×
            </button>
          </div>
          <div className="flex-1 min-h-0 p-3">
            {chatAbierto ? (
              <ChatTarea
                tareaId={t.id}
                yoId={yoId}
                equipo={equipo}
                className="h-full flex flex-col border-0 rounded-none shadow-none"
                listaClassName="flex-1 min-h-0 overflow-y-auto grid gap-2 p-1 content-start"
                onVisto={() => {
                  setChatPendiente(false);
                  onChatLeido?.();
                }}
              />
            ) : null}
          </div>
        </aside>
      </div>
      </div>
    </div>
  );
}
