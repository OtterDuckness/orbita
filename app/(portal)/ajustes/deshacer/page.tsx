import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  DIAS_RETENCION_DESHACER,
  listarAccionesDeshacer,
} from "@/lib/deshacer";
import { obtenerUsuarioAuthPorCorreo } from "@/lib/usuarios";
import { Cabecera } from "../../cabecera";
import { ListaDeshacer } from "./lista-deshacer";

export const dynamic = "force-dynamic";

export default async function DeshacerPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const usuario = await obtenerUsuarioAuthPorCorreo(session.user.email);
  if (!usuario) redirect("/login");

  const items = await listarAccionesDeshacer(usuario, { limite: 50 });

  return (
    <>
      <Cabecera
        etiqueta="Cuenta"
        titulo="Deshacer"
        texto={`Acciones recientes tuyas o del asistente (últimos ${DIAS_RETENCION_DESHACER} días). Puedes revertir cualquiera mientras no haya caducado ni haya un conflicto con el estado actual. Distinto de la papelera de eliminados.`}
      />
      <ListaDeshacer items={items} diasRetencion={DIAS_RETENCION_DESHACER} />
    </>
  );
}
