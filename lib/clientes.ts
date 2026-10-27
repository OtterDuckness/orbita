import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import {
  TIPOS_CUENTA,
  normalizarTelefonoEs,
  type Cliente,
  type OrigenAlta,
  type TipoCuenta,
} from "@/lib/clientes-mock";
import { usuarioPorId } from "@/lib/usuarios";

export type { Cliente, OrigenAlta, TipoCuenta };

export type MotivoErrorCliente =
  | "falta_dato"
  | "correo_duplicado"
  | "nombre_duplicado"
  | "correo_invalido"
  | "telefono_invalido"
  | "responsable_invalido"
  | "tipo_cuenta_invalido"
  | "no_encontrado"
  | "error_bd";

type ClienteRow = RowDataPacket & {
  id: string;
  nombre: string;
  correo_acceso: string;
  telefono: string | null;
  responsable_id: string | null;
  tipo_cuenta: TipoCuenta | null;
  origen: OrigenAlta;
  invitacion_enviada: number | boolean;
  invitacion_enviada_en: Date | string | null;
  creado_en: Date | string;
};

const SELECT_CLIENTE =
  "id, nombre, correo_acceso, telefono, responsable_id, tipo_cuenta, origen, invitacion_enviada, invitacion_enviada_en, creado_en";

export function parseTipoCuenta(raw: string | null | undefined): TipoCuenta | null | false {
  const v = (raw ?? "").trim();
  if (!v) return null;
  return (TIPOS_CUENTA as string[]).includes(v) ? (v as TipoCuenta) : false;
}

function motivoDuplicado(err: unknown): "correo_duplicado" | "nombre_duplicado" | null {
  if (typeof err !== "object" || err === null || !("code" in err)) return null;
  if ((err as { code: string }).code !== "ER_DUP_ENTRY") return null;
  const msg = String((err as { message?: string }).message ?? "").toLowerCase();
  if (msg.includes("uq_clientes_nombre") || msg.includes("nombre")) return "nombre_duplicado";
  return "correo_duplicado";
}

function correoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

