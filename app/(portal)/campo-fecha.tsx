"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fecha } from "@/lib/formato";

const ANCHO_CAL = 252;
const ALTO_CAL = 320;

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmd(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T12:00:00`);
}

const DIAS_CAL = ["L", "M", "X", "J", "V", "S", "D"] as const;

function celdasMes(year: number, month: number) {
  const primero = new Date(year, month, 1);
  const offset = (primero.getDay() + 6) % 7;
  const diasMes = new Date(year, month + 1, 0).getDate();
  const diasPrev = new Date(year, month, 0).getDate();
  const celdas: { ymd: string; dia: number; enMes: boolean }[] = [];

  for (let i = 0; i < offset; i++) {
    const dia = diasPrev - offset + i + 1;
    celdas.push({ ymd: toYmd(new Date(year, month - 1, dia)), dia, enMes: false });
  }
  for (let dia = 1; dia <= diasMes; dia++) {
    celdas.push({ ymd: toYmd(new Date(year, month, dia)), dia, enMes: true });
  }
  let next = 1;
  while (celdas.length % 7 !== 0) {
    celdas.push({ ymd: toYmd(new Date(year, month + 1, next)), dia: next, enMes: false });
    next += 1;
  }
  return celdas;
}

export function CampoFecha({
  etiqueta,
  name,
  value,
  min,
  max,
  onChange,
  formId,
  mostrarEtiqueta = true,
  required = false,
  disabled = false,
  botonClassName,
}: {
  etiqueta: string;
  name?: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (v: string) => void;
  formId?: string;
  mostrarEtiqueta?: boolean;
  required?: boolean;
  disabled?: boolean;
  botonClassName?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [montado, setMontado] = useState(false);
  const ancla = parseYmd(value) ?? new Date();
  const [vista, setVista] = useState({ y: ancla.getFullYear(), m: ancla.getMonth() });

  useEffect(() => {
    setMontado(true);
  }, []);

  function colocar() {
    const r = botonRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - ANCHO_CAL - 8));
    const espacioAbajo = window.innerHeight - r.bottom - 8;
    const espacioArriba = r.top - 8;
    const abrirArriba = espacioAbajo < ALTO_CAL && espacioArriba > espacioAbajo;
    const top = abrirArriba
      ? Math.max(8, r.top - ALTO_CAL - 6)
      : Math.min(r.bottom + 6, window.innerHeight - ALTO_CAL - 8);
    setPos({ top, left });
  }

  function abrir() {
    if (disabled) return;
    const base = parseYmd(value) ?? new Date();
    setVista({ y: base.getFullYear(), m: base.getMonth() });
    colocar();
    setAbierto(true);
  }

  useEffect(() => {
    if (!abierto) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || popoverRef.current?.contains(t)) return;
      setAbierto(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      setAbierto(false);
    }
    function onRepos() {
      colocar();
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onRepos);
    window.addEventListener("scroll", onRepos, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onRepos);
      window.removeEventListener("scroll", onRepos, true);
    };
  }, [abierto]);

  function deshabilitado(ymd: string) {
    if (min && ymd < min) return true;
    if (max && ymd > max) return true;
    return false;
  }

  const hoy = toYmd(new Date());
  const tituloMes = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(
    new Date(vista.y, vista.m, 1),
  );

  return (
    <div ref={rootRef} className={`relative ${mostrarEtiqueta ? "grid gap-1 justify-items-start" : "inline-flex items-center"}`}>
      {mostrarEtiqueta ? <span className="etiqueta">{etiqueta}</span> : null}
      <button
        ref={botonRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (abierto) setAbierto(false);
          else abrir();
        }}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        aria-label={etiqueta}
        className={`inline-flex ${mostrarEtiqueta ? "h-9" : "h-7"} w-fit max-w-full items-center rounded-lg border border-linea px-2.5 text-[13px] transition ${
          disabled
            ? "opacity-60 cursor-not-allowed"
            : "hover:border-magenta-borde hover:bg-magenta-suave"
        } ${value ? "text-tinta" : "text-apagado"} ${botonClassName ?? ""}`}
      >
        {value ? fecha(value) : "Elegir fecha"}
      </button>
      {name ? (
        required ? (
          <input
            type="text"
            name={name}
            value={value}
            form={formId}
            required
            readOnly
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only absolute opacity-0 pointer-events-none w-px h-px"
            onChange={() => {}}
          />
        ) : (
          <input type="hidden" name={name} value={value} form={formId} />
        )
      ) : null}

      {montado && abierto
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label={etiqueta}
              style={{ top: pos.top, left: pos.left }}
              className="fixed z-[80] w-[252px] rounded-lg border border-linea-fuerte bg-papel p-3 shadow-suave"
            >
              <div className="flex items-center gap-2 mb-2">
                <p className="flex-1 min-w-0 text-[13px] font-semibold capitalize leading-tight">{tituloMes}</p>
                <button
                  type="button"
                  aria-label="Mes anterior"
                  className="boton-sec h-7 w-7 p-0 grid place-items-center text-[12px] rounded-md"
                  onClick={() =>
                    setVista((v) => {
                      const d = new Date(v.y, v.m - 1, 1);
                      return { y: d.getFullYear(), m: d.getMonth() };
                    })
                  }
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Mes siguiente"
                  className="boton-sec h-7 w-7 p-0 grid place-items-center text-[12px] rounded-md"
                  onClick={() =>
                    setVista((v) => {
                      const d = new Date(v.y, v.m + 1, 1);
                      return { y: d.getFullYear(), m: d.getMonth() };
                    })
                  }
                >
                  ›
                </button>
              </div>

              <div className="grid grid-cols-7 gap-0.5 mb-1">
                {DIAS_CAL.map((d) => (
                  <span key={d} className="h-7 grid place-items-center text-[10px] font-mono text-apagado">
                    {d}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {celdasMes(vista.y, vista.m).map((c) => {
                  const off = deshabilitado(c.ymd);
                  const sel = value === c.ymd;
                  const esHoy = c.ymd === hoy;
                  return (
                    <button
                      key={c.ymd}
                      type="button"
                      disabled={off}
                      aria-current={esHoy ? "date" : undefined}
                      onClick={() => {
                        onChange(c.ymd);
                        setAbierto(false);
                      }}
                      className={`h-8 rounded-md text-[12px] ${
                        sel
                          ? "bg-magenta text-white font-semibold"
                          : off
                            ? "text-apagado/40 cursor-not-allowed"
                            : esHoy
                              ? "font-semibold text-magenta-texto ring-1 ring-inset ring-magenta-borde hover:bg-magenta-suave"
                              : c.enMes
                                ? "text-tinta hover:bg-fila-hover"
                                : "text-apagado hover:bg-fila-hover"
                      }`}
                    >
                      {c.dia}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 pt-2 border-t border-linea flex justify-between gap-2">
                {required ? (
                  <span />
                ) : (
                  <button
                    type="button"
                    className="text-[12px] text-magenta-texto hover:underline"
                    onClick={() => {
                      onChange("");
                      setAbierto(false);
                    }}
                  >
                    Borrar
                  </button>
                )}
                <button
                  type="button"
                  disabled={deshabilitado(hoy)}
                  className="text-[12px] text-magenta-texto hover:underline disabled:text-apagado/40 disabled:no-underline"
                  onClick={() => {
                    onChange(hoy);
                    setAbierto(false);
                  }}
                >
                  Hoy
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
