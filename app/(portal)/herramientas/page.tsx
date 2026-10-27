import { exigirSesionUsuario } from "@/lib/authz";
import { listarHerramientasDe } from "@/lib/herramientas";
import { Cabecera } from "../cabecera";
import { GridHerramientas } from "./grid-herramientas";
import { HerramientaLightbox } from "./herramienta-lightbox";

export const dynamic = "force-dynamic";

export default async function PaginaHerramientas() {
  const usuario = await exigirSesionUsuario();
  const herramientas = await listarHerramientasDe(usuario.id);
  const n = herramientas.length;

  return (
    <div>
      <Cabecera
        etiqueta="Accesos directos"
        titulo="Herramientas"
        texto="Todo lo que usamos, en un sitio. Algunas cosas Órbita las trae dentro; otras no tienen API y se abren donde siempre."
        sello={`${n} herramienta${n === 1 ? "" : "s"}`}
        acciones={<HerramientaLightbox modo="crear" />}
      />

      {n === 0 ? (
        <div className="rounded-[12px] border border-dashed border-linea-fuerte bg-suave/30 p-8 text-center">
          <p className="text-apagado text-[14px] mb-4">
            Aún no tienes herramientas. Añade la primera o espera a que se carguen las de
            ejemplo.
          </p>
          <HerramientaLightbox modo="crear" />
        </div>
      ) : (
        <GridHerramientas herramientas={herramientas} />
      )}

      <p className="mt-6 text-[12px] text-apagado max-w-[70ch]">
        Este panel es tuyo: cada persona puede añadir, editar o quitar accesos. Al hacer clic se
        abre la URL en una pestaña nueva y te quedas en Órbita.
      </p>
    </div>
  );
}