function iso(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function filaACliente(r: ClienteRow): Cliente {
  const tipo = parseTipoCuenta(r.tipo_cuenta ?? "");
  return {
    id: r.id,
    nombre: r.nombre,
    correoAcceso: r.correo_acceso,
    telefono: r.telefono || null,
    responsableId: r.responsable_id || null,
    tipoCuenta: tipo === false ? null : tipo,
    origen: r.origen === "clientify" ? "clientify" : "manual",
    invitacionEnviada: Boolean(r.invitacion_enviada),
    invitacionEnviadaEl: iso(r.invitacion_enviada_en),
    creadoEl: iso(r.creado_en) ?? new Date().toISOString(),
  };
}

async function normalizarResponsableId(
  raw: string | null | undefined,
): Promise<{ ok: true; id: string | null } | { ok: false }> {
  const id = (raw ?? "").trim();
  if (!id) return { ok: true, id: null };
  const u = await usuarioPorId(id);
  if (!u) return { ok: false };
  return { ok: true, id: u.id };
}

export async function listarClientes(): Promise<Cliente[]> {
  const pool = await getPool();
  const [rows] = await pool.execute<ClienteRow[]>(
    `SELECT ${SELECT_CLIENTE}
     FROM clientes
     ORDER BY nombre ASC`,
  );
  return rows.map(filaACliente);
}

export async function clientePorId(clienteId: string | null | undefined): Promise<Cliente | null> {
  if (!clienteId) return null;
  const pool = await getPool();
  const [rows] = await pool.execute<ClienteRow[]>(
    `SELECT ${SELECT_CLIENTE}
     FROM clientes WHERE id = ? LIMIT 1`,
    [clienteId],
  );
  const r = rows[0];
  return r ? filaACliente(r) : null;
}

export async function mapaNombresCliente(): Promise<Map<string, string>> {
  const clientes = await listarClientes();
  return new Map(clientes.map((c) => [c.id, c.nombre]));
}

export async function crearCliente(input: {
  nombre: string;
  correoAcceso: string;
  telefono?: string;
  responsableId?: string;
  tipoCuenta?: string | null;
  origen: OrigenAlta;
  enviarInvitacion: boolean;
}): Promise<{ ok: true; cliente: Cliente } | { ok: false; motivo: MotivoErrorCliente }> {
  const nombre = input.nombre.trim();
  const correoAcceso = input.correoAcceso.trim().toLowerCase();
  if (!nombre || !correoAcceso) return { ok: false, motivo: "falta_dato" };
  if (!correoValido(correoAcceso)) return { ok: false, motivo: "correo_invalido" };
  const telefono = normalizarTelefonoEs(input.telefono ?? "");
  if (telefono === false) return { ok: false, motivo: "telefono_invalido" };
  const tipoCuenta = parseTipoCuenta(input.tipoCuenta);
  if (tipoCuenta === false) return { ok: false, motivo: "tipo_cuenta_invalido" };
  const resp = await normalizarResponsableId(input.responsableId);
  if (!resp.ok) return { ok: false, motivo: "responsable_invalido" };
  if (!resp.id) return { ok: false, motivo: "falta_dato" };

  const id = randomUUID();
  const invitacion = input.enviarInvitacion;
  const ahora = new Date();
  const pool = await getPool();

  try {
    await pool.execute(
      `INSERT INTO clientes
        (id, nombre, correo_acceso, telefono, responsable_id, tipo_cuenta, origen, invitacion_enviada, invitacion_enviada_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        nombre,
        correoAcceso,
        telefono,
        resp.id,
        tipoCuenta,
        input.origen,
        invitacion ? 1 : 0,
        invitacion ? ahora : null,
      ],
    );
  } catch (err) {
    const dup = motivoDuplicado(err);
    if (dup) return { ok: false, motivo: dup };
    console.error("[clientes] crear falló", err);
    return { ok: false, motivo: "error_bd" };
  }

  return {
    ok: true,
    cliente: {
      id,
      nombre,
      correoAcceso,
      telefono,
      responsableId: resp.id,
      tipoCuenta,
      origen: input.origen,
      invitacionEnviada: invitacion,
      invitacionEnviadaEl: invitacion ? ahora.toISOString() : null,
      creadoEl: ahora.toISOString(),
    },
  };
}

export async function editarCliente(input: {
  clienteId: string;
  nombre: string;
  correoAcceso: string;
  telefono?: string;
  responsableId?: string;
  tipoCuenta?: string | null;
  origen: OrigenAlta;
}): Promise<{ ok: true } | { ok: false; motivo: MotivoErrorCliente }> {
  const existente = await clientePorId(input.clienteId);
  if (!existente) return { ok: false, motivo: "no_encontrado" };

  const nombre = input.nombre.trim();
  const correoAcceso = input.correoAcceso.trim().toLowerCase();
  if (!nombre || !correoAcceso) return { ok: false, motivo: "falta_dato" };
  if (!correoValido(correoAcceso)) return { ok: false, motivo: "correo_invalido" };
  const telefono = normalizarTelefonoEs(input.telefono ?? "");
  if (telefono === false) return { ok: false, motivo: "telefono_invalido" };
  const tipoCuenta = parseTipoCuenta(input.tipoCuenta);
  if (tipoCuenta === false) return { ok: false, motivo: "tipo_cuenta_invalido" };
  const resp = await normalizarResponsableId(input.responsableId);
  if (!resp.ok) return { ok: false, motivo: "responsable_invalido" };
  if (!resp.id) return { ok: false, motivo: "falta_dato" };

  const pool = await getPool();
  try {
    await pool.execute(
      `UPDATE clientes
       SET nombre = ?, correo_acceso = ?, telefono = ?, responsable_id = ?, tipo_cuenta = ?, origen = ?
       WHERE id = ?`,
      [nombre, correoAcceso, telefono, resp.id, tipoCuenta, input.origen, input.clienteId],
    );
  } catch (err) {
    const dup = motivoDuplicado(err);
    if (dup) return { ok: false, motivo: dup };
    throw err;
  }
  return { ok: true };
}

export async function enviarInvitacion(
  clienteId: string,
): Promise<{ ok: true } | { ok: false; motivo: "no_encontrado" }> {
  const existente = await clientePorId(clienteId);
  if (!existente) return { ok: false, motivo: "no_encontrado" };

  const pool = await getPool();
  await pool.execute(
    `UPDATE clientes SET invitacion_enviada = 1, invitacion_enviada_en = ? WHERE id = ?`,
    [new Date(), clienteId],
  );
  return { ok: true };
}

/**
 * Borra cliente + proyectos en cascada (papelera con snapshot para undo).
 * Las conversaciones tipo cliente se borran y no se restauran (FK RESTRICT).
 */
export async function eliminarCliente(
  clienteId: string,
  actor: { id: string; correo: string },
): Promise<
  | {
      ok: true;
      eliminacionId: string;
      proyectosBorrados: number;
      conversacionesBorradas: number;
    }
  | { ok: false; motivo: "no_encontrado" }
> {
  const { eliminarClienteConPapelera } = await import("@/lib/papelera");
  return eliminarClienteConPapelera(clienteId, actor);
}
