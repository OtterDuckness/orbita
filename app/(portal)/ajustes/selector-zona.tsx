"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ZONAS_UI } from "@/lib/zona";
import { avisoDeMotivo } from "@/lib/avisos";
import { useAvisos } from "../avisos-ui";
import { guardarZonaAction } from "./acciones-zona";

export function SelectorZona({ zonaActual }: { zonaActual: string }) {
  const { avisar } = useAvisos();
  const router = useRouter();
  const [pending, start] = useTransition();

  const enLista = ZONAS_UI.some((z) => z.id === zonaActual);
  const opciones = enLista
    ? ZONAS_UI
    : [{ id: zonaActual, etiqueta: `${zonaActual} (actual)` }, ...ZONAS_UI];

  return (
    <div className="border border-linea-fuerte rounded-lg px-4 py-3.5 bg-papel">
      <label className="block text-[13px] font-semibold mb-1.5" htmlFor="zona-horaria">
        Zona horaria
      </label>
      <p className="text-[12.5px] text-apagado mb-3">
        Fechas y horas de la app (panel, eliminados, logs, asistente) se muestran en esta zona.
        Los datos se guardan en UTC.
      </p>
      <select
        id="zona-horaria"
        className="campo w-full max-w-md text-[13.5px]"
        value={zonaActual}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          start(async () => {
            const r = await guardarZonaAction(next);
            if (!r.ok) {
              avisar(avisoDeMotivo(r.motivo));
              return;
            }
            avisar("zona_guardada");
            router.refresh();
          });
        }}
      >
        {opciones.map((z) => (
          <option key={z.id} value={z.id}>
            {z.etiqueta}
          </option>
        ))}
      </select>
    </div>
  );
}
