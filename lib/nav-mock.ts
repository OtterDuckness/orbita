export type NavItemId =
  | "panel"
  | "asistente"
  | "clientes"
  | "proyectos"
  | "tareas"
  | "calendario"
  | "correo"
  | "comunicaciones";

export type NavItem = {
  id: NavItemId;
  href: string;
  nombre: string;
  ordenDefault: number;
};

/** Preferencias de menú por usuario (delta sobre el registro). */
export type NavPrefs = {
  orden: NavItemId[];
  ocultos: NavItemId[];
};

export const NAV_REGISTRO: NavItem[] = [
  { id: "panel", href: "/", nombre: "Panel", ordenDefault: 10 },
  { id: "asistente", href: "/asistente", nombre: "Asistente", ordenDefault: 15 },
  { id: "clientes", href: "/clientes", nombre: "Clientes", ordenDefault: 20 },
  { id: "proyectos", href: "/proyectos", nombre: "Proyectos", ordenDefault: 30 },
  { id: "tareas", href: "/tareas", nombre: "Tareas", ordenDefault: 35 },
  { id: "calendario", href: "/calendario", nombre: "Calendario", ordenDefault: 37 },
  { id: "correo", href: "/correo", nombre: "Correo", ordenDefault: 38 },
  { id: "comunicaciones", href: "/comunicaciones", nombre: "Comunicaciones", ordenDefault: 40 },
];

const IDS = new Set(NAV_REGISTRO.map((i) => i.id));

type Almacen = {
  prefsPorUsuario: Record<string, NavPrefs>;
};

const globalKey = "__orbita_nav_mock_v1__";

function almacen(): Almacen {
  const g = globalThis as typeof globalThis & { [globalKey]?: Almacen };
  if (!g[globalKey]) {
    g[globalKey] = { prefsPorUsuario: {} };
  }
  return g[globalKey]!;
}

function claveUsuario(email: string) {
  return email.trim().toLowerCase();
}

function esId(v: string): v is NavItemId {
  return IDS.has(v as NavItemId);
}

export function prefsPorDefecto(): NavPrefs {
  return {
    orden: [...NAV_REGISTRO].sort((a, b) => a.ordenDefault - b.ordenDefault).map((i) => i.id),
    ocultos: [],
  };
}

export function leerNavPrefs(email: string | null | undefined): NavPrefs {
  if (!email) return prefsPorDefecto();
  const guardadas = almacen().prefsPorUsuario[claveUsuario(email)];
  if (!guardadas) return prefsPorDefecto();
  return normalizarPrefs(guardadas);
}

/** Une prefs guardadas con el registro actual (ítems nuevos, ids obsoletos). */
export function normalizarPrefs(raw: NavPrefs): NavPrefs {
  const def = prefsPorDefecto();
  const ordenVisto = new Set<NavItemId>();
  const orden: NavItemId[] = [];

  for (const id of raw.orden ?? []) {
    if (!esId(id) || ordenVisto.has(id)) continue;
    ordenVisto.add(id);
    orden.push(id);
  }
  for (const id of def.orden) {
    if (ordenVisto.has(id)) continue;
    orden.push(id);
  }

  const ocultos = [...new Set((raw.ocultos ?? []).filter(esId))];
  // No permitir menú vacío: si todo oculto, no ocultar nada.
  if (ocultos.length >= orden.length) {
    return { orden, ocultos: [] };
  }
  return { orden, ocultos };
}

export function guardarNavPrefs(
  email: string,
  prefs: NavPrefs,
): { ok: true; prefs: NavPrefs } | { ok: false; motivo: "falta_dato" | "menu_vacio" } {
  const e = email.trim().toLowerCase();
  if (!e) return { ok: false, motivo: "falta_dato" };

  const normalizadas = normalizarPrefs(prefs);
  if (normalizadas.ocultos.length >= normalizadas.orden.length) {
    return { ok: false, motivo: "menu_vacio" };
  }

  almacen().prefsPorUsuario[e] = normalizadas;
  return { ok: true, prefs: normalizadas };
}

export function restablecerNavPrefs(email: string): { ok: true; prefs: NavPrefs } | { ok: false; motivo: "falta_dato" } {
  const e = email.trim().toLowerCase();
  if (!e) return { ok: false, motivo: "falta_dato" };
  const prefs = prefsPorDefecto();
  almacen().prefsPorUsuario[e] = prefs;
  return { ok: true, prefs };
}

/** Secciones visibles para el sidemenu, según prefs del usuario. */
export function seccionesVisibles(email: string | null | undefined): { href: string; nombre: string; id: NavItemId }[] {
  const prefs = leerNavPrefs(email);
  const porId = new Map(NAV_REGISTRO.map((i) => [i.id, i]));
  const ocultos = new Set(prefs.ocultos);

  return prefs.orden
    .filter((id) => !ocultos.has(id))
    .map((id) => porId.get(id))
    .filter((i): i is NavItem => !!i)
    .map((i) => ({ id: i.id, href: i.href, nombre: i.nombre }));
}

/** Estado editable para la UI de Ajustes (todos los ítems del registro). */
export function seccionesParaEditar(email: string | null | undefined): {
  id: NavItemId;
  nombre: string;
  visible: boolean;
}[] {
  const prefs = leerNavPrefs(email);
  const porId = new Map(NAV_REGISTRO.map((i) => [i.id, i]));
  const ocultos = new Set(prefs.ocultos);

  return prefs.orden
    .map((id) => porId.get(id))
    .filter((i): i is NavItem => !!i)
    .map((i) => ({
      id: i.id,
      nombre: i.nombre,
      visible: !ocultos.has(i.id),
    }));
}
