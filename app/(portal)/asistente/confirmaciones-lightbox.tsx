"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  camposConfirmacion,
  parseLista,
  valorCampoUi,
  type CampoConfirmacion,
} from "@/lib/asistente/confirmacion-campos";
import { etiquetaConfirmacionPendiente } from "@/lib/asistente/confirmacion-etiqueta";
import {
  ESTADOS_PROYECTO,
  PRIORIDADES_PROYECTO,
  type PersonaEquipo,
  type TipoProyecto,
} from "@/lib/clientes-mock";
import { PRIORIDADES } from "@/lib/tareas-mock";
import { CampoFecha } from "../campo-fecha";

const ALTO_MENU_PERSONAS = 240;

export type ConfirmacionPendienteUi = {
  tool: string;
  clave: string;
  resumen?: string | null;
  /** Args sanitizados para preview/edición (sin confirmado; UUIDs de destino ocultos). */
  args?: Record<string, unknown>;
  /** Colaboradores del proyecto (asignables). Si falta, se usa todo el equipo. */
  poolIds?: string[];
};

export type OpcionesConfirmacionUi = {
  equipo: PersonaEquipo[];
  tipos: TipoProyecto[];
};

function claveItem(p: ConfirmacionPendienteUi): string {
  return `${p.tool}:${p.clave}`;
}

