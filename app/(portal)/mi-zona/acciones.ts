"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin, exigirAdminReal, exigirPermiso } from "@/lib/authz";
import {
  esVistaMiZona,
  escribirCookieVistaMiZona,
  type VistaMiZona,
} from "@/lib/vista-mi-zona";
import {
  idsEquipoAccesibles,
  obtenerHoldedEmployeeId,
  puedeAccederEmpleadoHolded,
  reemplazarEquipoJefe,
  guardarHoldedEmployeeId,
} from "@/lib/holded-equipo";
import {
  HOLDED_TIME_OFF_APPROVE_SUPPORTED,
  HoldedError,
  aprobarAusencia,
  ficharEntrada,
  ficharSalida,
  finalizarPausa,
  holdedConfigurado,
  iniciarPausa,
  solicitarAusencia,
} from "@/lib/holded";
function revalidateMiZona() {
  revalidatePath("/mi-zona");
  revalidatePath("/mi-zona/horario");
  revalidatePath("/mi-zona/ausencias");
  revalidatePath("/mi-zona/nominas");
}

async function employeeIdAutorizado(
  permiso: "mi_zona.fichar" | "mi_zona.ausencias" | "mi_zona.nominas",
  usuarioObjetivoId?: string | null,
): Promise<
  | { ok: true; employeeId: string; actorId: string }
  | { ok: false; motivo: "sin_config" | "sin_vinculo" | "sin_acceso" }
> {
  const actor = await exigirPermiso(permiso);
  if (!holdedConfigurado()) return { ok: false, motivo: "sin_config" };

  const objetivoId = usuarioObjetivoId?.trim() || actor.id;
  const equipo = await idsEquipoAccesibles(actor);
  const holdedId =
    objetivoId === actor.id
      ? actor.holdedEmployeeId ?? (await obtenerHoldedEmployeeId(actor.id))
      : await obtenerHoldedEmployeeId(objetivoId);

  if (
    !puedeAccederEmpleadoHolded(
      actor,
      { id: objetivoId, holdedEmployeeId: holdedId },
      equipo,
    )
  ) {
    return { ok: false, motivo: "sin_acceso" };
  }
  if (!holdedId) return { ok: false, motivo: "sin_vinculo" };
  return { ok: true, employeeId: holdedId, actorId: actor.id };
}

export async function ficharEntradaAction(formData: FormData) {
  const usuarioId = String(formData.get("usuario_id") ?? "") || null;
  const r = await employeeIdAutorizado("mi_zona.fichar", usuarioId);
  if (!r.ok) redirect(`/mi-zona/horario?aviso=holded_${r.motivo}`);
  try {
    await ficharEntrada(r.employeeId);
  } catch (e) {
    const motivo = e instanceof HoldedError ? `holded_http_${e.status}` : "holded_error";
    redirect(`/mi-zona/horario?aviso=${motivo}`);
  }
  revalidateMiZona();
  redirect("/mi-zona/horario?aviso=fichaje_entrada");
}

export async function ficharSalidaAction(formData: FormData) {
  const usuarioId = String(formData.get("usuario_id") ?? "") || null;
  const r = await employeeIdAutorizado("mi_zona.fichar", usuarioId);
  if (!r.ok) redirect(`/mi-zona/horario?aviso=holded_${r.motivo}`);
  try {
    await ficharSalida(r.employeeId);
  } catch (e) {
    const motivo = e instanceof HoldedError ? `holded_http_${e.status}` : "holded_error";
    redirect(`/mi-zona/horario?aviso=${motivo}`);
  }
  revalidateMiZona();
  redirect("/mi-zona/horario?aviso=fichaje_salida");
}

export async function iniciarPausaAction(formData: FormData) {
  const usuarioId = String(formData.get("usuario_id") ?? "") || null;
  const r = await employeeIdAutorizado("mi_zona.fichar", usuarioId);
  if (!r.ok) redirect(`/mi-zona/horario?aviso=holded_${r.motivo}`);
  try {
    await iniciarPausa(r.employeeId);
  } catch (e) {
    const motivo = e instanceof HoldedError ? `holded_http_${e.status}` : "holded_error";
    redirect(`/mi-zona/horario?aviso=${motivo}`);
  }
  revalidateMiZona();
  redirect("/mi-zona/horario?aviso=fichaje_pausa");
}

