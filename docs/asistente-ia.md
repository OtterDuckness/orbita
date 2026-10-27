# Asistente / Agente IA (Órbita)

Branch: `agenteia-sync`  
Status: feature branch only — **not merged to `dev`/`main`, not for prod**.  
Validation target: deploy to **`orbita-dev-mst`** (not local-first).

This document describes what the agent is, how it works, and — critically — **what it may and may not do**, including permissions, confirmations, and hard restrictions.

---

## 1. Purpose

Operational chat inside Órbita so an authenticated user can **query and act on** clients, projects, board tasks, client/project notes, task threads, team communications, and a day/week/month summary **without leaving the portal**, using the **same session permissions** as the UI.

It is **not** a general-purpose chatbot: no free SQL, no secrets, no user/permission admin. Public web (`web_search` / `web_fetch`) is optional and gated by `asistente.web`.

---

## 2. High-level architecture

```
UI  /asistente
  → POST /api/asistente
    → auth() + UsuarioAuth
    → create/open conversation (MySQL)
    → ejecutarTurno (lib/asistente/run.ts)
         → Anthropic Messages API (claude-haiku-4-5)
         → tool_use loop (max 8 rounds)
              → ejecutarTool → domain libs
         → persist messages + ia_uso
Admin  /admin/agente-ia   (es_admin only)
Admin  /admin/apartados   (kill switch agente_ia_activo, con el resto del menú)
Ajustes → BloqueGastosIa  (per-user spend estimate)
```

| Layer | Path |
|-------|------|
| Nav item | `lib/nav-mock.ts` → `/asistente` (hidden when `agente_ia_activo` off; toggle in `/admin/apartados`) |
| Chat page | `app/(portal)/asistente/page.tsx` |
| Chat UI | `app/(portal)/asistente/panel-asistente.tsx` |
| Confirm lightbox | `app/(portal)/asistente/confirmaciones-lightbox.tsx` (+ `lib/asistente/confirmacion-campos.ts` field whitelist) |
| Chat Markdown | `app/(portal)/asistente/mensaje-md.tsx` (assistant bubbles only) |
| API | `app/api/asistente/route.ts` |
| Kill switch | `lib/ajustes-globales.ts` → `ajustes.agente_ia_activo` |
| Orchestration | `lib/asistente/run.ts` |
| System prompt | `lib/asistente/system-prompt.ts` |
| Tools | `lib/asistente/tools.ts` |
| Name resolvers | `lib/asistente/nombres.ts` |
| Summary builder | `lib/asistente/resumen.ts` |
| Cost estimate | `lib/asistente/coste.ts` |
| Persistence | `lib/asistente/store.ts` |
| Admin panel | `app/(portal)/admin/agente-ia/page.tsx` |
| Admin chat viewer | `app/(portal)/admin/agente-ia/chats/` (+ `[id]`) |
| Legacy redirect | `app/(portal)/admin/gastos-ia/page.tsx` → `/admin/agente-ia` |
| Migration | `db/migrations/014_asistente_ia.sql` (+ `031_ia_uso_cache_web.sql`, `034_agente_ia_activo.sql`, `035_ia_tope_mensual.sql`) |

---

## 3. Model, secrets, runtime

| Item | Value |
|------|--------|
| Provider | Anthropic (`@anthropic-ai/sdk`) |
| Model | `claude-haiku-4-5` |
| `max_tokens` | 4096 |
| Prompt caching | Explicit `cache_control: ephemeral` on last tool + stable system block + **latest** `tool_result` only (prior round markers cleared; Anthropic max 4 breakpoints) |
| API route runtime | `nodejs`, `maxDuration = 300` |
| Env var | `ANTHROPIC_API_KEY` |
| Cloud Run secrets | `ANTHROPIC_API_KEY_DEV` / `ANTHROPIC_API_KEY_PROD` → env `ANTHROPIC_API_KEY` |
| Spend cap | Global: `IA_COSTE_MAX_USD_MES` (default **$5** / user / UTC month; `0`/`off`/`none` = disabled). Per-user override for the current UTC month: table `ia_tope_mensual` (admin UI `/admin/agente-ia`) |
| Cost estimate (code) | Haiku: $1/MTok input, $5/MTok output, $1.25/MTok cache write, $0.10/MTok cache read, $0.01/web_search — **not** the live invoice |

Missing API key → API returns `503` / `sin_api_key`.  
Spend cap hit → API returns `429` / `tope_gasto` before calling Anthropic.

---

## 4. Access control (who can use what)

### 4.1 Portal chat (`/asistente`)

1. User must be signed in via Google OAuth (NextAuth).
2. Email must resolve to a `UsuarioAuth` in Órbita (`obtenerUsuarioAuthPorCorreo`).
3. Otherwise API returns `401` (`no_auth`).
4. Team visibility switch: `ajustes.agente_ia_activo` (default **on**). Admins toggle it in `/admin/apartados` (same page as the rest of the side menu).
   - **On:** any signed-in user can use the chat (subject to their Órbita permissions for tools).
   - **Off:** non-admins lose access — nav item **Asistente** hidden, `/asistente` redirects to the first section they can open with `?aviso=apartado_off`, `POST /api/asistente` returns `403` / `agente_desactivado`.
   - **Admins always keep access** to the chat and API (and to `/admin/agente-ia`), even when the switch is off. With **Vista usuario** active, `esAdmin` is false so the admin sees the non-admin experience.
5. Opening `/asistente` (no `?c=`) starts a **new empty chat**. Pass `?c={id}` to reopen an existing conversation; `?nuevo=1` also forces a blank chat.
6. Chat loading uses local `useState` (not `useTransition`) so a long turn does not block App Router navigations elsewhere in the portal.
7. Composer: **Enter** sends; **Shift+Enter** inserts a newline (same as portal communications).

There is **no separate “AI permission”**. Capability is entirely:

- session auth, plus
- `puedeUsarAgenteIa(esAdmin)` (`agente_ia_activo` **or** admin), plus
- the user’s existing Órbita permissions (`usuario_permisos` / profile / `es_admin`).

