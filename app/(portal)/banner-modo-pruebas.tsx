import { desactivarModoPruebasAction } from "./admin/ajustes/acciones";

export function BannerModoPruebas() {
  return (
    <div
      className="mb-4 rounded-lg border border-novedad/50 bg-[color-mix(in_srgb,var(--novedad)_12%,var(--papel))] px-3.5 py-2.5 text-[13px]"
      role="status"
    >
      <b className="font-semibold">Modo pruebas</b>
      <span className="text-apagado"> — datos mock. No se envían correos ni se toca Google Calendar. </span>
      <form action={desactivarModoPruebasAction} className="inline">
        <button type="submit" className="text-magenta-texto font-semibold hover:underline">
          Salir
        </button>
      </form>
    </div>
  );
}
