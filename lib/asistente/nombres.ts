import { clientePorId, listarClientes, type Cliente } from "@/lib/clientes";
import { listarConversacionesDe, type ConversacionLista } from "@/lib/comunicaciones";
import {
  listarProyectos,
  proyectoPorId,
  type Proyecto,
} from "@/lib/proyectos";
import { alcanceProyectos } from "@/lib/authz";
import {
  columnasDe,
  tareaPorId,
  tareasDe,
  tareasDelUsuario,
} from "@/lib/tablero";
import type { Columna, Tarea } from "@/lib/tareas-mock";
import { listarTiposProyecto, mapaNombresTipo, type TipoProyecto } from "@/lib/tipos-proyecto";
import { listarEquipo, type UsuarioAuth } from "@/lib/usuarios";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CandidatoNombre = { id: string; nombre: string };

export type ErrorResolucion = {
  error: "no_encontrado" | "ambiguo" | "sin_acceso";
  tipo?: string;
  query?: string;
  candidatos?: CandidatoNombre[];
};

export type EtiquetaProyecto = {
  etiqueta: string;
  clienteNombre: string | null;
  tipoNombre: string | null;
};

export type ProyectoNombrado = Proyecto & EtiquetaProyecto;

export function esUuid(valor: string): boolean {
  return UUID_RE.test(valor.trim());
}

export function esErrorResolucion(x: unknown): x is ErrorResolucion {
  if (!x || typeof x !== "object" || !("error" in x)) return false;
  const e = (x as { error: unknown }).error;
  return e === "no_encontrado" || e === "ambiguo" || e === "sin_acceso";
}

function norm(s: string): string {
  return s
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[·•]/g, " ")
    .replace(/\s*[-|/]\s*/g, " ")
    .replace(/\s+/g, " ");
}

function textosNorm(textos: string[]): string[] {
  return textos.map(norm).filter(Boolean);
}

/** Tokens útiles para match corto (primer nombre, local-part de email). */
function tokensDe(textoNorm: string): string[] {
  const base = textoNorm.includes("@") ? textoNorm.split("@")[0]! : textoNorm;
  return base.split(" ").filter(Boolean);
}

function tokenCerca(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const [corto, largo] = a.length <= b.length ? [a, b] : [b, a];
  return corto.length >= 3 && largo.startsWith(corto) && largo.length - corto.length <= 2;
}

/**
 * Match laxo para búsqueda/listado (hilo ≈ hilos). No usar en mutaciones:
 * ahí sigue `elegirUnico` (exacto / ambiguo).
 */
export function textoParecido(query: string, texto: string): boolean {
  const q = norm(query);
  const t = norm(texto);
  if (!q || !t) return false;
  if (q === t || t.includes(q) || q.includes(t)) return true;
  const tq = tokensDe(q).filter((x) => x.length >= 2);
  const tt = tokensDe(t);
  if (tq.length === 0) return false;
  let hits = 0;
  for (const a of tq) {
    if (tt.some((b) => tokenCerca(a, b))) hits++;
  }
  return hits >= Math.ceil(tq.length * 0.7);
}

function noEncontrado(tipo: string, query: string): ErrorResolucion {
  return { error: "no_encontrado", tipo, query };
}

function ambiguo(tipo: string, query: string, candidatos: CandidatoNombre[]): ErrorResolucion {
  return { error: "ambiguo", tipo, query, candidatos: candidatos.slice(0, 12) };
}

function elegirUnico<T>(
  query: string,
  items: T[],
  textosDe: (item: T) => string[],
): { ok: true; item: T } | { ok: false; motivo: "no_encontrado" | "ambiguo"; items: T[] } {
  const q = norm(query);
  if (!q) return { ok: false, motivo: "no_encontrado", items: [] };

  const exactos = items.filter((item) => textosNorm(textosDe(item)).includes(q));
  if (exactos.length === 1) return { ok: true, item: exactos[0] };
  if (exactos.length > 1) return { ok: false, motivo: "ambiguo", items: exactos };

  const porToken = items.filter((item) =>
    textosNorm(textosDe(item)).some((t) => tokensDe(t).includes(q)),
  );
  if (porToken.length === 1) return { ok: true, item: porToken[0] };
  if (porToken.length > 1) return { ok: false, motivo: "ambiguo", items: porToken };

  const parciales = items.filter((item) =>
    textosNorm(textosDe(item)).some((t) => t.includes(q)),
  );
  if (parciales.length === 1) return { ok: true, item: parciales[0] };
  if (parciales.length > 1) return { ok: false, motivo: "ambiguo", items: parciales };
  return { ok: false, motivo: "no_encontrado", items: [] };
}