Migration: `db/migrations/034_agente_ia_activo.sql` (`INSERT IGNORE … 'agente_ia_activo','1'`). Helpers: `agenteIaActivo` / `puedeUsarAgenteIa` / `guardarAgenteIaActivo` in `lib/ajustes-globales.ts`. The admin form lives in `/admin/apartados` and writes the same key via `guardarApartados` (`lib/apartados.ts`).

### 4.2 Admin panel (`/admin/agente-ia`)

- Requires `exigirAdmin()` (`es_admin`).
- Shows org-wide estimated spend, per-user totals, and per-chat stats (chats ordered by `actualizado_en` descending — newest first).
- Chat titles link to the read-only viewer; **Ver todos los chats** → `/admin/agente-ia/chats`.
- Non-admins cannot open this page.

### 4.2.1 Admin chat viewer (`/admin/agente-ia/chats`)

- List of all `ia_conversaciones` (optional `?usuario=` filter) → `/admin/agente-ia/chats/[id]`.
- Read-only transcript (`textoVisibleEnUi` + `MensajeMd`); no send UI.
- Uses `obtenerConversacionAdmin` (any chat by id, no owner check) after `exigirAdmin()`.
- User portal isolation is unchanged: `/asistente?c=` still 404s for another user’s chat.

### 4.2.2 Audit logs (`/admin/logs`)

Mutating tools write the same `admin_logs` actions as the UI (create/edit/delete client & project, task create/edit/move/complete/assignees/delete, invitation, project state changes).

| Field | Value when action came from the agent |
|-------|----------------------------------------|
| `actor_id` | Session user id (filter-by-person still works) |
| `actor_correo` | `agente_ia_<email-local-part>` (e.g. `agente_ia_mandn`) |
| `meta.via` | `"asistente"` |
| `meta.conversacionId` | Chat id → log row links to `/admin/agente-ia/chats/[id]` |

Read-only tools, notes, checklist, and messaging are **not** logged here. Chat bodies stay in `ia_mensajes` / `ia_conversaciones` (viewer above).

### 4.3 Conversation isolation

- Conversations are owned by `usuario_id`.
- Opening another user’s `conversacionId` in `/asistente` → `404` `conversacion_ajena`.
- Users only see their own chat history in the user UI.
- Admins may open any chat via `/admin/agente-ia/chats/[id]` only.

### 4.4 Sandbox vs production database

The agent does **not** pick a database. It uses the same session switch as the portal (`cookie orbita_sandbox` → `getPool()` → `orbita` or `orbita_pruebas`). Only an admin can enable sandbox, and only for **their** session.

| Surface | Production session | Sandbox session |
|---------|--------------------|-----------------|
| Tools (clients, projects, tasks, notes, comms, `resumen_periodo`) | `orbita` | `orbita_pruebas` |
| Chat history + `ia_uso` spend rows | `orbita` | `orbita_pruebas` (isolated; opening a `?c=` id from the other DB → `404`) |
| Login, Google tokens, last-access | always `orbita` (`runWithProdDb`) | same |
| Outbound email / Calendar writes | as in UI | **no-op** (same as UI sandbox) |
| `web_search` / `web_fetch` | public internet | public internet (not mocked) |

Apply `db/schema.sql` plus migrations `014` and `030` on **`orbita_pruebas`** or the agent will fail in sandbox.

The system prompt includes an explicit **MODO PRUEBAS** vs **MODO DATOS REALES** block so the model does not present mock CRM as production (or invent a sandbox when there is none). Prompt rules are soft; isolation is the two MySQL databases.

### 4.5 Permission model for tools

Each tool declares `permiso: Permiso | null`.

- `null` → available to **any** authenticated Órbita user (still subject to handler logic).
- Otherwise → tool is **omitted from the Anthropic tool list** via `toolsParaUsuario`, and **re-checked** in `ejecutarTool` (`sin_permiso` if missing).

`es_admin` bypasses permission checks the same way as the rest of Órbita (`usuarioPuede`).

Relevant permission codes (from `lib/permisos.ts`):

| Code | Meaning |
|------|---------|
| `clientes.ver` / `clientes.editar` | Read / mutate clients |
| `proyectos.ver` / `proyectos.editar` | Read / mutate projects & project types |
| `tareas.ver` / `tareas.editar` | Read / mutate board tasks & columns |
| `comunicaciones.ver` / `comunicaciones.editar` | Read / mutate DMs & groups |
| `asistente.web` | Anthropic `web_search` + `web_fetch` (public internet). Admins always; others via Admin → Permisos. Migration `030` grants it to perfil Completo. |

---

## 5. Hard restrictions (what the agent must not do)

Enforced by product design + system prompt + missing tools (not by a separate policy engine):

| Restriction | How it is enforced |
|-------------|--------------------|
| Internet / web (default off per user) | Server tools only if `asistente.web`; see §8.5 |
| No free SQL | No SQL tools; only domain lib calls |
| No secrets / env access | No tools; prompt forbids it |
| No user / profile / permission admin | No tools for admin usuarios/permisos/ajustes globales |
| No MCP | Not wired in this MVP |
| No generic Google Calendar events | Calendar only via task sync (`syncCalendar` on create/edit/delete task) |
| No Gmail send / mark-read / star via agent | Only `buscar_correos` + `leer_correo` (`correo.ver`); no write tools |
| No inventing IDs or metrics | Prompt: search by name; use `resumen_periodo` for day/week/month stats |
| No pretending an action succeeded | Prompt: only act via tools; if no tool, say so |
| Mixing sandbox and production CRM | Two MySQL DBs via `getPool()`; prompt names the active mode; Calendar/email no-op in sandbox |
| Writes that are ambiguous or mass | Prompt: clarify before acting |
| No create/rename project types | Tools removed; `listar_tipos_proyecto` is read-only; prompt says use UI |
| No create/reorder board columns | Tools removed; `listar_columnas` is read-only; prompt says use UI |
| No move task to another project | `mover_tarea` is column-only; prompt: recreate (delete+create) instead |
| Modules not in MVP (billing, jornada, etc.) | No tools |

**Important:** prompt-level rules are soft. Permission filtering and the absence of tools are the hard gates. Confirmation flags are a second soft gate (see §7).

---

## 6. Project / task scope (data visibility)

Beyond permission codes, handlers apply **resource scope**:

### Projects

