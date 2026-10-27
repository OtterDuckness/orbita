import Link from "next/link";
import { exigirPermiso } from "@/lib/authz";
import { holdedConfigurado, HOLDED_TIME_OFF_APPROVE_SUPPORTED } from "@/lib/holded";
import { usuarioPuede } from "@/lib/usuarios";

export const dynamic = "force-dynamic";

export default async function PaginaMiZona() {
  const usuario = await exigirPermiso("mi_zona.ver");
  const configurado = holdedConfigurado();
  const vinculado = Boolean(usuario.holdedEmployeeId);

  const cards = [
    {
      href: "/mi-zona/horario",
      titulo: "Control horario",
      texto: "Fichar entrada, salida y pausas.",
      ok: usuarioPuede(usuario, "mi_zona.fichar"),
    },
    {
      href: "/mi-zona/ausencias",
      titulo: "Ausencias y vacaciones",
      texto: HOLDED_TIME_OFF_APPROVE_SUPPORTED
        ? "Solicitar y gestionar ausencias."
        : "Solicitar y listar. La aprobación vía API Holded aún no está disponible.",
      ok: usuarioPuede(usuario, "mi_zona.ausencias"),
    },
    {
      href: "/mi-zona/nominas",
      titulo: "Nóminas",
      texto: "Consultar y descargar PDF de nóminas.",
      ok: usuarioPuede(usuario, "mi_zona.nominas"),
    },
  ] as const;

  return (
    <div className="grid gap-4 max-w-[720px]">
      {!configurado ? (
        <p className="rounded-[10px] border border-mal-borde bg-mal-suave text-mal px-4 py-3 text-[13px]">
          Falta <code className="font-mono">HOLDED_API_KEY</code> en el entorno del servidor.
        </p>
      ) : null}
      {configurado && !vinculado ? (
        <p className="rounded-[10px] border border-linea-fuerte bg-suave/40 px-4 py-3 text-[13px] text-apagado">
          Tu usuario aún no tiene ID de empleado Holded. Un admin RRHH debe vincularlo en{" "}
          <Link href="/admin/usuarios" className="text-magenta-texto hover:underline">
            Admin → Usuarios
          </Link>
          .
        </p>
      ) : null}
      {vinculado ? (
        <p className="text-[13px] text-apagado">
          Empleado Holded: <span className="font-mono text-tinta">{usuario.holdedEmployeeId}</span>
        </p>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-1">
        {cards
          .filter((c) => c.ok)
          .map((c) => (
            <li key={c.href}>
              <Link
                href={c.href}
                className="block rounded-[10px] border border-linea-fuerte px-4 py-3 hover:border-magenta-borde hover:shadow-suave transition"
              >
                <p className="font-medium text-[15px]">{c.titulo}</p>
                <p className="text-apagado text-[13px] mt-1">{c.texto}</p>
              </Link>
            </li>
          ))}
      </ul>
    </div>
  );
}
