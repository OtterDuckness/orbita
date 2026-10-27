"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ESTADOS_PROYECTO,
  PRIORIDADES_PROYECTO,
  type EstadoProyecto,
  type PersonaEquipo,
  type PrioridadProyecto,
  type TipoProyecto,
} from "@/lib/clientes-mock";
import { type ProyectoVista } from "@/lib/tareas-mock";
import { Boton } from "../boton";
import { archivarTodoTerminadoLista } from "./acciones";
import { VistaKanbanProyectos } from "./vista-kanban-proyectos";
import { VistaListaProyectos } from "./vista-lista-proyectos";
import { VistaTablaProyectos } from "./vista-tabla-proyectos";

const selectCls = "control h-[38px] min-w-[9rem]";
const btnSec = "boton-sec text-[12px] px-2.5 py-1 shrink-0";

const VISTA_KEY = "orbita.proyectos.vista";
const AMBITO_KEY = "orbita.proyectos.ambito";
type VistaModo = "lista" | "tabla" | "kanban";
type AmbitoTab = "externo" | "interno";

const VISTAS: { id: VistaModo; etiqueta: string }[] = [
  { id: "lista", etiqueta: "Lista" },
  { id: "tabla", etiqueta: "Tarjetas" },
  { id: "kanban", etiqueta: "Kanban" },
];

const AMBITOS: { id: AmbitoTab; etiqueta: string }[] = [
  { id: "externo", etiqueta: "Externos" },
  { id: "interno", etiqueta: "Internos" },
];

function etiquetaEstado(estado: EstadoProyecto) {
  if (estado === "terminado") return "Terminado";
  if (estado === "archivado") return "Archivado";
  return "Activo";
}

