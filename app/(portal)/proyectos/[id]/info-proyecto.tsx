import { inicialesDe } from "@/lib/tareas-mock";
import { COLOR_STATS, type StatsProyecto } from "@/lib/tablero";
import { fecha } from "@/lib/formato";
import { Cabecera } from "../../cabecera";

type Props = {
  clienteNombre: string;
  tituloProyecto: string;
  finContrato: string | null;
  responsableNombre: string | null;
  stats: StatsProyecto;
};

export function InfoProyecto({
  clienteNombre,
  tituloProyecto,
  finContrato,
  responsableNombre,
  stats,
}: Props) {
  const totalEstado = stats.porEstado.reduce((s, e) => s + e.count, 0);

  return (
    <div className="grid gap-6">
      <Cabecera
        etiqueta={clienteNombre}
        titulo={tituloProyecto}
        sello={`${stats.total} ${stats.total === 1 ? "tarea" : "tareas"}`}
      />
      {(responsableNombre || finContrato) && (
        <p className="text-[12.5px] text-apagado -mt-3">
          {responsableNombre ? <>Responsable del proyecto: {responsableNombre}</> : null}
          {responsableNombre && finContrato ? " · " : null}
          {finContrato ? <>fin {fecha(finContrato)}</> : null}
        </p>
      )}

      <section className="grid gap-3">
        <h2 className="text-[15px] font-semibold">Tareas ({stats.total})</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <CardResumen
            etiqueta="Por hacer"
            valor={stats.porHacer}
            fondo={COLOR_STATS.porHacerFondo}
            tinta={COLOR_STATS.porHacerTexto}
          />
          <CardResumen
            etiqueta="Progreso"
            valor={stats.progreso}
            fondo={COLOR_STATS.progreso}
            tinta="#fff"
          />
          <CardResumen
            etiqueta="Finalizado"
            valor={stats.finalizado}
            fondo={COLOR_STATS.finalizado}
            tinta="#fff"
          />
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="text-[15px] font-semibold">Tareas por estado</h2>
        <div className="rounded-xl border border-linea bg-papel p-4 grid gap-4">
          {totalEstado > 0 ? (
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-suave">
              {stats.porEstado
                .filter((e) => e.count > 0)
                .map((e) => (
                  <div
                    key={e.columnaId}
                    title={`${e.nombre}: ${e.count}`}
                    style={{
                      width: `${(e.count / totalEstado) * 100}%`,
                      backgroundColor: e.color,
                    }}
                    className="h-full min-w-[2px]"
                  />
                ))}
            </div>
          ) : (
            <p className="text-[13px] text-apagado">Sin tareas en este proyecto.</p>
          )}
          <ul className="grid gap-2 sm:grid-cols-2">
            {stats.porEstado.map((e) => (
              <li key={e.columnaId} className="flex items-center gap-1.5 text-[13px] min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: e.color }}
                  aria-hidden
                />
                <span className="text-apagado truncate">{e.nombre}</span>
                <span className="font-mono text-[12px] tabular-nums shrink-0">{e.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="text-[15px] font-semibold">Tareas por usuario</h2>
        <div className="rounded-xl border border-linea bg-papel overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3 px-4 py-2.5 border-b border-linea text-[11px] uppercase tracking-wide text-apagado font-mono">
            <span>Usuario</span>
            <span>Distribución</span>
          </div>
          {stats.porUsuario.length === 0 ? (
            <p className="px-4 py-6 text-[13px] text-apagado">Sin tareas para repartir.</p>
          ) : (
            <ul>
              {stats.porUsuario.map((u) => (
                <li
                  key={u.usuarioId ?? "__none__"}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3 items-center px-4 py-3 border-b border-linea last:border-b-0"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-8 h-8 rounded-full grid place-items-center font-mono text-[10px] shrink-0 ${
                        u.usuarioId
                          ? "bg-magenta text-white"
                          : "bg-suave text-apagado border border-linea"
                      }`}
                      title={u.nombre}
                    >
                      {u.usuarioId ? inicialesDe(u.nombre) : "?"}
                    </span>
                    <span className="text-[13.5px] font-medium truncate">{u.nombre}</span>
                  </div>
                  <BarraUsuario
                    porHacer={u.porHacer}
                    progreso={u.progreso}
                    finalizado={u.finalizado}
                    total={u.total}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function CardResumen({
  etiqueta,
  valor,
  fondo,
  tinta,
}: {
  etiqueta: string;
  valor: number;
  fondo: string;
  tinta: string;
}) {
  return (
    <div className="rounded-xl px-5 py-4" style={{ backgroundColor: fondo, color: tinta }}>
      <p className="text-[12px] opacity-90 mb-1">{etiqueta}</p>
      <p className="text-[28px] font-semibold tabular-nums leading-none">{valor}</p>
    </div>
  );
}

function BarraUsuario({
  porHacer,
  progreso,
  finalizado,
  total,
}: {
  porHacer: number;
  progreso: number;
  finalizado: number;
  total: number;
}) {
  if (total === 0) {
    return <span className="text-[12px] text-apagado">0</span>;
  }

  const segmentos = [
    { n: porHacer, color: COLOR_STATS.porHacer, label: "Por hacer" },
    { n: progreso, color: COLOR_STATS.progreso, label: "Progreso" },
    { n: finalizado, color: COLOR_STATS.finalizado, label: "Finalizado" },
  ].filter((s) => s.n > 0);

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex h-5 flex-1 overflow-hidden rounded-md bg-suave min-w-0">
        {segmentos.map((s) => (
          <div
            key={s.label}
            title={`${s.label}: ${s.n}`}
            style={{ width: `${(s.n / total) * 100}%`, backgroundColor: s.color }}
            className="h-full min-w-[4px] grid place-items-center text-[10px] font-mono text-white tabular-nums"
          >
            {s.n >= 2 || segmentos.length === 1 ? s.n : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
