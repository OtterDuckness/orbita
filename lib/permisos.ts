/** Catálogo fijo de permisos de Órbita (no editables desde la UI). */

export const PERMISOS = [
  "clientes.ver",
  "clientes.editar",
  "proyectos.ver",
  "proyectos.editar",
  "tareas.ver",
  "tareas.editar",
  "comunicaciones.ver",
  "comunicaciones.editar",
  "correo.ver",
  "correo.editar",
  "asistente.web",
  "mi_zona.ver",
  "mi_zona.fichar",
  "mi_zona.ausencias",
  "mi_zona.aprobar_ausencias",
  "mi_zona.nominas",
  "mi_zona.equipo",
  "mi_zona.admin",
] as const;

export type Permiso = (typeof PERMISOS)[number];

export type PermisoMeta = {
  codigo: Permiso;
  modulo: string;
  accion: "ver" | "editar" | "web" | "fichar" | "ausencias" | "aprobar" | "nominas" | "equipo" | "admin";
  etiqueta: string;
};

export const CATALOGO_PERMISOS: PermisoMeta[] = [
  { codigo: "clientes.ver", modulo: "Clientes", accion: "ver", etiqueta: "Ver clientes" },
  { codigo: "clientes.editar", modulo: "Clientes", accion: "editar", etiqueta: "Alterar clientes" },
  { codigo: "proyectos.ver", modulo: "Proyectos", accion: "ver", etiqueta: "Ver proyectos" },
  { codigo: "proyectos.editar", modulo: "Proyectos", accion: "editar", etiqueta: "Alterar proyectos" },
  { codigo: "tareas.ver", modulo: "Tareas", accion: "ver", etiqueta: "Ver tareas" },
  { codigo: "tareas.editar", modulo: "Tareas", accion: "editar", etiqueta: "Alterar tareas" },
  {
    codigo: "comunicaciones.ver",
    modulo: "Comunicaciones",
    accion: "ver",
    etiqueta: "Ver comunicaciones",
  },
  {
    codigo: "comunicaciones.editar",
    modulo: "Comunicaciones",
    accion: "editar",
    etiqueta: "Alterar comunicaciones",
  },
  { codigo: "correo.ver", modulo: "Correo", accion: "ver", etiqueta: "Ver correo (Gmail)" },
  { codigo: "correo.editar", modulo: "Correo", accion: "editar", etiqueta: "Enviar correo (Gmail)" },
  {
    codigo: "asistente.web",
    modulo: "Asistente IA",
    accion: "web",
    etiqueta: "Buscar / leer en internet",
  },
  { codigo: "mi_zona.ver", modulo: "Mi Zona", accion: "ver", etiqueta: "Ver Mi Zona" },
  { codigo: "mi_zona.fichar", modulo: "Mi Zona", accion: "fichar", etiqueta: "Control horario" },
  { codigo: "mi_zona.ausencias", modulo: "Mi Zona", accion: "ausencias", etiqueta: "Solicitar ausencias" },
  {
    codigo: "mi_zona.aprobar_ausencias",
    modulo: "Mi Zona",
    accion: "aprobar",
    etiqueta: "Aprobar ausencias del equipo",
  },
  { codigo: "mi_zona.nominas", modulo: "Mi Zona", accion: "nominas", etiqueta: "Ver nóminas" },
  { codigo: "mi_zona.equipo", modulo: "Mi Zona", accion: "equipo", etiqueta: "Ver datos del equipo" },
  { codigo: "mi_zona.admin", modulo: "Mi Zona", accion: "admin", etiqueta: "Admin RRHH / mapping Holded" },
];

export const PERFIL_COMPLETO_ID = "a0000000-0000-4000-8000-000000000001";
export const PERFIL_TRABAJADOR_ID = "a0000000-0000-4000-8000-000000000010";
export const PERFIL_JEFE_ID = "a0000000-0000-4000-8000-000000000011";
export const PERFIL_ADMIN_RRHH_ID = "a0000000-0000-4000-8000-000000000012";

export function esPermisoValido(v: string): v is Permiso {
  return (PERMISOS as readonly string[]).includes(v);
}

export function listarCatalogo(): PermisoMeta[] {
  return CATALOGO_PERMISOS;
}

/** `*.editar` implica `*.ver`. `mi_zona.admin` implica el resto de `mi_zona.*`. */
export function puedeConPermisos(
  permisos: readonly string[],
  esAdmin: boolean,
  requerido: Permiso,
): boolean {
  if (esAdmin) return true;
  const set = new Set(permisos);
  if (set.has(requerido)) return true;
  if (requerido.startsWith("mi_zona.") && set.has("mi_zona.admin")) return true;
  if (requerido.endsWith(".ver")) {
    const editar = requerido.replace(/\.ver$/, ".editar");
    return set.has(editar);
  }
  return false;
}