export function etiquetasDeProyecto(
  p: Proyecto,
  clientePorId: Map<string, string>,
  tipoPorId: Map<string, string>,
): EtiquetaProyecto {
  const clienteNombre = p.clienteId ? clientePorId.get(p.clienteId) ?? null : null;
  const tipoNombre = p.tipoId ? tipoPorId.get(p.tipoId) ?? null : null;
  const propio = p.nombre?.trim() || null;
  let etiqueta: string;
  if (p.ambito === "interno") {
    etiqueta = propio || "Proyecto interno";
  } else {
    const segundo = propio || tipoNombre;
    etiqueta = [clienteNombre, segundo].filter(Boolean).join(" · ") || "Proyecto";
  }
  return { etiqueta, clienteNombre, tipoNombre };
}

export async function catalogoEtiquetas(): Promise<{
  clientePorId: Map<string, string>;
  tipoPorId: Map<string, string>;
}> {
  const [clientes, tipoPorId] = await Promise.all([listarClientes(), mapaNombresTipo()]);
  return {
    clientePorId: new Map(clientes.map((c) => [c.id, c.nombre])),
    tipoPorId,
  };
}

export async function nombrarProyecto(p: Proyecto): Promise<ProyectoNombrado> {
  const cat = await catalogoEtiquetas();
  return { ...p, ...etiquetasDeProyecto(p, cat.clientePorId, cat.tipoPorId) };
}

export async function nombrarProyectos(lista: Proyecto[]): Promise<ProyectoNombrado[]> {
  if (lista.length === 0) return [];
  const cat = await catalogoEtiquetas();
  return lista.map((p) => ({ ...p, ...etiquetasDeProyecto(p, cat.clientePorId, cat.tipoPorId) }));
}

function pertenece(p: Proyecto, usuarioId: string): boolean {
  return p.responsableId === usuarioId || p.colaboradorIds.includes(usuarioId);
}

async function proyectosDelAlcance(
  usuario: UsuarioAuth,
  verTodo = false,
): Promise<Proyecto[]> {
  const { soloDe } = alcanceProyectos(usuario, verTodo && usuario.esAdmin);
  return listarProyectos(soloDe);
}

export async function resolverCliente(ref: string): Promise<Cliente | ErrorResolucion> {
  const q = ref.trim();
  if (!q) return noEncontrado("cliente", q);
  if (esUuid(q)) {
    const c = await clientePorId(q);
    return c ?? noEncontrado("cliente", q);
  }
  const todos = await listarClientes();
  const hit = elegirUnico(q, todos, (c) => [c.nombre, c.correoAcceso]);
  if (hit.ok) return hit.item;
  if (hit.motivo === "ambiguo") {
    return ambiguo(
      "cliente",
      q,
      hit.items.map((c) => ({ id: c.id, nombre: c.nombre })),
    );
  }
  return noEncontrado("cliente", q);
}

export async function resolverProyecto(
  usuario: UsuarioAuth,
  ref: string,
  opts?: { verTodo?: boolean },
): Promise<ProyectoNombrado | ErrorResolucion> {
  const q = ref.trim();
  if (!q) return noEncontrado("proyecto", q);
  const verTodo = Boolean(opts?.verTodo && usuario.esAdmin);

  if (esUuid(q)) {
    const p = await proyectoPorId(q);
    if (!p || p.personalDeId) return noEncontrado("proyecto", q);
    if (!usuario.esAdmin && !pertenece(p, usuario.id)) return { error: "sin_acceso", tipo: "proyecto", query: q };
    return nombrarProyecto(p);
  }

  const nombrados = await nombrarProyectos(await proyectosDelAlcance(usuario, verTodo));
  const hit = elegirUnico(q, nombrados, (p) => [
    p.etiqueta,
    p.nombre ?? "",
    p.clienteNombre ?? "",
    p.tipoNombre ?? "",
  ]);
  if (hit.ok) return hit.item;
  if (hit.motivo === "ambiguo") {
    return ambiguo(
      "proyecto",
      q,
      hit.items.map((p) => ({ id: p.id, nombre: p.etiqueta })),
    );
  }
  return noEncontrado("proyecto", q);
}

export async function resolverTipo(ref: string): Promise<TipoProyecto | ErrorResolucion> {
  const q = ref.trim();
  if (!q) return noEncontrado("tipo_proyecto", q);
  const tipos = await listarTiposProyecto();
  if (esUuid(q)) {
    const t = tipos.find((x) => x.id === q);
    return t ?? noEncontrado("tipo_proyecto", q);
  }
  const hit = elegirUnico(q, tipos, (t) => [t.nombre]);
  if (hit.ok) return hit.item;
  if (hit.motivo === "ambiguo") {
    return ambiguo(
      "tipo_proyecto",
      q,
      hit.items.map((t) => ({ id: t.id, nombre: t.nombre })),
    );
  }
  return noEncontrado("tipo_proyecto", q);
}

function aliasYo(query: string, usuario: UsuarioAuth): boolean {
  const q = norm(query);
  return q === "yo" || q === "tú" || q === "tu" || q === "me" || q === "mí" || q === norm(usuario.nombre);
}

