-- Migración: historial de acciones reversibles del usuario (UI + asistente).
-- Retención: 7 días (expira_en). Deshacer aplica before_json / restaurar papelera.
-- Ejecutar en Cloud SQL Studio (base `orbita`).

CREATE TABLE IF NOT EXISTS acciones_reversibles (
  id               CHAR(36)     NOT NULL PRIMARY KEY,
  actor_id         CHAR(36)     NOT NULL,
  via              ENUM('ui', 'asistente') NOT NULL DEFAULT 'ui',
  tipo             VARCHAR(64)  NOT NULL,
  etiqueta         VARCHAR(500) NOT NULL,
  entidad_tipo     VARCHAR(32)  NULL,
  entidad_id       CHAR(36)     NULL,
  before_json      JSON         NOT NULL,
  after_json       JSON         NULL,
  eliminacion_id   CHAR(36)     NULL,
  conversacion_id  CHAR(36)     NULL,
  creado_en        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expira_en        DATETIME(3)  NOT NULL,
  deshecho_en      DATETIME(3)  NULL,
  KEY ix_acciones_rev_actor_pend (actor_id, deshecho_en, expira_en),
  KEY ix_acciones_rev_creado (creado_en),
  KEY ix_acciones_rev_eliminacion (eliminacion_id),
  CONSTRAINT fk_acciones_rev_actor
    FOREIGN KEY (actor_id) REFERENCES usuarios (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
