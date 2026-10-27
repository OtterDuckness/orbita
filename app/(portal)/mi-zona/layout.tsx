import { exigirApartado } from "@/lib/apartados";
import { exigirPermiso } from "@/lib/authz";
import { Cabecera } from "../cabecera";
import { BannerVistaMiZona } from "./banner-vista";
import { SwitchVistaMiZona } from "./switch-vista";
import { MiZonaTabs } from "./tabs";

export const dynamic = "force-dynamic";

export default async function MiZonaLayout({ children }: { children: React.ReactNode }) {
  await exigirApartado("mi_zona");
  const usuario = await exigirPermiso("mi_zona.ver");
  const puedeSimular = usuario.esAdminReal;
  const vista = usuario.vistaMiZona;

  return (
    <div>
      <Cabecera
        etiqueta="Equipo"
        titulo="Mi Zona"
        texto="Control horario, ausencias y nóminas vía Holded. Entras con Google; Órbita habla con Holded en el servidor."
      />
      {puedeSimular ? <SwitchVistaMiZona vistaActual={vista} /> : null}
      {vista ? <BannerVistaMiZona vista={vista} /> : null}
      <MiZonaTabs />
      {children}
    </div>
  );
}
