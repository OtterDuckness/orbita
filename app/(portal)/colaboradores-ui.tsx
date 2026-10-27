"use client";

import { useEffect, useMemo, useState } from "react";
import type { PersonaEquipo } from "@/lib/clientes-mock";
import { AvatarUsuario } from "./avatar-usuario";

export function ListaColaboradores({
  ids,
  equipo,
  vacio = "Sin colaboradores",
}: {
  ids: string[];
  equipo: PersonaEquipo[];
  vacio?: string;
}) {
  const personas = ids
    .map((id) => equipo.find((p) => p.id === id) ?? null)
    .filter((p): p is PersonaEquipo => p !== null);

  if (personas.length === 0) {
    return <span className="text-[12px] text-apagado">{vacio}</span>;
  }

  return (
    <ul className="flex flex-wrap gap-1">
      {personas.map((p) => (
        <li
          key={p.id}
          className="inline-flex items-center gap-1 rounded-full border border-linea bg-suave pl-0.5 pr-2 py-0.5 text-[11.5px]"
          title={p.email}
        >
          <AvatarUsuario nombre={p.nombre} avatarUrl={p.avatarUrl} tamano="xs" />
          {p.nombre}
        </li>
      ))}
    </ul>
  );
}

/** Checkboxes para formularios (name repetido → FormData.getAll). */
export function CampoColaboradores({
  name = "colaborador_ids",
  seleccionados = [],
  bloqueados = [],
  candidatos,
}: {
  name?: string;
  seleccionados?: string[];
  /** Ids que van siempre marcados y no se pueden quitar (p. ej. el responsable). */
  bloqueados?: string[];
  candidatos: PersonaEquipo[];
}) {
  const fijos = useMemo(
    () => bloqueados.map((id) => id.trim()).filter(Boolean),
    [bloqueados],
  );
  const fijosKey = fijos.join("|");
  const [elegidos, setElegidos] = useState(() => {
    const s = new Set(seleccionados);
    for (const id of fijos) s.add(id);
    return s;
  });

  useEffect(() => {
    setElegidos((prev) => {
      const next = new Set(prev);
      let cambio = false;
      for (const id of fijos) {
        if (!next.has(id)) {
          next.add(id);
          cambio = true;
        }
      }
      return cambio ? next : prev;
    });
  }, [fijosKey, fijos]);

  if (candidatos.length === 0) {
    return (
      <div className="grid gap-1">
        <span className="etiqueta">Colaboradores</span>
        <p className="text-[12px] text-apagado">No hay candidatos en el equipo.</p>
      </div>
    );
  }

  return (
    <fieldset className="grid gap-1.5 min-w-0">
      <legend className="etiqueta">Colaboradores</legend>
      <div className="grid gap-1 rounded-lg border border-linea-fuerte bg-suave/40 px-2.5 py-2">
        {candidatos.map((p) => {
          const fijo = fijos.includes(p.id);
          const marcado = fijo || elegidos.has(p.id);
          return (
            <label
              key={p.id}
              className={`flex items-center gap-2 text-[12.5px] ${
                fijo ? "cursor-default" : "cursor-pointer"
              }`}
              title={fijo ? "El responsable es siempre colaborador" : undefined}
            >
              {fijo ? <input type="hidden" name={name} value={p.id} /> : null}
              <input
                type="checkbox"
                name={fijo ? undefined : name}
                value={p.id}
                checked={marcado}
                disabled={fijo}
                onChange={(e) => {
                  if (fijo) return;
                  setElegidos((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(p.id);
                    else next.delete(p.id);
                    return next;
                  });
                }}
                className="accent-[var(--magenta)] disabled:opacity-80"
              />
              <span className="min-w-0 truncate flex items-center gap-1.5">
                <AvatarUsuario nombre={p.nombre} avatarUrl={p.avatarUrl} tamano="xs" />
                <span className="truncate">{p.nombre}</span>
              </span>
              <span className="text-[11px] text-apagado truncate">
                {fijo ? "responsable" : p.email}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
