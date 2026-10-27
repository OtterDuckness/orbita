"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  Cliente,
  PersonaEquipo,
  PrioridadProyecto,
  TipoProyecto,
} from "@/lib/clientes-mock";
import { PRIORIDADES_PROYECTO } from "@/lib/clientes-mock";
import { euros, fecha } from "@/lib/formato";
import { ListaColaboradores } from "../colaboradores-ui";
import { AccionesCliente } from "./acciones-cliente";
import { AnadirProyectoLightbox } from "./anadir-proyecto-lightbox";
import { IconoPrioridad } from "./icono-prioridad";

export type ProyectoEnCliente = {
  id: string;
  tipo: string;
  feeMensual: number | null;
  finContrato: string | null;
  responsableNombre: string | null;
  prioridad: PrioridadProyecto;
};

export type ClienteTarjeta = {
  cliente: Cliente;
  proyectos: ProyectoEnCliente[];
  colaboradorIds: string[];
  /** Default al crear proyecto = responsable de la cuenta. */
  responsableSugerido: string;
  /** Nombre del responsable de cliente (cuenta). */
  responsableClienteNombre: string | null;
  /** Dueño de cuenta o responsable/colaborador de algún proyecto. */
  esMio: boolean;
  /** Admin o responsable de cliente: editar/borrar cuenta y añadir proyectos. */
  puedeGestionar: boolean;
};

type Vista = "mis" | "todas";
type ModoMis = "lista" | "tarjetas";
type OrdenTodas = "alfa" | "fin" | "urgencia";
type FiltroPrioridad = "todas" | PrioridadProyecto;

const MIS_VISTA_KEY = "orbita.clientes.mis.vista";

function leerModoMis(): ModoMis {
  if (typeof window === "undefined") return "lista";
  try {
    const v = window.localStorage.getItem(MIS_VISTA_KEY);
    if (v === "lista" || v === "tarjetas") return v;
  } catch {
    /* ignore */
  }
  return "lista";
}

type ColumnaMis =
  | "nombre"
  | "correo"
  | "telefono"
  | "responsable"
  | "proyectos"
  | "fin"
  | "prioridad";

type Direccion = "asc" | "desc";

const PESO_PRIORIDAD: Record<PrioridadProyecto, number> = {
  urgente: 0,
  alta: 1,
  media: 2,
  baja: 3,
};

const COLUMNAS_MIS: {
  id: ColumnaMis;
  etiqueta: string;
  titulo?: string;
  alinear?: "right";
  thClass?: string;
}[] = [
  { id: "nombre", etiqueta: "Cliente", thClass: "w-[16%]" },
  { id: "correo", etiqueta: "Correo", thClass: "w-[14%]" },
  { id: "telefono", etiqueta: "Teléfono", thClass: "w-[11%]" },
  { id: "responsable", etiqueta: "Responsable", thClass: "w-[13%]" },
  { id: "proyectos", etiqueta: "Proyectos", alinear: "right", thClass: "w-[8%]" },
  { id: "fin", etiqueta: "Fecha fin", titulo: "Fecha de fin más cercana", thClass: "w-[10%]" },
  { id: "prioridad", etiqueta: "Prioridad", titulo: "Prioridad más urgente", thClass: "w-[8%]" },
];

