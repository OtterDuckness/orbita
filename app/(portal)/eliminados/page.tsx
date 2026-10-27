import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  DIAS_RETENCION_PAPELERA,
  listarEliminaciones,
  puedeGestionarPapelera,
} from "@/lib/papelera";
import { obtenerUsuarioAuthPorCorreo } from "@/lib/usuarios";
import { Cabecera } from "../cabecera";
import { ListaEliminados } from "./lista-eliminados";

export const dynamic = "force-dynamic";

export default async function EliminadosPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const usuario = await obtenerUsuarioAuthPorCorreo(session.user.email);
  if (!usuario) redirect("/login");
  if (!puedeGestionarPapelera(usuario)) redirect("/?aviso=sin_permiso");

  const items = await listarEliminaciones(usuario, { limite: 100 });

  return (
    <>
      <Cabecera
        etiqueta="Cuenta"
        titulo="Eliminados"
        texto={`Papelera de tareas, proyectos y clientes. Puedes restaurarlos durante ${DIAS_RETENCION_PAPELERA} días. Tras caducar, el borrado es definitivo.`}
      />
      <ListaEliminados items={items} />
    </>
  );
}
