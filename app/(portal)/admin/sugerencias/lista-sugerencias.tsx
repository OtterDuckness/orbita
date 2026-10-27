"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Sugerencia } from "@/lib/sugerencias";
import { fecha } from "@/lib/formato";
import { avisoDeMotivo } from "@/lib/avisos";
import { Boton } from "../../boton";
import { useAvisos } from "../../avisos-ui";
import {
  borrarSugerenciaAction,
  crearTareaDesdeSugerenciaAction,
} from "./acciones";

type Persona = { id: string; nombre: string };

export function ListaSugerenciasAdmin({
  sugerencias,
  equipo,
}: {
  sugerencias: Sugerencia[];
  equipo: Persona[];
}) {
  const { avisar } = useAvisos();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [creando, setCreando] = useState<Sugerencia | null>(null);
  const tituloId = useId();

  useEffect(() => {
    if (!creando) return;
    const onTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCreando(null);
    };
    window.addEventListener("keydown", onTecla);
    return () => window.removeEventListener("keydown", onTecla);
  }, [creando]);

  if (sugerencias.length === 0) {
    return (
      <p className="text-[13.5px] text-apagado border border-linea-fuerte rounded-lg px-4 py-6">
        No hay sugerencias pendientes.
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y divide-linea border border-linea-fuerte rounded-lg overflow-hidden">
        {sugerencias.map((s) => (
          <li key={s.id} className="px-4 py-3.5 bg-papel hover:bg-fila-hover transition">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[14px] truncate">{s.titulo}</p>
                {s.texto ? (
                  <p className="text-[13px] text-apagado mt-1 whitespace-pre-wrap">{s.texto}</p>
                ) : null}
                <p className="text-[12px] text-apagado mt-2">
                  {s.autorNombre} · {fecha(s.creadoEn)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  disabled={pending}
                  className="boton text-[12.5px] px-3 py-1.5 h-auto"
                  onClick={() => setCreando(s)}
                >
                  Crear tarea
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="boton-sec text-[12.5px] px-3 py-1.5 h-auto"
                  onClick={() => {
                    if (!confirm("¿Borrar esta sugerencia?")) return;
                    start(async () => {
                      const r = await borrarSugerenciaAction(s.id);
                      if (!r.ok) {
                        avisar(avisoDeMotivo(r.motivo));
                        return;
                      }
                      avisar("sugerencia_borrada");
                      router.refresh();
                    });
                  }}
                >
                  Borrar
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {creando ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center p-3 sm:p-4 bg-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={tituloId}
          onClick={() => setCreando(null)}
        >
          <div
            className="w-full max-w-lg max-h-[calc(100svh-3rem)] overflow-y-auto rounded-[12px] bg-papel border border-linea-fuerte shadow-suave p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="min-w-0 flex-1">
                <p className="etiqueta text-magenta-texto mb-1">Confirmar</p>
                <h2
                  id={tituloId}
                  className="font-display font-bold text-[20px] tracking-tight"
                >
                  Crear tarea
                </h2>
                <p className="text-[13px] text-apagado mt-1 line-clamp-2">{creando.titulo}</p>
              </div>
              <button
                type="button"
                onClick={() => setCreando(null)}
                className="shrink-0 text-apagado hover:text-tinta text-[18px] leading-none px-1"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            {creando.texto ? (
              <div className="mb-4 rounded-lg border border-linea bg-suave px-3 py-2.5">
                <p className="etiqueta mb-1">Sugerencia original</p>
                <p className="text-[13px] text-apagado whitespace-pre-wrap">{creando.texto}</p>
              </div>
            ) : null}

            <form
              className="grid gap-3"
              action={async (fd) => {
                const r = await crearTareaDesdeSugerenciaAction(fd);
                if (!r.ok) {
                  avisar(avisoDeMotivo(r.motivo));
                  return;
                }
                avisar("sugerencia_convertida");
                setCreando(null);
                router.refresh();
              }}
            >
              <input type="hidden" name="sugerencia_id" value={creando.id} />
              <label className="grid gap-1">
                <span className="etiqueta">Asignar a</span>
                <select
                  name="responsable_id"
                  required
                  defaultValue=""
                  className="control h-10 w-full"
                >
                  <option value="" disabled>
                    Elige una persona…
                  </option>
                  {equipo.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="etiqueta">Notas técnicas (opcional)</span>
                <textarea
                  name="notas_tecnicas"
                  rows={4}
                  maxLength={4000}
                  placeholder="Detalle técnico, alcance, criterios, tips de implementación…"
                  className="control w-full resize-y min-h-[6rem]"
                />
              </label>
              <div className="flex gap-2 flex-wrap">
                <Boton className="boton" textoEnviando="Creando…">
                  Confirmar y crear
                </Boton>
                <button
                  type="button"
                  className="boton-sec h-10"
                  onClick={() => setCreando(null)}
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
