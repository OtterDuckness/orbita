-- Migración: sugerencias sobre la app (van a tareas de Órbita / Por pensar).
-- Ejecutar en Cloud SQL Studio (base `orbita`) si el schema ya estaba aplicado.

CREATE TABLE IF NOT EXISTS sugerencias (
  id          CHAR(36)     NOT NULL PRIMARY KEY,
  autor_id    CHAR(36)     NOT NULL,
  titulo      VARCHAR(200) NOT NULL,
  texto       TEXT         NULL,
  tarea_id    CHAR(36)     NOT NULL,
  proyecto_id CHAR(36)     NOT NULL,
  creado_en   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_sugerencias_creado (creado_en),
  KEY ix_sugerencias_autor (autor_id),
  CONSTRAINT fk_sugerencias_autor
    FOREIGN KEY (autor_id) REFERENCES usuarios (id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_sugerencias_tarea
    FOREIGN KEY (tarea_id) REFERENCES tareas (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_sugerencias_proyecto
    FOREIGN KEY (proyecto_id) REFERENCES proyectos (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
