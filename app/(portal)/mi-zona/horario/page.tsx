import { exigirPermiso } from "@/lib/authz";
import { HoldedError, holdedConfigurado, listarTiemposEmpleado } from "@/lib/holded";
import { idsEquipoAccesibles, listarInternosConHolded } from "@/lib/holded-equipo";
import { usuarioPuede } from "@/lib/usuarios";
import { Boton } from "../../boton";
import {
  ficharEntradaAction,
  ficharSalidaAction,
  finalizarPausaAction,
  iniciarPausaAction,
} from "../acciones";

export const dynamic = "force-dynamic";

function fmt(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") {
    const d = new Date(v > 1e12 ? v : v * 1000);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("es-ES");
  }
  const s = String(v);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString("es-ES");
}

export default async function PaginaHorario({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>;
}) {
  const sp = await searchParams;
  const usuario = await exigirPermiso("mi_zona.fichar");
  const configurado = holdedConfigurado();
  const employeeId = usuario.holdedEmployeeId;

  let tiempos: Awaited<ReturnType<typeof listarTiemposEmpleado>> = [];
  let errorListado: string | null = null;
  if (configurado && employeeId) {
    try {
      tiempos = await listarTiemposEmpleado(employeeId);
    } catch (e) {
      errorListado =
        e instanceof HoldedError ? `Holded respondió ${e.status}` : "No se pudo cargar el histórico";
    }
  }

  const puedeEquipo = usuarioPuede(usuario, "mi_zona.equipo");
  let equipo: { id: string; nombre: string; holdedEmployeeId: string | null }[] = [];
  if (puedeEquipo) {
    const ids = await idsEquipoAccesibles(usuario);
    const todos = await listarInternosConHolded();
    equipo = todos.filter((t) => ids.has(t.id) && t.id !== usuario.id);
  }

  void sp;

  return (
    <div className="grid gap-6 max-w-[720px]">
      {!configurado ? (
        <p className="text-[13px] text-mal">HOLDED_API_KEY no configurada.</p>
      ) : !employeeId ? (
        <p className="text-[13px] text-apagado">
          Sin vínculo Holded: pide a Admin RRHH que asigne tu employee id.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <form action={ficharEntradaAction}>
            <Boton className="!py-2 !px-4 !text-[13px]" textoEnviando="…">
              Fichar entrada
            </Boton>
          </form>
          <form action={ficharSalidaAction}>
            <Boton
              className="!py-2 !px-4 !text-[13px] !bg-transparent !text-tinta border border-linea hover:!bg-suave"
              textoEnviando="…"
            >
              Fichar salida
            </Boton>
          </form>
          <form action={iniciarPausaAction}>
            <Boton
              className="!py-2 !px-4 !text-[13px] !bg-transparent !text-tinta border border-linea hover:!bg-suave"
              textoEnviando="…"
            >
              Iniciar pausa
            </Boton>
          </form>
          <form action={finalizarPausaAction}>
            <Boton
              className="!py-2 !px-4 !text-[13px] !bg-transparent !text-tinta border border-linea hover:!bg-suave"
              textoEnviando="…"
            >
              Finalizar pausa
            </Boton>
          </form>
        </div>
      )}

      {equipo.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="font-display font-bold text-[16px]">Equipo</h2>
          <ul className="grid gap-2">
            {equipo.map((m) => (
              <li
                key={m.id}
                className="rounded-[8px] border border-linea px-3 py-2 text-[13px] flex flex-wrap items-center gap-2"
              >
                <span className="font-medium">{m.nombre}</span>
                <span className="text-apagado font-mono text-[11px]">
                  {m.holdedEmployeeId ?? "sin Holded"}
                </span>
                {m.holdedEmployeeId ? (
                  <form action={ficharEntradaAction} className="ml-auto">
                    <input type="hidden" name="usuario_id" value={m.id} />
                    <Boton className="!py-1 !px-2 !text-[12px]" textoEnviando="…">
                      Entrada
                    </Boton>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-2">
        <h2 className="font-display font-bold text-[16px]">Registros recientes</h2>
        {errorListado ? <p className="text-[13px] text-mal">{errorListado}</p> : null}
        {tiempos.length === 0 && !errorListado ? (
          <p className="text-[13px] text-apagado">Sin registros o aún no hay datos.</p>
        ) : (
          <ul className="grid gap-1.5">
            {tiempos.slice(0, 30).map((t) => (
              <li
                key={String(t.id)}
                className="text-[13px] border-b border-linea py-1.5 flex flex-wrap gap-x-3 gap-y-0.5"
              >
                <span className="font-mono text-[11px] text-apagado">{String(t.id).slice(0, 10)}…</span>
                <span>Inicio: {fmt(t.start)}</span>
                <span>Fin: {fmt(t.end)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
