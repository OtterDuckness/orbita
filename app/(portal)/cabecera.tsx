import type { ReactNode } from "react";

export function Cabecera({
  etiqueta,
  titulo,
  texto,
  sello,
  acciones,
}: {
  etiqueta: string;
  titulo: string;
  texto?: string;
  sello?: string;
  acciones?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
      <div>
        <p className="etiqueta text-magenta-texto mb-1">{etiqueta}</p>
        <h1 className="font-display font-bold text-[26px] tracking-tight">{titulo}</h1>
        {texto ? <p className="text-apagado text-[13.5px] mt-1 max-w-[62ch]">{texto}</p> : null}
      </div>
      {(acciones || sello) ? (
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {sello ? <div className="font-mono text-[11px] text-apagado">{sello}</div> : null}
          {acciones}
        </div>
      ) : null}
    </div>
  );
}
