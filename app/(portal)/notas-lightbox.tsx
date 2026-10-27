"use client";

import { useEffect, useId, useState, useTransition, type ReactNode } from "react";
import { AvatarUsuario } from "./avatar-usuario";
import {
  borrarNotaAccion,
  crearNotaProyectoAccion,
  editarNotaAccion,
  obtenerNotasProyecto,
  type NotaVista,
} from "./notas-acciones";

const btnSec =
  "boton-sec text-[12px] px-2.5 py-1 shrink-0";

function formatearFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(iso));
}

function mismaFecha(a: string, b: string): boolean {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) < 1000;
}

type ModoEditor = { tipo: "nueva" } | { tipo: "editar"; nota: NotaVista };

export function NotasLightbox({
  proyectoId,
  titulo,
  className = btnSec,
  children,
}: {
  proyectoId: string;
  titulo: string;
  className?: string;
  children?: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const [notas, setNotas] = useState<NotaVista[] | null>(null);
  const [yoId, setYoId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const [modo, setModo] = useState<ModoEditor | null>(null);
  const [borrador, setBorrador] = useState("");
  const [errorEditor, setErrorEditor] = useState(false);
  const [pendienteEditor, startEditor] = useTransition();
  const [notaABorrar, setNotaABorrar] = useState<NotaVista | null>(null);
  const [errorBorrar, setErrorBorrar] = useState(false);
  const tituloId = useId();
  const editorTituloId = useId();
  const borrarTituloId = useId();

  useEffect(() => {
    if (!abierto) return;
    const onTecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (notaABorrar) {
        setNotaABorrar(null);
        return;
      }
      if (modo) {
        setModo(null);
        return;
      }
      setAbierto(false);
    };
    window.addEventListener("keydown", onTecla);
    return () => window.removeEventListener("keydown", onTecla);
  }, [abierto, modo, notaABorrar]);

  useEffect(() => {
    if (!modo) return;
    setBorrador(modo.tipo === "editar" ? modo.nota.texto : "");
    setErrorEditor(false);
  }, [modo]);

  function abrir() {
    setAbierto(true);
    setError(false);
    setNotas(null);
    setYoId(null);
    setModo(null);
    setNotaABorrar(null);
    startTransition(async () => {
      const r = await obtenerNotasProyecto(proyectoId);
      if (!r.ok) {
        setError(true);
        setNotas([]);
        return;
      }
      setNotas(r.notas);
      setYoId(r.yoId);
    });
  }

  function cerrarTodo() {
    setNotaABorrar(null);
    setModo(null);
    setAbierto(false);
  }

  function guardarEditor() {
    if (!modo) return;
    setErrorEditor(false);
    startEditor(async () => {
      const r =
        modo.tipo === "nueva"
          ? await crearNotaProyectoAccion(proyectoId, borrador)
          : await editarNotaAccion(modo.nota.id, borrador);
      if (!r.ok) {
        setErrorEditor(true);
        return;
      }
      setNotas((prev) => {
        if (!prev) return [r.nota];
        if (modo.tipo === "nueva") return [r.nota, ...prev];
        return prev.map((n) => (n.id === r.nota.id ? r.nota : n));
      });
      setModo(null);
    });
  }

  function confirmarBorrar() {
    if (!notaABorrar) return;
    const id = notaABorrar.id;
    setErrorBorrar(false);
    startEditor(async () => {
      const r = await borrarNotaAccion(id);
      if (!r.ok) {
        setErrorBorrar(true);
        return;
      }
      setNotas((prev) => (prev ? prev.filter((n) => n.id !== id) : prev));
      if (modo?.tipo === "editar" && modo.nota.id === id) setModo(null);
      setNotaABorrar(null);
    });
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={abrir}
        title="Notas"
        aria-label="Notas"
      >
        {children ?? "Notas"}
      </button>

      {abierto ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center p-3 sm:p-4 bg-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={tituloId}
          onClick={cerrarTodo}
        >
          <div className="w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="max-h-[calc(100svh-3rem)] overflow-y-auto rounded-[12px] bg-papel border border-linea-fuerte shadow-suave p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="min-w-0 flex-1">
                  <p className="etiqueta text-magenta-texto mb-1">Notas</p>
                  <h2 id={tituloId} className="font-display font-bold text-[20px] tracking-tight">
                    {titulo}
                  </h2>
                  <p className="text-[12.5px] text-apagado mt-1">
                    Anotaciones del proyecto. Solo el autor puede editar o borrar las suyas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cerrarTodo}
                  className="shrink-0 text-apagado hover:text-tinta text-[18px] leading-none px-1"
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>

              <div className="mb-3">
                <button
                  type="button"
                  className={btnSec}
                  onClick={() => setModo({ tipo: "nueva" })}
                  disabled={pendienteEditor}
                >
                  Añadir nota
                </button>
              </div>

              {pendiente && notas === null ? (
                <p className="text-[13px] text-apagado py-6 text-center">Cargando…</p>
              ) : error ? (
                <p className="text-[13px] text-mal py-6 text-center">No se pudieron cargar las notas.</p>
              ) : !notas || notas.length === 0 ? (
                <p className="text-[13px] text-apagado py-6 text-center">Aún no hay notas.</p>
              ) : (
                <ul className="divide-y divide-linea border border-linea-fuerte rounded-lg overflow-hidden">
                  {notas.map((n) => {
                    const mia = yoId === n.autorId;
                    const editada = !mismaFecha(n.creadoEn, n.actualizadoEn);
                    return (
                      <li key={n.id} className="px-3 py-2.5 bg-suave/40 grid gap-1">
                        <p className="text-[12.5px] break-words whitespace-pre-wrap">{n.texto}</p>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-mono text-[11px] text-apagado min-w-0 flex items-center gap-1.5">
                            <AvatarUsuario
                              nombre={n.autorNombre}
                              avatarUrl={n.autorAvatarUrl}
                              tamano="xs"
                            />
                            <span className="min-w-0 truncate">
                              {n.autorNombre}
                              {" · "}
                              {formatearFecha(n.creadoEn)}
                              {editada ? ` · editada ${formatearFecha(n.actualizadoEn)}` : ""}
                            </span>
                          </p>
                          {mia ? (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                className={btnSec}
                                onClick={() => setModo({ tipo: "editar", nota: n })}
                                disabled={pendienteEditor}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className={`${btnSec} text-mal border-mal-borde hover:bg-mal-suave`}
                                onClick={() => {
                                  setErrorBorrar(false);
                                  setNotaABorrar(n);
                                }}
                                disabled={pendienteEditor}
                              >
                                Borrar
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {modo ? (
              <div
                className="fixed inset-0 z-[58] overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center p-3 sm:p-4 bg-overlay"
                role="dialog"
                aria-modal="true"
                aria-labelledby={editorTituloId}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!pendienteEditor) setModo(null);
                }}
              >
                <div
                  className="w-full max-w-md rounded-[12px] bg-papel border border-linea-fuerte shadow-suave p-5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <p className="etiqueta text-magenta-texto mb-1">Notas</p>
                      <h2
                        id={editorTituloId}
                        className="font-display font-bold text-[20px] tracking-tight"
                      >
                        {modo.tipo === "nueva" ? "Añadir nota" : "Editar nota"}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModo(null)}
                      className="shrink-0 text-apagado hover:text-tinta text-[18px] leading-none px-1"
                      aria-label="Cerrar editor"
                      disabled={pendienteEditor}
                    >
                      ×
                    </button>
                  </div>
                  <textarea
                    value={borrador}
                    onChange={(e) => setBorrador(e.target.value)}
                    rows={8}
                    maxLength={10_000}
                    placeholder="Escribe una nota…"
                    className="control w-full text-[12.5px] px-2 py-1.5 resize-y min-h-[8rem] mb-3"
                    disabled={pendienteEditor}
                  />
                  {errorEditor ? (
                    <p className="text-[12px] text-mal mb-3">No se pudo guardar la nota.</p>
                  ) : null}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      className="h-10 px-4 rounded-lg text-[13.5px] font-semibold bg-magenta text-white hover:opacity-90 disabled:opacity-60"
                      onClick={guardarEditor}
                      disabled={pendienteEditor || !borrador.trim()}
                    >
                      {pendienteEditor ? "Guardando…" : "Guardar"}
                    </button>
                    <button
                      type="button"
                      className="boton-sec h-10"
                      onClick={() => setModo(null)}
                      disabled={pendienteEditor}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {notaABorrar ? (
            <div
              className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center p-3 sm:p-4 bg-overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby={borrarTituloId}
              onClick={(e) => {
                e.stopPropagation();
                if (!pendienteEditor) setNotaABorrar(null);
              }}
            >
              <div
                className="w-full max-w-md rounded-[12px] bg-papel border border-linea-fuerte shadow-suave p-5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <p className="etiqueta text-mal mb-1">Eliminar</p>
                    <h2
                      id={borrarTituloId}
                      className="font-display font-bold text-[20px] tracking-tight"
                    >
                      ¿Borrar esta nota?
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotaABorrar(null)}
                    className="shrink-0 text-apagado hover:text-tinta text-[18px] leading-none px-1"
                    aria-label="Cerrar"
                    disabled={pendienteEditor}
                  >
                    ×
                  </button>
                </div>

                <p className="text-[13.5px] text-apagado mb-5 whitespace-pre-wrap break-words line-clamp-4">
                  {notaABorrar.texto}
                </p>

                {errorBorrar ? (
                  <p className="text-[12px] text-mal mb-3">No se pudo borrar la nota.</p>
                ) : null}

                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    className="h-10 px-4 rounded-lg text-[13.5px] font-semibold bg-mal-boton text-white hover:opacity-90 disabled:opacity-60"
                    onClick={confirmarBorrar}
                    disabled={pendienteEditor}
                  >
                    {pendienteEditor ? "Borrando…" : "Borrar nota"}
                  </button>
                  <button
                    type="button"
                    className="boton-sec h-10"
                    onClick={() => setNotaABorrar(null)}
                    disabled={pendienteEditor}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
