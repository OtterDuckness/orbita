import { listarLogsPorMetaIds } from "@/lib/admin-logs";
import { restarDiasYmd, toYmd } from "@/lib/agenda";
import { alcanceProyectos } from "@/lib/authz";
import { catalogoEtiquetas, etiquetasDeProyecto } from "@/lib/asistente/nombres";
import { contarNoLeidosDe } from "@/lib/comunicaciones";
import { listarProyectos } from "@/lib/proyectos";
import { chatsTareaSinLeer } from "@/lib/tarea-chat";
import {
  columnasDe,
  contarTareasAbiertasMap,
  esColumnaCerrada,
  tareasDe,
  tareasDelUsuario,
  tareasNuevasSinVer,
} from "@/lib/tablero";
import type { Columna, Tarea } from "@/lib/tareas-mock";
import { mapaEquipo, usuarioPuede, type UsuarioAuth } from "@/lib/usuarios";
import { parseZona } from "@/lib/zona";

export type PeriodoResumen = "diario" | "semanal" | "mensual";

/** Cap list payloads so tool_result history stays parseable. */
const TOP_LISTA = 12;

type PersonaRef = { nombre: string; eresTu: boolean };

type TareaResumen = {
  id: string;
  nombre: string;
  url: string;
  proyectoEtiqueta: string | null;
  clienteNombre: string | null;
  fechaMaxima: string | null;
  creadoEl: string;
  completadaEl: string | null;
  mandadaPor: PersonaRef | null;
};

type TareaCompletadaResumen = TareaResumen & {
  /** Who toggled complete (from admin_logs); null if unknown. */
  completadaPor: PersonaRef | null;
};

const REGLAS_ATRIBUCION = [
  "Say tú/creaste/completaste ONLY using personal.* or any field with eresTu===true.",
  "proyectos.* is team/project-scope activity — never count it as «you did X». Use mandadaPor/completadaPor.nombre.",
  "mandadaPor (requester) ≠ completadaPor (who completed).",
  "If completadaPor is null, say the task was completed without inventing who.",
  "For «what did I complete/create?» use only personal.completadasPorMi / personal.creadasPorMi.",
  "«yo vs equipo»: personal.contadores.completadasPorMi vs proyectos.contadores.completadas / completadasOtros. Lists are capped (~12); contadores are full — never say data is truncated if contadores exist.",
  "comunicaciones.noLeidos is DMs/groups, not task chat (see personal.chatsTareaSinLeer).",
  "Day/week/month briefing → paraphrase atencion.guion (diagnostico/capacidad/planHoy/planSemana). Short prose; never dump task inventories — user has /tareas.",
] as const;

const TOP_CLIENTES_ATENCION = 8;

type ClienteAtencion = {
  cliente: string;
  atrasadasMias: number;
  nuevasSinVer: number;
  chatsSinLeer: number;
  creadasPorMi: number;
  completadasPorMi: number;
  proyectos: string[];
  score: number;
};

type GuionAtencion = {
  /** Model must follow: analyze/advise, do not inventory tasks. */
  instrucciones: string;
  diagnostico: string;
  capacidad: string;
  planHoy: string;
  planSemana: string;
  /** At most one deep-link for the whole reply; prose must not become a task list. */
  unEnlace: { nombre: string; url: string; porQue: string } | null;
  cierre: string;
};

function etiquetaCliente(
  clienteNombre: string | null | undefined,
  esPersonal?: boolean,
): string {
  if (esPersonal) return "Personal";
  const c = clienteNombre?.trim();
  return c || "Sin cliente";
}

function urlTarea(id: string): string {
  return `/tareas?tarea=${encodeURIComponent(id)}`;
}

function diasEntre(a: string, b: string): number {
  const pa = Date.parse(`${a}T12:00:00.000Z`);
  const pb = Date.parse(`${b}T12:00:00.000Z`);
  if (!Number.isFinite(pa) || !Number.isFinite(pb)) return 0;
  return Math.round((pb - pa) / 86_400_000);
}

type RefClienteTarea = {
  id: string;
  nombre: string;
  clienteNombre: string | null;
  proyectoEtiqueta: string | null;
  esPersonal?: boolean;
  fechaMaxima?: string | null;
};

type ChatRef = {
  tareaId: string;
  titulo: string;
  noLeidos: number;
  esPersonal: boolean;
  proyectoId: string;
};

