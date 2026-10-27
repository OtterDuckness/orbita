# Changelog

## Unreleased

### Correo (Gmail) — selección múltiple leído / no leído

- Checkboxes en la lista (y seleccionar todos) para marcar varios hilos como **leídos** o **no leídos** vía `threads.modify` (UNREAD).

### Correo (Gmail) — autocompletado Para (equipo / clientes)

- Al redactar/responder, el campo **Para** sugiere destinatarios de Órbita: equipo (`listarEquipo`) y, con `clientes.ver`, clientes (`correoAcceso`). Sin People API ni scopes nuevos.

### Correo (Gmail) — UI lista completa y estrella

- Al entrar en `/correo` sin seleccionar nada: **lista a ancho completo** (filas tipo Gmail: de · asunto — snippet · fecha).
- Al abrir un hilo o redactar: layout split (lista + panel) como antes; **←** vuelve a la lista completa.
- Destacar: solo icono ☆/★ a la izquierda (lista y detalle); se quita el botón «Destacar».

### Agente IA — leer y buscar Gmail (solo lectura)

- Tools `buscar_correos` y `leer_correo` (`correo.ver`): listar/buscar hilos y leer cuerpo en texto; sin enviar, marcar leído ni estrella.
- `filtro=todos` (default) \| `no_leidos`; contadores `noLeidosEnPagina` / `leidosEnPagina` para no inventar «sin leer».
- Docs: [`docs/asistente-ia.md`](docs/asistente-ia.md) §5 / §8.4.

### Correo (Gmail) — leer, adjuntos y enviar

- Nueva sección de menú **Correo** (`/correo`) con bandeja, detalle de mensaje, descarga de adjuntos y redacción/envío (texto plano).
- Carpetas **Bandeja** (`in:inbox`) y **Enviados** (`in:sent`); tras enviar se abre Enviados.
- Buscador (nombre/email/asunto/operadores Gmail) y filtros **No leídos** / **Con adjuntos**.
- Conversaciones (hilos): lista `threads.list`, detalle apilado, responder con `threadId` + `In-Reply-To` / `References`.
- Estrella Gmail (`STARRED`) y leído a nivel de hilo (`threads.modify`); adjuntos al redactar (MIME multipart, máx. 5 / ~18 MB).
- No leídos con resalte amarillo; al abrir se quita el highlight y se sincroniza con Gmail.
- OAuth Google: scope `gmail.modify` (leer/enviar/labels; además de Calendar). Añadir en consent + re-login.
- Permisos `correo.ver` / `correo.editar` (perfil Completo + admins). Kill switch `apartado_correo` (defecto on).
- Cliente mínimo en `lib/google-gmail.ts` + `GET /api/gmail/adjunto`. Envío desactivado en modo pruebas.
- Migración: `db/migrations/040_correo.sql`. Ops: habilitar `gmail.googleapis.com` y añadir los scopes en el consent screen.

### Agente IA — conteo de listados alineado con la tabla

- El modelo a veces decía «15 total» / «mostrando 10» y pintaba otra cantidad de filas. Tras el scrub de UUIDs, `alinearListadoRespuesta` reconstruye la primera tabla/lista si no cuadra con el tool result y corrige prosa (`(N total)`, `mostrando N de ellas`, `Hay N más`).
- `buscar_proyectos` y `buscar_clientes` pasan a `{ total, mostradas, truncado, … }` (como las tareas). `buscar_proyectos` filtra `estado=activo` por defecto (como `/proyectos`); `estado=todos|terminado|archivado` opcionales.
- Prompt: listar con todas las filas del tool; no usar `limite` bajo salvo «top N».
- Docs: [`docs/asistente-ia.md`](docs/asistente-ia.md) §8 / §9 / §14.

### Agente IA — lightbox de confirmación editable

