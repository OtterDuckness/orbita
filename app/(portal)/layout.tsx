import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { apartadoVisible, leerApartados, type ApartadosActivos } from "@/lib/apartados";
import { seccionesVisibles, type NavItemId } from "@/lib/nav-mock";
import { contarNoLeidosDe } from "@/lib/comunicaciones";
import { listarProyectos, idsProyectosFavoritosDe } from "@/lib/proyectos";
import { mapaNombresTipo } from "@/lib/tipos-proyecto";
import { esModoPruebas } from "@/lib/sandbox";
import { ZONA } from "@/lib/formato";
import { esVistaUsuario } from "@/lib/vista-usuario";
import { obtenerUsuarioAuthPorCorreo, usuarioPuede } from "@/lib/usuarios";
import { parseZona } from "@/lib/zona";
import { runWithZona } from "@/lib/zona-server";
import { AvatarUsuario } from "./avatar-usuario";
import { Salir } from "./salir";
import { Navegacion } from "./navegacion";
import { EnlaceAjustes } from "./enlace-ajustes";
import { EnlaceEliminados } from "./enlace-eliminados";
import { EnlaceAdmin } from "./enlace-admin";
import { SugerenciasLightbox } from "./sugerencias-lightbox";
import { AvisosShell } from "./avisos-shell";
import { BannerModoPruebas } from "./banner-modo-pruebas";
import { BannerVistaUsuario } from "./banner-vista-usuario";
import { OrdenMenuProvider } from "./orden-menu";
import { TimezoneProvider } from "./timezone-provider";

export const dynamic = "force-dynamic";

