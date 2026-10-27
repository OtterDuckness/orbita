"use client";

import { useEffect, useId, useState } from "react";
import type { PersonaEquipo } from "@/lib/clientes-mock";
import { Boton } from "../boton";
import { CampoColaboradores } from "../colaboradores-ui";
import { crearDmAction, crearGrupoAction } from "./acciones";

const btnSec =
  "boton-sec text-[12px] px-2.5 py-1 shrink-0";

export function NuevaConversacionLightbox({
  equipo,
  yoId,
}: {
  equipo: PersonaEquipo[];
  yoId: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState<"dm" | "grupo">("dm");
  const tituloId = useId();
  const otros = equipo.filter((p) => p.id !== yoId);

  useEffect(() => {
    if (!abierto) return;
    const onTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", onTecla);
    return () => window.removeEventListener("keydown", onTecla);
  }, [abierto]);

  function abrir(m: "dm" | "grupo") {
    setModo(m);
    setAbierto(true);
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" className={btnSec} onClick={() => abrir("dm")}>
          Nuevo DM
        </button>
        <button type="button" className={btnSec} onClick={() => abrir("grupo")}>
          Nuevo grupo
        </button>
      </div>

      {abierto ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center p-3 sm:p-4 bg-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={tituloId}
          onClick={() => setAbierto(false)}
        >
          <div
            className="w-full max-w-md max-h-[calc(100svh-3rem)] overflow-y-auto rounded-[12px] bg-papel border border-linea-fuerte shadow-suave p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="min-w-0 flex-1">
                <p className="etiqueta text-magenta-texto mb-1">Conversación</p>
                <h2 id={tituloId} className="font-display font-bold text-[20px] tracking-tight">
                  {modo === "dm" ? "Mensaje directo" : "Nuevo grupo"}
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

            {modo === "dm" ? (
              <form action={crearDmAction} className="grid gap-3">
                <label className="grid gap-1">
                  <span className="etiqueta">Persona</span>
                  <select
                    name="usuario_id"
                    required
                    defaultValue=""
                    className="control h-10 w-full"
                  >
                    <option value="" disabled>
                      Elige a alguien…
                    </option>
                    {otros.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex gap-2 flex-wrap">
                  <Boton className="boton" textoEnviando="Abriendo…">
                    Abrir chat
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
            ) : (
              <form action={crearGrupoAction} className="grid gap-3">
                <label className="grid gap-1">
                  <span className="etiqueta">Nombre del grupo</span>
                  <input
                    name="nombre"
                    required
                    maxLength={100}
                    placeholder="Ej. SEO interno"
                    className="control h-10 w-full"
                  />
                </label>
                <div className="grid gap-1">
                  <span className="etiqueta">Miembros</span>
                  <CampoColaboradores
                    name="miembro_ids"
                    candidatos={otros}
                    seleccionados={[]}
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Boton className="boton" textoEnviando="Creando…">
                    Crear grupo
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
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
