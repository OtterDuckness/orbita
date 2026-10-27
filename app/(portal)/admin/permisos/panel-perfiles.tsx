"use client";

import Link from "next/link";
import type { PerfilLista } from "@/lib/perfiles";
import { eliminarPerfilAction } from "../../ajustes/acciones-perfiles";

export function PanelPerfiles({ perfiles }: { perfiles: PerfilLista[] }) {
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-[18px] tracking-tight">Perfiles</h2>
          <p className="text-apagado text-[13px] mt-1">
            Define qué puede ver y alterar cada tipo de trabajador.
          </p>
        </div>
        <Link href="/admin/permisos?nuevo=1" className="boton">
          Nuevo perfil
        </Link>
      </div>

      <ul className="grid gap-2">
        {perfiles.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center gap-3 rounded-[10px] border border-linea-fuerte bg-papel px-4 py-3 hover:border-magenta-borde hover:shadow-suave transition"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-[15px]">{p.nombre}</p>
              {p.descripcion ? (
                <p className="text-apagado text-[12px] mt-0.5">{p.descripcion}</p>
              ) : null}
              <p className="text-apagado text-[12px] mt-1 font-mono">
                {p.numPermisos} permisos · {p.numUsuarios} usuarios
              </p>
            </div>
            <Link
              href={`/admin/permisos?perfil=${p.id}`}
              className="text-[13px] text-magenta-texto hover:underline"
            >
              Editar
            </Link>
            <form action={eliminarPerfilAction}>
              <input type="hidden" name="perfil_id" value={p.id} />
              <button
                type="submit"
                className="text-[13px] text-apagado hover:text-magenta-texto disabled:opacity-40"
                disabled={p.numUsuarios > 0}
                title={
                  p.numUsuarios > 0
                    ? "Reasigna los usuarios antes de eliminar"
                    : "Eliminar perfil"
                }
              >
                Eliminar
              </button>
            </form>
          </li>
        ))}
        {perfiles.length === 0 ? (
          <li className="text-apagado text-[13px]">Aún no hay perfiles. Crea el primero.</li>
        ) : null}
      </ul>
    </section>
  );
}
