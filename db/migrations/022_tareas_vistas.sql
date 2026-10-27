-- Migración: registro de tareas vistas por usuario (novedades del Panel).
-- Ejecutar en Cloud SQL Studio (base `orbita`) si el schema ya estaba aplicado.
--
-- Una fila = el usuario abrió/vió esa tarea (desde DetalleTarea).
-- Sirve para "Tareas nuevas sin ver" en el Panel de inicio.

CREATE TABLE IF NOT EXISTS tareas_vistas (
  tarea_id   CHAR(36)    NOT NULL,
  usuario_id CHAR(36)    NOT NULL,
  visto_en   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (tarea_id, usuario_id),
  KEY ix_tv_usuario (usuario_id),
  CONSTRAINT fk_tv_tarea
    FOREIGN KEY (tarea_id) REFERENCES tareas (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_tv_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
