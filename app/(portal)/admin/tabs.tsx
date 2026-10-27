"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PESTANAS = [
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/permisos", label: "Permisos" },
  { href: "/admin/sugerencias", label: "Sugerencias" },
  { href: "/admin/logs", label: "Logs" },
  { href: "/admin/agente-ia", label: "Agente IA" },
  { href: "/admin/apartados", label: "Apartados" },
  { href: "/admin/ajustes", label: "Ajustes" },
] as const;

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 border-b border-linea mb-6" aria-label="Panel admin">
      {PESTANAS.map((p) => {
        const activa =
          p.href === "/admin/permisos"
            ? pathname.startsWith("/admin/permisos")
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
