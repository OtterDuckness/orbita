import { exigirSesionUsuario } from "@/lib/authz";
import { pendientesUiEnriquecidos } from "@/lib/asistente/confirmacion-ui";
import { textoVisibleEnUi } from "@/lib/asistente/historial";
import {
  listarConversaciones,
  listarMensajes,
  obtenerConversacion,
} from "@/lib/asistente/store";
import { regenerarTitulosLegacy } from "@/lib/asistente/titulo";
import { listarTiposProyecto } from "@/lib/tipos-proyecto";
import { esModoPruebas } from "@/lib/sandbox";
import { listarEquipo } from "@/lib/usuarios";
import { Cabecera } from "../cabecera";
import { PanelAsistente } from "./panel-asistente";

export const dynamic = "force-dynamic";

export default async function AsistentePage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; nuevo?: string }>;
}) {
  const yo = await exigirSesionUsuario();
  const modoPruebas = await esModoPruebas();
  const params = await searchParams;
  const cParam = (params.c ?? "").trim();
  const quiereNuevo = params.nuevo === "1" || params.nuevo === "true";

  // Backfill: títulos = primer mensaje → resumen corto (máx. 4 por carga).
  await regenerarTitulosLegacy(yo.id);
  const conversaciones = await listarConversaciones(yo.id);
  let mensajes: Awaited<ReturnType<typeof listarMensajes>> = [];
  let conversacionActiva: Awaited<ReturnType<typeof obtenerConversacion>> = null;

  // Sin ?c= (o con ?nuevo=1) → chat vacío nuevo. Con ?c= → esa conversación.
  const cId = quiereNuevo || !cParam ? "" : cParam;

  if (cId) {
    conversacionActiva = await obtenerConversacion(cId, yo.id);
    if (conversacionActiva) {
      mensajes = await listarMensajes(cId);
    }
  }

  const mensajesUi = mensajes
    .map((m) => {
      const texto = textoVisibleEnUi(m);
      if (texto == null) return null;
      return { ...m, contenido: texto };
    })
    .filter((m): m is NonNullable<typeof m> => m != null);

  const [confirmacionesPendientes, equipo, tipos] = await Promise.all([
    pendientesUiEnriquecidos(yo, mensajes),
    listarEquipo(),
    listarTiposProyecto(),
  ]);

  return (
    <>
      <Cabecera
        etiqueta="IA"
        titulo="Asistente"
        texto={
          modoPruebas
            ? "Modo pruebas: solo datos mock. Chats y gasto de esta sesión no se mezclan con producción. Calendar y correo no se tocan."
            : "Chat con Haiku sobre clientes, proyectos, tareas y comunicaciones. Respeta tus permisos."
        }
      />
      <PanelAsistente
        conversaciones={conversaciones}
        conversacionId={conversacionActiva?.id ?? null}
        mensajes={mensajesUi}
        confirmacionesPendientes={confirmacionesPendientes}
        equipo={equipo}
        tipos={tipos}
        modoPruebas={modoPruebas}
      />
    </>
  );
}
