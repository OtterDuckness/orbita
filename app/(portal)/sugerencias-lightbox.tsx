"use client";

import { useEffect, useId, useState } from "react";
import { Boton } from "./boton";
import { useAvisos } from "./avisos-ui";
import { avisoDeMotivo } from "@/lib/avisos";
import { enviarSugerenciaAction } from "./acciones-sugerencias";

export function SugerenciasLightbox({ compacto = false }: { compacto?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const { avisar } = useAvisos();
  const tituloId = useId();

  useEffect(() => {
    if (!abierto) return;
    const onTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", onTecla);
    return () => window.removeEventListener("keydown", onTecla);
  }, [abierto]);

  const triggerClass = compacto
    ? "shrink-0 border rounded-lg px-2.5 py-1.5 text-[11px] transition border-linea text-apagado hover:border-magenta-borde hover:text-magenta-texto"
    : "block w-full text-left px-3.5 py-2 rounded-[10px] text-[13.5px] border transition border-transparent text-apagado hover:bg-suave hover:text-tinta hover:border-linea";

  return (
    <>
      <button type="button" className={triggerClass} onClick={() => setAbierto(true)}>
        Sugerencias
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
            className="w-full max-w-lg max-h-[calc(100svh-3rem)] overflow-y-auto rounded-[12px] bg-papel border border-linea-fuerte shadow-suave p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="min-w-0 flex-1">
                <p className="etiqueta text-magenta-texto mb-1">Órbita</p>
                <h2
                  id={tituloId}
                  className="font-display font-bold text-[20px] tracking-tight"
                >
                  Sugerencias
                </h2>
                <p className="text-[13px] text-apagado mt-1">
                  Propón una mejora. Llegará al panel de admin para revisarla.
                </p>
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

            <form
              className="grid gap-3"
              action={async (fd) => {
                const r = await enviarSugerenciaAction(fd);
                if (!r.ok) {
                  avisar(avisoDeMotivo(r.motivo));
                  return;
                }
                avisar("sugerencia_enviada");
                setAbierto(false);
              }}
            >
              <label className="grid gap-1">
                <span className="etiqueta">Título</span>
                <input
                  name="titulo"
                  required
                  maxLength={200}
                  placeholder="Ej. Exportar lista de clientes a Excel"
                  className="control h-10 w-full"
                />
              </label>
              <label className="grid gap-1">
                <span className="etiqueta">Detalle (opcional)</span>
                <textarea
                  name="texto"
                  rows={3}
                  maxLength={4000}
                  placeholder="Contexto, por qué ayuda, ideas…"
                  className="control w-full resize-y min-h-[5rem]"
                />
              </label>
              <div className="flex gap-2 flex-wrap">
                <Boton className="boton" textoEnviando="Enviando…">
                  Enviar sugerencia
                </Boton>
                <button
                  type="button"
                  className="boton-sec h-10"
                  onClick={() => setAbierto(false)}
                >
                  Cerrar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