- El lightbox de confirmación muestra los **campos concretos** de la acción (no solo Confirmar/Rechazar) y permite **corregirlos** antes de aplicar.
- Controles del portal donde aplica: `CampoFecha`, selects de prioridad/estado/ámbito/tipo, y menú de personas (portal + posición hacia arriba si no cabe abajo).
- Asignados en tareas: el desplegable se limita al **pool del proyecto** (`poolIds`), igual que `crearTarea` (no se puede fingir asignar a quien no es colaborador).
- Confirmar desde la UI usa `confirmadoPorUi` para que args editados no regeneren otro `requiere_confirmacion` (doble lightbox + mensaje técnico «Pide confirmación…»).
- Prompt: no elegir proyecto por defecto al crear tarea; «personal»/«interna» = ámbito, no nombre; prohibido pedir «sí/yes» en prosa en lugar del lightbox.
- Docs: [`docs/asistente-ia.md`](docs/asistente-ia.md) §7 / §9.

### Agente IA — tope mensual por usuario y listados/borrados más fiables

- **Tope por usuario/mes:** en `/admin/agente-ia`, cada tarjeta de uso tiene campo + Guardar para override del mes UTC actual (`ia_tope_mensual`). Vacío = tope global (`IA_COSTE_MAX_USD_MES`); `0` = sin tope ese mes. Migración: `db/migrations/035_ia_tope_mensual.sql`.
- **Listados:** `listar_tareas` acepta `responsableId` o `atrasadas`/`vencen*` como único alcance («tareas de Miguel», atrasadas sin pedir proyecto). Prompt: tabla con **todas** las filas devueltas (no «las más urgentes»); «mis atrasadas» → `listar_mis_tareas`.
- **Borrado en lote:** un `borrar_tarea` con `tareaIds=[…]` se expande a N confirmaciones en el lightbox (una por tarea). Evita que el modelo solo confirme 2–3 de N.
- Fix build: backticks dentro del template string de `system-prompt.ts` rompían `pnpm build`.
- Docs: [`docs/asistente-ia.md`](docs/asistente-ia.md) §7 / §8.3 / §12.

### Agente IA — confirmación fiable y listado por creación

- Tras `requiere_confirmacion`, `ejecutarTurno` corta el loop del LLM y fija el mensaje de confirmación (texto del modelo o uno por defecto); la UI muestra Confirmar/Cancelar de forma fiable.
- El panel no pierde `confirmacionPendiente` al crear el chat ni con un refresh RSC stale.
- `listar_mis_tareas` / `listar_tareas`: filtros `creadasDesde` / `creadasHasta` (zona de sesión), `soloCreadasPorMi`, `orden=creado_desc|creado_asc`, `limite` — para «últimas N creadas hoy».
- Prompt: llamar la tool de borrado/envío enseguida; no preguntar en prosa antes del gate; listar creadas con la tool (el resumen solo da contadores).
- Docs: [`docs/asistente-ia.md`](docs/asistente-ia.md) §7 / §8.3.

### Agente IA — visibilidad para el equipo

- Ajuste `agente_ia_activo` (Admin → Ajustes): si está off, oculta chat/menú/API a no-admins; los admins siempre tienen acceso. Panel Admin → Agente IA sigue disponible.
- Migración: `db/migrations/034_agente_ia_activo.sql`.
- Helper: `puedeUsarAgenteIa(esAdmin)`.

### Agente IA — resumen con guion de atención

- `resumen_periodo` prioriza `atencion.guion` (patrón / capacidad / hoy / semana) y contadores; omite inventarios planos de tareas en `personal.*` / `proyectos.*`.
- Al acotar tool_results grandes de `listar_*_tareas`, se conserva `total` y se reduce `tareas` (no un preview opaco).

### Mock / pruebas

- `seed-mock.sql` y `reparar-responsables.sql` actualizados para el entorno de pruebas.

### Agente IA — botones Confirmar / Cancelar

- Tras `requiere_confirmacion`, la UI muestra Confirmar/Cancelar.
- Confirmar ejecuta la tool pendiente sin otra ronda del LLM; Cancelar solo registra el rechazo.
- `confirmacionDosTurnosOk` exige un mensaje afirmativo («sí»/«yes»/…); «cancelar»/«no» no desbloquean.

### Agente IA — cache_control y borrado de tareas en lote

