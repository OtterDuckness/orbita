"use server";

import {
  areaDeAccion,
  etiquetaAccion,
  etiquetaArea,
  guardarNotaAdminLog,
  listarLogsPorMetaIds,
} from "@/lib/admin-logs";
import { exigirPermiso } from "@/lib/authz";
import { getPool } from "@/lib/db";
import { proyectosDe } from "@/lib/proyectos";
import type { RowDataPacket } from "mysql2";

export type HistorialEvento = {
  id: string;
  actorCorreo: string;
  accion: string;
  accionEtiqueta: string;
  areaEtiqueta: string;
  detalle: string | null;
  creadoEn: string;
  nota: string | null;
  notaAutorNombre: string | null;
  notaCreadoEn: string | null;
};

async function idsTareasDeProyectos(proyectoIds: string[]): Promise<string[]> {
  if (proyectoIds.length === 0) return [];
  const pool = await getPool();
  const [rows] = await pool.query<(RowDataPacket & { id: string })[]>(
    `SELECT id FROM tareas WHERE proyecto_id IN (${proyectoIds.map(() => "?").join(",")})`,
    proyectoIds,
  );
  return rows.map((r) => r.id);
}

function mapear(logs: Awaited<ReturnType<typeof listarLogsPorMetaIds>>): HistorialEvento[] {
  return logs.map((l) => ({
    id: l.id,
    actorCorreo: l.actorCorreo,
    accion: l.accion,
    accionEtiqueta: etiquetaAccion(l.accion),
    areaEtiqueta: etiquetaArea(areaDeAccion(l.accion)),
    detalle: l.detalle,
    creadoEn: (l.creadoEn instanceof Date ? l.creadoEn : new Date(l.creadoEn)).toISOString(),
    nota: l.nota,
    notaAutorNombre: l.notaAutorNombre,
    notaCreadoEn: l.notaCreadoEn
      ? (l.notaCreadoEn instanceof Date ? l.notaCreadoEn : new Date(l.notaCreadoEn)).toISOString()
      : null,
  }));
}

export async function obtenerHistorialCliente(
  clienteId: string,
): Promise<{ ok: true; eventos: HistorialEvento[] } | { ok: false; motivo: string }> {
  await exigirPermiso("clientes.ver");
  const id = clienteId.trim();
  if (!id) return { ok: false, motivo: "falta_dato" };

  const proyectos = await proyectosDe(id);
  const proyectoIds = proyectos.map((p) => p.id);
  const tareaIds = await idsTareasDeProyectos(proyectoIds);
  const logs = await listarLogsPorMetaIds({
    clienteIds: [id],
    proyectoIds,
    tareaIds,
    limit: 200,
  });
  return { ok: true, eventos: mapear(logs) };
}

export async function obtenerHistorialProyecto(
  proyectoId: string,
): Promise<{ ok: true; eventos: HistorialEvento[] } | { ok: false; motivo: string }> {
  await exigirPermiso("proyectos.ver");
  const id = proyectoId.trim();
  if (!id) return { ok: false, motivo: "falta_dato" };

  const tareaIds = await idsTareasDeProyectos([id]);
  const logs = await listarLogsPorMetaIds({
    proyectoIds: [id],
    tareaIds,
    limit: 200,
  });
  return { ok: true, eventos: mapear(logs) };
}

export async function guardarNotaHistorial(
  ambito: "cliente" | "proyecto",
  logId: string,
  texto: string,
): Promise<
  | {
      ok: true;
      nota: string | null;
      notaAutorNombre: string | null;
      notaCreadoEn: string | null;
    }
  | { ok: false; motivo: string }
> {
  const yo =
    ambito === "cliente"
      ? await exigirPermiso("clientes.ver")
      : await exigirPermiso("proyectos.ver");

  const r = await guardarNotaAdminLog(logId, texto, yo.id, yo.nombre);
  if (!r.ok) return { ok: false, motivo: r.motivo };
  return {
    ok: true,
    nota: r.nota,
    notaAutorNombre: r.notaAutorNombre,
    notaCreadoEn: r.notaCreadoEn ? r.notaCreadoEn.toISOString() : null,
  };
}
