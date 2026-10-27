"use client";

import { useEffect, useId, useState } from "react";
import type { TipoProyecto } from "@/lib/clientes-mock";
import { Boton } from "../boton";
import {
  crearTipoProyectoAction,
  eliminarTipoProyectoAction,
  renombrarTipoProyectoAction,
} from "./acciones";

const btnSec =
  "boton-sec text-[12px] px-2.5 py-1 shrink-0";

type TipoConUso = TipoProyecto & { enUso: number };

export function GestionarTiposLightbox({ tipos }: { tipos: TipoConUso[] }) {
  const [abierto, setAbierto] = useState(false);
  const [borrarId, setBorrarId] = useState<string | null>(null);
  const tituloId = useId();

  useEffect(() => {
    if (!abierto) return;
    const onTecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (borrarId) {
        setBorrarId(null);
        return;
      }
      setAbierto(false);
    };
    window.addEventListener("keydown", onTecla);
    return () => window.removeEventListener("keydown", onTecla);
  }, [abierto, borrarId]);

  function abrir() {
    setBorrarId(null);
    setAbierto(true);
  }

  const aBorrar = borrarId ? tipos.find((t) => t.id === borrarId) ?? null : null;
  const destinos = aBorrar
    ? tipos.filter((t) => t.id !== aBorrar.id && t.nombre.trim().toLowerCase() !== "otro")
    : [];
  const tiposVisibles = tipos.filter((t) => t.nombre.trim().toLowerCase() !== "otro");

  return (
    <>
      <button type="button" className={btnSec} onClick={abrir}>
        Tipos
      </button>

      {abierto ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center p-3 sm:p-4 bg-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={tituloId}
          onClick={() => {
            if (borrarId) setBorrarId(null);
            else setAbierto(false);
          }}
        >
          <div
            className="w-full max-w-lg max-h-[calc(100svh-3rem)] overflow-y-auto rounded-[12px] bg-papel border border-linea-fuerte shadow-suave p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="min-w-0 flex-1">
                <p className="etiqueta text-magenta-texto mb-1">Catálogo</p>
                <h2 id={tituloId} className="font-display font-bold text-[20px] tracking-tight">
                  Tipos de proyecto
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBorrarId(null);
                  setAbierto(false);
                }}
                className="shrink-0 text-apagado hover:text-tinta text-[18px] leading-none px-1"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            {aBorrar ? (
              <div className="grid gap-3">
                <p className="text-[13.5px] text-apagado">
                  {aBorrar.enUso > 0 ? (
                    <>
                      <b className="text-tinta font-semibold">{aBorrar.nombre}</b> está en{" "}
                      {aBorrar.enUso} {aBorrar.enUso === 1 ? "proyecto activo" : "proyectos activos"}.
                      Elige a qué tipo reasignarlos. Los terminados y archivados conservarán este
                      tipo.
                    </>
                  ) : (
                    <>
                      ¿Retirar el tipo <b className="text-tinta font-semibold">{aBorrar.nombre}</b>{" "}
                      del catálogo? Los proyectos terminados o archivados conservarán este tipo.
                    </>
                  )}
                </p>
                <form action={eliminarTipoProyectoAction} className="grid gap-3">
                  <input type="hidden" name="tipo_id" value={aBorrar.id} />
                  {aBorrar.enUso > 0 ? (
                    <label className="grid gap-1">
                      <span className="etiqueta">Reasignar activos a</span>
                      <select
                        name="reasignar_a"
                        required
                        defaultValue=""
                        className="control h-10 w-full"
                      >
                        <option value="" disabled>
                          Elige un tipo…
                        </option>
                        {destinos.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <div className="flex gap-2 flex-wrap">
                    <Boton
                      className="h-10 px-4 rounded-lg text-[13.5px] font-semibold bg-mal-boton text-white hover:opacity-90"
                      textoEnviando="Retirando…"
                    >
                      Retirar tipo
                    </Boton>
                    <button
                      type="button"
                      className="boton-sec h-10"
                      onClick={() => setBorrarId(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="grid gap-5">
                <ul className="grid gap-2">
                  {tiposVisibles.map((t) => (
                    <li
                      key={t.id}
                      className="rounded-lg border border-linea-fuerte p-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end hover:border-magenta-borde transition"
                    >
                      <form action={renombrarTipoProyectoAction} className="grid gap-1 min-w-0">
                        <input type="hidden" name="tipo_id" value={t.id} />
                        <span className="etiqueta">
                          {t.nombre}
                          <span className="font-mono text-[11px] text-apagado ml-2">
                            {t.enUso} {t.enUso === 1 ? "activo" : "activos"}
                          </span>
                        </span>
                        <div className="flex gap-2 min-w-0">
                          <input
                            name="nombre"
                            required
                            maxLength={60}
                            defaultValue={t.nombre}
                            className="control h-9 flex-1 min-w-0 px-2.5 text-[13px]"
                          />
                          <Boton
                            className="boton-sec h-9 px-2.5 text-[12px] shrink-0"
                            textoEnviando="…"
                          >
                            Renombrar
                          </Boton>
                        </div>
                      </form>
                      <button
                        type="button"
                        className="boton-sec h-9 px-2.5 text-[12px] text-mal border-mal-borde hover:bg-mal-suave shrink-0"
                        onClick={() => setBorrarId(t.id)}
                        disabled={tiposVisibles.length <= 1}
                        title={tiposVisibles.length <= 1 ? "Debe quedar al menos un tipo" : "Retirar"}
                      >
                        Retirar
                      </button>
                    </li>
                  ))}
                </ul>

                <form
                  action={crearTipoProyectoAction}
                  className="border-t border-linea pt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end"
                >
                  <label className="grid gap-1 min-w-0">
                    <span className="etiqueta">Nuevo tipo</span>
                    <input
                      name="nombre"
                      required
                      maxLength={60}
                      placeholder="Nombre del tipo"
                      className="control h-10 w-full"
                    />
                  </label>
                  <Boton
                    className="boton-sec h-10"
                    textoEnviando="Creando…"
                  >
                    Añadir
                  </Boton>
                </form>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
