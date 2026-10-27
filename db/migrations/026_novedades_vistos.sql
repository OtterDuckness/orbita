-- Migración: vistos de asignaciones a proyecto + chat de tarea (novedades / punto amarillo).
-- Antes numerada 025; renombrada a 026 tras merge con columnas_ocultas (025).
-- Ejecutar en Cloud SQL Studio (base `orbita`) si el schema ya estaba aplicado.
-- Si ya aplicaste el contenido como 025_novedades_vistos, no hace falta volver a ejecutar.
--
-- asignaciones_vistas: el usuario abrió el proyecto tras ser asignado.
-- tarea_chat_vistos: última vez que abrió el chat de esa tarea.

CREATE TABLE IF NOT EXISTS asignaciones_vistas (
  proyecto_id CHAR(36)    NOT NULL,
  usuario_id  CHAR(36)    NOT NULL,
  visto_en    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (proyecto_id, usuario_id),
  KEY ix_av_usuario (usuario_id),
  CONSTRAINT fk_av_proyecto
    FOREIGN KEY (proyecto_id) REFERENCES proyectos (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_av_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tarea_chat_vistos (
  tarea_id    CHAR(36)    NOT NULL,
  usuario_id  CHAR(36)    NOT NULL,
  visto_en    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (tarea_id, usuario_id),
  KEY ix_tcv_usuario (usuario_id),
  CONSTRAINT fk_tcv_tarea
    FOREIGN KEY (tarea_id) REFERENCES tareas (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_tcv_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
