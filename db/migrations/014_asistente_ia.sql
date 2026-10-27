-- Migración: asistente IA (conversaciones, mensajes, uso) + ultimo_acceso_en
-- Ejecutar en Cloud SQL Studio (base `orbita`) si el schema ya estaba aplicado.

ALTER TABLE usuarios
  ADD COLUMN ultimo_acceso_en DATETIME(3) NULL AFTER google_token_expiry;

CREATE TABLE IF NOT EXISTS ia_conversaciones (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  usuario_id      CHAR(36)     NOT NULL,
  titulo          VARCHAR(200) NOT NULL,
  creado_en       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                ON UPDATE CURRENT_TIMESTAMP(3),
  KEY ix_ia_conv_usuario (usuario_id),
  KEY ix_ia_conv_actualizado (actualizado_en),
  CONSTRAINT fk_ia_conv_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ia_mensajes (
  id                CHAR(36)     NOT NULL PRIMARY KEY,
  conversacion_id   CHAR(36)     NOT NULL,
  rol               VARCHAR(16)  NOT NULL,
  contenido         MEDIUMTEXT   NOT NULL,
  tool_name         VARCHAR(64)  NULL,
  creado_en         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_ia_msg_conv (conversacion_id, creado_en),
  CONSTRAINT fk_ia_msg_conv
    FOREIGN KEY (conversacion_id) REFERENCES ia_conversaciones(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ia_uso (
  id                CHAR(36)       NOT NULL PRIMARY KEY,
  usuario_id        CHAR(36)       NOT NULL,
  conversacion_id   CHAR(36)       NULL,
  modelo            VARCHAR(64)    NOT NULL,
  input_tokens      INT UNSIGNED   NOT NULL DEFAULT 0,
  output_tokens     INT UNSIGNED   NOT NULL DEFAULT 0,
  coste_usd         DECIMAL(12, 6) NOT NULL DEFAULT 0,
  creado_en         DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_ia_uso_usuario (usuario_id, creado_en),
  KEY ix_ia_uso_conv (conversacion_id),
  CONSTRAINT fk_ia_uso_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_ia_uso_conv
    FOREIGN KEY (conversacion_id) REFERENCES ia_conversaciones(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
