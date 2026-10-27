"use client";

import { useEffect, useState, useTransition } from "react";
import type { PersonaEquipo } from "@/lib/clientes-mock";
import type { MensajeTarea } from "@/lib/tarea-chat";
import { fecha } from "@/lib/formato";
import { AvatarUsuario } from "../avatar-usuario";
import { useAvisos } from "../avisos-ui";
import { enviarMensajeTareaAction, listarMensajesTareaAction, marcarChatTareaVistoAction } from "./acciones-chat";

export function ChatTarea({
  tareaId,
  yoId,
  equipo,
  className,
  listaClassName,
  onVisto,
}: {
  tareaId: string;
  yoId: string;
  equipo: PersonaEquipo[];
  className?: string;
  listaClassName?: string;
  onVisto?: () => void;
}) {
  const { avisar } = useAvisos();
  const [mensajes, setMensajes] = useState<MensajeTarea[]>([]);
  const [cuerpo, setCuerpo] = useState("");
  const [cargando, setCargando] = useState(true);
  const [pendiente, startTransition] = useTransition();

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    void listarMensajesTareaAction(tareaId).then((r) => {
      if (!vivo) return;
      if (r.ok) setMensajes(r.mensajes);
      setCargando(false);
    });
    void marcarChatTareaVistoAction(tareaId).then(() => {
      if (vivo) onVisto?.();
    });
    return () => {
      vivo = false;
    };
    // onVisto es estable en la práctica; evitar re-marcar en cada render del padre.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar tarea
  }, [tareaId]);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const texto = cuerpo.trim();
    if (!texto) return;
    const fd = new FormData();
    fd.set("tarea_id", tareaId);
    fd.set("cuerpo", texto);
    startTransition(async () => {
      const r = await enviarMensajeTareaAction(fd);
      if (!r.ok) {
        avisar(r.aviso);
        return;
      }
      setMensajes((prev) => [...prev, r.mensaje]);
      setCuerpo("");
    });
  }

  return (
    <section
      className={`border border-linea-fuerte rounded-xl overflow-hidden bg-papel shadow-suave ${className ?? ""}`}
    >
      <div className="px-3 py-2 border-b border-linea flex items-center justify-between">
        <h3 className="etiqueta !normal-case tracking-normal font-semibold text-tinta">Chat</h3>
        {cargando ? <span className="text-[11px] text-apagado">Cargando…</span> : null}
      </div>
      <ul className={listaClassName ?? "max-h-52 overflow-y-auto grid gap-2 p-3"}>
        {mensajes.length === 0 && !cargando ? (
          <li className="text-[12.5px] text-apagado">Sin mensajes todavía.</li>
        ) : (
          mensajes.map((m) => {
            const mio = m.autorId === yoId;
            const persona = equipo.find((p) => p.id === m.autorId);
            const nombre = persona?.nombre ?? m.autorNombre;
            const avatarUrl = persona?.avatarUrl ?? m.autorAvatarUrl;
            return (
              <li
                key={m.id}
                className={`rounded-lg px-2.5 py-2 text-[12.5px] ${
                  mio ? "bg-magenta-suave ml-6" : "bg-suave mr-6"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <AvatarUsuario nombre={nombre} avatarUrl={avatarUrl} tamano="xs" />
                  <b className="font-semibold truncate flex-1 min-w-0">{mio ? "Tú" : nombre}</b>
                  <span className="text-[10.5px] text-apagado shrink-0">{fecha(m.creadoEn)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words leading-snug">{m.cuerpo}</p>
              </li>
            );
          })
        )}
      </ul>
      <form onSubmit={enviar} className="border-t border-linea p-2.5 flex gap-2 items-end">
        <textarea
          rows={1}
          value={cuerpo}
          maxLength={4000}
          placeholder="Escribe un mensaje…"
          className="control flex-1 min-w-0 px-2.5 py-2 text-[13px] resize-none"
          onChange={(e) => setCuerpo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.shiftKey) return;
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }}
          disabled={pendiente}
        />
        <button
          type="submit"
          className="boton h-9 px-3 shrink-0 disabled:opacity-60"
          disabled={pendiente || !cuerpo.trim()}
        >
          {pendiente ? "…" : "Enviar"}
        </button>
      </form>
    </section>
  );
}
