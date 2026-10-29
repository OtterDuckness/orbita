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
] as const;

export type Permiso = (typeof PERMISOS)[number];

export type PermisoMeta = {
  codigo: Permiso;
  modulo: string;
  accion: "ver" | "editar" | "web";
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
];

export const PERFIL_COMPLETO_ID = "a0000000-0000-4000-8000-000000000001";

export function esPermisoValido(v: string): v is Permiso {
  return (PERMISOS as readonly string[]).includes(v);
}

export function listarCatalogo(): PermisoMeta[] {
  return CATALOGO_PERMISOS;
}

/** `*.editar` implica `*.ver`. */
export function puedeConPermisos(
  permisos: readonly string[],
  esAdmin: boolean,
  requerido: Permiso,
): boolean {
  if (esAdmin) return true;
  const set = new Set(permisos);
  if (set.has(requerido)) return true;
  if (requerido.endsWith(".ver")) {
    const editar = requerido.replace(/\.ver$/, ".editar");
    return set.has(editar);
  }
  return false;
}
