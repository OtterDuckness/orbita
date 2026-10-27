"use client";

import { useMemo, useRef, useState } from "react";
import type { MensajeVista, ReferenciaVista, RefInput } from "@/lib/comunicaciones";
import { useAvisos } from "../avisos-ui";
import { Boton } from "../boton";
import { enviarMensajeAction } from "./acciones";

export type OpcionRef = {
  token: string;
  etiqueta: string;
  tipo: "cliente" | "proyecto";
};

const btnIcono =
  "size-9 grid place-items-center rounded-lg border border-linea text-apagado hover:text-tinta hover:border-magenta-borde hover:bg-magenta-suave transition disabled:opacity-40";

function IconoClip() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 12.5V8a5 5 0 0 0-10 0v9a3 3 0 0 0 6 0V9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconoLink() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 11a5 5 0 0 0-7.07 0L5.5 12.43a5 5 0 0 0 7.07 7.07L14 19"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FormularioMensaje({
  conversacionId,
  opciones,
  mencionInicial,
  onEnviado,
}: {
  conversacionId: string;
  opciones: OpcionRef[];
  mencionInicial: ReferenciaVista | null;
  onEnviado: (mensaje: MensajeVista) => void;
}) {
  const { avisar } = useAvisos();
  const inicial = useMemo(() => {
    if (!mencionInicial) return [] as RefInput[];
    return [{ tipo: mencionInicial.tipo, entidadId: mencionInicial.entidadId }];
  }, [mencionInicial]);

  const [refs, setRefs] = useState<RefInput[]>(inicial);
  const [picker, setPicker] = useState("");
  const [panelVincular, setPanelVincular] = useState(Boolean(mencionInicial));
  const [archivos, setArchivos] = useState<File[]>([]);
  const [cuerpoActivo, setCuerpoActivo] = useState(false);
  const [cuerpo, setCuerpo] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const campoExpandido = cuerpoActivo || cuerpo.trim().length > 0;

  const etiquetas = useMemo(() => {
    const m = new Map(opciones.map((o) => [o.token, o]));
    return m;
  }, [opciones]);

  function anadir() {
    const token = picker.trim();
    if (!token) return;
    const op = etiquetas.get(token);
    if (!op) return;
    const entidadId = token.slice(token.indexOf(":") + 1);
    setRefs((prev) => {
      if (prev.some((r) => r.tipo === op.tipo && r.entidadId === entidadId)) return prev;
      return [...prev, { tipo: op.tipo, entidadId }];
    });
    setPicker("");
    setPanelVincular(false);
  }

  function quitar(tipo: string, entidadId: string) {
    setRefs((prev) => prev.filter((r) => !(r.tipo === tipo && r.entidadId === entidadId)));
  }

  function onArchivosChange(list: FileList | null) {
    if (!list) {
      setArchivos([]);
      return;
    }
    setArchivos(Array.from(list).slice(0, 5));
  }

  function quitarArchivo(nombre: string, idx: number) {
    const input = fileRef.current;
    if (!input?.files) return;
    const dt = new DataTransfer();
    Array.from(input.files).forEach((f, i) => {
      if (!(f.name === nombre && i === idx)) dt.items.add(f);
    });
    input.files = dt.files;
    setArchivos(Array.from(dt.files));
  }

  function resetFormulario() {
    setCuerpo("");
    setRefs(inicial);
    setPicker("");
    setPanelVincular(Boolean(mencionInicial));
    setArchivos([]);
    setCuerpoActivo(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onAction(formData: FormData) {
    const r = await enviarMensajeAction(formData);
    if (!r.ok) {
      avisar(r.aviso);
      return;
    }
    resetFormulario();
    onEnviado(r.mensaje);
  }

  return (
    <form
      action={onAction}
      encType="multipart/form-data"
      className="shrink-0 border-t border-linea p-3 grid gap-2"
    >
      <input type="hidden" name="conversacion_id" value={conversacionId} />
      {refs.map((r) => (
        <input key={`${r.tipo}:${r.entidadId}`} type="hidden" name="ref" value={`${r.tipo}:${r.entidadId}`} />
      ))}

      {(refs.length > 0 || archivos.length > 0) && (
        <ul className="flex flex-wrap gap-1.5">
          {refs.map((r) => {
            const token = `${r.tipo}:${r.entidadId}`;
            const op = etiquetas.get(token);
            const etiqueta = op?.etiqueta ?? (r.tipo === "cliente" ? "Cliente" : "Proyecto");
            return (
              <li
                key={token}
                className="inline-flex items-center gap-1 rounded-full border border-linea bg-suave pl-2.5 pr-1 py-0.5 text-[11.5px]"
              >
                <span className="etiqueta !normal-case tracking-normal">
                  {r.tipo === "cliente" ? "Cliente" : "Proyecto"}
                </span>
                <span className="font-semibold max-w-[14rem] truncate">{etiqueta}</span>
                <button
                  type="button"
                  className="text-apagado hover:text-tinta px-1 leading-none"
                  aria-label="Quitar vínculo"
                  onClick={() => quitar(r.tipo, r.entidadId)}
                >
                  ×
                </button>
              </li>
            );
          })}
          {archivos.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="inline-flex items-center gap-1 rounded-full border border-linea bg-suave pl-2.5 pr-1 py-0.5 text-[11.5px]"
            >
              <span className="etiqueta !normal-case tracking-normal">Archivo</span>
              <span className="font-semibold max-w-[14rem] truncate">{f.name}</span>
              <button
                type="button"
                className="text-apagado hover:text-tinta px-1 leading-none"
                aria-label="Quitar archivo"
                onClick={() => quitarArchivo(f.name, i)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="grid gap-1">
        <span className="sr-only">Mensaje</span>
        <textarea
          name="cuerpo"
          rows={campoExpandido ? 5 : 1}
          value={cuerpo}
          maxLength={4000}
          placeholder="Escribe un mensaje… (opcional si vinculas o adjuntas)"
          className="control w-full resize-none transition-[height] duration-150"
          onFocus={() => setCuerpoActivo(true)}
          onBlur={() => setCuerpoActivo(false)}
          onChange={(e) => setCuerpo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.shiftKey) return;
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }}
        />
      </label>

      <input
        ref={fileRef}
        type="file"
        name="archivo"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,application/pdf,image/*"
        className="sr-only"
        onChange={(e) => onArchivosChange(e.target.files)}
      />

      {panelVincular && opciones.length > 0 ? (
        <div className="flex gap-2 items-center flex-wrap rounded-lg border border-linea-fuerte bg-suave/50 p-2">
          <label className="flex-1 min-w-[12rem] grid gap-1">
            <span className="sr-only">Vincular</span>
            <select
              value={picker}
              onChange={(e) => setPicker(e.target.value)}
              className="control h-9 w-full px-2.5 text-[12.5px]"
              autoFocus
            >
              <option value="">Cliente o proyecto…</option>
              <optgroup label="Clientes">
                {opciones
                  .filter((o) => o.tipo === "cliente")
                  .map((o) => (
                    <option key={o.token} value={o.token}>
                      {o.etiqueta}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Proyectos">
                {opciones
                  .filter((o) => o.tipo === "proyecto")
                  .map((o) => (
                    <option key={o.token} value={o.token}>
                      {o.etiqueta}
                    </option>
                  ))}
              </optgroup>
            </select>
          </label>
          <button
            type="button"
            className="boton-sec h-9 px-2.5 text-[12px] shrink-0"
            onClick={anadir}
            disabled={!picker}
          >
            Añadir
          </button>
          <button
            type="button"
            className="h-9 px-2 text-[12px] text-apagado hover:text-tinta shrink-0"
            onClick={() => {
              setPanelVincular(false);
              setPicker("");
            }}
          >
            Cerrar
          </button>
        </div>
      ) : null}

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className={btnIcono}
          aria-label="Adjuntar archivos (máx. 25 MB, hasta 5)"
          title="Adjuntar"
          onClick={() => fileRef.current?.click()}
        >
          <IconoClip />
        </button>
        {opciones.length > 0 ? (
          <button
            type="button"
            className={`${btnIcono} ${panelVincular ? "border-magenta text-magenta bg-suave" : ""}`}
            aria-label="Vincular cliente o proyecto"
            title="Vincular"
            aria-expanded={panelVincular}
            onClick={() => setPanelVincular((v) => !v)}
          >
            <IconoLink />
          </button>
        ) : null}
        <div className="flex-1" />
        <Boton className="boton shrink-0 h-9 px-4" textoEnviando="…">
          Enviar
        </Boton>
      </div>
    </form>
  );
}
