"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import {
  PRIORIDADES_PROYECTO,
  type AmbitoProyecto,
  type PersonaEquipo,
  type PrioridadProyecto,
  type TipoProyecto,
} from "@/lib/clientes-mock";
import { Boton } from "../boton";
import { CampoFecha } from "../campo-fecha";
import { CampoTipoProyecto } from "../campo-tipo-proyecto";
import { CampoColaboradores } from "../colaboradores-ui";
import { btnIcono, IconoEditar, IconoEliminar } from "./iconos-acciones";
import { editarProyectoLista, eliminarProyectoLista } from "./acciones";

type Modal = "editar" | "eliminar" | null;

type ProyectoEditable = {
  id: string;
  titulo: string;
  tipo: string;
  nombre: string | null;
  ambito: AmbitoProyecto;
  clienteId: string | null;
  tipoId: string | null;
  feeMensual: number | null;
  finContrato: string | null;
  responsableId: string | null;
  colaboradorIds: string[];
  prioridad: PrioridadProyecto;
};

export function EditarProyectoLightbox({
  proyecto,
  tipos,
  equipo,
  botonesVerticales = false,
  puedeGestionar = false,
  children,
}: {
  proyecto: ProyectoEditable;
  tipos: TipoProyecto[];
  equipo: PersonaEquipo[];
  /** Apila Editar / Eliminar en columna (p. ej. tarjeta Kanban). */
  botonesVerticales?: boolean;
  /** Admin / responsable de proyecto o cliente. */
  puedeGestionar?: boolean;
  /** Acciones entre Editar y Eliminar (p. ej. Terminado / Archivar). */
  children?: ReactNode;
}) {
  const [modal, setModal] = useState<Modal>(null);
  const [finContrato, setFinContrato] = useState(proyecto.finContrato ?? "");
  const [responsableId, setResponsableId] = useState(proyecto.responsableId ?? "");
  const [colaboradoresAbiertos, setColaboradoresAbiertos] = useState(false);
  const tituloId = useId();
  const panelColaboradoresId = useId();

  useEffect(() => {
    if (!modal) return;
    const onTecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (modal === "editar" && colaboradoresAbiertos) {
        setColaboradoresAbiertos(false);
        return;
      }
      setModal(null);
    };
    window.addEventListener("keydown", onTecla);
    return () => window.removeEventListener("keydown", onTecla);
  }, [modal, colaboradoresAbiertos]);

  const tiposOpciones =
    proyecto.tipoId && tipos.some((t) => t.id === proyecto.tipoId)
      ? tipos
      : proyecto.tipoId
        ? [{ id: proyecto.tipoId, nombre: proyecto.tipo, orden: -1 }, ...tipos]
        : tipos;

  function cerrarEditar() {
    setColaboradoresAbiertos(false);
    setModal(null);
  }

  const sinPermiso =
    "Solo el responsable del proyecto o de la cuenta puede modificarlo";

  return (
    <>
      <div
        className={
          botonesVerticales
            ? "flex flex-col items-stretch gap-1.5 shrink-0"
            : "flex items-center gap-1.5 shrink-0"
        }
      >
        <button
          type="button"
          className={`${btnIcono} ${
            puedeGestionar
              ? ""
              : "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-inherit"
          }`}
          title={puedeGestionar ? "Editar" : sinPermiso}
          aria-label={puedeGestionar ? "Editar" : sinPermiso}
          disabled={!puedeGestionar}
          onClick={() => {
            if (!puedeGestionar) return;
            setFinContrato(proyecto.finContrato ?? "");
            setResponsableId(proyecto.responsableId ?? "");
            setColaboradoresAbiertos(false);
            setModal("editar");
          }}
        >
          <IconoEditar />
        </button>
        {children ? (
          <div
            className={`${
              botonesVerticales ? "flex flex-col gap-1.5" : "flex items-center gap-1.5"
            } ${puedeGestionar ? "" : "opacity-40 pointer-events-none"}`}
            title={puedeGestionar ? undefined : sinPermiso}
            aria-disabled={!puedeGestionar}
          >
            {children}
          </div>
        ) : null}
        <button
          type="button"
          className={`${btnIcono} ${
            puedeGestionar
              ? "text-mal border-mal-borde hover:bg-mal-suave"
              : "opacity-40 cursor-not-allowed text-mal/50 border-mal-borde/40 hover:bg-transparent"
          }`}
          title={puedeGestionar ? "Eliminar" : sinPermiso}
          aria-label={puedeGestionar ? "Eliminar" : sinPermiso}
          disabled={!puedeGestionar}
          onClick={() => {
            if (!puedeGestionar) return;
            setModal("eliminar");
          }}
        >
          <IconoEliminar />
        </button>
      </div>

      {puedeGestionar && modal === "editar" ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={tituloId}
          onClick={cerrarEditar}
        >
          <div className="flex min-h-[100svh] items-start sm:items-center justify-center p-3 sm:p-4">
          <form
            action={editarProyectoLista}
            className={`relative flex flex-col xl:flex-row gap-3 w-full items-stretch ${
              colaboradoresAbiertos
                ? "max-w-[min(100%,calc(36rem+0.75rem+18.75rem))]"
                : "max-w-xl"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-xl min-h-0 max-h-[calc(100svh-3rem)] overflow-y-auto rounded-[12px] bg-papel border border-linea-fuerte shadow-suave p-5 grid gap-3 content-start">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="etiqueta text-magenta-texto mb-1">Proyecto</p>
                  <h2 id={tituloId} className="font-display font-bold text-[20px] tracking-tight">
                    Editar proyecto
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={cerrarEditar}
                  className="shrink-0 text-apagado hover:text-tinta text-[18px] leading-none px-1"
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>

                <input type="hidden" name="proyecto_id" value={proyecto.id} />
                <input type="hidden" name="ambito" value={proyecto.ambito} />
                <input type="hidden" name="cliente_id" value={proyecto.clienteId ?? ""} />

                <label className="grid gap-1 min-w-0">
                  <span className="etiqueta">
                    Nombre del proyecto{proyecto.ambito === "interno" ? "" : " (opcional)"}
                  </span>
                  <input
                    name="nombre"
                    required={proyecto.ambito === "interno"}
                    maxLength={160}
                    defaultValue={proyecto.nombre ?? ""}
                    placeholder={
                      proyecto.ambito === "interno" ? "Ej. Órbita" : "Si vacío, se usa el tipo"
                    }
                    className="control h-10 w-full"
                  />
                </label>

                {proyecto.ambito === "externo" ? (
                  <CampoTipoProyecto tipos={tiposOpciones} defaultValue={proyecto.tipoId ?? ""} />
                ) : null}

                <div className="grid gap-3 grid-cols-[minmax(0,7rem)_auto_minmax(0,7.5rem)] items-start">
                  <label className="grid gap-1 min-w-0">
                    <span className="etiqueta">Tamaño</span>
                    <input
                      name="fee_mensual"
                      inputMode="decimal"
                      defaultValue={proyecto.feeMensual ?? ""}
                      placeholder="890"
                      className="control h-10 w-full"
                    />
                  </label>
                  <CampoFecha
                    etiqueta="Fecha de fin"
                    name="fin_contrato"
                    value={finContrato}
                    onChange={setFinContrato}
                  />
                  <label className="grid gap-1 min-w-0">
                    <span className="etiqueta">Prioridad</span>
                    <select
                      name="prioridad"
                      defaultValue={proyecto.prioridad}
                      className="control h-10 w-full"
                    >
                      {PRIORIDADES_PROYECTO.map((p) => (
                        <option key={p} value={p}>
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="flex items-end gap-2 min-w-0">
                  <label className="grid gap-1 min-w-0 flex-1">
                    <span className="etiqueta">Responsable de proyecto</span>
                    <select
                      name="responsable_id"
                      required
                      value={responsableId}
                      onChange={(e) => setResponsableId(e.target.value)}
                      className="control h-10 w-full"
                    >
                      {!responsableId ? (
                        <option value="" disabled>
                          Elige responsable
                        </option>
                      ) : null}
                      {equipo.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="boton-sec h-10 shrink-0"
                    aria-expanded={colaboradoresAbiertos}
                    aria-controls={panelColaboradoresId}
                    onClick={() => setColaboradoresAbiertos((v) => !v)}
                  >
                    Colaboradores
                  </button>
                </div>

                <div className="flex gap-2 pt-1">
                  <Boton className="boton" textoEnviando="Guardando…">
                    Guardar cambios
                  </Boton>
                  <button type="button" className="boton-sec h-10" onClick={cerrarEditar}>
                    Cancelar
                  </button>
                </div>
            </div>
            <aside
              id={panelColaboradoresId}
              aria-hidden={!colaboradoresAbiertos}
              className={`w-full xl:w-[18.75rem] shrink-0 flex flex-col rounded-[12px] border border-linea-fuerte bg-papel shadow-suave overflow-hidden max-h-[min(20rem,calc(100svh-3rem))] xl:max-h-[calc(100svh-3rem)] ${
                colaboradoresAbiertos ? "" : "hidden"
              }`}
            >
              <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-linea shrink-0">
                <p className="text-[13px] font-semibold text-tinta">Colaboradores</p>
                <button
                  type="button"
                  onClick={() => setColaboradoresAbiertos(false)}
                  className="text-apagado hover:text-tinta text-[18px] leading-none px-1"
                  aria-label="Cerrar colaboradores"
                >
                  ×
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-3">
                <CampoColaboradores
                  seleccionados={proyecto.colaboradorIds}
                  bloqueados={responsableId ? [responsableId] : []}
                  candidatos={equipo}
                />
              </div>
            </aside>
          </form>
          </div>
        </div>
      ) : null}

      {puedeGestionar && modal === "eliminar" ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${tituloId}-eliminar`}
          onClick={() => setModal(null)}
        >
          <div className="flex min-h-[100svh] items-start sm:items-center justify-center p-3 sm:p-4">
          <div
            className="w-full max-w-md max-h-[calc(100svh-3rem)] overflow-y-auto rounded-[12px] bg-papel border border-linea-fuerte shadow-suave p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="min-w-0 flex-1">
                <p className="etiqueta text-mal mb-1">Eliminar</p>
                <h2
                  id={`${tituloId}-eliminar`}
                  className="font-display font-bold text-[20px] tracking-tight"
                >
                  ¿Eliminar este proyecto?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="shrink-0 text-apagado hover:text-tinta text-[18px] leading-none px-1"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <p className="text-[13.5px] text-apagado mb-5">
              Se eliminará <b className="text-tinta font-semibold">{proyecto.tipo}</b> y su tablero
              (apartados y tareas). Podrás restaurarlo en Eliminados durante 30 días.
            </p>

            <form action={eliminarProyectoLista} className="flex gap-2 flex-wrap">
              <input type="hidden" name="proyecto_id" value={proyecto.id} />
              <Boton
                className="h-10 px-4 rounded-lg text-[13.5px] font-semibold bg-mal-boton text-white hover:opacity-90"
                textoEnviando="Eliminando…"
              >
                Eliminar proyecto
              </Boton>
              <button
                type="button"
                className="boton-sec h-10"
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>
            </form>
          </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
