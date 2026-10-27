import { permanentRedirect } from "next/navigation";

export default function UsuariosLegacyRedirect() {
  permanentRedirect("/admin/usuarios");
}