- Listings (`buscar_proyectos`, task listing without id, etc.) use `alcanceProyectos(usuario, verTodo)`:
  - default `verTodo=false` → typically **only projects where the user is responsable or collaborator**
  - admin may pass `verTodo=true` (same as UI `?todo=1`) to list **all** projects
- By project id (`exigirProyecto`):
  - non-admin: must belong to the project, else `sin_acceso`
  - **admin:** can access a project **by UUID** even if not a member

### Tasks / columns

- Task mutations (`exigirTareaEnProyecto`: assign/edit/move/notes/checklist/delete, etc.) use `puedeAccederTarea` — same as `/tareas` and `alternar_completada_tarea`: project member, admin, assignee, requester, or **own personal board**. (Resolving a project by id still hides `personalDeId` boards; do not use `exigirProyecto` alone for task mutations.)
- `listar_mis_tareas` mirrors `/tareas` (`tareasDelUsuario`): assigned to me, requested by me, or personal board — independent of project-list scope. Returns `{ total, mostradas, truncado, tareas }` so count questions get a real number even when the list is capped. Supports creation filters: `creadasDesde` / `creadasHasta` (YYYY-MM-DD in the session timezone), `soloCreadasPorMi`, `orden` (`creado_desc` / `creado_asc`), `limite`. With a creation filter, completed tasks are included unless `incluirCompletadas=false`. Same creation filters exist on `listar_tareas`; `responsableId` alone, or `atrasadas` / due-date filters alone, also satisfy the “need a scope” rule (no `proyectoId`/`query` required).
- **Open tasks** (default `listar_tareas` / `listar_mis_tareas`, `contarTareasAbiertasMap`, `resumen_periodo` project open counters): exclude fixed columns **Terminadas** and **Rechazadas / eliminadas**. Rejected tasks keep `completadaEl=null`, so column checks are required (not only `completadaEl`). Rechazadas never appear in `listar_tareas` (same as `/tareas`); Terminadas only with `incluirCompletadas=true`.
- **Column structure is read-only** via the agent (`listar_columnas` only). Create/reorder columns in the UI.
- Creating/editing a task with Calendar sync uses the **session user’s** Google tokens (`sincronizarTareaConCalendar`).

### Attribution scopes (`resumen_periodo`)

`resumen_periodo` returns **nested** buckets so personal action and project-scope activity cannot be flattened into one “you did N” count:

| Bucket | Meaning | “You created/completed” allowed? |
|--------|---------|----------------------------------|
| `atencion` | Advisory brief: `guion` (`diagnostico`, `capacidad`, `planHoy`, `planSemana`, optional `unEnlace`, `cierre`) — patterns & priorities, not task names; `porCliente` counts; `totales` | N/A — paraphrase; never dump `/tareas` |
| `personal` | Session user only: `creadasPorMi`, `completadasPorMi`, `/tareas` inbox (`misTareas*`, `tareasNuevasSinVer` + `tareasNuevasSinVerTotal`, `chatsTareaSinLeer`) | **Yes** — use these lists/counters |
| `proyectos` | Activity on scoped project boards: `creadas`, `completadas` (+ `completadaPor`), `atrasadas`, `vencenEnPeriodo`, `proyectosActivos`; counters include `completadasPorMi` / `completadasOtros` | **No** for raw `completadas` — use actor names; for «me vs team» use the split counters |
| `comunicaciones` | DM/group unread (`noLeidos`) | N/A (not task chat) |
| `atribucion.reglas` | Machine-authored rules repeated in the tool payload | Must follow |

- Day/week/month answers should **paraphrase `atencion.guion`** in dry, scannable Markdown sections (`Patrón` / `Capacidad` / `Hoy` / `Esta semana` / `Cierre`) — not a wall of prose, not task-name bullets. Flat task arrays under `personal.*` / `proyectos.*` are **intentionally empty**; counters remain full.
- `periodo`: `diario` (today), `semanal` (calendar week **Monday–Sunday** in the session timezone), `mensual` (~last 30 days ending today). Range is in `desde` / `hasta`.
- `mandadaPor` = who requested/created the task; `completadaPor` = who toggled complete (from `admin_logs` when known). They are different.
- **`contadores` and `atencion.totales` are full totals**. «Me vs team» → `personal.contadores.completadasPorMi` vs `proyectos.contadores.completadas` / `completadasOtros`.
- `personal.contadores.completadasPorMi` / `tareasNuevasSinVerTotal` / `contadores.nuevasSinVer` match the full sets.
- Do **not** reintroduce root aliases like `creadasEnPeriodo` / flat `completadasEnPeriodo`.
- Prompt points at these buckets; do not stack more one-off “except when…” rules without updating this section.

### 6.1 Names vs UUIDs

Domain libs still use UUIDs. The agent layer maps both ways (`lib/asistente/nombres.ts`):

| Surface | Rule |
|---------|------|
| Chat text (user + assistant) | Names / labels only. Final assistant text is UUID-scrubbed **except** UUIDs inside Markdown link hrefs (e.g. `[etiqueta](/proyectos/{id})`). |
| Tool **args** (`clienteId`, `proyectoId`, `tareaId`, `responsableId`, `columnaId`, `tipoId`, `conversacionId`, `otroUsuarioId`, `miembroIds`, checklist `itemId`, …) | UUID **or** unique name (project also matches UI label `Cliente · tipo`). |
| Tool **results** | Keep `id` for follow-up calls; always include `nombre` / `etiqueta` / `clienteNombre` / `{ nombre, eresTu }` so the model does not invent labels. Project compacts include `url` (`/proyectos/{id}`); task compacts include `url` (`/tareas?tarea={id}` — not `/tareas/{id}`). |
| `error: "ambiguo"` | 2+ matches; `candidatos` with names. Prompt: ask which. |
| `error: "no_encontrado"` | No match in the user’s scope. |

Type-only refs («abre el proyecto SEO», «proyectos Web»): use `buscar_proyectos`, not `obtener_proyecto`. If several match, list all (table + optional `[etiqueta](url)` links) and ask which; never pick one silently.

Access checks run after resolve (same as before).

### Communications

- List/read/send operate on conversations the user participates in (via `lib/comunicaciones`), same as the UI.

### Client / project notes

