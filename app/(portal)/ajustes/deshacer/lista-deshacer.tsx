"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AccionDeshacerLista, TipoAccionReversible } from "@/lib/deshacer";
import { fechaHora } from "@/lib/formato";
import { avisoDeMotivo } from "@/lib/avisos";
import { useAvisos } from "../../avisos-ui";
import { deshacerAccionAction } from "./acciones";

const ETIQUETA_TIPO: Record<TipoAccionReversible, string> = {
  tarea_movida: "Mover tarea",
  tarea_completada: "Completar / reabrir",
  tarea_responsables: "Responsables",
  tarea_editada: "Editar tarea",
  proyecto_estado: "Estado proyecto",
  cliente_editado: "Editar cliente",
  eliminacion: "Eliminación",
};

export function ListaDeshacer({
  items,
  diasRetencion,
}: {
  items: AccionDeshacerLista[];
  diasRetencion: number;
}) {
  const { avisar } = useAvisos();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmando, setConfirmando] = useState<AccionDeshacerLista | null>(null);
  const tituloId = useId();

  useEffect(() => {
    if (!confirmando) return;
    const onTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmando(null);
    };
    window.addEventListener("keydown", onTecla);
    return () => window.removeEventListener("keydown", onTecla);
  }, [confirmando]);

  if (items.length === 0) {
    return (
      <p className="text-[13.5px] text-apagado border border-linea-fuerte rounded-lg px-4 py-6">
        No hay acciones recientes para deshacer. Aquí aparecerán tus cambios
        importantes (y los del asistente) de los últimos {diasRetencion} días.
      </p>
    );
  }

  function confirmar(item: AccionDeshacerLista) {
    setConfirmando(null);
    start(async () => {
      const r = await deshacerAccionAction(item.id);
      if (!r.ok) {
        avisar(avisoDeMotivo(r.motivo));
        return;
      }
      avisar("deshecho");
      router.refresh();
    });
  }

  return (
    <>
      <ul className="divide-y divide-linea border border-linea-fuerte rounded-lg overflow-hidden">
        {items.map((e) => (
          <li
            key={e.id}
            className="px-4 py-3.5 bg-papel hover:bg-fila-hover transition"
          >
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-apagado mb-0.5">
                  {ETIQUETA_TIPO[e.tipo]}
                  {e.via === "asistente" ? " · Asistente" : ""}
                </p>
                <p className="font-semibold text-[14px] truncate">{e.etiqueta}</p>
                <p className="text-[12px] text-apagado mt-2">
                  {fechaHora(e.creadoEn)} · caduca {fechaHora(e.expiraEn)}
                </p>
              </div>
              <div className="shrink-0">
                <button
                  type="button"
                  disabled={pending}
                  className="boton text-[12.5px] px-3 py-1.5 h-auto"
                  onClick={() => setConfirmando(e)}
                >
                  Deshacer
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {confirmando ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={tituloId}
          onClick={() => setConfirmando(null)}
        >
          <div className="flex min-h-[100svh] items-start sm:items-center justify-center p-3 sm:p-4">
            <div
              className="w-full max-w-md max-h-[calc(100svh-3rem)] overflow-y-auto rounded-[12px] bg-papel border border-linea-fuerte shadow-suave p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <p className="etiqueta text-magenta-texto mb-1">Deshacer</p>
                  <h2
                    id={tituloId}
                    className="font-display font-bold text-[20px] tracking-tight"
                  >
                    ¿Deshacer esta acción?
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmando(null)}
                  className="shrink-0 text-apagado hover:text-tinta text-[18px] leading-none px-1"
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>

              <p className="text-[13.5px] text-apagado mb-5">
                Se revertirá{" "}
                <b className="text-tinta font-semibold">{confirmando.etiqueta}</b>
                .
              </p>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  className="boton-sec h-10"
                  onClick={() => setConfirmando(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="boton text-[12.5px] px-3 py-1.5 h-auto"
                  disabled={pending}
                  onClick={() => confirmar(confirmando)}
                >
                  Deshacer
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
