-- Migración: logs de auditoría del panel admin
-- Ejecutar en Cloud SQL Studio (base `orbita`) si el schema ya estaba aplicado.

CREATE TABLE IF NOT EXISTS admin_logs (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  actor_id      CHAR(36)     NULL,
  actor_correo  VARCHAR(255) NOT NULL,
  accion        VARCHAR(64)  NOT NULL,
  detalle       VARCHAR(500) NULL,
  meta_json     JSON         NULL,
  creado_en     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_admin_logs_creado (creado_en),
  KEY ix_admin_logs_accion (accion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
