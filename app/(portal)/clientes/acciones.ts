"use server";

import { redirect } from "next/navigation";
import { formatearAlta, formatearCambios, logActividad } from "@/lib/admin-logs";
import { exigirPermiso } from "@/lib/authz";
import {
  clientePorId,
  crearCliente as crearClienteDb,
  editarCliente,
  eliminarCliente,
  enviarInvitacion,
  parseTipoCuenta,
} from "@/lib/clientes";
import { registrarAccionReversible, snapCliente } from "@/lib/deshacer";
import type { OrigenAlta } from "@/lib/clientes-mock";
import { etiquetaTipoCuenta, normalizarTelefonoEs } from "@/lib/clientes-mock";
import { borrarEventosCalendarDeProyectos } from "@/lib/google-calendar";
import {
  puedeCrearProyectoEnCliente,
  puedeGestionarCliente,
} from "@/lib/permisos-entidad";
import { usuarioPorId } from "@/lib/usuarios";
import { tipoPorId } from "@/lib/tipos-proyecto";
import { anadirProyecto, proyectosDe } from "@/lib/proyectos";

async function nombreUsuario(id: string | null | undefined): Promise<string> {
  if (!id) return "—";
  const u = await usuarioPorId(id);
  return u?.nombre ?? id.slice(0, 8);
}

type DatosProyectoForm = {
  nombre: string;
  tipoId: string;
  feeMensual: string;
  finContrato: string;
  responsableId: string;
  prioridad: string;
  colaboradorIds: string[];
};

function proyectosDesdeForm(formData: FormData): DatosProyectoForm[] {
  const count = Math.max(0, Number(formData.get("proyectos_count") ?? 0) || 0);
  const out: DatosProyectoForm[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      nombre: String(formData.get(`proyecto_${i}_nombre`) ?? ""),
      tipoId: String(formData.get(`proyecto_${i}_tipo_id`) ?? "").trim(),
      feeMensual: String(formData.get(`proyecto_${i}_fee_mensual`) ?? ""),
      finContrato: String(formData.get(`proyecto_${i}_fin_contrato`) ?? ""),
      responsableId: String(formData.get(`proyecto_${i}_responsable_id`) ?? ""),
      prioridad: String(formData.get(`proyecto_${i}_prioridad`) ?? "media"),
      colaboradorIds: formData.getAll(`proyecto_${i}_colaborador_ids`).map(String),
    });
  }
  return out;
}

async function registrarProyectoCreado(
  actor: Awaited<ReturnType<typeof exigirPermiso>>,
  clienteNombre: string,
  clienteId: string,
  datos: DatosProyectoForm,
  proyectoId: string,
  nombreGuardado: string | null,
) {
  const tipo = await tipoPorId(datos.tipoId);
  const responsable = await nombreUsuario(datos.responsableId);
  const tituloProyecto = nombreGuardado?.trim() || tipo?.nombre || "Proyecto";
  await logActividad(
    actor,
    "proyecto_creado",
    formatearAlta(`Proyecto «${tituloProyecto}» para «${clienteNombre}»`, [
      { campo: "nombre", valor: nombreGuardado },
      { campo: "tipo", valor: tipo?.nombre },
      { campo: "prioridad", valor: datos.prioridad },
      { campo: "oportunidad", valor: datos.feeMensual || null },
      { campo: "fin contrato", valor: datos.finContrato || null },
      { campo: "responsable", valor: responsable === "—" ? null : responsable },
    ]),
    { proyectoId, clienteId },
  );
}

