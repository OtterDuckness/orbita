/** Punto amarillo: hay cambios/mensajes sin visualizar. */
export function PuntoNovedad({ className }: { className?: string }) {
  return (
    <span
      className={`inline-block size-2 rounded-full bg-novedad shrink-0 ${className ?? ""}`}
      title="Cambios sin ver"
      aria-label="Cambios sin ver"
    />
  );
}
