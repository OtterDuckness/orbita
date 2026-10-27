-- Migración: chat local de tarea + adjuntos ligados a tarea.
-- Ejecutar en Cloud SQL Studio (base `orbita`) si el schema ya estaba aplicado.

CREATE TABLE IF NOT EXISTS tarea_mensajes (
  id         CHAR(36) NOT NULL PRIMARY KEY,
  tarea_id   CHAR(36) NOT NULL,
  autor_id   CHAR(36) NOT NULL,
  cuerpo     TEXT     NOT NULL,
  creado_en  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_tarea_mensajes_tarea (tarea_id, creado_en),
  CONSTRAINT fk_tarea_mensajes_tarea
    FOREIGN KEY (tarea_id) REFERENCES tareas (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_tarea_mensajes_autor
    FOREIGN KEY (autor_id) REFERENCES usuarios (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE adjuntos
  ADD COLUMN tarea_id CHAR(36) NULL AFTER mensaje_id;

ALTER TABLE adjuntos
  ADD KEY ix_adjuntos_tarea (tarea_id);

ALTER TABLE adjuntos
  ADD CONSTRAINT fk_adjuntos_tarea
    FOREIGN KEY (tarea_id) REFERENCES tareas (id)
    ON DELETE CASCADE;
