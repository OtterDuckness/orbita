/**
 * Campos visibles/editables en el lightbox de confirmación del asistente.
 * Solo se fusionan en el servidor las claves marcadas editable (IDs de destino quedan fijos).
 */

export type TipoCampoConfirmacion =
  | "text"
  | "textarea"
  | "boolean"
  | "lista"
  | "number"
  | "fecha"
  | "persona"
  | "personas"
  | "prioridad"
  | "estado"
  | "ambito"
  | "tipo";

export type CampoConfirmacion = {
  key: string;
  label: string;
  tipo: TipoCampoConfirmacion;
  /** Si false, se muestra (si aporta) pero no se puede cambiar al confirmar. */
  editable: boolean;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function c(
  key: string,
  label: string,
  tipo: TipoCampoConfirmacion,
  editable: boolean,
): CampoConfirmacion {
  return { key, label, tipo, editable };
}

/** Catálogo por tool. Orden = orden en el lightbox. */
const CAMPOS_POR_TOOL: Record<string, CampoConfirmacion[]> = {
  crear_cliente: [
    c("nombre", "Nombre", "text", true),
    c("correoAcceso", "Correo de acceso", "text", true),
    c("telefono", "Teléfono", "text", true),
    c("responsableId", "Responsable", "persona", true),
    c("enviarInvitacion", "Enviar invitación", "boolean", true),
  ],
  editar_cliente: [
    c("clienteId", "Cliente", "text", false),
    c("nombre", "Nombre", "text", true),
    c("correoAcceso", "Correo de acceso", "text", true),
    c("telefono", "Teléfono", "text", true),
    c("responsableId", "Responsable", "persona", true),
  ],
  enviar_invitacion_cliente: [c("clienteId", "Cliente", "text", false)],
  eliminar_cliente: [c("clienteId", "Cliente", "text", false)],
  crear_proyecto: [
    c("nombre", "Nombre", "text", true),
    c("clienteId", "Cliente", "text", false),
    c("tipoId", "Tipo", "tipo", true),
    c("ambito", "Ámbito", "ambito", true),
    c("feeMensual", "Fee mensual", "text", true),
    c("finContrato", "Fin de contrato", "fecha", true),
    c("prioridad", "Prioridad", "prioridad", true),
    c("responsableId", "Responsable", "persona", true),
    c("colaboradorIds", "Colaboradores", "personas", true),
  ],
  editar_proyecto: [
    c("proyectoId", "Proyecto", "text", false),
    c("nombre", "Nombre", "text", true),
    c("clienteId", "Cliente", "text", false),
    c("tipoId", "Tipo", "tipo", true),
    c("ambito", "Ámbito", "ambito", true),
    c("feeMensual", "Fee mensual", "text", true),
    c("finContrato", "Fin de contrato", "fecha", true),
    c("prioridad", "Prioridad", "prioridad", true),
    c("responsableId", "Responsable", "persona", true),
    c("colaboradorIds", "Colaboradores", "personas", true),
  ],
  cambiar_estado_proyecto: [
    c("proyectoId", "Proyecto", "text", false),
    c("estado", "Estado", "estado", true),
  ],
  eliminar_proyecto: [c("proyectoId", "Proyecto", "text", false)],
  crear_tarea: [
    c("proyectoId", "Proyecto", "text", false),
    c("nombre", "Nombre", "text", true),
    c("columnaId", "Columna", "text", true),
    c("fechaPrevista", "Fecha prevista", "fecha", true),
    c("fechaMaxima", "Fecha máxima", "fecha", true),
    c("prioridad", "Prioridad", "prioridad", true),
    c("syncCalendar", "Sync Calendar", "boolean", true),
    c("responsableIds", "Responsables", "personas", true),
    c("colaboradorIds", "Colaboradores", "personas", true),
  ],
  editar_tarea: [
    c("tareaId", "Tarea", "text", false),
    c("nombre", "Nombre", "text", true),
    c("fechaPrevista", "Fecha prevista", "fecha", true),
    c("fechaMaxima", "Fecha máxima", "fecha", true),
    c("prioridad", "Prioridad", "prioridad", true),
    c("syncCalendar", "Sync Calendar", "boolean", true),
    c("mandadaPorId", "Mandada por", "persona", true),
  ],
  mover_tarea: [
    c("tareaId", "Tarea", "text", false),
    c("columnaId", "Columna destino", "text", true),
    c("indice", "Posición", "number", true),
  ],
  alternar_completada_tarea: [c("tareaId", "Tarea", "text", false)],
  asignar_responsables_tarea: [
    c("tareaId", "Tarea", "text", false),
    c("responsableIds", "Responsables", "personas", true),
  ],
  guardar_notas_tarea: [
    c("tareaId", "Tarea", "text", false),
    c("texto", "Notas", "textarea", true),
  ],
  borrar_tarea: [c("tareaId", "Tarea", "text", false)],
  restaurar_eliminado: [
    c("eliminacionId", "Eliminación", "text", false),
    c("eliminacionIds", "Eliminaciones", "lista", false),
  ],
  deshacer_accion: [c("accionId", "Acción", "text", false)],
  crear_grupo: [
    c("nombre", "Nombre", "text", true),
    c("miembroIds", "Miembros", "personas", true),
  ],
  enviar_mensaje: [
    c("conversacionId", "Conversación", "text", false),
    c("cuerpo", "Mensaje", "textarea", true),
  ],
  enviar_mensaje_tarea: [
    c("tareaId", "Tarea", "text", false),
    c("cuerpo", "Mensaje", "textarea", true),
  ],
};

export function camposConfirmacion(tool: string): CampoConfirmacion[] {
  return CAMPOS_POR_TOOL[tool] ?? [];
}

function valorVacio(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string" && !v.trim()) return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function esUuid(v: unknown): boolean {
  return typeof v === "string" && UUID_RE.test(v.trim());
}

/** Args listos para el cliente: solo claves del catálogo con valor útil; oculta UUIDs en campos no editables. */
export function argsParaUi(
  tool: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const campo of camposConfirmacion(tool)) {
    const v = args[campo.key];
    if (valorVacio(v)) continue;
    if (!campo.editable) {
      if (esUuid(v)) continue;
      if (Array.isArray(v) && v.every(esUuid)) continue;
    }
    out[campo.key] = v;
  }
  return out;
}

