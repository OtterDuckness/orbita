import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user?.email) {
    redirect("/");
  }

  const { error } = await searchParams;
  const mensajes: Record<string, string> = {
    AccessDenied:
      "Ese correo no tiene acceso a Órbita. Si debería tenerlo, pide a dirección que lo autorice.",
    Configuration: "Falta configuración OAuth en este entorno. Revisa las variables de entorno.",
    Default: "Algo ha ido mal. Inténtalo otra vez.",
  };

  return (
    <main className="min-h-screen grid place-items-center bg-[#0A0005] px-6">
      <div className="w-full max-w-[460px]">
        <div className="mb-8">
          <h1 className="font-display font-extrabold text-white text-5xl tracking-tight">Órbita</h1>
          <p className="text-white/60 mt-2">Portal de clientes, proyectos y tareas</p>
        </div>

        <div className="bg-papel rounded-xl border border-linea-fuerte shadow-suave p-6">
          <h2 className="font-display font-bold text-xl mb-1">Entrar</h2>
          <p className="text-sm text-apagado mb-5">
            Continúa con tu cuenta de Google. Solo correos autorizados pueden acceder.
          </p>
          {error ? (
            <p className="mb-4 text-[13px] rounded-lg border border-linea-fuerte bg-suave text-tinta px-3 py-2">
              {mensajes[error] ?? mensajes.Default}
            </p>
          ) : null}
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="boton w-full py-3 font-display font-bold text-[15px]"
            >
              Continuar con Google
            </button>
          </form>
        </div>

        <p className="text-white/40 text-xs mt-5 leading-relaxed">
          Acceso restringido a las cuentas autorizadas.
        </p>
      </div>
    </main>
  );
}