- Separate from task notes (`guardar_notas_tarea`). Agent is **read-only** via `listar_notas_cliente` / `listar_notas_proyecto`.
- Project notes require project access (`exigirProyecto`); client notes require `clientes.ver`.

### Task chat

- `leer_mensajes_tarea` / `enviar_mensaje_tarea` use `puedeAccederTarea` (same as UI). Not the same tools as communications DMs/groups.
- Reading marks the thread seen (`marcarChatTareaVisto`). No attachments via the agent.

### Team search

- `buscar_miembro` has `permiso: null` (any authenticated user).
- Returns `{ id, nombre }` for non-admins; admins also get `email`.
- Resolve (`resolverMiembro`) and search match on **nombre and email** (diacritic-insensitive; first-name / email local-part preferred). Non-admins still do not receive emails in the payload.

---

## 7. Confirmation rules

Tools with `requiereConfirmacion: true` use a **server two-turn lock** (`confirmacionDosTurnosOk` in `historial.ts`):

1. First call (even with `confirmado: true`) → refused with:
```text
{ error: "requiere_confirmacion", mensaje: "…", pendiente: { tool, clave, resumen } }
```
   `clave` identifies the target (and args fingerprint when needed). `resumen` is a short Spanish label for the UI.
2. `ejecutarTurno` **stops the tool loop** when any tool returns that result (no extra LLM round). It keeps any model text from the same turn, or synthesizes a short confirm message listing pending actions.
3. **UI** (`confirmacionesPendientesEnHistorial`): a **lightbox** lists every open challenge with a **field preview** of the pending args (`confirmacion-campos.ts` + `args` on each pendiente), per-item **Confirmar** / **Rechazar**, plus **Confirmar todas** / **Cancelar todas** when there are 2+. Editable payload fields use the same portal widgets where possible: `CampoFecha` for dates, team multi/single selects for people, and fixed selects for `prioridad` / `estado` / `ambito` / project `tipoId` (equipo + tipos loaded on `/asistente`). For task assignee fields, the people picker is limited to the **project collaborator pool** (`poolIds` on each pendiente) — same rule as `crearTarea` (assignees ⊆ project team). Destination IDs (`clienteId`, `proyectoId`, `tareaId`, …) stay locked — the server merges only whitelisted editable keys via `fusionarArgsEditados` (`POST` may send `argsEditados` with `accion: "confirmar"`). Board `columnaId` remains free text for now (needs project column resolution). **Confirmar todas** always uses the agent’s original args (no per-item edits). Lightbox confirm runs `ejecutarTool(…, { confirmadoPorUi: true })` so edited args cannot re-trigger `requiere_confirmacion` via a changed `clave`/`firmaArgs`. A single `borrar_tarea` with many `tareaIds` returns `pendientes[]` (one challenge per task) so the lightbox shows all of them. Confirm summaries resolve **names** (not raw UUIDs) via `resumenConfirmacionLegible`. `claveConfirmacion` for writes like `crear_tarea` **resolves** proyecto/columna/responsables first — invalid names return `no_encontrado`/`ambiguo` **before** the lightbox (so the user never confirms a doomed create). `POST /api/asistente` with `accion: "confirmar" | "cancelar" | "confirmar_todas" | "cancelar_todas"` (optional `tool` + `clave` for one item; optional `argsEditados` on single confirm) applies the write in `confirmacion-ui.ts`. After the **last** successful confirm (no pendientes left), the API starts another LLM turn (`ejecutarTurno` + `continuarTrasConfirmacion`) so multi-step asks like “delete and recreate” can continue without the user typing again. Cancel does not continue.
4. Typed path: user sends an **affirmative** message («sí» / «yes» / «confirmar»…); that unlocks **all** open challenges for the model. «cancelar» / «no» reject. Per-item UI uses control messages (`__confirm__:tool:clave`, etc.) so other items stay open.
5. Same-turn retry after the challenge (no new user message) stays blocked. «delete it» alone is the request, not the confirmation. The model must **call the tool first** (not ask in prose before the gate).

**With confirmation (writes / sends / restore):**  
`crear_cliente`, `editar_cliente`, `enviar_invitacion_cliente`, `eliminar_cliente`, `crear_proyecto`, `editar_proyecto`, `cambiar_estado_proyecto`, `eliminar_proyecto`, `crear_tarea`, `editar_tarea`, `mover_tarea`, `alternar_completada_tarea`, `asignar_responsables_tarea`, `guardar_notas_tarea`, `borrar_tarea`, `restaurar_eliminado`, `crear_grupo`, `enviar_mensaje`, `enviar_mensaje_tarea`.

**Without confirmation:** reads/queries, `checklist_anadir`, `checklist_toggle`, `abrir_dm`, `marcar_leido`.

Board column structure and project-type catalogue are **not writable** via the agent.

---

## 8. Full tool catalogue

### 8.1 Clients

| Tool | Permiso | Confirm | Effect |
|------|---------|---------|--------|
| `buscar_clientes` | `clientes.ver` | No | Read. Returns `{ total, mostradas, truncado, clientes }` (cap ~30). Count → `total`; list → all returned rows. |
| `obtener_cliente` | `clientes.ver` | No | Read |
| `crear_cliente` | `clientes.editar` | **Yes** | Write (`nombre`, `correoAcceso` required; optional `telefono`, invite). `origen` always `manual` (not agent-settable) |
| `editar_cliente` | `clientes.editar` | **Yes** | Patch ficha (owner = `responsableId`, `telefono`). Omitted fields kept; `origen` preserved. Not project leads. |
| `enviar_invitacion_cliente` | `clientes.editar` | **Yes** | Write (invite marking) |
| `eliminar_cliente` | `clientes.editar` | **Yes** | Delete client **and** all its projects into `eliminaciones` paper trail (~30d; UI `/eliminados`); confirm may include `proyectosQueSeBorran`. Client-linked communications chats are hard-deleted and **not** restored. |
| `listar_notas_cliente` | `clientes.ver` | No | Read client-file notes (not task notes; max ~40) |

### 8.2 Projects & types

