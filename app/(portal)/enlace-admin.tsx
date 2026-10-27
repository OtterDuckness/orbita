"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function EnlaceAdmin({ compacto = false }: { compacto?: boolean }) {
  const ruta = usePathname();
  const activa = ruta.startsWith("/admin");

  if (compacto) {
    return (
      <Link
        href="/admin"
        prefetch={false}
        aria-current={activa ? "page" : undefined}
        className={`shrink-0 border rounded-lg px-2.5 py-1.5 text-[11px] transition ${
          activa
            ? "border-magenta-borde text-magenta-texto"
            : "border-linea text-apagado hover:border-magenta-borde hover:text-magenta-texto"
        }`}
      >
        Admin
      </Link>
    );
  }

  return (
    <Link
      href="/admin"
      prefetch={false}
      aria-current={activa ? "page" : undefined}
      className={`block px-3.5 py-2 rounded-[10px] text-[13.5px] border transition ${
        activa
          ? "bg-magenta-suave border-magenta-borde text-magenta-texto font-semibold"
          : "border-transparent text-apagado hover:bg-suave hover:text-tinta hover:border-linea"
      }`}
    >
      Admin
    </Link>
  );
}
