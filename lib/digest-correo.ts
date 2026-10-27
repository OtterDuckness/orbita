import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2";
import { generarTextoGemini } from "@/lib/ai/gemini";
import {
  esAtrasada,
  finSemana,
  inicioSemana,
  toYmd,
} from "@/lib/agenda";
import { getPool } from "@/lib/db";
import {
  asuntoDigest,
  MAX_DESTACADAS,
  plantillaDigestHtml,
  plantillaDigestTexto,
  type DigestContenido,
  type DigestProyectoResumen,
  type ItemDigestLinea,
} from "@/lib/email/plantillas-digest";
import { enviarCorreo } from "@/lib/email/resend";
import { ZONA } from "@/lib/formato";
import {
  listarDestinatariosDigest,
  UMBRAL_ATRASO_DIAS,
  type DestinatarioDigest,
} from "@/lib/notif-correo-prefs";
import { tareasDelUsuario, type TareaUsuario } from "@/lib/tablero";

export type DigestRunResultado = {
  enviados: number;
  omitidos: number;
  errores: { usuarioId: string; error: string }[];
};

/** Partes de fecha/hora en Europe/Madrid. */
export function ahoraMadrid(ref: Date = new Date()): {
  ymd: string;
  hora: string;
  isoWeekday: number;
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(ref).map((p) => [p.type, p.value]),
  );
  const ymd = `${parts.year}-${parts.month}-${parts.day}`;
  const horaRaw = parts.hour === "24" ? "00" : parts.hour;
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  const isoWeekday = map[parts.weekday] ?? 1;
  return {
    ymd,
    hora: `${horaRaw}:00`,
    isoWeekday,
  };
}

function tipoDigest(isoWeekday: number): DigestContenido["tipo"] {
  if (isoWeekday === 1) return "lunes";
  if (isoWeekday === 3) return "miercoles";
  if (isoWeekday === 5) return "viernes";
  return "digest";
}

