import { notFound, redirect } from "next/navigation";
import { accesoUrlProyectosAbierto } from "@/lib/ajustes-globales";
import { exigirAdmin } from "@/lib/authz";
import { esProyectoBoostiq } from "@/lib/boostiq-proyecto";
import { puedeVerProyecto } from "@/lib/permisos-entidad";
import { proyectoPorId } from "@/lib/proyectos";
import { BoostiqAdminEmbed } from "./boostiq-admin-embed";

export const dynamic = "force-dynamic";

export default async function ProyectoBoostiqAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const yo = await exigirAdmin();
  const { id } = await params;
  const proyecto = await proyectoPorId(id);
  if (!proyecto) notFound();
  if (!esProyectoBoostiq(proyecto)) notFound();

  if (!(await puedeVerProyecto(yo, id))) {
    const urlAbierta = await accesoUrlProyectosAbierto();
    if (!urlAbierta) redirect("/?aviso=sin_permiso");
  }

  return <BoostiqAdminEmbed />;
}
