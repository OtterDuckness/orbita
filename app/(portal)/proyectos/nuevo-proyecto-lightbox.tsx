"use client";

import { useEffect, useId, useState } from "react";
import {
  PRIORIDADES_PROYECTO,
  type Cliente,
  type PersonaEquipo,
  type TipoProyecto,
} from "@/lib/clientes-mock";
import { Boton } from "../boton";
import { CampoFecha } from "../campo-fecha";
import { CampoTipoProyecto } from "../campo-tipo-proyecto";
import { CampoColaboradores } from "../colaboradores-ui";
import { crearProyectoNuevo } from "./acciones";

export function NuevoProyectoLightbox({
  clientes,
  tipos,
  equipo,
  responsablePorDefecto,
}: {
  clientes: Cliente[];
  tipos: TipoProyecto[];
  equipo: PersonaEquipo[];
  responsablePorDefecto: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [ambito, setAmbito] = useState<"interno" | "externo">("externo");
  const [finContrato, setFinContrato] = useState("");
  const [responsableId, setResponsableId] = useState(responsablePorDefecto);
  const [colaboradoresAbiertos, setColaboradoresAbiertos] = useState(false);
  const tituloId = useId();

  useEffect(() => {
    if (!abierto) return;
    const onTecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (colaboradoresAbiertos) {
        setColaboradoresAbiertos(false);
        return;
      }
      setAbierto(false);
    };
    window.addEventListener("keydown", onTecla);
    return () => window.removeEventListener("keydown", onTecla);
  }, [abierto, colaboradoresAbiertos]);

  function abrir() {
    setAmbito("externo");
    setFinContrato("");
    setResponsableId(responsablePorDefecto);
    setColaboradoresAbiertos(false);
    setAbierto(true);
  }

  function cerrar() {
    setColaboradoresAbiertos(false);
    setAbierto(false);
  }

  return (
    <>
      <button type="button" className="boton" onClick={abrir}>
        Nuevo proyecto
      </button>

      {abierto ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={tituloId}
          onClick={cerrar}
        >
          <div className="flex min-h-[100svh] items-start sm:items-center justify-center p-3 sm:p-4">
          <form
            action={crearProyectoNuevo}
            className={`relative flex flex-col xl:flex-row gap-3 w-full items-stretch ${
              colaboradoresAbiertos
                ? "max-w-[min(100%,calc(36rem+0.75rem+18.75rem))]"
                : "max-w-xl"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-xl min-h-0 max-h-[calc(100svh-3rem)] overflow-y-auto rounded-[12px] bg-papel border border-linea-fuerte shadow-suave p-5 grid gap-3 content-start">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="etiqueta text-magenta-texto mb-1">Alta</p>
                  <h2 id={tituloId} className="font-display font-bold text-[20px] tracking-tight">
                    Nuevo proyecto
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={cerrar}
                  className="shrink-0 text-apagado hover:text-tinta text-[18px] leading-none px-1"
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>

                <div className="grid gap-3 grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] items-start">
                  <label className="grid gap-1 min-w-0">
                    <span className="etiqueta">Ámbito</span>
                    <select
                      name="ambito"
                      value={ambito}
                      onChange={(e) =>
                        setAmbito(e.target.value === "externo" ? "externo" : "interno")
                      }
                      className="control h-10 w-full"
                      title="Interno: sin cliente por defecto. Externo: requiere cuenta."
                    >
                      <option value="externo">Externo</option>
                      <option value="interno">Interno</option>
                    </select>
                  </label>

                  <label className="grid gap-1 min-w-0">
                    <span className="etiqueta">
                      Cliente{ambito === "externo" ? "" : " (opcional)"}
                    </span>
                    <select
                      name="cliente_id"
                      required={ambito === "externo"}
                      defaultValue=""
                      className="control h-10 w-full"
                      onChange={(e) => {
                        const c = clientes.find((x) => x.id === e.target.value);
                        setResponsableId(c?.responsableId || responsablePorDefecto);
                      }}
                    >
                      <option value="">
                        {ambito === "externo" ? "Elige un cliente…" : "Sin cliente"}
                      </option>
                      {clientes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="grid gap-1 min-w-0">
                  <span className="etiqueta">
                    Nombre del proyecto{ambito === "interno" ? "" : " (opcional)"}
                  </span>
                  <input
                    name="nombre"
                    required={ambito === "interno"}
                    maxLength={160}
                    placeholder={ambito === "interno" ? "Ej. Órbita" : "Si vacío, se usa el tipo"}
                    className="control h-10 w-full"
                  />
                </label>

                {ambito === "externo" ? (
                  <CampoTipoProyecto tipos={tipos} defaultValue={tipos[0]?.id ?? ""} />
                ) : null}

                <div className="grid gap-3 grid-cols-[minmax(0,7rem)_auto_minmax(0,7.5rem)] items-start">
                  <label className="grid gap-1 min-w-0">
                    <span className="etiqueta">Tamaño</span>
                    <input
                      name="fee_mensual"
                      inputMode="decimal"
                      placeholder="890"
                      className="control h-10 w-full"
                    />
                  </label>
                  <CampoFecha
                    etiqueta="Fecha de fin"
                    name="fin_contrato"
                    value={finContrato}
                    onChange={setFinContrato}
                  />
                  <label className="grid gap-1 min-w-0">
                    <span className="etiqueta">Prioridad</span>
                    <select
                      name="prioridad"
                      defaultValue="media"
                      className="control h-10 w-full"
                    >
                      {PRIORIDADES_PROYECTO.map((p) => (
                        <option key={p} value={p}>
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="flex items-end gap-2 min-w-0">
                  <label className="grid gap-1 min-w-0 flex-1">
                    <span className="etiqueta">Responsable de proyecto</span>
                    <select
                      name="responsable_id"
                      required
                      value={responsableId}
                      onChange={(e) => setResponsableId(e.target.value)}
                      className="control h-10 w-full"
                    >
                      {equipo.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="boton-sec h-10 shrink-0"
                    aria-expanded={colaboradoresAbiertos}
                    aria-controls="panel-colaboradores-nuevo"
                    onClick={() => setColaboradoresAbiertos((v) => !v)}
                  >
                    Colaboradores
                  </button>
                </div>

                <div className="flex gap-2 pt-1">
                  <Boton className="boton" textoEnviando="Creando…">
                    Crear proyecto
                  </Boton>
                  <button type="button" className="boton-sec h-10" onClick={cerrar}>
                    Cancelar
                  </button>
                </div>
            </div>
            <aside
              id="panel-colaboradores-nuevo"
              aria-hidden={!colaboradoresAbiertos}
              className={`w-full xl:w-[18.75rem] shrink-0 flex flex-col rounded-[12px] border border-linea-fuerte bg-papel shadow-suave overflow-hidden max-h-[min(20rem,calc(100svh-3rem))] xl:max-h-[calc(100svh-3rem)] ${
                colaboradoresAbiertos ? "" : "hidden"
              }`}
            >
              <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-linea shrink-0">
                <p className="text-[13px] font-semibold text-tinta">Colaboradores</p>
                <button
                  type="button"
                  onClick={() => setColaboradoresAbiertos(false)}
                  className="text-apagado hover:text-tinta text-[18px] leading-none px-1"
                  aria-label="Cerrar colaboradores"
                >
                  ×
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-3">
                <CampoColaboradores
                  bloqueados={responsableId ? [responsableId] : []}
                  candidatos={equipo}
                />
              </div>
            </aside>
          </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
