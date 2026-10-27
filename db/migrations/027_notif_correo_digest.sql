-- Migración: preferencias de digest por correo + log de envíos (idempotencia).
-- Ejecutar en Cloud SQL Studio (base `orbita`) si el schema ya estaba aplicado.
--
-- usuario_notif_prefs: días (ISO 1=lun…7=dom) + hora Europe/Madrid.
-- digest_envios: evita duplicar si Cloud Scheduler reintenta el mismo día.

CREATE TABLE IF NOT EXISTS usuario_notif_prefs (
  usuario_id     CHAR(36)     NOT NULL PRIMARY KEY,
  activo         TINYINT(1)   NOT NULL DEFAULT 0,
  dias           JSON         NOT NULL,
  hora           CHAR(5)      NOT NULL DEFAULT '09:00',
  actualizado_en DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_unp_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON DELETE CASCADE,
  CONSTRAINT chk_unp_hora CHECK (hora REGEXP '^[0-2][0-9]:[0-5][0-9]$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS digest_envios (
  id           CHAR(36)     NOT NULL PRIMARY KEY,
  usuario_id   CHAR(36)     NOT NULL,
  ymd          CHAR(10)     NOT NULL,
  tipo         VARCHAR(16)  NOT NULL DEFAULT 'digest',
  enviado_en   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  provider_id  VARCHAR(128) NULL,
  UNIQUE KEY uq_digest_usuario_ymd_tipo (usuario_id, ymd, tipo),
  KEY ix_digest_ymd (ymd),
  CONSTRAINT fk_digest_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
