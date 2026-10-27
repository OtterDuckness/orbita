"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ProyectoTabs({
  proyectoId,
  mostrarAdminBoostiq = false,
}: {
  proyectoId: string;
  mostrarAdminBoostiq?: boolean;
}) {
  const pathname = usePathname();
  const base = `/proyectos/${proyectoId}`;
  const pestanas = [
    { href: base, label: "Tablero", exact: true },
    ...(mostrarAdminBoostiq
      ? [{ href: `${base}/admin` as string, label: "Admin", exact: false }]
      : []),
    { href: `${base}/info`, label: "Info", exact: false },
  ] as const;

  return (
    <nav className="flex flex-wrap gap-1 border-b border-linea mb-6" aria-label="Secciones del proyecto">
      {pestanas.map((p) => {
        const activa = p.exact
          ? pathname === p.href || pathname === `${p.href}/`
          : pathname === p.href || pathname.startsWith(`${p.href}/`);
        return (
          <Link
            key={p.href}
            href={p.href}
            prefetch={false}
            aria-current={activa ? "page" : undefined}
            className={`px-3.5 py-2 text-[13.5px] border-b-2 -mb-px transition ${
              activa
                ? "border-magenta text-magenta-texto font-semibold"
                : "border-transparent text-apagado hover:text-tinta hover:border-linea"
            }`}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
