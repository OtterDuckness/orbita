import type { VistaMiZona } from "@/lib/vista-mi-zona";
import { setVistaMiZonaAction } from "./acciones";

export function BannerVistaMiZona({ vista }: { vista: VistaMiZona }) {
  const label = vista === "jefe" ? "jefe" : "trabajador";
  return (
    <div
      className="mb-4 rounded-lg border border-magenta-borde/50 bg-magenta-suave px-3.5 py-2.5 text-[13px]"
      role="status"
    >
      <b className="font-semibold">Vista {label}</b>
      <span className="text-apagado">
        {" "}
        — ves Mi Zona como ese perfil (solo permisos de esta sección).{" "}
      </span>
      <form action={setVistaMiZonaAction} className="inline">
        <input type="hidden" name="vista" value="" />
        <input type="hidden" name="next" value="/mi-zona" />
        <button type="submit" className="text-magenta-texto font-semibold hover:underline">
          Volver a admin
        </button>
      </form>
    </div>
  );
}
