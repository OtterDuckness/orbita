"use server";

import { redirect } from "next/navigation";
import { exigirPermiso, exigirSesionUsuario } from "@/lib/authz";
import { clientePorId } from "@/lib/clientes";
import {
  actualizarNota,
  borrarNota,
  crearNotaCliente,
  crearNotaProyecto,
  listarNotasCliente,
  listarNotasProyecto,
  type Nota,
} from "@/lib/notas";
import { puedeVerProyecto } from "@/lib/permisos-entidad";
import { proyectosDe } from "@/lib/proyectos";
import { mapaNombresTipo } from "@/lib/tipos-proyecto";
import type { UsuarioAuth } from "@/lib/usuarios";
import { usuarioPuede } from "@/lib/usuarios";

export type NotaVista = {
  id: string;
  texto: string;
  autorId: string;
  autorNombre: string;
  autorAvatarUrl: string | null;
  creadoEn: string;
  actualizadoEn: string;
  proyectoId: string | null;
  clienteId: string | null;
};

export type ProyectoNotaRef = {
  id: string;
  titulo: string;
};

function mapearVista(n: Nota): NotaVista {
  return {
    id: n.id,
    texto: n.texto,
    autorId: n.autorId,
    autorNombre: n.autorNombre,
    autorAvatarUrl: n.autorAvatarUrl,
    creadoEn: n.creadoEn.toISOString(),
    actualizadoEn: n.actualizadoEn.toISOString(),
    proyectoId: n.proyectoId,
    clienteId: n.clienteId,
  };
}

async function exigirNotas(): Promise<UsuarioAuth> {
  const yo = await exigirSesionUsuario();
  if (!usuarioPuede(yo, "clientes.ver") && !usuarioPuede(yo, "proyectos.ver")) {
    redirect("/?aviso=sin_permiso");
  }
  return yo;
}

export async function obtenerNotasProyecto(
  proyectoId: string,
): Promise<
  | { ok: true; notas: NotaVista[]; yoId: string }
  | { ok: false; motivo: string }
> {
  const yo = await exigirNotas();
  const id = proyectoId.trim();
  if (!id) return { ok: false, motivo: "falta_dato" };
  if (!(await puedeVerProyecto(yo, id))) return { ok: false, motivo: "sin_permiso" };
  const notas = await listarNotasProyecto(id);
  return { ok: true, notas: notas.map(mapearVista), yoId: yo.id };
}

export async function obtenerNotasCliente(
  clienteId: string,
): Promise<
  | { ok: true; notas: NotaVista[]; proyectos: ProyectoNotaRef[]; yoId: string }
  | { ok: false; motivo: string }
> {
  const yo = await exigirPermiso("clientes.ver");
  const id = clienteId.trim();
  if (!id) return { ok: false, motivo: "falta_dato" };

  const [notas, proyectos, nombresTipo] = await Promise.all([
    listarNotasCliente(id),
    proyectosDe(id),
    mapaNombresTipo(),
  ]);

  const cliente = await clientePorId(id);
  const esRespCliente = Boolean(
    yo.esAdmin || (cliente?.responsableId && cliente.responsableId === yo.id),
  );
  const visibles = esRespCliente
    ? proyectos
    : (
        await Promise.all(
          proyectos.map(async (p) =>
            (await puedeVerProyecto(yo, p.id)) ? p : null,
          ),
        )
      ).filter((p): p is NonNullable<typeof p> => p != null);

  const refs: ProyectoNotaRef[] = visibles.map((p) => ({
    id: p.id,
    titulo: (p.nombre?.trim() || nombresTipo.get(p.tipoId ?? "") || "Proyecto").trim(),
  }));

  return {
    ok: true,
    notas: notas.map(mapearVista),
    proyectos: refs,
    yoId: yo.id,
  };
}

export async function crearNotaProyectoAccion(
  proyectoId: string,
  texto: string,
): Promise<{ ok: true; nota: NotaVista } | { ok: false; motivo: string }> {
  const yo = await exigirNotas();
  if (!(await puedeVerProyecto(yo, proyectoId))) return { ok: false, motivo: "sin_permiso" };
  const r = await crearNotaProyecto(proyectoId, texto, yo.id);
  if (!r.ok) return { ok: false, motivo: r.motivo };
  return { ok: true, nota: mapearVista(r.nota) };
}

export async function crearNotaClienteAccion(
  clienteId: string,
  texto: string,
): Promise<{ ok: true; nota: NotaVista } | { ok: false; motivo: string }> {
  const yo = await exigirPermiso("clientes.ver");
  const r = await crearNotaCliente(clienteId, texto, yo.id);
  if (!r.ok) return { ok: false, motivo: r.motivo };
  return { ok: true, nota: mapearVista(r.nota) };
}

export async function editarNotaAccion(
  notaId: string,
  texto: string,
): Promise<{ ok: true; nota: NotaVista } | { ok: false; motivo: string }> {
  const yo = await exigirNotas();
  const r = await actualizarNota(notaId, texto, yo.id);
  if (!r.ok) return { ok: false, motivo: r.motivo };
  return { ok: true, nota: mapearVista(r.nota) };
}

export async function borrarNotaAccion(
  notaId: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const yo = await exigirNotas();
  const r = await borrarNota(notaId, yo.id);
  if (!r.ok) return { ok: false, motivo: r.motivo };
  return { ok: true };
}
