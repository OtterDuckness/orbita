import { exigirPermiso } from "@/lib/authz";
import { listarClientes } from "@/lib/clientes";
import {
  conversacionPorIdPara,
  listarConversacionesDe,
  listarMensajes,
  parseRefToken,
  type ReferenciaVista,
} from "@/lib/comunicaciones";
import { listarProyectos } from "@/lib/proyectos";
import { mapaNombresTipo } from "@/lib/tipos-proyecto";
import { listarEquipo, usuarioPuede } from "@/lib/usuarios";
import { Cabecera } from "../cabecera";
import type { OpcionRef } from "./formulario-mensaje";
import { NuevaConversacionLightbox } from "./nueva-conversacion-lightbox";
import { PanelComunicaciones } from "./panel-comunicaciones";

export const dynamic = "force-dynamic";

export default async function Comunicaciones({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; mencionar?: string }>;
}) {
  const yo = await exigirPermiso("comunicaciones.ver");
  const params = await searchParams;
  const cId = (params.c ?? "").trim();
  const mencionarToken = (params.mencionar ?? "").trim();

  const [conversaciones, equipo, clientes, proyectos, nombresTipo] = await Promise.all([
    listarConversacionesDe(yo.id),
    listarEquipo(),
    listarClientes(),
    listarProyectos(yo.esAdmin ? null : yo.id),
    mapaNombresTipo(),
  ]);

  const nombresCliente = new Map(clientes.map((c) => [c.id, c.nombre]));

  const opcionesRef: OpcionRef[] = [
    ...clientes.map((c) => ({
      token: `cliente:${c.id}`,
      etiqueta: c.nombre,
      tipo: "cliente" as const,
    })),
    ...proyectos.map((p) => {
      const tipo = p.tipoId ? (nombresTipo.get(p.tipoId) ?? "Proyecto") : "Proyecto";
      const titulo = p.nombre?.trim() || tipo;
      const cliente = p.clienteId ? nombresCliente.get(p.clienteId) : null;
      return {
        token: `proyecto:${p.id}`,
        etiqueta: cliente ? `${cliente} · ${titulo}` : titulo,
        tipo: "proyecto" as const,
      };
    }),
  ];

  let mencionInicial: ReferenciaVista | null = null;
  const parsed = parseRefToken(mencionarToken);
  if (parsed) {
    const op = opcionesRef.find((o) => o.token === `${parsed.tipo}:${parsed.entidadId}`);
    if (op) {
      mencionInicial = {
        tipo: parsed.tipo,
        entidadId: parsed.entidadId,
        etiqueta: op.etiqueta,
        href: parsed.tipo === "cliente" ? "/clientes" : `/proyectos/${parsed.entidadId}`,
      };
    }
  }

  const activa = cId ? await conversacionPorIdPara(cId, yo.id) : null;
  const mensajes = activa ? ((await listarMensajes(activa.id, yo.id)) ?? []) : [];
  const puedeEditar = usuarioPuede(yo, "comunicaciones.editar");

  return (
    <>
      <Cabecera
        etiqueta="Equipo"
        titulo="Comunicaciones"
        texto="Mensajes directos y grupos internos. Puedes vincular clientes/proyectos y adjuntar archivos."
        sello={`${conversaciones.length} ${conversaciones.length === 1 ? "hilo" : "hilos"}`}
        acciones={
          puedeEditar ? (
            <NuevaConversacionLightbox equipo={equipo} yoId={yo.id} />
          ) : undefined
        }
      />
      <PanelComunicaciones
        conversaciones={conversaciones}
        activa={activa}
        mensajes={mensajes}
        yoId={yo.id}
        puedeEditar={puedeEditar}
        opcionesRef={opcionesRef}
        mencionInicial={mencionInicial}
      />
    </>
  );
}
