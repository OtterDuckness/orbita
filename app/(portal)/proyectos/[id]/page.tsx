import { notFound, redirect } from "next/navigation";
import { personaPorId, type PersonaEquipo } from "@/lib/clientes-mock";
import { accesoUrlProyectosAbierto } from "@/lib/ajustes-globales";
import { clientePorId } from "@/lib/clientes";
import {
  cargarContextoProyecto,
  flagsProyecto,
  puedeVerProyectoCtx,
} from "@/lib/permisos-entidad";
import { marcarAsignacionVista, proyectoPorId } from "@/lib/proyectos";
import { columnasDe, columnasOcultasDe, tareasDe } from "@/lib/tablero";
import { nombreDeTipo } from "@/lib/tipos-proyecto";
import { listarEquipo } from "@/lib/usuarios";
import { exigirPermiso } from "@/lib/authz";
import { TableroCliente } from "./tablero";

export const dynamic = "force-dynamic";

export default async function TableroProyecto({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tarea?: string }>;
}) {
  const yo = await exigirPermiso("tareas.ver");
  const { id } = await params;
  const { tarea } = await searchParams;
  const proyecto = await proyectoPorId(id);
  if (!proyecto) notFound();

  const ctx = await cargarContextoProyecto(id);
  if (!ctx) notFound();
  const puedeVer = puedeVerProyectoCtx(yo, ctx);
  if (!puedeVer) {
    const urlAbierta = await accesoUrlProyectosAbierto();
    if (!urlAbierta) redirect("/?aviso=sin_permiso");
  }

  // Marca asignación como vista (sin revalidatePath: no se puede en render).
  if (puedeVer) {
    await marcarAsignacionVista(id, yo.id);
  }

  const [equipoRaw, cliente, tipoProyecto, columnas, tareas, columnasOcultas] = await Promise.all([
    listarEquipo(),
    clientePorId(proyecto.clienteId),
    nombreDeTipo(proyecto.tipoId),
    columnasDe(id),
    tareasDe(id),
    columnasOcultasDe(yo.id, id),
  ]);
  const equipo: PersonaEquipo[] = equipoRaw;
  const flags = flagsProyecto(yo, ctx);

  const respProyecto = personaPorId(proyecto.responsableId, equipo);
  const tituloProyecto = proyecto.nombre?.trim() || tipoProyecto;

  return (
    <TableroCliente
      proyectoId={id}
      clienteNombre={cliente?.nombre ?? (proyecto.ambito === "interno" ? "Interno" : "Cuenta")}
      tituloProyecto={tituloProyecto}
      finContrato={proyecto.finContrato}
      responsableNombre={respProyecto?.nombre ?? null}
      colaboradorIds={proyecto.colaboradorIds}
      equipo={equipo}
      yoId={yo.id}
      columnasIniciales={columnas}
      columnasOcultasIniciales={columnasOcultas}
      tareasIniciales={tareas}
      tareaAbiertaInicial={tarea}
      puedeGestionarProyecto={flags.puedeGestionar}
      puedeCrearTarea={flags.puedeCrearTarea}
      puedeCambiarSolicitante={flags.puedeCambiarSolicitante}
    />
  );
}
