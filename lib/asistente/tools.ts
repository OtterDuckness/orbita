import { toYmd } from "@/lib/agenda";
import { alcanceProyectos } from "@/lib/authz";
import {
  crearCliente,
  editarCliente,
  eliminarCliente,
  enviarInvitacion,
  listarClientes,
  type Cliente,
} from "@/lib/clientes";
import { confirmacionDosTurnosOk } from "@/lib/asistente/historial";
import { parseZona } from "@/lib/zona";
import {
  esErrorResolucion,
  nombrarProyectos,
  resolverChecklistItem,
  resolverCliente,
  resolverColumna,
  resolverConversacion,
  resolverMiembro,
  resolverMiembros,
  resolverProyecto,
  resolverTarea,
  resolverTipo,
  textoParecido,
  type ErrorResolucion,
  type ProyectoNombrado,
} from "@/lib/asistente/nombres";
import type { MensajeIa } from "@/lib/asistente/store";
import {
  abrirOCrearDm,
  crearGrupo,
  enviarMensaje,
  listarConversacionesDe,
  listarMensajes as listarMensajesChat,
  marcarLeido,
} from "@/lib/comunicaciones";
import type { Permiso } from "@/lib/permisos";
import {
  cambiarEstadoProyecto,
  crearProyecto,
  editarProyecto,
  eliminarProyecto,
  listarProyectos,
  proyectoPorId,
  proyectosDe,
  type EstadoProyecto,
  type Proyecto,
} from "@/lib/proyectos";
import {
  DIAS_RETENCION_DESHACER,
  deshacerAccion,
  listarAccionesDeshacer,
  obtenerAccionDeshacer,
  registrarAccionReversible,
  snapCliente,
  snapProyectoEstado,
  snapTareaEdit,
  snapTareaPosicion,
  snapTareaResponsables,
  type RegistrarAccionInput,
} from "@/lib/deshacer";
import {
  DIAS_RETENCION_PAPELERA,
  listarEliminaciones,
  obtenerEliminacion,
  restaurarEliminacion,
  type TipoEliminacion,
} from "@/lib/papelera";
import { formatearAlta, formatearCambios, logActividad } from "@/lib/admin-logs";
import { construirResumenPeriodo, type PeriodoResumen } from "@/lib/asistente/resumen";
import { listarNotasCliente, listarNotasProyecto } from "@/lib/notas";
import { puedeVerApartado } from "@/lib/apartados";
import {
  borrarEventosCalendarDeProyectos,
  sincronizarTareaConCalendar,
} from "@/lib/google-calendar";
import {
  leerHilo,
  listarCorreos,
  tokensCorreoOError,
  type CorreoCarpeta,
  type CorreoDetalle,
} from "@/lib/google-gmail";
import { esModoPruebas } from "@/lib/sandbox";
import {
  enviarMensajeTarea,
  marcarChatTareaVisto,
  mensajesDeTarea,
  puedeAccederTarea,
} from "@/lib/tarea-chat";
import {
  alternarCompletadaTarea,
  anadirChecklist,
  columnasDe,
  crearTarea,
  editarResponsablesTarea,
  editarTarea,
  esColumnaCerrada,
  guardarNotas,
  moverTarea,
  borrarTarea,
  tareasDe,
  tareasDelUsuario,
  toggleChecklist,
} from "@/lib/tablero";
import type { Prioridad, Tarea } from "@/lib/tareas-mock";
import { listarTiposProyecto } from "@/lib/tipos-proyecto";
import {
  listarEquipo,
  mapaEquipo,
  usuarioPuede,
  type UsuarioAuth,
} from "@/lib/usuarios";

/** Contexto de ejecución (chat) para auditoría en admin_logs. */
export type ToolCtx = {
  conversacionId: string | null;
};

export type ToolDef = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  permiso: Permiso | null;
  requiereConfirmacion?: boolean;
  handler: (
    usuario: UsuarioAuth,
    args: Record<string, unknown>,
    ctx: ToolCtx,
  ) => Promise<unknown>;
};

/** Actor visible en /admin/logs: `agente_ia_<local-part del correo>`. */
function actorAgente(u: UsuarioAuth): { id: string; correo: string } {
  const local = u.correo.split("@")[0]?.trim().toLowerCase() || "desconocido";
  const slug = local.replace(/[^a-z0-9._-]/g, "_").slice(0, 200) || "desconocido";
  return { id: u.id, correo: `agente_ia_${slug}` };
}

function metaAgente(
  ctx: ToolCtx,
  meta?: Record<string, unknown> | null,
): Record<string, unknown> {
  return {
    via: "asistente",
    conversacionId: ctx.conversacionId,
    ...(meta ?? {}),
  };
}

async function logAgente(
  u: UsuarioAuth,
  ctx: ToolCtx,
  accion: string,
  detalle?: string | null,
  meta?: Record<string, unknown> | null,
): Promise<void> {
  await logActividad(actorAgente(u), accion, detalle, metaAgente(ctx, meta));
}

async function registrarDeshacerAgente(
  u: UsuarioAuth,
  ctx: ToolCtx,
  input: Omit<RegistrarAccionInput, "actorId" | "via" | "conversacionId">,
): Promise<void> {
  await registrarAccionReversible({
    ...input,
    actorId: u.id,
    via: "asistente",
    conversacionId: ctx.conversacionId,
  }).catch((e) => console.error("[deshacer] registrar via asistente", e));
}

async function nombreDe(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  const m = await mapaEquipo();
  const n = m.get(id)?.nombre?.trim();
  return n || null;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}

function bool(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "1" || v === 1) return true;
  if (v === "false" || v === "0" || v === 0) return false;
  return fallback;
}

function strArr(v: unknown): string[] {
  if (typeof v === "string") {
    const s = v.trim();
    return s ? [s] : [];
  }
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

/** If nobody is on the project team, fail before writing (avoids wiping assignees). */
function errorSiNingunoEnEquipo(
  miembros: { id: string; nombre: string }[],
  colaboradorIds: string[],
): {
  error: "no_asignado";
  mensaje: string;
  fueraDelEquipo: string[];
} | null {
  const pool = new Set(colaboradorIds.map((id) => id.trim()).filter(Boolean));
  const fuera = miembros.filter((m) => !pool.has(m.id));
  if (fuera.length !== miembros.length) return null;
  return {
    error: "no_asignado",
    mensaje: `${fuera.map((m) => m.nombre).join(", ")} no está(n) en el equipo del proyecto. Añádelos como colaboradores antes de asignar.`,
    fueraDelEquipo: fuera.map((m) => m.nombre),
  };
}

/** Lista slim con total real (aunque se corte lo mostrado). */
function listaConClave<T, K extends string>(items: T[], limite: number, clave: K) {
  const total = items.length;
  const slice = items.slice(0, limite);
  return {
    total,
    mostradas: slice.length,
    truncado: total > slice.length,
    [clave]: slice,
  } as { total: number; mostradas: number; truncado: boolean } & Record<K, T[]>;
}

function listaConTotal<T>(items: T[], limite: number) {
  return listaConClave(items, limite, "tareas");
}

function parseLimite(v: unknown, fallback: number, max: number): number {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string" && v.trim()
        ? Number(v)
        : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(n)));
}

function diaCreadoEnZona(creadoEl: string, timeZone: string): string {
  const t = Date.parse(creadoEl);
  if (Number.isNaN(t)) return (creadoEl || "").slice(0, 10);
  return toYmd(new Date(t), timeZone);
}

function ordenCreadoDe(args: Record<string, unknown>): "asc" | "desc" | null {
  const raw = str(args.orden).toLowerCase();
  if (raw === "creado_asc" || raw === "asc") return "asc";
  if (raw === "creado_desc" || raw === "desc") return "desc";
  return null;
}

function pasaFiltroCreacion(
  t: { creadoEl: string; mandadaPorId: string | null },
  opts: {
    creadasDesde: string;
    creadasHasta: string;
    soloCreadasPorMi: boolean;
    yoId: string;
    timeZone: string;
  },
): boolean {
  if (opts.soloCreadasPorMi && t.mandadaPorId !== opts.yoId) return false;
  if (!opts.creadasDesde && !opts.creadasHasta) return true;
  const dia = diaCreadoEnZona(t.creadoEl, opts.timeZone);
  if (!dia) return false;
  if (opts.creadasDesde && dia < opts.creadasDesde) return false;
  if (opts.creadasHasta && dia > opts.creadasHasta) return false;
  return true;
}

function ordenarPorCreadoEl<T extends { creadoEl: string }>(
  items: T[],
  orden: "asc" | "desc" | null,
): T[] {
  if (!orden) return items;
  const sign = orden === "desc" ? -1 : 1;
  return [...items].sort((a, b) => sign * a.creadoEl.localeCompare(b.creadoEl));
}

/** Ids de papelera a restaurar (uno o lote); orden estable para la clave de confirmación. */
function idsRestaurarPapelera(args: Record<string, unknown>): string[] {
  const fromArr = strArr(args.eliminacionIds);
  const one = str(args.eliminacionId);
  const ids = [...fromArr];
  if (one && !ids.includes(one)) ids.push(one);
  return [...new Set(ids)].sort();
}

/** Refs de tareas a borrar (id o nombre; uno o lote). Orden de entrada; dedupe case-sensitive. */
function refsBorrarTareas(args: Record<string, unknown>): string[] {
  const fromArr = strArr(args.tareaIds);
  const one = str(args.tareaId);
  const refs = [...fromArr];
  if (one && !refs.includes(one)) refs.push(one);
  return [...new Set(refs)];
}

function matchNombre(q: string, nombre: string): boolean {
  const fold = (s: string) =>
    s
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const a = fold(q);
  if (!a) return true;
  return fold(nombre).includes(a);
}

const CUERPO_CORREO_MAX = 4000;

/** Gate solo-lectura Gmail (nunca envío / labels). */
async function gateCorreoLectura(u: UsuarioAuth) {
  if (await esModoPruebas()) {
    return {
      ok: false as const,
      error: "correo_desactivado",
      mensaje: "El correo Gmail no está disponible en modo pruebas.",
    };
  }
  if (!(await puedeVerApartado("correo", u.esAdmin))) {
    return {
      ok: false as const,
      error: "apartado_off",
      mensaje: "El apartado Correo está desactivado.",
    };
  }
  const tok = await tokensCorreoOError(u.correo);
  if (!tok.ok) {
    return {
      ok: false as const,
      error: "sin_token",
      mensaje: "No hay conexión Gmail. El usuario debe iniciar sesión con Google y el scope de correo.",
    };
  }
  return { ok: true as const, tokens: tok.tokens };
}

function carpetaCorreo(v: unknown): CorreoCarpeta {
  return str(v).toLowerCase() === "sent" ? "sent" : "inbox";
}

function cuerpoTextoCorreo(m: CorreoDetalle, max = CUERPO_CORREO_MAX): string {
  const plain = (m.bodyText ?? "").trim();
  if (plain) return plain.slice(0, max);
  const html = (m.bodyHtml ?? "").trim();
  if (html) {
    return html
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  }
  return (m.snippet ?? "").slice(0, max);
}

function mensajeCorreoSlim(m: CorreoDetalle) {
  const cuerpo = cuerpoTextoCorreo(m);
  return {
    id: m.id,
    from: m.from,
    to: m.to,
    cc: m.cc || undefined,
    subject: m.subject,
    date: m.date,
    unread: m.unread,
    starred: m.starred,
    cuerpo,
    cuerpoTruncado: cuerpo.length >= CUERPO_CORREO_MAX,
    adjuntos: m.attachments.map((a) => ({
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
    })),
  };
}

async function proyectosVisibles(
  usuario: UsuarioAuth,
  verTodo = false,
): Promise<Proyecto[]> {
  const { soloDe } = alcanceProyectos(usuario, verTodo);
  return listarProyectos(soloDe);
}

async function exigirProyecto(
  usuario: UsuarioAuth,
  ref: string,
  verTodo = false,
): Promise<ProyectoNombrado | ErrorResolucion> {
  return resolverProyecto(usuario, ref, { verTodo });
}

async function exigirTareaEnProyecto(
  usuario: UsuarioAuth,
  ref: string,
  proyectoRef?: string,
): Promise<Tarea | ErrorResolucion> {
  let proyectoId: string | undefined;
  if (proyectoRef) {
    const p = await exigirProyecto(usuario, proyectoRef);
    if (esErrorResolucion(p)) return p;
    proyectoId = p.id;
  }
  const t = await resolverTarea(usuario, ref, { proyectoId });
  if (esErrorResolucion(t)) return t;
  // Personal boards are not resolvable via exigirProyecto (hides personalDeId); same gate as UI / alternar.
  if (!(await puedeAccederTarea(t.id, usuario.id, usuario.esAdmin))) {
    return { error: "sin_acceso", tipo: "tarea", query: ref.trim() };
  }
  return t;
}

async function compactCliente(c: Cliente, yo: UsuarioAuth) {
  const nombres = await mapaNombres(yo);
  return {
    id: c.id,
    nombre: c.nombre,
    correoAcceso: c.correoAcceso,
    telefono: c.telefono,
    origen: c.origen,
    invitacionEnviada: c.invitacionEnviada,
    invitacionEnviadaEl: c.invitacionEnviadaEl,
    responsable: persona(c.responsableId, nombres, yo.id),
  };
}

