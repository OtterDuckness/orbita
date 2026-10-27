"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { PersonaEquipo, TipoProyecto } from "@/lib/clientes-mock";
import {
  TELEFONO_ES_PLACEHOLDER,
  normalizarTelefonoEs,
} from "@/lib/clientes-mock";
import { Boton } from "../boton";
import { crearCliente } from "./acciones";
import { FilasProyectoForm } from "./filas-proyecto-form";

export function NuevaCuentaLightbox({
  tipos,
  equipo,
  responsablePorDefecto,
}: {
  tipos: TipoProyecto[];
  equipo: PersonaEquipo[];
  responsablePorDefecto: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState<1 | 2>(1);
  const [formKey, setFormKey] = useState(0);
  const [responsableClienteId, setResponsableClienteId] = useState(responsablePorDefecto);
  const formRef = useRef<HTMLFormElement>(null);
  const tituloId = useId();

  useEffect(() => {
    if (!abierto) return;
    const onTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", onTecla);
    return () => window.removeEventListener("keydown", onTecla);
  }, [abierto]);

  function abrir() {
    setPaso(1);
    setResponsableClienteId(responsablePorDefecto);
    setFormKey((k) => k + 1);
    setAbierto(true);
  }

  function irPaso2() {
    const form = formRef.current;
    if (!form) return;
    const nombre = form.elements.namedItem("nombre") as HTMLInputElement | null;
    const correo = form.elements.namedItem("correo_acceso") as HTMLInputElement | null;
    const telefono = form.elements.namedItem("telefono") as HTMLInputElement | null;
    const responsable = form.elements.namedItem("responsable_id") as HTMLSelectElement | null;
    if (telefono?.value.trim()) {
      const norm = normalizarTelefonoEs(telefono.value);
      if (norm === false) {
        telefono.setCustomValidity("Usa el formato +34 XXX XXX XXX (empieza por 6–9).");
        telefono.reportValidity();
        return;
      }
      telefono.value = norm ?? "";
      telefono.setCustomValidity("");
    } else if (telefono) {
      telefono.setCustomValidity("");
    }
    if (nombre && !nombre.reportValidity()) return;
    if (correo && !correo.reportValidity()) return;
    if (telefono && !telefono.reportValidity()) return;
    if (responsable && !responsable.reportValidity()) return;
    setPaso(2);
  }

  return (
    <>
      <button type="button" className="boton" onClick={abrir}>
        Nueva cuenta
      </button>

      {abierto ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center p-3 sm:p-4 bg-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={tituloId}
          onClick={() => setAbierto(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[calc(100svh-3rem)] overflow-y-auto rounded-[12px] bg-papel border border-linea-fuerte shadow-suave p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="min-w-0 flex-1">
                <p className="etiqueta text-magenta-texto mb-1">Alta · paso {paso} de 2</p>
                <h2 id={tituloId} className="font-display font-bold text-[20px] tracking-tight">
                  {paso === 1 ? "Datos del cliente" : "Proyectos"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="shrink-0 text-apagado hover:text-tinta text-[18px] leading-none px-1"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <form
              key={formKey}
              ref={formRef}
              action={crearCliente}
              className="grid gap-3 sm:grid-cols-2 sm:items-start"
              onSubmit={(e) => {
                const telefono = e.currentTarget.elements.namedItem(
                  "telefono",
                ) as HTMLInputElement | null;
                if (!telefono) return;
                const norm = normalizarTelefonoEs(telefono.value);
                if (norm === false) {
                  e.preventDefault();
                  setPaso(1);
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
              {/* Siempre montados para que el submit del paso 2 incluya los datos */}
              <div className={paso === 1 ? "contents" : "hidden"}>
                <label className="grid gap-1 sm:col-span-2">
                  <span className="etiqueta">Nombre del cliente</span>
                  <input
                    name="nombre"
                    required
                    maxLength={120}
                    placeholder="Nombre del cliente"
                    className="control h-10 w-full text-[14px]"
                  />
                </label>
                <label className="grid gap-1 min-w-0">
                  <span className="etiqueta">Correo de acceso</span>
                  <input
                    name="correo_acceso"
                    type="email"
                    required
                    placeholder="cliente@empresa.com"
                    className="control h-10 w-full text-[14px]"
                  />
                  <span className="text-[11.5px] text-apagado">
                    Con este correo podrá entrar a Órbita
                  </span>
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
                    value={responsableClienteId}
                    onChange={(e) => setResponsableClienteId(e.target.value)}
                    className="control h-10 w-full max-w-xs text-[14px]"
                  >
                    {equipo.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11.5px] text-apagado">
                    Obligatorio. Dueño comercial de la cuenta; por defecto tú. Se usará en los proyectos nuevos.
                  </span>
                </label>

                <label className="grid gap-1 min-w-0 sm:col-span-2">
                  <span className="etiqueta">Tipo de cuenta</span>
                  <select
                    name="tipo_cuenta"
                    defaultValue=""
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

                <label className="sm:col-span-2 flex items-start gap-2.5 rounded-lg border border-linea-fuerte bg-suave px-3 py-3 hover:border-magenta-borde transition">
                  <input
                    type="checkbox"
                    name="enviar_invitacion"
                    className="mt-0.5 accent-[var(--magenta)]"
                  />
                  <span>
                    <span className="block text-[13.5px] font-semibold">
                      Enviar enlace de invitación a Órbita ahora
                    </span>
                    <span className="block text-[12px] text-apagado mt-0.5">
                      Desmarcado por defecto. Si no lo marcas, la cuenta se guarda y podrás
                      invitar después desde la ficha.
                    </span>
                  </span>
                </label>
              </div>

              <div className={paso === 2 ? "sm:col-span-2 grid gap-3" : "hidden"}>
                <p className="text-[12.5px] text-apagado max-w-[70ch]">
                  Opcional. Puedes crear la cuenta sin proyectos o añadir varios de una vez.
                </p>
                <FilasProyectoForm
                  tipos={tipos}
                  equipo={equipo}
                  responsableSugerido={responsableClienteId}
                  inicialConUnaFila={false}
                  minimo={0}
                />
              </div>

              <div className="sm:col-span-2 flex flex-wrap gap-2 pt-1">
                {paso === 1 ? (
                  <>
                    <button type="button" className="boton" onClick={irPaso2}>
                      Siguiente
                    </button>
                    <button
                      type="button"
                      className="boton-sec h-10"
                      onClick={() => setAbierto(false)}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <Boton className="boton" textoEnviando="Creando…">
                      Crear cuenta
                    </Boton>
                    <button
                      type="button"
                      className="boton-sec h-10"
                      onClick={() => setPaso(1)}
                    >
                      Atrás
                    </button>
                    <button
                      type="button"
                      className="boton-sec h-10"
                      onClick={() => setAbierto(false)}
                    >
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