| Tool | Permiso | Confirm | Effect |
|------|---------|---------|--------|
| `buscar_proyectos` | `proyectos.ver` | No | Read scoped list. Returns `{ total, mostradas, truncado, proyectos }` (cap ~40). `estado`: `activo` (default, like `/proyectos`) \| `terminado` \| `archivado` \| `todos`. Admin optional `verTodo`. Prefer for type/homonym queries (SEO, Web…). Items include `url`. Prompt: announce `total`; table with **all** returned rows. |
| `obtener_proyecto` | `proyectos.ver` | No | Read one project (+ admin id bypass). Not for type-only refs; includes `url`. |
| `crear_proyecto` | `proyectos.editar` | **Yes** | Write. «tipo for client» → `externo` + `tipoId` + `clienteId`; own `nombre` optional. `ambito` / `responsableId` optional (default externo if client, else interno; lead = session user) |
| `editar_proyecto` | `proyectos.editar` | **Yes** | Patch + access check. Only changed fields required (`proyectoId` only). Project lead ≠ client owner. |
| `cambiar_estado_proyecto` | `proyectos.editar` | **Yes** | Write (`activo` / `terminado` / `archivado`) |
| `eliminar_proyecto` | `proyectos.editar` | **Yes** | Delete project + board/tasks into paper trail (~30d) |
| `listar_tipos_proyecto` | `proyectos.ver` | No | Read only (no create/rename tools) |
| `listar_notas_proyecto` | `proyectos.ver` | No | Read project-file notes (not task notes; max ~40) |

### 8.3 Tasks / board / Calendar

| Tool | Permiso | Confirm | Effect |
|------|---------|---------|--------|
| `listar_tareas` | `tareas.ver` | No | Read tasks. Returns `{ total, mostradas, truncado, tareas }` (**slim** rows, includes `url` `/tareas?tarea={id}`). `total` = full match count; list capped by `limite` (default/max ~40). Scope: `proyectoId` and/or `query` and/or `responsableId` and/or `atrasadas`/`vencenDesde`/`vencenAntes` and/or creation filters. Default = open only (no Terminadas / Rechazadas). Prompt: render **all** returned rows in a table (no “top N” prose). Count questions → `total`. |
| `listar_mis_tareas` | `tareas.ver` | No | Read `/tareas` board (`tareasDelUsuario`). Same shape; default cap ~80. «Mis atrasadas» → `atrasadas=true`. Creation filters + `orden`/`limite`. Count questions → `total`. |
| `obtener_tarea` | `tareas.ver` | No | Read full compact (includes notas + checklist + `url`) |
| `crear_tarea` | `tareas.editar` | **Yes** | Write + optional Calendar |
| `editar_tarea` | `tareas.editar` | **Yes** | Write + Calendar sync |
| `mover_tarea` | `tareas.editar` | **Yes** | Write column/index **within the same project** (not cross-project) |
| `alternar_completada_tarea` | `tareas.editar` | **Yes** | Toggle complete/reopen (`alternarCompletadaTarea`) |
| `asignar_responsables_tarea` | `tareas.editar` | **Yes** | Write. Accepts `responsableIds` as array **or** a single name string (models often send a string). Empty parse → `falta_dato`. Assignees must be project collaborators; if none are, returns `no_asignado` **before** writing (does not clear existing assignees). |
| `guardar_notas_tarea` | `tareas.editar` | **Yes** | Replace notes |
| `checklist_anadir` | `tareas.editar` | No | Write |
| `checklist_toggle` | `tareas.editar` | No | Write |
| `listar_columnas` | `tareas.ver` | No | Read only (no create/reorder tools) |
| `borrar_tarea` | `tareas.editar` | **Yes** | Delete into paper trail (~30d) + Calendar cleanup. Prefer one call with `tareaIds=[…]`; server expands to **N per-task confirmations** in the lightbox (`pendientes[]`). Single `tareaId` still works. |
| `leer_mensajes_tarea` | `tareas.ver` | No | Read task chat (~last 40); marks thread seen |
| `enviar_mensaje_tarea` | `tareas.editar` | **Yes** | Write task-chat message |

### 8.3.1 Paper trail (trash)

| Tool | Permiso | Confirm | Effect |
|------|---------|---------|--------|
| `listar_eliminados` | `null` (filtered by caller’s `*.editar`) | No | Lists unrestored, non-expired `eliminaciones` (max ~40); optional `tipo` |
| `restaurar_eliminado` | `null` (enforces matching `*.editar` in handler) | **Yes** | Restores by `eliminacionId` and/or `eliminacionIds` (batch = one confirmation clave). Per-item failures returned in `fallos`; rest still restored |

UI: `/eliminados`. Migration: `db/migrations/032_eliminaciones.sql`. Retention: 30 days.

### 8.3.2 Reversible actions (deshacer)

| Tool | Permiso | Confirm | Effect |
|------|---------|---------|--------|
| `listar_acciones_deshacer` | `null` (own actions only) | No | Lists non-undone, non-expired rows in `acciones_reversibles` for the session user (UI + asistente, max ~40) |
| `deshacer_accion` | `null` (must be actor) | **Yes** | Applies stored `before_json` (or trash restore for `eliminacion`). Fails with `conflicto` if current state ≠ `after_json` |

UI: `/ajustes/deshacer` (tab under Ajustes, like Admin tabs). Migration: `db/migrations/036_acciones_reversibles.sql`. Retention: 7 days. Writers register via `registrarAccionReversible` (UI actions + agent tools): move/complete/edit/assignees, project status, **client ficha edit** (`cliente_editado`), deletes (→ trash id).

### 8.4 Team, communications, Gmail, summary