function compactProyecto(p: ProyectoNombrado, nombres: Map<string, string>, yoId: string) {
  return {
    id: p.id,
    nombre: p.nombre,
    etiqueta: p.etiqueta,
    url: `/proyectos/${p.id}`,
    ambito: p.ambito,
    clienteNombre: p.clienteNombre,
    tipoNombre: p.tipoNombre,
    estado: p.estado,
    prioridad: p.prioridad,
    feeMensual: p.feeMensual,
    finContrato: p.finContrato,
    responsable: persona(p.responsableId, nombres, yoId),
    colaboradores: p.colaboradorIds
      .map((id) => persona(id, nombres, yoId))
      .filter((x): x is PersonaRef => x != null),
  };
}

type PersonaRef = { nombre: string; eresTu: boolean };

async function mapaNombres(yo: UsuarioAuth): Promise<Map<string, string>> {
  const equipo = await mapaEquipo();
  const map = new Map([...equipo].map(([id, m]) => [id, m.nombre]));
  const nombreYo = yo.nombre.trim();
  if (nombreYo) map.set(yo.id, nombreYo);
  return map;
}

function persona(
  id: string | null | undefined,
  nombres: Map<string, string>,
  yoId: string,
): PersonaRef | null {
  if (!id) return null;
  return {
    nombre: nombres.get(id) ?? "Desconocido",
    eresTu: id === yoId,
  };
}

function compactTarea(
  t: Tarea,
  nombres: Map<string, string>,
  yoId: string,
  extra?: {
    proyectoEtiqueta?: string;
    clienteNombre?: string | null;
    columnaNombre?: string | null;
  },
) {
  return {
    id: t.id,
    nombre: t.nombre,
    url: `/tareas?tarea=${encodeURIComponent(t.id)}`,
    proyectoEtiqueta: extra?.proyectoEtiqueta ?? null,
    clienteNombre: extra?.clienteNombre ?? null,
    columnaNombre: extra?.columnaNombre ?? null,
    fechaPrevista: t.fechaPrevista,
    fechaMaxima: t.fechaMaxima,
    syncCalendar: t.syncCalendar,
    notificarAsignado: t.notificarAsignado,
    responsables: t.responsableIds
      .map((id) => persona(id, nombres, yoId))
      .filter((p): p is PersonaRef => p != null),
    mandadaPor: persona(t.mandadaPorId, nombres, yoId),
    prioridad: t.prioridad,
    dificultad: t.dificultad,
    completadaEl: t.completadaEl,
    creadoEl: t.creadoEl,
    notas: t.notas.map((n) => ({
      texto: n.texto.slice(0, 400),
      autor: persona(n.autorId, nombres, yoId),
    })),
    checklist: t.checklist.map((c) => ({
      texto: c.texto,
      hecho: c.hecho,
    })),
  };
}

/** List rows without notas/checklist text (use obtener_tarea for detail). */
function compactTareaLista(
  t: Tarea,
  nombres: Map<string, string>,
  yoId: string,
  extra?: {
    proyectoEtiqueta?: string;
    clienteNombre?: string | null;
    columnaNombre?: string | null;
  },
) {
  return {
    id: t.id,
    nombre: t.nombre,
    url: `/tareas?tarea=${encodeURIComponent(t.id)}`,
    proyectoEtiqueta: extra?.proyectoEtiqueta ?? null,
    clienteNombre: extra?.clienteNombre ?? null,
    columnaNombre: extra?.columnaNombre ?? null,
    fechaPrevista: t.fechaPrevista,
    fechaMaxima: t.fechaMaxima,
    syncCalendar: t.syncCalendar,
    responsables: t.responsableIds
      .map((id) => persona(id, nombres, yoId))
      .filter((p): p is PersonaRef => p != null),
    mandadaPor: persona(t.mandadaPorId, nombres, yoId),
    prioridad: t.prioridad,
    dificultad: t.dificultad,
    completadaEl: t.completadaEl,
    creadoEl: t.creadoEl,
    notasCount: t.notas.length,
    checklistPendientes: t.checklist.filter((c) => !c.hecho).length,
  };
}

async function compactDesdeTarea(u: UsuarioAuth, t: Tarea, p?: ProyectoNombrado) {
  const proyecto = p ?? (await exigirProyecto(u, t.proyectoId));
  const nombres = await mapaNombres(u);
  if (esErrorResolucion(proyecto)) return compactTarea(t, nombres, u.id);
  const cols = await columnasDe(t.proyectoId);
  return compactTarea(t, nombres, u.id, {
    proyectoEtiqueta: proyecto.etiqueta,
    clienteNombre: proyecto.clienteNombre,
    columnaNombre: cols.find((c) => c.id === t.columnaId)?.nombre ?? null,
  });
}

function prioridadDe(v: unknown): Prioridad {
  const p = str(v, "media");
  if (p === "alta" || p === "media" || p === "baja" || p === "urgente") return p;
  return "media";
}

function schema(props: Record<string, unknown>, required?: string[]) {
  return {
    type: "object",
    properties: props,
    ...(required?.length ? { required } : {}),
  };
}

