import { exigirPermiso } from "@/lib/authz";
import { listarEquipo } from "@/lib/usuarios";
import {
  proyectoPersonalDe,
  tareaUsuarioPorId,
  tareasDelUsuario,
  tareasNuevasSinVer,
} from "@/lib/tablero";
import { cargarContextoProyecto, flagsProyecto } from "@/lib/permisos-entidad";
import { idsTareasChatSinLeer, puedeAccederTarea } from "@/lib/tarea-chat";
import type { PersonaEquipo } from "@/lib/clientes-mock";
import { Cabecera } from "../cabecera";
import { ListaTareas, type FlagsProyectoUi } from "./lista-tareas";

export const dynamic = "force-dynamic";

export default async function TareasPage({
  searchParams,
}: {
  searchParams: Promise<{ tarea?: string }>;
}) {
  const yo = await exigirPermiso("tareas.ver");
  const { tarea: tareaParam } = await searchParams;
  const tareaId = tareaParam?.trim() || undefined;

  const [equipoRaw, tareasBase, personalId, nuevas, chatSinLeer] = await Promise.all([
    listarEquipo(),
    tareasDelUsuario(yo.id),
    proyectoPersonalDe(yo.id),
    tareasNuevasSinVer(yo.id),
    idsTareasChatSinLeer(yo.id),
  ]);
  const equipo: PersonaEquipo[] = equipoRaw;

  // Deep-link: colaborador (u otro con acceso) puede abrir una tarea que no está
  // en la lista habitual de "mis tareas".
  let tareas = tareasBase;
  if (tareaId && !tareas.some((t) => t.id === tareaId)) {
    if (await puedeAccederTarea(tareaId, yo.id, yo.esAdmin)) {
      const extra = await tareaUsuarioPorId(tareaId);
      if (extra) tareas = [extra, ...tareas];
    }
  }

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
        etiqueta="Tu trabajo"
        titulo="Tareas"
        texto="Lo que te toca hoy, mañana o más tarde: tareas personales y las que te asignaron o pediste."
        sello={`${tareas.filter((t) => !t.completadaEl).length} abiertas`}
      />
      <ListaTareas
        tareasIniciales={tareas}
        equipo={equipo}
        yoId={yo.id}
        personalProyectoId={personalId}
        colaboradorIdsPorProyecto={colaboradorIdsPorProyecto}
        flagsPorProyecto={flagsPorProyecto}
        tareaAbiertaInicial={tareaId}
        tareaIdsNuevas={nuevas.map((t) => t.id)}
        tareaIdsChatSinLeer={chatSinLeer}
      />
    </>
  );
}
