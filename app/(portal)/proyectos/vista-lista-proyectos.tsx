"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ordenarPorPertenencia,
  type EstadoProyecto,
  type PersonaEquipo,
  type PrioridadProyecto,
  type TipoProyecto,
} from "@/lib/clientes-mock";
import { type ProyectoVista } from "@/lib/tareas-mock";
import { euros, fecha } from "@/lib/formato";
import { Boton } from "../boton";
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

type ColumnaOrden =
  | "titulo"
  | "cliente"
  | "tipo"
  | "estado"
  | "prioridad"
  | "oportunidad"
  | "fin"
  | "responsable"
  | "tareas";

type Direccion = "asc" | "desc";

const PESO_PRIORIDAD: Record<PrioridadProyecto, number> = {
  urgente: 0,
  alta: 1,
  media: 2,
  baja: 3,
};

const PESO_ESTADO: Record<EstadoProyecto, number> = {
  activo: 0,
  terminado: 1,
  archivado: 2,
};

const COLUMNAS: {
  id: ColumnaOrden;
  etiqueta: string;
  titulo?: string;
  alinear?: "right";
  thClass?: string;
}[] = [
  { id: "titulo", etiqueta: "Proyecto", thClass: "w-[13%]" },
  { id: "cliente", etiqueta: "Cliente", thClass: "w-[14%]" },
  { id: "tipo", etiqueta: "Tipo", thClass: "w-[12%]" },
  { id: "estado", etiqueta: "Est.", titulo: "Estado", thClass: "w-[5%]" },
  { id: "prioridad", etiqueta: "Prio.", titulo: "Prioridad", thClass: "w-[4%]" },
  { id: "oportunidad", etiqueta: "Oport.", titulo: "Oportunidad", thClass: "w-[8%]" },
  { id: "fin", etiqueta: "Fin", thClass: "w-[8%]" },
  { id: "responsable", etiqueta: "Resp.", titulo: "Responsable", thClass: "w-[13%]" },
  { id: "tareas", etiqueta: "Tar.", titulo: "Tareas", alinear: "right", thClass: "w-[4%]" },
];

function etiquetaEstado(estado: EstadoProyecto) {
  if (estado === "terminado") return "Term.";
  if (estado === "archivado") return "Arch.";
  return "Act.";
}

function etiquetaEstadoLarga(estado: EstadoProyecto) {
  if (estado === "terminado") return "Terminado";
  if (estado === "archivado") return "Archivado";
  return "Activo";
}

function valorTexto(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? "").localeCompare(b ?? "", "es", { sensitivity: "base" });
}

function valorNumero(a: number | null | undefined, b: number | null | undefined) {
  const na = a ?? Number.NEGATIVE_INFINITY;
  const nb = b ?? Number.NEGATIVE_INFINITY;
  return na === nb ? 0 : na < nb ? -1 : 1;
}

function comparar(a: ProyectoVista, b: ProyectoVista, col: ColumnaOrden): number {
  switch (col) {
    case "titulo":
      return valorTexto(a.titulo, b.titulo);
    case "cliente":
      return valorTexto(a.clienteId ? a.clienteNombre : "", b.clienteId ? b.clienteNombre : "");
    case "tipo":
      return valorTexto(a.tipo, b.tipo);
    case "estado":
      return PESO_ESTADO[a.estado] - PESO_ESTADO[b.estado];
    case "prioridad":
      return PESO_PRIORIDAD[a.prioridad] - PESO_PRIORIDAD[b.prioridad];
    case "oportunidad":
      return valorNumero(a.feeMensual, b.feeMensual);
    case "fin": {
      if (!a.finContrato && !b.finContrato) return 0;
      if (!a.finContrato) return 1;
      if (!b.finContrato) return -1;
      return a.finContrato.localeCompare(b.finContrato);
    }
    case "responsable":
      return valorTexto(a.responsableNombre, b.responsableNombre);
    case "tareas":
      return a.tareasAbiertas - b.tareasAbiertas;
  }
}

