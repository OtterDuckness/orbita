"use client";

import Link from "next/link";
import type { PerfilLista, UsuarioInternoAsignacion } from "@/lib/perfiles";
import { AvatarUsuario } from "../../avatar-usuario";
import { Boton } from "../../boton";
import { asignarPerfilAction } from "../../ajustes/acciones-perfiles";
import { actualizarAdminAction, eliminarUsuarioAction } from "./acciones";

function fmtFecha(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export function ListaUsuarios({
  usuarios,
  perfiles,
  actorId,
}: {
  usuarios: UsuarioInternoAsignacion[];
  perfiles: PerfilLista[];
  actorId: string;
}) {
  return (
    <section className="grid gap-3">
      <div>
        <h2 className="font-display font-bold text-[18px] tracking-tight">Equipo interno</h2>
        <p className="text-apagado text-[13px] mt-1">
          Asigna un perfil como plantilla o afina los permisos persona a persona. El uso del asistente está en{" "}
          <Link href="/admin/agente-ia" className="text-magenta-texto hover:underline">
            Agente IA
          </Link>
          .
        </p>
      </div>
      <ul className="grid gap-3">
        {usuarios.map((u) => {
          const soyYo = u.id === actorId;
          return (
            <li
              key={u.id}
              className="rounded-[10px] border border-linea-fuerte px-4 py-3 grid gap-3 hover:border-magenta-borde hover:shadow-suave transition"
            >
              <div className="flex flex-wrap items-start gap-3">
                <AvatarUsuario nombre={u.nombre} avatarUrl={u.avatarUrl} tamano="md" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[14px]">
                    {u.nombre}
                    {u.esAdmin ? (
                      <span className="ml-2 etiqueta text-magenta-texto">admin</span>
                    ) : null}
                    {soyYo ? (
                      <span className="ml-2 etiqueta text-apagado">tú</span>
                    ) : null}
                  </p>
                  <p className="text-apagado text-[12px] font-mono">{u.correo}</p>
                  <p className="text-apagado text-[12px] mt-1">
                    Último acceso: {fmtFecha(u.ultimoAccesoEn)}
                  </p>
                </div>
                <form action={actualizarAdminAction} className="flex items-center gap-2">
                  <input type="hidden" name="usuario_id" value={u.id} />
                  <input type="hidden" name="es_admin" value={u.esAdmin ? "0" : "1"} />
                  <Boton
                    type="submit"
                    className="!py-1.5 !px-3 !text-[13px] !bg-transparent !text-tinta border border-linea hover:!bg-suave"
                    textoEnviando="…"
                  >
                    {u.esAdmin ? "Quitar admin" : "Hacer admin"}
                  </Boton>
                </form>
                <form action={eliminarUsuarioAction}>
                  <input type="hidden" name="usuario_id" value={u.id} />
                  <button
                    type="submit"
                    disabled={soyYo}
                    className="text-[13px] text-apagado hover:text-magenta-texto disabled:opacity-40"
                    title={soyYo ? "No puedes eliminarte a ti mismo" : "Eliminar usuario"}
                    onClick={(e) => {
                      if (soyYo) return;
                      if (!confirm(`¿Eliminar a ${u.nombre}? Esta acción no se puede deshacer.`)) {
                        e.preventDefault();
                      }
                    }}
                  >
                    Eliminar
                  </button>
                </form>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <form action={asignarPerfilAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="usuario_id" value={u.id} />
                  <input type="hidden" name="volver" value="/admin/usuarios" />
                  <select
                    name="perfil_id"
                    defaultValue={u.perfilId ?? ""}
                    className="control rounded-[8px] px-2 py-1.5 text-[13px]"
                  >
                    <option value="">Sin perfil</option>
                    {perfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                  <Boton type="submit" className="!py-1.5 !px-3 !text-[13px]">
                    Aplicar plantilla
                  </Boton>
                </form>
                <Link
                  href={`/admin/permisos?usuario=${u.id}`}
                  className="text-[13px] text-magenta-texto hover:underline"
                >
                  Modificar permisos
                </Link>
              </div>
            </li>
          );
        })}
        {usuarios.length === 0 ? (
          <li className="text-apagado text-[13px]">Aún no hay usuarios internos.</li>
        ) : null}
      </ul>
    </section>
  );
}
