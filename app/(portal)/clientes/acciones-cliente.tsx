"use client";

import { useEffect, useId, useState } from "react";
import type { Cliente, PersonaEquipo } from "@/lib/clientes-mock";
import {
  TELEFONO_ES_PLACEHOLDER,
  normalizarTelefonoEs,
} from "@/lib/clientes-mock";
import { Boton } from "../boton";
import { NotasClienteLightbox } from "../notas-cliente-lightbox";
import {
  btnIcono,
  IconoEditar,
  IconoEliminar,
  IconoNotas,
} from "../proyectos/iconos-acciones";
import { editarClienteCuenta, eliminarClienteCuenta } from "./acciones";

type Modal = "editar" | "eliminar" | null;

export function AccionesCliente({
  cliente,
  equipo,
  puedeGestionar = false,
}: {
  cliente: Cliente;
  equipo: PersonaEquipo[];
  /** Solo responsable de cliente (o admin) puede editar/borrar. */
  puedeGestionar?: boolean;
}) {
  const [modal, setModal] = useState<Modal>(null);
  const tituloId = useId();

  useEffect(() => {
    if (!modal) return;
    const onTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", onTecla);
    return () => window.removeEventListener("keydown", onTecla);
  }, [modal]);

  const sinPermiso = "Solo el responsable de cliente puede modificar la cuenta";

  return (
    <>
      <div className="flex items-center gap-1.5 shrink-0">
        <NotasClienteLightbox
          clienteId={cliente.id}
          titulo={cliente.nombre}
          className={btnIcono}
        >
          <IconoNotas />
        </NotasClienteLightbox>
        <button
          type="button"
          className={`${btnIcono} ${
            puedeGestionar ? "" : "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-inherit"
          }`}
          title={puedeGestionar ? "Editar" : sinPermiso}
          aria-label={puedeGestionar ? "Editar" : sinPermiso}
          disabled={!puedeGestionar}
          onClick={() => {
            if (!puedeGestionar) return;
            setModal("editar");
          }}
        >
          <IconoEditar />
        </button>
        <button
          type="button"
          className={`${btnIcono} ${
            puedeGestionar
              ? "text-mal border-mal-borde hover:bg-mal-suave"
              : "opacity-40 cursor-not-allowed text-mal/50 border-mal-borde/40 hover:bg-transparent"
          }`}
          title={puedeGestionar ? "Eliminar" : sinPermiso}
          aria-label={puedeGestionar ? "Eliminar" : sinPermiso}
          disabled={!puedeGestionar}
          onClick={() => {
            if (!puedeGestionar) return;
            setModal("eliminar");
          }}
        >
          <IconoEliminar />
        </button>
      </div>

      {puedeGestionar && modal === "editar" ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center p-3 sm:p-4 bg-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={tituloId}
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-lg max-h-[calc(100svh-3rem)] overflow-y-auto rounded-[12px] bg-papel border border-linea-fuerte shadow-suave p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="min-w-0 flex-1">
                <p className="etiqueta text-magenta-texto mb-1">Cuenta</p>
                <h2 id={tituloId} className="font-display font-bold text-[20px] tracking-tight">
                  Editar cliente
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="shrink-0 text-apagado hover:text-tinta text-[18px] leading-none px-1"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <form
              action={editarClienteCuenta}
              className="grid gap-3 sm:grid-cols-2 sm:items-start"
              onSubmit={(e) => {
                const telefono = e.currentTarget.elements.namedItem(
                  "telefono",
                ) as HTMLInputElement | null;
                if (!telefono) return;
                const norm = normalizarTelefonoEs(telefono.value);
                if (norm === false) {
                  e.preventDefault();
                  telefono.setCustomValidity(
                    "Usa el formato +34 XXX XXX XXX (empieza por 6–9).",
                  );
                  telefono.reportValidity();
                  return;
                }
                telefono.value = norm ?? "";
                telefono.setCustomValidity("");
              }}
            >
              <input type="hidden" name="cliente_id" value={cliente.id} />
              <label className="grid gap-1 sm:col-span-2">
                <span className="etiqueta">Nombre del cliente</span>
                <input
                  name="nombre"
                  required
                  maxLength={120}
                  defaultValue={cliente.nombre}
                  className="control h-10 w-full text-[14px]"
                />
              </label>
              <label className="grid gap-1 min-w-0">
                <span className="etiqueta">Correo de acceso</span>
                <input
                  name="correo_acceso"
                  type="email"
                  required
                  defaultValue={cliente.correoAcceso}
                  className="control h-10 w-full text-[14px]"
                />
              </label>
              <label className="grid gap-1 min-w-0">
                <span className="etiqueta">Teléfono</span>
                <input
                  name="telefono"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder={TELEFONO_ES_PLACEHOLDER}
                  title="+34 XXX XXX XXX (9 dígitos, empieza por 6–9)"
                  defaultValue={cliente.telefono ?? ""}
                  className="control h-10 w-full text-[14px]"
                  onBlur={(e) => {
                    const norm = normalizarTelefonoEs(e.target.value);
                    if (typeof norm === "string") e.target.value = norm;
                    e.target.setCustomValidity("");
                  }}
                  onChange={(e) => e.target.setCustomValidity("")}
                />
                <span className="text-[11.5px] text-apagado">Opcional · {TELEFONO_ES_PLACEHOLDER}</span>
              </label>
              <label className="grid gap-1 min-w-0 sm:col-span-2">
                <span className="etiqueta">Responsable de cliente</span>
                <select
                  name="responsable_id"
                  required
                  defaultValue={cliente.responsableId ?? ""}
                  className="control h-10 w-full max-w-xs text-[14px]"
                >
                  {!cliente.responsableId ? (
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
              <label className="grid gap-1 min-w-0 sm:col-span-2">
                <span className="etiqueta">Tipo de cuenta</span>
                <select
                  name="tipo_cuenta"
                  defaultValue={cliente.tipoCuenta ?? ""}
                  className="control h-10 w-full max-w-xs text-[14px]"
                >
                  <option value="">Ninguno</option>
                  <option value="b2b">B2B</option>
                  <option value="kit_digital">Kit Digital</option>
                </select>
                <span className="text-[11.5px] text-apagado">
                  Opcional. Ayuda a priorizar y repartir cuentas entre el equipo.
                </span>
              </label>
              <div className="sm:col-span-2 flex gap-2 pt-1">
                <Boton className="boton" textoEnviando="Guardando…">
                  Guardar cambios
                </Boton>
                <button
                  type="button"
                  className="boton-sec h-10"
                  onClick={() => setModal(null)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {puedeGestionar && modal === "eliminar" ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center p-3 sm:p-4 bg-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${tituloId}-eliminar`}
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-md rounded-[12px] bg-papel border border-linea-fuerte shadow-suave p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="min-w-0 flex-1">
                <p className="etiqueta text-mal mb-1">Eliminar</p>
                <h2
                  id={`${tituloId}-eliminar`}
                  className="font-display font-bold text-[20px] tracking-tight"
                >
                  ¿Eliminar esta cuenta?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="shrink-0 text-apagado hover:text-tinta text-[18px] leading-none px-1"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <p className="text-[13.5px] text-apagado mb-5">
              Se eliminará <b className="text-tinta font-semibold">{cliente.nombre}</b> y todos sus
              proyectos. Podrás restaurarlos en Eliminados durante 30 días (los chats de
              comunicaciones del cliente no se recuperan).
            </p>

            <form action={eliminarClienteCuenta} className="flex gap-2 flex-wrap">
              <input type="hidden" name="cliente_id" value={cliente.id} />
              <Boton
                className="h-10 px-4 rounded-lg text-[13.5px] font-semibold bg-mal-boton text-white hover:opacity-90"
                textoEnviando="Eliminando…"
              >
                Eliminar cuenta
              </Boton>
              <button
                type="button"
                className="boton-sec h-10"
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
