import { exigirAdmin } from "@/lib/authz";
import { listarSugerenciasPendientes } from "@/lib/sugerencias";
import { listarEquipo } from "@/lib/usuarios";
import { Cabecera } from "../../cabecera";
import { ListaSugerenciasAdmin } from "./lista-sugerencias";

export const dynamic = "force-dynamic";

export default async function AdminSugerenciasPage() {
  await exigirAdmin();
  const [sugerencias, equipo] = await Promise.all([
    listarSugerenciasPendientes(),
    listarEquipo(),
  ]);

  return (
    <>
      <Cabecera
        etiqueta="Admin"
        titulo="Sugerencias"
        texto="Revisa propuestas del equipo. Crear tarea las mueve a «Por hacer» en Órbita."
        sello={`${sugerencias.length} ${sugerencias.length === 1 ? "pendiente" : "pendientes"}`}
      />

      <ListaSugerenciasAdmin
        sugerencias={sugerencias}
        equipo={equipo.map((p) => ({ id: p.id, nombre: p.nombre }))}
      />
    </>
  );
}