- Prompt caching: se limpia `cache_control` de `tool_result` de rondas anteriores (Anthropic máx. 4 breakpoints; evitaba 400 `Found 5`).
- `borrar_tarea` acepta `tareaIds` (lote) con una sola confirmación, igual que `restaurar_eliminado`.

### Zona horaria por usuario

- Preferencia en Ajustes (IANA); default `Europe/Madrid`.
- Pool MySQL con `timezone: "Z"` (UTC). `fecha` / `fechaHora` usan la zona del usuario.
- El agente normaliza datetimes de tool_result a la zona de sesión (no hay que tocar cada tool).
- Migración: `db/migrations/033_usuario_timezone.sql`.

### Papelera / undo (tareas, proyectos, clientes)

- Tabla `eliminaciones` con snapshot JSON y retención 30 días (`db/migrations/032_eliminaciones.sql`).
- Página `/eliminados` (enlace en el sidemenu) para restaurar.
- Borrados de UI y agente pasan por la papelera; el agente gana `eliminar_proyecto`, `listar_eliminados` y `restaurar_eliminado`.
- Limitación: chats de comunicaciones ligados a un cliente no se restauran; Calendar no se recrea al restaurar.
- Docs: [`docs/asistente-ia.md`](docs/asistente-ia.md) §7 / §8.3.1 / §14.

### Agente IA — títulos de chat por resumen

- El nombre del chat deja de ser el primer mensaje: tras el primer turno, Haiku genera un título corto (≤8 palabras) a partir de lo hablado.
- Al abrir `/asistente`, se regeneran hasta 4 títulos legacy (primer mensaje truncado) por carga.
- El coste de titulizar se registra en `ia_uso` y respeta el tope mensual.
- Docs: [`docs/asistente-ia.md`](docs/asistente-ia.md) §10 / §12.

### Agente IA — visor admin de chats

- `/admin/agente-ia/chats` lista todos los chats (filtro por usuario); `/admin/agente-ia/chats/[id]` lectura sin enviar.
- Desde «Uso por chat» y «Ver todos los chats» en `/admin/agente-ia`.
- En `/admin/logs`, eventos con `meta.conversacionId` enlazan al chat correspondiente.
- Docs: [`docs/asistente-ia.md`](docs/asistente-ia.md) §4.2.1 / §4.2.2.

### Agente IA — fechas admin en Europe/Madrid

- Timestamps de `/admin/agente-ia` y `/admin/agente-ia/chats` usan `fechaHora` (Madrid), no UTC del runtime en Cloud Run.

### Agente IA — calendario laborable al planificar

- Fecha de sesión en **Europe/Madrid** (antes UTC).
- El prompt inyecta los próximos 14 días laborables + festivos Madrid próximos; al repartir/programar tareas no usa fins de semana ni festivos salvo petición explícita.
- Estilo: español de España / tuteo (sin voseo).
- Docs: [`docs/asistente-ia.md`](docs/asistente-ia.md) §9.

### Agente IA — admin chats por fecha

- `/admin/agente-ia` «Uso por chat» ordena por `actualizado_en` descendente (más recientes primero), no por coste.

### Agente IA — optimización de coste (cache, listas slim, tracking)

- Prompt caching: `cache_control` en última tool, bloque estable del system prompt y último `tool_result` por ronda.
- `listar_tareas` / `listar_mis_tareas` devuelven filas slim (sin notas/checklist; `notasCount` / `checklistPendientes`); detalle en `obtener_tarea`.
- `ia_uso` registra `cache_creation_tokens`, `cache_read_tokens`, `web_search_requests`; el estimado USD incluye cache y búsquedas web.
- Migración: `db/migrations/031_ia_uso_cache_web.sql`.
- Docs: [`docs/asistente-ia.md`](docs/asistente-ia.md) §3 / §8.3 / §10 / §12.

### Agente IA — abrir proyectos por tipo y enlaces internos

- «Abre el proyecto SEO» (u otro tipo) → `buscar_proyectos`; si hay varios, listar/preguntar (no elegir uno).
- Los proyectos compactos llevan `url` (`/proyectos/{id}`) para enlaces Markdown.
- El scrub de UUID en la respuesta conserva ids dentro de hrefs Markdown.
- Docs: [`docs/asistente-ia.md`](docs/asistente-ia.md) §6.1 / §8.2.