export async function crearCliente(formData: FormData) {
  const actor = await exigirPermiso("clientes.editar");

  const origen: OrigenAlta = "manual";
  const proyectos = proyectosDesdeForm(formData).filter(
    (p) => Boolean(p.tipoId) && p.tipoId !== "__otro__",
  );

  const resultado = await crearClienteDb({
    nombre: String(formData.get("nombre") ?? ""),
    correoAcceso: String(formData.get("correo_acceso") ?? ""),
    telefono: String(formData.get("telefono") ?? ""),
    responsableId: String(formData.get("responsable_id") ?? "").trim() || actor.id,
    tipoCuenta: String(formData.get("tipo_cuenta") ?? ""),
    origen,
    enviarInvitacion: formData.get("enviar_invitacion") === "on",
  });

  if (!resultado.ok) {
    redirect(`/clientes?aviso=${resultado.motivo}`);
  }

  const responsableNombre = await nombreUsuario(resultado.cliente.responsableId);
  await logActividad(
    actor,
    "cliente_creado",
    formatearAlta(`Cliente «${resultado.cliente.nombre}»`, [
      { campo: "correo", valor: resultado.cliente.correoAcceso },
      { campo: "teléfono", valor: resultado.cliente.telefono },
      {
        campo: "responsable",
        valor: responsableNombre === "—" ? null : responsableNombre,
      },
      {
        campo: "tipo de cuenta",
        valor: etiquetaTipoCuenta(resultado.cliente.tipoCuenta),
      },
      { campo: "origen", valor: origen },
      {
        campo: "invitación",
        valor: resultado.cliente.invitacionEnviada ? "enviada" : "no",
      },
      { campo: "proyectos", valor: proyectos.length },
    ]),
    { clienteId: resultado.cliente.id },
  );

  for (const datos of proyectos) {
    const responsableId =
      datos.responsableId.trim() || resultado.cliente.responsableId || actor.id;
    const proyecto = await anadirProyecto({
      clienteId: resultado.cliente.id,
      nombre: datos.nombre,
      tipoId: datos.tipoId,
      feeMensual: datos.feeMensual,
      finContrato: datos.finContrato,
      responsableId,
      prioridad: datos.prioridad,
      colaboradorIds: datos.colaboradorIds,
    });
    if (!proyecto.ok) redirect(`/clientes?aviso=${proyecto.motivo}`);
    await registrarProyectoCreado(
      actor,
      resultado.cliente.nombre,
      resultado.cliente.id,
      { ...datos, responsableId },
      proyecto.proyecto.id,
      proyecto.proyecto.nombre,
    );
  }

  redirect(`/clientes?aviso=${resultado.cliente.invitacionEnviada ? "creado_invitado" : "creado"}`);
}

export async function enviarInvitacionCliente(formData: FormData) {
  const actor = await exigirPermiso("clientes.editar");
  const id = String(formData.get("cliente_id") ?? "");
  if (!(await puedeGestionarCliente(actor, id))) {
    redirect("/clientes?aviso=sin_permiso");
  }
  const cliente = await clientePorId(id);
  const resultado = await enviarInvitacion(id);
  if (resultado.ok) {
    await logActividad(
      actor,
      "cliente_invitacion",
      `Invitación enviada a «${cliente?.nombre ?? id}» (${cliente?.correoAcceso ?? "—"})`,
      { clienteId: id },
    );
  }
  redirect(`/clientes?aviso=${resultado.ok ? "invitacion_enviada" : "no_encontrado"}`);
}

export async function crearProyecto(formData: FormData) {
  const actor = await exigirPermiso("proyectos.editar");
  const clienteId = String(formData.get("cliente_id") ?? "");
  const cliente = await clientePorId(clienteId);
  if (!cliente) {
    redirect("/clientes?aviso=no_encontrado");
  }
  if (!(await puedeCrearProyectoEnCliente(actor, clienteId))) {
    redirect("/clientes?aviso=sin_permiso");
  }

  const proyectos = proyectosDesdeForm(formData);
  if (proyectos.length === 0) redirect("/clientes?aviso=falta_dato");
  if (proyectos.some((p) => !p.tipoId)) redirect("/clientes?aviso=sin_tipo");

  for (const datos of proyectos) {
    const responsableId =
      datos.responsableId.trim() || cliente.responsableId || actor.id;
    const resultado = await anadirProyecto({
      clienteId,
      nombre: datos.nombre,
      tipoId: datos.tipoId,
      feeMensual: datos.feeMensual,
      finContrato: datos.finContrato,
      responsableId,
      prioridad: datos.prioridad,
      colaboradorIds: datos.colaboradorIds,
    });
    if (!resultado.ok) redirect(`/clientes?aviso=${resultado.motivo}`);
    await registrarProyectoCreado(
      actor,
      cliente.nombre,
      clienteId,
      { ...datos, responsableId },
      resultado.proyecto.id,
      resultado.proyecto.nombre,
    );
  }

  redirect(
    `/clientes?aviso=${proyectos.length > 1 ? "proyectos_creados" : "proyecto_creado"}`,
  );
}

