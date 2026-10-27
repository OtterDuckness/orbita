"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActividad } from "@/lib/admin-logs";
import { mesUtcClave, guardarTopeMensual } from "@/lib/asistente/tope";
import { exigirAdmin } from "@/lib/authz";

export async function guardarTopeMensualUsuarioAction(formData: FormData) {
  const actor = await exigirAdmin();
  const usuarioId = String(formData.get("usuario_id") ?? "").trim();
  if (!usuarioId) {
    redirect("/admin/agente-ia?aviso=falta_dato");
  }

  const raw = String(formData.get("tope_usd") ?? "").trim().replace(",", ".");
  let topeUsd: number | null;
  if (!raw) {
    topeUsd = null;
  } else {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      redirect("/admin/agente-ia?aviso=tope_invalido");
    }
    topeUsd = n;
  }

  const mes = mesUtcClave();
  await guardarTopeMensual({
    usuarioId,
    topeUsd,
    actorId: actor.id,
    mesUtc: mes,
  });

  await logActividad(
    actor,
    "ia_tope_mensual",
    topeUsd == null
      ? `Tope IA ${mes}: restaurado al global para usuario ${usuarioId.slice(0, 8)}`
      : topeUsd === 0
        ? `Tope IA ${mes}: sin límite para usuario ${usuarioId.slice(0, 8)}`
        : `Tope IA ${mes}: $${topeUsd.toFixed(2)} para usuario ${usuarioId.slice(0, 8)}`,
    { usuarioId, mesUtc: mes, topeUsd },
  );

  revalidatePath("/admin/agente-ia");
  revalidatePath("/ajustes");
  redirect("/admin/agente-ia?aviso=tope_guardado");
}
