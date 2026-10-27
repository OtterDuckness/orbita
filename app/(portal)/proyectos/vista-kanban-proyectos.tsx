"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { type PersonaEquipo, type PrioridadProyecto, type TipoProyecto } from "@/lib/clientes-mock";
import { type ProyectoVista } from "@/lib/tareas-mock";
import { fecha } from "@/lib/formato";
import { IconoPrioridad } from "../clientes/icono-prioridad";
import { NotasLightbox } from "../notas-lightbox";
import { EditarProyectoLightbox } from "./editar-proyecto-lightbox";
import { btnIcono, IconoNotas } from "./iconos-acciones";
import { BotonFavorito } from "./boton-favorito";
import { PuntoNovedad } from "../punto-novedad";

const AGRUPAR_KEY = "orbita.proyectos.kanban.agrupar";

type ModoAgrupar = "urgencia" | "cliente" | "responsable" | "tipo" | "vencimiento";

const MODOS: { id: ModoAgrupar; etiqueta: string }[] = [
  { id: "urgencia", etiqueta: "Urgencia" },
  { id: "cliente", etiqueta: "Cliente" },
  { id: "responsable", etiqueta: "Responsable" },
  { id: "tipo", etiqueta: "Tipo" },
  { id: "vencimiento", etiqueta: "Vencimiento" },
];

const PRIORIDADES: PrioridadProyecto[] = ["urgente", "alta", "media", "baja"];

const VENCIMIENTO_IDS = [
  "vencidos",
  "esta_semana",
  "este_mes",
  "mas_adelante",
  "sin_fecha",
] as const;

type VencimientoId = (typeof VENCIMIENTO_IDS)[number];

type ColumnaKanban = {
  id: string;
  titulo: string;
  icono?: ReactNode;
  items: ProyectoVista[];
};

function etiquetaPrioridad(p: PrioridadProyecto) {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function etiquetaVencimiento(id: VencimientoId) {
  if (id === "vencidos") return "Vencidos";
  if (id === "esta_semana") return "Esta semana";
  if (id === "este_mes") return "Este mes";
  if (id === "mas_adelante") return "Más adelante";
  return "Sin fecha";
}

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setDate(dt.getDate() + days);
  return toYmd(dt);
}

function bucketVencimiento(fin: string | null, hoy: string): VencimientoId {
  if (!fin) return "sin_fecha";
  if (fin < hoy) return "vencidos";
  if (fin <= addDaysYmd(hoy, 6)) return "esta_semana";
  if (fin.startsWith(hoy.slice(0, 7))) return "este_mes";
  return "mas_adelante";
}

function leerModo(): ModoAgrupar {
  if (typeof window === "undefined") return "urgencia";
  try {
    const v = window.localStorage.getItem(AGRUPAR_KEY);
    if (MODOS.some((m) => m.id === v)) return v as ModoAgrupar;
  } catch {
    /* ignore */
  }
  return "urgencia";
}

function ordenPrioridad(a: ProyectoVista, b: ProyectoVista) {
  return PRIORIDADES.indexOf(a.prioridad) - PRIORIDADES.indexOf(b.prioridad);
}

function columnasDinamicas(
  proyectos: ProyectoVista[],
  clave: (p: ProyectoVista) => { id: string; titulo: string },
): ColumnaKanban[] {
  const mapa = new Map<string, ColumnaKanban>();
  for (const p of proyectos) {
    const { id, titulo } = clave(p);
    const col = mapa.get(id);
    if (col) col.items.push(p);
    else mapa.set(id, { id, titulo, items: [p] });
  }
  return [...mapa.values()]
    .map((c) => ({ ...c, items: [...c.items].sort(ordenPrioridad) }))
    .sort((a, b) => a.titulo.localeCompare(b.titulo, "es"));
}

function construirColumnas(modo: ModoAgrupar, proyectos: ProyectoVista[]): ColumnaKanban[] {
  if (modo === "urgencia") {
    return PRIORIDADES.map((prioridad) => ({
      id: prioridad,
      titulo: etiquetaPrioridad(prioridad),
      icono: <IconoPrioridad prioridad={prioridad} />,
      items: proyectos.filter((p) => p.prioridad === prioridad),
    }));
  }

  if (modo === "cliente") {
    return columnasDinamicas(proyectos, (p) => ({
      id: p.clienteId ?? `ambito:${p.ambito}`,
      titulo: p.clienteNombre || (p.ambito === "interno" ? "Interno" : "Sin cliente"),
    }));
  }

  if (modo === "responsable") {
    return columnasDinamicas(proyectos, (p) => ({
      id: p.responsableId ?? "sin",
      titulo: p.responsableNombre ?? "Sin responsable",
    }));
  }

  if (modo === "tipo") {
    return columnasDinamicas(proyectos, (p) => {
      const sinTipo = !p.tipoId || !p.tipo.trim() || p.tipo === "—";
      return {
        id: p.tipoId ?? "sin",
        titulo: sinTipo ? "Sin tipo" : p.tipo,
      };
    });
  }

  // vencimiento
  const hoy = toYmd(new Date());
  const porBucket = new Map<VencimientoId, ProyectoVista[]>();
  for (const id of VENCIMIENTO_IDS) porBucket.set(id, []);
  for (const p of proyectos) {
    const b = bucketVencimiento(p.finContrato, hoy);
    porBucket.get(b)!.push(p);
  }
  return VENCIMIENTO_IDS.map((id) => ({
    id,
    titulo: etiquetaVencimiento(id),
    items: (porBucket.get(id) ?? []).sort(ordenPrioridad),
  }));
}

