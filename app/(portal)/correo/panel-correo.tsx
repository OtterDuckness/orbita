"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import type {
  CorreoCarpeta,
  CorreoDetalle,
  CorreoHiloDetalle,
  CorreoListaItem,
} from "@/lib/google-gmail";
import { Cabecera } from "../cabecera";
import {
  alternarEstrellaAction,
  enviarCorreoAction,
  leerHiloAction,
  listarCorreosAction,
  marcarHilosLeidoAction,
} from "./acciones";

/** HTML de Gmail en iframe para que el CSS del mail no rompa la UI. */
function CuerpoHtmlCorreo({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);

  function ajustarAlto() {
    const frame = ref.current;
    const doc = frame?.contentDocument;
    if (!frame || !doc?.body) return;
    const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
    frame.style.height = `${Math.min(Math.max(h + 12, 64), 5000)}px`;
  }

  const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"/><base target="_blank" rel="noopener"/><style>
body{margin:0;padding:0;font:13.5px/1.5 system-ui,sans-serif;color:#1a1a1a;word-wrap:break-word;overflow-wrap:anywhere;background:transparent;}
img,video{max-width:100%;height:auto;}
table{max-width:100%!important;}
a{color:#c2185b;}
</style></head><body>${html}</body></html>`;

  return (
    <iframe
      ref={ref}
      title="Cuerpo del mensaje"
      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      srcDoc={srcDoc}
      onLoad={ajustarAlto}
      className="w-full border-0 block bg-transparent"
      style={{ height: 96 }}
    />
  );
}

async function archivoABase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function fechaCorta(raw: string | null) {
  if (!raw) return "";
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw.slice(0, 22);
    return d.toLocaleString("es-ES", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return raw.slice(0, 22);
  }
}

function urlAdjunto(
  messageId: string,
  attachmentId: string,
  filename: string,
  mimeType: string,
) {
  const q = new URLSearchParams({
    messageId,
    attachmentId,
    filename,
    mime: mimeType,
  });
  return `/api/gmail/adjunto?${q}`;
}

function emailDeCabecera(raw: string): string {
  const m = raw.match(/<([^>]+)>/);
  if (m?.[1]) return m[1].trim();
  const solo = raw.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(solo) ? solo : solo;
}

function asuntoRespuesta(subject: string): string {
  const s = subject.trim();
  if (!s || s === "(Sin asunto)") return "Re: ";
  return /^re:\s/i.test(s) ? s : `Re: ${s}`;
}

function normalizarMessageId(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  return t.startsWith("<") ? t : `<${t}>`;
}

function foldTexto(s: string): string {
  return s
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export type DestinatarioSugerido = {
  nombre: string;
  email: string;
  origen: "equipo" | "cliente";
};

export function PanelCorreo({
  itemsIniciales,
  nextPageTokenInicial,
  errorInicial,
  puedeEnviar,
  correoUsuario,
  destinatariosSugeridos = [],
}: {
  itemsIniciales: CorreoListaItem[];
  nextPageTokenInicial: string | null;
  errorInicial: "sin_token" | "gmail_error" | null;
  puedeEnviar: boolean;
  correoUsuario: string;
  destinatariosSugeridos?: DestinatarioSugerido[];
}) {
  const [carpeta, setCarpeta] = useState<CorreoCarpeta>("inbox");
  const [busquedaDraft, setBusquedaDraft] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [soloNoLeidos, setSoloNoLeidos] = useState(false);
  const [conAdjuntos, setConAdjuntos] = useState(false);
  const [items, setItems] = useState(itemsIniciales);
  const [nextPageToken, setNextPageToken] = useState(nextPageTokenInicial);
  const [error, setError] = useState<string | null>(
    errorInicial === "sin_token"
      ? "Falta consentimiento Gmail. Cierra sesión y vuelve a entrar para autorizar lectura y envío."
      : errorInicial === "gmail_error"
        ? "No se pudo hablar con Gmail. Revisa que la API esté habilitada y que hayas vuelto a iniciar sesión."
        : null,
  );
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [hilo, setHilo] = useState<CorreoHiloDetalle | null>(null);
  const [componiendo, setComponiendo] = useState(false);
  const [replyThreadId, setReplyThreadId] = useState<string | null>(null);
  const [replyInReplyTo, setReplyInReplyTo] = useState<string | null>(null);
  const [replyReferences, setReplyReferences] = useState<string | null>(null);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [adjuntos, setAdjuntos] = useState<File[]>([]);
  const [avisoEnvio, setAvisoEnvio] = useState<string | null>(null);
  const [paraAbierto, setParaAbierto] = useState(false);
  const [seleccionIds, setSeleccionIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  /** Descarta respuestas viejas si el usuario cambia de hilo rápido. */
  const abrirSeq = useRef(0);
  const paraBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listaRef = useRef<HTMLUListElement>(null);

  useLayoutEffect(() => {
    if (!seleccionado || componiendo) return;
    const lista = listaRef.current;
    if (!lista) return;

    const alinear = () => {
      const li = lista.querySelector(
        `[data-hilo="${CSS.escape(seleccionado)}"]`,
      );
      if (!(li instanceof HTMLElement)) return;
      const listaRect = lista.getBoundingClientRect();
      const liRect = li.getBoundingClientRect();
      const visible =
        liRect.top >= listaRect.top - 1 &&
        liRect.bottom <= listaRect.bottom + 1;
      if (visible) return;
      const delta = liRect.top - listaRect.top;
      const target =
        lista.scrollTop + delta - (lista.clientHeight - li.offsetHeight) / 2;
      lista.scrollTop = Math.max(0, target);
    };

    alinear();
    const id = requestAnimationFrame(alinear);
    return () => cancelAnimationFrame(id);
  }, [seleccionado, componiendo]);

  const qPara = foldTexto(to);
  const sugerenciasPara =
    paraAbierto && qPara.length >= 1
      ? destinatariosSugeridos
          .filter(
            (d) =>
              foldTexto(d.nombre).includes(qPara) ||
              foldTexto(d.email).includes(qPara),
          )
          .slice(0, 8)
      : [];

  function elegirDestinatario(d: DestinatarioSugerido) {
    setTo(d.email);
    setParaAbierto(false);
  }

  const seleccionSet = new Set(seleccionIds);
  const todosSeleccionados =
    items.length > 0 && items.every((m) => seleccionSet.has(m.id));
  const algunosSeleccionados = seleccionIds.length > 0;

  function alternarSeleccion(id: string) {
    setSeleccionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function alternarSeleccionarTodos() {
    if (todosSeleccionados) setSeleccionIds([]);
    else setSeleccionIds(items.map((m) => m.id));
  }

  function marcarSeleccionLeido(leido: boolean) {
    if (seleccionIds.length === 0) return;
    const ids = [...seleccionIds];
    startTransition(async () => {
      const r = await marcarHilosLeidoAction(ids, leido);
      if (!r.ok) {
        setError(
          r.detalle?.includes("403")
            ? "No se pudo cambiar el estado leído (403). Re-login con gmail.modify."
            : r.detalle || "No se pudo actualizar el estado leído.",
        );
        return;
      }
      setItems((prev) =>
        prev.map((m) =>
          r.okIds.includes(m.id) ? { ...m, unread: !leido } : m,
        ),
      );
      setHilo((prev) =>
        prev && r.okIds.includes(prev.threadId)
          ? {
              ...prev,
              unread: !leido,
              messages: prev.messages.map((msg) => ({ ...msg, unread: !leido })),
            }
          : prev,
      );
      setSeleccionIds((prev) => prev.filter((id) => !r.okIds.includes(id)));
      if (r.fallos.length > 0) {
        setError(
          `Actualizados ${r.okIds.length}; fallaron ${r.fallos.length}.`,
        );
      }
    });
  }

  function cargarLista(opts?: {
    carpeta?: CorreoCarpeta;
    busqueda?: string;
    soloNoLeidos?: boolean;
    conAdjuntos?: boolean;
    pageToken?: string;
    append?: boolean;
  }) {
    const c = opts?.carpeta ?? carpeta;
    const b = opts?.busqueda ?? busqueda;
    const unread = opts?.soloNoLeidos ?? soloNoLeidos;
    const att = opts?.conAdjuntos ?? conAdjuntos;
    startTransition(async () => {
      setError(null);
      const r = await listarCorreosAction({
        carpeta: c,
        busqueda: b || undefined,
        soloNoLeidos: unread,
        conAdjuntos: att,
        pageToken: opts?.pageToken,
      });
      if (!r.ok) {
        setError(
          r.motivo === "sin_token"
            ? "Falta consentimiento Gmail. Cierra sesión y vuelve a entrar."
            : "Error al listar conversaciones.",
        );
        return;
      }
      if (opts?.append) {
        setItems((prev) => {
          const seen = new Set(prev.map((i) => i.id));
          return [...prev, ...r.items.filter((i) => !seen.has(i.id))];
        });
      } else {
        setItems(r.items);
        setSeleccionIds([]);
      }
      setNextPageToken(r.nextPageToken);
    });
  }

  function resetVistaLista() {
    setSeleccionado(null);
    setHilo(null);
    setComponiendo(false);
    setAvisoEnvio(null);
    setSeleccionIds([]);
    setItems([]);
    setNextPageToken(null);
  }

  function cambiarCarpeta(siguiente: CorreoCarpeta) {
    if (siguiente === carpeta) return;
    setCarpeta(siguiente);
    resetVistaLista();
    cargarLista({ carpeta: siguiente });
  }

  function aplicarBusqueda() {
    const texto = busquedaDraft.trim();
    setBusqueda(texto);
    resetVistaLista();
    cargarLista({ busqueda: texto });
  }

  function limpiarBusqueda() {
    setBusquedaDraft("");
    setBusqueda("");
    resetVistaLista();
    cargarLista({ busqueda: "" });
  }

  function toggleFiltro(campo: "soloNoLeidos" | "conAdjuntos") {
    const nextUnread = campo === "soloNoLeidos" ? !soloNoLeidos : soloNoLeidos;
    const nextAtt = campo === "conAdjuntos" ? !conAdjuntos : conAdjuntos;
    if (campo === "soloNoLeidos") setSoloNoLeidos(nextUnread);
    else setConAdjuntos(nextAtt);
    resetVistaLista();
    cargarLista({ soloNoLeidos: nextUnread, conAdjuntos: nextAtt });
  }

  function refrescar() {
    cargarLista();
  }

  function cargarMas() {
    if (!nextPageToken) return;
    cargarLista({ pageToken: nextPageToken, append: true });
  }

  function abrir(threadId: string) {
    const seq = ++abrirSeq.current;
    setComponiendo(false);
    setSeleccionado(threadId);
    setHilo(null);
    setError(null);
    setAvisoEnvio(null);
    startTransition(async () => {
      const r = await leerHiloAction(threadId);
      if (seq !== abrirSeq.current) return;
      if (!r.ok) {
        setError("No se pudo abrir la conversación.");
        return;
      }
      setHilo(r.hilo);
      if (r.avisoSync) setError(r.avisoSync);
      if (r.marcadoLeido) {
        setItems((prev) =>
          prev.map((m) => (m.id === threadId ? { ...m, unread: false } : m)),
        );
      }
    });
  }

  function responderA(msg: CorreoDetalle) {
    if (!hilo || !puedeEnviar) return;
    const cita = msg.bodyText?.trim() || msg.snippet?.trim() || "";
    const inReplyTo = msg.messageIdHeader
      ? normalizarMessageId(msg.messageIdHeader)
      : "";
    const prevRefs = hilo.messages
      .map((m) => (m.messageIdHeader ? normalizarMessageId(m.messageIdHeader) : ""))
      .filter(Boolean);
    const references = [...new Set([...prevRefs, inReplyTo].filter(Boolean))].join(" ");

    setTo(emailDeCabecera(msg.from));
    setSubject(asuntoRespuesta(hilo.subject || msg.subject));
    setBody(
      cita
        ? `\n\n---\nEl ${fechaCorta(msg.date)}, ${msg.from} escribió:\n\n${cita}`
        : "",
    );
    setReplyThreadId(hilo.threadId);
    setReplyInReplyTo(inReplyTo || null);
    setReplyReferences(references || null);
    setAdjuntos([]);
    setAvisoEnvio(null);
    setError(null);
    setComponiendo(true);
  }

  function responderUltimo() {
    if (!hilo?.messages.length) return;
    responderA(hilo.messages[hilo.messages.length - 1]!);
  }

  function alternarEstrella(threadId: string, starredActual: boolean) {
    const siguiente = !starredActual;
    startTransition(async () => {
      const r = await alternarEstrellaAction(threadId, siguiente);
      if (!r.ok) {
        setError(
          r.detalle?.includes("403")
            ? "No se pudo cambiar la estrella (403). Re-login con gmail.modify."
            : "No se pudo sincronizar la estrella con Gmail.",
        );
        return;
      }
      setHilo((prev) =>
        prev && prev.threadId === threadId
          ? {
              ...prev,
              starred: r.starred,
              messages: prev.messages.map((m) => ({ ...m, starred: r.starred })),
            }
          : prev,
      );
      setItems((prev) =>
        prev.map((m) => (m.id === threadId ? { ...m, starred: r.starred } : m)),
      );
    });
  }

  function enviar() {
    setAvisoEnvio(null);
    startTransition(async () => {
      let adjuntosPayload: { filename: string; mimeType: string; contentBase64: string }[] = [];
      try {
        adjuntosPayload = await Promise.all(
          adjuntos.slice(0, 5).map(async (f) => ({
            filename: f.name,
            mimeType: f.type || "application/octet-stream",
            contentBase64: await archivoABase64(f),
          })),
        );
      } catch {
        setAvisoEnvio("No se pudieron leer los adjuntos.");
        return;
      }
      const r = await enviarCorreoAction({
        to,
        subject,
        body,
        adjuntos: adjuntosPayload,
        threadId: replyThreadId ?? undefined,
        inReplyTo: replyInReplyTo ?? undefined,
        references: replyReferences ?? undefined,
      });
      if (!r.ok) {
        const map: Record<string, string> = {
          sin_permiso: "No tienes permiso para enviar.",
          modo_pruebas: "Envío desactivado en modo pruebas.",
          sin_token: "Falta consentimiento Gmail. Re-login.",
          falta_dato: "Indica destinatario y cuerpo o adjuntos.",
          apartado_off: "El apartado Correo está apagado.",
          gmail_error: r.detalle?.includes("grandes")
            ? r.detalle
            : "Gmail rechazó el envío.",
        };
        setAvisoEnvio(map[r.motivo] ?? "Error al enviar.");
        return;
      }
      setAvisoEnvio("Enviado.");
      setTo("");
      setSubject("");
      setBody("");
      setAdjuntos([]);
      const tid = r.threadId || replyThreadId;
      setReplyThreadId(null);
      setReplyInReplyTo(null);
      setReplyReferences(null);
      setComponiendo(false);
      if (tid) {
        setSeleccionado(tid);
        const re = await leerHiloAction(tid);
        if (re.ok) {
          setHilo(re.hilo);
          setItems((prev) => {
            const existe = prev.some((i) => i.id === tid);
            if (existe) {
              return prev.map((i) =>
                i.id === tid
                  ? {
                      ...i,
                      messageCount: re.hilo.messages.length,
                      snippet: re.hilo.messages.at(-1)?.snippet ?? i.snippet,
                      unread: false,
                    }
                  : i,
              );
            }
            return prev;
          });
          return;
        }
      }
      setSeleccionado(null);
      setHilo(null);
      setCarpeta("sent");
      setItems([]);
      setNextPageToken(null);
      cargarLista({ carpeta: "sent" });
    });
  }

  const panelAbierto = componiendo || seleccionado !== null;

  function cerrarPanel() {
    abrirSeq.current += 1;
    setSeleccionado(null);
    setHilo(null);
    setComponiendo(false);
    setAdjuntos([]);
    setReplyThreadId(null);
    setReplyInReplyTo(null);
    setReplyReferences(null);
    setAvisoEnvio(null);
    setError(null);
  }

  function empezarRedaccion() {
    setComponiendo(true);
    setSeleccionado(null);
    setHilo(null);
    setAvisoEnvio(null);
    setAdjuntos([]);
    setTo("");
    setSubject("");
    setBody("");
    setReplyThreadId(null);
    setReplyInReplyTo(null);
    setReplyReferences(null);
    setError(null);
  }

  return (
    <>
      <Cabecera
        etiqueta="Gmail"
        titulo="Correo"
        texto="Conversaciones de Gmail (hilos): buscar, filtrar, leer, adjuntos y responder. Tras ampliar permisos de Google, cierra sesión y vuelve a entrar."
        sello={correoUsuario}
        acciones={
          puedeEnviar ? (
            <button type="button" className="boton" onClick={empezarRedaccion}>
              Redactar
            </button>
          ) : undefined
        }
      />
    <div
      className={
        panelAbierto
          ? "grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-4 min-h-[28rem]"
          : "min-h-[28rem]"
      }
    >
      <section
        className={`border border-linea rounded-lg bg-papel flex flex-col overflow-hidden min-h-[22rem] ${
          panelAbierto ? "max-h-[70vh]" : "max-h-[min(78vh,calc(100vh-11rem))]"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-linea">
          <div className="flex items-center gap-1">
            {(
              [
                { id: "inbox", etiqueta: "Bandeja" },
                { id: "sent", etiqueta: "Enviados" },
              ] as const
            ).map((tab) => {
              const activo = carpeta === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => cambiarCarpeta(tab.id)}
                  disabled={pending && !activo}
                  className={`text-[12px] px-2 py-1 rounded transition ${
                    activo
                      ? "font-semibold text-magenta-texto bg-magenta-suave"
                      : "text-apagado hover:text-tinta"
                  }`}
                >
                  {tab.etiqueta}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={refrescar}
            disabled={pending}
            className="text-[11.5px] text-apagado hover:text-tinta disabled:opacity-50"
          >
            Actualizar
          </button>
        </div>
        <div className="px-3 py-2 border-b border-linea space-y-2">
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              aplicarBusqueda();
            }}
          >
            <input
              value={busquedaDraft}
              onChange={(e) => setBusquedaDraft(e.target.value)}
              placeholder="Buscar nombre, email, asunto…"
              className="min-w-0 flex-1 rounded border border-linea bg-transparent px-2 py-1.5 text-[12.5px]"
              aria-label="Buscar correos"
            />
            <button
              type="submit"
              disabled={pending}
              className="shrink-0 rounded bg-magenta text-white text-[11.5px] font-semibold px-2.5 py-1.5 disabled:opacity-50"
            >
              Buscar
            </button>
            {busqueda ? (
              <button
                type="button"
                onClick={limpiarBusqueda}
                disabled={pending}
                className="shrink-0 text-[11.5px] text-apagado hover:text-tinta px-1"
              >
                Limpiar
              </button>
            ) : null}
          </form>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => toggleFiltro("soloNoLeidos")}
              disabled={pending}
              className={`text-[11px] px-2 py-0.5 rounded-full border transition ${
                soloNoLeidos
                  ? "border-novedad bg-novedad/20 text-tinta font-semibold"
                  : "border-linea text-apagado hover:border-magenta-borde"
              }`}
            >
              No leídos
            </button>
            <button
              type="button"
              onClick={() => toggleFiltro("conAdjuntos")}
              disabled={pending}
              className={`text-[11px] px-2 py-0.5 rounded-full border transition ${
                conAdjuntos
                  ? "border-magenta-borde bg-magenta-suave text-magenta-texto font-semibold"
                  : "border-linea text-apagado hover:border-magenta-borde"
              }`}
            >
              Con adjuntos
            </button>
          </div>
        </div>
        {items.length > 0 ? (
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-linea text-[11.5px]">
            <label className="inline-flex items-center gap-1.5 text-apagado cursor-pointer select-none">
              <input
                type="checkbox"
                checked={todosSeleccionados}
                ref={(el) => {
                  if (el) {
                    el.indeterminate =
                      algunosSeleccionados && !todosSeleccionados;
                  }
                }}
                onChange={alternarSeleccionarTodos}
                disabled={pending}
                aria-label="Seleccionar todos"
              />
              {algunosSeleccionados
                ? `${seleccionIds.length} seleccionados`
                : "Seleccionar"}
            </label>
            {algunosSeleccionados ? (
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => marcarSeleccionLeido(true)}
                  disabled={pending}
                  className="text-magenta-texto font-semibold hover:underline disabled:opacity-50"
                >
                  Marcar leídos
                </button>
                <button
                  type="button"
                  onClick={() => marcarSeleccionLeido(false)}
                  disabled={pending}
                  className="text-magenta-texto font-semibold hover:underline disabled:opacity-50"
                >
                  Marcar no leídos
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        {!panelAbierto && error ? (
          <div className="px-3 py-2 text-[13px] text-mal border-b border-linea">{error}</div>
        ) : null}
        <ul
          ref={listaRef}
          className="overflow-y-auto [overflow-anchor:none] flex-1 min-h-0 divide-y divide-linea"
        >
          {items.length === 0 && !error ? (
            <li className="px-3 py-6 text-[13px] text-apagado text-center">
              {pending ? "Cargando…" : "No hay conversaciones."}
            </li>
          ) : null}
          {items.map((m) => {
            const activo = seleccionado === m.id && !componiendo;
            const marcado = seleccionSet.has(m.id);
            const persona =
              carpeta === "sent"
                ? m.to || "(Sin destinatario)"
                : m.from || "(Desconocido)";
            return (
              <li key={m.id} data-hilo={m.id}>
                <div
                  className={`flex items-stretch border-l-2 transition ${
                    m.unread
                      ? activo
                        ? "bg-novedad/25 border-l-magenta"
                        : "bg-novedad/20 border-l-novedad hover:bg-[color-mix(in_srgb,var(--novedad)_22%,var(--fila-hover))]"
                      : activo
                        ? "bg-magenta-suave border-l-magenta"
                        : "border-l-transparent hover:bg-fila-hover"
                  }`}
                >
                  <label
                    className="shrink-0 self-center pl-2 pr-0.5 py-2.5 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() => alternarSeleccion(m.id)}
                      disabled={pending}
                      aria-label={`Seleccionar ${m.subject}`}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      alternarEstrella(m.threadId, m.starred);
                    }}
                    disabled={pending}
                    title={m.starred ? "Quitar estrella" : "Marcar con estrella"}
                    aria-label={m.starred ? "Quitar estrella" : "Marcar con estrella"}
                    aria-pressed={m.starred}
                    className={`shrink-0 self-center pl-1 pr-0.5 py-2.5 text-[14px] leading-none disabled:opacity-50 ${
                      m.starred
                        ? "text-novedad"
                        : "text-apagado/70 hover:text-novedad"
                    }`}
                  >
                    {m.starred ? "★" : "☆"}
                  </button>
                  <button
                    type="button"
                    onClick={() => abrir(m.id)}
                    className="min-w-0 flex-1 text-left pr-3 pl-1.5 py-2.5"
                  >
                    {panelAbierto ? (
                      <>
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className={`text-[12.5px] truncate ${
                              m.unread
                                ? "font-bold text-tinta"
                                : "font-medium text-tinta"
                            }`}
                          >
                            {persona}
                          </span>
                          <span className="text-[10.5px] text-apagado shrink-0 flex items-center gap-1.5">
                            {m.messageCount > 1 ? (
                              <span className="font-mono text-[10px] rounded bg-suave px-1">
                                {m.messageCount}
                              </span>
                            ) : null}
                            {fechaCorta(m.date)}
                          </span>
                        </div>
                        <div
                          className={`text-[12.5px] truncate mt-0.5 ${
                            m.unread ? "font-semibold" : ""
                          }`}
                        >
                          {m.subject}
                        </div>
                        <div className="text-[11.5px] text-apagado truncate mt-0.5">
                          {m.snippet}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-baseline gap-3 min-w-0">
                        <span
                          className={`shrink-0 w-[11rem] truncate text-[12.5px] ${
                            m.unread
                              ? "font-bold text-tinta"
                              : "font-medium text-tinta"
                          }`}
                        >
                          {persona}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12.5px]">
                          <span className={m.unread ? "font-semibold" : ""}>
                            {m.subject}
                          </span>
                          {m.snippet ? (
                            <span className="text-apagado">
                              {" — "}
                              {m.snippet}
                            </span>
                          ) : null}
                        </span>
                        <span className="text-[10.5px] text-apagado shrink-0 flex items-center gap-1.5">
                          {m.messageCount > 1 ? (
                            <span className="font-mono text-[10px] rounded bg-suave px-1">
                              {m.messageCount}
                            </span>
                          ) : null}
                          {fechaCorta(m.date)}
                        </span>
                      </div>
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        {nextPageToken ? (
          <button
            type="button"
            onClick={cargarMas}
            disabled={pending}
            className="border-t border-linea px-3 py-2 text-[12px] text-magenta-texto hover:underline disabled:opacity-50"
          >
            Cargar más
          </button>
        ) : null}
      </section>

      {panelAbierto ? (
      <section className="border border-linea rounded-lg bg-papel min-h-[22rem] max-h-[70vh] overflow-y-auto">
        {error ? (
          <div className="p-4 text-[13.5px] text-mal">{error}</div>
        ) : null}

        {componiendo && puedeEnviar ? (
          <div className="p-4 space-y-3">
            <p className="text-[12.5px] font-semibold">
              {replyThreadId ? "Responder en la conversación" : "Nuevo mensaje"}
            </p>
            <p className="text-[11.5px] text-apagado">Se enviará como {correoUsuario}</p>
            <label className="block relative">
              <span className="text-[11px] text-apagado">Para</span>
              <input
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setParaAbierto(true);
                }}
                onFocus={() => setParaAbierto(true)}
                onBlur={() => {
                  if (paraBlurTimer.current) clearTimeout(paraBlurTimer.current);
                  paraBlurTimer.current = setTimeout(() => setParaAbierto(false), 120);
                }}
                className="mt-0.5 w-full rounded border border-linea bg-transparent px-2.5 py-1.5 text-[13px]"
                placeholder="Nombre o email (equipo / clientes)"
                autoComplete="off"
                aria-autocomplete="list"
                aria-expanded={sugerenciasPara.length > 0}
              />
              {sugerenciasPara.length > 0 ? (
                <ul
                  role="listbox"
                  className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-lg border border-linea bg-papel shadow-suave"
                >
                  {sugerenciasPara.map((d) => (
                    <li key={`${d.origen}:${d.email}`}>
                      <button
                        type="button"
                        role="option"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => elegirDestinatario(d)}
                        className="w-full text-left px-2.5 py-1.5 hover:bg-fila-hover transition"
                      >
                        <span className="block text-[13px] font-medium text-tinta truncate">
                          {d.nombre}
                        </span>
                        <span className="block text-[11.5px] text-apagado truncate">
                          {d.email}
                          <span className="text-apagado/80">
                            {" · "}
                            {d.origen === "equipo" ? "equipo" : "cliente"}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </label>
            <label className="block">
              <span className="text-[11px] text-apagado">Asunto</span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-0.5 w-full rounded border border-linea bg-transparent px-2.5 py-1.5 text-[13px]"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-apagado">Mensaje</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="mt-0.5 w-full rounded border border-linea bg-transparent px-2.5 py-1.5 text-[13px] font-mono"
              />
            </label>
            <div>
              <label className="block">
                <span className="text-[11px] text-apagado">Adjuntar archivos</span>
                <input
                  type="file"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []).slice(0, 5);
                    setAdjuntos(files);
                    e.target.value = "";
                  }}
                  className="mt-1 block w-full text-[12px] text-apagado file:mr-2 file:rounded file:border-0 file:bg-magenta file:text-white file:text-[12px] file:font-semibold file:px-3 file:py-1.5"
                />
              </label>
              {adjuntos.length > 0 ? (
                <ul className="mt-1.5 space-y-0.5">
                  {adjuntos.map((f) => (
                    <li key={`${f.name}-${f.size}`} className="flex items-center gap-2 text-[12px]">
                      <span className="truncate min-w-0">{f.name}</span>
                      <span className="text-apagado shrink-0">
                        ({Math.max(1, Math.round(f.size / 1024))} KB)
                      </span>
                      <button
                        type="button"
                        onClick={() => setAdjuntos((prev) => prev.filter((x) => x !== f))}
                        className="text-apagado hover:text-mal shrink-0"
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-apagado mt-1">Máx. 5 archivos / ~18 MB en total.</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={enviar}
                disabled={pending}
                className="rounded bg-magenta text-white text-[12.5px] font-semibold px-3.5 py-1.5 disabled:opacity-50"
              >
                Enviar
              </button>
              <button
                type="button"
                onClick={() => {
                  setComponiendo(false);
                  setAdjuntos([]);
                  setReplyThreadId(null);
                  setReplyInReplyTo(null);
                  setReplyReferences(null);
                }}
                className="text-[12px] text-apagado hover:text-tinta"
              >
                Cancelar
              </button>
              {avisoEnvio ? (
                <span className="text-[12px] text-apagado">{avisoEnvio}</span>
              ) : null}
            </div>
          </div>
        ) : null}

        {!componiendo && hilo ? (
          <article key={hilo.threadId} className="p-4">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0 flex items-start gap-1.5">
                <button
                  type="button"
                  onClick={cerrarPanel}
                  className="shrink-0 mt-1 text-[12px] text-apagado hover:text-tinta"
                  title="Volver a la lista"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => alternarEstrella(hilo.threadId, hilo.starred)}
                  disabled={pending}
                  title={hilo.starred ? "Quitar estrella" : "Marcar con estrella"}
                  aria-label={hilo.starred ? "Quitar estrella" : "Marcar con estrella"}
                  aria-pressed={hilo.starred}
                  className={`shrink-0 mt-0.5 text-[18px] leading-none disabled:opacity-50 ${
                    hilo.starred
                      ? "text-novedad"
                      : "text-apagado/70 hover:text-novedad"
                  }`}
                >
                  {hilo.starred ? "★" : "☆"}
                </button>
                <div className="min-w-0">
                  <h2 className="font-display font-bold text-[18px] tracking-tight">
                    {hilo.subject}
                  </h2>
                  <p className="text-[11.5px] text-apagado mt-0.5">
                    {hilo.messages.length} mensaje
                    {hilo.messages.length === 1 ? "" : "s"} en la conversación
                  </p>
                </div>
              </div>
              {puedeEnviar ? (
                <button
                  type="button"
                  onClick={responderUltimo}
                  className="shrink-0 rounded-lg bg-magenta text-white text-[13px] font-semibold px-4 py-2 shadow-suave hover:opacity-92 transition"
                >
                  Responder
                </button>
              ) : null}
            </div>

            <div className="space-y-4">
              {hilo.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg border border-linea p-3 ${
                    msg.unread ? "bg-novedad/10" : "bg-suave/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <dl className="text-[12.5px] space-y-0.5 text-apagado min-w-0">
                      <div>
                        <span className="font-semibold text-tinta">De: </span>
                        {msg.from}
                      </div>
                      <div>
                        <span className="font-semibold text-tinta">Para: </span>
                        {msg.to || "—"}
                      </div>
                      {msg.cc ? (
                        <div>
                          <span className="font-semibold text-tinta">Cc: </span>
                          {msg.cc}
                        </div>
                      ) : null}
                      <div>
                        <span className="font-semibold text-tinta">Fecha: </span>
                        {fechaCorta(msg.date)}
                      </div>
                    </dl>
                    {puedeEnviar ? (
                      <button
                        type="button"
                        onClick={() => responderA(msg)}
                        className="shrink-0 text-[11.5px] font-semibold text-magenta-texto hover:underline"
                      >
                        Responder
                      </button>
                    ) : null}
                  </div>

                  {msg.attachments.length > 0 ? (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {msg.attachments.map((a) => (
                        <li key={a.attachmentId}>
                          <a
                            href={urlAdjunto(msg.id, a.attachmentId, a.filename, a.mimeType)}
                            className="inline-flex items-center gap-1 rounded border border-linea px-2 py-1 text-[11.5px] hover:border-magenta-borde bg-papel"
                            download
                          >
                            {a.filename}
                            {a.size > 0 ? (
                              <span className="text-apagado">
                                ({Math.max(1, Math.round(a.size / 1024))} KB)
                              </span>
                            ) : null}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-3 border-t border-linea pt-3 overflow-hidden">
                    {msg.bodyHtml ? (
                      <CuerpoHtmlCorreo html={msg.bodyHtml} />
                    ) : (
                      <pre className="whitespace-pre-wrap text-[13px] font-mono leading-relaxed">
                        {msg.bodyText || msg.snippet || "(Sin cuerpo)"}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </article>
        ) : null}

        {!componiendo && !hilo && !error ? (
          <div className="p-6 text-[13.5px] text-apagado">
            {pending ? "Cargando…" : "Elige una conversación o redacta un mensaje nuevo."}
          </div>
        ) : null}

        {!componiendo && avisoEnvio ? (
          <div className="px-4 pb-4 text-[12.5px] text-apagado">{avisoEnvio}</div>
        ) : null}
      </section>
      ) : null}
    </div>
    </>
  );
}