| Tool | Permiso | Confirm | Effect |
|------|---------|---------|--------|
| `buscar_miembro` | `null` | No | Read team slice; **email only if admin** |
| `listar_conversaciones` | `comunicaciones.ver` | No | Read (includes per-conversation `noLeidos`) |
| `leer_mensajes` | `comunicaciones.ver` | No | Read (~last 40) |
| `abrir_dm` | `comunicaciones.editar` | No | Write (open/create DM) |
| `crear_grupo` | `comunicaciones.editar` | **Yes** | Write |
| `enviar_mensaje` | `comunicaciones.editar` | **Yes** | Write message (DMs/groups) |
| `marcar_leido` | `comunicaciones.ver` | No | Write read state |
| `buscar_correos` | `correo.ver` | No | Read Gmail threads (`listarCorreos`). `filtro`: `todos` (default, read+unread) \| `no_leidos` (only if user asks unread). `carpeta` inbox\|sent; optional `busqueda` (Gmail `q`), `conAdjuntos`, `limite` (~15–25), `pageToken`. Returns `noLeidosEnPagina` / `leidosEnPagina` + per-row `unread`. Gates: apartado correo + OAuth; refused in sandbox. Does **not** send, mark read, or star. |
| `leer_correo` | `correo.ver` | No | Read one thread (`leerHilo` by `threadId`). Plain-text body (HTML stripped/truncated ~4k); attachment **metadata only**. Does **not** mark as read (unlike `/correo` UI). |
| `resumen_periodo` | `null` | No | Nested `atencion.guion` (diagnostico/capacidad/planHoy/planSemana) + `porCliente` counts + `personal`/`proyectos` **counters** (task lists empty) + `comunicaciones` + `atribucion.reglas`. `periodo`: `diario` \| `semanal` \| `mensual`. See §6. |

Gmail ≠ internal chat: use `buscar_correos` / `leer_correo` for the user’s mailbox; `listar_conversaciones` / `leer_mensajes` for Órbita DMs/groups. Send/reply stays in `/correo` (no agent tools).

If the user lacks a permission, that tool simply does not appear to the model for that turn.

**Removed (intentionally):** `crear_tipo_proyecto`, `renombrar_tipo_proyecto`, `crear_columna`, `reordenar_columna` — structural catalogue/board edits belong in the UI. `contar_no_leidos` — unread total is in `resumen_periodo.comunicaciones.noLeidos` and `listar_conversaciones[].noLeidos`.

### 8.5 Web (Anthropic server tools)

Not client tools in `tools.ts`. Wired in `lib/asistente/web.ts` and merged into the Messages `tools` array in `run.ts` when `usuarioPuede(..., "asistente.web")`.

| Tool | Type | Limits | Effect |
|------|------|--------|--------|
| `web_search` | `web_search_20250305` | `max_uses` **3** / request | Public search snippets + citations |
| `web_fetch` | `web_fetch_20250910` | `max_uses` **2** / request; `max_content_tokens` **20000** | Full page/PDF text for a URL (often after search) |

Optional env (CSV of domains; empty = open web):

| Env | Meaning |
|-----|---------|
| `IA_WEB_ALLOWED_DOMAINS` | If set, only these domains (blocks `IA_WEB_BLOCKED_DOMAINS`) |
| `IA_WEB_BLOCKED_DOMAINS` | Used only when allow-list is unset |

Server-tool results are executed by Anthropic (no `ejecutarTool`). `pause_turn` continues the loop. Large `web_*_tool_result` blocks are stripped before DB persist. Prompt: separate Órbita vs internet; cite sources; no secrets in queries; do not invent CRM writes from the web.

---

## 9. System prompt rules (soft policy)

From `getSystemPrompt()`:

**Session user:** API resolves display name like the portal layout (`usuarios.nombre` → Google `session.user.name` → email) and injects `USUARIO ACTUAL: {nombre}` (no UUID). Person refs in tool payloads use `{ nombre, eresTu }`; `eresTu=true` → answer as “tú”.

**Grounding / anti-hallucination:**
- Only mention people/assignments present in the current turn’s tool results.
- Do not invent names or fill gaps from chat history.
- Never write bare UUIDs/ids in chat; use `nombre` / `etiqueta` / `eresTu`. Ids in tool results are for follow-up tool calls only. Exception: Markdown internal links may use `url` from the tool result in the href only.
- Do not invent IDs; pass the user’s name (or an id from the last tool result). On `ambiguo`, ask using candidate names.
- Type-only / open-project requests («abre el proyecto SEO») → `buscar_proyectos`; if several, list all and ask; do not silently pick one. Open in UI via `[etiqueta](url)`.
- Create task without a named project → ask (do not pick a default). If you offered «personal/interna» vs projects and the user replies «personal» / «interna» / «internal», treat it as **internal ambit**, not a project title — do not `buscar_proyectos("personal")`; list internal projects or offer to create one.
- Final assistant text is scrubbed of UUID patterns before persist/return, preserving UUIDs inside Markdown link hrefs.
- After UUID scrub, `alinearListadoRespuesta` (`lib/asistente/listado-respuesta.ts`) may rebuild the first Markdown table/list from the turn’s list tool results (`buscar_proyectos` / `listar_*_tareas` / `buscar_clientes`) when row count ≠ tool items, and realign prose (`(N total)`, `mostrando N de ellas`, `Hay N más`). Count-only answers without a table/list are left alone.

**Style (conversational):**
- Colleague tone: warm, clear, brief — **español de España**, tuteo (`tú`/`te`/`ti`); never Rioplatense voseo (`vos`, `querés`, …).
- Lead with a 1–2 sentence answer; add detail only if needed.
- Prefer short prose; lists for discrete items; **GFM tables** when listing/comparing several entities with the same fields (header + `|---|` separator + rows, same column count).
- Chat UI renders a Markdown subset in assistant bubbles (bold, lists, tables, links, fenced code). No HTML. Links open in the **same** tab (no `target=_blank`). A fenced/inline code span that is only a Markdown link is rendered as a real `<a>` (models often wrap `[label](url)` in backticks). Avoid decorative emoji, report-style headings, and heavy bold.
- Do not invent metrics; say so naturally when data is missing.

**Tools / limits:**
- Act only via tools; do not fake completion. Prefer each tool’s `description` for routing.
- Do not invent IDs; pass the user’s name or an id from a prior tool result. On `ambiguo`, ask using candidate names.
- Day/week/month summary → `resumen_periodo` only. Paraphrase `atencion.guion` (patterns, capacity, today vs week plan). Do **not** inventory overdue/new tasks by name. Nested scopes (§6); «Me vs team» → counters.
- “What should I look at today/this week/this month?” → `atencion.guion`; `comunicaciones.noLeidos` is DMs/groups, not task chat.
- Client account owner → `editar_cliente`. Project lead → `editar_proyecto`.
- `crear_cliente` requires user-provided `correoAcceso`; never invent an email (not even in sandbox).
- Clear writes; clarify if ambiguous or bulk.
- Sends/deletes: two-turn server confirm (§7). Call the write tool immediately; the lightbox is the confirmation UI. Never ask in prose for «sí»/«yes» instead of the lightbox. «delete it» is the delete request (call `borrar_tarea`), not the unlock «yes». Typed «sí» / lightbox Confirmar → model may call again with `confirmado: true`.
- Client/project ficha notes are **read-only** via the agent for now; say so if asked to write them.
- No user/permission admin, secrets, or SQL.
- No create/rename project types or create/reorder board columns (UI only).
- Respect session permissions (tools already filtered).
- If `asistente.web`: use `web_search` / `web_fetch` for public company/sector info; prefer internal ficha first; label Órbita vs internet; cite; never put internal secrets in queries. Without the permission: say web is unavailable.