### Agente IA — resumen «yo vs equipo»

- `resumen_periodo`: `proyectos.contadores.completadasPorMi` / `completadasOtros`; `personal.contadores.completadasPorMi` cuenta el periodo completo (no el tope de lista ~12).
- Prompt/tool: no decir «datos truncados» si existen contadores.

### Agente IA — clientes, confirmación en 2 turnos y alta de proyectos

- `crear_cliente` / `editar_cliente` aceptan `telefono` (como la ficha); el prompt prohíbe inventar `correoAcceso` (también en sandbox).
- Confirmación destructiva endurecida en servidor: `confirmado=true` solo vale tras un `requiere_confirmacion` previo con la misma `pendiente.clave` y un mensaje de usuario nuevo («delete it» no basta).
- `eliminar_cliente` borra en cascada los proyectos de la cuenta (como la UI) y avisa `proyectosQueSeBorran` al pedir el «sí».
- `crear_proyecto`: «proyecto Web para {cliente}» se interpreta como externo + tipo de catálogo + cliente, sin preguntar ámbito ni nombre vs tipo.
- Docs: [`docs/asistente-ia.md`](docs/asistente-ia.md) §7–8.

### Agente IA — Markdown en el chat

- Las respuestas del asistente renderizan un subconjunto GFM (negrita, listas, tablas, enlaces, código). Los mensajes del usuario siguen en texto plano.
- El prompt pide tablas Markdown cuando hay listados/comparativas (misma fila separadora `|---|` que GFM).

### Agente IA — tools por nombre (no UUID)

- `lib/asistente/nombres.ts`: las tools aceptan UUID o nombre único (proyecto también como etiqueta `Cliente · tipo`); homónimos → `ambiguo` con candidatos.
- Los resultados llevan `nombre` / `etiqueta` / `{ nombre, eresTu }`. El chat se sigue scrubbing de UUIDs.

### Agente IA — sandbox vs datos reales

- Historial y tools siguen `getPool()` (`await`): chats y `ia_uso` viven en la misma BD que el resto de la sesión (`orbita` o `orbita_pruebas`).
- Prompt y UI marcan modo pruebas vs datos reales. Calendar/correo siguen no-op en sandbox (como el portal).
- Docs §4.4.

### Agente IA — internet (web_search + web_fetch)

- Nuevo permiso `asistente.web` (Admin → Permisos; migración `030` lo da al perfil Completo).
- Server tools Anthropic: `web_search` (máx. 3) y `web_fetch` (máx. 2, 20k tokens/página); dominios opcionales vía `IA_WEB_ALLOWED_DOMAINS` / `IA_WEB_BLOCKED_DOMAINS`.
- Prompt: separar datos Órbita vs internet, citar fuentes, no meter secretos en la query.
- Docs: [`docs/asistente-ia.md`](docs/asistente-ia.md) §8.5.

### Agente IA — ámbitos personal / proyectos / comunicaciones

- `resumen_periodo` deja de ser un diccionario plano: responde con `personal`, `proyectos`, `comunicaciones` y `atribucion.reglas` para no mezclar «tú hiciste N» con actividad del equipo.
- Completados en `proyectos.completadas` llevan `completadaPor` (logs); «completaste» solo vía `personal.completadasPorMi`.
- Eliminados aliases peligrosos (`creadasEnPeriodo`, etc.). Docs §6 Attribution scopes.
- `alternar_completada_tarea` registra `tarea_completada` / `tarea_reabierta` en logs (como la UI).

### Agente IA — notas de ficha y chat de tarea

- Solo lectura: `listar_notas_cliente`, `listar_notas_proyecto` (distintas de las notas de tarea).
- Chat de tarea: `leer_mensajes_tarea` (marca visto) y `enviar_mensaje_tarea` (con `confirmado`); sin adjuntos. Separado de `enviar_mensaje` (comunicaciones).

### Agente IA — mis tareas, resumen/inbox y historial estable