export const CATALOGO_TOOLS: ToolDef[] = [
  {
    name: "buscar_clientes",
    description:
      "Busca clientes por nombre (parcial). Query vacío = listar. Devuelve { total, mostradas, truncado, clientes }. Usa nombres en el chat; el id es solo para otras tools. Si listas: tabla con TODAS las filas; el número anunciado = total.",
    permiso: "clientes.ver",
    input_schema: schema({ query: { type: "string" } }),
    async handler(u, args) {
      const q = str(args.query);
      const todos = await listarClientes();
      const nombres = await mapaNombres(u);
      const filtrados = todos
        .filter((c) => matchNombre(q, c.nombre) || matchNombre(q, c.correoAcceso))
        .map((c) => ({
          id: c.id,
          nombre: c.nombre,
          correoAcceso: c.correoAcceso,
          origen: c.origen,
          responsable: persona(c.responsableId, nombres, u.id),
        }));
      return listaConClave(filtrados, 30, "clientes");
    },
  },
  {
    name: "obtener_cliente",
    description: "Obtiene un cliente por nombre o id.",
    permiso: "clientes.ver",
    input_schema: schema({ clienteId: { type: "string" } }, ["clienteId"]),
    async handler(u, args) {
      const c = await resolverCliente(str(args.clienteId));
      if (esErrorResolucion(c)) return c;
      return compactCliente(c, u);
    },
  },
  {
    name: "crear_cliente",
    description:
      "Crea un cliente. correoAcceso obligatorio: solo el que dé el usuario, nunca inventes uno. Si falta, pregunta y no llames esta tool. responsableId: nombre o id (por defecto el usuario actual). telefono opcional (móvil ES, se normaliza a +34). Llama sin confirmado; la UI pide confirmación.",
    permiso: "clientes.editar",
    requiereConfirmacion: true,
    input_schema: schema(
      {
        nombre: { type: "string" },
        correoAcceso: { type: "string" },
        telefono: { type: "string" },
        responsableId: { type: "string" },
        enviarInvitacion: { type: "boolean" },
        confirmado: { type: "boolean" },
      },
      ["nombre", "correoAcceso"],
    ),
    async handler(u, args, ctx) {
      let responsableId = u.id;
      const respRef = str(args.responsableId);
      if (respRef) {
        const m = await resolverMiembro(u, respRef);
        if (esErrorResolucion(m)) return m;
        responsableId = m.id;
      }
      const r = await crearCliente({
        nombre: str(args.nombre),
        correoAcceso: str(args.correoAcceso),
        telefono: str(args.telefono),
        responsableId,
        origen: "manual",
        enviarInvitacion: bool(args.enviarInvitacion),
      });
      if (!r.ok) return r;
      await logAgente(
        u,
        ctx,
        "cliente_creado",
        formatearAlta(`Cliente «${r.cliente.nombre}»`, [
          { campo: "correo", valor: r.cliente.correoAcceso },
          { campo: "teléfono", valor: r.cliente.telefono },
          { campo: "responsable", valor: await nombreDe(r.cliente.responsableId) },
          { campo: "origen", valor: "manual" },
          {
            campo: "invitación",
            valor: r.cliente.invitacionEnviada ? "enviada" : "no",
          },
        ]),
        { clienteId: r.cliente.id },
      );
      return { ok: true, cliente: await compactCliente(r.cliente, u) };
    },
  },
  {
    name: "editar_cliente",
    description:
      "Edita la ficha del CLIENTE (cuenta). Incluye el dueño comercial (responsableId) y telefono. No cambia responsables de proyectos. Campos omitidos se conservan. clienteId y responsableId: nombre o id. Llama sin confirmado; la UI pide confirmación.",
    permiso: "clientes.editar",
    requiereConfirmacion: true,
    input_schema: schema(
      {
        clienteId: { type: "string" },
        nombre: { type: "string" },
        correoAcceso: { type: "string" },
        telefono: { type: "string" },
        responsableId: { type: "string" },
        confirmado: { type: "boolean" },
      },
      ["clienteId"],
    ),
    async handler(u, args, ctx) {
      const c = await resolverCliente(str(args.clienteId));
      if (esErrorResolucion(c)) return c;
      let responsableId = c.responsableId || u.id;
      const respRef = str(args.responsableId);
      if (respRef) {
        const m = await resolverMiembro(u, respRef);
        if (esErrorResolucion(m)) return m;
        responsableId = m.id;
      }
      const nombreNuevo = str(args.nombre, c.nombre);
      const correoNuevo = str(args.correoAcceso, c.correoAcceso);
      const telefonoNuevo = str(args.telefono, c.telefono ?? "");
      const origen = c.origen === "clientify" ? "clientify" : "manual";
      const before = snapCliente(c);
      const r = await editarCliente({
        clienteId: c.id,
        nombre: nombreNuevo,
        correoAcceso: correoNuevo,
        telefono: telefonoNuevo,
        responsableId,
        tipoCuenta: c.tipoCuenta,
        origen,
      });
      if (!r.ok) return r;
      const [respAntes, respDespues] = await Promise.all([
        nombreDe(c.responsableId),
        nombreDe(responsableId),
      ]);
      await logAgente(
        u,
        ctx,
        "cliente_editado",
        formatearCambios(`Cliente «${nombreNuevo.trim() || c.nombre}»`, [
          { campo: "nombre", de: c.nombre, a: nombreNuevo.trim() },
          { campo: "correo", de: c.correoAcceso, a: correoNuevo.trim().toLowerCase() },
          { campo: "teléfono", de: c.telefono, a: telefonoNuevo },
          { campo: "responsable", de: respAntes, a: respDespues },
        ]),
        { clienteId: c.id },
      );
      const actualizado = await resolverCliente(c.id);
      if (esErrorResolucion(actualizado)) return { ok: true };
      await registrarDeshacerAgente(u, ctx, {
        tipo: "cliente_editado",
        etiqueta: `Cliente «${actualizado.nombre}»`,
        entidadTipo: "cliente",
        entidadId: c.id,
        before,
        after: snapCliente(actualizado),
      });
      return { ok: true, cliente: await compactCliente(actualizado, u) };
    },
  },
  {
    name: "enviar_invitacion_cliente",
    description:
      "Marca invitación enviada al cliente (nombre o id). Simulada. Llama sin confirmado; la UI pide confirmación.",
    permiso: "clientes.editar",
    requiereConfirmacion: true,
    input_schema: schema(
      { clienteId: { type: "string" }, confirmado: { type: "boolean" } },
      ["clienteId"],
    ),
    async handler(u, args, ctx) {
      const c = await resolverCliente(str(args.clienteId));
      if (esErrorResolucion(c)) return c;
      const r = await enviarInvitacion(c.id);
      if (r.ok) {
        await logAgente(
          u,
          ctx,
          "cliente_invitacion",
          `Invitación enviada a «${c.nombre}» (${c.correoAcceso ?? "—"})`,
          { clienteId: c.id },
        );
      }
      return r;
    },
  },
  {
    name: "eliminar_cliente",
    description:
      "Elimina un cliente (nombre o id) y TODOS sus proyectos (como la UI). Va a la papelera (/eliminados) ~30 días para restaurar. Dos turnos: primero requiere_confirmacion (avisa cuántos proyectos se borran); solo tras «sí»/«yes» en un mensaje nuevo usa confirmado=true. «borra X» no basta. No existe desasociar: hay que borrar en cascada. Chats de comunicaciones ligados al cliente no se restauran.",
    permiso: "clientes.editar",
    requiereConfirmacion: true,
    input_schema: schema(
      { clienteId: { type: "string" }, confirmado: { type: "boolean" } },
      ["clienteId"],
    ),
    async handler(u, args, ctx) {
      const c = await resolverCliente(str(args.clienteId));
      if (esErrorResolucion(c)) return c;
      const proyectos = await proyectosDe(c.id);
      await borrarEventosCalendarDeProyectos(
        proyectos.map((p) => p.id),
        u.correo,
      );
      const r = await eliminarCliente(c.id, { id: u.id, correo: u.correo });
      if (!r.ok) return r;
      await logAgente(
        u,
        ctx,
        "cliente_eliminado",
        formatearAlta(`Cliente «${c.nombre}» eliminado`, [
          { campo: "correo", valor: c.correoAcceso },
          { campo: "proyectos borrados", valor: r.proyectosBorrados },
        ]),
        {
          clienteId: c.id,
          numProyectos: r.proyectosBorrados,
          eliminacionId: r.eliminacionId,
        },
      );
      await registrarDeshacerAgente(u, ctx, {
        tipo: "eliminacion",
        etiqueta: `Eliminar cliente «${c.nombre}»`,
        entidadTipo: "cliente",
        entidadId: c.id,
        before: { eliminacionId: r.eliminacionId },
        eliminacionId: r.eliminacionId,
      });
      return {
        ok: true,
        proyectosBorrados: r.proyectosBorrados,
        eliminacionId: r.eliminacionId,
        sePuedeRestaurar: true,
        retencionDias: DIAS_RETENCION_PAPELERA,
      };
    },
  },
  {
    name: "buscar_proyectos",
    description:
      "Lista/busca proyectos visibles por nombre, etiqueta (Cliente · tipo), cliente o tipo (SEO, Web, Ads…). Devuelve { total, mostradas, truncado, proyectos }. Query vacío = listar. estado: activo (default, como /proyectos)|terminado|archivado|todos. «Mis proyectos activos» → estado=activo (o default). Si el usuario nombra solo un tipo («abre el proyecto SEO») usa esta tool, no obtener_proyecto; si hay varios, devuélvelos todos. Cada ítem trae url. En la respuesta: tabla con TODAS las filas de proyectos; el número anunciado = total (o «mostrando X de Y» si truncado). verTodo=true solo admin.",
    permiso: "proyectos.ver",
    input_schema: schema({
      query: { type: "string" },
      clienteId: { type: "string" },
      estado: {
        type: "string",
        enum: ["activo", "terminado", "archivado", "todos"],
      },
      verTodo: { type: "boolean" },
    }),
    async handler(u, args) {
      const q = str(args.query);
      const clienteRef = str(args.clienteId);
      const estadoRaw = str(args.estado).toLowerCase();
      const estado =
        estadoRaw === "terminado" ||
        estadoRaw === "archivado" ||
        estadoRaw === "todos" ||
        estadoRaw === "activo"
          ? estadoRaw
          : "activo";
      const verTodo = bool(args.verTodo) && u.esAdmin;
      let lista = await nombrarProyectos(await proyectosVisibles(u, verTodo));
      if (estado !== "todos") {
        lista = lista.filter((p) => p.estado === estado);
      }
      if (clienteRef) {
        const cliente = await resolverCliente(clienteRef);
        if (esErrorResolucion(cliente)) return cliente;
        lista = lista.filter((p) => p.clienteId === cliente.id);
      }
      if (q) {
        lista = lista.filter(
          (p) =>
            matchNombre(q, p.etiqueta) ||
            matchNombre(q, p.nombre ?? "") ||
            matchNombre(q, p.clienteNombre ?? "") ||
            matchNombre(q, p.tipoNombre ?? "") ||
            p.id === q,
        );
      }
      const nombres = await mapaNombres(u);
      return listaConClave(
        lista.map((p) => compactProyecto(p, nombres, u.id)),
        40,
        "proyectos",
      );
    },
  },
  {
    name: "obtener_proyecto",
    description:
      "Detalle de UN proyecto por nombre/etiqueta o id. No uses si solo nombran un tipo (SEO, Web…) o puede haber homónimos: usa buscar_proyectos y, si hay varios, lista/pregunta; no elijas uno. El resultado incluye url para enlace Markdown.",
    permiso: "proyectos.ver",
    input_schema: schema({ proyectoId: { type: "string" } }, ["proyectoId"]),
    async handler(u, args) {
      const p = await exigirProyecto(u, str(args.proyectoId));
      if (esErrorResolucion(p)) return p;
      return compactProyecto(p, await mapaNombres(u), u.id);
    },
  },
  {
    name: "crear_proyecto",
    description:
      "Crea un proyecto. «proyecto {Tipo} para {Cliente}» = externo + tipoId + clienteId; nombre propio opcional. ambito y responsableId opcionales (default: externo si hay cliente, si no interno; lead = usuario actual). Interno solo si lo piden o no hay cliente (nombre obligatorio). clienteId/tipoId/responsableId/colaboradorIds: nombre o id. Llama sin confirmado; la UI pide confirmación.",
    permiso: "proyectos.editar",
    requiereConfirmacion: true,
    input_schema: schema({
      ambito: { type: "string", enum: ["interno", "externo"] },
      clienteId: { type: "string" },
      nombre: { type: "string" },
      tipoId: { type: "string" },
      feeMensual: { type: "string" },
      finContrato: { type: "string" },
      responsableId: { type: "string" },
      prioridad: { type: "string" },
      colaboradorIds: { type: "array", items: { type: "string" } },
      confirmado: { type: "boolean" },
    }),
    async handler(u, args, ctx) {
      let clienteId = "";
      let clienteNombre: string | null = null;
      const clienteRef = str(args.clienteId);
      if (clienteRef) {
        const c = await resolverCliente(clienteRef);
        if (esErrorResolucion(c)) return c;
        clienteId = c.id;
        clienteNombre = c.nombre;
      }
      const ambitoExplicit = str(args.ambito);
      const ambito =
        ambitoExplicit === "interno" || ambitoExplicit === "externo"
          ? ambitoExplicit
          : clienteId
            ? "externo"
            : "interno";
      let tipoId = str(args.tipoId);
      let tipoNombre: string | null = null;
      if (tipoId) {
        const tipo = await resolverTipo(tipoId);
        if (esErrorResolucion(tipo)) return tipo;
        tipoId = tipo.id;
        tipoNombre = tipo.nombre;
      }
      let responsableId = u.id;
      const respRef = str(args.responsableId);
      if (respRef) {
        const resp = await resolverMiembro(u, respRef);
        if (esErrorResolucion(resp)) return resp;
        responsableId = resp.id;
      }
      const colsRef = strArr(args.colaboradorIds);
      let colaboradorIds: string[] = [];
      if (colsRef.length) {
        const cols = await resolverMiembros(u, colsRef);
        if (esErrorResolucion(cols)) return cols;
        colaboradorIds = cols.map((m) => m.id);
      }
      const r = await crearProyecto({
        ambito,
        clienteId,
        nombre: str(args.nombre),
        tipoId,
        feeMensual: str(args.feeMensual, "0"),
        finContrato: str(args.finContrato),
        responsableId,
        prioridad: str(args.prioridad, "media"),
        colaboradorIds,
      });
      if (!r.ok) return r;
      const [nombrado] = await nombrarProyectos([r.proyecto]);
      if (!nombrado) return { error: "no_encontrado" };
      const titulo =
        r.proyecto.nombre?.trim() || tipoNombre || (ambito === "interno" ? "Proyecto interno" : "Proyecto");
      await logAgente(
        u,
        ctx,
        "proyecto_creado",
        formatearAlta(
          ambito === "externo"
            ? `Proyecto externo «${titulo}» · cliente «${clienteNombre ?? "cliente"}»`
            : `Proyecto interno «${titulo}»`,
          [
            { campo: "nombre", valor: r.proyecto.nombre },
            { campo: "tipo", valor: tipoNombre },
            { campo: "prioridad", valor: r.proyecto.prioridad },
            { campo: "responsable", valor: await nombreDe(responsableId) },
          ],
        ),
        { proyectoId: r.proyecto.id, ambito, clienteId: clienteId || null },
      );
      return { ok: true, proyecto: compactProyecto(nombrado, await mapaNombres(u), u.id) };
    },
  },
  {
    name: "editar_proyecto",
    description:
      "Parchea un PROYECTO (no la ficha del cliente). Solo envía campos a cambiar; el resto se conserva. responsableId = lead del proyecto, no dueño de cuenta. proyectoId/clienteId/tipoId/responsableId/colaboradorIds: nombre o id. Llama sin confirmado; la UI pide confirmación.",
    permiso: "proyectos.editar",
    requiereConfirmacion: true,
    input_schema: schema(
      {
        proyectoId: { type: "string" },
        ambito: { type: "string", enum: ["interno", "externo"] },
        clienteId: { type: "string" },
        nombre: { type: "string" },
        tipoId: { type: "string" },
        feeMensual: { type: "string" },
        finContrato: { type: "string" },
        responsableId: { type: "string" },
        prioridad: { type: "string" },
        colaboradorIds: { type: "array", items: { type: "string" } },
        confirmado: { type: "boolean" },
      },
      ["proyectoId"],
    ),
    async handler(u, args, ctx) {
      const acceso = await exigirProyecto(u, str(args.proyectoId));
      if (esErrorResolucion(acceso)) return acceso;
      const ambitoExplicit = str(args.ambito);
      const ambito =
        ambitoExplicit === "interno" || ambitoExplicit === "externo"
          ? ambitoExplicit
          : acceso.ambito === "externo"
            ? "externo"
            : "interno";
      let clienteId = acceso.clienteId ?? "";
      const clienteRef = str(args.clienteId);
      if (clienteRef) {
        const c = await resolverCliente(clienteRef);
        if (esErrorResolucion(c)) return c;
        clienteId = c.id;
      }
      let tipoId = acceso.tipoId ?? "";
      const tipoRef = str(args.tipoId);
      if (tipoRef) {
        const tipo = await resolverTipo(tipoRef);
        if (esErrorResolucion(tipo)) return tipo;
        tipoId = tipo.id;
      }
      let responsableId = acceso.responsableId || u.id;
      const respRef = str(args.responsableId);
      if (respRef) {
        const resp = await resolverMiembro(u, respRef);
        if (esErrorResolucion(resp)) return resp;
        responsableId = resp.id;
      }
      const colsRef = strArr(args.colaboradorIds);
      let colaboradorIds = acceso.colaboradorIds;
      if (colsRef.length) {
        const cols = await resolverMiembros(u, colsRef);
        if (esErrorResolucion(cols)) return cols;
        colaboradorIds = cols.map((m) => m.id);
      }
      const nombreNuevo = str(args.nombre, acceso.nombre ?? "");
      const feeNuevo = str(args.feeMensual, String(acceso.feeMensual ?? 0));
      const finNuevo = str(args.finContrato, acceso.finContrato ?? "");
      const prioridadNueva = str(args.prioridad, acceso.prioridad);
      const r = await editarProyecto({
        proyectoId: acceso.id,
        ambito,
        clienteId,
        nombre: nombreNuevo,
        tipoId,
        feeMensual: feeNuevo,
        finContrato: finNuevo,
        responsableId,
        prioridad: prioridadNueva,
        colaboradorIds,
      });
      if (!r.ok) return r;
      const tituloLog =
        nombreNuevo.trim() || acceso.nombre || acceso.etiqueta || acceso.id.slice(0, 8);
      await logAgente(
        u,
        ctx,
        "proyecto_editado",
        formatearCambios(
          ambito === "externo"
            ? `Proyecto «${tituloLog}»`
            : `Proyecto interno «${tituloLog}»`,
          [
            { campo: "nombre", de: acceso.nombre, a: nombreNuevo.trim() || null },
            { campo: "prioridad", de: acceso.prioridad, a: prioridadNueva },
            { campo: "oportunidad", de: acceso.feeMensual, a: feeNuevo },
            { campo: "fin contrato", de: acceso.finContrato, a: finNuevo || null },
            {
              campo: "responsable",
              de: await nombreDe(acceso.responsableId),
              a: await nombreDe(responsableId),
            },
          ],
        ),
        { proyectoId: acceso.id, ambito, clienteId: clienteId || null },
      );
      return r;
    },
  },
  {
    name: "cambiar_estado_proyecto",
    description:
      "Cambia estado: activo | terminado | archivado. proyectoId: nombre o id. Llama sin confirmado; la UI pide confirmación.",
    permiso: "proyectos.editar",
    requiereConfirmacion: true,
    input_schema: schema(
      {
        proyectoId: { type: "string" },
        estado: { type: "string", enum: ["activo", "terminado", "archivado"] },
        confirmado: { type: "boolean" },
      },
      ["proyectoId", "estado"],
    ),
    async handler(u, args, ctx) {
      const acceso = await exigirProyecto(u, str(args.proyectoId));
      if (esErrorResolucion(acceso)) return acceso;
      const estado = str(args.estado) as EstadoProyecto;
      const r = await cambiarEstadoProyecto(acceso.id, estado);
      if (!r.ok) return r;
      const accion =
        estado === "terminado"
          ? "proyecto_terminado"
          : estado === "archivado"
            ? "proyecto_archivado"
            : "proyecto_reactivado";
      const tituloEstado =
        acceso.etiqueta || acceso.nombre || acceso.id.slice(0, 8);
      await logAgente(
        u,
        ctx,
        accion,
        formatearCambios(
          acceso.ambito === "externo"
            ? `Proyecto «${tituloEstado}»`
            : `Proyecto interno (${acceso.nombre || acceso.id.slice(0, 8)})`,
          [{ campo: "estado", de: acceso.estado, a: estado }],
        ),
        { proyectoId: acceso.id, clienteId: acceso.clienteId ?? null },
      );
      await registrarDeshacerAgente(u, ctx, {
        tipo: "proyecto_estado",
        etiqueta: `Estado «${tituloEstado}»: ${acceso.estado} → ${estado}`,
        entidadTipo: "proyecto",
        entidadId: acceso.id,
        before: snapProyectoEstado(acceso.estado),
        after: snapProyectoEstado(estado),
      });
      return r;
    },
  },
  {
    name: "eliminar_proyecto",
    description:
      "Elimina un proyecto (nombre o id) y su tablero/tareas. Va a la papelera (/eliminados) ~30 días para restaurar. Dos turnos: primero requiere_confirmacion; solo tras «sí»/«yes» en un mensaje nuevo usa confirmado=true.",
    permiso: "proyectos.editar",
    requiereConfirmacion: true,
    input_schema: schema(
      { proyectoId: { type: "string" }, confirmado: { type: "boolean" } },
      ["proyectoId"],
    ),
    async handler(u, args, ctx) {
      const acceso = await exigirProyecto(u, str(args.proyectoId));
      if (esErrorResolucion(acceso)) return acceso;
      await borrarEventosCalendarDeProyectos([acceso.id], u.correo);
      const r = await eliminarProyecto(acceso.id, { id: u.id, correo: u.correo });
      if (!r.ok) return r;
      const titulo = acceso.etiqueta || acceso.nombre || acceso.id.slice(0, 8);
      await logAgente(
        u,
        ctx,
        "proyecto_eliminado",
        formatearAlta(
          acceso.ambito === "externo"
            ? `Proyecto «${titulo}» eliminado`
            : `Proyecto interno «${titulo}» eliminado`,
          [{ campo: "estado", valor: acceso.estado }],
        ),
        {
          proyectoId: acceso.id,
          clienteId: acceso.clienteId ?? null,
          eliminacionId: r.eliminacionId,
        },
      );
      await registrarDeshacerAgente(u, ctx, {
        tipo: "eliminacion",
        etiqueta: `Eliminar proyecto «${titulo}»`,
        entidadTipo: "proyecto",
        entidadId: acceso.id,
        before: { eliminacionId: r.eliminacionId },
        eliminacionId: r.eliminacionId,
      });
      return {
        ok: true,
        eliminacionId: r.eliminacionId,
        sePuedeRestaurar: true,
        retencionDias: DIAS_RETENCION_PAPELERA,
      };
    },
  },
  {
    name: "listar_tipos_proyecto",
    description: "Lista tipos de proyecto activos (solo lectura; alta/renombre en la UI).",
    permiso: "proyectos.ver",
    input_schema: schema({}),
    async handler() {
      return listarTiposProyecto();
    },
  },
  {
    name: "listar_notas_cliente",
    description:
      "Lista notas del cliente (ficha, no tarea). clienteId: nombre o id. Solo lectura.",
    permiso: "clientes.ver",
    input_schema: schema({ clienteId: { type: "string" } }, ["clienteId"]),
    async handler(u, args) {
      const c = await resolverCliente(str(args.clienteId));
      if (esErrorResolucion(c)) return c;
      const notas = await listarNotasCliente(c.id);
      return notas.slice(0, 40).map((n) => ({
        id: n.id,
        texto: n.texto.slice(0, 800),
        autor: { nombre: n.autorNombre, eresTu: n.autorId === u.id },
        creadoEn: n.creadoEn.toISOString(),
        actualizadoEn: n.actualizadoEn.toISOString(),
      }));
    },
  },
  {
    name: "listar_notas_proyecto",
    description:
      "Lista notas del proyecto (ficha, no tarea). proyectoId: nombre/etiqueta o id. Solo lectura.",
    permiso: "proyectos.ver",
    input_schema: schema({ proyectoId: { type: "string" } }, ["proyectoId"]),
    async handler(u, args) {
      const acceso = await exigirProyecto(u, str(args.proyectoId));
      if (esErrorResolucion(acceso)) return acceso;
      const notas = await listarNotasProyecto(acceso.id);
      return notas.slice(0, 40).map((n) => ({
        id: n.id,
        texto: n.texto.slice(0, 800),
        autor: { nombre: n.autorNombre, eresTu: n.autorId === u.id },
        creadoEn: n.creadoEn.toISOString(),
        actualizadoEn: n.actualizadoEn.toISOString(),
      }));
    },
  },
  {
    name: "listar_tareas",
    description:
      "Lista tareas (slim; detalle → obtener_tarea). Devuelve { total, mostradas, truncado, tareas }. Alcance: proyectoId y/o query y/o responsableId y/o atrasadas=true y/o vencenDesde/vencenAntes y/o filtros de creación. «Mis atrasadas» → preferir listar_mis_tareas con atrasadas=true. «Tareas de Miguel» → responsableId=Miguel. soloCreadasPorMi=true = mandadaPor eres tú. orden=creado_desc|creado_asc; limite 1–40. Por defecto solo abiertas (excluye Terminadas y Rechazadas / eliminadas). «¿Cuántas?» → total. En la respuesta al usuario: tabla con TODAS las filas de tareas (no solo un subconjunto).",
    permiso: "tareas.ver",
    input_schema: schema({
      proyectoId: { type: "string" },
      query: { type: "string" },
      atrasadas: { type: "boolean" },
      vencenDesde: { type: "string" },
      vencenAntes: { type: "string" },
      responsableId: { type: "string" },
      creadasDesde: { type: "string" },
      creadasHasta: { type: "string" },
      soloCreadasPorMi: { type: "boolean" },
      orden: { type: "string" },
      limite: { type: "number" },
      incluirCompletadas: { type: "boolean" },
    }),
    async handler(u, args) {
      const zona = parseZona(u.timezone);
      const hoy = toYmd(new Date(), zona);
      const proyectoRef = str(args.proyectoId);
      const query = str(args.query);
      const responsableRef = str(args.responsableId);
      const creadasDesde = str(args.creadasDesde);
      const creadasHasta = str(args.creadasHasta);
      const soloCreadasPorMi = bool(args.soloCreadasPorMi);
      const filtroCreacion = Boolean(creadasDesde || creadasHasta || soloCreadasPorMi);
      const filtroPlazo =
        bool(args.atrasadas) || Boolean(str(args.vencenDesde) || str(args.vencenAntes));
      if (!proyectoRef && !query && !responsableRef && !filtroCreacion && !filtroPlazo) {
        return {
          error: "falta_dato",
          campo:
            "proyectoId|query|responsableId|atrasadas|vencenDesde|vencenAntes|creadasDesde|creadasHasta|soloCreadasPorMi",
          mensaje:
            "Indica proyectoId, query, responsableId, atrasadas/vencen… o un filtro de creación.",
        };
      }
      const incluirCompletadas =
        args.incluirCompletadas !== undefined
          ? bool(args.incluirCompletadas)
          : filtroCreacion;
      const orden = ordenCreadoDe(args);
      const limite = parseLimite(args.limite, 40, 40);
      let responsableFiltro: string | null = null;
      if (responsableRef) {
        const m = await resolverMiembro(u, responsableRef);
        if (esErrorResolucion(m)) return m;
        responsableFiltro = m.id;
      }
      const nombres = await mapaNombres(u);
      const out: ReturnType<typeof compactTareaLista>[] = [];
      const seen = new Set<string>();
      const filtroC = {
        creadasDesde,
        creadasHasta,
        soloCreadasPorMi,
        yoId: u.id,
        timeZone: zona,
      };

      const pushDe = async (
        tareas: Tarea[],
        meta: {
          proyectoEtiqueta?: string;
          clienteNombre?: string | null;
          colPorId?: Map<string, { fija: boolean; nombre: string }>;
        },
      ) => {
        for (const t of tareas) {
          if (seen.has(t.id)) continue;
          const col = meta.colPorId?.get(t.columnaId);
          // Rechazadas never list outside the board (same as /tareas).
          if (col?.fija && col.nombre.startsWith("Rechazadas")) continue;
          if (!incluirCompletadas && (t.completadaEl || esColumnaCerrada(col))) continue;
          if (query && !textoParecido(query, t.nombre)) continue;
          if (!pasaFiltroCreacion(t, filtroC)) continue;
          const max = t.fechaMaxima;
          if (bool(args.atrasadas) && !(max && max < hoy)) continue;
          const desde = str(args.vencenDesde);
          const antes = str(args.vencenAntes);
          if (desde && !(max && max >= desde)) continue;
          if (antes && !(max && max <= antes)) continue;
          if (responsableFiltro && !t.responsableIds.includes(responsableFiltro)) continue;
          seen.add(t.id);
          out.push(
            compactTareaLista(t, nombres, u.id, {
              proyectoEtiqueta: meta.proyectoEtiqueta,
              clienteNombre: meta.clienteNombre,
              columnaNombre: col?.nombre ?? null,
            }),
          );
        }
      };

      if (proyectoRef) {
        const acceso = await exigirProyecto(u, proyectoRef);
        if (esErrorResolucion(acceso)) return acceso;
        const cols = await columnasDe(acceso.id);
        await pushDe(await tareasDe(acceso.id), {
          proyectoEtiqueta: acceso.etiqueta,
          clienteNombre: acceso.clienteNombre,
          colPorId: new Map(cols.map((c) => [c.id, c])),
        });
      } else {
        const proyectos = await nombrarProyectos(await proyectosVisibles(u));
        for (const p of proyectos) {
          const cols = await columnasDe(p.id);
          await pushDe(await tareasDe(p.id), {
            proyectoEtiqueta: p.etiqueta,
            clienteNombre: p.clienteNombre,
            colPorId: new Map(cols.map((c) => [c.id, c])),
          });
        }
        for (const t of await tareasDelUsuario(u.id)) {
          if (seen.has(t.id)) continue;
          if (!incluirCompletadas && t.completadaEl) continue;
          if (query && !textoParecido(query, t.nombre)) continue;
          if (!pasaFiltroCreacion(t, filtroC)) continue;
          const max = t.fechaMaxima;
          if (bool(args.atrasadas) && !(max && max < hoy)) continue;
          const desde = str(args.vencenDesde);
          const antes = str(args.vencenAntes);
          if (desde && !(max && max >= desde)) continue;
          if (antes && !(max && max <= antes)) continue;
          if (responsableFiltro && !t.responsableIds.includes(responsableFiltro)) continue;
          seen.add(t.id);
          out.push(
            compactTareaLista(t, nombres, u.id, {
              proyectoEtiqueta: t.proyectoEtiqueta,
              clienteNombre: t.clienteNombre,
            }),
          );
        }
      }

      return listaConTotal(ordenarPorCreadoEl(out, orden), limite);
    },
  },
  {
    name: "listar_mis_tareas",
    description:
      "Lista las tareas del usuario (como /tareas): asignadas, mandadas por él o Personal. Devuelve { total, mostradas, truncado, tareas }. «Mis atrasadas» / «show me my overdue» → atrasadas=true (sin más filtros). «Todas» / «el resto» → misma tool, sube limite si truncado; tabla con TODAS las filas devueltas, no resumas un subconjunto. «Últimas N que creé hoy» → creadasDesde=creadasHasta=hoy, soloCreadasPorMi=true, orden=creado_desc, limite=N. Por defecto solo abiertas. «¿Cuántas son mías?» → total.",
    permiso: "tareas.ver",
    input_schema: schema({
      incluirCompletadas: { type: "boolean" },
      atrasadas: { type: "boolean" },
      soloPersonales: { type: "boolean" },
      creadasDesde: { type: "string" },
      creadasHasta: { type: "string" },
      soloCreadasPorMi: { type: "boolean" },
      orden: { type: "string" },
      limite: { type: "number" },
    }),
    async handler(u, args) {
      const zona = parseZona(u.timezone);
      const hoy = toYmd(new Date(), zona);
      const creadasDesde = str(args.creadasDesde);
      const creadasHasta = str(args.creadasHasta);
      const soloCreadasPorMi = bool(args.soloCreadasPorMi);
      const filtroCreacion = Boolean(creadasDesde || creadasHasta || soloCreadasPorMi);
      const incluirCompletadas =
        args.incluirCompletadas !== undefined
          ? bool(args.incluirCompletadas)
          : filtroCreacion;
      const soloPersonales = bool(args.soloPersonales);
      const orden = ordenCreadoDe(args);
      const limite = parseLimite(args.limite, 80, 80);
      const nombres = await mapaNombres(u);
      const tareas = await tareasDelUsuario(u.id);
      const out = [];
      for (const t of tareas) {
        if (!incluirCompletadas && t.completadaEl) continue;
        if (soloPersonales && !t.esPersonal) continue;
        if (
          !pasaFiltroCreacion(t, {
            creadasDesde,
            creadasHasta,
            soloCreadasPorMi,
            yoId: u.id,
            timeZone: zona,
          })
        ) {
          continue;
        }
        const max = t.fechaMaxima;
        if (bool(args.atrasadas) && !(max && max < hoy)) continue;
        out.push({
          ...compactTareaLista(t, nombres, u.id, {
            proyectoEtiqueta: t.proyectoEtiqueta,
            clienteNombre: t.clienteNombre,
          }),
          esPersonal: t.esPersonal,
        });
      }
      return listaConTotal(ordenarPorCreadoEl(out, orden), limite);
    },
  },
  {
    name: "obtener_tarea",
    description: "Detalle de una tarea por nombre o id.",
    permiso: "tareas.ver",
    input_schema: schema({ tareaId: { type: "string" } }, ["tareaId"]),
    async handler(u, args) {
      const t = await exigirTareaEnProyecto(u, str(args.tareaId));
      if (esErrorResolucion(t)) return t;
      return compactDesdeTarea(u, t);
    },
  },
  {
    name: "crear_tarea",
    description:
      "Crea una tarea. proyectoId, columnaId y responsables: nombre o id. syncCalendar=true requiere fechaMaxima. Llama sin confirmado; la UI pide confirmación.",
    permiso: "tareas.editar",
    requiereConfirmacion: true,
    input_schema: schema(
      {
        proyectoId: { type: "string" },
        nombre: { type: "string" },
        columnaId: { type: "string" },
        fechaPrevista: { type: "string" },
        fechaMaxima: { type: "string" },
        syncCalendar: { type: "boolean" },
        responsableIds: { type: "array", items: { type: "string" } },
        colaboradorIds: { type: "array", items: { type: "string" } },
        prioridad: { type: "string" },
        confirmado: { type: "boolean" },
      },
      ["proyectoId", "nombre"],
    ),
    async handler(u, args, ctx) {
      const acceso = await exigirProyecto(u, str(args.proyectoId));
      if (esErrorResolucion(acceso)) return acceso;
      let columnaId: string | undefined;
      const colRef = str(args.columnaId);
      if (colRef) {
        const col = await resolverColumna(acceso.id, colRef);
        if (esErrorResolucion(col)) return col;
        columnaId = col.id;
      }
      const respRef = strArr(args.responsableIds);
      let responsableIds: string[] = [];
      if (respRef.length) {
        const ms = await resolverMiembros(u, respRef);
        if (esErrorResolucion(ms)) return ms;
        responsableIds = ms.map((m) => m.id);
      }
      const colabRef = strArr(args.colaboradorIds);
      let colaboradorIds = acceso.colaboradorIds;
      if (colabRef.length) {
        const ms = await resolverMiembros(u, colabRef);
        if (esErrorResolucion(ms)) return ms;
        colaboradorIds = ms.map((m) => m.id);
      }
      const r = await crearTarea({
        proyectoId: acceso.id,
        nombre: str(args.nombre),
        columnaId,
        fechaPrevista: str(args.fechaPrevista) || undefined,
        fechaMaxima: str(args.fechaMaxima) || undefined,
        syncCalendar: bool(args.syncCalendar),
        responsableIds,
        colaboradorIds,
        mandadaPorId: u.id,
        prioridad: prioridadDe(args.prioridad),
      });
      if (!r.ok) return r;
      await logAgente(
        u,
        ctx,
        "tarea_creada",
        formatearAlta(`Tarea «${r.tarea.nombre}»`, [
          { campo: "prioridad", valor: r.tarea.prioridad },
          { campo: "fecha máxima", valor: r.tarea.fechaMaxima },
          { campo: "fecha prevista", valor: r.tarea.fechaPrevista },
          { campo: "calendar", valor: r.tarea.syncCalendar ? "sí" : "no" },
        ]),
        { tareaId: r.tarea.id, proyectoId: acceso.id },
      );
      const calendarOk = await sincronizarTareaConCalendar(r.tarea, u.correo);
      return {
        ok: true,
        tarea: await compactDesdeTarea(u, r.tarea, acceso),
        calendarFallo: !calendarOk,
      };
    },
  },
  {
    name: "editar_tarea",
    description:
      "Edita datos de una tarea (fechas, sync Calendar, prioridad, etc.). tareaId y mandadaPorId: nombre o id. Llama sin confirmado; la UI pide confirmación.",
    permiso: "tareas.editar",
    requiereConfirmacion: true,
    input_schema: schema(
      {
        tareaId: { type: "string" },
        nombre: { type: "string" },
        fechaPrevista: { type: "string" },
        fechaMaxima: { type: "string" },
        syncCalendar: { type: "boolean" },
        mandadaPorId: { type: "string" },
        prioridad: { type: "string" },
        confirmado: { type: "boolean" },
      },
      ["tareaId"],
    ),
    async handler(u, args, ctx) {
      const t = await exigirTareaEnProyecto(u, str(args.tareaId));
      if (esErrorResolucion(t)) return t;
      let mandadaPorId = t.mandadaPorId ?? "";
      const mandadaRef = str(args.mandadaPorId);
      if (mandadaRef) {
        const m = await resolverMiembro(u, mandadaRef);
        if (esErrorResolucion(m)) return m;
        mandadaPorId = m.id;
      }
      const nombreNuevo = str(args.nombre, t.nombre);
      const fechaPrevista = str(args.fechaPrevista, t.fechaPrevista ?? "");
      const fechaMaxima = str(args.fechaMaxima, t.fechaMaxima ?? "");
      const syncCalendar =
        args.syncCalendar === undefined ? t.syncCalendar : bool(args.syncCalendar);
      const prioridad = prioridadDe(args.prioridad ?? t.prioridad);
      const r = await editarTarea({
        tareaId: t.id,
        nombre: nombreNuevo,
        fechaPrevista,
        fechaMaxima,
        syncCalendar,
        notificarAsignado: t.notificarAsignado,
        mandadaPorId,
        prioridad,
        dificultad: t.dificultad,
      });
      if (!r.ok) return r;
      await logAgente(
        u,
        ctx,
        "tarea_editada",
        formatearCambios(`Tarea «${r.tarea.nombre}»`, [
          { campo: "nombre", de: t.nombre, a: nombreNuevo.trim() },
          { campo: "prioridad", de: t.prioridad, a: r.tarea.prioridad },
          { campo: "fecha prevista", de: t.fechaPrevista, a: r.tarea.fechaPrevista },
          { campo: "fecha máxima", de: t.fechaMaxima, a: r.tarea.fechaMaxima },
          { campo: "calendar", de: t.syncCalendar, a: r.tarea.syncCalendar },
        ]),
        { tareaId: r.tarea.id, proyectoId: r.tarea.proyectoId },
      );
      await registrarDeshacerAgente(u, ctx, {
        tipo: "tarea_editada",
        etiqueta: `Editar «${r.tarea.nombre}»`,
        entidadTipo: "tarea",
        entidadId: r.tarea.id,
        before: snapTareaEdit(t),
        after: snapTareaEdit(r.tarea),
      });
      const calendarOk = await sincronizarTareaConCalendar(r.tarea, u.correo);
      return {
        ok: true,
        tarea: await compactDesdeTarea(u, r.tarea),
        calendarFallo: !calendarOk,
      };
    },
  },
  {
    name: "mover_tarea",
    description:
      "Mueve una tarea a otra columna (nombre o id) y opcionalmente posición. Llama sin confirmado; la UI pide confirmación.",
    permiso: "tareas.editar",
    requiereConfirmacion: true,
    input_schema: schema(
      {
        tareaId: { type: "string" },
        columnaId: { type: "string" },
        indice: { type: "number" },
        confirmado: { type: "boolean" },
      },
      ["tareaId", "columnaId"],
    ),
    async handler(u, args, ctx) {
      const t = await exigirTareaEnProyecto(u, str(args.tareaId));
      if (esErrorResolucion(t)) return t;
      const col = await resolverColumna(t.proyectoId, str(args.columnaId));
      if (esErrorResolucion(col)) return col;
      const indice =
        typeof args.indice === "number" && Number.isFinite(args.indice)
          ? Math.max(0, Math.floor(args.indice))
          : 0;
      const r = await moverTarea(t.id, col.id, indice);
      if (r.ok) {
        await logAgente(u, ctx, "tarea_movida", `${r.tarea.nombre} → columna ${col.nombre}`, {
          tareaId: t.id,
          columnaId: col.id,
          proyectoId: r.tarea.proyectoId,
        });
        await registrarDeshacerAgente(u, ctx, {
          tipo: "tarea_movida",
          etiqueta: `Mover «${r.tarea.nombre}» → ${col.nombre}`,
          entidadTipo: "tarea",
          entidadId: t.id,
          before: snapTareaPosicion(t),
          after: snapTareaPosicion(r.tarea),
        });
      }
      return r;
    },
  },
  {
    name: "alternar_completada_tarea",
    description:
      "Marca una tarea como completada o la reabre (mismo toggle que en la UI: Terminadas ↔ Por hacer). Llama sin confirmado; la UI pide confirmación.",
    permiso: "tareas.editar",
    requiereConfirmacion: true,
    input_schema: schema(
      { tareaId: { type: "string" }, confirmado: { type: "boolean" } },
      ["tareaId"],
    ),
    async handler(u, args, ctx) {
      const t = await resolverTarea(u, str(args.tareaId));
      if (esErrorResolucion(t)) return t;
      if (!(await puedeAccederTarea(t.id, u.id, u.esAdmin))) {
        return { error: "sin_acceso" };
      }
      const r = await alternarCompletadaTarea(t.id);
      if (!r.ok) return r;
      await logAgente(
        u,
        ctx,
        r.tarea.completadaEl ? "tarea_completada" : "tarea_reabierta",
        formatearAlta(`Tarea «${r.tarea.nombre}»`, [
          { campo: "estado", valor: r.tarea.completadaEl ? "completada" : "abierta" },
        ]),
        { tareaId: r.tarea.id, proyectoId: r.tarea.proyectoId },
      );
      await registrarDeshacerAgente(u, ctx, {
        tipo: "tarea_completada",
        etiqueta: r.tarea.completadaEl
          ? `Completar «${r.tarea.nombre}»`
          : `Reabrir «${r.tarea.nombre}»`,
        entidadTipo: "tarea",
        entidadId: t.id,
        before: snapTareaPosicion(t),
        after: snapTareaPosicion(r.tarea),
      });
      return {
        ok: true,
        completada: Boolean(r.tarea.completadaEl),
        tarea: await compactDesdeTarea(u, r.tarea),
      };
    },
  },
  {
    name: "asignar_responsables_tarea",
    description:
      "Asigna responsables de una tarea. tareaId y responsableIds: nombre o id. Llama sin confirmado; la UI pide confirmación.",
    permiso: "tareas.editar",
    requiereConfirmacion: true,
    input_schema: schema(
      {
        tareaId: { type: "string" },
        responsableIds: { type: "array", items: { type: "string" } },
        confirmado: { type: "boolean" },
      },
      ["tareaId", "responsableIds"],
    ),
    async handler(u, args, ctx) {
      const t = await exigirTareaEnProyecto(u, str(args.tareaId));
      if (esErrorResolucion(t)) return t;
      const refs = strArr(args.responsableIds);
      if (refs.length === 0) {
        return { error: "falta_dato", campo: "responsableIds" };
      }
      const ms = await resolverMiembros(u, refs);
      if (esErrorResolucion(ms)) return ms;
      const proy = await proyectoPorId(t.proyectoId);
      const bloqueo = errorSiNingunoEnEquipo(ms, proy?.colaboradorIds ?? []);
      if (bloqueo) return bloqueo;
      const r = await editarResponsablesTarea(
        t.id,
        ms.map((m) => m.id),
        proy?.colaboradorIds ?? [],
      );
      if (!r.ok) return r;
      await logAgente(
        u,
        ctx,
        "tarea_responsables",
        `${r.tarea.nombre} (${t.id})`,
        { tareaId: t.id, proyectoId: r.tarea.proyectoId },
      );
      await registrarDeshacerAgente(u, ctx, {
        tipo: "tarea_responsables",
        etiqueta: `Responsables «${r.tarea.nombre}»`,
        entidadTipo: "tarea",
        entidadId: t.id,
        before: snapTareaResponsables(t),
        after: snapTareaResponsables(r.tarea),
      });
      return { ok: true, tarea: await compactDesdeTarea(u, r.tarea) };
    },
  },
  {
    name: "guardar_notas_tarea",
    description:
      "Guarda/reemplaza las notas de una tarea. Llama sin confirmado; la UI pide confirmación.",
    permiso: "tareas.editar",
    requiereConfirmacion: true,
    input_schema: schema(
      {
        tareaId: { type: "string" },
        texto: { type: "string" },
        confirmado: { type: "boolean" },
      },
      ["tareaId", "texto"],
    ),
    async handler(u, args) {
      const t = await exigirTareaEnProyecto(u, str(args.tareaId));
      if (esErrorResolucion(t)) return t;
      const r = await guardarNotas(t.id, str(args.texto), u.id);
      if (!r.ok) return r;
      return { ok: true, tarea: await compactDesdeTarea(u, r.tarea) };
    },
  },
  {
    name: "checklist_anadir",
    description: "Añade un ítem al checklist de una tarea.",
    permiso: "tareas.editar",
    input_schema: schema(
      { tareaId: { type: "string" }, texto: { type: "string" } },
      ["tareaId", "texto"],
    ),
    async handler(u, args) {
      const t = await exigirTareaEnProyecto(u, str(args.tareaId));
      if (esErrorResolucion(t)) return t;
      return anadirChecklist(t.id, str(args.texto));
    },
  },
  {
    name: "checklist_toggle",
    description: "Alterna hecho/no hecho de un ítem de checklist (itemId: texto o id).",
    permiso: "tareas.editar",
    input_schema: schema(
      { tareaId: { type: "string" }, itemId: { type: "string" } },
      ["tareaId", "itemId"],
    ),
    async handler(u, args) {
      const t = await exigirTareaEnProyecto(u, str(args.tareaId));
      if (esErrorResolucion(t)) return t;
      const item = await resolverChecklistItem(t, str(args.itemId));
      if (esErrorResolucion(item)) return item;
      return toggleChecklist(t.id, item.id);
    },
  },
  {
    name: "listar_columnas",
    description:
      "Lista columnas (apartados) del tablero de un proyecto por nombre o id (solo lectura).",
    permiso: "tareas.ver",
    input_schema: schema({ proyectoId: { type: "string" } }, ["proyectoId"]),
    async handler(u, args) {
      const acceso = await exigirProyecto(u, str(args.proyectoId));
      if (esErrorResolucion(acceso)) return acceso;
      return columnasDe(acceso.id).then((cols) =>
        cols.map((c) => ({ id: c.id, nombre: c.nombre, orden: c.orden, fija: c.fija })),
      );
    },
  },
  {
    name: "borrar_tarea",
    description:
      "Borra tarea(s). Preferible tareaIds=[…] con todas las a borrar en UNA llamada (o tareaId para una). El servidor pide confirmación por cada tarea en el lightbox. Va a la papelera (~30 días). Llama enseguida sin confirmado. No preguntes confirmación en texto. Limpia evento Calendar si existe.",
    permiso: "tareas.editar",
    requiereConfirmacion: true,
    input_schema: schema({
      tareaId: { type: "string" },
      tareaIds: { type: "array", items: { type: "string" } },
      confirmado: { type: "boolean" },
    }),
    async handler(u, args, ctx) {
      const refs = refsBorrarTareas(args);
      if (refs.length === 0) {
        return { error: "falta_dato", campo: "tareaId|tareaIds" };
      }
      const borrados: {
        tareaId: string;
        nombre: string;
        proyectoId: string;
        eliminacionId: string;
      }[] = [];
      const fallos: { ref: string; motivo: unknown }[] = [];
      for (const ref of refs) {
        const t = await exigirTareaEnProyecto(u, ref);
        if (esErrorResolucion(t)) {
          fallos.push({ ref, motivo: t });
          continue;
        }
        if (t.calendarEventId) {
          await sincronizarTareaConCalendar(
            { ...t, syncCalendar: false, fechaMaxima: null },
            u.correo,
          );
        }
        const r = await borrarTarea(t.id, { id: u.id, correo: u.correo });
        if (!r.ok) {
          fallos.push({ ref, motivo: r });
          continue;
        }
        await logAgente(
          u,
          ctx,
          "tarea_borrada",
          formatearAlta(`Tarea «${t.nombre}» eliminada`, [
            { campo: "prioridad", valor: t.prioridad },
          ]),
          { tareaId: t.id, proyectoId: t.proyectoId, eliminacionId: r.eliminacionId },
        );
        await registrarDeshacerAgente(u, ctx, {
          tipo: "eliminacion",
          etiqueta: `Eliminar tarea «${t.nombre}»`,
          entidadTipo: "tarea",
          entidadId: t.id,
          before: { eliminacionId: r.eliminacionId },
          eliminacionId: r.eliminacionId,
        });
        borrados.push({
          tareaId: t.id,
          nombre: t.nombre,
          proyectoId: t.proyectoId,
          eliminacionId: r.eliminacionId,
        });
      }
      return {
        ok: fallos.length === 0 && borrados.length > 0,
        borrados,
        fallos,
        sePuedeRestaurar: true,
        retencionDias: DIAS_RETENCION_PAPELERA,
      };
    },
  },
  {
    name: "listar_eliminados",
    description:
      "Lista elementos en la papelera (tareas/proyectos/clientes eliminados, no expirados). Opcional filtrar por tipo. Sirve para localizar el id de restaurar_eliminado.",
    permiso: null,
    input_schema: schema({
      tipo: { type: "string", enum: ["tarea", "proyecto", "cliente"] },
    }),
    async handler(u, args) {
      const tipoRaw = str(args.tipo);
      const tipo =
        tipoRaw === "tarea" || tipoRaw === "proyecto" || tipoRaw === "cliente"
          ? (tipoRaw as TipoEliminacion)
          : undefined;
      const lista = await listarEliminaciones(u, { tipo, limite: 40 });
      return {
        retencionDias: DIAS_RETENCION_PAPELERA,
        items: lista.map((e) => ({
          id: e.id,
          tipo: e.tipo,
          etiqueta: e.etiqueta,
          entidadId: e.entidadId,
          eliminadoEn: e.eliminadoEn,
          expiraEn: e.expiraEn,
          actorCorreo: e.actorCorreo,
        })),
      };
    },
  },
  {
    name: "restaurar_eliminado",
    description:
      "Restaura uno o varios ítems de la papelera (ids de listar_eliminados). Usa eliminacionIds (array) para varios a la vez — una sola confirmación para el lote. También acepta eliminacionId (uno). Dos turnos: confirmado=true tras «sí»/«yes». Si hay conflicto o falta el padre, ese ítem falla y el resto sigue.",
    permiso: null,
    requiereConfirmacion: true,
    input_schema: schema({
      eliminacionId: { type: "string" },
      eliminacionIds: { type: "array", items: { type: "string" } },
      confirmado: { type: "boolean" },
    }),
    async handler(u, args, ctx) {
      const ids = idsRestaurarPapelera(args);
      if (ids.length === 0) {
        return { error: "falta_dato", campo: "eliminacionId|eliminacionIds" };
      }
      const restaurados: {
        tipo: string;
        entidadId: string;
        etiqueta: string;
        eliminacionId: string;
      }[] = [];
      const fallos: { eliminacionId: string; motivo: string }[] = [];
      for (const id of ids) {
        const r = await restaurarEliminacion(id, u);
        if (!r.ok) {
          fallos.push({ eliminacionId: id, motivo: r.motivo });
          continue;
        }
        const accion =
          r.tipo === "tarea"
            ? "tarea_restaurada"
            : r.tipo === "proyecto"
              ? "proyecto_restaurado"
              : "cliente_restaurado";
        await logAgente(
          u,
          ctx,
          accion,
          formatearAlta(`${r.tipo} «${r.etiqueta}» restaurado desde papelera`, []),
          { eliminacionId: id, entidadId: r.entidadId, tipo: r.tipo },
        );
        restaurados.push({
          tipo: r.tipo,
          entidadId: r.entidadId,
          etiqueta: r.etiqueta,
          eliminacionId: id,
        });
      }
      return {
        ok: fallos.length === 0,
        restaurados,
        fallos,
      };
    },
  },
  {
    name: "listar_acciones_deshacer",
    description:
      "Lista acciones reversibles del usuario de sesión (UI y asistente) de los últimos ~7 días, no deshechas ni caducadas. Sirve para localizar el id de deshacer_accion. Distinto de listar_eliminados (papelera).",
    permiso: null,
    input_schema: schema({}),
    async handler(u) {
      const lista = await listarAccionesDeshacer(u, { limite: 40 });
      return {
        retencionDias: DIAS_RETENCION_DESHACER,
        ui: "/ajustes/deshacer",
        items: lista.map((a) => ({
          id: a.id,
          tipo: a.tipo,
          etiqueta: a.etiqueta,
          via: a.via,
          entidadTipo: a.entidadTipo,
          entidadId: a.entidadId,
          creadoEn: a.creadoEn,
          expiraEn: a.expiraEn,
        })),
      };
    },
  },
  {
    name: "deshacer_accion",
    description:
      "Deshace una acción de listar_acciones_deshacer (id). Dos turnos: confirmado=true tras «sí»/«yes». Si el estado actual ya no coincide con el registrado, falla con conflicto. Para restaurar borrados de la papelera usa restaurar_eliminado.",
    permiso: null,
    requiereConfirmacion: true,
    input_schema: schema({
      accionId: { type: "string" },
      confirmado: { type: "boolean" },
    }),
    async handler(u, args, ctx) {
      const accionId = str(args.accionId);
      if (!accionId) return { error: "falta_dato", campo: "accionId" };
      const r = await deshacerAccion(accionId, u);
      if (!r.ok) return { ok: false, motivo: r.motivo, accionId };
      await logAgente(
        u,
        ctx,
        "accion_deshecha",
        formatearAlta(`Deshecho: ${r.etiqueta}`, []),
        { accionId, tipo: r.tipo },
      );
      return { ok: true, accionId, tipo: r.tipo, etiqueta: r.etiqueta };
    },
  },
  {
    name: "buscar_miembro",
    description:
      "Busca miembros del equipo por nombre o correo. Query vacío = listar. Devuelve email solo si el usuario es admin.",
    permiso: null,
    input_schema: schema({ query: { type: "string" } }),
    async handler(u, args) {
      const q = str(args.query);
      const equipo = await listarEquipo();
      return equipo
        .filter(
          (m) =>
            matchNombre(q, m.id === u.id ? u.nombre : m.nombre) ||
            matchNombre(q, m.email),
        )
        .slice(0, 40)
        .map((m) => {
          const nombre = m.id === u.id ? u.nombre : m.nombre;
          const base = { id: m.id, nombre, eresTu: m.id === u.id };
          return u.esAdmin ? { ...base, email: m.email } : base;
        });
    },
  },
  {
    name: "listar_conversaciones",
    description: "Lista conversaciones del usuario.",
    permiso: "comunicaciones.ver",
    input_schema: schema({}),
    async handler(u) {
      const lista = await listarConversacionesDe(u.id);
      return lista.slice(0, 40).map((c) => ({
        id: c.id,
        tipo: c.tipo,
        titulo: c.titulo,
        nombre: c.nombre,
        noLeidos: c.noLeidos,
        ultimo: c.ultimoCuerpo
          ? { excerpt: c.ultimoCuerpo.slice(0, 160), creadoEn: c.ultimoEn }
          : null,
      }));
    },
  },
  {
    name: "leer_mensajes",
    description:
      "Lee mensajes de una conversación (nombre/título o id).",
    permiso: "comunicaciones.ver",
    input_schema: schema({ conversacionId: { type: "string" } }, ["conversacionId"]),
    async handler(u, args) {
      const conv = await resolverConversacion(u.id, str(args.conversacionId));
      if (esErrorResolucion(conv)) return conv;
      const msgs = await listarMensajesChat(conv.id, u.id);
      if (!msgs) return { error: "sin_acceso" };
      return msgs.slice(-40).map((m) => ({
        autor: { nombre: m.autorNombre, eresTu: m.autorId === u.id },
        cuerpo: m.cuerpo.slice(0, 2000),
        creadoEn: m.creadoEn,
      }));
    },
  },
  {
    name: "abrir_dm",
    description: "Abre o crea un DM con otro usuario (nombre o id).",
    permiso: "comunicaciones.editar",
    input_schema: schema({ otroUsuarioId: { type: "string" } }, ["otroUsuarioId"]),
    async handler(u, args) {
      const m = await resolverMiembro(u, str(args.otroUsuarioId));
      if (esErrorResolucion(m)) return m;
      return abrirOCrearDm(u.id, m.id);
    },
  },
  {
    name: "crear_grupo",
    description:
      "Crea un grupo de chat. miembroIds: nombres o ids. Llama sin confirmado; la UI pide confirmación.",
    permiso: "comunicaciones.editar",
    requiereConfirmacion: true,
    input_schema: schema(
      {
        nombre: { type: "string" },
        miembroIds: { type: "array", items: { type: "string" } },
        confirmado: { type: "boolean" },
      },
      ["nombre", "miembroIds"],
    ),
    async handler(u, args) {
      const ms = await resolverMiembros(u, strArr(args.miembroIds));
      if (esErrorResolucion(ms)) return ms;
      return crearGrupo(u.id, str(args.nombre), ms.map((m) => m.id));
    },
  },
  {
    name: "enviar_mensaje",
    description:
      "Envía un mensaje a una conversación (nombre o id). Dos turnos: primero requiere_confirmacion (pregunta); solo tras «sí»/«yes» en un mensaje nuevo usa confirmado=true.",
    permiso: "comunicaciones.editar",
    requiereConfirmacion: true,
    input_schema: schema(
      {
        conversacionId: { type: "string" },
        cuerpo: { type: "string" },
        confirmado: { type: "boolean" },
      },
      ["conversacionId", "cuerpo"],
    ),
    async handler(u, args) {
      const conv = await resolverConversacion(u.id, str(args.conversacionId));
      if (esErrorResolucion(conv)) return conv;
      return enviarMensaje(conv.id, u.id, str(args.cuerpo));
    },
  },
  {
    name: "marcar_leido",
    description: "Marca una conversación (nombre o id) como leída.",
    permiso: "comunicaciones.ver",
    input_schema: schema({ conversacionId: { type: "string" } }, ["conversacionId"]),
    async handler(u, args) {
      const conv = await resolverConversacion(u.id, str(args.conversacionId));
      if (esErrorResolucion(conv)) return conv;
      return marcarLeido(conv.id, u.id);
    },
  },
  {
    name: "leer_mensajes_tarea",
    description:
      "Lee el chat de una tarea (nombre o id; hilo de la ficha, no comunicaciones). Marca el hilo como visto. Últimos ~40.",
    permiso: "tareas.ver",
    input_schema: schema({ tareaId: { type: "string" } }, ["tareaId"]),
    async handler(u, args) {
      const t = await resolverTarea(u, str(args.tareaId));
      if (esErrorResolucion(t)) return t;
      if (!(await puedeAccederTarea(t.id, u.id, u.esAdmin))) {
        return { error: "sin_acceso" };
      }
      const msgs = await mensajesDeTarea(t.id);
      await marcarChatTareaVisto(t.id, u.id);
      return msgs.slice(-40).map((m) => ({
        autor: { nombre: m.autorNombre, eresTu: m.autorId === u.id },
        cuerpo: m.cuerpo.slice(0, 2000),
        creadoEn: m.creadoEn,
      }));
    },
  },
  {
    name: "enviar_mensaje_tarea",
    description:
      "Envía un mensaje al chat de una tarea (nombre o id). Dos turnos: primero requiere_confirmacion (pregunta); solo tras «sí»/«yes» en un mensaje nuevo usa confirmado=true. Distinto de enviar_mensaje (comunicaciones).",
    permiso: "tareas.editar",
    requiereConfirmacion: true,
    input_schema: schema(
      {
        tareaId: { type: "string" },
        cuerpo: { type: "string" },
        confirmado: { type: "boolean" },
      },
      ["tareaId", "cuerpo"],
    ),
    async handler(u, args) {
      const t = await resolverTarea(u, str(args.tareaId));
      if (esErrorResolucion(t)) return t;
      if (!(await puedeAccederTarea(t.id, u.id, u.esAdmin))) {
        return { error: "sin_acceso" };
      }
      const r = await enviarMensajeTarea(t.id, u.id, str(args.cuerpo));
      if (!r.ok) return r;
      await marcarChatTareaVisto(t.id, u.id);
      return {
        ok: true,
        mensaje: {
          autor: { nombre: r.mensaje.autorNombre, eresTu: true },
          cuerpo: r.mensaje.cuerpo.slice(0, 2000),
          creadoEn: r.mensaje.creadoEn,
        },
      };
    },
  },
  {
    name: "buscar_correos",
    description:
      "Lista o busca hilos del Gmail del usuario (solo lectura). Por defecto filtro=todos (leídos y no leídos). filtro=no_leidos SOLO si piden explícitamente no leídos/unread. carpeta=inbox|sent. busqueda: texto libre u operadores Gmail (from:, to:, subject:, newer_than:7d, …). conAdjuntos opcional. Usa noLeidosEnPagina/leidosEnPagina del resultado; no digas «sin leer» sin mirar unread. No envía ni marca leído. Distinto de listar_conversaciones (chat interno).",
    permiso: "correo.ver",
    input_schema: schema({
      carpeta: { type: "string", enum: ["inbox", "sent"] },
      busqueda: { type: "string" },
      filtro: { type: "string", enum: ["todos", "no_leidos"] },
      conAdjuntos: { type: "boolean" },
      limite: { type: "number" },
      pageToken: { type: "string" },
    }),
    async handler(u, args) {
      const gate = await gateCorreoLectura(u);
      if (!gate.ok) return gate;
      const limite = parseLimite(args.limite, 15, 25);
      const filtro: "todos" | "no_leidos" =
        str(args.filtro).toLowerCase() === "no_leidos" ? "no_leidos" : "todos";
      try {
        const r = await listarCorreos(gate.tokens, {
          maxResults: limite,
          pageToken: str(args.pageToken) || undefined,
          carpeta: carpetaCorreo(args.carpeta),
          busqueda: str(args.busqueda) || undefined,
          soloNoLeidos: filtro === "no_leidos",
          conAdjuntos: bool(args.conAdjuntos),
        });
        const correos = r.items.map((c) => ({
          threadId: c.threadId,
          from: c.from,
          to: c.to,
          subject: c.subject,
          snippet: c.snippet.slice(0, 280),
          date: c.date,
          unread: c.unread,
          starred: c.starred,
          messageCount: c.messageCount,
        }));
        const noLeidosEnPagina = correos.filter((c) => c.unread).length;
        return {
          filtro,
          total: correos.length,
          mostradas: correos.length,
          noLeidosEnPagina,
          leidosEnPagina: correos.length - noLeidosEnPagina,
          truncado: !!r.nextPageToken,
          nextPageToken: r.nextPageToken,
          correos,
        };
      } catch (err) {
        console.error("[asistente] buscar_correos", { correo: u.correo, error: err });
        return {
          error: "gmail_error",
          mensaje: err instanceof Error ? err.message : "Error al listar correo",
        };
      }
    },
  },
  {
    name: "leer_correo",
    description:
      "Lee un hilo Gmail por threadId (de buscar_correos). Solo lectura: no marca como leído, no estrella, no envía. Devuelve cuerpo en texto (truncado) y metadatos de adjuntos (sin descargar).",
    permiso: "correo.ver",
    input_schema: schema({ threadId: { type: "string" } }, ["threadId"]),
    async handler(u, args) {
      const gate = await gateCorreoLectura(u);
      if (!gate.ok) return gate;
      const threadId = str(args.threadId);
      if (!threadId) return { error: "falta_dato", mensaje: "Falta threadId." };
      try {
        const hilo = await leerHilo(gate.tokens, threadId);
        const mensajes = hilo.messages.slice(-20).map(mensajeCorreoSlim);
        return {
          threadId: hilo.threadId,
          subject: hilo.subject,
          unread: hilo.unread,
          starred: hilo.starred,
          messageCount: hilo.messages.length,
          mostrados: mensajes.length,
          mensajes,
        };
      } catch (err) {
        console.error("[asistente] leer_correo", { correo: u.correo, threadId, error: err });
        return {
          error: "gmail_error",
          mensaje: err instanceof Error ? err.message : "Error al leer correo",
        };
      }
    },
  },
  {
    name: "resumen_periodo",
    description:
      "Resumen diario/semanal/mensual orientado a consejo. semanal = semana calendario lun–dom (zona del usuario), no últimos 7 días. Eje: atencion.guion (diagnostico, capacidad, planHoy, planSemana, unEnlace opcional, cierre). Respuesta en secciones secas (Patrón / Capacidad / Hoy / Esta semana / Cierre), no muro de texto ni inventario. Listas de tareas vacías a propósito; contadores reales. Sigue atribucion.reglas. verTodo=true solo admin.",
    permiso: null,
    input_schema: schema(
      {
        periodo: { type: "string", enum: ["diario", "semanal", "mensual"] },
        verTodo: { type: "boolean" },
      },
      ["periodo"],
    ),
    async handler(u, args) {
      const raw = str(args.periodo, "diario");
      const periodo: PeriodoResumen =
        raw === "semanal" ? "semanal" : raw === "mensual" ? "mensual" : "diario";
      const verTodo = bool(args.verTodo) && u.esAdmin;
      return construirResumenPeriodo(u, periodo, { verTodo });
    },
  },
];

