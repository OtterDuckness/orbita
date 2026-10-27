"use client";

import { useRouter } from "next/navigation";

export function FiltroChatsAdmin({
  equipo,
  usuarioId,
}: {
  equipo: { id: string; nombre: string; correo: string }[];
  usuarioId: string | null;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <label className="text-[13px] text-apagado" htmlFor="filtro-usuario-chat">
        Usuario
      </label>
      <select
        id="filtro-usuario-chat"
        className="rounded-md border border-linea bg-papel px-2 py-1.5 text-[13px] min-w-[12rem]"
        value={usuarioId ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          router.push(v ? `/admin/agente-ia/chats?usuario=${v}` : "/admin/agente-ia/chats");
        }}
      >
        <option value="">Todos</option>
        {equipo.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nombre} ({m.correo})
          </option>
        ))}
      </select>
      {usuarioId ? (
        <a href="/admin/agente-ia/chats" className="text-[13px] text-apagado hover:text-tinta px-2 py-2">
          Quitar filtro
        </a>
      ) : null}
    </div>
  );
}