- Nuevas tools: `listar_mis_tareas` (tablero `/tareas`) y `alternar_completada_tarea` (completar/reabrir como en la UI).
- Admin: `verTodo` opcional en `buscar_proyectos` y `resumen_periodo` (equivalente a `?todo=1`).
- Inbox y métricas «tuyas» viven bajo `personal.*` del resumen anidado (ver sección de ámbitos arriba).
- Historial: los `tool_result` se acotan **antes** de persistir (JSON siempre válido) y `sanearMensajesApi` descarta pares `tool_use` incompletos — evita `fallo_agente` por `tool_use` huérfano tras listados grandes.
- `/asistente` sin `?c=` abre chat vacío nuevo (reabrir solo con `?c=`).
- Docs: [`docs/asistente-ia.md`](docs/asistente-ia.md).

### Agente IA — sincronización con `dev`, endurecimiento y límites

- Rama de trabajo `agenteia-sync`: merge de `origin/dev` en la línea del asistente **sin** merge a `dev`/`main` ni despliegue a prod (validación prevista en `orbita-dev-mst`).
- Documentación completa en [`docs/asistente-ia.md`](docs/asistente-ia.md) (permisos, restricciones, tools, alcance admin, despliegue).
- Regla Cursor: mantener esa doc al cambiar el agente (`.cursor/rules/agente-ia-docs.mdc`).

#### Limpieza de tools

- Eliminadas del agente (siguen en la UI): `crear_tipo_proyecto`, `renombrar_tipo_proyecto`, `crear_columna`, `reordenar_columna`.
- `listar_tipos_proyecto` y `listar_columnas` quedan en solo lectura.
- `buscar_miembro`: los no admin reciben solo `{ id, nombre }`; el email solo si `es_admin`.
- Prompt y README actualizados con estas restricciones.
- `crear_cliente` / `editar_cliente`: pasan `responsableId` (por defecto el usuario actual; obligatorio en dominio tras el merge).

#### Tope de gasto

- Tope mensual por usuario (USD estimado): env `IA_COSTE_MAX_USD_MES` (por defecto **5**; `0`/`off`/`none` = sin tope).
- Se comprueba al inicio del turno; si se supera → `429` / `tope_gasto` (sin llamar a Anthropic).
- Ajustes muestra gasto del mes vs tope; los scripts de deploy fijan `IA_COSTE_MAX_USD_MES=5`.

#### Historial de tools entre turnos

- Se persisten envelopes JSON (`assistant_tool_use` / `tool_result` con `tool_use_id`) para reinyectar el contexto de tools en el siguiente mensaje.
- La UI del chat sigue mostrando solo mensajes de usuario y respuesta final del asistente.
- Los registros `tool` antiguos (sin envelope) no se reponen en la API.

### Admin — base de datos de pruebas

- Segunda base MySQL `orbita_pruebas` (misma instancia Cloud SQL). Un admin activa el modo **solo en su sesión** (Admin → Ajustes); el resto del equipo sigue en datos reales.
- Cookie `orbita_sandbox` + cabecera `x-orbita-sandbox`. Login, cron y tokens Google Calendar siguen siempre en `orbita`.
- En modo pruebas no se envían correos ni se escribe en Google Calendar; los adjuntos GCS van al prefijo `pruebas/`.
- Banner en el portal; **Salir** vuelve a datos reales. Al apagar se escribe `orbita_sandbox=0` (mismo path/secure) y `?sandbox=0` en el middleware, para que el aviso no se quede pegado tras el redirect.
- Fecha de fin opcional al editar un proyecto (igual que al crear); antes fallaba con «Falta algún dato obligatorio» si solo cambiabas el responsable.
- SQL: `db/pruebas/crear.sql`, `copiar-catalogo.sql`, `seed-mock.sql`, `reparar-responsables.sql`. Variable `DATABASE_NAME_PRUEBAS`.
- Seed mock con varias cuentas, proyectos y tareas; responsable por defecto **Dev**, Miguel solo en Acme/Campamento.

### Tablero — botón Nueva tarea