function coincide(item: ClienteTarjeta, q: string) {
  const c = item.cliente;
  const haystack = [
    c.nombre,
    c.correoAcceso,
    c.telefono ?? "",
    c.origen === "clientify" ? "clientify" : "manual",
    item.responsableClienteNombre ?? "",
    ...item.proyectos.map((p) => `${p.tipo} ${p.responsableNombre ?? ""}`),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

/** Fecha de fin más cercana (ISO día); null si ninguna. */
function finMasCercano(proyectos: ProyectoEnCliente[]): string | null {
  const fechas = proyectos
    .map((p) => p.finContrato)
    .filter((f): f is string => Boolean(f))
    .sort();
  return fechas[0] ?? null;
}

function urgenciaMejor(proyectos: ProyectoEnCliente[]): number {
  if (proyectos.length === 0) return 99;
  return Math.min(...proyectos.map((p) => PESO_PRIORIDAD[p.prioridad] ?? 99));
}

function prioridadMasUrgente(proyectos: ProyectoEnCliente[]): PrioridadProyecto | null {
  if (proyectos.length === 0) return null;
  let mejor: PrioridadProyecto = proyectos[0]!.prioridad;
  for (const p of proyectos) {
    if (PESO_PRIORIDAD[p.prioridad] < PESO_PRIORIDAD[mejor]) mejor = p.prioridad;
  }
  return mejor;
}

function compararPorFin(a: ClienteTarjeta, b: ClienteTarjeta) {
  const fa = finMasCercano(a.proyectos);
  const fb = finMasCercano(b.proyectos);
  if (fa && fb) return fa.localeCompare(fb);
  if (fa) return -1;
  if (fb) return 1;
  return a.cliente.nombre.localeCompare(b.cliente.nombre, "es");
}

function compararPorUrgencia(a: ClienteTarjeta, b: ClienteTarjeta) {
  const ua = urgenciaMejor(a.proyectos);
  const ub = urgenciaMejor(b.proyectos);
  if (ua !== ub) return ua - ub;
  return compararPorFin(a, b);
}

function valorTexto(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? "").localeCompare(b ?? "", "es", { sensitivity: "base" });
}

function compararMis(a: ClienteTarjeta, b: ClienteTarjeta, col: ColumnaMis): number {
  switch (col) {
    case "nombre":
      return valorTexto(a.cliente.nombre, b.cliente.nombre);
    case "correo":
      return valorTexto(a.cliente.correoAcceso, b.cliente.correoAcceso);
    case "telefono":
      return valorTexto(a.cliente.telefono, b.cliente.telefono);
    case "responsable":
      return valorTexto(a.responsableClienteNombre, b.responsableClienteNombre);
    case "proyectos":
      return a.proyectos.length - b.proyectos.length;
    case "fin": {
      const fa = finMasCercano(a.proyectos);
      const fb = finMasCercano(b.proyectos);
      if (!fa && !fb) return 0;
      if (!fa) return 1;
      if (!fb) return -1;
      return fa.localeCompare(fb);
    }
    case "prioridad":
      return urgenciaMejor(a.proyectos) - urgenciaMejor(b.proyectos);
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
  id: ColumnaMis;
  etiqueta: string;
  titulo?: string;
  activa: boolean;
  direccion: Direccion;
  alinear?: "right";
  thClass?: string;
  onOrdenar: (id: ColumnaMis) => void;
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

function TarjetaGrande({
  cliente: c,
  proyectos,
  colaboradorIds,
  responsableSugerido,
  responsableClienteNombre,
  puedeGestionar,
  tipos,
  equipo,
}: ClienteTarjeta & { tipos: TipoProyecto[]; equipo: PersonaEquipo[] }) {
  return (
    <article className="tarjeta bg-papel p-4 flex flex-col min-w-0 h-full">
      <div className="flex items-start gap-2 flex-wrap mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <b className="font-display text-[19px] font-bold tracking-tight">{c.nombre}</b>
            <span className="etiqueta">{c.origen === "clientify" ? "Clientify" : "Manual"}</span>
          </div>
          <span className="text-[15px] text-tinta font-medium truncate block mt-1">{c.correoAcceso}</span>
          {c.telefono ? (
            <span className="text-[15px] text-tinta font-medium truncate block">{c.telefono}</span>
          ) : null}
          <span className="text-[12.5px] text-apagado block mt-1">
            {responsableClienteNombre ? (
              <>
                resp. cliente{" "}
                <b className="text-tinta font-semibold">{responsableClienteNombre}</b>
              </>
            ) : (
              "sin responsable de cliente"
            )}
          </span>
        </div>
        <AccionesCliente cliente={c} equipo={equipo} puedeGestionar={puedeGestionar} />
      </div>

      <div className="mb-3 min-w-0">
        <span className="etiqueta block mb-1.5">Colaboradores</span>
        <ListaColaboradores ids={colaboradorIds} equipo={equipo} vacio="Ninguno en sus proyectos" />
      </div>

      <div className="mb-4 flex-1 min-w-0">
        <span className="etiqueta block mb-2">Proyectos</span>
        {proyectos.length === 0 ? (
          <p className="text-[13px] text-apagado">Sin proyectos todavía.</p>
        ) : (
          <ul className="divide-y divide-linea border border-linea-fuerte rounded-lg overflow-hidden">
            {proyectos.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/proyectos/${p.id}`}
                  className="px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] bg-suave/40 hover:bg-fila-hover hover:border-l-2 hover:border-l-magenta transition"
                >
                  <b>{p.tipo}</b>
                  <span className="text-apagado">{euros(p.feeMensual)}</span>
                  <span className="text-apagado">fin {fecha(p.finContrato)}</span>
                  <span className="text-apagado">
                    {p.responsableNombre ? (
                      <>
                        resp. <b className="text-tinta font-semibold">{p.responsableNombre}</b>
                      </>
                    ) : (
                      "sin responsable"
                    )}
                  </span>
                  <IconoPrioridad prioridad={p.prioridad} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-auto pt-1">
        <AnadirProyectoLightbox
          clienteId={c.id}
          responsableSugerido={responsableSugerido}
          tipos={tipos}
          equipo={equipo}
          puedeGestionar={puedeGestionar}
        />
      </div>
    </article>
  );
}

function VistaListaMisOportunidades({
  items,
  tipos,
  equipo,
}: {
  items: ClienteTarjeta[];
  tipos: TipoProyecto[];
  equipo: PersonaEquipo[];
}) {
  const [columna, setColumna] = useState<ColumnaMis | null>("fin");
  const [direccion, setDireccion] = useState<Direccion>("asc");
  const [abiertoId, setAbiertoId] = useState<string | null>(null);

  function ordenarPor(id: ColumnaMis) {
    if (columna === id) {
      setDireccion((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setColumna(id);
      setDireccion("asc");
    }
  }

  const ordenados = useMemo(() => {
    if (!columna) return items;
    const signo = direccion === "asc" ? 1 : -1;
    return [...items].sort((a, b) => signo * compararMis(a, b, columna));
  }, [items, columna, direccion]);

  const colSpan = COLUMNAS_MIS.length + 1;

  return (
    <div className="overflow-x-auto border border-linea-fuerte rounded-[10px] shadow-suave">
      <table className="tabla w-full table-fixed text-[13px] [&_th]:px-1.5 [&_td]:px-1.5 [&_th]:py-2 [&_td]:py-2">
        <thead className="bg-suave">
          <tr>
            {COLUMNAS_MIS.map((c) => (
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
            <th className="w-[16%] !normal-case !tracking-normal">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {ordenados.map((item) => {
            const c = item.cliente;
            const fin = finMasCercano(item.proyectos);
            const prio = prioridadMasUrgente(item.proyectos);
            const abierto = abiertoId === c.id;
            return (
              <Fragment key={c.id}>
                <tr>
                  <td className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setAbiertoId((id) => (id === c.id ? null : c.id))}
                      aria-expanded={abierto}
                      className="flex items-center gap-1.5 min-w-0 w-full text-left hover:text-magenta-texto transition"
                      title={abierto ? "Ocultar proyectos" : "Ver proyectos"}
                    >
                      <span
                        className={`font-mono text-[10px] text-apagado shrink-0 transition ${
                          abierto ? "rotate-90" : ""
                        }`}
                        aria-hidden="true"
                      >
                        ▸
                      </span>
                      <b className="font-semibold truncate" title={c.nombre}>
                        {c.nombre}
                      </b>
                      <span className="etiqueta shrink-0">
                        {c.origen === "clientify" ? "Clientify" : "Manual"}
                      </span>
                    </button>
                  </td>
                  <td className="min-w-0">
                    <span className="truncate block" title={c.correoAcceso || undefined}>
                      {c.correoAcceso || "—"}
                    </span>
                  </td>
                  <td className="font-mono text-[12px] whitespace-nowrap">
                    {c.telefono || "—"}
                  </td>
                  <td className="min-w-0">
                    <span
                      className="truncate block"
                      title={item.responsableClienteNombre ?? undefined}
                    >
                      {item.responsableClienteNombre ?? "—"}
                    </span>
                  </td>
                  <td className="text-right font-mono text-[12px]">{item.proyectos.length}</td>
                  <td className="font-mono text-[12px] text-apagado whitespace-nowrap">
                    {fecha(fin)}
                  </td>
                  <td>{prio ? <IconoPrioridad prioridad={prio} /> : "—"}</td>
                  <td>
                    <div className="flex flex-nowrap gap-1 items-center">
                      <AccionesCliente
                        cliente={c}
                        equipo={equipo}
                        puedeGestionar={item.puedeGestionar}
                      />
                      <AnadirProyectoLightbox
                        clienteId={c.id}
                        responsableSugerido={item.responsableSugerido}
                        tipos={tipos}
                        equipo={equipo}
                        compacto
                        puedeGestionar={item.puedeGestionar}
                      />
                    </div>
                  </td>
                </tr>
                {abierto ? (
                  <tr className="bg-suave/40">
                    <td colSpan={colSpan} className="!py-2.5">
                      {item.proyectos.length === 0 ? (
                        <p className="text-[12.5px] text-apagado px-1">Sin proyectos todavía.</p>
                      ) : (
                        <ul className="divide-y divide-linea border border-linea rounded-lg overflow-hidden mx-0.5">
                          {item.proyectos.map((p) => (
                            <li key={p.id}>
                              <Link
                                href={`/proyectos/${p.id}`}
                                className="px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] bg-papel hover:bg-fila-hover transition"
                              >
                                <b>{p.tipo}</b>
                                <span className="text-apagado">{euros(p.feeMensual)}</span>
                                <span className="text-apagado">fin {fecha(p.finContrato)}</span>
                                <span className="text-apagado">
                                  {p.responsableNombre ? (
                                    <>
                                      resp.{" "}
                                      <b className="text-tinta font-semibold">{p.responsableNombre}</b>
                                    </>
                                  ) : (
                                    "sin responsable"
                                  )}
                                </span>
                                <IconoPrioridad prioridad={p.prioridad} />
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TablaTodas({
  items,
  tipos,
  equipo,
}: {
  items: ClienteTarjeta[];
  tipos: TipoProyecto[];
  equipo: PersonaEquipo[];
}) {
  return (
    <div className="border border-linea-fuerte rounded-[10px] overflow-x-auto bg-papel shadow-suave">
      <table className="tabla min-w-[760px]">
        <thead className="bg-suave/50">
          <tr>
            <th>Nombre</th>
            <th>Correo</th>
            <th>Teléfono</th>
            <th>Responsable de cliente</th>
            <th className="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const c = item.cliente;
            const resp = item.responsableClienteNombre;
            return (
              <tr key={c.id}>
                <td>
                  <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                    <b className="font-display text-[15px] font-bold">{c.nombre}</b>
                    <span className="etiqueta">
                      {c.origen === "clientify" ? "Clientify" : "Manual"}
                    </span>
                  </div>
                </td>
                <td className="text-tinta font-medium truncate max-w-[220px]">
                  {c.correoAcceso || "—"}
                </td>
                <td className="text-tinta font-medium whitespace-nowrap">
                  {c.telefono || "—"}
                </td>
                <td>
                  {resp ? (
                    <b className="font-semibold text-tinta">{resp}</b>
                  ) : (
                    <span className="text-apagado">sin responsable</span>
                  )}
                </td>
                <td>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <AccionesCliente
                      cliente={c}
                      equipo={equipo}
                      puedeGestionar={item.puedeGestionar}
                    />
                    <AnadirProyectoLightbox
                      clienteId={c.id}
                      responsableSugerido={item.responsableSugerido}
                      tipos={tipos}
                      equipo={equipo}
                      compacto
                      puedeGestionar={item.puedeGestionar}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const selectCls = "control h-[38px] min-w-[9rem]";
const btnOrden = "chip text-[12px] px-2.5 py-1 border border-linea";
const btnOrdenActivo = "activo border-magenta-borde";

export function ListaClientes({
  items,
  tipos,
  equipo,
}: {
  items: ClienteTarjeta[];
  tipos: TipoProyecto[];
  equipo: PersonaEquipo[];
}) {
  const [vista, setVista] = useState<Vista>("mis");
  const [modoMis, setModoMis] = useState<ModoMis>("lista");
  const [consulta, setConsulta] = useState("");
  const [filtroPrioridad, setFiltroPrioridad] = useState<FiltroPrioridad>("todas");
  const [ordenTodas, setOrdenTodas] = useState<OrdenTodas>("alfa");
  const q = consulta.trim().toLowerCase();

  useEffect(() => {
    setModoMis(leerModoMis());
  }, []);

  function cambiarModoMis(next: ModoMis) {
    setModoMis(next);
    try {
      window.localStorage.setItem(MIS_VISTA_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const filtrados = useMemo(
    () => (q ? items.filter((item) => coincide(item, q)) : items),
    [items, q],
  );

  const mios = useMemo(() => {
    let lista = filtrados.filter((i) => i.esMio);
    if (filtroPrioridad !== "todas") {
      lista = lista
        .map((item) => ({
          ...item,
          proyectos: item.proyectos.filter((p) => p.prioridad === filtroPrioridad),
        }))
        .filter((item) => item.proyectos.length > 0);
    }
    return lista;
  }, [filtrados, filtroPrioridad]);

  const miosTarjetas = useMemo(() => [...mios].sort(compararPorFin), [mios]);

  const todas = useMemo(() => {
    const copia = [...filtrados];
    if (ordenTodas === "fin") copia.sort(compararPorFin);
    else if (ordenTodas === "urgencia") copia.sort(compararPorUrgencia);
    else copia.sort((a, b) => a.cliente.nombre.localeCompare(b.cliente.nombre, "es"));
    return copia;
  }, [filtrados, ordenTodas]);

  const vacioBusqueda = filtrados.length === 0;

  return (
    <div className="grid gap-4">
      <div
        role="group"
        aria-label="Ámbito de clientes"
        className="segmentado w-fit"
      >
        <button
          type="button"
          className="chip h-[34px] px-2.5 text-[12px]"
          onClick={() => setVista("mis")}
          aria-pressed={vista === "mis"}
        >
          Mis oportunidades
        </button>
        <button
          type="button"
          className="chip h-[34px] px-2.5 text-[12px]"
          onClick={() => setVista("todas")}
          aria-pressed={vista === "todas"}
        >
          Todas las oportunidades
        </button>
      </div>

      {vista === "mis" ? (
        <div className="flex flex-wrap gap-3 items-end justify-between">
          <div className="flex flex-wrap gap-3 items-end flex-1 min-w-0">
            <label className="grid gap-1.5 min-w-[12rem] flex-1 max-w-md">
              <span className="etiqueta">Buscar</span>
              <input
                type="search"
                value={consulta}
                onChange={(e) => setConsulta(e.target.value)}
                placeholder="Nombre, correo, teléfono, proyecto…"
                className="control h-[38px]"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="etiqueta">Urgencia</span>
              <select
                value={filtroPrioridad}
                onChange={(e) => setFiltroPrioridad(e.target.value as FiltroPrioridad)}
                className={selectCls}
              >
                <option value="todas">Todas</option>
                {PRIORIDADES_PROYECTO.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div
            role="group"
            aria-label="Modo de vista"
            className="segmentado shrink-0 self-end"
          >
            {(
              [
                ["lista", "Lista"],
                ["tarjetas", "Tarjetas"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={modoMis === id}
                onClick={() => cambiarModoMis(id)}
                className="chip h-[34px] px-2.5 text-[12px]"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 items-end justify-between">
          <div className="flex flex-wrap gap-3 items-end flex-1 min-w-0">
            <label className="grid gap-1.5 min-w-[12rem] flex-1 max-w-md">
              <span className="etiqueta">Buscar</span>
              <input
                type="search"
                value={consulta}
                onChange={(e) => setConsulta(e.target.value)}
                placeholder="Nombre, correo, teléfono, proyecto…"
                className="control h-[38px]"
              />
            </label>

            <div className="flex flex-wrap items-end gap-2">
              <span className="etiqueta pb-2.5">Ordenar</span>
              {(
                [
                  ["alfa", "Alfabético"],
                  ["fin", "Fecha fin"],
                  ["urgencia", "Urgencia"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`${btnOrden} ${ordenTodas === id ? btnOrdenActivo : ""}`}
                  onClick={() => setOrdenTodas(id)}
                  aria-pressed={ordenTodas === id}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {vacioBusqueda ? (
        <p className="text-[13px] text-apagado">
          {q
            ? `Ninguna cuenta coincide con «${consulta.trim()}».`
            : "Todavía no hay cuentas."}
        </p>
      ) : vista === "mis" ? (
        mios.length > 0 ? (
          modoMis === "lista" ? (
            <VistaListaMisOportunidades items={mios} tipos={tipos} equipo={equipo} />
          ) : (
            <div className="grid gap-3 grid-cols-1 min-[720px]:grid-cols-2">
              {miosTarjetas.map((item) => (
                <TarjetaGrande key={item.cliente.id} {...item} tipos={tipos} equipo={equipo} />
              ))}
            </div>
          )
        ) : (
          <p className="text-[13px] text-apagado">
            {filtroPrioridad !== "todas"
              ? `Ninguna de tus oportunidades con prioridad «${filtroPrioridad}»${q ? " y ese filtro" : ""}.`
              : `No colaboras en ninguna cuenta${q ? " con ese filtro" : ""}.`}
          </p>
        )
      ) : todas.length > 0 ? (
        <TablaTodas items={todas} tipos={tipos} equipo={equipo} />
      ) : (
        <p className="text-[13px] text-apagado">
          No hay cuentas{q ? " con ese filtro" : ""}.
        </p>
      )}
    </div>
  );
}
