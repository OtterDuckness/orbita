import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAdmin } from "@/lib/authz";
import { textoVisibleEnUi } from "@/lib/asistente/historial";
import {
  listarMensajes,
  obtenerConversacionAdmin,
} from "@/lib/asistente/store";
import { fechaHora } from "@/lib/formato";
import { Cabecera } from "../../../../cabecera";
import { MensajeMd } from "../../../../asistente/mensaje-md";

export const dynamic = "force-dynamic";

export default async function AdminChatIaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirAdmin();
  const { id } = await params;
  const conv = await obtenerConversacionAdmin(id);
  if (!conv) notFound();

  const mensajesRaw = await listarMensajes(conv.id);
  const mensajes = mensajesRaw
    .map((m) => {
      const texto = textoVisibleEnUi(m);
      if (texto == null) return null;
      return { ...m, contenido: texto };
    })
    .filter((m): m is NonNullable<typeof m> => m != null);

  return (
    <>
      <Cabecera
        etiqueta="Admin"
        titulo={conv.titulo || "Chat sin título"}
        texto={`De ${conv.usuarioNombre} (${conv.usuarioCorreo}). Solo lectura.`}
        sello={`${mensajes.length} msgs`}
      />

      <p className="mb-4 flex flex-wrap gap-3 text-[13px]">
        <Link href="/admin/agente-ia/chats" className="text-magenta-texto hover:underline">
          ← Todos los chats
        </Link>
        <Link
          href={`/admin/agente-ia/chats?usuario=${conv.usuarioId}`}
          className="text-apagado hover:text-tinta hover:underline"
        >
          Más de este usuario
        </Link>
        <span className="text-apagado font-mono text-[12px]">
          {fechaHora(conv.creadoEn)} → {fechaHora(conv.actualizadoEn)}
        </span>
      </p>

      <section className="rounded-[10px] border border-linea flex flex-col min-h-[40vh] max-h-[75vh]">
        <div className="flex-1 overflow-auto p-4 grid gap-3 content-start">
          {mensajes.length === 0 ? (
            <p className="text-apagado text-[13.5px]">Esta conversación no tiene mensajes visibles.</p>
          ) : null}
          {mensajes.map((m) => (
            <div key={m.id} className="grid gap-1 min-w-0">
              <p className="text-[11px] text-apagado font-mono">
                {m.rol === "user" ? "Usuario" : "Asistente"} · {fechaHora(m.creadoEn)}
              </p>
              <div
                className={`rounded-[10px] px-3 py-2 text-[14px] ${
                  m.rol === "user"
                    ? "max-w-[85%] justify-self-end bg-magenta text-white whitespace-pre-wrap"
                    : "max-w-[95%] min-w-0 justify-self-start bg-suave border border-linea"
                }`}
              >
                {m.rol === "assistant" ? <MensajeMd texto={m.contenido} /> : m.contenido}
              </div>
            </div>
          ))}
        </div>
        <p className="border-t border-linea px-3 py-2 text-[12px] text-apagado">
          Vista de auditoría — no se puede enviar mensajes desde el panel admin.
        </p>
      </section>
    </>
  );
}