- En la cabecera del tablero de proyecto, botón **Nueva tarea** (derecha): crea la tarea en **Por hacer** y abre el detalle.

### Proyectos — pestañas Externos / Internos

- En el listado de proyectos, **Externos** e **Internos** pasan a pestañas (con conteo) en lugar de secciones colapsables en la misma vista.
- El cambio de pestaña es en cliente (sin recarga) y la preferencia se guarda en `localStorage` (`orbita.proyectos.ambito`).

### Clientes — Mis oportunidades en lista

- En **Mis oportunidades**, toggle **Lista | Tarjetas** (mismo `segmentado`/`chip` que Proyectos): Lista = tabla densa ordenable; Tarjetas = el diseño anterior.
- En Lista, clic en el nombre del cliente despliega sus proyectos; cabeceras sin abreviaturas (Responsable, Proyectos, Fecha fin, Prioridad).
- La preferencia de vista se guarda en `localStorage`.
- **Todas las oportunidades** no cambia.

### Agenda — zona horaria Europe/Madrid

- Fechas y horas de la agenda de Inicio y de eventos de Google Calendar se calculan en **Europe/Madrid** (`ZONA`), no en la zona del servidor/navegador.
- Corrige desajustes de «hoy», columnas laborables y horas cortas cuando el entorno no está en hora española (p. ej. Cloud Run en UTC mostraba reuniones −2 h).
- El rango `timeMin`/`timeMax` de la API de Calendar y las etiquetas de columna usan pared Madrid (`instanteEnZona`).

### UI — cursores más visibles

- Tablero: tarjetas y apartados usan `cursor-move` (el `grab` del sistema en Windows a menudo no tiene contorno y se pierde sobre fondos claros).
- Avatares: `draggable={false}` para no activar el arrastre nativo de imagen.
- Campos de texto: `caret-color` en inputs/textareas (p. ej. Notas de tarea) para que el caret se vea sobre fondo blanco.

### Proyectos — favoritos en el sidemenu

- El desplegable de **Proyectos** solo muestra los que el usuario marca con ★ (preferencia personal).
- Estrella a la izquierda del nombre (lista, tarjetas y kanban): visible al hover; si ya es favorito, permanece marcada.
- Al navegar a un proyecto del listado, el submenú se mantiene abierto (se cierra con la flecha o clic fuera).
- Migración `027_proyecto_favoritos.sql` (tabla `proyecto_favoritos`).

### Menú — acceso rápido a proyectos

- En el sidemenu, el ítem **Proyectos** incluye una flecha que despliega los proyectos favoritos activos del usuario.
- El texto **Proyectos** sigue yendo al listado; cada ítem del submenú abre `/proyectos/[id]`.
- El submenú se resalta con fondo suave, borde y raya magenta para distinguirlo del resto de la navegación.

### Tablero — completar con checkbox

- Checkbox en cada tarjeta del tablero de proyecto (como en `/tareas`).
- Al marcar: mueve a **Terminadas**; al desmarcar: vuelve a **Por hacer**.
- Borde del checkbox con contraste medio (visible sin ser agresivo).

### Tablero — tarjetas en Terminadas

- Las tareas en **Terminadas** se muestran tachadas y con opacidad reducida.
- Diseño más compacto: menos padding, título más pequeño y sin fila de fecha/avatares (el detalle sigue al abrir la tarea).

### Inicio — saludo y tareas retrasadas

- El saludo **Hola, …** del Panel usa el nombre de perfil en BD (no el de Google).
- En **Tu día**, las tareas retrasadas muestran el retraso relativo en rojo (`Ayer`, `Hace 2 días`, …) en lugar del texto fijo «Atrasada».

### Ajustes — personalizar perfil (nombre y foto)

- Nueva sección **Perfil** en `/ajustes`: editar nombre visible y subir/quitar foto (JPEG/PNG/GIF/WebP, máx. 2 MB).
- Foto almacenada en GCS (`avatars/…`); columna `avatar_gcs` en `usuarios`. Migración `024_usuario_avatar.sql`.
- API autenticada `GET /api/avatars/[id]` para servir la imagen.
- Componente reutilizable `AvatarUsuario` (foto o iniciales).
- La foto aparece en menú lateral, colaboradores, tablero, chat de tarea, comunicaciones, notas, sugerencias y listados de admin (usuarios/permisos).
- El nombre ya no se sobrescribe con el de Google en cada login (solo al crear el usuario).