const GUION_INSTRUCCIONES =
  "Resumen seco y escaneable. Usa exactamente estas secciones Markdown (una línea o dos máx. cada una), con línea en blanco entre ellas:\n**Patrón** — …\n**Capacidad** — …\n**Hoy** — …\n**Esta semana** — …\n**Cierre** — …\nMapea diagnostico→Patrón, capacidad→Capacidad, planHoy→Hoy, planSemana→Esta semana, cierre→Cierre. Tono directo, sin párrafos largos ni prosa seguida. PROHIBIDO: muro de texto, bullets de tareas, enumerar atrasadas/nuevas por nombre. Como mucho UN enlace (solo si hay unEnlace). No inventes datos fuera del guion/contadores.";

/** Normaliza nombre de tarea para detectar el mismo entregable en varios clientes. */
function clavePatronEntregable(nombre: string): string {
  return nombre
    .replace(/\(mock\)/gi, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

function etiquetaPatron(nombre: string): string {
  return nombre.replace(/\s*\(mock\)\s*/gi, "").trim() || nombre.trim();
}

function juntarNombres(nombres: string[]): string {
  const u = [...new Set(nombres.filter(Boolean))];
  if (u.length === 0) return "";
  if (u.length === 1) return u[0]!;
  if (u.length === 2) return `${u[0]} y ${u[1]}`;
  return `${u.slice(0, -1).join(", ")} y ${u[u.length - 1]}`;
}

/** Agrupa por cliente y redacta diagnóstico + plan (no inventario de tareas). */
function construirAtencion(opts: {
  periodo: PeriodoResumen;
  hoy: string;
  abiertas: number;
  misAtrasadas: RefClienteTarea[];
  nuevasSinVer: RefClienteTarea[];
  creadasPorMi: RefClienteTarea[];
  completadasPorMi: RefClienteTarea[];
  chats: ChatRef[];
  etiquetaPorProyecto: Map<
    string,
    { etiqueta: string; clienteNombre: string | null }
  >;
}): {
  porCliente: ClienteAtencion[];
  guion: GuionAtencion;
  totales: {
    clientesConAtencion: number;
    atrasadasMias: number;
    nuevasSinVer: number;
    chatsTareaSinLeer: number;
    creadasPorMi: number;
    completadasPorMi: number;
  };
} {
  type Acc = {
    cliente: string;
    atrasadasMias: number;
    nuevasSinVer: number;
    chatsSinLeer: number;
    creadasPorMi: number;
    completadasPorMi: number;
    proyectos: Set<string>;
    atrasadaMasAntigua: RefClienteTarea | null;
  };
  const porClave = new Map<string, Acc>();

  const bucket = (cliente: string): Acc => {
    let a = porClave.get(cliente);
    if (!a) {
      a = {
        cliente,
        atrasadasMias: 0,
        nuevasSinVer: 0,
        chatsSinLeer: 0,
        creadasPorMi: 0,
        completadasPorMi: 0,
        proyectos: new Set(),
        atrasadaMasAntigua: null,
      };
      porClave.set(cliente, a);
    }
    return a;
  };

  for (const t of opts.misAtrasadas) {
    const cliente = etiquetaCliente(t.clienteNombre, t.esPersonal);
    const a = bucket(cliente);
    a.atrasadasMias += 1;
    if (t.proyectoEtiqueta) a.proyectos.add(t.proyectoEtiqueta);
    const prev = a.atrasadaMasAntigua;
    const f = t.fechaMaxima ?? null;
    const prevF = prev?.fechaMaxima ?? null;
    if (!prev || (f && (!prevF || f < prevF))) a.atrasadaMasAntigua = t;
  }

  for (const t of opts.nuevasSinVer) {
    const cliente = etiquetaCliente(t.clienteNombre, t.esPersonal);
    const a = bucket(cliente);
    a.nuevasSinVer += 1;
    if (t.proyectoEtiqueta) a.proyectos.add(t.proyectoEtiqueta);
  }

  for (const t of opts.creadasPorMi) {
    const cliente = etiquetaCliente(t.clienteNombre, t.esPersonal);
    const a = bucket(cliente);
    a.creadasPorMi += 1;
    if (t.proyectoEtiqueta) a.proyectos.add(t.proyectoEtiqueta);
  }

  for (const t of opts.completadasPorMi) {
    const cliente = etiquetaCliente(t.clienteNombre, t.esPersonal);
    const a = bucket(cliente);
    a.completadasPorMi += 1;
    if (t.proyectoEtiqueta) a.proyectos.add(t.proyectoEtiqueta);
  }

  for (const c of opts.chats) {
    const e = opts.etiquetaPorProyecto.get(c.proyectoId);
    const cliente = etiquetaCliente(e?.clienteNombre, c.esPersonal);
    const a = bucket(cliente);
    a.chatsSinLeer += 1;
    if (e?.etiqueta) a.proyectos.add(e.etiqueta);
  }

  const porClienteFull = [...porClave.values()]
    .map((a) => ({
      ...a,
      proyectos: [...a.proyectos].slice(0, 6),
      score:
        a.atrasadasMias * 10 +
        a.nuevasSinVer * 3 +
        a.chatsSinLeer * 2 +
        a.creadasPorMi +
        a.completadasPorMi,
    }))
    .sort((x, y) => y.score - x.score || x.cliente.localeCompare(y.cliente, "es"));

  const porCliente: ClienteAtencion[] = porClienteFull
    .slice(0, TOP_CLIENTES_ATENCION)
    .map((a) => ({
      cliente: a.cliente,
      atrasadasMias: a.atrasadasMias,
      nuevasSinVer: a.nuevasSinVer,
      chatsSinLeer: a.chatsSinLeer,
      creadasPorMi: a.creadasPorMi,
      completadasPorMi: a.completadasPorMi,
      proyectos: a.proyectos,
      score: a.score,
    }));

  const totales = {
    clientesConAtencion: porClave.size,
    atrasadasMias: opts.misAtrasadas.length,
    nuevasSinVer: opts.nuevasSinVer.length,
    chatsTareaSinLeer: opts.chats.length,
    creadasPorMi: opts.creadasPorMi.length,
    completadasPorMi: opts.completadasPorMi.length,
  };

  const etiquetaPeriodo =
    opts.periodo === "mensual"
      ? "este mes"
      : opts.periodo === "semanal"
        ? "esta semana"
        : "hoy";

  // Patrones: mismo entregable atrasado en varios clientes
  type PatronAcc = {
    etiqueta: string;
    clientes: Map<string, number>; // dias atraso
    masAntigua: RefClienteTarea | null;
  };
  const patrones = new Map<string, PatronAcc>();
  for (const t of opts.misAtrasadas) {
    const key = clavePatronEntregable(t.nombre);
    if (!key) continue;
    let p = patrones.get(key);
    if (!p) {
      p = { etiqueta: etiquetaPatron(t.nombre), clientes: new Map(), masAntigua: null };
      patrones.set(key, p);
    }
    const cliente = etiquetaCliente(t.clienteNombre, t.esPersonal);
    const dias = t.fechaMaxima ? Math.max(0, diasEntre(t.fechaMaxima, opts.hoy)) : 0;
    const prevD = p.clientes.get(cliente) ?? -1;
    if (dias > prevD) p.clientes.set(cliente, dias);
    const prevF = p.masAntigua?.fechaMaxima ?? null;
    const f = t.fechaMaxima ?? null;
    if (!p.masAntigua || (f && (!prevF || f < prevF))) p.masAntigua = t;
  }
  const patronesCruzados = [...patrones.values()]
    .filter((p) => p.clientes.size >= 2)
    .sort((a, b) => b.clientes.size - a.clientes.size);

  const clientesConAtraso = porClienteFull
    .filter((a) => a.atrasadasMias > 0)
    .slice(0, 4);
  const clienteMasAtrasado = [...clientesConAtraso].sort((a, b) => {
    const da = a.atrasadaMasAntigua?.fechaMaxima
      ? diasEntre(a.atrasadaMasAntigua.fechaMaxima, opts.hoy)
      : 0;
    const db = b.atrasadaMasAntigua?.fechaMaxima
      ? diasEntre(b.atrasadaMasAntigua.fechaMaxima, opts.hoy)
      : 0;
    return db - da || b.atrasadasMias - a.atrasadasMias;
  })[0];

  let diagnostico: string;
  if (patronesCruzados.length > 0) {
    const p = patronesCruzados[0]!;
    const detalle = [...p.clientes.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, 3)
      .map(([c, d]) => (d > 0 ? `${c} (~${d}d)` : c));
    diagnostico = `Hay un patrón claro: el mismo tipo de entregable («${p.etiqueta}») está atascado en ${p.clientes.size} clientes (${juntarNombres(detalle)}). No son fuegos sueltos: es un cuello de botella repetido.`;
  } else if (clienteMasAtrasado) {
    const d = clienteMasAtrasado.atrasadaMasAntigua?.fechaMaxima
      ? diasEntre(clienteMasAtrasado.atrasadaMasAntigua.fechaMaxima, opts.hoy)
      : 0;
    const otros = clientesConAtraso
      .filter((c) => c.cliente !== clienteMasAtrasado.cliente)
      .map((c) => c.cliente);
    diagnostico =
      otros.length > 0
        ? `Lo que más aprieta es ${clienteMasAtrasado.cliente}${d > 0 ? ` (lleva ~${d} días fuera de plazo)` : ""}; también tienes retraso en ${juntarNombres(otros)}. El riesgo es repartir atención y no cerrar ninguno.`
        : `Lo que más aprieta es ${clienteMasAtrasado.cliente}${d > 0 ? ` (~${d} días fuera de plazo)` : ""}. Conviene concentrarte ahí antes de abrir frentes nuevos.`;
  } else if (totales.chatsTareaSinLeer > 0) {
    diagnostico = `No hay atrasadas tuyas, pero sí ${totales.chatsTareaSinLeer} hilo${totales.chatsTareaSinLeer === 1 ? "" : "s"} de tarea con mensajes sin leer: el riesgo es dejar gente esperando respuesta.`;
  } else if (totales.nuevasSinVer > 0) {
    diagnostico = `Bandeja urgente limpia de atrasadas; el ruido está en ${totales.nuevasSinVer} tarea${totales.nuevasSinVer === 1 ? "" : "s"} nueva${totales.nuevasSinVer === 1 ? "" : "s"} sin ver — hay que triar, no ejecutar todo.`;
  } else {
    diagnostico = "Sin retrasos ni chats calientes en tu bandeja: buen momento para elegir un frente y avanzar con calma.";
  }

  let capacidad: string;
  if (totales.creadasPorMi > 0 || totales.completadasPorMi > 0) {
    if (totales.completadasPorMi === 0 && totales.creadasPorMi >= 3) {
      capacidad = `${etiquetaPeriodo.charAt(0).toUpperCase()}${etiquetaPeriodo.slice(1)} has creado ${totales.creadasPorMi} y no has cerrado ninguna. El problema no es falta de trabajo: es cierre. Cada tarea nueva empeora la cola.`;
    } else if (totales.creadasPorMi > totales.completadasPorMi * 2 && totales.creadasPorMi >= 2) {
      capacidad = `${etiquetaPeriodo.charAt(0).toUpperCase()}${etiquetaPeriodo.slice(1)}: ${totales.creadasPorMi} creadas frente a ${totales.completadasPorMi} completadas. Estás acumulando más de lo que cierras.`;
    } else {
      capacidad = `${etiquetaPeriodo.charAt(0).toUpperCase()}${etiquetaPeriodo.slice(1)}: ${totales.creadasPorMi} creadas, ${totales.completadasPorMi} completadas por ti. ${opts.abiertas} abiertas en total.`;
    }
  } else {
    capacidad = `Sin altas ni cierres tuyos ${etiquetaPeriodo}. Sigues con ${opts.abiertas} abiertas${totales.atrasadasMias > 0 ? ` (${totales.atrasadasMias} ya fuera de plazo)` : ""}.`;
  }

  let planHoy: string;
  if (patronesCruzados.length > 0) {
    const p = patronesCruzados[0]!;
    const clientes = juntarNombres([...p.clientes.keys()].slice(0, 3));
    planHoy =
      totales.nuevasSinVer === 0
        ? `Bloquea un rato solo para ese entregable repetido en ${clientes}: empieza por el cliente más antiguo y sigue con el siguiente. Hoy no abras frentes nuevos.`
        : `Bloquea un rato solo para ese entregable repetido en ${clientes}: empieza por el cliente más antiguo. Deja las ${totales.nuevasSinVer} nuevas sin ver para después; hoy no las triajes.`;
  } else if (clienteMasAtrasado) {
    const companeros = clientesConAtraso
      .filter((c) => c.cliente !== clienteMasAtrasado.cliente)
      .slice(0, 2)
      .map((c) => c.cliente);
    planHoy =
      companeros.length > 0
        ? `Hoy: concentración en ${clienteMasAtrasado.cliente} hasta desatascar lo vencido; ${juntarNombres(companeros)} pueden esperar a que eso se mueva. Ignora el inbox nuevo hasta entonces.`
        : `Hoy: concentración en ${clienteMasAtrasado.cliente} hasta desatascar lo vencido. Todo lo demás (incluidas novedades) espera.`;
  } else if (totales.chatsTareaSinLeer > 0) {
    planHoy = `Hoy prioriza responder los hilos de tarea pendientes (${totales.chatsTareaSinLeer}) antes de planificar trabajo nuevo.`;
  } else if (totales.nuevasSinVer > 0) {
    planHoy = `Hoy haz un triaje rápido del inbox (${totales.nuevasSinVer} sin ver): qué entra esta semana y qué se aparca. No intentes ejecutarlas todas.`;
  } else {
    planHoy = "Hoy elige un solo cliente o proyecto activo y avanza un entregable completo; evita repartirte en microtareas.";
  }

  const ruido = [...porClienteFull]
    .filter((a) => a.atrasadasMias === 0 && a.creadasPorMi >= 3)
    .sort((a, b) => b.creadasPorMi - a.creadasPorMi)[0];
  const clientesInbox = porClienteFull
    .filter((a) => a.nuevasSinVer > 0 && a.atrasadasMias === 0)
    .slice(0, 3)
    .map((a) => a.cliente);

  let planSemana: string;
  if (opts.periodo === "diario") {
    const partes: string[] = [];
    if (totales.nuevasSinVer > 0) {
      partes.push(
        clientesInbox.length > 0
          ? `Más adelante en la semana: triaje de lo nuevo (sobre todo ${juntarNombres(clientesInbox)})`
          : `Más adelante en la semana: triaje de las ${totales.nuevasSinVer} nuevas sin ver`,
      );
    }
    if (ruido) {
      partes.push(
        `aparca el ruido de ${ruido.cliente} (${ruido.creadasPorMi} creadas en el periodo: no es urgente frente a lo vencido)`,
      );
    }
    if (partes.length === 0) {
      planSemana =
        "El resto de la semana: mantén el ritmo de cierre; solo abre trabajo nuevo cuando baje la cola vencida.";
    } else {
      planSemana = `${partes.join("; ")}. No mezcles eso con el bloque de hoy.`;
    }
  } else {
    // semanal / mensual: énfasis en tendencia + plan de cierre
    const partes: string[] = [];
    if (totales.atrasadasMias > 0) {
      partes.push(
        `Prioridad de cierre: bajar las ${totales.atrasadasMias} atrasadas antes de engordar el backlog`,
      );
    }
    if (totales.nuevasSinVer > 0) {
      partes.push(
        `reserva un hueco de triaje para ${totales.nuevasSinVer} sin ver${clientesInbox.length ? ` (${juntarNombres(clientesInbox)})` : ""}`,
      );
    }
    if (ruido) {
      partes.push(`no inviertas más en ${ruido.cliente} hasta vaciar lo vencido`);
    }
    if (totales.completadasPorMi === 0 && totales.creadasPorMi > 0) {
      partes.push("meta mínima: cerrar algo cada día laborable, aunque sea poco");
    }
    planSemana =
      partes.length > 0
        ? `${partes.join("; ")}.`
        : "Mantén un ritmo estable de cierre y revisa proyectos activos sin abrir frentes de más.";
  }

  let unEnlace: GuionAtencion["unEnlace"] = null;
  const masAntiguaGlobal = opts.misAtrasadas.reduce<RefClienteTarea | null>((best, t) => {
    if (!t.fechaMaxima) return best;
    if (!best?.fechaMaxima || t.fechaMaxima < best.fechaMaxima) return t;
    return best;
  }, null);
  if (masAntiguaGlobal) {
    const cliente = etiquetaCliente(
      masAntiguaGlobal.clienteNombre,
      masAntiguaGlobal.esPersonal,
    );
    const dias = masAntiguaGlobal.fechaMaxima
      ? diasEntre(masAntiguaGlobal.fechaMaxima, opts.hoy)
      : 0;
    unEnlace = {
      nombre: etiquetaPatron(masAntiguaGlobal.nombre),
      url: urlTarea(masAntiguaGlobal.id),
      porQue:
        dias > 0
          ? `Único atajo opcional: lo más antiguo (${cliente}, ~${dias}d). Úsalo solo si quieres entrar ya; no listes el resto.`
          : `Único atajo opcional (${cliente}). No listes el resto de la bandeja.`,
    };
  }

  const cierre =
    totales.atrasadasMias > 0
      ? `Síntesis: ${opts.abiertas} abiertas, ${totales.atrasadasMias} fuera de plazo, ${totales.completadasPorMi} cerradas por ti ${etiquetaPeriodo}. Si quieres, profundizamos en un solo cliente — no hace falta repasar toda la lista.`
      : `Síntesis: ${opts.abiertas} abiertas, sin atrasadas tuyas, ${totales.completadasPorMi} cerradas por ti ${etiquetaPeriodo}. Di un cliente y bajamos al detalle.`;

  return {
    porCliente,
    guion: {
      instrucciones: GUION_INSTRUCCIONES,
      diagnostico,
      capacidad,
      planHoy,
      planSemana,
      unEnlace,
      cierre,
    },
    totales,
  };
}

/** ISO weekday for a civil YMD: 1=Monday … 7=Sunday. */
function isoWeekdayYmd(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0)).getUTCDay();
  return dow === 0 ? 7 : dow;
}

