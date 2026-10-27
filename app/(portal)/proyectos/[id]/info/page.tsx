import { notFound, redirect } from "next/navigation";
import { personaPorId, type PersonaEquipo } from "@/lib/clientes-mock";
import { accesoUrlProyectosAbierto } from "@/lib/ajustes-globales";
import { clientePorId } from "@/lib/clientes";
import { puedeVerProyecto } from "@/lib/permisos-entidad";
import { proyectoPorId } from "@/lib/proyectos";
import { columnasDe, statsProyecto, tareasDe } from "@/lib/tablero";
import { nombreDeTipo } from "@/lib/tipos-proyecto";
import { listarEquipo } from "@/lib/usuarios";
import { exigirPermiso } from "@/lib/authz";
import { InfoProyecto } from "../info-proyecto";

export const dynamic = "force-dynamic";

export default async function InfoProyectoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const yo = await exigirPermiso("tareas.ver");
  const { id } = await params;
  const proyecto = await proyectoPorId(id);
  if (!proyecto) notFound();

  if (!(await puedeVerProyecto(yo, id))) {
    const urlAbierta = await accesoUrlProyectosAbierto();
    if (!urlAbierta) redirect("/?aviso=sin_permiso");
  }

  const [equipoRaw, cliente, tipoProyecto, columnas, tareas] = await Promise.all([
    listarEquipo(),
    clientePorId(proyecto.clienteId),
    nombreDeTipo(proyecto.tipoId),
    columnasDe(id),
    tareasDe(id),
  ]);
  const equipo: PersonaEquipo[] = equipoRaw;
  const respProyecto = personaPorId(proyecto.responsableId, equipo);
  const tituloProyecto = proyecto.nombre?.trim() || tipoProyecto;
  const clienteNombre = cliente?.nombre ?? (proyecto.ambito === "interno" ? "Interno" : "Cuenta");
  const stats = statsProyecto(tareas, columnas, equipo);

  return (
    <InfoProyecto
      clienteNombre={clienteNombre}
      tituloProyecto={tituloProyecto}
      finContrato={proyecto.finContrato}
      responsableNombre={respProyecto?.nombre ?? null}
      stats={stats}
    />
  );
}
