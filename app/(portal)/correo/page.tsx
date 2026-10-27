import { exigirPermiso } from "@/lib/authz";
import { listarClientes } from "@/lib/clientes";
import { listarCorreos, tokensCorreoOError } from "@/lib/google-gmail";
import { listarEquipo, usuarioPuede } from "@/lib/usuarios";
import { PanelCorreo, type DestinatarioSugerido } from "./panel-correo";

export const dynamic = "force-dynamic";

export default async function CorreoPage() {
  const yo = await exigirPermiso("correo.ver");
  const puedeEnviar = usuarioPuede(yo, "correo.editar");
  const tok = await tokensCorreoOError(yo.correo);

  let itemsIniciales: Awaited<ReturnType<typeof listarCorreos>>["items"] = [];
  let nextPageToken: string | null = null;
  let errorInicial: "sin_token" | "gmail_error" | null = null;

  if (!tok.ok) {
    errorInicial = "sin_token";
  } else {
    try {
      const r = await listarCorreos(tok.tokens, { maxResults: 25 });
      itemsIniciales = r.items;
      nextPageToken = r.nextPageToken;
    } catch (err) {
      console.error("[correo] carga inicial falló", { correo: yo.correo, error: err });
      errorInicial = "gmail_error";
    }
  }

  const destinatarios: DestinatarioSugerido[] = [];
  const vistos = new Set<string>();
  const yoEmail = yo.correo.trim().toLowerCase();

  if (puedeEnviar) {
    const equipo = await listarEquipo();
    for (const m of equipo) {
      const email = m.email.trim().toLowerCase();
      if (!email || email === yoEmail || vistos.has(email)) continue;
      vistos.add(email);
      destinatarios.push({ nombre: m.nombre, email, origen: "equipo" });
    }
    if (usuarioPuede(yo, "clientes.ver")) {
      const clientes = await listarClientes();
      for (const c of clientes) {
        const email = c.correoAcceso.trim().toLowerCase();
        if (!email || vistos.has(email)) continue;
        vistos.add(email);
        destinatarios.push({ nombre: c.nombre, email, origen: "cliente" });
      }
    }
    destinatarios.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }

  return (
    <PanelCorreo
      itemsIniciales={itemsIniciales}
      nextPageTokenInicial={nextPageToken}
      errorInicial={errorInicial}
      puedeEnviar={puedeEnviar}
      correoUsuario={yo.correo}
      destinatariosSugeridos={destinatarios}
    />
  );
}
