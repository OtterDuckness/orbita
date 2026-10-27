import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { puedeVerApartado } from "@/lib/apartados";
import { HoldedError, descargarPdfNomina, holdedConfigurado, obtenerNomina } from "@/lib/holded";
import { idsEquipoAccesibles, listarInternosConHolded } from "@/lib/holded-equipo";
import { obtenerUsuarioAuthPorCorreo, usuarioPuede } from "@/lib/usuarios";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const usuario = await obtenerUsuarioAuthPorCorreo(session.user.email);
  if (!usuario || !usuarioPuede(usuario, "mi_zona.nominas")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!(await puedeVerApartado("mi_zona", usuario.esAdmin))) {
    return NextResponse.json({ error: "apartado_off" }, { status: 403 });
  }
  if (!holdedConfigurado()) {
    return NextResponse.json({ error: "holded_not_configured" }, { status: 503 });
  }

  const { id } = await ctx.params;
  const payslipId = id?.trim();
  if (!payslipId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  try {
    if (!usuarioPuede(usuario, "mi_zona.admin") && !usuario.esAdmin) {
      const nomina = await obtenerNomina(payslipId);
      const eid = String(nomina.employeeId ?? "");
      if (eid) {
        const ids = await idsEquipoAccesibles(usuario);
        const permitidos = new Set(
          (await listarInternosConHolded())
            .filter((u) => ids.has(u.id) && u.holdedEmployeeId)
            .map((u) => u.holdedEmployeeId!),
        );
        if (usuario.holdedEmployeeId) permitidos.add(usuario.holdedEmployeeId);
        if (!permitidos.has(eid)) {
          return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }
      } else if (!usuario.holdedEmployeeId) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    }

    const res = await descargarPdfNomina(payslipId);
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "application/pdf",
        "Content-Disposition": `inline; filename="nomina-${payslipId}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof HoldedError) {
      return NextResponse.json({ error: "holded", status: e.status }, { status: e.status || 502 });
    }
    return NextResponse.json({ error: "proxy_failed" }, { status: 502 });
  }
}