export function toolsParaUsuario(usuario: UsuarioAuth) {
  return CATALOGO_TOOLS.filter(
    (t) => t.permiso === null || usuarioPuede(usuario, t.permiso),
  ).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}

/** Firma estable de args (sin confirmado) para distinguir retos del mismo destino. */
function firmaArgs(args: Record<string, unknown>): string {
  const { confirmado: _c, ...rest } = args;
  const keys = Object.keys(rest).sort();
  const slim: Record<string, unknown> = {};
  for (const k of keys) {
    const v = rest[k];
    if (v === undefined) continue;
    slim[k] = v;
  }
  return JSON.stringify(slim);
}

async function claveConfirmacion(
  usuario: UsuarioAuth,
  name: string,
  args: Record<string, unknown>,
): Promise<{ ok: true; clave: string } | { ok: false; error: unknown }> {
  switch (name) {
    case "eliminar_cliente": {
      const c = await resolverCliente(str(args.clienteId));
      if (esErrorResolucion(c)) return { ok: false, error: c };
      return { ok: true, clave: `cliente:${c.id}` };
    }
    case "crear_cliente":
      return {
        ok: true,
        clave: `crear_cliente:${str(args.nombre)}:${str(args.correoAcceso).toLowerCase()}`,
      };
    case "editar_cliente": {
      const c = await resolverCliente(str(args.clienteId));
      if (esErrorResolucion(c)) return { ok: false, error: c };
      return { ok: true, clave: `editar_cliente:${c.id}:${firmaArgs(args)}` };
    }
    case "enviar_invitacion_cliente": {
      const c = await resolverCliente(str(args.clienteId));
      if (esErrorResolucion(c)) return { ok: false, error: c };
      return { ok: true, clave: `invite:${c.id}` };
    }
    case "eliminar_proyecto": {
      const p = await exigirProyecto(usuario, str(args.proyectoId));
      if (esErrorResolucion(p)) return { ok: false, error: p };
      return { ok: true, clave: `proyecto:${p.id}` };
    }
    case "crear_proyecto":
      return { ok: true, clave: `crear_proyecto:${firmaArgs(args)}` };
    case "editar_proyecto": {
      const p = await exigirProyecto(usuario, str(args.proyectoId));
      if (esErrorResolucion(p)) return { ok: false, error: p };
      return { ok: true, clave: `editar_proyecto:${p.id}:${firmaArgs(args)}` };
    }
    case "cambiar_estado_proyecto": {
      const p = await exigirProyecto(usuario, str(args.proyectoId));
      if (esErrorResolucion(p)) return { ok: false, error: p };
      return { ok: true, clave: `estado_proyecto:${p.id}:${str(args.estado)}` };
    }
    case "crear_tarea": {
      const p = await exigirProyecto(usuario, str(args.proyectoId));
      if (esErrorResolucion(p)) return { ok: false, error: p };
      const colRef = str(args.columnaId);
      if (colRef) {
        const col = await resolverColumna(p.id, colRef);
        if (esErrorResolucion(col)) return { ok: false, error: col };
      }
      const respRef = strArr(args.responsableIds);
      if (respRef.length) {
        const ms = await resolverMiembros(usuario, respRef);
        if (esErrorResolucion(ms)) return { ok: false, error: ms };
      }
      return {
        ok: true,
        clave: `crear_tarea:${p.id}:${str(args.nombre)}:${firmaArgs(args)}`,
      };
    }
    case "editar_tarea": {
      const t = await exigirTareaEnProyecto(usuario, str(args.tareaId));
      if (esErrorResolucion(t)) return { ok: false, error: t };
      return { ok: true, clave: `editar_tarea:${t.id}:${firmaArgs(args)}` };
    }
    case "mover_tarea": {
      const t = await exigirTareaEnProyecto(usuario, str(args.tareaId));
      if (esErrorResolucion(t)) return { ok: false, error: t };
      return {
        ok: true,
        clave: `mover_tarea:${t.id}:${str(args.columnaId)}:${String(args.indice ?? 0)}`,
      };
    }
    case "alternar_completada_tarea": {
      const t = await resolverTarea(usuario, str(args.tareaId));
      if (esErrorResolucion(t)) return { ok: false, error: t };
      return { ok: true, clave: `toggle_tarea:${t.id}` };
    }
    case "asignar_responsables_tarea": {
      const t = await exigirTareaEnProyecto(usuario, str(args.tareaId));
      if (esErrorResolucion(t)) return { ok: false, error: t };
      const refs = strArr(args.responsableIds);
      if (refs.length === 0) {
        return { ok: false, error: { error: "falta_dato", campo: "responsableIds" } };
      }
      const ms = await resolverMiembros(usuario, refs);
      if (esErrorResolucion(ms)) return { ok: false, error: ms };
      const proy = await proyectoPorId(t.proyectoId);
      const bloqueo = errorSiNingunoEnEquipo(ms, proy?.colaboradorIds ?? []);
      if (bloqueo) return { ok: false, error: bloqueo };
      return {
        ok: true,
        clave: `resp_tarea:${t.id}:${ms
          .map((m) => m.id)
          .sort()
          .join(",")}`,
      };
    }
    case "guardar_notas_tarea": {
      const t = await exigirTareaEnProyecto(usuario, str(args.tareaId));
      if (esErrorResolucion(t)) return { ok: false, error: t };
      return { ok: true, clave: `notas_tarea:${t.id}:${str(args.texto).slice(0, 80)}` };
    }
    case "borrar_tarea": {
      const refs = refsBorrarTareas(args);
      if (refs.length === 0) {
        return { ok: false, error: { error: "falta_dato", campo: "tareaId|tareaIds" } };
      }
      // Lotes se expanden en ejecutarTool; aquí solo claves de una tarea.
      if (refs.length > 1) {
        return { ok: true, clave: `tarea_lote:${refs.slice().sort().join(",")}` };
      }
      const t = await exigirTareaEnProyecto(usuario, refs[0]!);
      if (esErrorResolucion(t)) return { ok: false, error: t };
      return { ok: true, clave: `tarea:${t.id}` };
    }
    case "restaurar_eliminado": {
      const ids = idsRestaurarPapelera(args);
      if (ids.length === 0) {
        return { ok: false, error: { error: "falta_dato", campo: "eliminacionId|eliminacionIds" } };
      }
      return { ok: true, clave: `restaurar:${ids.join(",")}` };
    }
    case "deshacer_accion": {
      const accionId = str(args.accionId);
      if (!accionId) {
        return { ok: false, error: { error: "falta_dato", campo: "accionId" } };
      }
      return { ok: true, clave: `deshacer:${accionId}` };
    }
    case "crear_grupo":
      return {
        ok: true,
        clave: `crear_grupo:${str(args.nombre)}:${strArr(args.miembroIds).slice().sort().join(",")}`,
      };
    case "enviar_mensaje": {
      const conv = await resolverConversacion(usuario.id, str(args.conversacionId));
      if (esErrorResolucion(conv)) return { ok: false, error: conv };
      return { ok: true, clave: `msg:${conv.id}:${str(args.cuerpo)}` };
    }
    case "enviar_mensaje_tarea": {
      const t = await resolverTarea(usuario, str(args.tareaId));
      if (esErrorResolucion(t)) return { ok: false, error: t };
      return { ok: true, clave: `tmsg:${t.id}:${str(args.cuerpo)}` };
    }
    default:
      return { ok: true, clave: `${name}:${firmaArgs(args)}` };
  }
}

