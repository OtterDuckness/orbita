import { accesoUrlProyectosAbierto } from "@/lib/ajustes-globales";
import { exigirAdmin } from "@/lib/authz";
import { esModoPruebas } from "@/lib/sandbox";
import { Cabecera } from "../../cabecera";
import { Boton } from "../../boton";
import {
  activarModoPruebasAction,
  activarVistaUsuarioAction,
  desactivarModoPruebasAction,
  enviarDigestPruebaAction,
  guardarAjustesGlobalesAction,
  sincronizarSandboxAction,
} from "./acciones";

export const dynamic = "force-dynamic";

export default async function AdminAjustesPage() {
  await exigirAdmin();
  const [urlAbierta, sandbox] = await Promise.all([
    accesoUrlProyectosAbierto(),
    esModoPruebas(),
  ]);

  return (
    <>
      <Cabecera
        etiqueta="Admin"
        titulo="Ajustes"
        texto="Controles globales del portal. Afectan a todo el equipo."
        sello="global"
      />

      <form
        action={guardarAjustesGlobalesAction}
        className="tarjeta bg-papel p-5 max-w-[36rem] grid gap-4 mb-8"
      >
        <div>
          <h2 className="font-display font-bold text-[16px] tracking-tight mb-1">
            Acceso por URL a proyectos
          </h2>
          <p className="text-[13px] text-apagado leading-relaxed">
            Por defecto, un usuario solo puede abrir el tablero de proyectos en los que es
            responsable o colaborador. Activa esto para permitir entrar a cualquier proyecto
            con el enlace directo (aunque no aparezca en su lista). Los administradores entran
            siempre.
          </p>
        </div>

        <label className="flex items-start gap-3 text-[13.5px] cursor-pointer">
          <input
            type="checkbox"
            name="proyectos_url_abierta"
            value="1"
            defaultChecked={urlAbierta}
            className="mt-0.5 accent-[var(--magenta)]"
          />
          <span>
            Permitir abrir por URL proyectos en los que no participo
            <span className="block text-[12px] text-apagado mt-0.5">
              Estado actual: {urlAbierta ? "permitido" : "bloqueado"}
            </span>
          </span>
        </label>

        <div>
          <Boton className="boton" textoEnviando="Guardando…">
            Guardar
          </Boton>
        </div>
      </form>

      <section className="tarjeta bg-papel p-5 max-w-[36rem] grid gap-4 mb-8">
        <div>
          <h2 className="font-display font-bold text-[16px] tracking-tight mb-1">
            Vista usuario
          </h2>
          <p className="text-[13px] text-apagado leading-relaxed">
            Desactiva los privilegios de administrador <b>solo en tu sesión</b> para
            probar el portal como un usuario normal (menú, permisos de perfil, sin
            enlace Admin). Para volver: banner en la app o Ajustes personales.
          </p>
          <p className="text-[12px] text-apagado mt-2">
            Estado actual: privilegios admin
          </p>
        </div>
        <div>
          <form action={activarVistaUsuarioAction}>
            <input type="hidden" name="next" value="/" />
            <Boton className="boton" textoEnviando="Activando…">
              Activar vista usuario
            </Boton>
          </form>
        </div>
      </section>

      <section className="tarjeta bg-papel p-5 max-w-[36rem] grid gap-4 mb-8">
        <div>
          <h2 className="font-display font-bold text-[16px] tracking-tight mb-1">
            Base de datos de pruebas
          </h2>
          <p className="text-[13px] text-apagado leading-relaxed">
            Cambia <b>solo tu sesión</b> a la base <code>orbita_pruebas</code> (clientes,
            proyectos y tareas mock). El resto del equipo sigue en datos reales. No se envían
            correos ni se escribe en Google Calendar. Los adjuntos van al prefijo{" "}
            <code>pruebas/</code> en GCS.
          </p>
          <p className="text-[12px] text-apagado mt-2">
            Estado actual: {sandbox ? "modo pruebas" : "datos reales"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {sandbox ? (
            <form action={desactivarModoPruebasAction}>
              <Boton className="boton" textoEnviando="Saliendo…">
                Volver a datos reales
              </Boton>
            </form>
          ) : (
            <form action={activarModoPruebasAction}>
              <Boton className="boton" textoEnviando="Activando…">
                Entrar en modo pruebas
              </Boton>
            </form>
          )}
          <form action={sincronizarSandboxAction}>
            <Boton className="boton-sec" textoEnviando="Copiando…">
              Sincronizar usuarios desde producción
            </Boton>
          </form>
        </div>
      </section>

      <section className="tarjeta bg-papel p-5 max-w-[36rem] grid gap-4">
        <div>
          <h2 className="font-display font-bold text-[16px] tracking-tight mb-1">
            Digest por correo
          </h2>
          <p className="text-[13px] text-apagado leading-relaxed">
            Envía a tu correo un digest de prueba con tus tareas reales (vista por
            proyecto + resumen Gemini si hay API key). No respeta la hora programada ni
            marca el envío del cron.
          </p>
        </div>
        <form action={enviarDigestPruebaAction}>
          <Boton className="boton" textoEnviando="Enviando…">
            Enviar notificación de prueba
          </Boton>
        </form>
      </section>
    </>
  );
}