function filtrarNavPorPermisos(
  secciones: { href: string; nombre: string; id: NavItemId }[],
  puedeClientes: boolean,
  puedeProyectos: boolean,
  puedeTareas: boolean,
  puedeComunicaciones: boolean,
  puedeCorreo: boolean,
  puedeMiZona: boolean,
  apartados: ApartadosActivos,
  esAdmin: boolean,
) {
  return secciones.filter((s) => {
    if (!apartadoVisible(apartados, s.id, esAdmin)) return false;
    if (s.id === "mi_zona") return puedeMiZona;
    if (s.id === "clientes") return puedeClientes;
    if (s.id === "proyectos") return puedeProyectos;
    if (s.id === "tareas") return puedeTareas;
    if (s.id === "calendario") return puedeTareas;
    if (s.id === "correo") return puedeCorreo;
    if (s.id === "comunicaciones") return puedeComunicaciones;
    return true;
  });
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login");
  }

  const email = session.user.email;
  const usuario = await obtenerUsuarioAuthPorCorreo(email);
  const zona = parseZona(usuario?.timezone ?? ZONA);
  const nombre = usuario?.nombre?.trim() || session.user.name?.trim() || email;
  const puedeClientes = usuario ? usuarioPuede(usuario, "clientes.ver") : false;
  const puedeProyectos = usuario ? usuarioPuede(usuario, "proyectos.ver") : false;
  const puedeTareas = usuario ? usuarioPuede(usuario, "tareas.ver") : false;
  const puedeComunicaciones = usuario ? usuarioPuede(usuario, "comunicaciones.ver") : false;
  const puedeCorreo = usuario ? usuarioPuede(usuario, "correo.ver") : false;
  const puedeMiZona = usuario ? usuarioPuede(usuario, "mi_zona.ver") : false;
  const puedeEliminados = usuario
    ? usuarioPuede(usuario, "tareas.editar") ||
      usuarioPuede(usuario, "proyectos.editar") ||
      usuarioPuede(usuario, "clientes.editar")
    : false;
  const esAdmin = Boolean(usuario?.esAdmin);
  const [modoPruebas, vistaUsuario, apartados] = await Promise.all([
    esModoPruebas(),
    esVistaUsuario(),
    leerApartados(),
  ]);
  const noLeidosComunicaciones =
    usuario && puedeComunicaciones ? await contarNoLeidosDe(usuario.id) : 0;
  const secciones = filtrarNavPorPermisos(
    seccionesVisibles(email),
    puedeClientes,
    puedeProyectos,
    puedeTareas,
    puedeComunicaciones,
    puedeCorreo,
    puedeMiZona,
    apartados,
    esAdmin,
  );

  let proyectosNav: { id: string; titulo: string }[] = [];
  if (usuario && puedeProyectos) {
    const [proyectosDb, nombresTipo, favoritos] = await Promise.all([
      listarProyectos(usuario.id),
      mapaNombresTipo(),
      idsProyectosFavoritosDe(usuario.id),
    ]);
    proyectosNav = proyectosDb
      .filter((p) => p.estado === "activo" && favoritos.has(p.id))
      .map((p) => ({
        id: p.id,
        titulo: (p.nombre?.trim() || (p.tipoId ? nombresTipo.get(p.tipoId) : null) || "Proyecto").trim(),
      }))
      .sort((a, b) => a.titulo.localeCompare(b.titulo, "es"));
  }

  return runWithZona(zona, () => (
    <TimezoneProvider zona={zona}>
      <div className="min-h-screen md:flex">
        <AvisosShell>
          <OrdenMenuProvider secciones={secciones}>
            <aside
              className="md:w-[236px] md:shrink-0 md:h-screen md:sticky md:top-0 bg-papel
                            border-b md:border-b-0 md:border-r md:border-r-linea-fuerte border-linea flex flex-col z-10"
            >
              <div className="flex items-center gap-3 px-4 md:contents">
                <Link
                  href="/"
                  className="md:order-1 shrink-0 flex items-center gap-2.5 py-4 md:px-5 md:py-5 group"
                >
                  <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" className="shrink-0 text-magenta">
                    <circle cx="13" cy="13" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    <circle cx="13" cy="3.5" r="3.2" fill="currentColor" />
                  </svg>
                  <b className="font-display font-bold text-[17px] tracking-tight group-hover:text-magenta-texto transition">
                    Órbita
                  </b>
                </Link>

                <div className="flex-1 md:hidden" />

                <div
                  className="md:order-4 md:mt-auto shrink-0 flex flex-col
                                md:border-t md:border-linea-fuerte"
                >
                  <div className="hidden md:block mx-2.5 mt-2 mb-1">
                    {esAdmin ? <EnlaceAdmin /> : null}
                    <SugerenciasLightbox />
                    {puedeEliminados ? <EnlaceEliminados /> : null}
                    <EnlaceAjustes />
                  </div>

                  <div className="flex items-center gap-2.5 py-3 md:p-3">
                    <AvatarUsuario
                      nombre={nombre}
                      avatarUrl={usuario?.avatarUrl ?? null}
                      tamano="md"
                    />
                    <div className="hidden md:block leading-tight min-w-0 flex-1">
                      <div className="text-[12.5px] font-semibold truncate">{nombre}</div>
                      <div className="text-[11px] text-apagado truncate">{email}</div>
                    </div>
                    <div className="md:hidden shrink-0 flex items-center gap-1.5">
                      {esAdmin ? <EnlaceAdmin compacto /> : null}
                      <SugerenciasLightbox compacto />
                      {puedeEliminados ? <EnlaceEliminados compacto /> : null}
                      <EnlaceAjustes compacto />
                    </div>
                    <Salir />
                  </div>
                </div>
              </div>

              <Navegacion
                noLeidosComunicaciones={noLeidosComunicaciones}
                proyectosNav={proyectosNav}
              />
            </aside>

            <main className="flex-1 min-w-0 p-4 sm:p-7 md:pt-6 pb-16">
              {modoPruebas ? <BannerModoPruebas /> : null}
              {vistaUsuario ? <BannerVistaUsuario /> : null}
              {children}
            </main>
          </OrdenMenuProvider>
        </AvisosShell>
      </div>
    </TimezoneProvider>
  ));
}