export async function finalizarPausaAction(formData: FormData) {
  const usuarioId = String(formData.get("usuario_id") ?? "") || null;
  const r = await employeeIdAutorizado("mi_zona.fichar", usuarioId);
  if (!r.ok) redirect(`/mi-zona/horario?aviso=holded_${r.motivo}`);
  try {
    await finalizarPausa(r.employeeId);
  } catch (e) {
    const motivo = e instanceof HoldedError ? `holded_http_${e.status}` : "holded_error";
    redirect(`/mi-zona/horario?aviso=${motivo}`);
  }
  revalidateMiZona();
  redirect("/mi-zona/horario?aviso=fichaje_despausa");
}

export async function solicitarAusenciaAction(formData: FormData) {
  const r = await employeeIdAutorizado("mi_zona.ausencias");
  if (!r.ok) redirect(`/mi-zona/ausencias?aviso=holded_${r.motivo}`);

  const start = String(formData.get("start") ?? "").trim();
  const end = String(formData.get("end") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!start || !end) redirect("/mi-zona/ausencias?aviso=falta_dato");

  try {
    await solicitarAusencia(r.employeeId, {
      start,
      end,
      ...(note ? { note } : {}),
    });
  } catch (e) {
    const motivo = e instanceof HoldedError ? `holded_http_${e.status}` : "holded_error";
    redirect(`/mi-zona/ausencias?aviso=${motivo}`);
  }
  revalidateMiZona();
  redirect("/mi-zona/ausencias?aviso=ausencia_solicitada");
}

export async function aprobarAusenciaAction(formData: FormData) {
  await exigirPermiso("mi_zona.aprobar_ausencias");
  if (!HOLDED_TIME_OFF_APPROVE_SUPPORTED) {
    redirect("/mi-zona/ausencias?aviso=holded_approve_no_soportado");
  }
  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const timeOffId = String(formData.get("time_off_id") ?? "").trim();
  if (!employeeId || !timeOffId) redirect("/mi-zona/ausencias?aviso=falta_dato");
  try {
    await aprobarAusencia(employeeId, timeOffId);
  } catch (e) {
    const motivo = e instanceof HoldedError ? `holded_http_${e.status}` : "holded_error";
    redirect(`/mi-zona/ausencias?aviso=${motivo}`);
  }
  revalidateMiZona();
  redirect("/mi-zona/ausencias?aviso=ausencia_aprobada");
}

export async function guardarHoldedEmployeeIdAction(formData: FormData) {
  await exigirAdmin();
  const usuarioId = String(formData.get("usuario_id") ?? "").trim();
  const holdedId = String(formData.get("holded_employee_id") ?? "").trim() || null;
  if (!usuarioId) redirect("/admin/usuarios?aviso=falta_dato");
  const r = await guardarHoldedEmployeeId(usuarioId, holdedId);
  if (!r.ok) redirect("/admin/usuarios?aviso=no_encontrado");
  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?aviso=holded_vinculo_guardado");
}

export async function guardarEquipoJefeAction(formData: FormData) {
  await exigirAdmin();
  const jefeId = String(formData.get("jefe_usuario_id") ?? "").trim();
  const ids = formData.getAll("trabajador_id").map((v) => String(v));
  if (!jefeId) redirect("/admin/usuarios?aviso=falta_dato");
  const r = await reemplazarEquipoJefe(jefeId, ids);
  if (!r.ok) redirect("/admin/usuarios?aviso=no_encontrado");
  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?aviso=holded_equipo_guardado");
}

function destinoMiZona(formData: FormData | undefined, aviso: string): string {
  const raw = formData?.get("next");
  const base =
    typeof raw === "string" && raw.startsWith("/mi-zona") && !raw.startsWith("//")
      ? raw.split("?")[0] || "/mi-zona"
      : "/mi-zona";
  return `${base}?aviso=${aviso}`;
}

/** Admin real: simula vista trabajador / jefe / vuelve a admin (solo Mi Zona). */
export async function setVistaMiZonaAction(formData: FormData) {
  await exigirAdminReal();
  const raw = String(formData.get("vista") ?? "").trim();
  const vista: VistaMiZona | null = esVistaMiZona(raw) ? raw : null;
  await escribirCookieVistaMiZona(vista);
  revalidatePath("/", "layout");
  revalidateMiZona();
  const aviso =
    vista === "trabajador"
      ? "vista_mi_zona_trabajador"
      : vista === "jefe"
        ? "vista_mi_zona_jefe"
        : "vista_mi_zona_off";
  redirect(destinoMiZona(formData, aviso));
}