function norm(s: string): string {
  return s
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function resolverPersonaId(
  ref: string,
  equipo: PersonaEquipo[],
): string | null {
  const r = ref.trim();
  if (!r) return null;
  const porId = equipo.find((p) => p.id === r);
  if (porId) return porId.id;
  const n = norm(r);
  const porNombre = equipo.filter((p) => norm(p.nombre) === n);
  if (porNombre.length === 1) return porNombre[0]!.id;
  const porEmail = equipo.filter((p) => norm(p.email) === n);
  if (porEmail.length === 1) return porEmail[0]!.id;
  return null;
}

function resolverTipoId(ref: string, tipos: TipoProyecto[]): string {
  const r = ref.trim();
  if (!r) return "";
  if (tipos.some((t) => t.id === r)) return r;
  const n = norm(r);
  const hit = tipos.filter((t) => norm(t.nombre) === n);
  if (hit.length === 1) return hit[0]!.id;
  return r;
}

function candidatosEquipo(
  equipo: PersonaEquipo[],
  poolIds?: string[],
): PersonaEquipo[] {
  if (!poolIds || poolIds.length === 0) return equipo;
  const set = new Set(poolIds);
  return equipo.filter((p) => set.has(p.id));
}

function normalizarValor(
  campo: CampoConfirmacion,
  args: Record<string, unknown>,
  opts: OpcionesConfirmacionUi,
  poolIds?: string[],
): string | boolean {
  const raw = valorCampoUi(campo, args);
  if (campo.tipo === "boolean") return Boolean(raw);
  if (campo.tipo === "persona") {
    const id = resolverPersonaId(String(raw), opts.equipo);
    const resuelto = id ?? String(raw);
    if (poolIds?.length && !poolIds.includes(resuelto)) return "";
    return resuelto;
  }
  if (campo.tipo === "personas") {
    const refs = parseLista(String(raw));
    const ids = refs.map((ref) => resolverPersonaId(ref, opts.equipo) ?? ref);
    const filtrados = poolIds?.length
      ? ids.filter((id) => poolIds.includes(id))
      : ids;
    return filtrados.join(", ");
  }
  if (campo.tipo === "tipo") {
    return resolverTipoId(String(raw), opts.tipos);
  }
  return raw;
}

function borradorInicial(
  pendientes: ConfirmacionPendienteUi[],
  opts: OpcionesConfirmacionUi,
): Record<string, Record<string, string | boolean>> {
  const out: Record<string, Record<string, string | boolean>> = {};
  for (const p of pendientes) {
    const args = p.args ?? {};
    const fila: Record<string, string | boolean> = {};
    for (const campo of camposConfirmacion(p.tool)) {
      if (!campo.editable) continue;
      if (!(campo.key in args)) continue;
      fila[campo.key] = normalizarValor(campo, args, opts, p.poolIds);
    }
    out[claveItem(p)] = fila;
  }
  return out;
}

function etiquetaPersona(id: string, equipo: PersonaEquipo[]): string {
  return equipo.find((p) => p.id === id)?.nombre ?? id;
}

function SelectorPersonas({
  label,
  idsCsv,
  equipo,
  disabled,
  onChange,
}: {
  label: string;
  idsCsv: string;
  equipo: PersonaEquipo[];
  disabled: boolean;
  onChange: (csv: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [montado, setMontado] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, maxH: ALTO_MENU_PERSONAS });
  const rootRef = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const ids = parseLista(idsCsv);

  useEffect(() => {
    setMontado(true);
  }, []);

  function colocar() {
    const r = botonRef.current?.getBoundingClientRect();
    if (!r) return;
    const espacioAbajo = window.innerHeight - r.bottom - 8;
    const espacioArriba = r.top - 8;
    const abrirArriba = espacioAbajo < ALTO_MENU_PERSONAS && espacioArriba > espacioAbajo;
    const maxH = Math.min(
      ALTO_MENU_PERSONAS,
      Math.max(120, abrirArriba ? espacioArriba : espacioAbajo),
    );
    const top = abrirArriba
      ? Math.max(8, r.top - maxH - 6)
      : Math.min(r.bottom + 6, window.innerHeight - maxH - 8);
    setPos({
      top,
      left: Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8)),
      width: r.width,
      maxH,
    });
  }

  useEffect(() => {
    if (!abierto) return;
    colocar();
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
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

  const resumen = ids.length
    ? ids.map((id) => etiquetaPersona(id, equipo)).join(", ")
    : "Elegir…";

  return (
    <div ref={rootRef} className="grid gap-1">
      <span className="text-[11px] uppercase tracking-wide text-apagado">{label}</span>
      <button
        ref={botonRef}
        type="button"
        disabled={disabled || equipo.length === 0}
        aria-expanded={abierto}
        aria-haspopup="listbox"
        onClick={() => {
          if (disabled || equipo.length === 0) return;
          if (abierto) setAbierto(false);
          else {
            colocar();
            setAbierto(true);
          }
        }}
        className="w-full rounded-md border border-linea bg-papel px-2.5 py-1.5 text-[13px] text-left inline-flex items-center justify-between gap-2 hover:border-magenta-borde disabled:opacity-40"
      >
        <span className={`min-w-0 truncate ${ids.length ? "text-tinta" : "text-apagado"}`}>
          {resumen}
        </span>
        <span className="text-apagado font-mono text-[12px] shrink-0">
          {ids.length || ""}
        </span>
      </button>
      {montado && abierto
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              aria-label={label}
              style={{
                top: pos.top,
                left: pos.left,
                width: pos.width,
                maxHeight: pos.maxH,
              }}
              className="fixed z-[90] rounded-xl border border-linea-fuerte bg-papel p-3 shadow-suave overflow-y-auto"
            >
              <ul className="grid gap-2">
                {equipo.map((p) => {
                  const marcado = ids.includes(p.id);
                  return (
                    <li key={p.id}>
                      <label className="flex items-center gap-2.5 text-[13px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={marcado}
                          className="accent-[var(--magenta)] size-4"
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...ids, p.id]
                              : ids.filter((id) => id !== p.id);
                            onChange(next.join(", "));
                          }}
                        />
                        <span className="min-w-0 truncate">{p.nombre}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function CampoFila({
  campo,
  valor,
  disabled,
  equipo,
  tipos,
  poolIds,
  onChange,
}: {
  campo: CampoConfirmacion;
  valor: string | boolean;
  disabled: boolean;
  equipo: PersonaEquipo[];
  tipos: TipoProyecto[];
  poolIds?: string[];
  onChange?: (v: string | boolean) => void;
}) {
  const id = useId();
  const personas = candidatosEquipo(equipo, poolIds);

  if (!campo.editable) {
    let texto: string;
    if (typeof valor === "boolean") texto = valor ? "Sí" : "No";
    else if (campo.tipo === "persona") texto = etiquetaPersona(String(valor), equipo);
    else if (campo.tipo === "personas") {
      texto =
        parseLista(String(valor))
          .map((x) => etiquetaPersona(x, equipo))
          .join(", ") || "—";
    } else if (campo.tipo === "tipo") {
      texto =
        tipos.find((t) => t.id === String(valor))?.nombre ??
        (String(valor) || "—");
    } else texto = String(valor) || "—";
    return (
      <div className="grid gap-0.5">
        <dt className="text-[11px] uppercase tracking-wide text-apagado">
          {campo.label}
        </dt>
        <dd className="text-[13px] text-tinta break-words whitespace-pre-wrap">{texto}</dd>
      </div>
    );
  }

  if (campo.tipo === "boolean") {
    return (
      <label className="flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={Boolean(valor)}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
          className="accent-[var(--magenta)] size-4"
        />
        <span>{campo.label}</span>
      </label>
    );
  }

  if (campo.tipo === "fecha") {
    return (
      <CampoFecha
        etiqueta={campo.label}
        value={String(valor)}
        disabled={disabled}
        onChange={(v) => onChange?.(v)}
        botonClassName="w-full justify-start h-9"
      />
    );
  }

  if (campo.tipo === "persona") {
    const v = String(valor);
    const conocido = personas.some((p) => p.id === v);
    return (
      <div className="grid gap-1">
        <label htmlFor={id} className="text-[11px] uppercase tracking-wide text-apagado">
          {campo.label}
        </label>
        <select
          id={id}
          value={conocido ? v : ""}
          disabled={disabled || personas.length === 0}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full rounded-md border border-linea bg-papel px-2.5 py-1.5 text-[13px] h-9"
        >
          {!conocido && v ? <option value={v}>{etiquetaPersona(v, equipo)}</option> : null}
          <option value="">Elegir…</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        {poolIds?.length && personas.length === 0 ? (
          <p className="text-[11px] text-apagado">
            No hay colaboradores en este proyecto para asignar.
          </p>
        ) : null}
      </div>
    );
  }

  if (campo.tipo === "personas") {
    return (
      <SelectorPersonas
        label={campo.label}
        idsCsv={String(valor)}
        equipo={personas}
        disabled={disabled}
        onChange={(csv) => onChange?.(csv)}
      />
    );
  }

  if (campo.tipo === "prioridad") {
    const opts = [...new Set([...PRIORIDADES, ...PRIORIDADES_PROYECTO])];
    const v = String(valor) || "media";
    return (
      <div className="grid gap-1">
        <label htmlFor={id} className="text-[11px] uppercase tracking-wide text-apagado">
          {campo.label}
        </label>
        <select
          id={id}
          value={opts.includes(v as (typeof opts)[number]) ? v : "media"}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full rounded-md border border-linea bg-papel px-2.5 py-1.5 text-[13px] h-9 capitalize"
        >
          {opts.map((p) => (
            <option key={p} value={p} className="capitalize">
              {p}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (campo.tipo === "estado") {
    const v = String(valor);
    return (
      <div className="grid gap-1">
        <label htmlFor={id} className="text-[11px] uppercase tracking-wide text-apagado">
          {campo.label}
        </label>
        <select
          id={id}
          value={ESTADOS_PROYECTO.includes(v as (typeof ESTADOS_PROYECTO)[number]) ? v : "activo"}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full rounded-md border border-linea bg-papel px-2.5 py-1.5 text-[13px] h-9 capitalize"
        >
          {ESTADOS_PROYECTO.map((e) => (
            <option key={e} value={e} className="capitalize">
              {e}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (campo.tipo === "ambito") {
    const v = String(valor) === "interno" ? "interno" : "externo";
    return (
      <div className="grid gap-1">
        <label htmlFor={id} className="text-[11px] uppercase tracking-wide text-apagado">
          {campo.label}
        </label>
        <select
          id={id}
          value={v}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full rounded-md border border-linea bg-papel px-2.5 py-1.5 text-[13px] h-9"
        >
          <option value="externo">Externo</option>
          <option value="interno">Interno</option>
        </select>
      </div>
    );
  }

  if (campo.tipo === "tipo") {
    const v = String(valor);
    const conocido = tipos.some((t) => t.id === v);
    return (
      <div className="grid gap-1">
        <label htmlFor={id} className="text-[11px] uppercase tracking-wide text-apagado">
          {campo.label}
        </label>
        <select
          id={id}
          value={conocido ? v : tipos[0]?.id ?? ""}
          disabled={disabled || tipos.length === 0}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full rounded-md border border-linea bg-papel px-2.5 py-1.5 text-[13px] h-9"
        >
          {!conocido && v ? <option value={v}>{v}</option> : null}
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (campo.tipo === "textarea") {
    return (
      <div className="grid gap-1">
        <label htmlFor={id} className="text-[11px] uppercase tracking-wide text-apagado">
          {campo.label}
        </label>
        <textarea
          id={id}
          value={String(valor)}
          disabled={disabled}
          rows={4}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full rounded-md border border-linea bg-papel px-2.5 py-2 text-[13px] resize-y min-h-[72px]"
        />
      </div>
    );
  }

  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-[11px] uppercase tracking-wide text-apagado">
        {campo.label}
        {campo.tipo === "lista" ? (
          <span className="normal-case text-apagado font-normal"> (separados por coma)</span>
        ) : null}
      </label>
      <input
        id={id}
        type={campo.tipo === "number" ? "number" : "text"}
        value={String(valor)}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-md border border-linea bg-papel px-2.5 py-1.5 text-[13px]"
      />
    </div>
  );
}

export function ConfirmacionesLightbox({
  pendientes,
  busy,
  equipo = [],
  tipos = [],
  onConfirmar,
  onRechazar,
  onConfirmarTodas,
  onCancelarTodas,
  onCerrar,
}: {
  pendientes: ConfirmacionPendienteUi[];
  busy: boolean;
  equipo?: PersonaEquipo[];
  tipos?: TipoProyecto[];
  onConfirmar: (
    p: ConfirmacionPendienteUi,
    argsEditados?: Record<string, unknown>,
  ) => void;
  onRechazar: (p: ConfirmacionPendienteUi) => void;
  onConfirmarTodas: () => void;
  onCancelarTodas: () => void;
  onCerrar: () => void;
}) {
  const tituloId = useId();
  const n = pendientes.length;
  const opts = useMemo(() => ({ equipo, tipos }), [equipo, tipos]);
  const firma = useMemo(
    () =>
      pendientes
        .map((p) => claveItem(p))
        .sort()
        .join("|"),
    [pendientes],
  );
  const [borrador, setBorrador] = useState(() => borradorInicial(pendientes, opts));

  useEffect(() => {
    setBorrador(borradorInicial(pendientes, opts));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- firma + catálogos
  }, [firma, equipo, tipos]);

  useEffect(() => {
    const onTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCerrar();
    };
    window.addEventListener("keydown", onTecla);
    return () => window.removeEventListener("keydown", onTecla);
  }, [busy, onCerrar]);

  if (n === 0) return null;

  const setCampo = (
    p: ConfirmacionPendienteUi,
    key: string,
    valor: string | boolean,
  ) => {
    const k = claveItem(p);
    setBorrador((prev) => ({
      ...prev,
      [k]: { ...(prev[k] ?? {}), [key]: valor },
    }));
  };

  const argsEditadosDe = (
    p: ConfirmacionPendienteUi,
  ): Record<string, unknown> | undefined => {
    const fila = borrador[claveItem(p)];
    if (!fila || Object.keys(fila).length === 0) return undefined;
    return { ...fila };
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center p-3 sm:p-4 bg-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={tituloId}
      onClick={() => {
        if (!busy) onCerrar();
      }}
    >
      <div
        className="w-full max-w-lg max-h-[calc(100svh-3rem)] overflow-y-auto rounded-[12px] bg-papel border border-linea-fuerte shadow-suave p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <p className="etiqueta text-magenta-texto mb-1">Asistente</p>
            <h2 id={tituloId} className="font-display font-bold text-[20px] tracking-tight">
              {n === 1 ? "Confirmar acción" : `Confirmar ${n} acciones`}
            </h2>
            <p className="text-[13px] text-apagado mt-1">
              {n === 1
                ? "Revisa o corrige los cambios y confirma o rechaza."
                : "Revisa o corrige cada acción. «Confirmar todas» aplica los valores originales del agente."}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            disabled={busy}
            className="shrink-0 text-apagado hover:text-tinta text-[18px] leading-none px-1 disabled:opacity-40"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <ul className="grid gap-3 mb-4">
          {pendientes.map((p) => {
            const campos = camposConfirmacion(p.tool);
            const args = p.args ?? {};
            const fila = borrador[claveItem(p)] ?? {};
            const visibles = campos.filter((campo) => {
              if (campo.editable) {
                return campo.key in fila || campo.key in args;
              }
              return !valorVacioArg(args[campo.key]) && !esUuidArg(args[campo.key]);
            });

            return (
              <li
                key={claveItem(p)}
                className="rounded-[10px] border border-linea bg-suave/50 px-3 py-3 grid gap-3"
              >
                <p className="text-[14px] font-medium leading-snug">
                  {etiquetaConfirmacionPendiente(p)}
                </p>

                {visibles.length > 0 ? (
                  <dl className="grid gap-2.5">
                    {visibles.map((campo) => {
                      const valor = campo.editable
                        ? (fila[campo.key] ??
                          normalizarValor(campo, args, opts, p.poolIds))
                        : valorCampoUi(campo, args);
                      return (
                        <CampoFila
                          key={campo.key}
                          campo={campo}
                          valor={valor}
                          disabled={busy}
                          equipo={equipo}
                          tipos={tipos}
                          poolIds={p.poolIds}
                          onChange={
                            campo.editable
                              ? (v) => setCampo(p, campo.key, v)
                              : undefined
                          }
                        />
                      );
                    })}
                  </dl>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onConfirmar(p, argsEditadosDe(p))}
                    className="rounded-md bg-magenta text-white px-3 py-1.5 text-[13px] font-medium disabled:opacity-40"
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onRechazar(p)}
                    className="rounded-md border border-linea bg-papel px-3 py-1.5 text-[13px] font-medium hover:bg-suave disabled:opacity-40"
                  >
                    Rechazar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        {n > 1 ? (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-linea">
            <button
              type="button"
              disabled={busy}
              onClick={onConfirmarTodas}
              className="rounded-md bg-magenta text-white px-4 py-2 text-[13.5px] font-medium disabled:opacity-40"
            >
              Confirmar todas
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onCancelarTodas}
              className="rounded-md border border-linea bg-papel px-4 py-2 text-[13.5px] font-medium hover:bg-suave disabled:opacity-40"
            >
              Cancelar todas
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function valorVacioArg(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string" && !v.trim()) return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esUuidArg(v: unknown): boolean {
  if (typeof v === "string") return UUID_RE.test(v.trim());
  if (Array.isArray(v)) {
    return (
      v.length > 0 &&
      v.every((x) => typeof x === "string" && UUID_RE.test(x.trim()))
    );
  }
  return false;
}