**Calendar / scheduling:**
- Session date uses the **user’s timezone** (`usuarios.timezone`, default `Europe/Madrid`). Tool results’ ISO datetimes are normalized to that zone in `ejecutarTool` (`normalizarDatetimesParaAgente`) so new tools inherit correct display without per-tool formatting.
- Each turn injects the next **14 laborable days** (Mon–Fri, excluding Madrid/national holidays from `lib/festivos.ts`) with `YYYY-MM-DD` + weekday label, plus upcoming holidays in the next ~21 calendar days.
- When proposing or writing task dates (`fechaPrevista` / `fechaMaxima`), use only those laborable days unless the user explicitly asks for weekend/holiday. Do not invent weekday↔date mappings.

Language: reply in the user’s language (default **Spanish (Spain)** / tuteo, not voseo).

---

## 10. Turn lifecycle

1. UI `POST /api/asistente` with `{ conversacionId?, mensaje }`.
2. Auth + resolve `UsuarioAuth`.
3. Open existing conversation (must belong to user) or create one with provisional title `Nueva conversación`.
4. `ejecutarTurno`:
   - enforce monthly spend cap (`topeMensualUsd` vs `gastosUsuario.mes`)
   - persist user message
   - rebuild history via `mensajesParaApi` + `recortarMensajesApi` (last **40** API messages), including structured `tool_use` / `tool_result` envelopes from prior turns
   - build tool list with `toolsParaUsuario` + `toolsWebParaUsuario` (`asistente.web`); mark last tool + stable system block for prompt cache
   - system prompt = stable block (cached) + session block (date, user, sandbox/web mode)
   - up to **8** Anthropic rounds of tool_use → persist assistant tool-use JSON + tool results → `tool_result` (last result marked for cache)
   - persist final assistant **plain text** reply (Markdown source) + `ia_uso` row (tokens + cache + web_search + estimated USD)
   - **after the first turn only**: Haiku call (`lib/asistente/titulo.ts`) writes a short summary title (≤8 words) to `ia_conversaciones.titulo` and records a separate `ia_uso` row
5. JSON response includes text + optional `titulo` + usage estimate (chat UI shows user + final assistant text; hides tool-use envelopes). Assistant bubbles render a GFM subset (bold, lists, tables, links, fenced code); user bubbles stay plain text.

**Legacy titles:** opening `/asistente` runs `regenerarTitulosLegacy` (max **4** chats per page load, in parallel). Chats whose title still equals the truncated first user message (or `Nueva conversación`) get the same Haiku summary treatment.

Operational caps: `MAX_RONDAS = 8`, `MAX_HISTORIAL = 40`, tool result truncation (~12k), list size limits, plus monthly USD spend cap.

---

## 11. Persistence

Migration: `db/migrations/014_asistente_ia.sql`.

| Object | Role |
|--------|------|
| `usuarios.ultimo_acceso_en` | Last access stamp (login path) |
| `ia_conversaciones` | Per-user chats |
| `ia_mensajes` | `user` / `assistant` / `tool` rows; tool turns use JSON envelopes (`assistant_tool_use`, `tool_result`) for API replay |
| `ia_uso` | Per-turn model, tokens, estimated `coste_usd` |
| `ia_tope_mensual` | Optional per-user spend cap for a UTC month (`mes_utc` + `tope_usd`) |
| `admin_logs` | Domain mutations from agent tools (actor `agente_ia_*`, meta `via` + `conversacionId`) — see §4.2.1 |

`resumen_periodo` is computed live — not stored as a summary document.

---

## 12. Cost tracking and spend cap

- Every successful turn records estimated USD in `ia_uso`, including:
  - `input_tokens` / `output_tokens`
  - `cache_creation_tokens` / `cache_read_tokens` (prompt cache)
  - `web_search_requests` (Anthropic server tool; billed ~$10 / 1k searches)
- Chat **title** generation (first turn + legacy backfill) is a separate short Haiku call and also writes to `ia_uso`; it respects the same monthly spend cap.
- Cost formula in `lib/asistente/coste.ts` sums base input/output + cache write/read + web searches.
- User sees personal spend + configured tope in Ajustes (`BloqueGastosIa`).
- Admins see org rollups on `/admin/agente-ia`, and can set a **per-user tope for the current UTC month** (input + Guardar on each usage card).
- **Hard monthly cap (estimated USD)**:
  - Global default: `IA_COSTE_MAX_USD_MES` (default `$5` / user / UTC month; `0`/`off`/`none` = disabled).
  - Optional override in `ia_tope_mensual` (`usuario_id` + `mes_utc` `YYYY-MM` + `tope_usd`). Empty field clears the override (back to global). `0` = no cap for that user that month.
  - Effective tope resolved by `topeMensualEfectivo` (`lib/asistente/tope.ts`); checked at the start of `ejecutarTurno` / title generation against sum of `ia_uso` for that user this month.
  - Applies to all users including admins.
  - Cap uses **estimated** prices in code, not Anthropic invoices.
  - Overrides do **not** roll over to the next UTC month.
- Apply migrations `031_ia_uso_cache_web.sql` and `035_ia_tope_mensual.sql` on `orbita` and `orbita_pruebas` before deploying this tracking.

---

## 13. Deploy & test on `dev-mst` (branch-only)

Assumptions for this branch:

- Changes stay on `agenteia-sync` (or a branch derived from it).
- **Do not** merge to shared `dev`/`main` or deploy prod until explicitly decided.
- Primary validation: Cloud Run **`orbita-dev-mst`**.

Checklist:

