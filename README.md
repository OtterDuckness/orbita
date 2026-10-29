# Órbita

[English](#english)

Órbita es el portal interno que desarrollé durante mis prácticas en [ImpactIQ](https://impactiq.es). Es la herramienta con la que el equipo lleva el trabajo de los clientes: de quién es la cuenta, qué se está entregando, quién lo hace y para cuándo.

Este repositorio es una demo de esa aplicación. Los clientes, los proyectos, las tareas y los compañeros son ficticios, para poder enseñarla sin datos de la empresa. El comportamiento del producto es el real: entrada con Google, un esquema MySQL, permisos, tableros y un asistente que actúa con las mismas reglas que la interfaz.

La interfaz está en español.

## Para qué sirve

Una agencia no pierde el trabajo en un solo sitio. La cuenta vive en un CRM, las tareas en un tablero, la conversación en un chat y la fecha en el calendario de alguien. Órbita junta eso en un solo acceso.

Una persona abre el portal y ve el trabajo que de verdad es suyo: cuentas de las que es responsable, proyectos que lidera o en los que colabora, y tareas que tiene asignadas o que ha pedido. Un admin puede abrir toda la agencia. Un contacto del cliente, si se le invita, solo existe en el contexto de su cuenta.

## Entrar

La entrada es con Google, mediante Auth.js. Si la lista de correos permitidos está vacía, no entra nadie. Una dirección incluida puede entrar, y el primer inicio de sesión correcto crea su usuario como miembro interno. A partir de ahí, la base de datos decide qué puede ver. Haber iniciado sesión con Google no basta.

Los admins tienen todos los permisos. El resto tiene un perfil, o un conjunto de permisos a medida, módulo a módulo: ver y editar clientes, proyectos, tareas, comunicaciones y correo, más las acciones de RRHH en Mi Zona. Las páginas comprueban ese permiso en el servidor antes de pintarse. El asistente usa la misma comprobación, así que nadie puede pedirle al chat algo que la pantalla rechazaría.

Los usuarios externos son contactos del cliente ligados a una cuenta. No son una segunda copia del equipo interno.

## Un día en el portal

**Panel.** La pantalla de inicio es una agenda personal, no un panel de cifras de adorno. Muestra las tareas de hoy, los siguientes días laborables, el trabajo vencido, las asignaciones de la última semana y las conversaciones de tareas sin leer. Si la persona ha concedido acceso a Calendar, las reuniones de hoy de su calendario principal de Google aparecen junto a las tareas.

**Clientes.** Cada cliente es una cuenta: nombre, correo de acceso, teléfono y un responsable interno. Una cuenta puede tener varios proyectos. **Mis oportunidades** es la cartera que te implica, como dueño de la cuenta o como miembro de un proyecto. **Todas las oportunidades** es el directorio, para quien tiene permiso de verlo. Crear una cuenta es un formulario en la propia página, no un back office aparte.

**Proyectos.** Un proyecto es externo (ligado a un cliente) o interno (trabajo de la propia agencia). Los externos tienen un tipo, como SEO, Web, Ads o Boostiq, una cuota mensual, un fin de contrato, una prioridad y un estado: activo, terminado o archivado. Cada proyecto tiene un responsable y un grupo de colaboradores. El cliente no ve el tablero. Los favoritos fijan proyectos en la barra lateral.

**Tareas.** Dentro de un proyecto, el trabajo está en un tablero kanban con columnas propias. Una tarea tiene responsables, quien la pidió, una fecha límite, una prioridad, una dificultad, notas y una checklist. La conversación ocurre en la propia tarea, y las respuestas sin leer salen en la pantalla de inicio. También hay un proyecto personal por usuario, para el trabajo que no pertenece a un cliente. La página **Tareas** es la lista, cruzando proyectos, de lo que te toca, lo que has pedido y lo que está en tu tablero personal. **Calendario** coloca en un calendario las tareas con fecha. Una tarea puede sincronizarse con Google Calendar cuando ese permiso está concedido.

**Comunicaciones.** Mensajes directos y grupos del equipo, con contador de no leídos. Un mensaje puede señalar un cliente o un proyecto, así que la conversación sigue pegada al trabajo.

**Correo.** Una bandeja de Gmail dentro del portal: leer, y enviar si la persona tiene permiso de edición. Los destinatarios se pueden sugerir a partir del equipo y de los correos de acceso de los clientes. Usa la cuenta de Google de quien ha iniciado sesión. No es un buzón compartido guardado en la base de datos.

**Herramientas.** Una lista personal de enlaces, en el orden que elija cada persona.

**Sugerencias.** Cualquiera puede enviar una sugerencia desde la barra lateral. Los admins las leen en una bandeja.

## Cuando algo sale mal

Los borrados son lógicos. Clientes, proyectos y tareas pasan a **Eliminados** y se pueden restaurar. Aparte, las acciones recientes se pueden deshacer desde **Ajustes**. El asistente también puede listar y deshacer esas acciones, siempre con los permisos de quien llama.

Los admins tienen además un registro de auditoría, gestión de usuarios, perfiles de permisos e interruptores que ocultan secciones enteras del menú (incluido el asistente) sin un despliegue.

## Mi Zona

Mi Zona es el rincón de RRHH: fichaje, ausencias y nóminas, apoyado en la API de Holded. Permanece en silencio mientras no esté `HOLDED_API_KEY`. Un admin puede previsualizar la vista de trabajador y la de responsable sin perder su rol real de admin.

## El asistente

`/asistente` es un operador, no un chatbot genérico. Ejecuta un bucle de herramientas contra las librerías del propio portal: buscar y abrir clientes y proyectos, crearlos y editarlos, mover tareas, marcar checklists, leer y enviar mensajes del equipo, leer los hilos de una tarea, buscar en el Gmail de la persona y resumir un día, una semana o un mes.

Las escrituras piden confirmación en la interfaz antes de aplicarse. El modelo no tiene consola SQL, ni secretos, ni administración de usuarios. No puede hacer más que la persona que ha iniciado sesión. La búsqueda web pública es un permiso aparte.

El uso se mide. Hay un tope de gasto mensual por usuario, con anulación de admin, y los admins pueden abrir chats anteriores. Sin `ANTHROPIC_API_KEY` el portal sigue funcionando. Solo el asistente queda apagado.

## Esta demo

Las credenciales de producción, la infraestructura de la empresa y los datos reales de clientes no están en este repositorio.

Lo que hay es un esquema y una carga de datos:

- `db/schema.sql` es la instalación completa para una base vacía llamada `orbita`. No reapliques `db/migrations` encima.
- `db/pruebas/seed-mock.sql` carga la agencia ficticia: clientes, proyectos, columnas, tareas, checklists, notas y chats.

El admin es el primer usuario interno de `db/schema.sql`. Entra con esa cuenta de Google y la pantalla de inicio, **Mis oportunidades** y **Tareas** ya vienen llenas. Hay otros compañeros ficticios para que el producto parezca un equipo: responsables, colaboradores y mensajes están repartidos entre ellos. **Ver todo** y **Todas las oportunidades** muestran el resto.

Para usar otra cuenta de Google, cambia ese correo de admin en `db/schema.sql` antes de cargarlo, y pon la misma dirección en `ALLOWLIST_EMAILS`.

## Stack

Next.js 15 (App Router) y React 19, con páginas renderizadas en el servidor y la comprobación de permisos también en el servidor. MySQL 8 a través de `mysql2`. Auth.js para el OAuth de Google. Tailwind CSS. El asistente llama a la API de Anthropic. El correo y el calendario llaman a Google. Los adjuntos van a Cloud Storage cuando hay un bucket configurado. El digest de correo sale por Resend cuando esa clave está puesta.

Una IP pública de Cloud SQL con **Allow only SSL connections** está soportada: la app usa TLS cuando `DATABASE_HOST` tiene valor. En Cloud Run, deja el host vacío y pon `INSTANCE_CONNECTION_NAME` para que la conexión use el socket Unix.

## Arranque en local

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Abre http://localhost:3000/login.

`.env.local` no entra en git. Los valores que importan para la demo:

| Variable | Para qué |
| --- | --- |
| `AUTH_SECRET` | Secreto de sesión. Cualquier cadena larga y aleatoria. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Cliente web de OAuth. |
| `AUTH_URL` | `http://localhost:3000` en local. |
| `ALLOWLIST_EMAILS` | Cuentas de Google que pueden entrar. Vacío significa nadie. |
| `DATABASE_HOST` | Host de MySQL. La IP pública, al conectar con Cloud SQL desde un portátil. |
| `DATABASE_USER` / `DATABASE_PASSWORD` / `DATABASE_NAME` | Base de datos `orbita`. |

En el cliente de OAuth, añade `http://localhost:3000/api/auth/callback/google`. Autoriza también tu IP actual en la instancia de Cloud SQL, como red `/32`. Cloud SQL Studio no necesita esa lista. La app sí.

Después carga `db/schema.sql` y, a continuación, `db/pruebas/seed-mock.sql`.

`ANTHROPIC_API_KEY`, `GCS_BUCKET`, `RESEND_API_KEY`, `CRON_SECRET`, `GEMINI_API_KEY` y `HOLDED_API_KEY` son opcionales. Déjalas vacías y la pantalla correspondiente se explica sola o permanece en reposo. En esta demo no hay una segunda base de datos. Deja `DATABASE_NAME_PRUEBAS` sin definir.

---

# English

Órbita is the internal portal I developed during my internship at [ImpactIQ](https://impactiq.es). It is the tool the team uses to run client work: who the account belongs to, what is being delivered, who is doing it, and what is due.

This repository is a demo of that app. The clients, projects, tasks, and teammates are fictional, so it can be shown without company data. The product behavior is the real one: Google sign-in, a MySQL schema, permissions, boards, and an assistant that acts through the same rules as the interface.

The interface is in Spanish.

## What it is for

An agency does not lose track of work in one place. The account lives in a CRM, the tasks live in a board, the conversation lives in chat, and the deadline lives in someone's calendar. Órbita puts that in one login.

A person opens the portal and sees the work that is actually theirs: accounts they own, projects they lead or collaborate on, and tasks assigned to them or requested by them. An admin can open the whole agency. A client contact, when invited, only exists in the context of their account.

## Signing in

Entry is Google, via Auth.js. An empty allowlist lets nobody in. A listed address may enter, and the first successful login creates their user as an internal teammate. After that, the database decides what they can see. Being signed in with Google is not enough.

Admins get every permission. Everyone else gets a profile, or a custom set of permissions, module by module: view and edit for clients, projects, tasks, communications, and mail, plus the HR actions in Mi Zona. Pages check that permission on the server before they render. The assistant uses the same check, so a person cannot ask the chat to do something the screen would refuse.

External users are client contacts tied to one account. They are not a second copy of the internal team.

## A day in the portal

**Panel.** The home screen is a personal agenda, not a dashboard of vanity numbers. It shows tasks for today, the next working days, overdue work, assignments from the last week, and unread task conversations. If the user has granted Calendar access, today's meetings from their primary Google calendar sit next to the tasks.

**Clientes.** Each client is an account: name, access email, phone, and an internal owner. One account can hold several projects. **Mis oportunidades** is the book of business that involves you, as account owner or as someone on a project. **Todas las oportunidades** is the directory, for people allowed to see it. Creating an account is a form in the page, not a separate back office.

**Proyectos.** A project is either external (tied to a client) or internal (the agency's own work). External projects have a type, such as SEO, Web, Ads, or Boostiq, a monthly fee, a contract end, a priority, and a status: active, finished, or archived. Each project has a lead and a set of collaborators. The client does not see the board. Favorites pin projects into the sidebar.

**Tareas.** Inside a project, work sits on a kanban board with custom columns. A task has assignees, a requester, a due date, a priority, a difficulty, notes, and a checklist. People talk on the task itself, and unread replies show up on the home screen. There is also a personal project per user, for work that does not belong to a client. The **Tareas** page is the cross-project list of what you have to do, what you asked for, and what is on your personal board. The **Calendario** page lays the dated tasks on a calendar. A task can be synced to Google Calendar when that scope has been granted.

**Comunicaciones.** Direct messages and group chats for the team, with unread counts. A message can point at a client or a project, so the conversation stays attached to the work.

**Correo.** A Gmail inbox inside the portal: read, and send when the user has the edit permission. Recipients can be suggested from the team and from client access emails. This uses the signed-in person's own Google account. It is not a shared mailbox baked into the database.

**Herramientas.** A personal list of links the user wants at hand, ordered by them.

**Sugerencias.** Anyone can send a suggestion from the sidebar. Admins read them in an inbox.

## When something goes wrong

Deletes are soft. Clients, projects, and tasks go to **Eliminados** and can be restored. Separate from that, recent actions can be undone from **Ajustes**. The assistant can list and undo those actions too, still under the caller's permissions.

Admins also get an audit log, user management, permission profiles, and switches that hide whole sections of the menu (including the assistant) without a deploy.

## Mi Zona

Mi Zona is the HR corner: clock-in, absences, and payslips, backed by the Holded API. It stays quiet unless `HOLDED_API_KEY` is set. An admin can preview the worker view and the manager view without giving up their real admin role.

## The assistant

`/asistente` is an operator, not a general chatbot. It runs a tool loop against the portal's own libraries: search and open clients and projects, create and edit them, move tasks, toggle checklists, read and send team messages, read task threads, search the user's Gmail, and summarize a day, week, or month.

Writes ask for confirmation in the interface before they land. The model does not get a SQL console, secrets, or user administration. It cannot do more than the signed-in person. Public web search is a separate permission.

Usage is metered. There is a monthly spend cap per user, with an admin override, and admins can open past chats. Without `ANTHROPIC_API_KEY` the portal still runs. Only the assistant is unavailable.

## This demo

Production credentials, company infrastructure, and real client data are not in this repository.

What you get is a schema and a seed:

- `db/schema.sql` is the full install for an empty database named `orbita`. Do not replay `db/migrations` on top of it.
- `db/pruebas/seed-mock.sql` loads the fictional agency: clients, projects, columns, tasks, checklists, notes, and chats.

The admin is the first internal user in `db/schema.sql`. Sign in with that Google account and the home screen, **Mis oportunidades**, and **Tareas** are already filled. Other fictional teammates exist so the product looks like a team: leads, collaborators, and messages are spread across them. **Ver todo** and **Todas las oportunidades** show the rest.

To use a different Google account, change that admin email in `db/schema.sql` before loading it, and put the same address in `ALLOWLIST_EMAILS`.

## Stack

Next.js 15 (App Router) and React 19, server-rendered pages with the permission check on the server. MySQL 8 through `mysql2`. Auth.js for Google OAuth. Tailwind CSS. The assistant calls the Anthropic API. Mail and calendar call Google. Attachments go to Cloud Storage when a bucket is configured. The digest email goes out through Resend when that key is set.

A public Cloud SQL IP with **Allow only SSL connections** is supported: the app uses TLS when `DATABASE_HOST` is set. On Cloud Run, leave the host empty and set `INSTANCE_CONNECTION_NAME` so the connection uses the Unix socket instead.

## Run it locally

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open http://localhost:3000/login.

`.env.local` stays out of git. The values that matter for the demo:

| Variable | Purpose |
| --- | --- |
| `AUTH_SECRET` | Session secret. Any long random string. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | OAuth web client. |
| `AUTH_URL` | `http://localhost:3000` locally. |
| `ALLOWLIST_EMAILS` | Google accounts allowed to enter. Empty means nobody. |
| `DATABASE_HOST` | MySQL host. The public IP, when connecting to Cloud SQL from a laptop. |
| `DATABASE_USER` / `DATABASE_PASSWORD` / `DATABASE_NAME` | Database `orbita`. |

On the OAuth client, add `http://localhost:3000/api/auth/callback/google`. Also authorize your current IP on the Cloud SQL instance, as a `/32` network. Cloud SQL Studio does not need that list. The app does.

Then load `db/schema.sql`, then `db/pruebas/seed-mock.sql`.

`ANTHROPIC_API_KEY`, `GCS_BUCKET`, `RESEND_API_KEY`, `CRON_SECRET`, `GEMINI_API_KEY`, and `HOLDED_API_KEY` are optional. Leave them empty and the corresponding screen explains itself or stays idle. There is no second database in this demo. Leave `DATABASE_NAME_PRUEBAS` unset.
