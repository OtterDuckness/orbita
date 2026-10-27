import { exigirPermiso } from "@/lib/authz";
import {
  HOLDED_TIME_OFF_APPROVE_SUPPORTED,
  HoldedError,
  holdedConfigurado,
  listarAusenciasEmpleado,
  listarAusenciasTodas,
} from "@/lib/holded";
import { idsEquipoAccesibles, listarInternosConHolded } from "@/lib/holded-equipo";
import { usuarioPuede } from "@/lib/usuarios";
import { Boton } from "../../boton";
import { aprobarAusenciaAction, solicitarAusenciaAction } from "../acciones";

export const dynamic = "force-dynamic";

function fmt(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") {
    const d = new Date(v > 1e12 ? v : v * 1000);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("es-ES");
  }
  const s = String(v);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("es-ES");
}

export default async function PaginaAusencias({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>;
}) {
  const sp = await searchParams;
  const usuario = await exigirPermiso("mi_zona.ausencias");
  const configurado = holdedConfigurado();
  const employeeId = usuario.holdedEmployeeId;
  const puedeAprobarPermiso = usuarioPuede(usuario, "mi_zona.aprobar_ausencias");
  const puedeEquipo = usuarioPuede(usuario, "mi_zona.equipo") || usuarioPuede(usuario, "mi_zona.admin");

  let propias: Awaited<ReturnType<typeof listarAusenciasEmpleado>> = [];
  let equipo: Awaited<ReturnType<typeof listarAusenciasTodas>> = [];
  let error: string | null = null;

  if (configurado && employeeId) {
    try {
      propias = await listarAusenciasEmpleado(employeeId);
    } catch (e) {
      error = e instanceof HoldedError ? `Holded ${e.status}` : "Error al listar";
    }
  }

  if (configurado && puedeEquipo) {
    try {
      const todas = await listarAusenciasTodas();
      if (usuarioPuede(usuario, "mi_zona.admin")) {
        equipo = todas;
      } else {
        const ids = await idsEquipoAccesibles(usuario);
        const mapa = new Map(
          (await listarInternosConHolded())
            .filter((u) => ids.has(u.id) && u.holdedEmployeeId)
            .map((u) => [u.holdedEmployeeId!, u.id]),
        );
        equipo = todas.filter((a) => {
          const eid = String(a.employeeId ?? "");
          return eid && mapa.has(eid) && eid !== employeeId;
        });
      }
    } catch {
      /* listado global puede no estar disponible según scopes */
    }
  }

  void sp;

  return (
    <div className="grid gap-6 max-w-[720px]">
      {!HOLDED_TIME_OFF_APPROVE_SUPPORTED ? (
        <p className="rounded-[10px] border border-linea-fuerte bg-suave/40 px-4 py-3 text-[13px] text-apagado">
          Holded no documenta endpoint de aprobación de ausencias. Puedes solicitar y listar desde
          Órbita; la aprobación debe hacerse en Holded hasta que la API lo permita.
        </p>
      ) : null}

      {configurado && employeeId ? (
        <form action={solicitarAusenciaAction} className="grid gap-3 rounded-[10px] border border-linea-fuerte p-4">
          <h2 className="font-display font-bold text-[16px]">Solicitar ausencia</h2>
          <label className="grid gap-1 text-[13px]">
            Desde
            <input type="date" name="start" required className="control rounded-[8px] px-2 py-1.5" />
          </label>
          <label className="grid gap-1 text-[13px]">
            Hasta
            <input type="date" name="end" required className="control rounded-[8px] px-2 py-1.5" />
          </label>
          <label className="grid gap-1 text-[13px]">
            Nota (opcional)
            <input type="text" name="note" className="control rounded-[8px] px-2 py-1.5" maxLength={200} />
          </label>
          <Boton className="!py-2 !px-4 !text-[13px] w-fit" textoEnviando="Enviando…">
            Solicitar
          </Boton>
        </form>
      ) : (
        <p className="text-[13px] text-apagado">
          {!configurado ? "HOLDED_API_KEY no configurada." : "Sin vínculo Holded."}
        </p>
      )}

      <section className="grid gap-2">
        <h2 className="font-display font-bold text-[16px]">Mis solicitudes</h2>
        {error ? <p className="text-[13px] text-mal">{error}</p> : null}
        {propias.length === 0 ? (
          <p className="text-[13px] text-apagado">Ninguna.</p>
        ) : (
          <ul className="grid gap-1.5">
            {propias.map((a) => (
              <li key={String(a.id)} className="text-[13px] border-b border-linea py-1.5">
                {fmt(a.start)} → {fmt(a.end)}
                {a.status ? (
                  <span className="ml-2 etiqueta text-apagado">{String(a.status)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {puedeEquipo && equipo.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="font-display font-bold text-[16px]">Equipo</h2>
          <ul className="grid gap-1.5">
            {equipo.map((a) => (
              <li
                key={String(a.id)}
                className="text-[13px] border-b border-linea py-1.5 flex flex-wrap items-center gap-2"
              >
                <span>
                  {fmt(a.start)} → {fmt(a.end)}
                  {a.status ? (
                    <span className="ml-2 etiqueta text-apagado">{String(a.status)}</span>
                  ) : null}
                </span>
                {puedeAprobarPermiso && HOLDED_TIME_OFF_APPROVE_SUPPORTED ? (
                  <form action={aprobarAusenciaAction} className="ml-auto">
                    <input type="hidden" name="employee_id" value={String(a.employeeId ?? "")} />
                    <input type="hidden" name="time_off_id" value={String(a.id)} />
                    <Boton className="!py-1 !px-2 !text-[12px]" textoEnviando="…">
                      Aprobar
                    </Boton>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
