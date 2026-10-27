"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PESTANAS = [
  { href: "/ajustes", label: "Preferencias", exact: true },
  { href: "/ajustes/deshacer", label: "Deshacer", exact: false },
] as const;

export function AjustesTabs() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-wrap gap-1 border-b border-linea mb-6"
      aria-label="Ajustes"
    >
      {PESTANAS.map((p) => {
        const activa = p.exact
          ? pathname === p.href
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
