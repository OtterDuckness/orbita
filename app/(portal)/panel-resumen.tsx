import type { ReactNode } from "react";
import Link from "next/link";
import { fecha } from "@/lib/formato";
import { hrefTareaPanel } from "@/lib/agenda";
import { vencimiento } from "@/lib/tareas-mock";
import { PuntoNovedad } from "./punto-novedad";

export type NovedadesPanel = {
  tareasNuevas: {
    id: string;
    nombre: string;
    proyectoId: string;
    proyectoEtiqueta: string;
    clienteNombre: string | null;
    creadoEl: string;
  }[] | null;
  clientesAsignados: {
    clienteId: string;
    clienteNombre: string;
    proyectoId: string;
    proyectoEtiqueta: string;
    asignadoEn: string;
  }[] | null;
  mensajesNuevos: {
    id: string;
    titulo: string;
    preview: string | null;
    noLeidos: number;
    ultimoEn: string | null;
    href: string;
  }[] | null;
  tareasVencidas: {
    id: string;
    nombre: string;
    proyectoId: string;
    esPersonal: boolean;
    proyectoEtiqueta: string;
    clienteNombre: string | null;
    fechaMaxima: string;
  }[] | null;
};

export type PanelResumenProps = {
  hoy?: ReactNode;
  proximos?: ReactNode;
  novedades?: NovedadesPanel | null;
};

