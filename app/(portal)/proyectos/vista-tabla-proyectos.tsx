"use client";

import Link from "next/link";
import {
  rangoPertenencia,
  type EstadoProyecto,
  type PersonaEquipo,
  type TipoProyecto,
} from "@/lib/clientes-mock";
import { type ProyectoVista } from "@/lib/tareas-mock";
import { euros, fecha } from "@/lib/formato";
import { Boton } from "../boton";
import { ListaColaboradores } from "../colaboradores-ui";
import { IconoPrioridad } from "../clientes/icono-prioridad";
import { NotasLightbox } from "../notas-lightbox";
import { EditarProyectoLightbox } from "./editar-proyecto-lightbox";
import {
  btnIcono,
  IconoArchivar,
  IconoNotas,
  IconoReactivar,
  IconoTerminado,
} from "./iconos-acciones";
import { BotonFavorito } from "./boton-favorito";
import {
  archivarProyectoLista,
  marcarProyectoTerminado,
  reactivarProyectoLista,
} from "./acciones";
import { PuntoNovedad } from "../punto-novedad";

const INTERNO = "__interno__";

type GrupoProyectos = {
  clave: string;
  titulo: string;
  proyectos: ProyectoVista[];
  rangoMejor: number;
};

function etiquetaEstado(estado: EstadoProyecto) {
  if (estado === "terminado") return "Terminado";
  if (estado === "archivado") return "Archivado";
  return "Activo";
}

function ordenarPorFinContrato(lista: ProyectoVista[]): ProyectoVista[] {
  return [...lista].sort((a, b) => {
    if (!a.finContrato && !b.finContrato) return 0;
    if (!a.finContrato) return 1;
    if (!b.finContrato) return -1;
    return a.finContrato.localeCompare(b.finContrato);
  });
}

function agruparPorCliente(proyectos: ProyectoVista[], yoId: string): GrupoProyectos[] {
  const mapa = new Map<string, GrupoProyectos>();

  for (const p of proyectos) {
    const clave = p.clienteId ?? INTERNO;
    const existente = mapa.get(clave);
    if (existente) {
      existente.proyectos.push(p);
    } else {
      mapa.set(clave, {
        clave,
        titulo: clave === INTERNO ? "Sin cliente" : p.clienteNombre,
        proyectos: [p],
        rangoMejor: 2,
      });
    }
  }

  for (const g of mapa.values()) {
    g.proyectos = ordenarPorFinContrato(g.proyectos);
    g.rangoMejor =
      g.proyectos.length === 0
        ? 2
        : Math.min(...g.proyectos.map((p) => rangoPertenencia(p, yoId)));
  }

  return [...mapa.values()].sort((a, b) => {
    if (a.clave === INTERNO) return 1;
    if (b.clave === INTERNO) return -1;
    if (a.rangoMejor !== b.rangoMejor) return a.rangoMejor - b.rangoMejor;
    const diff = b.proyectos.length - a.proyectos.length;
    return diff !== 0 ? diff : a.titulo.localeCompare(b.titulo, "es");
  });
}