### Clientes y proyectos — responsable obligatorio

- **Cuentas:** al crear o editar, el responsable de cliente es obligatorio (por defecto el usuario actual en el alta).
- **Proyectos:** al crear o editar, el responsable de proyecto es obligatorio; en alta, por defecto el usuario actual (si hay cliente, hereda el de la cuenta).
- Validación en servidor (`lib/clientes`, `lib/proyectos`) y fallback al actor / responsable de cuenta si el formulario llega vacío.
- En el directorio de clientes, la columna responsable muestra solo el de **cuenta** (ya no inventa uno desde proyectos visibles con «Ver todo»).
- Sin migración: los registros antiguos sin responsable siguen; hay que asignarlo al editar.

### Inicio — agenda en columnas laborables

- La agenda del panel **Inicio** pasa de lista vertical («Próximos 7 días») a **7 columnas**.
- Primera columna = **hoy**; las demás = los **6 siguientes días laborables** (sin sábado ni domingo).
- Hoy resaltado con fondo magenta suave y anillo interior.
- Ítems más compactos, con separadores finos entre tareas/reuniones.

### Tareas — borrar desde el detalle

- Icono de papelera a la derecha del menú **⋯** en el lightbox de tarea (calendario, lista y tablero).
- Confirmación propia antes de eliminar; reutiliza `borrarTareaProyecto` (también limpia el evento de Google Calendar si existía).
- Aviso `tarea_eliminada`.

### Proyectos — orden por fecha fin

- Por defecto, **Lista** y **Tarjetas** ordenan por **Fin** ascendente (más cercanos primero; sin fecha al final).
- En **Lista**, la columna Fin queda activa al abrir (sigue pudiendo cambiarse).

### Clientes y proyectos — Notas (sustituye Historial)

- En **proyectos** y **clientes**, el botón **Historial** pasa a **Notas** (anotaciones propias, sin logs).
- Cada nota: **autor**, fecha de creación y de edición; solo el **autor** edita/borra; cualquiera con permiso de ver puede añadir.
- Tabla `notas` (`proyecto_id` + `cliente_id` desnormalizado). Migración `021_notas.sql`.
- En ficha de cliente: notas generales arriba; abajo, botones de proyectos (solo los del usuario; **admin** ve todos) que abren las notas de ese proyecto.
- Confirmación de borrado con lightbox de la app (sin `confirm()` del navegador).

### Proyectos / clientes — iconos de acciones

- Acciones de lista/tarjetas/kanban con iconos (notas, editar, terminado/reactivar, archivar, eliminar).
- Mismos iconos en acciones de **clientes** (notas, editar, eliminar).
- Orden estable: Notas → Editar → Terminado|Reactivar → Archivar → Eliminar.

### Proyectos — Ver todo se conserva

- Tras eliminar/editar/archivar/etc. en `/proyectos?todo=1`, el redirect mantiene **Ver todo** hasta que el admin pulse **Solo míos**.

### Proyectos — vista Lista (tabla ordenable)

- Nuevo modo **Lista** en `/proyectos`: una fila por proyecto, columnas (Proyecto, Cliente, Ámbito, Tipo, Estado, Prioridad, Oportunidad, Fin, Responsable, Tareas, Acciones).
- Cabeceras clicables con orden **ascendente / descendente** (▲/▼); por defecto ordenan por **Fin**.
- La vista de tarjetas por cliente pasa a llamarse **Tarjetas** (antes «Tabla»).
- Conmutador: **Tarjetas · Lista · Kanban · Calendario** (preferencia en `localStorage`).

### Historial — notas por evento

