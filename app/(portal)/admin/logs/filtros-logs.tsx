"use client";

import type { LogArea } from "@/lib/admin-logs";

type Miembro = { id: string; nombre: string; correo: string };

export function FiltrosLogs({
  equipo,
  actorId,
  area,
}: {
  equipo: Miembro[];
  actorId: string | null;
  area: LogArea | null;
}) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 mb-5">
      <label className="grid gap-1 min-w-[200px] flex-1">
        <span className="etiqueta">Usuario</span>
        <select
          name="actor"
          defaultValue={actorId ?? ""}
          className="control rounded-[8px]"
        >
          <option value="">Todos</option>
          {equipo.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre} ({m.correo})
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 min-w-[160px]">
        <span className="etiqueta">Área</span>
        <select
          name="area"
          defaultValue={area ?? ""}
          className="control rounded-[8px]"
        >
          <option value="">Todas</option>
          <option value="clientes">Clientes</option>
          <option value="proyectos">Proyectos</option>
          <option value="tareas">Tareas</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <button type="submit" className="boton !py-2">
        Filtrar
      </button>
      {actorId || area ? (
        <a href="/admin/logs" className="text-[13px] text-apagado hover:text-tinta px-2 py-2">
          Limpiar
        </a>
      ) : null}
    </form>
  );
}
