"use client";

import { inicialesDe } from "@/lib/tareas-mock";

const TAMANOS = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[9px]",
  md: "size-8 text-[11px]",
  lg: "size-14 text-[16px]",
} as const;

export function AvatarUsuario({
  nombre,
  avatarUrl,
  tamano = "md",
  className = "",
  title,
}: {
  nombre: string;
  avatarUrl?: string | null;
  tamano?: keyof typeof TAMANOS;
  className?: string;
  title?: string;
}) {
  const base = `${TAMANOS[tamano]} shrink-0 rounded-full grid place-items-center font-mono tracking-tight overflow-hidden ${className}`;

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        title={title ?? nombre}
        draggable={false}
        className={`${base} object-cover bg-suave`}
      />
    );
  }

  return (
    <span
      className={`${base} bg-magenta text-white`}
      title={title ?? nombre}
      aria-hidden="true"
    >
      {inicialesDe(nombre)}
    </span>
  );
}
