"use client";

import { useState } from "react";
import { PRIORIDADES_PROYECTO, type PersonaEquipo, type TipoProyecto } from "@/lib/clientes-mock";
import { CampoFecha } from "../campo-fecha";
import { CampoTipoProyecto } from "../campo-tipo-proyecto";
import { CampoColaboradores } from "../colaboradores-ui";

type Fila = {
  key: string;
  finContrato: string;
  responsableId: string;
};

let seq = 0;
function nuevaKey() {
  seq += 1;
  return `f${seq}`;
}

function filaNueva(responsableId: string): Fila {
  return { key: nuevaKey(), finContrato: "", responsableId };
}

export function FilasProyectoForm({
  tipos,
  equipo,
  responsableSugerido = "",
  inicialConUnaFila = false,
  vacioTexto = "Sin proyectos. Puedes crear la cuenta y añadirlos después.",
  minimo = 0,
}: {
  tipos: TipoProyecto[];
  equipo: PersonaEquipo[];
  responsableSugerido?: string;
  inicialConUnaFila?: boolean;
  vacioTexto?: string;
  /** Número mínimo de filas (p. ej. 1 al añadir a una cuenta existente). */
  minimo?: number;
}) {
  const [filas, setFilas] = useState<Fila[]>(() =>
    inicialConUnaFila || minimo > 0 ? [filaNueva(responsableSugerido)] : [],
  );

  function anadir() {
    setFilas((prev) => [...prev, filaNueva(responsableSugerido)]);
  }

  function quitar(key: string) {
    setFilas((prev) => {
      if (prev.length <= minimo) return prev;
      return prev.filter((f) => f.key !== key);
    });
  }

  return (
    <div className="grid gap-3">
      <input type="hidden" name="proyectos_count" value={filas.length} />

      {filas.length === 0 ? <p className="text-[12.5px] text-apagado">{vacioTexto}</p> : null}

      {filas.map((fila, i) => (
        <div
          key={fila.key}
          className="rounded-[10px] border border-linea-fuerte bg-suave/30 p-3 grid gap-3 sm:grid-cols-2 sm:items-start"
        >
          <div className="sm:col-span-2 flex items-center justify-between gap-2">
            <p className="etiqueta text-magenta-texto mb-0">Proyecto {i + 1}</p>
            {filas.length > minimo ? (
              <button
                type="button"
                onClick={() => quitar(fila.key)}
                className="text-[12.5px] text-apagado hover:text-tinta"
              >
                Quitar
              </button>
            ) : null}
          </div>

          <CampoTipoProyecto
            etiqueta="Tipo de proyecto"
            tipos={tipos}
            defaultValue={tipos[0]?.id ?? ""}
            name={`proyecto_${i}_tipo_id`}
            selectClassName="control h-10 w-full text-[14px]"
          />
          <label className="grid gap-1 min-w-0 sm:col-span-2">
            <span className="etiqueta">Nombre del proyecto (opcional)</span>
            <input
              name={`proyecto_${i}_nombre`}
              maxLength={160}
              placeholder="Si vacío, se usa el tipo"
              className="control h-10 w-full text-[14px]"
            />
          </label>
          <label className="grid gap-1 min-w-0">
            <span className="etiqueta">Tamaño de oportunidad</span>
            <input
              name={`proyecto_${i}_fee_mensual`}
              inputMode="decimal"
              placeholder="890"
              className="control h-10 w-full text-[14px]"
            />
          </label>
          <CampoFecha
            etiqueta="Fecha de fin"
            name={`proyecto_${i}_fin_contrato`}
            value={fila.finContrato}
            onChange={(v) =>
              setFilas((prev) =>
                prev.map((f) => (f.key === fila.key ? { ...f, finContrato: v } : f)),
              )
            }
          />
          <label className="grid gap-1 min-w-0">
            <span className="etiqueta">Responsable de proyecto</span>
            <select
              name={`proyecto_${i}_responsable_id`}
              required
              value={fila.responsableId}
              onChange={(e) =>
                setFilas((prev) =>
                  prev.map((f) =>
                    f.key === fila.key ? { ...f, responsableId: e.target.value } : f,
                  ),
                )
              }
              className="control h-10 w-full text-[14px]"
            >
              {!fila.responsableId ? (
                <option value="" disabled>
                  Elige responsable
                </option>
              ) : null}
              {equipo.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 min-w-0">
            <span className="etiqueta">Prioridad</span>
            <select
              name={`proyecto_${i}_prioridad`}
              defaultValue="media"
              className="control h-10 w-full text-[14px]"
            >
              {PRIORIDADES_PROYECTO.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <CampoColaboradores
              name={`proyecto_${i}_colaborador_ids`}
              bloqueados={fila.responsableId ? [fila.responsableId] : []}
              candidatos={equipo}
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={anadir}
        className="boton-sec h-10 justify-self-start"
      >
        Añadir proyecto
      </button>
    </div>
  );
}
