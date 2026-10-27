"use client";

import { Boton } from "../boton";
import { alternarFavoritoProyectoLista } from "./acciones";
import { IconoEstrella } from "./iconos-acciones";

const btnInline =
  "inline-flex items-center justify-center size-5 shrink-0 rounded p-0 border-0 bg-transparent text-apagado hover:text-magenta transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-anillo focus-visible:outline-offset-1";

/** Estrella compacta para fijar en el sidemenu (junto al nombre, siempre visible). */
export function BotonFavorito({
  proyectoId,
  activo,
  className,
}: {
  proyectoId: string;
  activo: boolean;
  className?: string;
}) {
  return (
    <form action={alternarFavoritoProyectoLista} className="shrink-0">
      <input type="hidden" name="proyecto_id" value={proyectoId} />
      <Boton
        className={`${btnInline} ${activo ? "text-magenta" : ""} ${className ?? ""}`}
        title={activo ? "Quitar del menú" : "Fijar en el menú"}
        aria-label={activo ? "Quitar del menú" : "Fijar en el menú"}
        aria-pressed={activo}
        textoEnviando="…"
      >
        <IconoEstrella relleno={activo} className="size-3.5" />
      </Boton>
    </form>
  );
}