- Cada evento del historial (cliente/proyecto) admite una **nota** editable.
- Quien puede ver el historial (`clientes.ver` / `proyectos.ver`) puede añadir o editar notas.
- La nota muestra **autor** y **fecha/hora**; queda siempre visible en la fila (fondo ámbar suave).
- Añadir/editar abre un **panel lateral** a la derecha del lightbox (no dentro de la fila).
- Migración `020_admin_logs_notas.sql` (`nota`, `nota_autor_id`, `nota_creado_en` en `admin_logs`).

### Tareas — lightbox más compacto

- Cabecera: nombre más corto junto a **Creada**, sync **Google Calendar** y **Prioridad**.
- Cuerpo en una columna: Notas → **Asignado** (fila propia) → Solicitante / Fecha límite.
- Menú **⋯** (extras) a la derecha de Fecha límite: archivos, fecha prevista y checklist; abre hacia arriba.
- Desplegable de asignados abre hacia arriba (sin empujar scroll).
- **Chat** en panel absoluto a la derecha del lightbox (misma altura); aparece/desaparece sin mover el modal.
- Botones de cabecera y Fecha límite a altura `h-11` (alineados con Asignado / Solicitante); texto de Prioridad centrado.
- `CampoFecha` admite `botonClassName` opcional.
- Eliminado el selector **Estado** del detalle (el cambio de columna sigue en el tablero).
- Prioridad color-codeada (baja slate / media azul / alta ámbar / urgente rojo) en lightbox y tablero.

### Proyectos — UI Kanban y capa Google

- Kanban: botones Notas / Editar / Eliminar en columna; título y meta a la izquierda (sin hueco vacío).
- Kanban: agrupación conmutable **Urgencia · Cliente · Responsable · Tipo · Vencimiento** (preferencia en `localStorage`).
- Vencimiento: columnas Vencidos / Esta semana / Este mes / Más adelante / Sin fecha.
- Calendario: capa **Google** activa por defecto (sigue pudiendo apagarse; se guarda en `localStorage`).

### Clientes — teléfono

- Campo opcional **teléfono** por cliente, formato fijo `+34 XXX XXX XXX` (9 dígitos, empieza por 6–9).
- Visible en alta, edición, ficha, lista y búsqueda; se normaliza al guardar.
- Migración `016_clientes_telefono.sql` (columna `telefono` en `clientes`).
- Aviso `telefono_invalido` si el formato no es válido.

### Proyectos — modos de vista y calendario multicapa

- En `/proyectos`, conmutador **Tabla / Kanban / Calendario** (preferencia en `localStorage`).
- Kanban por prioridad (urgente → baja), sin arrastre.
- Calendario mensual con capas conmutables: **Proyectos**, **Tareas**, **Google**.
- Capas Orbita: solo proyectos/tareas del usuario (responsable, colaborador o asignado); tareas por `fechaMaxima` abiertas.
- Capa Google: lectura del calendario primary (`/api/calendar/google`); excluye eventos ya sincronizados desde Orbita; **on** por defecto.
- Chips de color/iniciales por proyecto en tareas del calendario.
- `CampoFecha` admite `required` (validación HTML); fecha de fin obligatoria al **editar**, opcional al **crear**.

### Clientes / proyectos — copy

- «Fee» / «Fee mensual» renombrado a **Tamaño de oportunidad** (formularios) y **Oportunidad** (listas). Sin cambio de BD (`fee_mensual`).

### Historial de entidad (sustituye Mencionar)

- Botón **Historial** en clientes y proyectos (lista y tablero).
- Eliminado **Mencionar** / **Mencionar en chat**.
- Historial de cliente: eventos del cliente + proyectos + tareas.
- Historial de proyecto: eventos del proyecto + tareas.
- Sin historial propio en tareas (quedan en el del proyecto/cliente).
- Reutiliza `admin_logs` (filtro por meta).

### Clientes — alta reorganizada (`clientes-form`)

- Alta de cuenta en 2 pasos: primero datos del cliente, luego proyectos.
- Se puede crear una cuenta **sin proyectos**.
- Se pueden crear **varios proyectos** de una vez en el alta y al añadir proyectos a una cuenta existente.
- Avisos actualizados (`creado`, `proyectos_creados`).
- Sin cambios en el modelo de tipos (sigue 1 tipo por proyecto).
