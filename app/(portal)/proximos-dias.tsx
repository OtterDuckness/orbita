import Link from "next/link";
import { hrefTareaPanel, horaCorta, toYmd, type ItemAgenda, type ReunionAgenda, type TareaAgenda } from "@/lib/agenda";
import { festivoMadrid } from "@/lib/festivos";
import { ZONA } from "@/lib/formato";

export type ProximosDia = {
  ymd: string;
  items: ItemAgenda[];
};

function etiquetaColumna(ymd: string): { weekday: string; dia: string } {
  // Mediodía UTC: el YMD civil en Madrid coincide con el string.
  const dt = new Date(`${ymd}T12:00:00.000Z`);
  return {
    weekday: new Intl.DateTimeFormat("es-ES", { timeZone: ZONA, weekday: "short" }).format(dt),
    dia: new Intl.DateTimeFormat("es-ES", { timeZone: ZONA, day: "numeric" }).format(dt),
  };
}

/** Hueco de fin de semana (o más) entre dos columnas laborables. */
function nuevaSemana(prevYmd: string | undefined, ymd: string): boolean {
  if (!prevYmd) return false;
  const prev = Date.parse(`${prevYmd}T12:00:00.000Z`);
  const cur = Date.parse(`${ymd}T12:00:00.000Z`);
  if (Number.isNaN(prev) || Number.isNaN(cur)) return false;
  return (cur - prev) / 86_400_000 > 1;
}

function FilaReunion({ r }: { r: ReunionAgenda }) {
  const hora = r.todoElDia ? "Todo el día" : horaCorta(r.inicio);
  const href = r.enlaceReunion || r.htmlLink;
  return (
    <li className="grid gap-0 text-[12px] px-1 py-1 hover:bg-fila-hover transition">
      <span className="font-mono text-apagado text-[10.5px] tabular-nums leading-none">
        {hora ?? "—"}
      </span>
      <span className="font-medium leading-tight line-clamp-2">{r.titulo}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-magenta-texto hover:underline truncate leading-tight"
        >
          {r.enlaceReunion ? "Unirse" : "Abrir"}
        </a>
      ) : null}
    </li>
  );
}

function FilaTarea({ t }: { t: TareaAgenda }) {
  return (
    <li className="grid gap-0 text-[12px] px-1 py-1 hover:bg-fila-hover transition">
      <span className="etiqueta text-[9.5px] w-fit leading-none">Tarea</span>
      <Link
        href={hrefTareaPanel(t)}
        className="min-w-0 hover:text-magenta-texto transition"
      >
        <span className="font-medium block leading-tight line-clamp-2">{t.nombre}</span>
        <span className="text-apagado text-[10.5px] block truncate leading-tight">
          {t.proyectoEtiqueta}
        </span>
      </Link>
    </li>
  );
}

export function ProximosDias({
  dias,
  googleEstado,
}: {
  dias: ProximosDia[];
  googleEstado: "ok" | "sin_tokens" | "error" | "omitido";
}) {
  const hoyYmd = toYmd(new Date());

  return (
    <section className="tarjeta p-3.5 flex flex-col min-h-0 h-full">
      <div className="flex items-baseline justify-between gap-2 flex-wrap shrink-0 pb-2.5 mb-3 border-b border-linea">
        <p className="etiqueta text-magenta-texto">Agenda</p>
        <Link
          href="/calendario"
          className="text-[12.5px] text-magenta-texto hover:underline shrink-0"
        >
          Ver calendario
        </Link>
      </div>

      {googleEstado === "sin_tokens" ? (
        <p className="text-[12.5px] text-apagado mb-2 shrink-0">
          Conecta Google para ver las reuniones de la semana.
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-1.5 h-full min-w-0">
          {dias.map((dia, i) => {
            const { weekday, dia: num } = etiquetaColumna(dia.ymd);
            const esHoy = dia.ymd === hoyYmd;
            const nombreFestivo = festivoMadrid(dia.ymd);
            const esFestivo = Boolean(nombreFestivo);
            const saltoSemana = nuevaSemana(dias[i - 1]?.ymd, dia.ymd);
            return (
              <div key={dia.ymd} className="contents">
              {saltoSemana ? (
                <div
                  aria-hidden
                  title="Fin de semana"
                  className="w-6 md:w-8 shrink-0 self-stretch flex items-stretch justify-center py-1"
                >
                  <span className="w-px h-full rounded-full bg-linea-fuerte" />
                </div>
              ) : null}
              <div
                title={nombreFestivo ?? undefined}
                className={[
                  "w-[5.75rem] shrink-0 md:w-auto md:min-w-0 md:flex-1 flex flex-col min-h-0 overflow-hidden rounded-lg p-1",
                  esHoy
                    ? "bg-magenta-suave/60 ring-1 ring-inset ring-magenta-texto/25"
                    : esFestivo
                      ? "bg-magenta-suave"
                      : "bg-transparent",
                ].join(" ")}
              >
                <h3
                  className={[
                    "shrink-0 text-center leading-tight py-1 mb-0.5",
                    esHoy || esFestivo ? "text-magenta-texto" : "text-apagado",
                  ].join(" ")}
                >
                  <span className="etiqueta block capitalize">{weekday}</span>
                  <span
                    className={[
                      "font-display font-bold text-[15px] tabular-nums",
                      esHoy || esFestivo ? "text-magenta-texto" : "text-ink",
                    ].join(" ")}
                  >
                    {num}
                  </span>
                  {esFestivo ? (
                    <span className="block text-[9px] font-medium text-magenta-texto mt-0.5 leading-none">
                      Festivo
                    </span>
                  ) : null}
                </h3>
                <ul className="divide-y divide-linea content-start min-h-0 overflow-y-auto">
                  {dia.items.length === 0 ? (
                    <li className="text-[11px] text-apagado/70 text-center py-1">—</li>
                  ) : (
                    dia.items.map((it) =>
                      it.tipo === "reunion" ? (
                        <FilaReunion key={`r-${it.id}`} r={it} />
                      ) : (
                        <FilaTarea key={`t-${it.id}`} t={it} />
                      ),
                    )
                  )}
                </ul>
              </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
