"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { contarNoLeidosAction } from "./comunicaciones/acciones";
import { useOrdenMenu } from "./orden-menu";

type Indicador = { id: string; antes: boolean; vertical: boolean };

type ProyectoNav = { id: string; titulo: string };

export function Navegacion({
  noLeidosComunicaciones = 0,
  proyectosNav = [],
}: {
  noLeidosComunicaciones?: number;
  proyectosNav?: ProyectoNav[];
}) {
  const { secciones, items, editando, reordenar } = useOrdenMenu();
  const ruta = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const arrastre = useRef<string | null>(null);
  const indicadorRef = useRef<Indicador | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [indicador, setIndicador] = useState<Indicador | null>(null);
  const [noLeidos, setNoLeidos] = useState(noLeidosComunicaciones);
  const lista = editando ? items : secciones;
  const tieneComunicaciones = secciones.some((s) => s.id === "comunicaciones");
  const mostrarSubproyectos = !editando && proyectosNav.length > 0;

  useEffect(() => {
    setNoLeidos(noLeidosComunicaciones);
  }, [noLeidosComunicaciones]);

  useEffect(() => {
    if (!tieneComunicaciones) return;

    function chatActivoId(): string | null {
      if (!window.location.pathname.startsWith("/comunicaciones")) return null;
      return new URLSearchParams(window.location.search).get("c");
    }

    function refrescarBadge() {
      void contarNoLeidosAction(chatActivoId())
        .then(setNoLeidos)
        .catch(() => {});
    }

    refrescarBadge();
    const t = window.setInterval(refrescarBadge, 2000);
    window.addEventListener("orbita:comms-leidos", refrescarBadge);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("orbita:comms-leidos", refrescarBadge);
    };
  }, [tieneComunicaciones]);

  function fijarIndicador(valor: Indicador | null) {
    indicadorRef.current = valor;
    setIndicador(valor);
  }

  function alPulsar(e: ReactPointerEvent<HTMLAnchorElement>, id: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastre.current = id;
    setArrastrando(id);
  }

  function alMover(e: ReactPointerEvent<HTMLAnchorElement>) {
    const desde = arrastre.current;
    if (!desde) return;
    const bajo = document.elementFromPoint(e.clientX, e.clientY);
    const destino = bajo?.closest<HTMLElement>("[data-nav-id]");
    const hacia = destino?.dataset.navId;
    if (!destino || !hacia || hacia === desde) {
      fijarIndicador(null);
      return;
    }
    const rect = destino.getBoundingClientRect();
    const vertical = navRef.current
      ? getComputedStyle(navRef.current).flexDirection === "column"
      : true;
    const antes = vertical
      ? e.clientY < rect.top + rect.height / 2
      : e.clientX < rect.left + rect.width / 2;
    const actual = indicadorRef.current;
    if (actual && actual.id === hacia && actual.antes === antes && actual.vertical === vertical) {
      return;
    }
    fijarIndicador({ id: hacia, antes, vertical });
  }

  function alSoltar() {
    const desde = arrastre.current;
    const ind = indicadorRef.current;
    arrastre.current = null;
    setArrastrando(null);
    fijarIndicador(null);
    if (desde && ind) reordenar(desde, ind.id, ind.antes);
  }

  return (
    <nav
      ref={navRef}
      className="md:order-2 flex md:flex-col gap-0.5 px-2.5 pb-3 md:pb-2 overflow-x-auto
                    md:flex-1 md:min-h-0 md:overflow-y-auto"
    >
      {lista.map((s) => {
        const activa = s.href === "/" ? ruta === "/" : ruta.startsWith(s.href);
        const marca = indicador?.id === s.id ? indicador : null;
        const sombra = !marca
          ? ""
          : marca.vertical
            ? marca.antes
              ? "shadow-[inset_0_2px_0_0_var(--magenta)]"
              : "shadow-[inset_0_-2px_0_0_var(--magenta)]"
            : marca.antes
              ? "shadow-[inset_2px_0_0_0_var(--magenta)]"
              : "shadow-[inset_-2px_0_0_0_var(--magenta)]";
        const badge =
          s.id === "comunicaciones" && noLeidos > 0 && !editando ? noLeidos : 0;
        const esProyectos = s.id === "proyectos" && mostrarSubproyectos;

        const enlace = (
          <Link
            href={s.href}
            prefetch={false}
            data-nav-id={s.id}
            draggable={false}
            aria-current={!editando && activa ? "page" : undefined}
            aria-roledescription={editando ? "elemento arrastrable" : undefined}
            aria-label={
              badge > 0
                ? `${s.nombre}, ${badge > 99 ? "más de 99" : badge} sin leer`
                : undefined
            }
            onClick={(e) => {
              if (editando) e.preventDefault();
            }}
            onPointerDown={editando ? (e) => alPulsar(e, s.id) : undefined}
            onPointerMove={editando ? alMover : undefined}
            onPointerUp={editando ? alSoltar : undefined}
            onPointerCancel={editando ? alSoltar : undefined}
            className={`relative flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-[13.5px] whitespace-nowrap border transition-[color,background-color,border-color,box-shadow] duration-200 ease-out motion-reduce:transition-none ${
              editando
                ? `border-magenta-borde bg-magenta-suave text-magenta-texto cursor-grab touch-none select-none ${
                    activa ? "font-semibold" : ""
                  } ${arrastrando === s.id ? "pointer-events-none opacity-40" : ""}`
                : activa
                  ? "bg-magenta-suave border-magenta-borde text-magenta-texto font-semibold shadow-suave before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-magenta"
                  : "border-transparent text-apagado hover:bg-suave hover:text-tinta hover:border-linea"
            } ${sombra}`}
          >
            <span
              aria-hidden
              className={`inline-grid grid-cols-2 gap-[3px] overflow-hidden transition-all duration-200 ease-out motion-reduce:transition-none ${
                editando ? "w-3 opacity-70 mr-0" : "w-0 opacity-0"
              }`}
            >
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className="w-[3px] h-[3px] rounded-full bg-current" />
              ))}
            </span>
            <span className="min-w-0 flex-1 truncate">{s.nombre}</span>
            {badge > 0 ? (
              <span className="shrink-0 font-mono text-[10px] bg-magenta text-white rounded-full min-w-[1.25rem] h-5 px-1.5 grid place-items-center">
                {badge > 99 ? "99+" : badge}
              </span>
            ) : null}
          </Link>
        );

        if (!esProyectos) {
          return (
            <div key={s.id} className="shrink-0 md:shrink md:w-full">
              {enlace}
            </div>
          );
        }

        return (
          <div key={s.id} className="shrink-0 md:shrink md:w-full">
            {enlace}
            <ul className="hidden md:block mt-0.5 mb-1 ml-3.5 pl-3 space-y-0.5 border-l border-linea">
              {proyectosNav.map((p) => {
                const activaP = ruta.startsWith(`/proyectos/${p.id}`);
                return (
                  <li key={p.id}>
                    <Link
                      href={`/proyectos/${p.id}`}
                      prefetch={false}
                      className={`block px-2.5 py-1.5 text-[13.5px] truncate rounded-[10px] border transition-colors ${
                        activaP
                          ? "bg-magenta-suave border-magenta-borde text-magenta-texto font-semibold"
                          : "border-transparent text-apagado hover:bg-suave hover:text-tinta hover:border-linea"
                      }`}
                    >
                      {p.titulo}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