export function parseLista(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function refsDe(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (v == null) return [];
  return parseLista(String(v));
}

/** Valor de formulario (string / boolean) a partir del arg crudo (sin resolver nombres). */
export function valorCampoUi(
  campo: CampoConfirmacion,
  args: Record<string, unknown>,
): string | boolean {
  const v = args[campo.key];
  if (campo.tipo === "boolean") return Boolean(v);
  if (campo.tipo === "lista" || campo.tipo === "personas") {
    return refsDe(v).join(", ");
  }
  return v == null ? "" : String(v);
}

/**
 * Payload de pendiente listo para la UI / JSON de la API.
 * `poolIds`: colaboradores del proyecto (asignables); si falta, la UI usa todo el equipo.
 */
export function pendienteAUi(p: {
  tool: string;
  clave: string;
  resumen: string | null;
  args: Record<string, unknown>;
  poolIds?: string[];
}): {
  tool: string;
  clave: string;
  resumen: string | null;
  args: Record<string, unknown>;
  poolIds?: string[];
} {
  return {
    tool: p.tool,
    clave: p.clave,
    resumen: p.resumen,
    args: argsParaUi(p.tool, p.args),
    ...(p.poolIds && p.poolIds.length > 0 ? { poolIds: p.poolIds } : {}),
  };
}

/**
 * Mezcla solo campos editables del cliente sobre los args originales del reto.
 * Ignora confirmado y cualquier clave no editable / desconocida.
 */
export function fusionarArgsEditados(
  tool: string,
  originales: Record<string, unknown>,
  editados: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...originales };
  delete merged.confirmado;
  if (!editados || typeof editados !== "object") return merged;

  for (const campo of camposConfirmacion(tool)) {
    if (!campo.editable) continue;
    if (!(campo.key in editados)) continue;
    const raw = editados[campo.key];
    if (campo.tipo === "boolean") {
      merged[campo.key] = Boolean(raw);
      continue;
    }
    if (campo.tipo === "number") {
      const n =
        typeof raw === "number"
          ? raw
          : Number(String(raw ?? "").trim().replace(",", "."));
      if (Number.isFinite(n)) merged[campo.key] = n;
      else delete merged[campo.key];
      continue;
    }
    if (campo.tipo === "lista" || campo.tipo === "personas") {
      if (Array.isArray(raw)) {
        merged[campo.key] = raw.map(String).map((s) => s.trim()).filter(Boolean);
      } else {
        merged[campo.key] = parseLista(String(raw ?? ""));
      }
      continue;
    }
    if (campo.tipo === "fecha") {
      const s = raw == null ? "" : String(raw).trim();
      if (!s) delete merged[campo.key];
      else merged[campo.key] = s;
      continue;
    }
    const s = raw == null ? "" : String(raw);
    if (
      !s.trim() &&
      (campo.tipo === "text" ||
        campo.tipo === "textarea" ||
        campo.tipo === "persona" ||
        campo.tipo === "tipo")
    ) {
      if (
        campo.key === "nombre" ||
        campo.key === "correoAcceso" ||
        campo.key === "cuerpo" ||
        campo.key === "texto"
      ) {
        merged[campo.key] = s.trim();
      } else {
        delete merged[campo.key];
      }
      continue;
    }
    merged[campo.key] = s.trim ? s.trim() : s;
  }
  return merged;
}
