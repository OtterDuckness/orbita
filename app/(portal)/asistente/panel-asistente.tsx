"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversacionIa, MensajeIa } from "@/lib/asistente/store";
import type { PersonaEquipo, TipoProyecto } from "@/lib/clientes-mock";
import {
  ConfirmacionesLightbox,
  type ConfirmacionPendienteUi,
} from "./confirmaciones-lightbox";
import { MensajeMd } from "./mensaje-md";

type AccionConfirmacion =
  | "confirmar"
  | "cancelar"
  | "confirmar_todas"
  | "cancelar_todas";

export function PanelAsistente({
  conversaciones,
  conversacionId,
  mensajes: mensajesIniciales,
  confirmacionesPendientes: confirmacionesIniciales = [],
  equipo = [],
  tipos = [],
  modoPruebas = false,
}: {
  conversaciones: ConversacionIa[];
  conversacionId: string | null;
  mensajes: MensajeIa[];
  confirmacionesPendientes?: ConfirmacionPendienteUi[];
  equipo?: PersonaEquipo[];
  tipos?: TipoProyecto[];
  modoPruebas?: boolean;
}) {
  const router = useRouter();
  // useState (no useTransition): un fetch largo en startTransition bloquea
  // las navegaciones del App Router hasta que termina.
  const [pending, setPending] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState(mensajesIniciales);
  const [cId, setCId] = useState(conversacionId);
  const [confirmaciones, setConfirmaciones] = useState<ConfirmacionPendienteUi[]>(
    confirmacionesIniciales,
  );
  const [lightboxAbierto, setLightboxAbierto] = useState(
    confirmacionesIniciales.length > 0,
  );
  const finRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const firmaPendientes = confirmaciones
    .map((p) => `${p.tool}:${p.clave}`)
    .sort()
    .join("|");

  // Al cambiar de chat, sincronizar todo (incluido pendiente vacío).
  useEffect(() => {
    setCId(conversacionId);
    setMensajes(mensajesIniciales);
    setConfirmaciones(confirmacionesIniciales);
    setLightboxAbierto(confirmacionesIniciales.length > 0);
    // Solo conversacionId: un refresh RSC stale no debe borrar botones del API.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intencional
  }, [conversacionId]);

  // Refresh / nueva data del servidor: mensajes siempre; pendientes solo si hay.
  useEffect(() => {
    setMensajes(mensajesIniciales);
    if (confirmacionesIniciales.length > 0) {
      setConfirmaciones(confirmacionesIniciales);
      setLightboxAbierto(true);
    }
  }, [mensajesIniciales, confirmacionesIniciales]);

  // Cada vez que cambia el set de retos, abrir el lightbox (no quedarse solo con ¿Confirmas? en el chat).
  useEffect(() => {
    if (confirmaciones.length > 0) setLightboxAbierto(true);
  }, [firmaPendientes, confirmaciones.length]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes, pending, error, conversacionId, confirmaciones]);

  useEffect(() => {
    if (!pending) inputRef.current?.focus();
  }, [pending]);

  function manejarErrorApi(data: {
    error?: string;
    detalle?: string;
    usado?: number;
    tope?: number;
  }) {
    if (data.error === "sin_api_key") {
      setError("Falta ANTHROPIC_API_KEY en el entorno.");
    } else if (data.error === "tope_gasto") {
      const usado =
        typeof data.usado === "number" ? `$${data.usado.toFixed(4)}` : "—";
      const tope =
        typeof data.tope === "number" ? `$${data.tope.toFixed(2)}` : "—";
      setError(
        `Tope de gasto del mes alcanzado (${usado} / ${tope} USD estimado). Si necesitas más, pide a un admin subir el tope.`,
      );
    } else if (data.error === "sin_confirmacion_pendiente") {
      setError("Ya no hay nada pendiente de confirmar.");
      setConfirmaciones([]);
      setLightboxAbierto(false);
    } else if (data.error === "agente_desactivado") {
      setError("El asistente está desactivado por un administrador.");
    } else if (data.error === "fallo_agente" && data.detalle) {
      setError(`fallo_agente: ${data.detalle}`);
    } else {
      setError(data.error ?? "Error al contactar el asistente");
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const mensaje = texto.trim();
    if (!mensaje || pending) return;
    setError(null);
    setTexto("");
    setConfirmaciones([]);
    setLightboxAbierto(false);
    setPending(true);
    queueMicrotask(() => inputRef.current?.focus());
    setMensajes((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        conversacionId: cId ?? "",
        rol: "user",
        contenido: mensaje,
        toolName: null,
        creadoEn: new Date().toISOString(),
      },
    ]);

    try {
      const res = await fetch("/api/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversacionId: cId, mensaje }),
      });
      const data = (await res.json()) as {
        conversacionId?: string;
        respuesta?: string;
        error?: string;
        detalle?: string;
        usado?: number;
        tope?: number;
        confirmacionesPendientes?: ConfirmacionPendienteUi[];
        /** @deprecated */
        confirmacionPendiente?: ConfirmacionPendienteUi | null;
      };
      if (!res.ok) {
        manejarErrorApi(data);
        return;
      }
      const nuevaId = data.conversacionId ?? cId;
      setMensajes((prev) => [
        ...prev,
        {
          id: `local-a-${Date.now()}`,
          conversacionId: nuevaId ?? "",
          rol: "assistant",
          contenido: data.respuesta ?? "",
          toolName: null,
          creadoEn: new Date().toISOString(),
        },
      ]);
      const pend =
        data.confirmacionesPendientes ??
        (data.confirmacionPendiente ? [data.confirmacionPendiente] : []);
      setConfirmaciones(pend);
      setLightboxAbierto(pend.length > 0);
      if (nuevaId && nuevaId !== cId) {
        setCId(nuevaId);
        router.replace(`/asistente?c=${nuevaId}`);
      }
      router.refresh();
    } catch {
      setError("No se pudo enviar el mensaje.");
    } finally {
      setPending(false);
    }
  }

  const responderConfirmacion = useCallback(
    async (
      accion: AccionConfirmacion,
      item?: ConfirmacionPendienteUi,
      argsEditados?: Record<string, unknown>,
    ) => {
      if (!cId || pending) return;
      if (
        (accion === "confirmar" || accion === "cancelar") &&
        !item &&
        confirmaciones.length !== 1
      ) {
        return;
      }
      setError(null);
      setPending(true);

      const textoUser =
        accion === "confirmar_todas"
          ? "Confirmar todas"
          : accion === "cancelar_todas"
            ? "Cancelar todas"
            : accion === "confirmar"
              ? "Confirmar"
              : "Cancelar";
      setMensajes((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          conversacionId: cId,
          rol: "user",
          contenido: textoUser,
          toolName: null,
          creadoEn: new Date().toISOString(),
        },
      ]);

      try {
        const res = await fetch("/api/asistente", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversacionId: cId,
            accion,
            tool: item?.tool,
            clave: item?.clave,
            ...(accion === "confirmar" && argsEditados
              ? { argsEditados }
              : {}),
          }),
        });
        const data = (await res.json()) as {
          respuesta?: string;
          error?: string;
          detalle?: string;
          confirmacionesPendientes?: ConfirmacionPendienteUi[];
        };
        if (!res.ok) {
          manejarErrorApi(data);
          return;
        }
        setMensajes((prev) => [
          ...prev,
          {
            id: `local-a-${Date.now()}`,
            conversacionId: cId,
            rol: "assistant",
            contenido: data.respuesta ?? "",
            toolName: null,
            creadoEn: new Date().toISOString(),
          },
        ]);
        const rest = data.confirmacionesPendientes ?? [];
        setConfirmaciones(rest);
        setLightboxAbierto(rest.length > 0);
        router.refresh();
      } catch {
        setError("No se pudo procesar la confirmación.");
      } finally {
        setPending(false);
      }
    },
    [cId, pending, confirmaciones.length, router],
  );

  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-4 min-h-[60vh]">
      <aside className="min-w-0 rounded-[10px] border border-linea p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-semibold text-apagado uppercase tracking-wide">
            {modoPruebas ? "Chats (pruebas)" : "Chats"}
          </p>
          <Link
            href="/asistente?nuevo=1"
            className="text-[12px] text-magenta-texto hover:underline shrink-0"
            onClick={() => {
              setCId(null);
              setMensajes([]);
              setConfirmaciones([]);
              setLightboxAbierto(false);
            }}
          >
            Nuevo
          </Link>
        </div>
        <ul className="grid gap-1 min-w-0 overflow-y-auto overflow-x-hidden max-h-[50vh]">
          {conversaciones.map((c) => (
            <li key={c.id} className="min-w-0">
              <Link
                href={`/asistente?c=${c.id}`}
                title={c.titulo}
                className={`block min-w-0 rounded-md px-2 py-1.5 text-[13px] truncate ${
                  c.id === cId ? "bg-suave font-medium" : "hover:bg-suave/60"
                }`}
              >
                {c.titulo}
              </Link>
            </li>
          ))}
          {conversaciones.length === 0 ? (
            <li className="text-[12px] text-apagado px-2">Sin conversaciones aún.</li>
          ) : null}
        </ul>
      </aside>

      <section className="rounded-[10px] border border-linea flex flex-col min-h-[50vh] max-h-[70vh]">
        <div className="flex-1 overflow-auto p-4 grid gap-3 content-start">
          {mensajes.length === 0 ? (
            <p className="text-apagado text-[13.5px]">
              {modoPruebas
                ? "Estás en datos mock. Lo que crees o resumas aquí no toca producción. Prueba: «resumen del día» o «¿qué proyectos tengo?»."
                : "Prueba: «resumen del día», «crea una tarea en …» o «¿qué proyectos tengo?»."}
            </p>
          ) : null}
          {mensajes.map((m) => (
            <div
              key={m.id}
              className={`rounded-[10px] px-3 py-2 text-[14px] ${
                m.rol === "user"
                  ? "max-w-[85%] justify-self-end bg-magenta text-white whitespace-pre-wrap"
                  : "max-w-[95%] min-w-0 justify-self-start bg-suave border border-linea"
              }`}
            >
              {m.rol === "assistant" ? <MensajeMd texto={m.contenido} /> : m.contenido}
            </div>
          ))}
          {confirmaciones.length > 0 && !pending && !lightboxAbierto ? (
            <button
              type="button"
              onClick={() => setLightboxAbierto(true)}
              className="justify-self-start rounded-md bg-magenta text-white px-4 py-2 text-[13.5px] font-medium shadow-suave"
            >
              {confirmaciones.length === 1
                ? "Confirmar acción pendiente"
                : `Confirmar ${confirmaciones.length} acciones pendientes`}
            </button>
          ) : null}
          {pending ? (
            <p className="text-[12px] text-apagado">El asistente está trabajando…</p>
          ) : null}
          {error ? <p className="text-[13px] text-magenta-texto">{error}</p> : null}
          <div ref={finRef} aria-hidden className="h-px" />
        </div>

        <form onSubmit={enviar} className="border-t border-linea p-3 flex gap-2 shrink-0 items-end">
          <textarea
            ref={inputRef}
            value={texto}
            rows={Math.min(6, Math.max(1, texto.split("\n").length))}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey) return;
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }}
            placeholder="Escribe un mensaje… (Shift+Enter para nueva línea)"
            className="flex-1 rounded-md border border-linea bg-papel px-3 py-2 text-[14px] resize-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={pending || !texto.trim()}
            className="rounded-md bg-magenta text-white px-4 py-2 text-[13.5px] font-medium disabled:opacity-40 shrink-0"
          >
            Enviar
          </button>
        </form>
      </section>

      {lightboxAbierto && confirmaciones.length > 0 ? (
        <ConfirmacionesLightbox
          pendientes={confirmaciones}
          busy={pending}
          equipo={equipo}
          tipos={tipos}
          onConfirmar={(p, argsEditados) =>
            void responderConfirmacion("confirmar", p, argsEditados)
          }
          onRechazar={(p) => void responderConfirmacion("cancelar", p)}
          onConfirmarTodas={() => void responderConfirmacion("confirmar_todas")}
          onCancelarTodas={() => void responderConfirmacion("cancelar_todas")}
          onCerrar={() => setLightboxAbierto(false)}
        />
      ) : null}
    </div>
  );
}