function rangoPeriodo(
  periodo: PeriodoResumen,
  timeZone: string,
): { inicio: string; fin: string; hoy: string } {
  const hoy = toYmd(new Date(), timeZone);
  if (periodo === "diario") {
    return { inicio: hoy, fin: hoy, hoy };
  }
  if (periodo === "semanal") {
    const iso = isoWeekdayYmd(hoy);
    const inicio = restarDiasYmd(hoy, iso - 1); // Monday
    const fin = restarDiasYmd(hoy, iso - 7); // Sunday
    return { inicio, fin, hoy };
  }
  // mensual: rolling ~30 days ending today (session TZ)
  return { inicio: restarDiasYmd(hoy, 29), fin: hoy, hoy };
}

function diaDeIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return iso.slice(0, 10);
}

function enRango(dia: string | null, inicio: string, fin: string): boolean {
  if (!dia) return false;
  return dia >= inicio && dia <= fin;
}

function compacta(
  t: Tarea,
  nombres: Map<string, string>,
  yoId: string,
  extra?: { etiqueta?: string; clienteNombre?: string | null },
): TareaResumen {
  const mandadaPorId = t.mandadaPorId;
  return {
    id: t.id,
    nombre: t.nombre,
    url: `/tareas?tarea=${encodeURIComponent(t.id)}`,
    proyectoEtiqueta: extra?.etiqueta ?? null,
    clienteNombre: extra?.clienteNombre ?? null,
    fechaMaxima: t.fechaMaxima,
    creadoEl: t.creadoEl,
    completadaEl: t.completadaEl,
    mandadaPor: mandadaPorId
      ? {
          nombre: nombres.get(mandadaPorId) ?? "Desconocido",
          eresTu: mandadaPorId === yoId,
        }
      : null,
  };
}

