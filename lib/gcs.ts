import { randomUUID } from "crypto";
import { Storage } from "@google-cloud/storage";

export const GCS_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

const MIME_PERMITIDOS = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
]);

let storage: Storage | null = null;

function getStorage(): Storage {
  if (!storage) storage = new Storage();
  return storage;
}

export function nombreBucket(): string {
  const b = process.env.GCS_BUCKET?.trim();
  if (!b) throw new Error("Falta GCS_BUCKET");
  return b;
}

export function mimePermitido(mime: string | null | undefined): boolean {
  if (!mime) return false;
  return MIME_PERMITIDOS.has(mime.toLowerCase());
}

/** Nombre de archivo seguro para la ruta del objeto. */
export function nombreSeguro(nombreRaw: string): string {
  const base = nombreRaw.trim().replace(/[/\\?%*:|"<>]/g, "_").slice(0, 180);
  return base || "archivo";
}

async function conPrefijoSandbox(path: string): Promise<string> {
  const { esModoPruebas } = await import("@/lib/sandbox");
  if (await esModoPruebas()) return `pruebas/${path}`;
  return path;
}

export async function objectPathChat(
  conversacionId: string,
  mensajeId: string,
  nombre: string,
): Promise<string> {
  return conPrefijoSandbox(
    `chat/${conversacionId}/${mensajeId}/${randomUUID()}-${nombreSeguro(nombre)}`,
  );
}

export async function objectPathTarea(tareaId: string, nombre: string): Promise<string> {
  return conPrefijoSandbox(`tareas/${tareaId}/${randomUUID()}-${nombreSeguro(nombre)}`);
}

export async function objectPathAvatar(usuarioId: string, nombre: string): Promise<string> {
  return conPrefijoSandbox(`avatars/${usuarioId}/${randomUUID()}-${nombreSeguro(nombre)}`);
}

/** Solo imágenes para foto de perfil. */
export function mimeImagenPermitido(mime: string | null | undefined): boolean {
  if (!mime) return false;
  const m = mime.toLowerCase();
  return m === "image/jpeg" || m === "image/png" || m === "image/gif" || m === "image/webp";
}

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export async function subirObjeto(params: {
  objectPath: string;
  buffer: Buffer;
  mime: string;
}): Promise<void> {
  const bucket = getStorage().bucket(nombreBucket());
  const file = bucket.file(params.objectPath);
  await file.save(params.buffer, {
    resumable: false,
    contentType: params.mime,
    metadata: { contentType: params.mime },
  });
}

export async function leerObjeto(
  objectPath: string,
): Promise<{ buffer: Buffer; contentType: string | undefined }> {
  const bucket = getStorage().bucket(nombreBucket());
  const file = bucket.file(objectPath);
  const [buffer] = await file.download();
  const [meta] = await file.getMetadata();
  return {
    buffer,
    contentType: typeof meta.contentType === "string" ? meta.contentType : undefined,
  };
}

export async function borrarObjeto(objectPath: string): Promise<void> {
  const bucket = getStorage().bucket(nombreBucket());
  await bucket.file(objectPath).delete({ ignoreNotFound: true });
}
