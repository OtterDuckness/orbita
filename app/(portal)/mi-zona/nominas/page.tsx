import { exigirPermiso } from "@/lib/authz";
import { HoldedError, holdedConfigurado, listarNominas } from "@/lib/holded";
import { idsEquipoAccesibles, listarInternosConHolded } from "@/lib/holded-equipo";
import { usuarioPuede } from "@/lib/usuarios";

export const dynamic = "force-dynamic";

export default async function PaginaNominas() {
  const usuario = await exigirPermiso("mi_zona.nominas");
  const configurado = holdedConfigurado();
  const employeeId = usuario.holdedEmployeeId;
  const esAdminHr = usuarioPuede(usuario, "mi_zona.admin");
  const puedeEquipo = usuarioPuede(usuario, "mi_zona.equipo") || esAdminHr;

  let nominas: Awaited<ReturnType<typeof listarNominas>> = [];
  let error: string | null = null;

  if (configurado) {
    try {
      const todas = await listarNominas();
      if (esAdminHr) {
        nominas = todas;
      } else if (puedeEquipo) {
        const ids = await idsEquipoAccesibles(usuario);
        const holdedIds = new Set(
          (await listarInternosConHolded())
            .filter((u) => ids.has(u.id) && u.holdedEmployeeId)
            .map((u) => u.holdedEmployeeId!),
        );
        if (employeeId) holdedIds.add(employeeId);
        nominas = todas.filter((n) => {
          const eid = String(n.employeeId ?? "");
          return !eid || holdedIds.has(eid);
        });
      } else if (employeeId) {
        nominas = todas.filter((n) => String(n.employeeId ?? "") === employeeId || !n.employeeId);
      }
    } catch (e) {
      error = e instanceof HoldedError ? `Holded ${e.status}` : "No se pudieron cargar las nóminas";
    }
  }

  return (
    <div className="grid gap-4 max-w-[720px]">
      {!configurado ? (
        <p className="text-[13px] text-mal">HOLDED_API_KEY no configurada.</p>
      ) : !employeeId && !esAdminHr ? (
        <p className="text-[13px] text-apagado">Sin vínculo Holded no se pueden filtrar tus nóminas.</p>
      ) : null}

      {error ? <p className="text-[13px] text-mal">{error}</p> : null}

      {nominas.length === 0 && !error && configurado ? (
        <p className="text-[13px] text-apagado">No hay nóminas visibles.</p>
      ) : (
        <ul className="grid gap-2">
          {nominas.map((n) => (
            <li
              key={String(n.id)}
              className="rounded-[8px] border border-linea px-3 py-2 text-[13px] flex flex-wrap items-center gap-3"
            >
              <span className="font-mono text-[11px] text-apagado">{String(n.id)}</span>
              {n.employeeId ? (
                <span className="text-apagado">empleado {String(n.employeeId)}</span>
              ) : null}
              <a
                href={`/api/holded/nominas/${encodeURIComponent(String(n.id))}/pdf`}
                className="ml-auto text-magenta-texto hover:underline text-[13px]"
                target="_blank"
                rel="noreferrer"
              >
                PDF
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
