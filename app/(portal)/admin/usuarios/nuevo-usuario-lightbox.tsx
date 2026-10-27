"use client";

import { useEffect, useId, useState } from "react";
import type { PerfilLista } from "@/lib/perfiles";
import { Boton } from "../../boton";
import { crearUsuarioAction } from "./acciones";

export function NuevoUsuarioLightbox({ perfiles }: { perfiles: PerfilLista[] }) {
  const [abierto, setAbierto] = useState(false);
  const tituloId = useId();

  useEffect(() => {
    if (!abierto) return;
    const onTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", onTecla);
    return () => window.removeEventListener("keydown", onTecla);
  }, [abierto]);

  return (
    <>
      <button type="button" className="boton" onClick={() => setAbierto(true)}>
        Nuevo usuario
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
            className="w-full max-w-md max-h-[calc(100svh-3rem)] overflow-y-auto rounded-[12px] bg-papel border border-linea-fuerte shadow-suave p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="min-w-0 flex-1">
                <p className="etiqueta text-magenta-texto mb-1">Alta</p>
                <h2 id={tituloId} className="font-display font-bold text-[20px] tracking-tight">
                  Nuevo usuario
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

            <form action={crearUsuarioAction} className="grid gap-3">
              <label className="grid gap-1">
                <span className="etiqueta">Nombre</span>
                <input
                  name="nombre"
                  required
                  maxLength={255}
                  className="control h-10 w-full"
                />
              </label>
              <label className="grid gap-1">
                <span className="etiqueta">Correo</span>
                <input
                  name="correo"
                  type="email"
                  required
                  maxLength={320}
                  className="control h-10 w-full"
                />
              </label>
              <label className="grid gap-1">
                <span className="etiqueta">Perfil (opcional)</span>
                <select
                  name="perfil_id"
                  defaultValue=""
                  className="control h-10 w-full"
                >
                  <option value="">Sin perfil</option>
                  {perfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-[13.5px]">
                <input type="checkbox" name="es_admin" value="1" className="rounded border-linea" />
                Administrador
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                <Boton textoEnviando="Creando…">Crear usuario</Boton>
                <button
                  type="button"
                  className="text-[13px] text-apagado hover:text-tinta px-2"
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