function coincideTexto(p: ProyectoVista, q: string) {
  const haystack = [
    p.titulo,
    p.nombre ?? "",
    p.tipo,
    p.clienteNombre,
    p.responsableNombre ?? "",
    p.ambito === "interno" ? "interno" : "externo",
    p.prioridad,
    etiquetaEstado(p.estado),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function leerVistaGuardada(): VistaModo {
  if (typeof window === "undefined") return "lista";
  try {
    const v = window.localStorage.getItem(VISTA_KEY);
    if (v === "lista" || v === "tabla" || v === "kanban") return v;
  } catch {
    /* ignore */
  }
  return "lista";
}

function leerAmbitoGuardado(): AmbitoTab {
  if (typeof window === "undefined") return "externo";
  try {
    const v = window.localStorage.getItem(AMBITO_KEY);
    if (v === "externo" || v === "interno") return v;
  } catch {
    /* ignore */
  }
  return "externo";
}

export function ListaProyectos({
  proyectos,
  tipos,
  equipo,
  yoId,
  proyectoIdsNovedad = [],
}: {
  proyectos: ProyectoVista[];
  tipos: TipoProyecto[];
  equipo: PersonaEquipo[];
  yoId: string;
  proyectoIdsNovedad?: string[];
}) {
  const [consulta, setConsulta] = useState("");
  const [prioridad, setPrioridad] = useState("");
  const [tipoId, setTipoId] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [estado, setEstado] = useState<EstadoProyecto | "">("activo");
  const [vista, setVista] = useState<VistaModo>("lista");
  const [ambito, setAmbito] = useState<AmbitoTab>("externo");
  const q = consulta.trim().toLowerCase();
  const idsNovedad = useMemo(() => new Set(proyectoIdsNovedad), [proyectoIdsNovedad]);

  useEffect(() => {
    setVista(leerVistaGuardada());
    setAmbito(leerAmbitoGuardado());
  }, []);

  function cambiarVista(next: VistaModo) {
    setVista(next);
    try {
      window.localStorage.setItem(VISTA_KEY, next);
    } catch {
      /* ignore */
    }
  }

  function cambiarAmbito(next: AmbitoTab) {
    setAmbito(next);
    try {
      window.localStorage.setItem(AMBITO_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const responsablesOpciones = useMemo(() => {
    const ids = new Set(proyectos.map((p) => p.responsableId).filter(Boolean) as string[]);
    return equipo.filter((p) => ids.has(p.id)).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [proyectos, equipo]);

  const hayTerminados = useMemo(
    () => proyectos.some((p) => p.estado === "terminado"),
    [proyectos],
  );

  const filtrados = useMemo(() => {
    return proyectos.filter((p) => {
      if (q && !coincideTexto(p, q)) return false;
      if (prioridad && p.prioridad !== (prioridad as PrioridadProyecto)) return false;
      if (tipoId && p.tipoId !== tipoId) return false;
      if (estado && p.estado !== estado) return false;
      if (responsableId === "__ninguno__") {
        if (p.responsableId) return false;
      } else if (responsableId && p.responsableId !== responsableId) {
        return false;
      }
      return true;
    });
  }, [proyectos, q, prioridad, tipoId, responsableId, estado]);

  const externos = useMemo(
    () => filtrados.filter((p) => p.ambito === "externo"),
    [filtrados],
  );
  const internos = useMemo(
    () => filtrados.filter((p) => p.ambito === "interno"),
    [filtrados],
  );

  const hayFiltro = Boolean(q || prioridad || tipoId || responsableId || (estado && estado !== "activo"));

  function renderVista(lista: ProyectoVista[], agruparCliente: boolean) {
    if (vista === "lista") {
      return (
        <VistaListaProyectos
          proyectos={lista}
          tipos={tipos}
          equipo={equipo}
          yoId={yoId}
          idsNovedad={idsNovedad}
          ordenInicial={agruparCliente ? "cliente" : "fin"}
        />
      );
    }
    if (vista === "kanban") {
      return (
        <VistaKanbanProyectos
          proyectos={lista}
          tipos={tipos}
          equipo={equipo}
          idsNovedad={idsNovedad}
        />
      );
    }
    return (
      <VistaTablaProyectos
        proyectos={lista}
        tipos={tipos}
        equipo={equipo}
        yoId={yoId}
        idsNovedad={idsNovedad}
        agruparCliente={agruparCliente}
      />
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-3 items-end justify-between">
        <div className="flex flex-wrap gap-3 items-end flex-1 min-w-0">
          <label className="grid gap-1.5 min-w-[12rem] flex-1 max-w-md">
            <span className="etiqueta">Buscar</span>
            <input
              type="search"
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              placeholder="Tipo, cliente, responsable…"
              className="control h-[38px]"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="etiqueta">Estado</span>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoProyecto | "")}
              className={selectCls}
            >
              <option value="">Todos</option>
              {ESTADOS_PROYECTO.map((e) => (
                <option key={e} value={e}>
                  {etiquetaEstado(e)}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="etiqueta">Prioridad</span>
            <select
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value)}
              className={selectCls}
            >
              <option value="">Todas</option>
              {PRIORIDADES_PROYECTO.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="etiqueta">Tipo</span>
            <select value={tipoId} onChange={(e) => setTipoId(e.target.value)} className={selectCls}>
              <option value="">Todos</option>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="etiqueta">Responsable</span>
            <select
              value={responsableId}
              onChange={(e) => setResponsableId(e.target.value)}
              className={selectCls}
            >
              <option value="">Todos</option>
              <option value="__ninguno__">Sin responsable</option>
              {responsablesOpciones.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>

          {hayTerminados ? (
            <form action={archivarTodoTerminadoLista} className="shrink-0">
              <Boton className={btnSec} textoEnviando="Archivando…">
                Archivar todo terminado
              </Boton>
            </form>
          ) : null}
        </div>

        <div
          role="group"
          aria-label="Modo de vista"
          className="segmentado shrink-0 self-end"
        >
          {VISTAS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={vista === v.id}
              onClick={() => cambiarVista(v.id)}
              className="chip h-[34px] px-2.5 text-[12px]"
            >
              {v.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {filtrados.length === 0 ? (
        <p className="text-[13px] text-apagado">
          {hayFiltro
            ? "Ningún proyecto coincide con los filtros."
            : "Todavía no hay proyectos. Crea uno con «Nuevo proyecto» o desde la ficha de un cliente."}
        </p>
      ) : (
        <div className="grid gap-4">
          <nav
            className="flex flex-wrap gap-1 border-b border-linea"
            aria-label="Ámbito de proyectos"
          >
            {AMBITOS.map((a) => {
              const cantidad = a.id === "externo" ? externos.length : internos.length;
              const activa = ambito === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-current={activa ? "page" : undefined}
                  onClick={() => cambiarAmbito(a.id)}
                  className={`px-3.5 py-2 text-[13.5px] border-b-2 -mb-px transition inline-flex items-baseline gap-2 ${
                    activa
                      ? "border-magenta text-magenta-texto font-semibold"
                      : "border-transparent text-apagado hover:text-tinta hover:border-linea"
                  }`}
                >
                  <span>{a.etiqueta}</span>
                  <span className="font-mono text-[11px] font-normal text-apagado">
                    {cantidad}
                  </span>
                </button>
              );
            })}
          </nav>

          {ambito === "externo" ? (
            externos.length === 0 ? (
              <p className="text-[13px] text-apagado">
                {hayFiltro
                  ? "Ningún proyecto externo coincide con los filtros."
                  : "No hay proyectos externos."}
              </p>
            ) : (
              renderVista(externos, true)
            )
          ) : internos.length === 0 ? (
            <p className="text-[13px] text-apagado">
              {hayFiltro
                ? "Ningún proyecto interno coincide con los filtros."
                : "No hay proyectos internos."}
            </p>
          ) : (
            renderVista(internos, false)
          )}
        </div>
      )}
    </div>
  );
}
