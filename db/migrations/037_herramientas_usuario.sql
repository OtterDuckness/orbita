-- Migración: accesos directos / herramientas personalizables por usuario.
-- Ejecutar en Cloud SQL Studio (bases `orbita` y `orbita_pruebas` si aplica).
--
-- Preferencia personal: cada usuario tiene su panel; no afecta a otros.

CREATE TABLE IF NOT EXISTS herramientas_usuario (
  id              CHAR(36)      NOT NULL PRIMARY KEY,
  usuario_id      CHAR(36)      NOT NULL,
  nombre          VARCHAR(120)  NOT NULL,
  categoria       VARCHAR(80)   NOT NULL DEFAULT '',
  descripcion     VARCHAR(500)  NOT NULL DEFAULT '',
  url             VARCHAR(2048) NOT NULL,
  orden           INT           NOT NULL DEFAULT 0,
  creado_en       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                 ON UPDATE CURRENT_TIMESTAMP(3),
  KEY ix_hu_usuario_orden (usuario_id, orden),
  CONSTRAINT fk_hu_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
