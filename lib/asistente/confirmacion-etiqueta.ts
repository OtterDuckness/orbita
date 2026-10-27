/** Etiquetas legibles para retos de confirmación (safe para client components). */

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

export function etiquetaTool(tool: string): string {
  switch (tool) {
    case "crear_cliente":
      return "crear el cliente";
    case "editar_cliente":
      return "editar el cliente";
    case "enviar_invitacion_cliente":
      return "enviar la invitación";
    case "eliminar_cliente":
      return "eliminar el cliente";
    case "crear_proyecto":
      return "crear el proyecto";
    case "editar_proyecto":
      return "editar el proyecto";
    case "cambiar_estado_proyecto":
      return "cambiar el estado del proyecto";
    case "eliminar_proyecto":
      return "eliminar el proyecto";
    case "crear_tarea":
      return "crear la tarea";
    case "editar_tarea":
      return "editar la tarea";
    case "mover_tarea":
      return "mover la tarea";
    case "alternar_completada_tarea":
      return "completar/reabrir la tarea";
    case "asignar_responsables_tarea":
      return "asignar responsables";
    case "guardar_notas_tarea":
      return "guardar las notas";
    case "borrar_tarea":
      return "borrar las tareas";
    case "restaurar_eliminado":
      return "restaurar desde la papelera";
    case "deshacer_accion":
      return "deshacer la acción";
    case "crear_grupo":
      return "crear el grupo";
    case "enviar_mensaje":
      return "enviar el mensaje";
    case "enviar_mensaje_tarea":
      return "enviar el mensaje en la tarea";
    default:
      return "continuar";
  }
}

export function etiquetaConfirmacionPendiente(p: {
  tool: string;
  resumen?: string | null;
}): string {
  const raw = p.resumen?.trim();
  if (!raw) return etiquetaTool(p.tool);
  // Red de seguridad: nunca mostrar UUIDs en el lightbox.
  const limpio = raw
    .replace(UUID_RE, "")
    .replace(/\s*«\s*»\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (limpio.length >= 3) return limpio;
  return etiquetaTool(p.tool);
}