1. Ensure DB used by `orbita-dev-mst` has migrations `014_asistente_ia.sql`, `031_ia_uso_cache_web.sql`, `032_eliminaciones.sql`, `033_usuario_timezone.sql`, and `035_ia_tope_mensual.sql` applied.
2. Ensure DEV secret `ANTHROPIC_API_KEY_DEV` is mapped to `ANTHROPIC_API_KEY` for that service.
3. Confirm `IA_COSTE_MAX_USD_MES` is set on the service (deploy scripts default to `5`).
4. From repo root (PowerShell), on this branch:

```powershell
.\scripts\deploy-dev-mst.ps1
# or: .\scripts\deploy-dev.ps1 -Who mst
```

5. Smoke tests on the `dev-mst` URL:
   - Login as a normal user with partial permissions → only permitted tools should work.
   - Login as admin → `/admin/agente-ia` KPIs load.
   - “Resumen del día” / “de la semana”.
   - Create/edit task; optional Calendar sync if OAuth calendar scope + tokens exist.
   - Attempt send/delete **without** confirming → agent should ask; with explicit yes → succeeds.
   - Attempt action without permission → refusal / tool absent, no silent success.
   - Confirm conversation isolation (cannot open another user’s `?c=` id).
   - Follow-up turn that needs prior tool context (history replay).
   - Optional: temporarily set a very low `IA_COSTE_MAX_USD_MES` and confirm `tope_gasto` blocks.
   - Admin: toggle sandbox → agent lists mock data only; chats from prod disappear; Calendar/email not sent. Toggle off → mock chats gone, prod chats back.

---

## 14. Known limitations / risks

1. **Confirmation is two-turn / history-based**, with UI Confirmar/Cancelar that execute (or reject) without an extra LLM round. Typed «sí» still goes through the model.
2. **History replay** — legacy pre-envelope `tool` rows are skipped; `sanearMensajesApi` drops incomplete `tool_use` pairs (crash mid-turn / unparseable rows). Tool results are size-capped **before** JSON persist so envelopes stay valid (a prior `.slice(0,12000)` on the envelope could corrupt JSON and orphan `tool_use` → Anthropic `invalid_request_error` / UI `fallo_agente`).
3. **Spend cap uses estimated USD**, not the Anthropic invoice; a turn already over the tope is blocked, but a single turn can still push the month slightly over the tope after it completes.
4. **Cost ≠ Anthropic invoice** — hardcoded unit prices.
5. **No streaming** — the chat UI waits for the full turn (up to route max duration); portal navigation stays responsive because pending is local state, not a React transition.
6. **Admin `verTodo`** — `buscar_proyectos` / `resumen_periodo` accept optional `verTodo` (ignored unless `es_admin`); default remains scoped like the UI without `?todo=1`.
7. **`buscar_miembro`**: non-admins no longer receive emails; admins still do.
8. After syncing this branch with newer `dev`, re-verify every tool against domain API signature changes (`lib/tablero`, `lib/proyectos`, etc.).
9. Client/project notes and task chat are read (+ send with confirm for task chat); creating/editing notes and task attachments remain UI-only.
10. **Spend cap is per database** — sandbox `ia_uso` / `ia_tope_mensual` do not count toward production tope (and vice versa). Anthropic is still billed. Apply `014`/`030`/`035` on `orbita_pruebas`.
11. **Admin `/admin/agente-ia`** follows the current session pool (sandbox stats while the toggle is on).
12. **Homonymous / type-only names** — two “SEO” projects or two tasks named “Call” return `ambiguo` on single-entity resolve; the agent must ask. For «abre el proyecto {tipo}», prefer `buscar_proyectos` and list all matches with `url` links rather than guessing one. Resolution is scoped (visible projects / participant chats), not global. UUID scrub keeps Markdown hrefs intact.
17. **List count vs table rows** — models sometimes say «15 total» and render fewer rows (or filter `estado` in prose while counting the full tool array). Mitigations: list tools return `{ total, mostradas, truncado, … }`; `buscar_proyectos` defaults to `estado=activo`; server post-process rebuilds incomplete tables from tool results before persist.
13. **Chat Markdown** is a small GFM subset rendered as React nodes (no `dangerouslySetInnerHTML`). Not a full CommonMark engine: nested lists, images, and raw HTML are ignored. Storage remains the original text.
14. **Admin chat viewer** — `/admin/agente-ia/chats` (+ `[id]`); logs with `meta.conversacionId` deep-link there. Do not dump chat bodies into `admin_logs`.
15. **Paper trail / trash** — deletes of tasks, projects, and clients go to `eliminaciones` (~30 days, UI `/eliminados`, tools `listar_eliminados` / `restaurar_eliminado`). Client-linked **communications** threads are hard-deleted and not restored. Restore can fail on UNIQUE conflicts or missing parents (column/project/tipo/cliente). Calendar events are not recreated on restore.
16. **Deshacer (reversible actions)** — `acciones_reversibles` (~7 days, UI `/ajustes/deshacer`, tools `listar_acciones_deshacer` / `deshacer_accion`). Covers UI + agent actions for the session user (move/complete/edit/assignees, project status, client ficha edit, deletes linked to trash). Undo can fail with `conflicto` if the entity changed again.
16. **Timezones** — MySQL pool uses `timezone: "Z"` (UTC). UI/`fechaHora` and agent tool results use the session user’s IANA zone (Ajustes). Digest **send window** (`prefs.hora` / cron) remains evaluated in Europe/Madrid; per-user zone applies to interpreting completion timestamps in digest content. Apply migration `033_usuario_timezone.sql`.

---

## 15. Source of truth

If this doc and code disagree, **code wins**:

- Tools / permissions / confirmations → `lib/asistente/tools.ts`
- Name/UUID resolvers → `lib/asistente/nombres.ts`
- Prompt → `lib/asistente/system-prompt.ts`
- List table/count alignment → `lib/asistente/listado-respuesta.ts` (wired from `run.ts`)
- Loop limits + orchestration → `lib/asistente/run.ts`
- History replay envelopes → `lib/asistente/historial.ts`
- Spend cap / model pricing → `lib/asistente/coste.ts`
- Auth entry → `app/api/asistente/route.ts`
- Schema → `db/migrations/014_asistente_ia.sql`
