import Link from "next/link";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/authz";
import {
  listarPerfiles,
  listarUsuariosInternos,
  obtenerPerfil,
} from "@/lib/perfiles";
import { Cabecera } from "../../cabecera";
import { FormularioPermisos } from "./formulario-permisos";
import { PanelPerfiles } from "./panel-perfiles";
import { PanelUsuariosPermisos } from "./panel-usuarios-permisos";

export const dynamic = "force-dynamic";

export default async function AdminPermisosPage({
  searchParams,
}: {
  searchParams: Promise<{ perfil?: string; usuario?: string; nuevo?: string }>;
}) {
  await exigirAdmin();
  const { perfil: perfilId, usuario: usuarioId, nuevo } = await searchParams;

  if (perfilId && usuarioId) {
    redirect("/admin/permisos");
  }

  if (perfilId) {
    const perfil = await obtenerPerfil(perfilId);
    if (!perfil) redirect("/admin/permisos?aviso=no_encontrado");

    return (
      <>
        <VolverPermisos />
        <Cabecera
          etiqueta="Admin"
          titulo={`Editar perfil: ${perfil.nombre}`}
          texto="Plantilla reutilizable. Los cambios no reescriben solos los accesos ya afinados por persona."
        />
        <FormularioPermisos
          modo="editar-perfil"
          perfilId={perfil.id}
          nombre={perfil.nombre}
          descripcion={perfil.descripcion}
          permisos={perfil.permisos}
        />
      </>
    );
  }

  if (usuarioId) {
    const usuarios = await listarUsuariosInternos();
    const usuario = usuarios.find((u) => u.id === usuarioId);
    if (!usuario) redirect("/admin/usuarios?aviso=no_encontrado");
    const perfiles = await listarPerfiles();

    return (
      <>
        <VolverPermisos />
        <Cabecera
          etiqueta="Admin"
          titulo={`Permisos: ${usuario.nombre}`}
          texto={`${usuario.correo}. Ajusta Ver / Alterar por cada parte del ERP.`}
        />
        <FormularioPermisos
          key={usuario.permisos.join("|")}
          modo="usuario"
          usuarioId={usuario.id}
          nombre={usuario.nombre}
          correo={usuario.correo}
          esAdmin={usuario.esAdmin}
          perfilId={usuario.perfilId}
          permisos={usuario.permisos}
          perfiles={perfiles}
        />
      </>
    );
  }

  if (nuevo === "1") {
    return (
      <>
        <VolverPermisos />
        <Cabecera
          etiqueta="Admin"
          titulo="Nuevo perfil"
          texto="Define una plantilla por módulos del ERP. Luego la aplicas a cada persona desde Permisos."
        />
        <FormularioPermisos modo="crear-perfil" />
      </>
    );
  }

  const [perfiles, usuarios] = await Promise.all([
    listarPerfiles(),
    listarUsuariosInternos(),
  ]);

  return (
    <>
      <Cabecera
        etiqueta="Admin"
        titulo="Permisos"
        texto="Plantillas de acceso y permisos por persona del equipo interno."
      />
      <div className="grid gap-10">
        <PanelUsuariosPermisos usuarios={usuarios} />
        <PanelPerfiles perfiles={perfiles} />
      </div>
    </>
  );
}

function VolverPermisos() {
  return (
    <div className="mb-4">
      <Link href="/admin/permisos" className="etiqueta hover:text-tinta transition">
        ← Permisos
      </Link>
    </div>
  );
}
