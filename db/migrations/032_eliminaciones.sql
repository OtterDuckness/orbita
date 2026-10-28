-- Migración: papelera de eliminaciones (tareas, proyectos, clientes) con snapshot para undo.
-- Retención: 30 días (expira_en). Restaurar reinserta desde snapshot_json.
-- Ejecutar en Cloud SQL Studio (base `orbita`).

CREATE TABLE IF NOT EXISTS eliminaciones (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  batch_id        CHAR(36)     NOT NULL,
  tipo            ENUM('tarea', 'proyecto', 'cliente') NOT NULL,
  entidad_id      CHAR(36)     NOT NULL,
  etiqueta        VARCHAR(500) NOT NULL,
  snapshot_json   JSON         NOT NULL,
  actor_id        CHAR(36)     NULL,
  actor_correo    VARCHAR(320) NOT NULL,
  eliminado_en    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  restaurado_en   DATETIME(3)  NULL,
  expira_en       DATETIME(3)  NOT NULL,
  KEY ix_eliminaciones_batch (batch_id),
  KEY ix_eliminaciones_tipo_elim (tipo, eliminado_en),
  KEY ix_eliminaciones_pendientes (restaurado_en, expira_en),
  KEY ix_eliminaciones_actor (actor_id),
  CONSTRAINT fk_eliminaciones_actor
    FOREIGN KEY (actor_id) REFERENCES usuarios (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
