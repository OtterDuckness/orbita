/** Proyecto interno Boostiq (admin embebido del producto). */
export function esProyectoBoostiq(proyecto: {
  nombre: string | null;
  ambito: string;
  personalDeId?: string | null;
}): boolean {
  if (proyecto.personalDeId) return false;
  if (proyecto.ambito !== "interno") return false;
  const n = (proyecto.nombre ?? "").trim().toLowerCase();
  return n === "boostiq";
}