function CabeceraOrdenable({
  id,
  etiqueta,
  titulo,
  activa,
  direccion,
  alinear,
  thClass,
  onOrdenar,
}: {
  id: ColumnaOrden;
  etiqueta: string;
  titulo?: string;
  activa: boolean;
  direccion: Direccion;
  alinear?: "right";
  thClass?: string;
  onOrdenar: (id: ColumnaOrden) => void;
}) {
  return (
    <th
      className={[alinear === "right" ? "text-right" : "", thClass].filter(Boolean).join(" ") || undefined}
      aria-sort={activa ? (direccion === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        title={titulo}
        onClick={() => onOrdenar(id)}
        className={`inline-flex items-center gap-1 hover:text-magenta-texto transition ${
          alinear === "right" ? "flex-row-reverse" : ""
        } ${activa ? "text-tinta" : "text-inherit"}`}
      >
        {etiqueta}
        <span className="font-mono text-[10px] text-apagado w-3" aria-hidden="true">
          {activa ? (direccion === "asc" ? "▲" : "▼") : ""}
        </span>
      </button>
    </th>
  );
}

export function VistaListaProyectos({
  proyectos,
  tipos,
  equipo,
  yoId,
  idsNovedad,
  ordenInicial = "fin",
}: {
  proyectos: ProyectoVista[];
  tipos: TipoProyecto[];
  equipo: PersonaEquipo[];
  yoId: string;
  idsNovedad?: Set<string>;
  /** Columna de orden por defecto (p. ej. «cliente» en externos). */
  ordenInicial?: ColumnaOrden;
}) {
  const [columna, setColumna] = useState<ColumnaOrden | null>(ordenInicial);
  const [direccion, setDireccion] = useState<Direccion>("asc");

  function ordenarPor(id: ColumnaOrden) {
    if (columna === id) {
      setDireccion((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setColumna(id);
      setDireccion("asc");
    }
  }

  const ordenados = useMemo(() => {
    if (!columna) return ordenarPorPertenencia(proyectos, yoId);
    const signo = direccion === "asc" ? 1 : -1;
    return [...proyectos].sort((a, b) => signo * comparar(a, b, columna));
  }, [proyectos, yoId, columna, direccion]);

  return (
    <div className="overflow-x-auto border border-linea-fuerte rounded-[10px] shadow-suave">
      <table className="tabla w-full table-fixed text-[13px] [&_th]:px-1.5 [&_td]:px-1.5 [&_th]:py-2 [&_td]:py-2">
        <thead className="bg-suave">
          <tr>
            {COLUMNAS.map((c) => (
              <CabeceraOrdenable
                key={c.id}
                id={c.id}
                etiqueta={c.etiqueta}
                titulo={c.titulo}
                activa={columna === c.id}
                direccion={direccion}
                alinear={c.alinear}
                thClass={c.thClass}
                onOrdenar={ordenarPor}
              />
            ))}
            <th className="w-[18%] !normal-case !tracking-normal">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {ordenados.map((p) => (
            <tr key={p.id}>
              <td className="min-w-0">
                <div className="group/fav flex items-center gap-1 min-w-0">
                  <BotonFavorito proyectoId={p.id} activo={Boolean(p.esFavorito)} />
                  <Link
                    href={`/proyectos/${p.id}`}
                    title={p.titulo}
                    className="font-semibold hover:text-magenta-texto transition truncate flex items-center gap-1.5 min-w-0"
                  >
                    {idsNovedad?.has(p.id) ? <PuntoNovedad /> : null}
                    <span className="truncate">{p.titulo}</span>
                  </Link>
                </div>
              </td>
              <td className="min-w-0">
                <span
                  className={`truncate block ${
                    p.clienteId
                      ? "font-semibold text-tinta"
                      : "text-apagado"
                  }`}
                  title={p.clienteId ? p.clienteNombre : undefined}
                >
                  {p.clienteId ? p.clienteNombre : "—"}
                </span>
              </td>
              <td className="min-w-0 text-apagado">
                <span className="truncate block" title={p.tipo}>
                  {p.tipo}
                </span>
              </td>
              <td>
                {p.estado === "activo" ? (
                  <span className="text-apagado" title={etiquetaEstadoLarga(p.estado)}>
                    {etiquetaEstado(p.estado)}
                  </span>
                ) : (
                  <span
                    className="etiqueta text-apagado"
                    title={etiquetaEstadoLarga(p.estado)}
                  >
                    {etiquetaEstado(p.estado)}
                  </span>
                )}
              </td>
              <td>
                <IconoPrioridad prioridad={p.prioridad} />
              </td>
              <td className="font-mono text-[12px] whitespace-nowrap">
                {euros(p.feeMensual)}
              </td>
              <td className="font-mono text-[12px] text-apagado whitespace-nowrap">
                {fecha(p.finContrato)}
              </td>
              <td className="min-w-0">
                <span
                  className="truncate block"
                  title={p.responsableNombre ?? undefined}
                >
                  {p.responsableNombre ?? "—"}
                </span>
              </td>
              <td className="text-right font-mono text-[12px]">
                {p.tareasAbiertas}
              </td>
              <td>
                <div className="flex flex-nowrap gap-1 items-center">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
