"use client";

import { useFormStatus } from "react-dom";

/** Botón de formulario: se apaga mientras la acción de servidor vuela. */
export function Boton({
  children,
  className,
  textoEnviando = "Guardando…",
  ...resto
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { textoEnviando?: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      {...resto}
      type="submit"
      disabled={pending || resto.disabled}
      aria-busy={pending}
      className={`${className ?? ""} ${pending ? "opacity-60 cursor-progress" : ""}`.trim()}
    >
      {pending ? textoEnviando : children}
    </button>
  );
}