function TarjetaProyecto({
  p,
  tipos,
  equipo,
  tieneNovedad,
}: {
  p: ProyectoVista;
  tipos: TipoProyecto[];
  equipo: PersonaEquipo[];
  tieneNovedad?: boolean;
}) {
  return (
    <li className="tarjeta bg-papel p-3 flex items-start gap-2 min-w-0">
      <div className="min-w-0 flex-1 grid gap-2">
        <div className="group/fav flex items-center gap-1 min-w-0">
          <BotonFavorito proyectoId={p.id} activo={Boolean(p.esFavorito)} />
          <Link href={`/proyectos/${p.id}`} className="min-w-0 group">
            <b className="font-display text-[14px] group-hover:text-magenta-texto transition inline-flex items-center gap-1.5 min-w-0">
              {tieneNovedad ? <PuntoNovedad /> : null}
              <span className="truncate">{p.titulo}</span>
            </b>
          </Link>
        </div>
        <Link
          href={`/proyectos/${p.id}`}
          className="grid gap-1 text-[12.5px] text-apagado hover:text-tinta transition"
        >
          <span className="font-semibold text-tinta">{p.clienteNombre}</span>
          <span>Fin {fecha(p.finContrato)}</span>
          <span>{p.responsableNombre ?? "Sin responsable"}</span>
        </Link>
      </div>
      <div className="flex flex-col items-stretch gap-1.5 shrink-0">
        <NotasLightbox proyectoId={p.id} titulo={p.titulo} className={btnIcono}>
          <IconoNotas />
        </NotasLightbox>
        <EditarProyectoLightbox
          proyecto={p}
          tipos={tipos}
          equipo={equipo}
          botonesVerticales
          puedeGestionar={p.puedeGestionar ?? false}
        />
      </div>
    </li>
  );
}

export function VistaKanbanProyectos({
  proyectos,
  tipos,
  equipo,
  idsNovedad,
}: {
  proyectos: ProyectoVista[];
  tipos: TipoProyecto[];
  equipo: PersonaEquipo[];
  idsNovedad?: Set<string>;
}) {
  const [modo, setModo] = useState<ModoAgrupar>("urgencia");

  useEffect(() => {
    setModo(leerModo());
  }, []);

  function cambiarModo(next: ModoAgrupar) {
    setModo(next);
    try {
      window.localStorage.setItem(AGRUPAR_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const columnas = useMemo(() => construirColumnas(modo, proyectos), [modo, proyectos]);

  const gridCols =
    columnas.length <= 2
      ? "grid-cols-1 min-[640px]:grid-cols-2"
      : columnas.length === 3
        ? "grid-cols-1 min-[640px]:grid-cols-2 min-[900px]:grid-cols-3"
        : "grid-cols-1 min-[640px]:grid-cols-2 min-[1100px]:grid-cols-4";

  return (
    <div className="grid gap-3">
      <div
        role="group"
        aria-label="Agrupar Kanban"
        className="segmentado flex-wrap shrink-0"
      >
        {MODOS.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={modo === m.id}
            onClick={() => cambiarModo(m.id)}
            className="chip h-[34px] px-2.5 text-[12px]"
          >
            {m.etiqueta}
          </button>
        ))}
      </div>

      {columnas.length === 0 ? (
        <p className="text-[13px] text-apagado">No hay proyectos para agrupar.</p>
      ) : (
        <div className={`grid gap-3 ${gridCols} items-start`}>
          {columnas.map((col) => (
            <section
              key={col.id}
              className="min-w-0 rounded-[10px] border border-linea-fuerte bg-suave/30 p-3 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {col.icono}
                  <h2 className="font-display font-bold text-[15px] tracking-tight truncate">
                    {col.titulo}
                  </h2>
                </div>
                <span className="font-mono text-[11px] text-apagado shrink-0">{col.items.length}</span>
              </div>

              {col.items.length === 0 ? (
                <p className="text-[12px] text-apagado py-2">Sin proyectos</p>
              ) : (
                <ul className="grid gap-2">
                  {col.items.map((p) => (
                    <TarjetaProyecto
                      key={p.id}
                      p={p}
                      tipos={tipos}
                      equipo={equipo}
                      tieneNovedad={idsNovedad?.has(p.id)}
                    />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
