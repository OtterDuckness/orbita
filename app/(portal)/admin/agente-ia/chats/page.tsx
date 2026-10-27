import Link from "next/link";
import { exigirAdmin } from "@/lib/authz";
import { listarEstadisticasChatsAdmin } from "@/lib/asistente/store";
import { fechaHora } from "@/lib/formato";
import { listarEquipo } from "@/lib/usuarios";
import { Cabecera } from "../../../cabecera";
import { FiltroChatsAdmin } from "./filtro-chats";

export const dynamic = "force-dynamic";

function fmtUsd(n: number) {
  return `$${n.toFixed(4)}`;
}

export default async function AdminChatsIaPage({
  searchParams,
}: {
  searchParams: Promise<{ usuario?: string }>;
}) {
  await exigirAdmin();
  const sp = await searchParams;
  const usuarioId = sp.usuario?.trim() || null;

  const [chats, equipo] = await Promise.all([
    listarEstadisticasChatsAdmin({ usuarioId }),
    listarEquipo(),
  ]);

  return (
    <>
      <Cabecera
        etiqueta="Admin"
        titulo="Chats del Agente IA"
        texto="Lectura de todas las conversaciones. Solo administradores. No se puede escribir desde aquí."
        sello={`${chats.length} ${chats.length === 1 ? "chat" : "chats"}`}
      />

      <p className="mb-4 text-[13px]">
        <Link href="/admin/agente-ia" className="text-magenta-texto hover:underline">
          ← Consumo / Agente IA
        </Link>
      </p>

      <FiltroChatsAdmin
        equipo={equipo.map((m) => ({ id: m.id, nombre: m.nombre, correo: m.email }))}
        usuarioId={usuarioId}
      />

      <div className="overflow-x-auto border border-linea-fuerte rounded-[10px] shadow-suave">
        <table className="tabla">
          <thead className="bg-suave">
            <tr>
              <th>Actualizado</th>
              <th>Chat</th>
              <th>Usuario</th>
              <th className="text-right">Msgs</th>
              <th className="text-right">Coste</th>
            </tr>
          </thead>
          <tbody>
            {chats.map((c) => (
              <tr key={c.id}>
                <td className="font-mono text-[12px] text-apagado whitespace-nowrap">
                  {fechaHora(c.actualizadoEn)}
                </td>
                <td>
                  <Link
                    href={`/admin/agente-ia/chats/${c.id}`}
                    className="text-magenta-texto hover:underline font-medium text-[13.5px]"
                  >
                    {c.titulo || "Sin título"}
                  </Link>
                </td>
                <td className="min-w-0">
                  <p className="text-[13px] truncate">{c.usuarioNombre}</p>
                  <p className="text-[11px] text-apagado font-mono truncate">{c.usuarioCorreo}</p>
                </td>
                <td className="text-right text-[13px]">{c.mensajes}</td>
                <td className="text-right text-[13px] font-semibold text-magenta-texto">
                  {fmtUsd(c.costeUsd)}
                </td>
              </tr>
            ))}
            {chats.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-apagado text-center">
                  No hay conversaciones{usuarioId ? " de este usuario" : ""}.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
