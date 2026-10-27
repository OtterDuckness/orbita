"use client";

import { useState } from "react";
import type { Herramienta } from "@/lib/herramientas";
import { Boton } from "../boton";
import { eliminarHerramientaAction } from "./acciones";
import { HerramientaLightbox } from "./herramienta-lightbox";

function IconoExterno() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="w-3.5 h-3.5 text-apagado"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 3H3.5A1.5 1.5 0 0 0 2 4.5v8A1.5 1.5 0 0 0 3.5 14h8a1.5 1.5 0 0 0 1.5-1.5V10" />
      <path d="M9 2h5v5" />
      <path d="M7.5 8.5 14 2" />
    </svg>
  );
}

export function GridHerramientas({ herramientas }: { herramientas: Herramienta[] }) {
  const [editando, setEditando] = useState<Herramienta | null>(null);

  /** Abre en pestaña nueva e intenta devolver el foco a Órbita (segundo plano). */
  function abrir(url: string) {
    const nueva = window.open(url, "_blank");
    if (nueva) {
      try {
        nueva.opener = null;
        nueva.blur();
      } catch {
        // cross-origin / políticas del navegador
      }
    }
    window.focus();
    requestAnimationFrame(() => window.focus());
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {herramientas.map((h) => (
          <article
            key={h.id}
            className="group relative flex flex-col gap-3 rounded-[12px] border border-linea-fuerte bg-suave/40 p-4 hover:border-magenta-borde hover:shadow-suave transition"
          >
            <button
              type="button"
              onClick={() => abrir(h.url)}
              className="absolute inset-0 z-0 rounded-[12px] text-left cursor-pointer"
              aria-label={`Abrir ${h.nombre} en una pestaña nueva`}
            />

            <div className="relative z-10 flex items-start gap-2 pointer-events-none">
              <div className="min-w-0 flex-1">
                <h2 className="font-display font-bold text-[16px] tracking-tight text-tinta">
                  {h.nombre}
                </h2>
                {h.categoria ? (
                  <p className="etiqueta text-apagado mt-0.5 uppercase tracking-wide">
                    {h.categoria}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 mt-0.5 pointer-events-none">
                <IconoExterno />
              </span>
            </div>

            {h.descripcion ? (
              <p className="relative z-10 text-[13px] text-apagado leading-snug line-clamp-3 pointer-events-none">
                {h.descripcion}
              </p>
            ) : (
              <p className="relative z-10 text-[13px] text-apagado/60 italic pointer-events-none">
                Sin descripción
              </p>
            )}

            <div className="relative z-10 mt-auto flex gap-2 pt-1 pointer-events-auto">
              <button
                type="button"
                className="text-[12px] text-apagado hover:text-magenta-texto underline-offset-2 hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditando(h);
                }}
              >
                Editar
              </button>
              <form action={eliminarHerramientaAction} className="inline">
                <input type="hidden" name="id" value={h.id} />
                <Boton
                  className="text-[12px] text-apagado hover:text-mal underline-offset-2 hover:underline bg-transparent border-0 p-0 h-auto font-normal"
                  textoEnviando="…"
                  onClick={(e) => {
                    if (!window.confirm(`¿Quitar «${h.nombre}» de tu panel?`)) {
                      e.preventDefault();
                    }
                  }}
                >
                  Quitar
                </Boton>
              </form>
            </div>
          </article>
        ))}
      </div>

      {editando ? (
        <HerramientaLightbox
          modo="editar"
          herramienta={editando}
          abierto
          onCerrar={() => setEditando(null)}
        />
      ) : null}
    </>
  );
}