export async function editarClienteCuenta(formData: FormData) {
  const actor = await exigirPermiso("clientes.editar");

  const clienteId = String(formData.get("cliente_id") ?? "");
  if (!(await puedeGestionarCliente(actor, clienteId))) {
    redirect("/clientes?aviso=sin_permiso");
  }
  const nombre = String(formData.get("nombre") ?? "");
  const correoAcceso = String(formData.get("correo_acceso") ?? "");
  const telefono = String(formData.get("telefono") ?? "");
  const responsableId = String(formData.get("responsable_id") ?? "");
  const tipoCuentaRaw = String(formData.get("tipo_cuenta") ?? "");
  const antes = await clientePorId(clienteId);
  const telefonoNorm = normalizarTelefonoEs(telefono);
  const tipoCuenta = parseTipoCuenta(tipoCuentaRaw);
  // Por ahora no se edita el origen en UI; se conserva el valor existente.
  const origen: OrigenAlta = antes?.origen === "clientify" ? "clientify" : "manual";

  const resultado = await editarCliente({
    clienteId,
    nombre,
    correoAcceso,
    telefono,
    responsableId,
    tipoCuenta: tipoCuentaRaw,
    origen,
  });

  if (!resultado.ok) {
    redirect(`/clientes?aviso=${resultado.motivo}`);
  }
  const [respAntes, respDespues] = await Promise.all([
    nombreUsuario(antes?.responsableId),
    nombreUsuario(responsableId),
  ]);
  await logActividad(
    actor,
    "cliente_editado",
    formatearCambios(`Cliente «${nombre.trim() || antes?.nombre || clienteId}»`, [
      { campo: "nombre", de: antes?.nombre, a: nombre.trim() },
      { campo: "correo", de: antes?.correoAcceso, a: correoAcceso.trim().toLowerCase() },
      {
        campo: "teléfono",
        de: antes?.telefono,
        a: telefonoNorm === false ? null : telefonoNorm,
      },
      {
        campo: "responsable",
        de: respAntes === "—" ? null : respAntes,
        a: respDespues === "—" ? null : respDespues,
      },
      {
        campo: "tipo de cuenta",
        de: etiquetaTipoCuenta(antes?.tipoCuenta),
        a: etiquetaTipoCuenta(tipoCuenta === false ? null : tipoCuenta),
      },
    ]),
    { clienteId },
  );
  if (antes) {
    const despues = await clientePorId(clienteId);
    if (despues) {
      await registrarAccionReversible({
        actorId: actor.id,
        via: "ui",
        tipo: "cliente_editado",
        etiqueta: `Cliente «${despues.nombre}»`,
        entidadTipo: "cliente",
        entidadId: clienteId,
        before: snapCliente(antes),
        after: snapCliente(despues),
      }).catch((e) => console.error("[deshacer] registrar cliente_editado", e));
    }
  }
  redirect("/clientes?aviso=guardado");
}

export async function eliminarClienteCuenta(formData: FormData) {
  const usuario = await exigirPermiso("clientes.editar");
  const clienteId = String(formData.get("cliente_id") ?? "");
  const cliente = await clientePorId(clienteId);
  if (!cliente) redirect("/clientes?aviso=no_encontrado");
  if (!(await puedeGestionarCliente(usuario, clienteId))) {
    redirect("/clientes?aviso=sin_permiso");
  }

  const proyectos = await proyectosDe(clienteId);
  await borrarEventosCalendarDeProyectos(
    proyectos.map((p) => p.id),
    usuario.correo,
  );

  const resultado = await eliminarCliente(clienteId, {
    id: usuario.id,
    correo: usuario.correo,
  });
  if (!resultado.ok) redirect("/clientes?aviso=no_encontrado");
  await logActividad(
    usuario,
    "cliente_eliminado",
    formatearAlta(`Cliente «${cliente.nombre}» eliminado`, [
      { campo: "correo", valor: cliente.correoAcceso },
      { campo: "proyectos borrados", valor: resultado.proyectosBorrados },
    ]),
    {
      clienteId,
      numProyectos: resultado.proyectosBorrados,
      eliminacionId: resultado.eliminacionId,
      conversacionesBorradas: resultado.conversacionesBorradas,
    },
  );
  await registrarAccionReversible({
    actorId: usuario.id,
    via: "ui",
    tipo: "eliminacion",
    etiqueta: `Eliminar cliente «${cliente.nombre}»`,
    entidadTipo: "cliente",
    entidadId: clienteId,
    before: { eliminacionId: resultado.eliminacionId },
    eliminacionId: resultado.eliminacionId,
  }).catch((e) => console.error("[deshacer] registrar eliminacion cliente", e));
  redirect("/clientes?aviso=cliente_eliminado");
}
