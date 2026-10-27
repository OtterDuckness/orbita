import { signOut } from "@/auth";

export function Salir() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button
        type="submit"
        className="shrink-0 border border-linea rounded-lg px-2.5 py-1.5 text-[11px] text-apagado
                   hover:border-magenta-borde hover:text-magenta-texto transition"
      >
        Salir
      </button>
    </form>
  );
}