function TarjetaProyecto({
  p,
  tipos,
  equipo,
  idsNovedad,
}: {
  p: ProyectoVista;
  tipos: TipoProyecto[];
  equipo: PersonaEquipo[];
  idsNovedad?: Set<string>;
}) {
  return (
    <article className="tarjeta bg-papel p-4 flex flex-col min-w-0 h-full">
      <div className="group/fav flex items-start gap-1 flex-wrap mb-3">
        <BotonFavorito proyectoId={p.id} activo={Boolean(p.esFavorito)} className="mt-0.5" />
        <Link
          href={`/proyectos/${p.id}`}
          className="min-w-0 flex-1 flex items-baseline gap-2 flex-wrap group"
        >
          <b className="font-display text-[16px] group-hover:text-magenta-texto transition inline-flex items-center gap-1.5 min-w-0">
            {idsNovedad?.has(p.id) ? <PuntoNovedad /> : null}
            <span className="truncate">{p.titulo}</span>
          </b>
          {p.estado !== "activo" ? (
            <span className="etiqueta text-apagado">{etiquetaEstado(p.estado)}</span>
          ) : null}
          <IconoPrioridad prioridad={p.prioridad} />
        </Link>
      </div>

      <Link
        href={`/proyectos/${p.id}`}
        className="grid gap-1.5 text-[13px] flex-1 min-w-0 rounded-lg -mx-1 px-1 hover:bg-fila-hover transition"
      >
        <div className="flex gap-2 min-w-0">
          <span className="etiqueta shrink-0 w-[7.5rem]">Oportunidad</span>
          <span>{euros(p.feeMensual)}</span>
        </div>
        <div className="flex gap-2 min-w-0">
          <span className="etiqueta shrink-0 w-[7.5rem]">Fin</span>
          <span>{fecha(p.finContrato)}</span>
        </div>
        <div className="flex gap-2 min-w-0">
          <span className="etiqueta shrink-0 w-[7.5rem]">Responsable</span>
          <span>{p.responsableNombre ?? "—"}</span>
        </div>
        <div className="flex gap-2 min-w-0 items-start">
          <span className="etiqueta shrink-0 w-[7.5rem] pt-0.5">Colaboradores</span>
          <ListaColaboradores ids={p.colaboradorIds} equipo={equipo} />
        </div>
      </Link>

      <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-linea items-center">
        <NotasLightbox proyectoId={p.id} titulo={p.titulo} className={btnIcono}>
          <IconoNotas />
        </NotasLightbox>
        <EditarProyectoLightbox
          proyecto={p}
          tipos={tipos}
          equipo={equipo}
          puedeGestionar={p.puedeGestionar ?? false}
        >
          {p.estado === "activo" ? (
            <>
              <form action={marcarProyectoTerminado}>
                <input type="hidden" name="proyecto_id" value={p.id} />
                <Boton
                  className={`${btnIcono} text-bien border-bien-borde hover:bg-bien-suave`}
                  title="Terminado"
                  aria-label="Terminado"
                  textoEnviando="…"
                >
                  <IconoTerminado />
                </Boton>
              </form>
              <form action={archivarProyectoLista}>
                <input type="hidden" name="proyecto_id" value={p.id} />
                <Boton
                  className={btnIcono}
                  title="Archivar"
                  aria-label="Archivar"
                  textoEnviando="…"
                >
                  <IconoArchivar />
                </Boton>
              </form>
            </>
          ) : null}
          {p.estado === "terminado" ? (
            <>
              <form action={reactivarProyectoLista}>
                <input type="hidden" name="proyecto_id" value={p.id} />
                <Boton
                  className={btnIcono}
                  title="Reactivar"
                  aria-label="Reactivar"
                  textoEnviando="…"
                >
                  <IconoReactivar />
                </Boton>
              </form>
              <form action={archivarProyectoLista}>
                <input type="hidden" name="proyecto_id" value={p.id} />
                <Boton
                  className={btnIcono}
                  title="Archivar"
                  aria-label="Archivar"
                  textoEnviando="…"
                >
                  <IconoArchivar />
                </Boton>
              </form>
            </>
          ) : null}
          {p.estado === "archivado" ? (
            <form action={reactivarProyectoLista}>
              <input type="hidden" name="proyecto_id" value={p.id} />
              <Boton
                className={btnIcono}
                title="Reactivar"
                aria-label="Reactivar"
                textoEnviando="…"
              >
                <IconoReactivar />
              </Boton>
            </form>
          ) : null}
        </EditarProyectoLightbox>
      </div>
    </article>
  );
}

export function VistaTablaProyectos({
  proyectos,
  tipos,
  equipo,
  yoId,
  idsNovedad,
  agruparCliente = true,
}: {
  proyectos: ProyectoVista[];
  tipos: TipoProyecto[];
  equipo: PersonaEquipo[];
  yoId: string;
  idsNovedad?: Set<string>;
  agruparCliente?: boolean;
}) {
  if (!agruparCliente) {
    const ordenados = ordenarPorFinContrato(proyectos);
    return (
      <div className="grid gap-3 grid-cols-1 min-[720px]:grid-cols-2">
        {ordenados.map((p) => (
          <TarjetaProyecto
            key={p.id}
            p={p}
            tipos={tipos}
            equipo={equipo}
            idsNovedad={idsNovedad}
          />
        ))}
      </div>
    );
  }

  const grupos = agruparPorCliente(proyectos, yoId);

  return (
    <div className="grid gap-8">
      {grupos.map((g) => (
        <section key={g.clave} className="min-w-0">
          <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
            <h2 className="font-display font-bold text-[18px] tracking-tight">{g.titulo}</h2>
            <span className="font-mono text-[11px] text-apagado">
              {g.proyectos.length} {g.proyectos.length === 1 ? "proyecto" : "proyectos"}
            </span>
          </div>
          <div className="grid gap-3 grid-cols-1 min-[720px]:grid-cols-2">
            {g.proyectos.map((p) => (
              <TarjetaProyecto
                key={p.id}
                p={p}
                tipos={tipos}
                equipo={equipo}
                idsNovedad={idsNovedad}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
