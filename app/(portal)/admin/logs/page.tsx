import Link from "next/link";
import { exigirAdmin } from "@/lib/authz";
import {
  areaDeAccion,
  etiquetaAccion,
  etiquetaArea,
  listarAdminLogs,
  type LogArea,
} from "@/lib/admin-logs";
import { fechaHora } from "@/lib/formato";
import { listarEquipo } from "@/lib/usuarios";
import { Cabecera } from "../../cabecera";
import { FiltrosLogs } from "./filtros-logs";

export const dynamic = "force-dynamic";

function esArea(v: string | undefined): v is LogArea {
  return v === "admin" || v === "clientes" || v === "proyectos" || v === "tareas";
}

function conversacionIdDeMeta(meta: unknown): string | null {
  let obj: unknown = meta;
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const raw = (obj as Record<string, unknown>).conversacionId;
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  return id || null;
}

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; area?: string }>;
}) {
  await exigirAdmin();
  const sp = await searchParams;
  const actorId = sp.actor?.trim() || null;
  const area = esArea(sp.area) ? sp.area : null;

  const [logs, equipo] = await Promise.all([
    listarAdminLogs({ limit: 250, actorId, area }),
    listarEquipo(),
  ]);

  return (
    <>
      <Cabecera
        etiqueta="Admin"
        titulo="Logs"
        texto="Auditoría de clientes, proyectos, tareas y panel admin. Los eventos del agente enlazan al chat."
        sello={`${logs.length} ${logs.length === 1 ? "evento" : "eventos"}`}
      />

      <FiltrosLogs
        equipo={equipo.map((m) => ({ id: m.id, nombre: m.nombre, correo: m.email }))}
        actorId={actorId}
        area={area}
      />

      <div className="overflow-x-auto border border-linea-fuerte rounded-[10px] shadow-suave">
        <table className="tabla">
          <thead className="bg-suave">
            <tr>
              <th>Fecha</th>
              <th>Actor</th>
              <th>Área</th>
              <th>Acción</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => {
              const areaLog = areaDeAccion(l.accion);
              const chatId = conversacionIdDeMeta(l.metaJson);
              const filaHref = chatId ? `/admin/agente-ia/chats/${chatId}` : null;
              return (
                <tr key={l.id} className={filaHref ? "hover:bg-suave/60" : undefined}>
                  <td className="font-mono text-[12px] text-apagado whitespace-nowrap">
                    {filaHref ? (
                      <Link href={filaHref} className="hover:text-magenta-texto hover:underline">
                        {fechaHora(l.creadoEn)}
                      </Link>
                    ) : (
                      fechaHora(l.creadoEn)
                    )}
                  </td>
                  <td>
                    {l.actorId ? (
                      <Link
                        href={`/admin/logs?actor=${l.actorId}`}
                        className="font-mono text-[12px] text-magenta-texto hover:underline"
                      >
                        {l.actorCorreo}
                      </Link>
                    ) : (
                      <span className="font-mono text-[12px]">{l.actorCorreo}</span>
                    )}
                  </td>
                  <td className="text-apagado">{etiquetaArea(areaLog)}</td>
                  <td>
                    {filaHref ? (
                      <Link href={filaHref} className="text-magenta-texto hover:underline">
                        {etiquetaAccion(l.accion)}
                      </Link>
                    ) : (
                      etiquetaAccion(l.accion)
                    )}
                  </td>
                  <td className="text-apagado">
                    {filaHref ? (
                      <Link href={filaHref} className="hover:text-magenta-texto hover:underline">
                        {l.detalle ?? "—"}
                      </Link>
                    ) : (
                      (l.detalle ?? "—")
                    )}
                  </td>
                </tr>
              );
            })}
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-apagado text-center">
                  Aún no hay eventos
                  {actorId || area ? " con estos filtros" : " registrados"}.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
