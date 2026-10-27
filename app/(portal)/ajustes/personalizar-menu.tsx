"use client";

import { Boton } from "../boton";
import { useOrdenMenu } from "../orden-menu";
import { restablecerMenuPreferencias } from "./acciones";

export function PersonalizarMenu() {
  const { editando, guardando, fallo, entrar, cancelar, guardar } = useOrdenMenu();
  const capa =
    "col-start-1 row-start-1 flex transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none";
  const btn =
    "rounded-lg px-4 py-2 text-[13.5px] font-semibold border whitespace-nowrap transition";

  return (
    <div className="grid gap-4 max-w-lg">
      <p className="text-[13.5px] text-apagado">
        Pulsa Reordenar y arrastra las secciones del menú lateral. El acceso a Ajustes siempre está
        abajo del todo.
      </p>

      <div className="grid w-fit min-w-[11rem]">
        <div
          aria-hidden={editando}
          className={`${capa} ${
            editando
              ? "z-0 pointer-events-none opacity-0 translate-y-0.5"
              : "z-10 opacity-100 translate-y-0"
          }`}
        >
          <button
            type="button"
            onClick={entrar}
            tabIndex={editando ? -1 : 0}
            className={`${btn} border-magenta-borde bg-magenta-suave text-magenta-texto hover:opacity-90`}
          >
            Reordenar
          </button>
        </div>
        <div
          aria-hidden={!editando}
          className={`${capa} gap-2 ${
            editando
              ? "z-10 opacity-100 translate-y-0"
              : "z-0 pointer-events-none opacity-0 -translate-y-0.5"
          }`}
        >
          <button
            type="button"
            onClick={guardar}
            disabled={!editando || guardando}
            tabIndex={editando ? 0 : -1}
            className={`${btn} border-magenta-borde bg-magenta text-white ${
              guardando ? "opacity-60" : "hover:opacity-90"
            }`}
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
          <button
            type="button"
            onClick={cancelar}
            disabled={!editando || guardando}
            tabIndex={editando ? 0 : -1}
            className={`${btn} border-linea text-apagado hover:bg-suave hover:text-tinta ${
              guardando ? "opacity-60" : ""
            }`}
          >
            Cancelar
          </button>
        </div>
      </div>

      {fallo ? (
        <p className="text-[13px] text-magenta-texto">No se pudo guardar el orden del menú.</p>
      ) : null}

      <form action={restablecerMenuPreferencias}>
        <Boton
          className="boton-sec text-[13px] px-3 py-2"
          textoEnviando="Restableciendo…"
          disabled={editando || guardando}
        >
          Restablecer por defecto
        </Boton>
      </form>
    </div>
  );
}