function resumenConfirmacion(
  name: string,
  args: Record<string, unknown>,
  extra?: { proyectosQueSeBorran?: number },
): string {
  switch (name) {
    case "crear_cliente":
      return `Crear cliente «${str(args.nombre)}»`;
    case "editar_cliente":
      return `Editar cliente «${str(args.clienteId) || str(args.nombre) || "…"}»`;
    case "enviar_invitacion_cliente":
      return `Enviar invitación a «${str(args.clienteId)}»`;
    case "eliminar_cliente": {
      const n = extra?.proyectosQueSeBorran;
      return n != null && n > 0
        ? `Eliminar cliente «${str(args.clienteId)}» (+${n} proyecto(s))`
        : `Eliminar cliente «${str(args.clienteId)}»`;
    }
    case "crear_proyecto":
      return `Crear proyecto${str(args.nombre) ? ` «${str(args.nombre)}»` : str(args.tipoId) ? ` (${str(args.tipoId)})` : ""}`;
    case "editar_proyecto":
      return `Editar proyecto «${str(args.proyectoId)}»`;
    case "cambiar_estado_proyecto":
      return `Cambiar estado de «${str(args.proyectoId)}» → ${str(args.estado)}`;
    case "eliminar_proyecto":
      return `Eliminar proyecto «${str(args.proyectoId)}»`;
    case "crear_tarea":
      return `Crear tarea «${str(args.nombre)}»`;
    case "editar_tarea":
      return `Editar tarea «${str(args.tareaId)}»`;
    case "mover_tarea":
      return `Mover tarea «${str(args.tareaId)}» → ${str(args.columnaId)}`;
    case "alternar_completada_tarea":
      return `Completar/reabrir tarea «${str(args.tareaId)}»`;
    case "asignar_responsables_tarea":
      return `Asignar responsables en «${str(args.tareaId)}»`;
    case "guardar_notas_tarea":
      return `Guardar notas de «${str(args.tareaId)}»`;
    case "borrar_tarea":
      return `Borrar tarea «${str(args.tareaId) || refsBorrarTareas(args)[0] || "…"}»`;
    case "restaurar_eliminado": {
      const n = idsRestaurarPapelera(args).length;
      return n > 1 ? `Restaurar ${n} elementos de la papelera` : "Restaurar de la papelera";
    }
    case "deshacer_accion":
      return "Deshacer acción reciente";
    case "crear_grupo":
      return `Crear grupo «${str(args.nombre)}»`;
    case "enviar_mensaje":
      return `Enviar mensaje a «${str(args.conversacionId)}»`;
    case "enviar_mensaje_tarea":
      return `Enviar mensaje en tarea «${str(args.tareaId)}»`;
    default:
      return name.replace(/_/g, " ");
  }
}

