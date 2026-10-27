import { Boton } from "../boton";
import type { TemaOrbita } from "@/lib/tema";
import { guardarTemaAction } from "./acciones-tema";

export function SelectorTema({ temaActual }: { temaActual: TemaOrbita }) {
  return (
    <form action={guardarTemaAction} className="tarjeta bg-papel p-4 grid gap-3 max-w-md">
      <p className="text-[13.5px] text-apagado leading-relaxed">
        Cambia el aspecto del portal. Se guarda en este navegador.
      </p>
      <div className="flex flex-wrap gap-2">
        <label
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[13.5px] cursor-pointer transition ${
            temaActual === "dia"
              ? "border-magenta bg-suave text-tinta font-semibold"
              : "border-linea hover:border-magenta-borde"
          }`}
        >
          <input
            type="radio"
            name="tema"
            value="dia"
            defaultChecked={temaActual === "dia"}
            className="accent-[var(--magenta)]"
          />
          Día
        </label>
        <label
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[13.5px] cursor-pointer transition ${
            temaActual === "noche"
              ? "border-magenta bg-suave text-tinta font-semibold"
              : "border-linea hover:border-magenta-borde"
          }`}
        >
          <input
            type="radio"
            name="tema"
            value="noche"
            defaultChecked={temaActual === "noche"}
            className="accent-[var(--magenta)]"
          />
          Noche
        </label>
      </div>
      <div>
        <Boton className="boton" textoEnviando="Aplicando…">
          Aplicar
        </Boton>
      </div>
    </form>
  );
}
