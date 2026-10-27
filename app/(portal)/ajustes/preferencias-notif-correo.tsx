import { Boton } from "../boton";
import type { NotifCorreoPrefs } from "@/lib/notif-correo-prefs";
import { guardarNotifCorreoAction } from "./acciones-notif-correo";

const DIAS_UI: { valor: number; etiqueta: string }[] = [
  { valor: 1, etiqueta: "Lunes" },
  { valor: 2, etiqueta: "Martes" },
  { valor: 3, etiqueta: "Miércoles" },
  { valor: 4, etiqueta: "Jueves" },
  { valor: 5, etiqueta: "Viernes" },
];

const HORAS = [
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
] as const;

export function PreferenciasNotifCorreo({ prefs }: { prefs: NotifCorreoPrefs }) {
  const diasSet = new Set(prefs.dias);

  return (
    <form
      action={guardarNotifCorreoAction}
      className="tarjeta bg-papel p-4 grid gap-4 max-w-lg"
    >
      <p className="text-[13.5px] text-apagado leading-relaxed">
        Resumen por correo de tus tareas (pendientes, clientes y atrasos
        importantes). Desactivado por defecto: actívalo cuando quieras. Horario en
        Europe/Madrid; al activarlo, el valor inicial es lunes, miércoles y viernes a
        las 09:00.
      </p>

      <label className="flex items-center gap-2 text-[13.5px] cursor-pointer">
        <input
          type="checkbox"
          name="activo"
          value="1"
          defaultChecked={prefs.activo}
          className="accent-[var(--magenta)]"
        />
        Recibir digest por correo
      </label>

      <fieldset className="grid gap-2 border-0 p-0 m-0">
        <legend className="text-[13.5px] font-semibold mb-1">Días</legend>
        <div className="flex flex-wrap gap-2">
          {DIAS_UI.map((d) => (
            <label
              key={d.valor}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[13.5px] cursor-pointer transition ${
                diasSet.has(d.valor)
                  ? "border-magenta bg-suave text-tinta font-semibold"
                  : "border-linea hover:border-magenta-borde"
              }`}
            >
              <input
                type="checkbox"
                name="dias"
                value={d.valor}
                defaultChecked={diasSet.has(d.valor)}
                className="accent-[var(--magenta)]"
              />
              {d.etiqueta}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="grid gap-1 text-[13.5px] max-w-[12rem]">
        <span className="font-semibold">Hora</span>
        <select
          name="hora"
          defaultValue={prefs.hora}
          className="rounded-lg border border-linea bg-papel px-3 py-2 text-tinta"
        >
          {HORAS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
          {!HORAS.includes(prefs.hora as (typeof HORAS)[number]) ? (
            <option value={prefs.hora}>{prefs.hora}</option>
          ) : null}
        </select>
      </label>

      <div>
        <Boton className="boton" textoEnviando="Guardando…">
          Guardar notificaciones
        </Boton>
      </div>
    </form>
  );
}
