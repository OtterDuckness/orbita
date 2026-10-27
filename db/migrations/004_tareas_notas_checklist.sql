-- Migración: notas (un texto por tarea) + checklist
-- Si una columna/tabla ya existe, omite el ALTER / CREATE correspondiente.

ALTER TABLE tareas ADD COLUMN notas TEXT NULL;
ALTER TABLE tareas ADD COLUMN notas_autor_id CHAR(36) NULL;
ALTER TABLE tareas ADD COLUMN notas_creado_en DATETIME(3) NULL;

ALTER TABLE tareas ADD KEY ix_tareas_notas_autor (notas_autor_id);

ALTER TABLE tareas
  ADD CONSTRAINT fk_tareas_notas_autor
    FOREIGN KEY (notas_autor_id) REFERENCES usuarios (id)
    ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS tarea_checklist (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  tarea_id        CHAR(36)     NOT NULL,
  texto           VARCHAR(500) NOT NULL,
  hecho           TINYINT(1)   NOT NULL DEFAULT 0,
  orden           INT          NOT NULL DEFAULT 0,
  creado_en       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                ON UPDATE CURRENT_TIMESTAMP(3),
  KEY ix_tarea_checklist_tarea_orden (tarea_id, orden),
  CONSTRAINT fk_tarea_checklist_tarea
    FOREIGN KEY (tarea_id) REFERENCES tareas (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
