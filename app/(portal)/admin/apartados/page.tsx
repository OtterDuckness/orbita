import { APARTADOS, leerApartados } from "@/lib/apartados";
import { exigirAdmin } from "@/lib/authz";
import { Cabecera } from "../../cabecera";
import { Boton } from "../../boton";
import { guardarApartadosAction } from "./acciones";

export const dynamic = "force-dynamic";

export default async function AdminApartadosPage() {
  await exigirAdmin();
  const activos = await leerApartados();

  return (
    <>
      <Cabecera
        etiqueta="Admin"
        titulo="Apartados"
        texto="Qué ve el equipo en el menú lateral. Los administradores siempre entran, también con el apartado apagado. Los permisos de cada persona siguen aplicando."
        sello="global"
      />

      <form action={guardarApartadosAction} className="grid gap-4 max-w-[36rem]">
        {APARTADOS.map((a) => (
          <section key={a.id} className="tarjeta bg-papel p-5 grid gap-4">
            <div>
              <h2 className="font-display font-bold text-[16px] tracking-tight mb-1">
                {a.nombre}
              </h2>
              <p className="text-[13px] text-apagado leading-relaxed">{a.texto}</p>
            </div>

            <label className="flex items-start gap-3 text-[13.5px] cursor-pointer">
              <input
                type="checkbox"
                name={a.id}
                value="1"
                defaultChecked={activos[a.id]}
                className="mt-0.5 accent-[var(--magenta)]"
              />
              <span>
                Disponible para el equipo
                <span className="block text-[12px] text-apagado mt-0.5">
                  Estado actual: {activos[a.id] ? "visible para el equipo" : "solo admins"}
                </span>
              </span>
            </label>
          </section>
        ))}

        <div>
          <Boton className="boton" textoEnviando="Guardando…">
            Guardar
          </Boton>
        </div>
      </form>
    </>
  );
}
