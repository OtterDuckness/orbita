import type { VistaMiZona } from "@/lib/vista-mi-zona";
import { setVistaMiZonaAction } from "./acciones";

const OPCIONES: { valor: "" | VistaMiZona; label: string }[] = [
  { valor: "", label: "Admin" },
  { valor: "trabajador", label: "Trabajador" },
  { valor: "jefe", label: "Jefe" },
];

export function SwitchVistaMiZona({
  vistaActual,
  next = "/mi-zona",
}: {
  vistaActual: VistaMiZona | null;
  next?: string;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 mb-4 rounded-[10px] border border-linea-fuerte bg-suave/40 px-3 py-2.5"
      role="group"
      aria-label="Simular rol Mi Zona"
    >
      <span className="text-[12px] text-apagado mr-1">Ver como</span>
      <div className="flex flex-wrap gap-1">
        {OPCIONES.map((o) => {
          const activa = (vistaActual ?? "") === o.valor;
          return (
            <form key={o.valor || "admin"} action={setVistaMiZonaAction}>
              <input type="hidden" name="vista" value={o.valor} />
              <input type="hidden" name="next" value={next} />
              <button
                type="submit"
                aria-pressed={activa}
                className={`px-2.5 py-1 rounded-[6px] text-[12.5px] transition ${
                  activa
                    ? "bg-magenta text-white font-semibold"
                    : "text-apagado hover:text-tinta hover:bg-suave border border-transparent hover:border-linea"
                }`}
              >
                {o.label}
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}
