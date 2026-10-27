"use client";

import { useEffect, useId, useState, useRef } from "react";
import Link from "next/link";
import type {
  AdjuntoVista,
  ConversacionLista,
  MensajeVista,
  ReferenciaVista,
} from "@/lib/comunicaciones";
import { AvatarUsuario } from "../avatar-usuario";
import { sincronizarChatAction, marcarLeidoAction } from "./acciones";
import { FormularioMensaje, type OpcionRef } from "./formulario-mensaje";

function horaCorta(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-ES", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function horaMensaje(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function claveDia(iso: string) {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
}

function etiquetaDia(iso: string) {
  try {
    const d = new Date(iso);
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);
    const misma = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
    if (misma(d, hoy)) return "Hoy";
    if (misma(d, ayer)) return "Ayer";
    return d.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function esMimeImagen(mime: string | null | undefined) {
  return Boolean(mime && mime.toLowerCase().startsWith("image/"));
}

function ChipsRefs({ refs, mio }: { refs: ReferenciaVista[]; mio: boolean }) {
  if (refs.length === 0) return null;
  return (
    <ul className={`flex flex-wrap gap-1 mt-1.5 ${mio ? "justify-end" : ""}`}>
      {refs.map((r) => (
        <li key={`${r.tipo}:${r.entidadId}`}>
          <Link
            href={r.href}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] border transition ${
              mio
                ? "border-white/40 bg-white/15 text-white hover:bg-white/25"
                : "border-linea bg-papel hover:border-magenta-borde text-tinta"
            }`}
          >
            <span className="opacity-70">{r.tipo === "cliente" ? "Cliente" : "Proyecto"}</span>
            <span className="font-semibold max-w-[12rem] truncate">{r.etiqueta}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function LightboxImagen({
  src,
  nombre,
  hrefDescarga,
  onCerrar,
}: {
  src: string;
  nombre: string;
  hrefDescarga: string;
  onCerrar: () => void;
}) {
  const tituloId = useId();

  useEffect(() => {
    const onTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", onTecla);
    return () => window.removeEventListener("keydown", onTecla);
  }, [onCerrar]);

  return (
    <div
      className="fixed inset-0 z-50 bg-overlay-fuerte"
      role="dialog"
      aria-modal="true"
      aria-labelledby={tituloId}
      onClick={onCerrar}
    >
      <div
        className="absolute top-0 inset-x-0 z-10 flex items-center gap-3 px-4 py-3 text-white bg-black/40 backdrop-blur-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <p id={tituloId} className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
          {nombre}
        </p>
        <a
          href={hrefDescarga}
          className="shrink-0 text-[12px] underline underline-offset-2 opacity-90 hover:opacity-100"
        >
          Descargar
        </a>
        <button
          type="button"
          onClick={onCerrar}
          className="shrink-0 text-[20px] leading-none px-1 opacity-90 hover:opacity-100"
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>
      <div
        className="absolute inset-x-0 top-14 bottom-0 p-4 min-h-0"
        onClick={onCerrar}
      >
        <div className="h-full w-full min-h-0 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={nombre}
            className="max-h-full max-w-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    </div>
  );
}

function ChipsAdjuntos({
  adjuntos,
  mio,
}: {
  adjuntos: AdjuntoVista[];
  mio: boolean;
}) {
  const [lightbox, setLightbox] = useState<AdjuntoVista | null>(null);

  if (adjuntos.length === 0) return null;

  const imagenes = adjuntos.filter((a) => esMimeImagen(a.mime));
  const otros = adjuntos.filter((a) => !esMimeImagen(a.mime));

  return (
    <>
      {imagenes.length > 0 ? (
        <ul className={`flex flex-wrap gap-1.5 mt-1.5 ${mio ? "justify-end" : ""}`}>
          {imagenes.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setLightbox(a)}
                className="block overflow-hidden rounded-lg border border-linea bg-papel hover:border-magenta-borde transition focus:outline-none focus-visible:ring-2 focus-visible:ring-anillo"
                aria-label={`Ver imagen ${a.nombre}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.href}
                  alt={a.nombre}
                  className="max-h-40 max-w-[12rem] w-auto h-auto object-cover"
                  loading="lazy"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {otros.length > 0 ? (
        <ul className={`flex flex-wrap gap-1 mt-1.5 ${mio ? "justify-end" : ""}`}>
          {otros.map((a) => (
            <li key={a.id}>
              <a
                href={`${a.href}?download=1`}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] border transition ${
                  mio
                    ? "border-white/40 bg-white/15 text-white hover:bg-white/25"
                    : "border-linea bg-papel hover:border-magenta-borde text-tinta"
                }`}
              >
                <span className="opacity-70">Archivo</span>
                <span className="font-semibold max-w-[12rem] truncate">{a.nombre}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {lightbox ? (
        <LightboxImagen
          src={lightbox.href}
          nombre={lightbox.nombre}
          hrefDescarga={`${lightbox.href}?download=1`}
          onCerrar={() => setLightbox(null)}
        />
      ) : null}
    </>
  );
}

export function PanelComunicaciones({
  conversaciones: conversacionesIniciales,
  activa: activaInicial,
  mensajes: mensajesIniciales,
  yoId,
  puedeEditar,
  opcionesRef,
  mencionInicial,
}: {
  conversaciones: ConversacionLista[];
  activa: ConversacionLista | null;
  mensajes: MensajeVista[];
  yoId: string;
  puedeEditar: boolean;
  opcionesRef: OpcionRef[];
  mencionInicial: ReferenciaVista | null;
}) {
  const fondoRef = useRef<HTMLDivElement>(null);
  const [activaId, setActivaId] = useState<string | null>(activaInicial?.id ?? null);
  const [conversaciones, setConversaciones] = useState(conversacionesIniciales);
  const [mensajes, setMensajes] = useState(mensajesIniciales);

  const activa =
    conversaciones.find((c) => c.id === activaId) ??
    (activaInicial?.id === activaId ? activaInicial : null);

  function avisarLeidos() {
    window.dispatchEvent(new Event("orbita:comms-leidos"));
  }

  function aplicarSync(
    data: { conversaciones: ConversacionLista[]; mensajes: MensajeVista[] | null },
    hiloId: string | null,
  ) {
    setConversaciones(
      data.conversaciones.map((c) =>
        hiloId && c.id === hiloId ? { ...c, noLeidos: 0 } : c,
      ),
    );
    if (data.mensajes) setMensajes(data.mensajes);
    avisarLeidos();
  }

  useEffect(() => {
    setActivaId(activaInicial?.id ?? null);
    setMensajes(mensajesIniciales);
    setConversaciones(conversacionesIniciales);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al llegar de servidor / URL
  }, [activaInicial?.id]);

  useEffect(() => {
    const el = fondoRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [activaId, mensajes.length]);

  useEffect(() => {
    let cancelado = false;

    async function latido() {
      try {
        const enChatAbierto =
          Boolean(activaId) &&
          window.location.pathname.startsWith("/comunicaciones") &&
          document.visibilityState === "visible";
        const data = await sincronizarChatAction(activaId, {
          marcarLeido: enChatAbierto,
        });
        if (cancelado) return;
        aplicarSync(data, enChatAbierto ? activaId : null);
      } catch {
        /* ignore */
      }
    }

    void latido();
    const t = window.setInterval(latido, 2000);
    return () => {
      cancelado = true;
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- latido depende de activaId
  }, [activaId]);

  function urlHilo(id: string) {
    const params = new URLSearchParams();
    params.set("c", id);
    if (mencionInicial) {
      params.set("mencionar", `${mencionInicial.tipo}:${mencionInicial.entidadId}`);
    }
    return `/comunicaciones?${params.toString()}`;
  }

  function abrirHilo(id: string) {
    if (id === activaId) return;
    setActivaId(id);
    setMensajes([]);
    setConversaciones((prev) =>
      prev.map((c) => (c.id === id ? { ...c, noLeidos: 0 } : c)),
    );
    window.history.replaceState(null, "", urlHilo(id));
    void marcarLeidoAction(id)
      .then(() => avisarLeidos())
      .catch(() => {});
  }

  function onEnviado(mensaje: MensajeVista) {
    setMensajes((prev) => (prev.some((m) => m.id === mensaje.id) ? prev : [...prev, mensaje]));
    setConversaciones((prev) => {
      const actualizada = prev.map((c) =>
        c.id === mensaje.conversacionId
          ? {
              ...c,
              ultimoCuerpo: mensaje.cuerpo.trim() || c.ultimoCuerpo,
              ultimoEn: mensaje.creadoEn,
              noLeidos: 0,
            }
          : c,
      );
      const idx = actualizada.findIndex((c) => c.id === mensaje.conversacionId);
      if (idx <= 0) return actualizada;
      const [item] = actualizada.splice(idx, 1);
      return [item!, ...actualizada];
    });
  }

  return (
    <div className="grid md:grid-cols-[260px_1fr] border border-linea-fuerte rounded-[12px] overflow-hidden bg-papel shadow-suave h-[min(720px,calc(100dvh-14rem))] min-h-[420px]">
      <aside className="border-b md:border-b-0 md:border-r border-linea overflow-y-auto max-h-[40vh] md:max-h-none md:min-h-0 bg-suave/40">
        {conversaciones.length === 0 ? (
          <p className="p-4 text-[13px] text-apagado">
            Aún no hay conversaciones. Crea un DM o un grupo.
          </p>
        ) : (
          <ul>
            {conversaciones.map((c) => {
              const sel = activaId === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => abrirHilo(c.id)}
                    className={`w-full text-left block px-3 py-2.5 border-b border-linea transition ${
                      sel ? "bg-papel border-l-2 border-l-magenta" : "hover:bg-papel/80"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-semibold truncate">{c.titulo}</p>
                        <p className="text-[12px] text-apagado truncate mt-0.5">
                          {c.ultimoCuerpo ?? (c.tipo === "grupo" ? "Grupo nuevo" : "Sin mensajes")}
                        </p>
                      </div>
                      {c.noLeidos > 0 && !sel ? (
                        <span className="shrink-0 font-mono text-[10px] bg-magenta text-white rounded-full min-w-[1.25rem] h-5 px-1.5 grid place-items-center">
                          {c.noLeidos > 99 ? "99+" : c.noLeidos}
                        </span>
                      ) : null}
                    </div>
                    <p className="etiqueta text-apagado mt-1">
                      {c.tipo === "grupo" ? "Grupo" : "Directo"}
                      {c.ultimoEn ? ` · ${horaCorta(c.ultimoEn)}` : ""}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <section className="flex flex-col min-h-0 min-w-0">
        {activa ? (
          <>
            <header className="px-4 py-3 border-b border-linea shrink-0">
              <h2 className="font-display font-bold text-[17px] tracking-tight">{activa.titulo}</h2>
              <p className="text-[12px] text-apagado">
                {activa.tipo === "grupo"
                  ? `${activa.miembroIds.length} miembros`
                  : "Mensaje directo"}
              </p>
            </header>

            <div ref={fondoRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 grid gap-2 content-start">
              {mensajes.length === 0 ? (
                <p className="text-[13px] text-apagado py-6 text-center">
                  Escribe el primer mensaje.
                </p>
              ) : (
                mensajes.map((m, i) => {
                  const mio = m.autorId === yoId;
                  const sinBurbuja =
                    (!m.cuerpo.trim() || m.cuerpo.trim() === "") &&
                    (m.referencias.length > 0 || m.adjuntos.length > 0);
                  const dia = claveDia(m.creadoEn);
                  const diaAnterior = i > 0 ? claveDia(mensajes[i - 1]!.creadoEn) : null;
                  const mostrarDia = Boolean(dia && dia !== diaAnterior);
                  const esGrupo = activa.tipo === "grupo";
                  const hora = horaMensaje(m.creadoEn);

                  return (
                    <div key={m.id} className="contents">
                      {mostrarDia ? (
                        <div className="col-span-full flex justify-center my-1">
                          <span className="rounded-full bg-suave border border-linea px-2.5 py-0.5 text-[11px] text-apagado font-medium">
                            {etiquetaDia(m.creadoEn)}
                          </span>
                        </div>
                      ) : null}
                      <div
                        className={`max-w-[85%] ${mio ? "justify-self-end" : "justify-self-start"}`}
                      >
                        {!mio && esGrupo ? (
                          <p className="text-[11px] text-apagado mb-0.5 px-1 flex items-center gap-1.5">
                            <AvatarUsuario
                              nombre={m.autorNombre}
                              avatarUrl={m.autorAvatarUrl}
                              tamano="xs"
                            />
                            <span className="truncate">{m.autorNombre}</span>
                          </p>
                        ) : null}
                        {!sinBurbuja ? (
                          <div
                            className={`rounded-2xl px-3 pt-2 pb-1.5 text-[13.5px] leading-relaxed ${
                              mio
                                ? "bg-magenta text-white rounded-br-md"
                                : "bg-suave border border-linea rounded-bl-md"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{m.cuerpo}</p>
                            <p
                              className={`text-[10px] mt-1 leading-none text-right ${
                                mio ? "text-white/70" : "text-apagado"
                              }`}
                            >
                              {hora}
                            </p>
                          </div>
                        ) : null}
                        <ChipsRefs refs={m.referencias} mio={mio} />
                        <ChipsAdjuntos adjuntos={m.adjuntos} mio={mio} />
                        {sinBurbuja ? (
                          <p
                            className={`text-[10px] text-apagado mt-0.5 px-1 ${
                              mio ? "text-right" : ""
                            }`}
                          >
                            {hora}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {puedeEditar ? (
              <FormularioMensaje
                key={`${activa.id}-${mencionInicial?.tipo ?? ""}-${mencionInicial?.entidadId ?? ""}`}
                conversacionId={activa.id}
                opciones={opcionesRef}
                mencionInicial={mencionInicial}
                onEnviado={onEnviado}
              />
            ) : (
              <p className="shrink-0 border-t border-linea p-3 text-[12px] text-apagado">
                Solo lectura: no puedes enviar mensajes.
              </p>
            )}
          </>
        ) : (
          <div className="flex-1 grid place-items-center p-6 text-center gap-2">
            <p className="text-[13.5px] text-apagado max-w-[36ch]">
              Elige una conversación o crea un mensaje directo / grupo.
            </p>
            {mencionInicial ? (
              <p className="text-[12.5px] text-tinta max-w-[40ch]">
                Vincularás <b>{mencionInicial.etiqueta}</b> al enviar el mensaje en el hilo que abras.
              </p>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
