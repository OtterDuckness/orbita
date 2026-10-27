import { desactivarVistaUsuarioAction } from "./admin/ajustes/acciones";

export function BannerVistaUsuario() {
  return (
    <div
      className="mb-4 rounded-lg border border-magenta-borde/50 bg-magenta-suave px-3.5 py-2.5 text-[13px]"
      role="status"
    >
      <b className="font-semibold">Vista usuario</b>
      <span className="text-apagado">
        {" "}
        — sesión sin privilegios de admin (permisos de tu perfil).{" "}
      </span>
      <form action={desactivarVistaUsuarioAction} className="inline">
        <input type="hidden" name="next" value="/" />
        <button type="submit" className="text-magenta-texto font-semibold hover:underline">
          Volver a admin
        </button>
      </form>
    </div>
  );
}
