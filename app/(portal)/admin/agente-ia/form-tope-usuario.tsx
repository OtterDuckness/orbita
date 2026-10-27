import { guardarTopeMensualUsuarioAction } from "./acciones";

function fmtUsd(n: number) {
  return `$${n.toFixed(2)}`;
}

export function FormTopeUsuario({
  usuarioId,
  override,
  topeGlobal,
  topeEfectivo,
}: {
  usuarioId: string;
  /** Override del mes; `null` = usa global. `0` = sin tope. */
  override: number | null;
  topeGlobal: number | null;
  topeEfectivo: number | null;
}) {
  const placeholder =
    topeGlobal == null ? "∞" : String(topeGlobal);
  const defaultValue = override != null ? String(override) : "";

  return (
    <form
      action={guardarTopeMensualUsuarioAction}
      className="flex flex-wrap items-center justify-end gap-2 mt-2"
    >
      <input type="hidden" name="usuario_id" value={usuarioId} />
      <label className="text-[12px] text-apagado whitespace-nowrap">
        Tope mes:{" "}
        <span className="text-tinta font-medium">
          {topeEfectivo == null ? "sin límite" : fmtUsd(topeEfectivo)}
        </span>
        {override != null ? (
          <span className="text-apagado"> (manual)</span>
        ) : (
          <span className="text-apagado"> (global)</span>
        )}
      </label>
      <input
        type="number"
        name="tope_usd"
        min={0}
        step="0.01"
        defaultValue={defaultValue}
        placeholder={placeholder}
        title="Vacío = tope global. 0 = sin tope este mes."
        className="w-[5.5rem] rounded-md border border-linea bg-papel px-2 py-1 text-[13px] text-right tabular-nums"
      />
      <button
        type="submit"
        className="rounded-md border border-linea bg-papel px-2.5 py-1 text-[12.5px] font-medium hover:bg-suave"
      >
        Guardar
      </button>
    </form>
  );
}
