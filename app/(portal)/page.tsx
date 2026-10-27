import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { leerApartados, primeraRutaVisible } from "@/lib/apartados";
import {
  agruparPorDia,
  diasLaborablesDesde,
  filtrarEventosReunion,
  hrefTareaPanel,
  restarDiasYmd,
  tareasParaHoy,
  toYmd,
  type ItemAgenda,
  type ReunionAgenda,
  type TareaAgenda,
  type TareaParaAgenda,
} from "@/lib/agenda";
import { instanteEnZona, ZONA } from "@/lib/formato";
import { listarConversacionesDe } from "@/lib/comunicaciones";
import { listarEventosPrimary } from "@/lib/google-calendar";
import { asignacionesRecientes } from "@/lib/proyectos";
import { chatsTareaSinLeer } from "@/lib/tarea-chat";
import {
  idsEventosCalendarOrbita,
  tareasDelUsuario,
  tareasNuevasSinVer,
  tareasVencidasPanel,
} from "@/lib/tablero";
import {
  obtenerUsuarioAuthPorCorreo,
  tokensGooglePorCorreo,
  usuarioPuede,
} from "@/lib/usuarios";
import { Cabecera } from "./cabecera";
import { HoyResumen } from "./hoy-resumen";
import { PanelResumen, type NovedadesPanel } from "./panel-resumen";
import { ProximosDias, type ProximosDia } from "./proximos-dias";

export const dynamic = "force-dynamic";

const TOP_NOVEDADES = 4;
const TOP_VENCIDAS = 6;
const DIAS_ASIGNACIONES = 7;
const DIAS_VENCIDAS = 15;

function etiquetaFechaHoy(): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: ZONA,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

async function cargarAgenda(
  usuarioId: string,
  email: string,
  puedeTareas: boolean,
): Promise<{
  reunionesHoy: ReunionAgenda[];
  tareasHoy: TareaAgenda[];
  proximos: ProximosDia[];
  googleEstado: "ok" | "sin_tokens" | "error" | "omitido";
} | null> {
  if (!puedeTareas) return null;

  const ahora = new Date();
  const hoyYmd = toYmd(ahora);
  const diasAgenda = diasLaborablesDesde(ahora, 7);
  const ultimo = diasAgenda[diasAgenda.length - 1]!;
  const inicio = instanteEnZona(hoyYmd, "00:00:00.000");
  const fin = instanteEnZona(ultimo, "23:59:59.999");

  const tareasRaw = await tareasDelUsuario(usuarioId);
  const paraAgenda: TareaParaAgenda[] = tareasRaw.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    fechaMaxima: t.fechaMaxima,
    proyectoId: t.proyectoId,
    esPersonal: t.esPersonal,
    proyectoEtiqueta: t.proyectoEtiqueta,
    clienteNombre: t.clienteNombre,
    completada: Boolean(t.completadaEl),
  }));
  const tareasHoy = tareasParaHoy(paraAgenda, hoyYmd);

  const tokens = await tokensGooglePorCorreo(email);
  let eventos: Awaited<ReturnType<typeof listarEventosPrimary>> = [];
  let googleEstado: "ok" | "sin_tokens" | "error" | "omitido" = "ok";

  if (!tokens?.refreshToken) {
    googleEstado = "sin_tokens";
  } else {
    try {
      const [ev, idsOrbita] = await Promise.all([
        listarEventosPrimary(
          {
            refreshToken: tokens.refreshToken,
            accessToken: tokens.accessToken,
            expiry: tokens.expiry ?? null,
          },
          { timeMin: inicio.toISOString(), timeMax: fin.toISOString() },
        ),
        idsEventosCalendarOrbita(),
      ]);
      eventos = filtrarEventosReunion(ev, idsOrbita, paraAgenda);
    } catch (error) {
      console.error("[inicio] listar Google agenda falló", { email, error });
      googleEstado = "error";
    }
  }

  const porDia = agruparPorDia(paraAgenda, eventos, { hoyYmd });

  const reunionesHoy = (porDia.get(hoyYmd) ?? []).filter(
    (i): i is ReunionAgenda => i.tipo === "reunion",
  );

  const proximos: ProximosDia[] = diasAgenda.map((ymd) => {
    const items = (porDia.get(ymd) ?? []).filter((it: ItemAgenda) => {
      if (it.tipo === "reunion") return true;
      return !it.completada;
    });
    return { ymd, items };
  });

  return { reunionesHoy, tareasHoy, proximos, googleEstado };
}

