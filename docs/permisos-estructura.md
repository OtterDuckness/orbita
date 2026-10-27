# Estructura de permisos (módulo + entidad)

Órbita combina **dos capas**. Ambas deben cumplirse (salvo admin).

```text
permitido = es_admin  OR  (permiso_de_módulo AND rol_en_la_entidad)
```

## Capa A — Permisos de módulo

Catálogo en perfiles / `usuario_permisos` (p. ej. `clientes.ver`, `clientes.editar`, `proyectos.*`, `tareas.*`).

- Deciden si el usuario puede **usar** el módulo.
- `*.editar` implica `*.ver`.
- `usuarios.es_admin` bypasea módulo y entidad.

Código: [`lib/permisos.ts`](../lib/permisos.ts), [`lib/authz.ts`](../lib/authz.ts), [`lib/usuarios.ts`](../lib/usuarios.ts).

## Capa B — Roles de entidad

Quién es el usuario **en este** cliente / proyecto / tarea.

| Rol | Campo / tabla | Significado |
|-----|---------------|-------------|
| Responsable del cliente | `clientes.responsable_id` | Dueño comercial de la cuenta |
| Responsable del proyecto | `proyectos.responsable_id` | Lead del proyecto (siempre en `proyecto_miembros`, no removible) |
| Colaborador | `proyecto_miembros` | Miembro del equipo del proyecto |
| Solicitante | `tareas.mandada_por_id` | Quién encarga la tarea |
| Asignado | `tareas.responsable_ids` (JSON) | Quién ejecuta (nombre legacy en BD; en producto = *asignados*) |
| Dueño personal | `proyectos.personal_de_id` | Tablero personal oculto de `/tareas` |

Código: [`lib/permisos-entidad.ts`](../lib/permisos-entidad.ts). Las mutaciones lo llaman tras `exigirPermiso(...)`.

## Reglas duras

1. **Solicitante y asignados ⊆ colaboradores** del proyecto. Si el pool está vacío, no hay solicitante ni asignados válidos.
2. El **responsable del proyecto** no se quita de colaboradores.
3. **Colaboradores** no gestionan el equipo ni las columnas.
4. En el tablero, un colaborador **ve todas** las tareas; solo **redacta** si es solicitante o asignado (o gestor).

## Matriz

| Acción | Resp. cliente | Resp. proyecto | Colaborador | Solicitante | Asignado |
|--------|:---:|:---:|:---:|:---:|:---:|
| Editar / borrar cliente | ✓ | — | — | — | — |
| Crear proyecto bajo el cliente | ✓ | — | — | — | — |
| Editar / borrar **este** proyecto | ✓ | ✓ | — | — | — |
| Gestionar colaboradores | ✓ | ✓ | — | — | — |
| Gestionar columnas (apartados) | ✓ | ✓ | — | — | — |
| Ver proyecto y todas sus tareas | ✓ | ✓ | ✓ (solo vista) | ✓ | ✓ |
| Crear tarea | ✓ | ✓ | ✓ | — | — |
| Editar tarea / mover columnas | ✓ | ✓ | — | propia | ✓ (asignada) |
| Borrar tarea | ✓ | ✓ | — | propia | — |
| Cambiar asignados | ✓ | ✓ | — | propia | — |
| Cambiar solicitante | ✓ | ✓ | — | — | — |
| Toggle notificar asignado | ✓ | ✓ | — | propia | — |
| Notas / chat / adjuntos | ✓ | ✓ | ✓ | ✓ | ✓ |

Proyectos **internos** (sin cliente): no aplica responsable de cliente; el responsable del proyecto (y admin) gestionan.

Proyectos **personales**: el dueño (`personal_de_id`) tiene control total de su tablero.

## Naming

- En BD, `responsable_ids` de una tarea = **asignados**.
- No confundir con `proyectos.responsable_id` ni `clientes.responsable_id`.
- No se ha renombrado la columna SQL en este cambio.

## Dónde se aplica

| Área | Archivos |
|------|----------|
| Helpers | `lib/permisos-entidad.ts` |
| Pool solicitante/asignados | `lib/tablero.ts` (`crearTarea`, `editarTarea`, `editarResponsablesTarea`) |
| Acciones cliente | `app/(portal)/clientes/acciones.ts` |
| Acciones proyecto / tablero | `app/(portal)/proyectos/acciones.ts` |
| Tareas personales / completar | `app/(portal)/tareas/acciones.ts` |
| Chat / adjuntos | `lib/tarea-chat.ts`, `app/(portal)/tareas/acciones-chat.ts` |
| Notas | `app/(portal)/notas-acciones.ts` |
| UI tablero / detalle | `app/(portal)/proyectos/[id]/page.tsx`, `tablero.tsx`, `tareas/detalle-tarea.tsx` |

## Admin

`es_admin` puede ver y mutar todo. Los listados con `?todo=1` siguen usando `alcanceProyectos` (solo admin).
