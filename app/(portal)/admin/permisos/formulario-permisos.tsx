"use client";

import Link from "next/link";
import { CATALOGO_PERMISOS, type Permiso } from "@/lib/permisos";
import type { PerfilLista } from "@/lib/perfiles";
import { Boton } from "../../boton";
import {
  asignarPerfilAction,
  crearPerfilAction,
  editarPerfilAction,
  guardarPermisosUsuarioAction,
} from "../../ajustes/acciones-perfiles";

function modulosDelCatalogo() {
  const orden: string[] = [];
  const porModulo = new Map<string, typeof CATALOGO_PERMISOS>();
  for (const item of CATALOGO_PERMISOS) {
    if (!porModulo.has(item.modulo)) {
      porModulo.set(item.modulo, []);
      orden.push(item.modulo);
    }
    porModulo.get(item.modulo)!.push(item);
  }
  return orden.map((modulo) => ({ modulo, items: porModulo.get(modulo)! }));
}

type Props =
  | {
      modo: "crear-perfil";
    }
  | {
      modo: "editar-perfil";
      perfilId: string;
      nombre: string;
      descripcion: string | null;
      permisos: Permiso[];
    }
  | {
      modo: "usuario";
      usuarioId: string;
      nombre: string;
      correo: string;
      esAdmin: boolean;
      perfilId: string | null;
      permisos: Permiso[];
      perfiles: PerfilLista[];
    };

export function FormularioPermisos(props: Props) {
  const seleccion = new Set(
    props.modo === "crear-perfil" ? [] : props.permisos,
  );
  const bloques = modulosDelCatalogo();

  const action =
    props.modo === "crear-perfil"
      ? crearPerfilAction
      : props.modo === "editar-perfil"
        ? editarPerfilAction
        : guardarPermisosUsuarioAction;

  const cancelHref = "/admin/permisos";

  return (
    <div className="grid gap-6 max-w-2xl">
      {props.modo === "usuario" ? (
        <form
          action={asignarPerfilAction}
          className="flex flex-wrap items-end gap-2 rounded-[12px] border border-linea-fuerte p-4 shadow-suave"
        >
          <input type="hidden" name="usuario_id" value={props.usuarioId} />
          <input
            type="hidden"
            name="volver"
            value={`/admin/permisos?usuario=${props.usuarioId}`}
          />
          <label className="grid gap-1 min-w-[200px] flex-1">
            <span className="etiqueta">Cargar desde plantilla</span>
            <select
              name="perfil_id"
              defaultValue={props.perfilId ?? ""}
              className="control rounded-[8px] text-[14px]"
            >
              <option value="">Sin perfil</option>
              {props.perfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
          <Boton type="submit" className="!py-2">
            Aplicar plantilla
          </Boton>
        </form>
      ) : null}

      {props.modo === "usuario" && props.esAdmin ? (
        <p className="text-apagado text-[13px]">
          Como admin tiene bypass total; estos checkboxes aplican si deja de ser admin.
        </p>
      ) : null}

      <form action={action} className="grid gap-5">
        {props.modo === "editar-perfil" ? (
          <input type="hidden" name="perfil_id" value={props.perfilId} />
        ) : null}
        {props.modo === "usuario" ? (
          <input type="hidden" name="usuario_id" value={props.usuarioId} />
        ) : null}

        {props.modo !== "usuario" ? (
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="etiqueta">Nombre del perfil</span>
              <input
                name="nombre"
                required
                defaultValue={props.modo === "editar-perfil" ? props.nombre : ""}
                className="control rounded-[8px] text-[14px]"
                placeholder="Ej. Operaciones"
              />
            </label>
            <label className="grid gap-1">
              <span className="etiqueta">Descripción</span>
              <input
                name="descripcion"
                defaultValue={props.modo === "editar-perfil" ? (props.descripcion ?? "") : ""}
                className="control rounded-[8px] text-[14px]"
                placeholder="Opcional"
              />
            </label>
          </div>
        ) : null}

        <div className="grid gap-4">
          {bloques.map(({ modulo, items }) => (
            <section
              key={modulo}
              className="rounded-[12px] border border-linea-fuerte p-4 grid gap-3 hover:border-magenta-borde transition"
            >
              <h2 className="font-display font-bold text-[16px] tracking-tight">{modulo}</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {items.map((item) => (
                  <label key={item.codigo} className="flex items-center gap-2.5 text-[14px]">
                    <input
                      type="checkbox"
                      name="permiso"
                      value={item.codigo}
                      defaultChecked={seleccion.has(item.codigo)}
                      className="accent-[var(--magenta)] size-4"
                    />
                    <span>
                      {item.accion === "ver"
                        ? "Ver"
                        : item.accion === "editar"
                          ? "Alterar"
                          : item.etiqueta}
                    </span>
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="flex flex-wrap justify-end gap-3 pt-1">
          <Link href={cancelHref} className="text-[13px] text-apagado px-3 py-2 hover:text-tinta">
            Cancelar
          </Link>
          <Boton type="submit">
            {props.modo === "crear-perfil"
              ? "Crear perfil"
              : props.modo === "editar-perfil"
                ? "Guardar perfil"
                : "Guardar accesos"}
          </Boton>
        </div>
      </form>
    </div>
  );
}
