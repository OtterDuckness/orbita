import { gastosUsuario } from "@/lib/asistente/store";
import { obtenerTopeOverride, topeMensualEfectivo } from "@/lib/asistente/tope";

function fmtUsd(n: number) {
  return `$${n.toFixed(4)}`;
}

export async function BloqueGastosIa({ usuarioId }: { usuarioId: string }) {
  const [g, tope, override] = await Promise.all([
    gastosUsuario(usuarioId),
    topeMensualEfectivo(usuarioId),
    obtenerTopeOverride(usuarioId),
  ]);

  return (
    <div className="rounded-[10px] border border-linea p-4 grid sm:grid-cols-2 gap-4">
      <div>
        <p className="etiqueta text-apagado mb-1">Este mes (UTC)</p>
        <p className="font-display font-bold text-[20px]">{fmtUsd(g.mes.coste)}</p>
        <p className="text-[12px] text-apagado mt-1">
          {g.mes.input.toLocaleString("es-ES")} tokens in ·{" "}
          {g.mes.output.toLocaleString("es-ES")} out
        </p>
        {tope != null ? (
          <p className="text-[12px] text-apagado mt-2">
            Tope: {fmtUsd(tope)}
            {override != null ? " (ajustado)" : ""}
            {g.mes.coste >= tope ? " · alcanzado" : ""}
          </p>
        ) : (
          <p className="text-[12px] text-apagado mt-2">
            Tope mensual: desactivado
            {override != null ? " (ajustado)" : ""}
          </p>
        )}
      </div>
      <div>
        <p className="etiqueta text-apagado mb-1">Total</p>
        <p className="font-display font-bold text-[20px]">{fmtUsd(g.total.coste)}</p>
        <p className="text-[12px] text-apagado mt-1">
          {g.total.input.toLocaleString("es-ES")} tokens in ·{" "}
          {g.total.output.toLocaleString("es-ES")} out
        </p>
      </div>
    </div>
  );
}
