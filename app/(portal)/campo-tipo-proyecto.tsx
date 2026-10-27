"use client";

import { useEffect, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import type { TipoProyecto } from "@/lib/clientes-mock";
import { useAvisos } from "./avisos-ui";
import { crearTipoProyectoInline } from "./proyectos/acciones";

const OTRO = "__otro__";

const selectClsDefault = "control h-10 w-full";

function sinTipoOtroLegacy(tipos: TipoProyecto[]) {
  return tipos.filter((t) => t.nombre.trim().toLowerCase() !== "otro");
}

export function CampoTipoProyecto({
  tipos: tiposIniciales,
  defaultValue,
  etiqueta = "Tipo",
  name = "tipo_id",
  selectClassName = selectClsDefault,
}: {
  tipos: TipoProyecto[];
  defaultValue?: string;
  etiqueta?: string;
  name?: string;
  selectClassName?: string;
}) {
  const router = useRouter();
  const { avisar } = useAvisos();
  const iniciales = sinTipoOtroLegacy(tiposIniciales);
  const [tipos, setTipos] = useState(iniciales);
  const [value, setValue] = useState(() => {
    const v = defaultValue ?? "";
    if (v && iniciales.some((t) => t.id === v)) return v;
    return iniciales[0]?.id ?? "";
  });
  const [creando, setCreando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [pendiente, startTransition] = useTransition();

  useEffect(() => {
    const next = sinTipoOtroLegacy(tiposIniciales);
    setTipos(next);
    setValue((prev) => (next.some((t) => t.id === prev) ? prev : (next[0]?.id ?? "")));
  }, [tiposIniciales]);

  function onSelectChange(e: ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    if (v === OTRO) {
      setCreando(true);
      setNombreNuevo("");
      return;
    }
    setValue(v);
    setCreando(false);
  }

  function crear() {
    const nombre = nombreNuevo.trim();
    if (!nombre) {
      avisar("falta_dato");
      return;
    }
    if (nombre.toLowerCase() === "otro" || nombre === "Otro…") {
      avisar("falta_dato");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("nombre", nombre);
      const r = await crearTipoProyectoInline(fd);
      if (!r.ok) {
        avisar(r.motivo === "duplicado" ? "tipo_duplicado" : "falta_dato");
        return;
      }
      setTipos((prev) =>
        [...prev.filter((t) => t.id !== r.tipo.id), r.tipo].sort(
          (a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"),
        ),
      );
      setValue(r.tipo.id);
      setCreando(false);
      setNombreNuevo("");
      avisar("tipo_creado");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-1 min-w-0">
      <span className="etiqueta">{etiqueta}</span>
      <select
        name={name}
        required
        value={value}
        onChange={onSelectChange}
        className={selectClassName}
      >
        {tipos.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre}
          </option>
        ))}
        <option value={OTRO}>Otro…</option>
      </select>

      {creando ? (
        <div className="mt-1 rounded-lg border border-linea-fuerte bg-suave/60 p-3 grid gap-2">
          <p className="text-[12px] text-apagado">Nuevo tipo de proyecto</p>
          <input
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            maxLength={60}
            placeholder="Nombre del tipo"
            autoFocus
            disabled={pendiente}
            className="control h-9 w-full px-2.5 text-[13px]"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                crear();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setCreando(false);
              }
            }}
          />
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              disabled={pendiente}
              onClick={crear}
              className="h-9 px-3 text-[13px] rounded-lg bg-magenta text-white font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {pendiente ? "Creando…" : "Crear tipo"}
            </button>
            <button
              type="button"
              disabled={pendiente}
              onClick={() => setCreando(false)}
              className="boton-sec h-9 px-3 text-[13px]"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
