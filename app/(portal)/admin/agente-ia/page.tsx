import Link from "next/link";
import { exigirAdmin } from "@/lib/authz";
import { topeMensualUsd } from "@/lib/asistente/coste";
import {
  gastosPorUsuario,
  listarEstadisticasChatsAdmin,
  type GastosPorUsuario,
} from "@/lib/asistente/store";
import {
  mapaTopesOverrideMes,
  mesUtcClave,
} from "@/lib/asistente/tope";
import { fechaHora } from "@/lib/formato";
import { listarUsuariosInternos } from "@/lib/perfiles";
import { Cabecera } from "../../cabecera";
import { FormTopeUsuario } from "./form-tope-usuario";

export const dynamic = "force-dynamic";

function fmtUsd(n: number) {
  return `$${n.toFixed(4)}`;
}

function fmtTok(n: number) {
  return n.toLocaleString("es-ES");
}

function topeEfectivoDe(
  override: number | undefined,
  topeGlobal: number | null,
): number | null {
  if (override !== undefined) return override <= 0 ? null : override;
  return topeGlobal;
}

export default async function AdminAgenteIaPage() {
  await exigirAdmin();
  const [usuarios, gastos, chats, overrides] = await Promise.all([
    listarUsuariosInternos(),
    gastosPorUsuario(),
    listarEstadisticasChatsAdmin(),
    mapaTopesOverrideMes(),
  ]);
  const nombres = new Map(usuarios.map((u) => [u.id, u]));
  const topeGlobal = topeMensualUsd();
  const mesUtc = mesUtcClave();

  const totalMes = gastos.reduce(
    (acc, g) => ({
      input: acc.input + g.mes.input,
      output: acc.output + g.mes.output,
      coste: acc.coste + g.mes.coste,
    }),
    { input: 0, output: 0, coste: 0 },
  );
  const totalAll = gastos.reduce(
    (acc, g) => ({
      input: acc.input + g.total.input,
      output: acc.output + g.total.output,
      coste: acc.coste + g.total.coste,
    }),
    { input: 0, output: 0, coste: 0 },
  );

  const filas: { nombre: string; correo: string; ultimoAcceso: string | null; g: GastosPorUsuario }[] =
    [];
  for (const g of gastos) {
    const u = nombres.get(g.usuarioId);
    filas.push({
      nombre: u?.nombre ?? g.usuarioId.slice(0, 8),
      correo: u?.correo ?? "—",
      ultimoAcceso: u?.ultimoAccesoEn ?? null,
      g,
    });
  }
  filas.sort((a, b) => b.g.mes.coste - a.g.mes.coste);

  const totalLlamadas = chats.reduce((s, c) => s + c.llamadas, 0);

  return (
    <>
      <Cabecera
        etiqueta="Admin"
        titulo="Agente IA"
        texto="Consumo Haiku 4.5, uso por usuario y estadísticas por chat. Solo administradores."
      />

      <p className="mb-6 text-[13.5px]">
        <Link
          href="/admin/agente-ia/chats"
          className="text-magenta-texto hover:underline font-medium"
        >
          Ver todos los chats →
        </Link>
      </p>

      <section className="grid sm:grid-cols-3 gap-3 mb-10">
        <div className="rounded-[10px] border border-linea p-4">
          <p className="etiqueta text-apagado mb-1">Mes actual (UTC)</p>
          <p className="font-display font-bold text-[22px]">{fmtUsd(totalMes.coste)}</p>
          <p className="text-[12px] text-apagado mt-1">
            {fmtTok(totalMes.input)} in · {fmtTok(totalMes.output)} out
          </p>
        </div>
        <div className="rounded-[10px] border border-linea p-4">
          <p className="etiqueta text-apagado mb-1">Total</p>
          <p className="font-display font-bold text-[22px]">{fmtUsd(totalAll.coste)}</p>
          <p className="text-[12px] text-apagado mt-1">
            {fmtTok(totalAll.input)} in · {fmtTok(totalAll.output)} out
          </p>
        </div>
        <div className="rounded-[10px] border border-linea p-4">
          <p className="etiqueta text-apagado mb-1">Chats / llamadas API</p>
          <p className="font-display font-bold text-[22px]">{chats.length}</p>
          <p className="text-[12px] text-apagado mt-1">{fmtTok(totalLlamadas)} turnos</p>
        </div>
      </section>

      <section className="grid gap-3 mb-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display font-bold text-[18px] tracking-tight">Uso por usuario</h2>
          <p className="text-[12px] text-apagado">
            Tope global mes UTC {mesUtc}:{" "}
            {topeGlobal == null ? "desactivado" : fmtUsd(topeGlobal)}. Vacío = global · 0 = sin
            tope.
          </p>
        </div>
        <ul className="grid gap-2">
          {filas.length === 0 ? (
            <li className="text-apagado text-[13px]">Aún no hay uso registrado.</li>
          ) : (
            filas.map(({ nombre, correo, ultimoAcceso, g }) => {
              const override = overrides.has(g.usuarioId)
                ? overrides.get(g.usuarioId)!
                : null;
              const efectivo = topeEfectivoDe(
                overrides.has(g.usuarioId) ? overrides.get(g.usuarioId) : undefined,
                topeGlobal,
              );
              return (
                <li
                  key={g.usuarioId}
                  className="rounded-[10px] border border-linea px-4 py-3 flex flex-wrap gap-3 justify-between"
                >
                  <div>
                    <p className="font-medium text-[14px]">{nombre}</p>
                    <p className="text-[12px] text-apagado font-mono">{correo}</p>
                    <p className="text-[12px] text-apagado mt-0.5">
                      Último acceso: {ultimoAcceso ? fechaHora(ultimoAcceso) : "—"}
                    </p>
                  </div>
                  <div className="text-right text-[13px] grid gap-0.5 min-w-[16rem]">
                    <p>
                      Mes: <b>{fmtUsd(g.mes.coste)}</b>{" "}
                      <span className="text-apagado">
                        ({fmtTok(g.mes.input)} in / {fmtTok(g.mes.output)} out)
                      </span>
                    </p>
                    <p className="text-apagado">
                      Total: {fmtUsd(g.total.coste)} ({fmtTok(g.total.input)} in /{" "}
                      {fmtTok(g.total.output)} out)
                    </p>
                    <FormTopeUsuario
                      usuarioId={g.usuarioId}
                      override={override}
                      topeGlobal={topeGlobal}
                      topeEfectivo={efectivo}
                    />
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section className="grid gap-3 mb-4">
        <h2 className="font-display font-bold text-[18px] tracking-tight">Uso por chat</h2>
        <p className="text-apagado text-[13px] -mt-1">
          Llamadas API, tokens de entrada/salida y coste estimado por conversación.
        </p>

        <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_repeat(4,minmax(0,0.9fr))] gap-2 px-3 text-[11px] uppercase tracking-wide text-apagado">
          <span>Chat</span>
          <span>Usuario</span>
          <span className="text-right">Llamadas</span>
          <span className="text-right">Tokens</span>
          <span className="text-right">In / Out</span>
          <span className="text-right">Coste</span>
        </div>

        <ul className="grid gap-2">
          {chats.length === 0 ? (
            <li className="text-apagado text-[13px]">Todavía no hay conversaciones.</li>
          ) : (
            chats.map((c) => (
              <li
                key={c.id}
                className="rounded-[10px] border border-linea px-3 py-3 grid gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_repeat(4,minmax(0,0.9fr))] md:items-center md:gap-2"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[13.5px] truncate">
                    <Link
                      href={`/admin/agente-ia/chats/${c.id}`}
                      className="text-magenta-texto hover:underline"
                    >
                      {c.titulo}
                    </Link>
                  </p>
                  <p className="text-[11px] text-apagado">
                    {fechaHora(c.creadoEn)} → {fechaHora(c.actualizadoEn)} · {c.mensajes} msgs
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] truncate">{c.usuarioNombre}</p>
                  <p className="text-[11px] text-apagado font-mono truncate">{c.usuarioCorreo}</p>
                </div>
                <p className="text-[13px] md:text-right">
                  <span className="md:hidden text-apagado text-[11px]">Llamadas: </span>
                  {fmtTok(c.llamadas)}
                </p>
                <p className="text-[13px] md:text-right font-medium">
                  <span className="md:hidden text-apagado text-[11px]">Tokens: </span>
                  {fmtTok(c.inputTokens + c.outputTokens)}
                </p>
                <p className="text-[12px] text-apagado md:text-right">
                  <span className="md:hidden">In/Out: </span>
                  {fmtTok(c.inputTokens)} / {fmtTok(c.outputTokens)}
                </p>
                <p className="text-[13px] md:text-right font-semibold text-magenta-texto">
                  <span className="md:hidden text-apagado font-normal text-[11px]">Coste: </span>
                  {fmtUsd(c.costeUsd)}
                </p>
              </li>
            ))
          )}
        </ul>
      </section>
    </>
  );
}
