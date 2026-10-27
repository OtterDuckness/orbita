-- Comunicaciones: modelo unificado dm | grupo | cliente.
-- Adjuntos: metadatos + drive_file_id (Shared Drive); bytes fuera de MySQL.
-- Refs: cliente/proyecto enlazables en mensajes.
-- Fase MVP: tipos dm/grupo; tipo cliente y entregar_en preparados para fase posterior.

CREATE TABLE IF NOT EXISTS conversaciones (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  tipo            ENUM('dm', 'grupo', 'cliente') NOT NULL,
  nombre          VARCHAR(255) NULL,
  cliente_id      CHAR(36)     NULL,
  dm_clave        CHAR(73)     NULL,
  creado_por_id   CHAR(36)     NULL,
  creado_en       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_conversaciones_dm_clave (dm_clave),
  KEY ix_conversaciones_tipo (tipo),
  KEY ix_conversaciones_cliente (cliente_id),
  KEY ix_conversaciones_creado_por (creado_por_id),
  CONSTRAINT fk_conversaciones_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes (id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_conversaciones_creado_por
    FOREIGN KEY (creado_por_id) REFERENCES usuarios (id)
    ON DELETE SET NULL,
  CONSTRAINT chk_conversaciones_tipo_cliente CHECK (
    (tipo = 'cliente' AND cliente_id IS NOT NULL)
    OR (tipo <> 'cliente' AND cliente_id IS NULL)
  ),
  CONSTRAINT chk_conversaciones_dm_clave CHECK (
    (tipo = 'dm' AND dm_clave IS NOT NULL)
    OR (tipo <> 'dm' AND dm_clave IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversacion_miembros (
  conversacion_id     CHAR(36)    NOT NULL,
  usuario_id          CHAR(36)    NOT NULL,
  rol                 ENUM('miembro', 'admin') NOT NULL DEFAULT 'miembro',
  ultima_lectura_en   DATETIME(3) NULL,
  unido_en            DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (conversacion_id, usuario_id),
  KEY ix_conversacion_miembros_usuario (usuario_id),
  CONSTRAINT fk_conversacion_miembros_conversacion
    FOREIGN KEY (conversacion_id) REFERENCES conversaciones (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_conversacion_miembros_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mensajes (
  id                CHAR(36)     NOT NULL PRIMARY KEY,
  conversacion_id   CHAR(36)     NOT NULL,
  autor_id          CHAR(36)     NOT NULL,
  cuerpo            TEXT         NOT NULL,
  entregar_en       DATETIME(3)  NULL,
  creado_en         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                  ON UPDATE CURRENT_TIMESTAMP(3),
  KEY ix_mensajes_conversacion_creado (conversacion_id, creado_en),
  KEY ix_mensajes_autor (autor_id),
  KEY ix_mensajes_entregar_en (entregar_en),
  CONSTRAINT fk_mensajes_conversacion
    FOREIGN KEY (conversacion_id) REFERENCES conversaciones (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_mensajes_autor
    FOREIGN KEY (autor_id) REFERENCES usuarios (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mensaje_referencias (
  id          CHAR(36) NOT NULL PRIMARY KEY,
  mensaje_id  CHAR(36) NOT NULL,
  tipo        ENUM('cliente', 'proyecto') NOT NULL,
  entidad_id  CHAR(36) NOT NULL,
  UNIQUE KEY uq_mensaje_referencias (mensaje_id, tipo, entidad_id),
  KEY ix_mensaje_referencias_entidad (tipo, entidad_id),
  CONSTRAINT fk_mensaje_referencias_mensaje
    FOREIGN KEY (mensaje_id) REFERENCES mensajes (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS adjuntos (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  mensaje_id      CHAR(36)     NULL,
  drive_file_id   VARCHAR(128) NOT NULL,
  nombre          VARCHAR(500) NOT NULL,
  mime            VARCHAR(255) NULL,
  tamano_bytes    BIGINT       NULL,
  creado_en       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_adjuntos_drive_file (drive_file_id),
  KEY ix_adjuntos_mensaje (mensaje_id),
  CONSTRAINT fk_adjuntos_mensaje
    FOREIGN KEY (mensaje_id) REFERENCES mensajes (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