/** Sustituye ids crudos por nombres legibles en el lightbox de confirmación. */
async function resumenConfirmacionLegible(
  usuario: UsuarioAuth,
  name: string,
  args: Record<string, unknown>,
  extra?: { proyectosQueSeBorran?: number },
): Promise<string> {
  const base = resumenConfirmacion(name, args, extra);

  if (
    name === "editar_tarea" ||
    name === "alternar_completada_tarea" ||
    name === "asignar_responsables_tarea" ||
    name === "guardar_notas_tarea" ||
    name === "enviar_mensaje_tarea" ||
    name === "borrar_tarea"
  ) {
    const ref = str(args.tareaId) || refsBorrarTareas(args)[0] || "";
    if (!ref) return base;
    const t = await exigirTareaEnProyecto(usuario, ref);
    if (esErrorResolucion(t)) return base;
    switch (name) {
      case "editar_tarea":
        return `Editar tarea «${t.nombre}»`;
      case "alternar_completada_tarea":
        return `Completar/reabrir tarea «${t.nombre}»`;
      case "asignar_responsables_tarea":
        return `Asignar responsables en «${t.nombre}»`;
      case "guardar_notas_tarea":
        return `Guardar notas de «${t.nombre}»`;
      case "enviar_mensaje_tarea":
        return `Enviar mensaje en tarea «${t.nombre}»`;
      case "borrar_tarea":
        return `Borrar tarea «${t.nombre}»`;
      default:
        return base;
    }
  }

  if (name === "mover_tarea") {
    const t = await exigirTareaEnProyecto(usuario, str(args.tareaId));
    if (esErrorResolucion(t)) return base;
    const col = await resolverColumna(t.proyectoId, str(args.columnaId));
    const colNombre = esErrorResolucion(col) ? str(args.columnaId) : col.nombre;
    return `Mover tarea «${t.nombre}» → ${colNombre}`;
  }

  if (name === "crear_tarea") {
    const p = await exigirProyecto(usuario, str(args.proyectoId));
    if (esErrorResolucion(p)) return base;
    const etiqueta = p.etiqueta || p.nombre || p.id.slice(0, 8);
    const nombre = str(args.nombre) || "…";
    return `Crear tarea «${nombre}» en «${etiqueta}»`;
  }

  if (name === "deshacer_accion") {
    const id = str(args.accionId);
    if (!id) return base;
    const row = await obtenerAccionDeshacer(id);
    const et = typeof row?.etiqueta === "string" ? row.etiqueta.trim() : "";
    return et ? `Deshacer: ${et}` : base;
  }

  if (name === "restaurar_eliminado") {
    const ids = idsRestaurarPapelera(args);
    if (ids.length === 1) {
      const e = await obtenerEliminacion(ids[0]!);
      if (e?.etiqueta?.trim()) {
        return `Restaurar «${e.etiqueta.trim()}» de la papelera`;
      }
    }
    return base;
  }

  if (
    name === "editar_proyecto" ||
    name === "cambiar_estado_proyecto" ||
    name === "eliminar_proyecto"
  ) {
    const p = await exigirProyecto(usuario, str(args.proyectoId));
    if (esErrorResolucion(p)) return base;
    const etiqueta = p.etiqueta || p.nombre || p.id.slice(0, 8);
    if (name === "cambiar_estado_proyecto") {
      return `Cambiar estado de «${etiqueta}» → ${str(args.estado)}`;
    }
    if (name === "eliminar_proyecto") return `Eliminar proyecto «${etiqueta}»`;
    return `Editar proyecto «${etiqueta}»`;
  }

  if (
    name === "editar_cliente" ||
    name === "enviar_invitacion_cliente" ||
    name === "eliminar_cliente"
  ) {
    const c = await resolverCliente(str(args.clienteId) || str(args.nombre));
    if (esErrorResolucion(c)) return base;
    if (name === "enviar_invitacion_cliente") {
      return `Enviar invitación a «${c.nombre}»`;
    }
    if (name === "eliminar_cliente") {
      const n = extra?.proyectosQueSeBorran;
      return n != null && n > 0
        ? `Eliminar cliente «${c.nombre}» (+${n} proyecto(s))`
        : `Eliminar cliente «${c.nombre}»`;
    }
    return `Editar cliente «${c.nombre}»`;
  }

  return base;
}

