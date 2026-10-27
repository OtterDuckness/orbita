import { AVISOS } from "@/lib/avisos";

/** Banner inline legacy. El portal usa toast vía AvisosProvider. */
export function Aviso({ codigo }: { codigo?: string }) {
  if (!codigo) return null;
  const a = AVISOS[codigo];
  if (!a) return null;

  return (
    <div
      role="status"
      className={`mb-5 rounded-[10px] border px-4 py-3 text-[13px] ${
        a.tono === "bien"
          ? "border-bien-borde bg-bien-suave text-bien"
          : "border-mal-borde bg-mal-suave text-mal"
      }`}
    >
      {a.texto}
    </div>
  );
}