export default async function Panel() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const usuario = email ? await obtenerUsuarioAuthPorCorreo(email) : null;
  const apartados = usuario && !usuario.esAdmin ? await leerApartados() : null;
  if (usuario && apartados && !apartados.panel) {
    const destino = primeraRutaVisible(usuario, apartados, "panel");
    if (destino) redirect(destino);
    return (
      <Cabecera
        etiqueta="Portal"
        titulo="Sin apartados"
        texto="No hay secciones del menú activas para tu usuario. Un administrador puede abrirlas en Admin → Apartados."
      />
    );
  }
  const seccionAbierta = (id: "clientes" | "tareas" | "comunicaciones") =>
    !apartados || apartados[id];

  const nombreCompleto =
    usuario?.nombre?.trim() || session?.user?.name?.trim() || "equipo";
  const nombre = nombreCompleto.split(/\s+/)[0] ?? "equipo";

  const puedeClientes = usuario
    ? usuarioPuede(usuario, "clientes.ver") && seccionAbierta("clientes")
    : false;
  const puedeTareas = usuario
    ? usuarioPuede(usuario, "tareas.ver") && seccionAbierta("tareas")
    : false;
  const puedeComunicaciones = usuario
    ? usuarioPuede(usuario, "comunicaciones.ver") && seccionAbierta("comunicaciones")
    : false;

  const hoyYmd = toYmd(new Date());
  const vencidasDesde = restarDiasYmd(hoyYmd, DIAS_VENCIDAS);
  const vencidasHasta = restarDiasYmd(hoyYmd, 2);

  const [agenda, conversaciones, asignaciones, tareasNuevas, chatsTarea, vencidas] =
    await Promise.all([
      usuario ? cargarAgenda(usuario.id, email, puedeTareas) : Promise.resolve(null),
      puedeComunicaciones && usuario
        ? listarConversacionesDe(usuario.id)
        : Promise.resolve(null),
      puedeClientes && usuario
        ? asignacionesRecientes(usuario.id, DIAS_ASIGNACIONES)
        : Promise.resolve(null),
      puedeTareas && usuario ? tareasNuevasSinVer(usuario.id) : Promise.resolve(null),
      puedeTareas && usuario ? chatsTareaSinLeer(usuario.id, TOP_NOVEDADES) : Promise.resolve(null),
      puedeTareas && usuario
        ? tareasVencidasPanel(usuario.id, vencidasDesde, vencidasHasta, TOP_VENCIDAS)
        : Promise.resolve(null),
    ]);

  let novedades: NovedadesPanel | null = null;
  if (usuario) {
    const clientesAsignados = (asignaciones ?? []).slice(0, TOP_NOVEDADES).map((a) => ({
      clienteId: a.clienteId,
      clienteNombre: a.clienteNombre,
      proyectoId: a.proyectoId,
      proyectoEtiqueta: a.proyectoEtiqueta,
      asignadoEn: a.asignadoEn,
    }));

    const mensajesComms =
      conversaciones
        ?.filter((c) => c.noLeidos > 0)
        .map((c) => ({
          id: `comms-${c.id}`,
          titulo: c.titulo,
          preview: c.ultimoCuerpo,
          noLeidos: c.noLeidos,
          ultimoEn: c.ultimoEn,
          href: `/comunicaciones?c=${c.id}`,
        })) ?? [];

    const mensajesChatTarea =
      chatsTarea?.map((c) => ({
        id: `tarea-${c.tareaId}`,
        titulo: c.titulo,
        preview: c.ultimoCuerpo,
        noLeidos: c.noLeidos,
        ultimoEn: c.ultimoEn,
        href: hrefTareaPanel({
          id: c.tareaId,
          proyectoId: c.proyectoId,
          esPersonal: c.esPersonal,
        }),
      })) ?? [];

    const mensajesNuevos = [...mensajesComms, ...mensajesChatTarea]
      .sort((a, b) => (b.ultimoEn ?? "").localeCompare(a.ultimoEn ?? ""))
      .slice(0, TOP_NOVEDADES);

    const nuevas = (tareasNuevas ?? []).slice(0, TOP_NOVEDADES).map((t) => ({
      id: t.id,
      nombre: t.nombre,
      proyectoId: t.proyectoId,
      proyectoEtiqueta: t.proyectoEtiqueta,
      clienteNombre: t.clienteNombre,
      creadoEl: t.creadoEl,
    }));

    const tareasVencidas = (vencidas ?? []).slice(0, TOP_VENCIDAS).map((t) => ({
      id: t.id,
      nombre: t.nombre,
      proyectoId: t.proyectoId,
      esPersonal: t.esPersonal,
      proyectoEtiqueta: t.proyectoEtiqueta,
      clienteNombre: t.clienteNombre,
      fechaMaxima: t.fechaMaxima,
    }));

    if (puedeTareas || puedeClientes || puedeComunicaciones) {
      novedades = {
        tareasNuevas: puedeTareas ? nuevas : null,
        clientesAsignados: puedeClientes ? clientesAsignados : null,
        mensajesNuevos:
          puedeComunicaciones || puedeTareas ? mensajesNuevos : null,
        tareasVencidas: puedeTareas ? tareasVencidas : null,
      };
    }
  }

  return (
    <>
      <div className="[&>div]:mb-4">
        <Cabecera
          etiqueta="Inicio"
          titulo={`Hola, ${nombre}`}
          texto={etiquetaFechaHoy()}
        />
      </div>
      <PanelResumen
        hoy={
          agenda ? (
            <HoyResumen
              reuniones={agenda.reunionesHoy}
              tareas={agenda.tareasHoy}
              googleEstado={agenda.googleEstado}
            />
          ) : undefined
        }
        proximos={
          agenda ? (
            <ProximosDias dias={agenda.proximos} googleEstado={agenda.googleEstado} />
          ) : undefined
        }
        novedades={novedades}
      />
    </>
  );
}
