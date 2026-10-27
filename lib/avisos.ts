export const AVISOS: Record<string, { tono: "bien" | "mal"; texto: string }> = {
  creado: { tono: "bien", texto: "Cuenta creada." },
  creado_invitado: {
    tono: "bien",
    texto: "Cuenta creada y enlace de invitación marcado como enviado (simulado).",
  },
  guardado: { tono: "bien", texto: "Cambios guardados." },
  invitacion_enviada: {
    tono: "bien",
    texto: "Invitación marcada como enviada (simulado; aún no hay correo real).",
  },
  proyecto_creado: { tono: "bien", texto: "Proyecto añadido a la cuenta." },
  proyectos_creados: { tono: "bien", texto: "Proyectos añadidos a la cuenta." },
  proyecto_nuevo: { tono: "bien", texto: "Proyecto creado." },
  proyecto_editado: { tono: "bien", texto: "Proyecto actualizado." },
  proyecto_eliminado: {
    tono: "bien",
    texto: "Proyecto eliminado. Puedes restaurarlo en Eliminados (30 días).",
  },
  cliente_eliminado: {
    tono: "bien",
    texto: "Cliente eliminado. Puedes restaurarlo en Eliminados (30 días).",
  },
  restaurado: { tono: "bien", texto: "Elemento restaurado." },
  ya_restaurado: { tono: "mal", texto: "Ese elemento ya se restauró." },
  deshecho: { tono: "bien", texto: "Acción deshecha." },
  ya_deshecho: { tono: "mal", texto: "Esa acción ya se deshizo." },
  fallo_aplicar: {
    tono: "mal",
    texto: "No se pudo deshacer esta acción.",
  },
  expirado: {
    tono: "mal",
    texto: "Ha caducado; ya no se puede deshacer ni restaurar.",
  },
  conflicto: {
    tono: "mal",
    texto:
      "No se pudo aplicar: el estado actual ya no coincide (conflicto) o hay un duplicado.",
  },
  dependencia_faltante: {
    tono: "mal",
    texto: "No se pudo restaurar: falta el proyecto, columna, cliente o tipo asociado.",
  },
  proyecto_terminado: { tono: "bien", texto: "Proyecto marcado como terminado." },
  proyecto_archivado: { tono: "bien", texto: "Proyecto archivado." },
  proyecto_reactivado: { tono: "bien", texto: "Proyecto reactivado." },
  proyectos_archivados: { tono: "bien", texto: "Proyectos terminados archivados." },
  ningun_terminado: { tono: "mal", texto: "No había proyectos terminados que archivar." },
  tarea_creada: { tono: "bien", texto: "Tarea creada en Por hacer." },
  sugerencia_enviada: {
    tono: "bien",
    texto: "Sugerencia enviada. El equipo admin la revisará.",
  },
  sugerencia_convertida: {
    tono: "bien",
    texto: "Tarea creada en Órbita · Por hacer.",
  },
  sugerencia_borrada: { tono: "bien", texto: "Sugerencia borrada." },
  no_orbita: {
    tono: "mal",
    texto: "No se encontró el proyecto interno Órbita.",
  },
  ya_convertida: {
    tono: "mal",
    texto: "Esa sugerencia ya se convirtió en tarea.",
  },
  no_pendiente: {
    tono: "mal",
    texto: "Solo se pueden borrar sugerencias pendientes.",
  },
  tarea_eliminada: {
    tono: "bien",
    texto: "Tarea eliminada. Puedes restaurarla en Eliminados (30 días).",
  },
  columna_creada: { tono: "bien", texto: "Apartado añadido a este tablero." },
  tarea_movida: { tono: "bien", texto: "Tarea movida." },
  nota_anadida: { tono: "bien", texto: "Nota añadida al hilo." },
  checklist_ok: { tono: "bien", texto: "Checklist actualizado." },
  tarea_guardada: { tono: "bien", texto: "Datos de la tarea guardados." },
  columna_borrada: {
    tono: "bien",
    texto: "Apartado eliminado. Sus tareas volvieron a Por hacer.",
  },
  falta_dato: { tono: "mal", texto: "Falta algún dato obligatorio." },
  /** @deprecated usar correo_duplicado */
  duplicado: { tono: "mal", texto: "Ya existe una cuenta con ese correo de acceso." },
  correo_duplicado: { tono: "mal", texto: "Ya existe una cuenta con ese correo de acceso." },
  nombre_duplicado: { tono: "mal", texto: "Ya existe un cliente con este nombre." },
  correo_invalido: { tono: "mal", texto: "El correo de acceso no es válido." },
  error_bd: {
    tono: "mal",
    texto: "No se pudo guardar. Si estás en modo pruebas, recarga e inténtalo de nuevo.",
  },
  telefono_invalido: {
    tono: "mal",
    texto: "El teléfono debe ser +34 XXX XXX XXX (9 dígitos, empieza por 6–9).",
  },
  tipo_cuenta_invalido: {
    tono: "mal",
    texto: "El tipo de cuenta debe ser Ninguno, B2B o Kit Digital.",
  },
  responsable_invalido: {
    tono: "mal",
    texto: "El responsable de cliente no es válido.",
  },
  cliente_obligatorio: { tono: "mal", texto: "Un proyecto externo necesita un cliente." },
  sin_tipo: { tono: "mal", texto: "Elige un tipo de proyecto." },
  falta_nombre: { tono: "mal", texto: "Ponle un nombre al proyecto interno." },
  tarea_sin_nombre: { tono: "mal", texto: "Escribe un nombre para la tarea." },
  calendar_aviso: {
    tono: "mal",
    texto: "La tarea se guardó, pero no se pudo sincronizar con Google Calendar.",
  },
  no_encontrado: { tono: "mal", texto: "No se encontró ese recurso." },
  tipo_creado: { tono: "bien", texto: "Tipo de proyecto creado." },
  tipo_renombrado: { tono: "bien", texto: "Tipo de proyecto renombrado." },
  tipo_eliminado: { tono: "bien", texto: "Tipo de proyecto retirado del catálogo." },
  tipo_duplicado: { tono: "mal", texto: "Ya existe un tipo con ese nombre." },
  tipo_requiere_reasignacion: {
    tono: "mal",
    texto: "Ese tipo tiene proyectos activos: elige otro tipo al que reasignarlos.",
  },
  zona_guardada: { tono: "bien", texto: "Zona horaria actualizada." },
  zona_invalida: { tono: "mal", texto: "Esa zona horaria no es válida." },
  menu_guardado: { tono: "bien", texto: "Menú lateral actualizado." },
  menu_restablecido: { tono: "bien", texto: "Menú restablecido a los valores por defecto." },
  menu_vacio: { tono: "mal", texto: "Debe quedar al menos una sección visible en el menú." },
  perfil_creado: { tono: "bien", texto: "Perfil creado." },
  perfil_guardado: { tono: "bien", texto: "Perfil actualizado." },
  perfil_eliminado: { tono: "bien", texto: "Perfil eliminado." },
  perfil_asignado: { tono: "bien", texto: "Perfil asignado al usuario." },
  permisos_usuario_guardados: {
    tono: "bien",
    texto: "Accesos del usuario actualizados.",
  },
  perfil_duplicado: { tono: "mal", texto: "Ya existe un perfil con ese nombre." },
  perfil_en_uso: {
    tono: "mal",
    texto: "Ese perfil tiene usuarios asignados. Reasigna antes de eliminarlo.",
  },
  sin_permiso: { tono: "mal", texto: "No tienes permiso para esa acción." },
  usuario_creado: {
    tono: "bien",
    texto: "Usuario interno creado. Ya puede iniciar sesión con Google.",
  },
  usuario_eliminado: { tono: "bien", texto: "Usuario eliminado." },
  usuario_en_uso: {
    tono: "mal",
    texto: "No se puede eliminar: tiene mensajes u otros datos vinculados.",
  },
  no_auto_eliminar: { tono: "mal", texto: "No puedes eliminarte a ti mismo." },
  ultimo_admin: { tono: "mal", texto: "Debe quedar al menos un administrador." },
  admin_actualizado: { tono: "bien", texto: "Rol de administrador actualizado." },
  dm_creado: { tono: "bien", texto: "Conversación directa abierta." },
  grupo_creado: { tono: "bien", texto: "Grupo creado." },
  grupo_sin_miembros: {
    tono: "mal",
    texto: "Elige al menos otra persona para el grupo.",
  },
  mensaje_vacio: {
    tono: "mal",
    texto: "Escribe un mensaje, vincula algo o adjunta un archivo.",
  },
  mismo_usuario: { tono: "mal", texto: "No puedes abrirte un mensaje directo a ti mismo." },
  destino_invalido: { tono: "mal", texto: "Esa persona no está en el equipo." },
  ref_invalida: { tono: "mal", texto: "Ese cliente o proyecto ya no existe." },
  perfil_personal_guardado: {
    tono: "bien",
    texto: "Perfil actualizado.",
  },
  archivo_invalido: {
    tono: "mal",
    texto: "Tipo de archivo no permitido (PDF, imágenes u Office).",
  },
  archivo_grande: { tono: "mal", texto: "El archivo supera el límite permitido." },
  gcs_error: {
    tono: "mal",
    texto: "No se pudo guardar el archivo. Inténtalo de nuevo.",
  },
  digest_prueba_ok: {
    tono: "bien",
    texto: "Digest de prueba enviado a tu correo.",
  },
  digest_prueba_error: {
    tono: "mal",
    texto: "No se pudo enviar el digest de prueba. Revisa RESEND_API_KEY y el dominio en Resend.",
  },
  sandbox_on: {
    tono: "bien",
    texto: "Modo pruebas activado. Esta sesión usa datos mock.",
  },
  sandbox_off: {
    tono: "bien",
    texto: "Has vuelto a la base de datos real.",
  },
  sandbox_sync_ok: {
    tono: "bien",
    texto: "Usuarios internas copiados a la base de pruebas.",
  },
  sandbox_error: {
    tono: "mal",
    texto: "No se pudo usar la base de pruebas. Comprueba que existe orbita_pruebas y el esquema está aplicado.",
  },
  vista_usuario_on: {
    tono: "bien",
    texto: "Vista usuario activada. Esta sesión usa tus permisos de perfil, sin privilegios de admin.",
  },
  vista_usuario_off: {
    tono: "bien",
    texto: "Has vuelto a los privilegios de administrador.",
  },
  vista_mi_zona_trabajador: {
    tono: "bien",
    texto: "Mi Zona: viendo como trabajador.",
  },
  vista_mi_zona_jefe: {
    tono: "bien",
    texto: "Mi Zona: viendo como jefe.",
  },
  vista_mi_zona_off: {
    tono: "bien",
    texto: "Mi Zona: vista admin restaurada.",
  },
  agente_ia_off: {
    tono: "mal",
    texto: "El asistente solo está disponible para administradores.",
  },
  apartado_off: {
    tono: "mal",
    texto: "Este apartado solo está disponible para administradores.",
  },
  herramienta_creada: { tono: "bien", texto: "Herramienta añadida a tu panel." },
  herramienta_actualizada: { tono: "bien", texto: "Herramienta actualizada." },
  herramienta_eliminada: { tono: "bien", texto: "Herramienta quitada de tu panel." },
  url_invalida: {
    tono: "mal",
    texto: "La URL debe empezar por http:// o https://.",
  },
  fichaje_entrada: { tono: "bien", texto: "Entrada fichada en Holded." },
  fichaje_salida: { tono: "bien", texto: "Salida fichada en Holded." },
  fichaje_pausa: { tono: "bien", texto: "Pausa iniciada." },
  fichaje_despausa: { tono: "bien", texto: "Pausa finalizada." },
  ausencia_solicitada: { tono: "bien", texto: "Solicitud de ausencia enviada a Holded." },
  ausencia_aprobada: { tono: "bien", texto: "Ausencia aprobada." },
  holded_vinculo_guardado: { tono: "bien", texto: "ID de empleado Holded guardado." },
  holded_equipo_guardado: { tono: "bien", texto: "Equipo del jefe actualizado." },
  holded_sin_config: {
    tono: "mal",
    texto: "HOLDED_API_KEY no está configurada en el servidor.",
  },
  holded_sin_vinculo: {
    tono: "mal",
    texto: "Este usuario no tiene ID de empleado Holded vinculado.",
  },
  holded_sin_acceso: { tono: "mal", texto: "No tienes permiso sobre ese empleado." },
  holded_approve_no_soportado: {
    tono: "mal",
    texto: "Holded no expone aprobación de ausencias por API. Apruébalas en Holded.",
  },
  holded_error: { tono: "mal", texto: "Error al hablar con Holded." },
  holded_http_401: { tono: "mal", texto: "Token Holded inválido o revocado." },
  holded_http_403: { tono: "mal", texto: "El token Holded no tiene permiso para esta acción." },
  holded_http_404: { tono: "mal", texto: "Recurso no encontrado en Holded." },
  holded_http_501: {
    tono: "mal",
    texto: "Operación no soportada por la API Holded.",
  },
};

/** Mapea motivos de server actions a códigos de AVISOS. */
export function avisoDeMotivo(motivo: string): string {
  if (AVISOS[motivo]) return motivo;
  return "falta_dato";
}
