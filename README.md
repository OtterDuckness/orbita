# Órbita

Portal de clientes, proyectos y tareas.
Stack: **Next.js** + **MySQL** + **Google OAuth**.

## Desarrollo local

```bash
pnpm install
cp .env.example .env.local   # OAuth, AUTH_SECRET y la base de datos
pnpm dev
```

La app admite los correos de `ALLOWLIST_EMAILS`. Si esa variable está vacía, no entra nadie.

## Base de datos

En una base vacía llamada `orbita`, ejecuta `db/schema.sql` y después `db/pruebas/seed-mock.sql`.
El equipo, los clientes, los proyectos y las tareas de ese seed son ficticios. No hace falta editarlos.

## Asistente IA

Chat en `/asistente`. Requiere `ANTHROPIC_API_KEY`. Sin esa clave el resto del portal arranca igual.
Documentación: [`docs/asistente-ia.md`](docs/asistente-ia.md).

## Google Calendar

Scope OAuth: `https://www.googleapis.com/auth/calendar.events`

La API Calendar tiene que estar activa en el proyecto de Google Cloud. Cada usuario tiene que volver a entrar para conceder el permiso.
