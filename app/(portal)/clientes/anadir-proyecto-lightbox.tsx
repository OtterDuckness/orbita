"use client";

import { useEffect, useId, useState } from "react";
import type { PersonaEquipo, TipoProyecto } from "@/lib/clientes-mock";
import { Boton } from "../boton";
import { crearProyecto } from "./acciones";
import { FilasProyectoForm } from "./filas-proyecto-form";

export function AnadirProyectoLightbox({
  clienteId,
  responsableSugerido = "",
  tipos,
  equipo,
  compacto = false,
  puedeGestionar = false,
}: {
  clienteId: string;
  responsableSugerido?: string;
  tipos: TipoProyecto[];
  equipo: PersonaEquipo[];
  compacto?: boolean;
  /** Solo responsable de cliente (o admin) puede añadir proyectos. */
  puedeGestionar?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const tituloId = useId();

  useEffect(() => {
    if (!abierto) return;
    const onTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", onTecla);
    return () => window.removeEventListener("keydown", onTecla);
  }, [abierto]);

  function abrir() {
    if (!puedeGestionar) return;
    setFormKey((k) => k + 1);
    setAbierto(true);
  }

  const sinPermiso = "Solo el responsable de cliente puede añadir proyectos";

  return (
    <>
      <button
        type="button"
        disabled={!puedeGestionar}
        title={puedeGestionar ? undefined : sinPermiso}
        aria-label={puedeGestionar ? "Añadir proyecto" : sinPermiso}
        className={
          compacto
            ? `boton-sec text-[12px] px-2.5 py-1 disabled:opacity-40 disabled:cursor-not-allowed`
            : `boton disabled:opacity-40 disabled:cursor-not-allowed`
        }
        onClick={abrir}
      >
        Añadir proyecto
      </button>

      {abierto ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center p-3 sm:p-4 bg-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={tituloId}
          onClick={() => setAbierto(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[calc(100svh-3rem)] overflow-y-auto rounded-[12px] bg-papel border border-linea-fuerte shadow-suave p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="min-w-0 flex-1">
                <p className="etiqueta text-magenta-texto mb-1">Proyecto</p>
                <h2 id={tituloId} className="font-display font-bold text-[20px] tracking-tight">
                  Añadir proyectos
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="shrink-0 text-apagado hover:text-tinta text-[18px] leading-none px-1"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <form key={formKey} action={crearProyecto} className="grid gap-3">
              <input type="hidden" name="cliente_id" value={clienteId} />
              <p className="text-[12.5px] text-apagado max-w-[70ch]">
                Puedes añadir uno o varios proyectos a esta cuenta de una sola vez.
              </p>
              <FilasProyectoForm
                tipos={tipos}
                equipo={equipo}
                responsableSugerido={responsableSugerido}
                inicialConUnaFila
                minimo={1}
                vacioTexto="Añade al menos un proyecto."
              />
              <div className="flex gap-2 pt-1">
                <Boton className="boton" textoEnviando="Añadiendo…">
                  Guardar proyectos
                </Boton>
                <button
                  type="button"
                  className="boton-sec h-10"
                  onClick={() => setAbierto(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
