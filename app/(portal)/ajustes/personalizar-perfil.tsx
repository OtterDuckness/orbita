"use client";

import { useRef, useState } from "react";
import { Boton } from "../boton";
import { AvatarUsuario } from "../avatar-usuario";
import { guardarPerfilAction } from "./acciones-perfil";

export function PersonalizarPerfil({
  nombre,
  email,
  avatarUrl,
}: {
  nombre: string;
  email: string;
  avatarUrl: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [quitar, setQuitar] = useState(false);

  const mostrado = quitar ? null : preview ?? avatarUrl;

  return (
    <form
      action={guardarPerfilAction}
      className="tarjeta bg-papel p-4 grid gap-4 max-w-md"
      encType="multipart/form-data"
    >
      <p className="text-[13.5px] text-apagado leading-relaxed">
        Nombre y foto visibles en el portal (menú, tareas, chat, notas…). El correo viene de Google
        y no se puede cambiar aquí.
      </p>

      <div className="flex items-center gap-3">
        <AvatarUsuario nombre={nombre} avatarUrl={mostrado} tamano="lg" />
        <div className="min-w-0 grid gap-1.5">
          <input
            ref={fileRef}
            type="file"
            name="avatar"
            accept="image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp"
            className="text-[12.5px] text-apagado file:mr-2 file:rounded-lg file:border file:border-linea
                       file:bg-suave file:px-2.5 file:py-1 file:text-[12px] file:font-semibold
                       file:text-tinta hover:file:border-magenta-borde"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (preview) URL.revokeObjectURL(preview);
              if (!f) {
                setPreview(null);
                return;
              }
              setQuitar(false);
              setPreview(URL.createObjectURL(f));
            }}
          />
          {avatarUrl && !quitar ? (
            <button
              type="button"
              className="justify-self-start text-[12px] text-apagado underline-offset-2 hover:underline hover:text-magenta-texto"
              onClick={() => {
                setQuitar(true);
                setPreview(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              Quitar foto
            </button>
          ) : null}
          {quitar ? (
            <button
              type="button"
              className="justify-self-start text-[12px] text-apagado underline-offset-2 hover:underline hover:text-magenta-texto"
              onClick={() => setQuitar(false)}
            >
              Mantener foto actual
            </button>
          ) : null}
        </div>
      </div>
      <input type="hidden" name="quitar_avatar" value={quitar ? "1" : "0"} />

      <label className="grid gap-1">
        <span className="etiqueta">Nombre</span>
        <input
          name="nombre"
          required
          maxLength={255}
          defaultValue={nombre}
          className="control"
          autoComplete="name"
        />
      </label>

      <p className="text-[12px] text-apagado font-mono truncate" title={email}>
        {email}
      </p>

      <div>
        <Boton className="boton" textoEnviando="Guardando…">
          Guardar perfil
        </Boton>
      </div>
    </form>
  );
}
