"use client";

import { useEffect, useId, useState } from "react";
import type { Herramienta } from "@/lib/herramientas";
import { Boton } from "../boton";
import {
  actualizarHerramientaAction,
  crearHerramientaAction,
} from "./acciones";

type Props =
  | { modo: "crear"; triggerClassName?: string; triggerLabel?: string }
  | { modo: "editar"; herramienta: Herramienta; abierto: boolean; onCerrar: () => void };

export function HerramientaLightbox(props: Props) {
  const esCrear = props.modo === "crear";
  const [abiertoInterno, setAbiertoInterno] = useState(false);
  const abierto = esCrear ? abiertoInterno : props.abierto;
  const tituloId = useId();
  const h = esCrear ? null : props.herramienta;
  const onCerrarEditar = props.modo === "editar" ? props.onCerrar : undefined;

  function cerrar() {
    if (esCrear) setAbiertoInterno(false);
    else onCerrarEditar?.();
  }

  useEffect(() => {
    if (!abierto) return;
    function onTecla(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (esCrear) setAbiertoInterno(false);
      else onCerrarEditar?.();
    }
    window.addEventListener("keydown", onTecla);
    return () => window.removeEventListener("keydown", onTecla);
  }, [abierto, esCrear, onCerrarEditar]);

  return (
    <>
      {esCrear ? (
        <button
          type="button"
          className={props.triggerClassName ?? "boton"}
          onClick={() => setAbiertoInterno(true)}
        >
          {props.triggerLabel ?? "Añadir nueva herramienta"}
        </button>
      ) : null}

      {abierto ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center p-3 sm:p-4 bg-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={tituloId}
          onClick={cerrar}
        >
          <form
            action={esCrear ? crearHerramientaAction : actualizarHerramientaAction}
            className="w-full max-w-lg max-h-[calc(100svh-3rem)] overflow-y-auto rounded-[12px] bg-papel border border-linea-fuerte shadow-suave p-5 grid gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {!esCrear && h ? <input type="hidden" name="id" value={h.id} /> : null}

            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="etiqueta text-magenta-texto mb-1">
                  {esCrear ? "Alta" : "Edición"}
                </p>
                <h2 id={tituloId} className="font-display font-bold text-[20px] tracking-tight">
                  {esCrear ? "Nueva herramienta" : "Editar herramienta"}
                </h2>
              </div>
              <button
                type="button"
                onClick={cerrar}
                className="shrink-0 text-apagado hover:text-tinta text-[18px] leading-none px-1"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <label className="grid gap-1">
              <span className="etiqueta">Nombre</span>
              <input
                name="nombre"
                required
                maxLength={120}
                defaultValue={h?.nombre ?? ""}
                className="control h-10 w-full"
                placeholder="Holded"
              />
            </label>

            <label className="grid gap-1">
              <span className="etiqueta">Categoría</span>
              <input
                name="categoria"
                maxLength={80}
                defaultValue={h?.categoria ?? ""}
                className="control h-10 w-full"
                placeholder="CRM"
              />
            </label>

            <label className="grid gap-1">
              <span className="etiqueta">URL</span>
              <input
                name="url"
                type="url"
                required
                maxLength={2048}
                defaultValue={h?.url ?? ""}
                className="control h-10 w-full"
                placeholder="https://"
              />
            </label>

            <label className="grid gap-1">
              <span className="etiqueta">Descripción</span>
              <textarea
                name="descripcion"
                maxLength={500}
                rows={3}
                defaultValue={h?.descripcion ?? ""}
                className="control w-full px-3 py-2 text-[14px] resize-y min-h-[5rem]"
                placeholder="Para qué la usáis en el día a día"
              />
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="boton-sec" onClick={cerrar}>
                Cancelar
              </button>
              <Boton className="boton" textoEnviando="Guardando…">
                {esCrear ? "Añadir" : "Guardar"}
              </Boton>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
