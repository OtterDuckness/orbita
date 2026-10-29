import { exigirAdmin } from "@/lib/authz";
import { listarPerfiles, listarUsuariosInternos } from "@/lib/perfiles";
import { Cabecera } from "../../cabecera";
import { ListaUsuarios } from "./lista-usuarios";
import { NuevoUsuarioLightbox } from "./nuevo-usuario-lightbox";

export const dynamic = "force-dynamic";

export default async function AdminUsuariosPage() {
  const actor = await exigirAdmin();
  const [perfiles, usuarios] = await Promise.all([listarPerfiles(), listarUsuariosInternos()]);

  return (
    <>
      <Cabecera
        etiqueta="Admin"
        titulo="Usuarios"
        texto="Alta y baja del equipo interno y permisos por persona. Solo administradores."
        sello={`${usuarios.length} ${usuarios.length === 1 ? "usuario" : "usuarios"}`}
        acciones={<NuevoUsuarioLightbox perfiles={perfiles} />}
      />

      <ListaUsuarios
        usuarios={usuarios}
        perfiles={perfiles}
        actorId={actor.id}
      />
    </>
  );
}
