export type OrigenAlta = "manual" | "clientify";

export type PrioridadProyecto = "baja" | "media" | "alta" | "urgente";

export type EstadoProyecto = "activo" | "terminado" | "archivado";

export type AmbitoProyecto = "interno" | "externo";

export type PersonaEquipo = {
  id: string;
  nombre: string;
  email: string;
  /** Ruta pública autenticada si tiene foto; null = iniciales. */
  avatarUrl: string | null;
};

export type TipoProyecto = {
  id: string;
  nombre: string;
  orden: number;
};

export type Proyecto = {
  id: string;
  ambito: AmbitoProyecto;
  /** Nombre libre; obligatorio en internos. En externos opcional (si falta se muestra el tipo). */
  nombre: string | null;
  clienteId: string | null;
  /** Obligatorio en externos; NULL en internos (el título es `nombre`). */
  tipoId: string | null;
  feeMensual: number | null;
  finContrato: string | null;
  responsableId: string | null;
  colaboradorIds: string[];
  prioridad: PrioridadProyecto;
  estado: EstadoProyecto;
  /** Si está definido, es el proyecto "Personal" oculto de ese usuario. */
  personalDeId: string | null;
  creadoEl: string;
};

export const PRIORIDADES_PROYECTO: PrioridadProyecto[] = ["baja", "media", "alta", "urgente"];

export const ESTADOS_PROYECTO: EstadoProyecto[] = ["activo", "terminado", "archivado"];

/** Clasificación comercial opcional de la cuenta. */
export type TipoCuenta = "b2b" | "kit_digital";

export const TIPOS_CUENTA: TipoCuenta[] = ["b2b", "kit_digital"];

export function etiquetaTipoCuenta(tipo: TipoCuenta | null | undefined): string {
  if (tipo === "b2b") return "B2B";
  if (tipo === "kit_digital") return "Kit Digital";
  return "Ninguno";
}

export type Cliente = {
  id: string;
  nombre: string;
  correoAcceso: string;
  /** Formato fijo `+34 XXX XXX XXX`, o null si no hay. */
  telefono: string | null;
  /** Dueño comercial de la cuenta (usuario del equipo). */
  responsableId: string | null;
  /** B2B / Kit Digital; null = sin clasificar. */
  tipoCuenta: TipoCuenta | null;
  origen: OrigenAlta;
  invitacionEnviada: boolean;
  invitacionEnviadaEl: string | null;
  creadoEl: string;
};

/** Placeholder / máscara UI: +34 XXX XXX XXX */
export const TELEFONO_ES_PLACEHOLDER = "+34 612 345 678";

/**
 * Vacío → null. Acepta dígitos con/sin +34 y espacios.
 * Devuelve el canónico `+34 XXX XXX XXX`, o false si no es válido.
 */
export function normalizarTelefonoEs(raw: string): string | null | false {
  const t = raw.trim();
  if (!t) return null;
  let digitos = t.replace(/[\s\-().]/g, "");
  if (digitos.startsWith("+34")) digitos = digitos.slice(3);
  else if (digitos.startsWith("0034")) digitos = digitos.slice(4);
  else if (digitos.startsWith("34") && digitos.length === 11) digitos = digitos.slice(2);
  if (!/^[6-9]\d{8}$/.test(digitos)) return false;
  return `+34 ${digitos.slice(0, 3)} ${digitos.slice(3, 6)} ${digitos.slice(6, 9)}`;
}

export function personaPorId(
  personaId: string | null | undefined,
  equipo: PersonaEquipo[],
): PersonaEquipo | null {
  if (!personaId) return null;
  return equipo.find((p) => p.id === personaId) ?? null;
}

export function normalizarColaboradorIds(ids: string[]): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = String(raw ?? "").trim();
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    out.push(id);
  }
  return out;
}

export function personasPorIds(ids: string[], equipo: PersonaEquipo[]): PersonaEquipo[] {
  return normalizarColaboradorIds(ids)
    .map((id) => personaPorId(id, equipo))
    .filter((p): p is PersonaEquipo => p !== null);
}

/** 0 = responsable, 1 = colaborador, 2 = sin pertenencia. */
export function rangoPertenencia(
  p: { responsableId: string | null; colaboradorIds: string[] },
  yoId: string,
): 0 | 1 | 2 {
  if (!yoId) return 2;
  if (p.responsableId === yoId) return 0;
  if (p.colaboradorIds.includes(yoId)) return 1;
  return 2;
}

const PESO_PRIORIDAD: Record<PrioridadProyecto, number> = {
  urgente: 0,
  alta: 1,
  media: 2,
  baja: 3,
};

/** Orden: responsable → colaborador → resto; luego prioridad; luego más reciente. */
export function ordenarPorPertenencia<
  T extends {
    responsableId: string | null;
    colaboradorIds: string[];
    prioridad: PrioridadProyecto;
    creadoEl: string;
  },
>(lista: T[], yoId: string): T[] {
  return [...lista].sort((a, b) => {
    const ra = rangoPertenencia(a, yoId);
    const rb = rangoPertenencia(b, yoId);
    if (ra !== rb) return ra - rb;
    const pa = PESO_PRIORIDAD[a.prioridad] ?? 99;
    const pb = PESO_PRIORIDAD[b.prioridad] ?? 99;
    if (pa !== pb) return pa - pb;
    return b.creadoEl.localeCompare(a.creadoEl);
  });
}

export function perteneceAlProyecto(
  p: { responsableId: string | null; colaboradorIds: string[] },
  yoId: string,
): boolean {
  return rangoPertenencia(p, yoId) < 2;
}
