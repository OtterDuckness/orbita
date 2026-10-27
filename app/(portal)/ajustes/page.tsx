import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { COOKIE_TEMA, parseTema } from "@/lib/tema";
import { obtenerPrefsNotifCorreo } from "@/lib/notif-correo-prefs";
import { obtenerUsuarioAuthPorCorreo } from "@/lib/usuarios";
import { esVistaUsuario } from "@/lib/vista-usuario";
import { Cabecera } from "../cabecera";
import { Boton } from "../boton";
import {
  activarVistaUsuarioAction,
  desactivarVistaUsuarioAction,
} from "../admin/ajustes/acciones";
import { BloqueGastosIa } from "./bloque-gastos-ia";
import { PersonalizarMenu } from "./personalizar-menu";
import { PersonalizarPerfil } from "./personalizar-perfil";
import { PreferenciasNotifCorreo } from "./preferencias-notif-correo";
import { SelectorTema } from "./selector-tema";
import { SelectorZona } from "./selector-zona";
import { ZONA } from "@/lib/formato";

export const dynamic = "force-dynamic";

export default async function AjustesPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const usuario = await obtenerUsuarioAuthPorCorreo(session.user.email);
  if (!usuario) redirect("/login");
  const esAdmin = Boolean(usuario.esAdmin);
  const vistaUsuario = await esVistaUsuario();
  const puedeVistaUsuario = esAdmin || vistaUsuario;
  const jar = await cookies();
  const tema = parseTema(jar.get(COOKIE_TEMA)?.value);
  const prefsNotif =
    usuario.rol === "interna"
      ? await obtenerPrefsNotifCorreo(usuario.id)
      : null;

  return (
    <>
      <Cabecera
        etiqueta="Cuenta"
        titulo="Ajustes"
        texto={
          esAdmin
            ? "Preferencias personales de esta sesión. La gestión de usuarios, permisos y logs está en Admin."
            : "Preferencias personales de esta sesión. El menú lateral se guarda por usuario."
        }
      />

      <section className="grid gap-3 mb-10">
        <h2 className="font-display font-bold text-[18px] tracking-tight">Perfil</h2>
        <PersonalizarPerfil
          nombre={usuario.nombre}
          email={usuario.correo}
          avatarUrl={usuario.avatarUrl}
        />
      </section>

      {puedeVistaUsuario ? (
        <section className="grid gap-3 mb-10">
          <h2 className="font-display font-bold text-[18px] tracking-tight">
            Vista usuario
          </h2>
          <p className="text-apagado text-[13px] -mt-1 leading-relaxed max-w-[36rem]">
            Solo para administradores. Desactiva los privilegios admin en esta sesión
            para probar el portal con los permisos de tu perfil.
          </p>
          <p className="text-[12px] text-apagado">
            Estado actual:{" "}
            {vistaUsuario ? "vista usuario (sin admin)" : "privilegios admin"}
          </p>
          <div>
            {vistaUsuario ? (
              <form action={desactivarVistaUsuarioAction}>
                <input type="hidden" name="next" value="/ajustes" />
                <Boton className="boton" textoEnviando="Restaurando…">
                  Volver a ser admin
                </Boton>
              </form>
            ) : (
              <form action={activarVistaUsuarioAction}>
                <input type="hidden" name="next" value="/ajustes" />
                <Boton className="boton" textoEnviando="Activando…">
                  Activar vista usuario
                </Boton>
              </form>
            )}
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 mb-10">
        <h2 className="font-display font-bold text-[18px] tracking-tight">Apariencia</h2>
        <SelectorTema temaActual={tema} />
        <SelectorZona zonaActual={usuario.timezone || ZONA} />
      </section>

      {prefsNotif ? (
        <section className="grid gap-3 mb-10">
          <h2 className="font-display font-bold text-[18px] tracking-tight">
            Notificaciones por correo
          </h2>
          <PreferenciasNotifCorreo prefs={prefsNotif} />
        </section>
      ) : null}

      <section className="grid gap-3 mb-10">
        <h2 className="font-display font-bold text-[18px] tracking-tight">Menú lateral</h2>
        <PersonalizarMenu />
      </section>

      <section className="grid gap-3 mb-10">
        <h2 className="font-display font-bold text-[18px] tracking-tight">Gastos IA</h2>
        <p className="text-apagado text-[13px] -mt-1">
          Consumo estimado de tu uso del asistente (Haiku 4.5).
        </p>
        <BloqueGastosIa usuarioId={usuario.id} />
      </section>
    </>
  );
}
