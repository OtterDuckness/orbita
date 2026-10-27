import { listarClientes, mapaNombresCliente } from "@/lib/clientes";
import { idsProyectosAsignacionSinVer, idsProyectosFavoritosDe, listarProyectos } from "@/lib/proyectos";
import { contarTareasAbiertasMap } from "@/lib/tablero";
import { enriquecerProyectosVista } from "@/lib/tareas-mock";
import { contarUsoActivosTipo, listarTiposProyecto, mapaNombresTipo } from "@/lib/tipos-proyecto";
import { listarEquipo } from "@/lib/usuarios";
import { alcanceProyectos, exigirPermiso } from "@/lib/authz";
import Link from "next/link";
import { Cabecera } from "../cabecera";
import { NuevoProyectoLightbox } from "./nuevo-proyecto-lightbox";
import { GestionarTiposLightbox } from "./gestionar-tipos-lightbox";
import { ListaProyectos } from "./lista-proyectos";

export const dynamic = "force-dynamic";

export default async function Proyectos({
  searchParams,
}: {
  searchParams: Promise<{ todo?: string }>;
}) {
  const yo = await exigirPermiso("proyectos.ver");
  const params = await searchParams;
  const { soloDe, verTodo } = alcanceProyectos(yo, params.todo);

  const [nombresTipo, clientes, tiposDb, equipo, nombresCliente, proyectosDb, idsNovedad, favoritos] =
    await Promise.all([
      mapaNombresTipo(),
      listarClientes(),
      listarTiposProyecto(),
      listarEquipo(),
      mapaNombresCliente(),
      listarProyectos(soloDe),
      idsProyectosAsignacionSinVer(yo.id),
      idsProyectosFavoritosDe(yo.id),
    ]);
  const nombresPersona = new Map(equipo.map((p) => [p.id, p.nombre]));
  const respClientePorId = new Map(clientes.map((c) => [c.id, c.responsableId]));
  const abiertas = await contarTareasAbiertasMap(proyectosDb.map((p) => p.id));
  const proyectos = enriquecerProyectosVista(
    proyectosDb,
    nombresTipo,
    nombresPersona,
    nombresCliente,
    abiertas,
  ).map((p) => ({
    ...p,
    esFavorito: favoritos.has(p.id),
    puedeGestionar:
      yo.esAdmin ||
      p.responsableId === yo.id ||
      Boolean(p.personalDeId && p.personalDeId === yo.id) ||
      Boolean(p.clienteId && respClientePorId.get(p.clienteId) === yo.id),
  }));
  const activos = proyectos.filter((p) => p.estado === "activo").length;
  const usos = await Promise.all(tiposDb.map((t) => contarUsoActivosTipo(t.id)));
  const tipos = tiposDb.map((t, i) => ({
    ...t,
    enUso: usos[i] ?? 0,
  }));

  return (
    <>
      <Cabecera
        etiqueta="Trabajo interno"
        titulo="Proyectos"
        texto="Los tableros son solo del equipo: el cliente no ve tareas. Pueden ser internos (sin cliente) o externos (ligados a una cuenta). Una cuenta puede tener varios proyectos."
        sello={`${activos} ${activos === 1 ? "activo" : "activos"}`}
        acciones={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {yo.esAdmin ? (
              <Link
                href={verTodo ? "/proyectos" : "/proyectos?todo=1"}
                className="boton-sec text-[12px] px-2.5 py-1"
              >
                {verTodo ? "Solo míos" : "Ver todo"}
              </Link>
            ) : null}
            <GestionarTiposLightbox tipos={tipos} />
            <NuevoProyectoLightbox
              clientes={clientes}
              tipos={tipos}
              equipo={equipo}
              responsablePorDefecto={yo.id}
            />
          </div>
        }
      />

      <ListaProyectos
        proyectos={proyectos}
        tipos={tipos}
        equipo={equipo}
        yoId={yo.id}
        proyectoIdsNovedad={idsNovedad}
      />
    </>
  );
}