function ymdDesdeIso(iso: string | null, timeZone: string = ZONA): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function diasEntre(ymdA: string, ymdB: string): number {
  const a = new Date(`${ymdA}T12:00:00Z`);
  const b = new Date(`${ymdB}T12:00:00Z`);
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

function aLinea(t: TareaUsuario, hoyYmd: string): ItemDigestLinea {
  const diasAtraso =
    t.fechaMaxima && esAtrasada(t.fechaMaxima, hoyYmd, Boolean(t.completadaEl))
      ? diasEntre(t.fechaMaxima, hoyYmd)
      : undefined;
  return {
    nombre: t.nombre,
    proyectoEtiqueta: t.proyectoEtiqueta,
    clienteNombre: t.clienteNombre,
    fechaMaxima: t.fechaMaxima,
    diasAtraso,
  };
}

function baseUrlApp(): string {
  return (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function dateDesdeYmdMadrid(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function esAtrasada7(t: TareaUsuario, hoyYmd: string): boolean {
  if (!t.fechaMaxima || t.completadaEl) return false;
  if (!esAtrasada(t.fechaMaxima, hoyYmd, false)) return false;
  return diasEntre(t.fechaMaxima, hoyYmd) >= UMBRAL_ATRASO_DIAS;
}

function agruparPorProyecto(
  abiertas: TareaUsuario[],
  hoyYmd: string,
): DigestProyectoResumen[] {
  type Acc = {
    proyecto: string;
    cliente: string | null;
    tareas: TareaUsuario[];
  };
  const map = new Map<string, Acc>();

  for (const t of abiertas) {
    const key = `${t.proyectoEtiqueta}||${t.clienteNombre ?? ""}`;
    const acc = map.get(key);
    if (acc) acc.tareas.push(t);
    else {
      map.set(key, {
        proyecto: t.proyectoEtiqueta,
        cliente: t.clienteNombre,
        tareas: [t],
      });
    }
  }

  const grupos: DigestProyectoResumen[] = [];
  for (const acc of map.values()) {
    const paraHoy = acc.tareas.filter((t) => t.fechaMaxima === hoyYmd);
    const atrasadas = acc.tareas.filter((t) => esAtrasada7(t, hoyYmd));
    const destacadasSrc = [
      ...atrasadas,
      ...paraHoy,
      ...acc.tareas.filter(
        (t) => t.prioridad === "urgente" || t.prioridad === "alta",
      ),
      ...acc.tareas,
    ];
    const seen = new Set<string>();
    const destacadas: ItemDigestLinea[] = [];
    for (const t of destacadasSrc) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      destacadas.push(aLinea(t, hoyYmd));
      if (destacadas.length >= MAX_DESTACADAS) break;
    }

    grupos.push({
      proyecto: acc.proyecto,
      cliente: acc.cliente,
      abiertas: acc.tareas.length,
      paraHoy: paraHoy.length,
      atrasadas7: atrasadas.length,
      destacadas,
    });
  }

  return grupos.sort((a, b) => {
    if (b.atrasadas7 !== a.atrasadas7) return b.atrasadas7 - a.atrasadas7;
    if (b.paraHoy !== a.paraHoy) return b.paraHoy - a.paraHoy;
    if (b.abiertas !== a.abiertas) return b.abiertas - a.abiertas;
    return a.proyecto.localeCompare(b.proyecto, "es");
  });
}

function resumenDeterminista(
  tipo: DigestContenido["tipo"],
  stats: DigestContenido["stats"],
  porProyecto: DigestProyectoResumen[],
): string {
  const top = porProyecto.slice(0, 3);
  const proyectosTxt =
    top.length === 0
      ? "sin proyectos activos"
      : top
          .map(
            (p) =>
              `${p.proyecto}${p.cliente ? ` (${p.cliente})` : ""}: ${p.abiertas} abiertas`,
          )
          .join("; ");

  if (tipo === "lunes") {
    return `Empieza la semana con ${stats.abiertas} abiertas (${stats.paraHoy} para hoy, ${stats.atrasadas7} con atraso ≥${UMBRAL_ATRASO_DIAS}d). Foco: ${proyectosTxt}.`;
  }
  if (tipo === "miercoles") {
    return `Mitad de semana: ${stats.abiertas} abiertas, ${stats.paraHoy} para hoy y ${stats.atrasadas7} importantes atrasadas. Foco: ${proyectosTxt}.`;
  }
  if (tipo === "viernes") {
    return `Cierre: ${stats.completadasSemana} hechas esta semana; quedan ${stats.abiertas} abiertas (${stats.urgentes} urgentes). Foco: ${proyectosTxt}.`;
  }
  return `Tienes ${stats.abiertas} tareas abiertas. Foco: ${proyectosTxt}.`;
}

async function resumirConGemini(
  contenido: DigestContenido,
): Promise<string | null> {
  const payload = {
    tipo: contenido.tipo,
    ymd: contenido.ymd,
    stats: contenido.stats,
    porProyecto: contenido.porProyecto.slice(0, 12).map((p) => ({
      proyecto: p.proyecto,
      cliente: p.cliente,
      abiertas: p.abiertas,
      paraHoy: p.paraHoy,
      atrasadas7: p.atrasadas7,
      destacadas: p.destacadas.map((d) => d.nombre),
    })),
    paraHoy: contenido.paraHoy.slice(0, 8).map((t) => ({
      nombre: t.nombre,
      proyecto: t.proyectoEtiqueta,
    })),
    atrasadas: contenido.atrasadasImportantes.slice(0, 8).map((t) => ({
      nombre: t.nombre,
      proyecto: t.proyectoEtiqueta,
      diasAtraso: t.diasAtraso,
    })),
  };

  const prompt = `Eres un asistente de productividad para Órbita (portal interno).
Escribe en español 2 a 4 frases cortas para un correo de vista rápida.
Tono operativo, claro, sin saludos ni despedidas.
NO inventes tareas, fechas ni números que no estén en el JSON.
Prioriza: atrasos ≥7 días, tareas de hoy, y los proyectos con más carga.
Contexto del día: ${contenido.tipo}.

JSON:
${JSON.stringify(payload)}`;

  const text = await generarTextoGemini(prompt);
  if (!text) return null;
  return text.replace(/^["']|["']$/g, "").trim() || null;
}

export function construirDigest(
  dest: DestinatarioDigest,
  tareas: TareaUsuario[],
  ymd: string,
  isoWeekday: number,
): DigestContenido {
  const tipo = tipoDigest(isoWeekday);
  const semanaIni = toYmd(inicioSemana(dateDesdeYmdMadrid(ymd)));
  const semanaFin = toYmd(finSemana(dateDesdeYmdMadrid(ymd)));

  const abiertas = tareas.filter((t) => !t.completadaEl);
  const pendientesSemana = abiertas
    .filter((t) => {
      if (!t.fechaMaxima) return true;
      return t.fechaMaxima >= semanaIni && t.fechaMaxima <= semanaFin;
    })
    .map((t) => aLinea(t, ymd));

  const atrasadasImportantes = abiertas
    .filter((t) => esAtrasada7(t, ymd))
    .map((t) => aLinea(t, ymd));

  const paraHoy = abiertas
    .filter((t) => t.fechaMaxima === ymd)
    .map((t) => aLinea(t, ymd));

  const completadasSemana = tareas
    .filter((t) => {
      const c = ymdDesdeIso(t.completadaEl, dest.timezone);
      return c != null && c >= semanaIni && c <= semanaFin;
    })
    .map((t) => aLinea(t, ymd));

  const urgentes = abiertas
    .filter(
      (t) =>
        t.prioridad === "urgente" ||
        t.prioridad === "alta" ||
        esAtrasada7(t, ymd),
    )
    .map((t) => aLinea(t, ymd));

  const porProyecto = agruparPorProyecto(abiertas, ymd);
  const porClienteMap = new Map<string, ItemDigestLinea[]>();
  for (const t of abiertas) {
    if (!t.clienteNombre) continue;
    const linea = aLinea(t, ymd);
    const lista = porClienteMap.get(t.clienteNombre);
    if (lista) lista.push(linea);
    else porClienteMap.set(t.clienteNombre, [linea]);
  }
  const porCliente = [...porClienteMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "es"))
    .map(([cliente, items]) => ({ cliente, items }));

  const stats = {
    abiertas: abiertas.length,
    paraHoy: paraHoy.length,
    atrasadas7: atrasadasImportantes.length,
    completadasSemana: completadasSemana.length,
    urgentes: urgentes.length,
  };

  const resumen = resumenDeterminista(tipo, stats, porProyecto);
  const baseUrl = baseUrlApp();

  return {
    tipo,
    nombreUsuario: dest.nombre,
    ymd,
    resumen,
    resumenIa: null,
    stats,
    porProyecto,
    pendientesSemana,
    porCliente,
    atrasadasImportantes,
    paraHoy,
    completadasSemana,
    urgentes,
    baseUrl,
    ctaUrl: baseUrl,
  };
}

export async function enriquecerDigestConIa(
  contenido: DigestContenido,
): Promise<DigestContenido> {
  const resumenIa = await resumirConGemini(contenido);
  if (!resumenIa) return contenido;
  return { ...contenido, resumenIa };
}

async function yaEnviado(
  usuarioId: string,
  ymd: string,
  tipo: string,
): Promise<boolean> {
  const pool = await getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 AS ok FROM digest_envios
     WHERE usuario_id = ? AND ymd = ? AND tipo = ?
     LIMIT 1`,
    [usuarioId, ymd, tipo],
  );
  return rows.length > 0;
}

async function registrarEnvio(
  usuarioId: string,
  ymd: string,
  tipo: string,
  providerId: string | null,
): Promise<void> {
  const pool = await getPool();
  await pool.execute(
    `INSERT INTO digest_envios (id, usuario_id, ymd, tipo, provider_id)
     VALUES (?, ?, ?, ?, ?)`,
    [randomUUID(), usuarioId, ymd, tipo, providerId],
  );
}

function debeEnviarAhora(
  dest: DestinatarioDigest,
  isoWeekday: number,
  horaMadrid: string,
): boolean {
  if (!dest.prefs.activo) return false;
  if (!dest.prefs.dias.includes(isoWeekday)) return false;
  return dest.prefs.hora === horaMadrid;
}

export async function ejecutarDigestCorreo(
  ref: Date = new Date(),
): Promise<DigestRunResultado> {
  const { ymd, hora, isoWeekday } = ahoraMadrid(ref);
  const destinatarios = await listarDestinatariosDigest();
  const resultado: DigestRunResultado = {
    enviados: 0,
    omitidos: 0,
    errores: [],
  };

  for (const dest of destinatarios) {
    if (!debeEnviarAhora(dest, isoWeekday, hora)) {
      resultado.omitidos += 1;
      continue;
    }

    const tipo = tipoDigest(isoWeekday);
    try {
      if (await yaEnviado(dest.id, ymd, tipo)) {
        resultado.omitidos += 1;
        continue;
      }

      const tareas = await tareasDelUsuario(dest.id);
      let contenido = construirDigest(dest, tareas, ymd, isoWeekday);
      contenido = await enriquecerDigestConIa(contenido);
      const envio = await enviarCorreo({
        to: dest.correo,
        subject: asuntoDigest(contenido),
        html: plantillaDigestHtml(contenido),
        text: plantillaDigestTexto(contenido),
      });

      if (!envio.ok) {
        resultado.errores.push({ usuarioId: dest.id, error: envio.error });
        continue;
      }

      await registrarEnvio(dest.id, ymd, tipo, envio.id || null);
      resultado.enviados += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      resultado.errores.push({ usuarioId: dest.id, error: msg });
    }
  }

  return resultado;
}

/** Envío manual (admin): ignora días/hora e idempotencia del cron. */
export async function enviarDigestPrueba(input: {
  id: string;
  nombre: string;
  correo: string;
}): Promise<{ ok: true; tipo: string } | { ok: false; error: string }> {
  const { esModoPruebas } = await import("@/lib/sandbox");
  if (await esModoPruebas()) {
    return { ok: false, error: "El digest no se envía en modo pruebas" };
  }
  if (!process.env.RESEND_API_KEY?.trim()) {
    return { ok: false, error: "Falta RESEND_API_KEY" };
  }
  const correo = input.correo.trim().toLowerCase();
  if (!correo.includes("@")) {
    return { ok: false, error: "Correo inválido" };
  }

  const { ymd, isoWeekday } = ahoraMadrid();
  const { parseZona } = await import("@/lib/zona");
  const { obtenerUsuarioAuthPorCorreo } = await import("@/lib/usuarios");
  const authU = await obtenerUsuarioAuthPorCorreo(correo);
  const dest: DestinatarioDigest = {
    id: input.id,
    nombre: input.nombre,
    correo,
    timezone: parseZona(authU?.timezone),
    prefs: {
      activo: true,
      dias: [isoWeekday],
      hora: "09:00",
    },
  };

  try {
    const tareas = await tareasDelUsuario(input.id);
    let contenido = construirDigest(dest, tareas, ymd, isoWeekday);
    contenido = await enriquecerDigestConIa(contenido);
    const subject = `[Prueba] ${asuntoDigest(contenido)}`;
    const envio = await enviarCorreo({
      to: correo,
      subject,
      html: plantillaDigestHtml(contenido),
      text: plantillaDigestTexto(contenido),
    });
    if (!envio.ok) return { ok: false, error: envio.error };
    return { ok: true, tipo: contenido.tipo };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}
