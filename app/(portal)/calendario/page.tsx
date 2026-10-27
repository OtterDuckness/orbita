import { exigirPermiso } from "@/lib/authz";
import type { PersonaEquipo } from "@/lib/clientes-mock";
import { cargarContextoProyecto, flagsProyecto } from "@/lib/permisos-entidad";
import { proyectoPersonalDe, tareasDelUsuario } from "@/lib/tablero";
import { listarEquipo } from "@/lib/usuarios";
import { Cabecera } from "../cabecera";
import { VistaCalendario, type FlagsProyectoUi } from "./vista-calendario";

export const dynamic = "force-dynamic";

export default async function CalendarioPage() {
  const yo = await exigirPermiso("tareas.ver");

  const [equipoRaw, tareasRaw, personalId] = await Promise.all([
    listarEquipo(),
    tareasDelUsuario(yo.id),
    proyectoPersonalDe(yo.id),
  ]);
  const equipo: PersonaEquipo[] = equipoRaw;
  const tareas = tareasRaw.filter((t) => Boolean(t.fechaMaxima));

  const proyectoIds = [...new Set([personalId, ...tareas.map((t) => t.proyectoId)])];
  const colaboradorIdsPorProyecto: Record<string, string[]> = {};
  const flagsPorProyecto: Record<string, FlagsProyectoUi> = {};
  await Promise.all(
    proyectoIds.map(async (pid) => {
      const ctx = await cargarContextoProyecto(pid);
      colaboradorIdsPorProyecto[pid] =
        ctx?.proyecto.colaboradorIds ?? (pid === personalId ? [yo.id] : []);
      if (!ctx) {
        flagsPorProyecto[pid] = {
          puedeGestionarProyecto: false,
          puedeCambiarSolicitante: false,
        };
        return;
      }
      const f = flagsProyecto(yo, ctx);
      flagsPorProyecto[pid] = {
        puedeGestionarProyecto: f.puedeGestionar,
        puedeCambiarSolicitante: f.puedeCambiarSolicitante,
      };
    }),
  );

  return (
    <>
      <Cabecera
        etiqueta="Agenda"
        titulo="Calendario"
        texto="Tus tareas (por fecha máxima) y las reuniones de tu Google Calendar. Pulsa un hueco o un día para crear; pulsa una tarea para ver el detalle."
        sello={`${tareas.filter((t) => !t.completadaEl).length} abiertas`}
      />
      <VistaCalendario
        tareasIniciales={tareas}
        equipo={equipo}
        yoId={yo.id}
        personalProyectoId={personalId}
        colaboradorIdsPorProyecto={colaboradorIdsPorProyecto}
        flagsPorProyecto={flagsPorProyecto}
      />
    </>
  );
}
