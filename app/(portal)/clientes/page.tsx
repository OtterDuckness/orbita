import {
  ordenarPorPertenencia,
  perteneceAlProyecto,
  personaPorId,
  type PersonaEquipo,
} from "@/lib/clientes-mock";
import { listarClientes } from "@/lib/clientes";
import { colaboradoresIdsDeCliente, proyectosDe } from "@/lib/proyectos";
import { listarTiposProyecto, mapaNombresTipo } from "@/lib/tipos-proyecto";
import { listarEquipo } from "@/lib/usuarios";
import { alcanceProyectos, exigirPermiso } from "@/lib/authz";
import Link from "next/link";
import { Cabecera } from "../cabecera";
import { NuevaCuentaLightbox } from "./nueva-cuenta-lightbox";
import { ListaClientes, type ClienteTarjeta } from "./lista-clientes";

export const dynamic = "force-dynamic";

export default async function Clientes({
  searchParams,
}: {
  searchParams: Promise<{ todo?: string }>;
}) {
  const yo = await exigirPermiso("clientes.ver");
  const params = await searchParams;
  const { soloDe, verTodo } = alcanceProyectos(yo, params.todo);

  const [tipos, nombresTipo, equipoRaw, clientes] = await Promise.all([
    listarTiposProyecto(),
    mapaNombresTipo(),
    listarEquipo(),
    listarClientes(),
  ]);
  const equipo: PersonaEquipo[] = equipoRaw;

  const items: ClienteTarjeta[] = (
    await Promise.all(
      clientes.map(async (c) => {
        const esDueñoCuenta = c.responsableId === yo.id;
        // Dueño de cuenta ve todos los proyectos de la cuenta; si no, alcance habitual.
        const alcanceFetch = esDueñoCuenta || verTodo ? null : soloDe;
        const [proyectosRaw, colaboradorIds] = await Promise.all([
          proyectosDe(c.id, alcanceFetch),
          colaboradoresIdsDeCliente(c.id, alcanceFetch),
        ]);
        const proyectos = ordenarPorPertenencia(proyectosRaw, yo.id);
        const esMio =
          esDueñoCuenta ||
          proyectos.some((p) => perteneceAlProyecto(p, yo.id));
        return {
          cliente: c,
          proyectos: proyectos.map((p) => ({
            id: p.id,
            tipo:
              p.nombre?.trim() || (p.tipoId ? nombresTipo.get(p.tipoId) : undefined) || "—",
            feeMensual: p.feeMensual,
            finContrato: p.finContrato,
            responsableNombre: personaPorId(p.responsableId, equipo)?.nombre ?? null,
            prioridad: p.prioridad,
          })),
          colaboradorIds,
          responsableSugerido: c.responsableId ?? "",
          responsableClienteNombre:
            personaPorId(c.responsableId, equipo)?.nombre ?? null,
          esMio,
          puedeGestionar: yo.esAdmin || esDueñoCuenta,
        } satisfies ClienteTarjeta;
      }),
    )
  ).sort((a, b) => {
    if (a.esMio !== b.esMio) return a.esMio ? -1 : 1;
    return a.cliente.nombre.localeCompare(b.cliente.nombre, "es");
  });

  const nMios = items.filter((i) => i.esMio).length;
  const sello = nMios === 1 ? "1 oportunidad mía" : `${nMios} oportunidades mías`;

  return (
    <>
      <Cabecera
        etiqueta="Cuentas"
        titulo="Clientes"
        texto="Alta a mano o desde Clientify. Cada cuenta tiene responsable de cliente; los proyectos heredan ese valor por defecto y tienen su propio responsable y colaboradores. Mis oportunidades: tus cuentas o proyectos. Todas: directorio en tabla."
        sello={sello}
        acciones={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {yo.esAdmin ? (
              <Link
                href={verTodo ? "/clientes" : "/clientes?todo=1"}
                className="boton-sec text-[12px] px-2.5 py-1"
              >
                {verTodo ? "Solo míos" : "Ver todo"}
              </Link>
            ) : null}
            <NuevaCuentaLightbox
              tipos={tipos}
              equipo={equipo}
              responsablePorDefecto={yo.id}
            />
          </div>
        }
      />

      <ListaClientes items={items} tipos={tipos} equipo={equipo} />
    </>
  );
}