async function actoresCompletadoPorTarea(
  tareas: Tarea[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (tareas.length === 0) return map;
  const logs = await listarLogsPorMetaIds({
    tareaIds: tareas.map((t) => t.id),
    limit: Math.min(500, tareas.length * 8),
  });
  for (const log of logs) {
    if (log.accion !== "tarea_completada" || !log.actorId) continue;
    const meta = log.metaJson;
    const tid =
      meta &&
      typeof meta === "object" &&
      "tareaId" in meta &&
      typeof (meta as { tareaId: unknown }).tareaId === "string"
        ? (meta as { tareaId: string }).tareaId.trim()
        : "";
    if (!tid || map.has(tid)) continue;
    map.set(tid, log.actorId);
  }
  return map;
}

export async function construirResumenPeriodo(
  usuario: UsuarioAuth,
  periodo: PeriodoResumen,
  opts?: { verTodo?: boolean },
): Promise<object> {
  const zona = parseZona(usuario.timezone);
  const { inicio, fin, hoy } = rangoPeriodo(periodo, zona);
  const verTodo = Boolean(opts?.verTodo && usuario.esAdmin);

  const puedeProyectos = usuarioPuede(usuario, "proyectos.ver");
  const puedeTareas = usuarioPuede(usuario, "tareas.ver");
  const puedeComms = usuarioPuede(usuario, "comunicaciones.ver");

  const personal: Record<string, unknown> = {
    creadasPorMi: [],
    completadasPorMi: [],
    misTareasAbiertas: [],
    misTareasAtrasadas: [],
    misTareasAbiertasTotal: 0,
    misTareasAtrasadasTotal: 0,
    tareasNuevasSinVer: [],
    chatsTareaSinLeer: [],
    contadores: {
      creadasPorMi: 0,
      completadasPorMi: 0,
      abiertas: 0,
      atrasadas: 0,
    },
  };

  const proyectos: Record<string, unknown> = {
    creadas: [],
    completadas: [],
    atrasadas: [],
    vencenEnPeriodo: [],
    proyectosActivos: [],
    contadores: {
      creadas: 0,
      completadas: 0,
      completadasPorMi: 0,
      completadasOtros: 0,
      atrasadas: 0,
      vencen: 0,
    },
  };

  const comunicaciones: Record<string, unknown> = {
    noLeidos: 0,
  };

  let atencion: ReturnType<typeof construirAtencion> = {
    porCliente: [],
    guion: {
      instrucciones: GUION_INSTRUCCIONES,
      diagnostico: "Sin datos de tareas en este alcance.",
      capacidad: "",
      planHoy: "Pide un cliente o proyecto concreto si quieres bajar al detalle.",
      planSemana: "",
      unEnlace: null,
      cierre: "Si quieres, profundizamos en un solo frente.",
    },
    totales: {
      clientesConAtencion: 0,
      atrasadasMias: 0,
      nuevasSinVer: 0,
      chatsTareaSinLeer: 0,
      creadasPorMi: 0,
      completadasPorMi: 0,
    },
  };

  if (puedeProyectos || puedeTareas) {
    const { soloDe } = alcanceProyectos(usuario, verTodo);
    const listaProyectos = await listarProyectos(soloDe);
    const activos = listaProyectos.filter((p) => p.estado === "activo");
    const cat = await catalogoEtiquetas();
    const etiquetaPorProyecto = new Map(
      listaProyectos.map((p) => [p.id, etiquetasDeProyecto(p, cat.clientePorId, cat.tipoPorId)]),
    );
    const extraDe = (t: { proyectoId: string }) => {
      const e = etiquetaPorProyecto.get(t.proyectoId);
      return e ? { etiqueta: e.etiqueta, clienteNombre: e.clienteNombre } : undefined;
    };

    if (puedeTareas) {
      const todas: Tarea[] = [];
      const colPorId = new Map<string, Columna>();
      for (const p of activos) {
        todas.push(...(await tareasDe(p.id)));
        for (const c of await columnasDe(p.id)) colPorId.set(c.id, c);
      }

      const equipo = await mapaEquipo();
      const nombres = new Map([...equipo].map(([id, m]) => [id, m.nombre]));
      const nombreYo = usuario.nombre.trim();
      if (nombreYo) nombres.set(usuario.id, nombreYo);

      const abiertasProy = todas.filter(
        (t) => !t.completadaEl && !esColumnaCerrada(colPorId.get(t.columnaId)),
      );
      const atrasadasProy = abiertasProy.filter((t) => {
        const d = t.fechaMaxima;
        return Boolean(d && d < hoy);
      });
      const vencenProy = abiertasProy.filter((t) => enRango(t.fechaMaxima, inicio, fin));
      const creadasProy = todas.filter((t) => enRango(diaDeIso(t.creadoEl), inicio, fin));
      const creadasPorMi = creadasProy.filter((t) => t.mandadaPorId === usuario.id);

      const completadasRaw = todas.filter((t) =>
        enRango(diaDeIso(t.completadaEl), inicio, fin),
      );
      // Actors for the full period set so contadores.completadasPorMi is not capped by TOP_LISTA.
      const actorPorTarea = await actoresCompletadoPorTarea(completadasRaw);

      const conActor = (t: Tarea): TareaCompletadaResumen => {
        const base = compacta(t, nombres, usuario.id, extraDe(t));
        const actorId = actorPorTarea.get(t.id);
        return {
          ...base,
          completadaPor: actorId
            ? {
                nombre: nombres.get(actorId) ?? "Desconocido",
                eresTu: actorId === usuario.id,
              }
            : null,
        };
      };
      const completadasTodas = completadasRaw.map(conActor);
      const completadasPorMiTodas = completadasTodas.filter((t) => t.completadaPor?.eresTu);
      const nCompletadasPorMi = completadasPorMiTodas.length;

      // Listas planas omitidas a propósito: el modelo debe usar atencion.guion (briefing).
      proyectos.atrasadas = [];
      proyectos.vencenEnPeriodo = [];
      proyectos.creadas = [];
      proyectos.completadas = [];
      proyectos.contadores = {
        creadas: creadasProy.length,
        completadas: completadasRaw.length,
        completadasPorMi: nCompletadasPorMi,
        completadasOtros: completadasRaw.length - nCompletadasPorMi,
        atrasadas: atrasadasProy.length,
        vencen: vencenProy.length,
      };

      personal.creadasPorMi = [];
      personal.completadasPorMi = [];
      personal.contadores = {
        ...(personal.contadores as Record<string, number>),
        creadasPorMi: creadasPorMi.length,
        completadasPorMi: nCompletadasPorMi,
      };

      const [misTareas, nuevasSinVer, chatsTarea] = await Promise.all([
        tareasDelUsuario(usuario.id),
        tareasNuevasSinVer(usuario.id),
        chatsTareaSinLeer(usuario.id, TOP_LISTA),
      ]);

      const misAbiertas = misTareas.filter((t) => !t.completadaEl);
      const misAtrasadas = misAbiertas.filter((t) => {
        const d = t.fechaMaxima;
        return Boolean(d && d < hoy);
      });

      personal.misTareasAbiertas = [];
      personal.misTareasAtrasadas = [];
      personal.misTareasAbiertasTotal = misAbiertas.length;
      personal.misTareasAtrasadasTotal = misAtrasadas.length;
      personal.tareasNuevasSinVerTotal = nuevasSinVer.length;
      personal.tareasNuevasSinVer = [];
      personal.chatsTareaSinLeer = [];
      personal.contadores = {
        ...(personal.contadores as Record<string, number>),
        abiertas: misAbiertas.length,
        atrasadas: misAtrasadas.length,
        nuevasSinVer: nuevasSinVer.length,
      };
      personal.listasOmitidas =
        "Usar atencion.guion (ahora/estaSemana). Contadores arriba son totales reales.";
      proyectos.listasOmitidas =
        "Usar atencion.guion + contadores. No inventariar tareas.";

      atencion = construirAtencion({
        periodo,
        hoy,
        abiertas: misAbiertas.length,
        misAtrasadas: misAtrasadas.map((t) => ({
          id: t.id,
          nombre: t.nombre,
          clienteNombre: t.clienteNombre,
          proyectoEtiqueta: t.proyectoEtiqueta,
          esPersonal: t.esPersonal,
          fechaMaxima: t.fechaMaxima,
        })),
        nuevasSinVer: nuevasSinVer.map((t) => ({
          id: t.id,
          nombre: t.nombre,
          clienteNombre: t.clienteNombre,
          proyectoEtiqueta: t.proyectoEtiqueta,
        })),
        creadasPorMi: creadasPorMi.map((t) => {
          const e = extraDe(t);
          return {
            id: t.id,
            nombre: t.nombre,
            clienteNombre: e?.clienteNombre ?? null,
            proyectoEtiqueta: e?.etiqueta ?? null,
          };
        }),
        completadasPorMi: completadasPorMiTodas.map((t) => ({
          id: t.id,
          nombre: t.nombre,
          clienteNombre: t.clienteNombre,
          proyectoEtiqueta: t.proyectoEtiqueta,
        })),
        chats: chatsTarea,
        etiquetaPorProyecto,
      });
    }

    if (puedeProyectos) {
      const mapaAbiertas = await contarTareasAbiertasMap(activos.map((p) => p.id));
      proyectos.proyectosActivos = activos.slice(0, 40).map((p) => {
        const e = etiquetaPorProyecto.get(p.id);
        return {
          id: p.id,
          etiqueta: e?.etiqueta ?? p.nombre,
          clienteNombre: e?.clienteNombre ?? null,
          estado: p.estado,
          tareasAbiertas: mapaAbiertas.get(p.id) ?? 0,
        };
      });
    }
  }

  if (puedeComms) {
    comunicaciones.noLeidos = await contarNoLeidosDe(usuario.id);
  }

  return {
    periodo,
    desde: inicio,
    hasta: fin,
    verTodo,
    personal,
    proyectos,
    comunicaciones,
    atencion,
    atribucion: { reglas: [...REGLAS_ATRIBUCION] },
  };
}
