import type { PrioridadProyecto } from "@/lib/clientes-mock";

const ESTILO: Record<PrioridadProyecto, { color: string; label: string }> = {
  baja: { color: "#64748b", label: "Baja" },
  media: { color: "#2563eb", label: "Media" },
  alta: { color: "#d97706", label: "Alta" },
  urgente: { color: "var(--mal-boton)", label: "Urgente" },
};

/** Flag / chevron stacked by urgency so color + shape differ. */
export function IconoPrioridad({ prioridad }: { prioridad: PrioridadProyecto }) {
  const { color, label } = ESTILO[prioridad];
  const bars =
    prioridad === "baja" ? 1 : prioridad === "media" ? 2 : prioridad === "alta" ? 3 : 4;

  return (
    <span
      className="inline-flex items-center gap-1.5 shrink-0"
      title={label}
      aria-label={`Prioridad ${label.toLowerCase()}`}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="shrink-0">
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={1 + i * 3.2}
            y={11 - (i + 1) * 2.2}
            width="2.4"
            height={(i + 1) * 2.2}
            rx="0.4"
            fill={i < bars ? color : "var(--linea)"}
          />
        ))}
      </svg>
    </span>
  );
}
