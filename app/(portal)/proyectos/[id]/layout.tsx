import Link from "next/link";
import { esProyectoBoostiq } from "@/lib/boostiq-proyecto";
import { proyectoPorId } from "@/lib/proyectos";
import { nombreDeTipo } from "@/lib/tipos-proyecto";
import { NotasLightbox } from "../../notas-lightbox";
import { btnIcono, IconoNotas } from "../iconos-acciones";
import { ProyectoTabs } from "./tabs";

export default async function ProyectoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const proyecto = await proyectoPorId(id);
  const tipo = proyecto ? await nombreDeTipo(proyecto.tipoId) : null;
  const titulo = proyecto?.nombre?.trim() || tipo || "Proyecto";
  const mostrarAdminBoostiq = proyecto ? esProyectoBoostiq(proyecto) : false;

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <Link href="/proyectos" className="etiqueta hover:text-tinta transition">
          ← Proyectos
        </Link>
        <div className="flex items-center gap-2">
          {proyecto ? (
            <NotasLightbox proyectoId={id} titulo={titulo} className={btnIcono}>
              <IconoNotas />
            </NotasLightbox>
          ) : null}
        </div>
      </div>
      <ProyectoTabs proyectoId={id} mostrarAdminBoostiq={mostrarAdminBoostiq} />
      {children}
    </>
  );
}