/** Expande un lote de borrados a N retos de confirmación (uno por tarea). */
async function requerirConfirmacionBorrarLote(
  usuario: UsuarioAuth,
  refs: string[],
): Promise<unknown> {
  const pendientes: {
    tool: string;
    clave: string;
    resumen: string;
    args: { tareaId: string };
  }[] = [];
  const fallos: { ref: string; motivo: unknown }[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    const t = await exigirTareaEnProyecto(usuario, ref);
    if (esErrorResolucion(t)) {
      fallos.push({ ref, motivo: t });
      continue;
    }
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    pendientes.push({
      tool: "borrar_tarea",
      clave: `tarea:${t.id}`,
      resumen: `Borrar tarea «${t.nombre}»`,
      args: { tareaId: t.id },
    });
  }
  if (pendientes.length === 0) {
    return {
      error: "no_encontrado",
      mensaje: "No se pudo resolver ninguna tarea para borrar.",
      fallos,
    };
  }
  return {
    error: "requiere_confirmacion" as const,
    mensaje: `Confirma cada borrado por separado (${pendientes.length} tarea(s)).`,
    pendiente: pendientes[0],
    pendientes,
    fallos,
  };
}

export async function ejecutarTool(
  usuario: UsuarioAuth,
  name: string,
  args: Record<string, unknown>,
  historial: MensajeIa[] = [],
  conversacionId: string | null = null,
  /**
   * Lightbox Confirmar ya validó el reto. No recalcular el candado de dos turnos:
   * args editados en la UI pueden cambiar `clave`/`firmaArgs` y volver a pedir
   * confirmación (doble lightbox + mensaje técnico en el chat).
   */
  opts?: { confirmadoPorUi?: boolean },
): Promise<unknown> {
  const tool = CATALOGO_TOOLS.find((t) => t.name === name);
  if (!tool) return { error: "tool_desconocida", name };
  if (tool.permiso && !usuarioPuede(usuario, tool.permiso)) {
    return { error: "sin_permiso", permiso: tool.permiso };
  }
  // Lote de borrado: nunca ejecutar de golpe; N confirmaciones individuales.
  if (name === "borrar_tarea" && refsBorrarTareas(args ?? {}).length > 1) {
    return requerirConfirmacionBorrarLote(usuario, refsBorrarTareas(args ?? {}));
  }
  if (tool.requiereConfirmacion && !opts?.confirmadoPorUi) {
    const dest = await claveConfirmacion(usuario, name, args ?? {});
    if (!dest.ok) return dest.error;
    const confirmado = bool(args?.confirmado);
    const dosTurnosOk =
      confirmado && confirmacionDosTurnosOk(historial, name, dest.clave);
    if (!dosTurnosOk) {
      let proyectosQueSeBorran: number | undefined;
      if (name === "eliminar_cliente" && dest.clave.startsWith("cliente:")) {
        proyectosQueSeBorran = (
          await proyectosDe(dest.clave.slice("cliente:".length))
        ).length;
      }
      const resumen = await resumenConfirmacionLegible(
        usuario,
        name,
        args ?? {},
        { proyectosQueSeBorran },
      );
      const base = {
        error: "requiere_confirmacion" as const,
        mensaje:
          "Pide confirmación al usuario (un «sí»/«yes» en el siguiente mensaje). «borra X» o «delete it» no basta. Luego vuelve a llamar con confirmado=true.",
        pendiente: { tool: name, clave: dest.clave, resumen },
      };
      if (proyectosQueSeBorran != null) {
        return {
          ...base,
          mensaje:
            proyectosQueSeBorran > 0
              ? `${base.mensaje} Avisa: se borrarán también ${proyectosQueSeBorran} proyecto(s) de la cuenta (cascada como en la UI).`
              : base.mensaje,
          proyectosQueSeBorran,
        };
      }
      return base;
    }
  }
  try {
    const raw = await tool.handler(usuario, args ?? {}, { conversacionId });
    const { normalizarDatetimesParaAgente } = await import("@/lib/formato");
    const { parseZona } = await import("@/lib/zona");
    return normalizarDatetimesParaAgente(raw, parseZona(usuario.timezone));
  } catch (error) {
    console.error("[asistente] tool falló", { name, error });
    return { error: "fallo_interno", detalle: String(error) };
  }
}