export async function resolverMiembro(
  usuario: UsuarioAuth,
  ref: string,
): Promise<{ id: string; nombre: string } | ErrorResolucion> {
  const q = ref.trim();
  if (!q) return noEncontrado("miembro", q);
  const equipo = await listarEquipo();
  const filas = equipo.map((m) => ({
    id: m.id,
    nombre: m.id === usuario.id ? usuario.nombre : m.nombre,
    email: m.email,
  }));

  if (esUuid(q)) {
    const m = filas.find((x) => x.id === q);
    return m ? { id: m.id, nombre: m.nombre } : noEncontrado("miembro", q);
  }
  if (aliasYo(q, usuario)) {
    return { id: usuario.id, nombre: usuario.nombre };
  }

  // Match nombre + email for everyone (email is only for resolve; payload still hides it unless admin).
  const hit = elegirUnico(q, filas, (m) => [m.nombre, m.email]);
  if (hit.ok) return { id: hit.item.id, nombre: hit.item.nombre };
  if (hit.motivo === "ambiguo") {
    return ambiguo(
      "miembro",
      q,
      hit.items.map((m) => ({ id: m.id, nombre: m.nombre })),
    );
  }
  return noEncontrado("miembro", q);
}

export async function resolverMiembros(
  usuario: UsuarioAuth,
  refs: string[],
): Promise<{ id: string; nombre: string }[] | ErrorResolucion> {
  const out: { id: string; nombre: string }[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    const r = await resolverMiembro(usuario, ref);
    if (esErrorResolucion(r)) return r;
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

export async function resolverColumna(
  proyectoId: string,
  ref: string,
): Promise<Columna | ErrorResolucion> {
  const q = ref.trim();
  if (!q) return noEncontrado("columna", q);
  const cols = await columnasDe(proyectoId);
  if (esUuid(q) || cols.some((c) => c.id === q)) {
    const c = cols.find((x) => x.id === q);
    return c ?? noEncontrado("columna", q);
  }
  const hit = elegirUnico(q, cols, (c) => [c.nombre]);
  if (hit.ok) return hit.item;
  if (hit.motivo === "ambiguo") {
    return ambiguo(
      "columna",
      q,
      hit.items.map((c) => ({ id: c.id, nombre: c.nombre })),
    );
  }
  return noEncontrado("columna", q);
}

export async function resolverTarea(
  usuario: UsuarioAuth,
  ref: string,
  opts?: { proyectoId?: string },
): Promise<Tarea | ErrorResolucion> {
  const q = ref.trim();
  if (!q) return noEncontrado("tarea", q);

  if (esUuid(q)) {
    const t = await tareaPorId(q);
    return t ?? noEncontrado("tarea", q);
  }

  let pool: Tarea[] = [];
  if (opts?.proyectoId) {
    pool = await tareasDe(opts.proyectoId);
  } else {
    const visibles = await proyectosDelAlcance(usuario);
    const porProyecto: Tarea[] = [];
    for (const p of visibles) {
      porProyecto.push(...(await tareasDe(p.id)));
    }
    const mias = await tareasDelUsuario(usuario.id);
    const seen = new Set(porProyecto.map((t) => t.id));
    pool = [...porProyecto];
    for (const t of mias) {
      if (!seen.has(t.id)) pool.push(t);
    }
  }

  const hit = elegirUnico(q, pool, (t) => [t.nombre]);
  if (hit.ok) return hit.item;
  if (hit.motivo === "ambiguo") {
    return ambiguo(
      "tarea",
      q,
      hit.items.map((t) => ({ id: t.id, nombre: t.nombre })),
    );
  }
  return noEncontrado("tarea", q);
}

export async function resolverChecklistItem(
  tarea: Tarea,
  ref: string,
): Promise<{ id: string; texto: string } | ErrorResolucion> {
  const q = ref.trim();
  if (!q) return noEncontrado("checklist", q);
  const items = tarea.checklist;
  if (esUuid(q) || items.some((i) => i.id === q)) {
    const i = items.find((x) => x.id === q);
    return i ? { id: i.id, texto: i.texto } : noEncontrado("checklist", q);
  }
  const hit = elegirUnico(q, items, (i) => [i.texto]);
  if (hit.ok) return { id: hit.item.id, texto: hit.item.texto };
  if (hit.motivo === "ambiguo") {
    return ambiguo(
      "checklist",
      q,
      hit.items.map((i) => ({ id: i.id, nombre: i.texto })),
    );
  }
  return noEncontrado("checklist", q);
}

export async function resolverConversacion(
  usuarioId: string,
  ref: string,
): Promise<ConversacionLista | ErrorResolucion> {
  const q = ref.trim();
  if (!q) return noEncontrado("conversacion", q);
  const lista = await listarConversacionesDe(usuarioId);
  if (esUuid(q)) {
    const c = lista.find((x) => x.id === q);
    return c ?? noEncontrado("conversacion", q);
  }
  const hit = elegirUnico(q, lista, (c) => [c.titulo, c.nombre ?? ""]);
  if (hit.ok) return hit.item;
  if (hit.motivo === "ambiguo") {
    return ambiguo(
      "conversacion",
      q,
      hit.items.map((c) => ({ id: c.id, nombre: c.titulo })),
    );
  }
  return noEncontrado("conversacion", q);
}