function Chip({ n, tono = "magenta" }: { n: number; tono?: "magenta" | "mal" }) {
  if (n <= 0) return null;
  const cls =
    tono === "mal"
      ? "bg-mal-suave text-mal"
      : "bg-magenta-suave text-magenta-texto";
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[1.35rem] h-[1.2rem] px-1.5 rounded-md font-mono text-[10.5px] font-semibold tabular-nums ${cls}`}
    >
      {n}
    </span>
  );
}

function ListaNovedad({
  titulo,
  vacio,
  verTodoHref,
  verTodoLabel,
  count,
  countTono,
  items,
}: {
  titulo: string;
  vacio: string;
  verTodoHref?: string;
  verTodoLabel?: string;
  count?: number;
  countTono?: "magenta" | "mal";
  items: ReactNode;
}) {
  return (
    <div className="min-w-0 flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="etiqueta">{titulo}</h3>
          {typeof count === "number" ? <Chip n={count} tono={countTono} /> : null}
        </div>
        {verTodoHref && verTodoLabel ? (
          <Link
            href={verTodoHref}
            className="text-[11.5px] text-magenta-texto hover:underline shrink-0"
          >
            {verTodoLabel}
          </Link>
        ) : null}
      </div>
      <div className="min-w-0 overflow-x-hidden">
        {items ?? <p className="text-[13px] text-apagado py-1">{vacio}</p>}
      </div>
    </div>
  );
}

function BloqueNovedades({ novedades }: { novedades: NovedadesPanel }) {
  const nTareas = novedades.tareasNuevas?.length ?? 0;
  const nClientes = novedades.clientesAsignados?.length ?? 0;
  const nMensajes = novedades.mensajesNuevos?.length ?? 0;
  const nVencidas = novedades.tareasVencidas?.length ?? 0;
  const total = nTareas + nClientes + nMensajes + nVencidas;

  return (
    <section className="tarjeta p-3.5 flex flex-col min-h-0 h-full gap-0">
      <div className="flex items-baseline justify-between gap-2 shrink-0 pb-2.5 mb-3 border-b border-linea">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="font-display font-bold text-[16px] tracking-tight">Novedades</h2>
          <Chip n={total} tono={nVencidas > 0 ? "mal" : "magenta"} />
        </div>
      </div>
      <div className="grid gap-4 min-h-0 flex-1 content-start min-w-0 overflow-x-hidden overflow-y-auto">
        {novedades.tareasNuevas ? (
          <ListaNovedad
            titulo="Tareas nuevas"
            vacio="Ninguna sin ver."
            verTodoHref="/tareas"
            verTodoLabel="Ver tareas"
            count={nTareas}
            items={
              novedades.tareasNuevas.length === 0 ? null : (
                <ul className="grid gap-0.5">
                  {novedades.tareasNuevas.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={hrefTareaPanel({
                          id: t.id,
                          proyectoId: t.proyectoId,
                          esPersonal: false,
                        })}
                        className="block px-2 py-2 rounded-lg hover:bg-fila-hover transition"
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          <PuntoNovedad />
                          <b className="text-[13px] block truncate">{t.nombre}</b>
                        </span>
                        <span className="text-[12px] text-apagado truncate block pl-3.5">
                          {t.clienteNombre ? `${t.clienteNombre} · ` : ""}
                          {t.proyectoEtiqueta}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            }
          />
        ) : null}

        {novedades.clientesAsignados ? (
          <ListaNovedad
            titulo="Clientes asignados"
            vacio="Ninguno en los últimos 7 días."
            verTodoHref="/clientes"
            verTodoLabel="Ver clientes"
            count={nClientes}
            items={
              novedades.clientesAsignados.length === 0 ? null : (
                <ul className="grid gap-0.5">
                  {novedades.clientesAsignados.map((c) => (
                    <li key={`${c.clienteId}-${c.proyectoId}`}>
                      <Link
                        href={`/proyectos/${c.proyectoId}`}
                        className="block px-2 py-2 rounded-lg hover:bg-fila-hover transition"
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          <PuntoNovedad />
                          <b className="text-[13px] block truncate">{c.clienteNombre}</b>
                        </span>
                        <span className="text-[12px] text-apagado truncate block pl-3.5">
                          {c.proyectoEtiqueta} · {fecha(c.asignadoEn)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            }
          />
        ) : null}

        {novedades.mensajesNuevos ? (
          <ListaNovedad
            titulo="Mensajes nuevos"
            vacio="No hay mensajes sin leer."
            verTodoHref={
              novedades.mensajesNuevos.some((m) => m.href.startsWith("/comunicaciones"))
                ? "/comunicaciones"
                : "/tareas"
            }
            verTodoLabel="Ver todos"
            count={nMensajes}
            items={
              novedades.mensajesNuevos.length === 0 ? null : (
                <ul className="grid gap-0.5">
                  {novedades.mensajesNuevos.map((m) => (
                    <li key={m.id}>
                      <Link
                        href={m.href}
                        className="block px-2 py-2 rounded-lg hover:bg-fila-hover transition"
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          <PuntoNovedad />
                          <b className="text-[13px] block truncate">{m.titulo}</b>
                        </span>
                        <span className="text-[12px] text-apagado truncate block pl-3.5">
                          {m.preview?.trim() ||
                            `${m.noLeidos} sin leer${m.ultimoEn ? ` · ${fecha(m.ultimoEn)}` : ""}`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            }
          />
        ) : null}

        {novedades.tareasVencidas ? (
          <div className="rounded-xl border border-mal-borde bg-mal-suave/60 px-2.5 py-2.5">
            <ListaNovedad
              titulo="Tareas vencidas"
              vacio="Ninguna vencida en este periodo."
              verTodoHref="/tareas"
              verTodoLabel="Ver tareas"
              count={nVencidas}
              countTono="mal"
              items={
                novedades.tareasVencidas.length === 0 ? null : (
                  <ul className="grid gap-0.5">
                    {novedades.tareasVencidas.map((t) => {
                      const vence = vencimiento(t.fechaMaxima);
                      return (
                        <li key={t.id}>
                          <Link
                            href={hrefTareaPanel(t)}
                            className="block px-2 py-2 rounded-lg hover:bg-papel/70 transition"
                          >
                            <span className="flex items-center gap-1.5 min-w-0">
                              <span className="size-1.5 rounded-full bg-mal shrink-0" />
                              <b className="text-[13px] block truncate">{t.nombre}</b>
                            </span>
                            <span className="text-[12px] truncate block pl-3.5">
                              <span className="text-mal font-semibold">
                                {vence?.texto ?? t.fechaMaxima}
                              </span>
                              <span className="text-apagado">
                                {" · "}
                                {t.clienteNombre ? `${t.clienteNombre} · ` : ""}
                                {t.proyectoEtiqueta}
                              </span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )
              }
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function PanelResumen({ hoy, proximos, novedades }: PanelResumenProps) {
  return (
    <div
      className="grid gap-4 md:gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]
                 md:h-[calc(100dvh-9.5rem)] md:min-h-0 md:overflow-hidden"
    >
      <div className="grid gap-4 md:gap-5 md:grid-rows-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:min-h-0 md:overflow-hidden">
        {hoy ? <div className="min-h-0 md:overflow-hidden">{hoy}</div> : null}
        {proximos ? <div className="min-h-0 md:overflow-hidden">{proximos}</div> : null}
      </div>
      {novedades ? (
        <div className="min-h-0 md:overflow-hidden">
          <BloqueNovedades novedades={novedades} />
        </div>
      ) : null}
    </div>
  );
}
