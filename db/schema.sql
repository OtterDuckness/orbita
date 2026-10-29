-- Órbita — esquema MySQL (Cloud SQL) v1.1
-- Fuente de verdad de la estructura de la base `orbita`.
-- Motor: MySQL 8.4 | Charset: utf8mb4
--
-- Cómo aplicar:
--   - Base vacía / nueva: ejecuta este archivo completo en Cloud SQL Studio.
--   - Base que ya tenía v1 (roles.id UUID + usuarios.rol_id): ejecuta antes
--     db/migrate_roles_codigo.sql, luego no hace falta re-ejecutar todo esto.
--   - Tokens Google Calendar: si `usuarios` ya existía sin google_*:
--     db/migrations/001_usuarios_google_tokens.sql
--
-- v1.1: roles.codigo es PK; usuarios.rol referencia ese codigo (filtro fácil).
-- v1: clientes, tipos, proyectos, miembros, columnas, tareas.
-- + google_* en usuarios (OAuth Calendar).
-- + perfiles / perfil_permisos (permisos finos; es_admin gestiona).
-- + notas (TEXT en tareas) + tarea_checklist.
-- + comunicaciones: conversaciones, miembros, mensajes, refs, adjuntos (GCS).
-- Migraciones parciales (BD ya creada):
--   - Perfiles: db/migrations/002_perfiles.sql
--   - Permisos usuario: db/migrations/003_usuario_permisos.sql
--   - Notas/checklist: db/migrations/004_tareas_notas_checklist.sql
--   - Estado proyectos: db/migrations/007_proyectos_estado.sql
--   - Tipos activo: db/migrations/008_tipos_proyecto_activo.sql
--   - Comunicaciones: db/migrations/009_comunicaciones.sql
--   - Adjuntos GCS: db/migrations/010_adjuntos_gcs.sql
--   - Proyecto Personal (/tareas): db/migrations/017_tareas_personales.sql
--   - Chat/adjuntos de tarea: db/migrations/018_tarea_chat_adjuntos.sql
--   - Notas proyecto/cliente: db/migrations/021_notas.sql

-- ---------------------------------------------------------------------------
-- 1. Roles (PK = codigo: interna | externa | auditorial)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS roles (
  codigo          VARCHAR(32)  NOT NULL PRIMARY KEY,
  nombre          VARCHAR(100) NOT NULL,
  creado_en       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO roles (codigo, nombre) VALUES
  ('interna',    'Interna'),
  ('externa',    'Externa'),
  ('auditorial', 'Auditorial')
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  actualizado_en = CURRENT_TIMESTAMP(3);

-- ---------------------------------------------------------------------------
-- 2. Clientes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS clientes (
  id                      CHAR(36)     NOT NULL PRIMARY KEY,
  nombre                  VARCHAR(255) NOT NULL,
  correo_acceso           VARCHAR(320) NOT NULL,
  telefono                VARCHAR(16)  NULL,
  responsable_id          CHAR(36)     NULL,
  tipo_cuenta             ENUM('b2b', 'kit_digital') NULL,
  origen                  ENUM('manual', 'clientify') NOT NULL DEFAULT 'manual',
  invitacion_enviada      TINYINT(1)   NOT NULL DEFAULT 0,
  invitacion_enviada_en   DATETIME(3)  NULL,
  creado_en               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                        ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_clientes_correo_acceso (correo_acceso),
  UNIQUE KEY uq_clientes_nombre (nombre),
  KEY ix_clientes_responsable (responsable_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 3. Usuarios (base + rol por codigo + admin + tokens Google)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS usuarios (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  nombre          VARCHAR(255) NOT NULL,
  correo          VARCHAR(320) NOT NULL,
  rol             VARCHAR(32)  NULL,
  es_admin        TINYINT(1)   NOT NULL DEFAULT 0,
  cliente_id      CHAR(36)     NULL,
  perfil_id       CHAR(36)     NULL,
  google_refresh_token TEXT    NULL,
  google_access_token  TEXT    NULL,
  google_token_expiry  DATETIME(3) NULL,
  avatar_gcs      VARCHAR(512) NULL,
  timezone        VARCHAR(64)  NOT NULL DEFAULT 'Europe/Madrid',
  ultimo_acceso_en DATETIME(3) NULL,
  creado_en       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_usuarios_correo (correo),
  KEY ix_usuarios_rol (rol),
  KEY ix_usuarios_cliente (cliente_id),
  KEY ix_usuarios_perfil (perfil_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE usuarios
  ADD CONSTRAINT fk_usuarios_rol
    FOREIGN KEY (rol) REFERENCES roles (codigo);

ALTER TABLE usuarios
  ADD CONSTRAINT fk_usuarios_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes (id)
    ON DELETE SET NULL;

-- Responsable de cuenta (clientes → usuarios); la columna ya está en CREATE clientes.
ALTER TABLE clientes
  ADD CONSTRAINT fk_clientes_responsable
    FOREIGN KEY (responsable_id) REFERENCES usuarios (id)
    ON DELETE SET NULL;

-- Equipo ficticio. Mikhail es el admin de la demo. El resto son colaboradores.
INSERT INTO usuarios (id, nombre, correo, rol, es_admin) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'Mikhail Tolub', 'mikhailtolub@gmail.com', 'interna', 1),
  ('b0000000-0000-4000-8000-000000000002', 'Nora Vidal', 'nora.vidal@example.com', 'interna', 0),
  ('b0000000-0000-4000-8000-000000000003', 'Hugo Serra', 'hugo.serra@example.com', 'interna', 0),
  ('b0000000-0000-4000-8000-000000000004', 'Lea Costa', 'lea.costa@example.com', 'interna', 0),
  ('b0000000-0000-4000-8000-000000000005', 'Martín Ruiz', 'martin.ruiz@example.com', 'interna', 0),
  ('b0000000-0000-4000-8000-000000000006', 'Elsa Prieto', 'elsa.prieto@example.com', 'interna', 0)
ON DUPLICATE KEY UPDATE
  nombre   = VALUES(nombre),
  correo   = VALUES(correo),
  rol      = VALUES(rol),
  es_admin = VALUES(es_admin),
  actualizado_en = CURRENT_TIMESTAMP(3);

-- ---------------------------------------------------------------------------
-- 3b. Perfiles de permisos
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS perfiles (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  nombre          VARCHAR(100) NOT NULL,
  descripcion     VARCHAR(500) NULL,
  creado_en       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_perfiles_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS perfil_permisos (
  perfil_id  CHAR(36)    NOT NULL,
  permiso    VARCHAR(64) NOT NULL,
  PRIMARY KEY (perfil_id, permiso),
  CONSTRAINT fk_perfil_permisos_perfil
    FOREIGN KEY (perfil_id) REFERENCES perfiles (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usuario_permisos (
  usuario_id  CHAR(36)    NOT NULL,
  permiso     VARCHAR(64) NOT NULL,
  PRIMARY KEY (usuario_id, permiso),
  CONSTRAINT fk_usuario_permisos_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE usuarios
  ADD CONSTRAINT fk_usuarios_perfil
    FOREIGN KEY (perfil_id) REFERENCES perfiles (id)
    ON DELETE SET NULL;

INSERT INTO perfiles (id, nombre, descripcion) VALUES
  (
    'a0000000-0000-4000-8000-000000000001',
    'Completo',
    'Acceso total a módulos internos (clientes, proyectos, tareas, comunicaciones).'
  )
ON DUPLICATE KEY UPDATE
  descripcion = VALUES(descripcion),
  actualizado_en = CURRENT_TIMESTAMP(3);

INSERT INTO perfil_permisos (perfil_id, permiso) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'clientes.ver'),
  ('a0000000-0000-4000-8000-000000000001', 'clientes.editar'),
  ('a0000000-0000-4000-8000-000000000001', 'proyectos.ver'),
  ('a0000000-0000-4000-8000-000000000001', 'proyectos.editar'),
  ('a0000000-0000-4000-8000-000000000001', 'tareas.ver'),
  ('a0000000-0000-4000-8000-000000000001', 'tareas.editar'),
  ('a0000000-0000-4000-8000-000000000001', 'comunicaciones.ver'),
  ('a0000000-0000-4000-8000-000000000001', 'comunicaciones.editar'),
  ('a0000000-0000-4000-8000-000000000001', 'correo.ver'),
  ('a0000000-0000-4000-8000-000000000001', 'correo.editar'),
  ('a0000000-0000-4000-8000-000000000001', 'asistente.web')
ON DUPLICATE KEY UPDATE permiso = VALUES(permiso);

UPDATE usuarios
SET perfil_id = 'a0000000-0000-4000-8000-000000000001'
WHERE rol = 'interna';

INSERT IGNORE INTO usuario_permisos (usuario_id, permiso)
SELECT u.id, pp.permiso
FROM usuarios u
INNER JOIN perfil_permisos pp ON pp.perfil_id = u.perfil_id
WHERE u.rol = 'interna';

-- ---------------------------------------------------------------------------
-- 4. Tipos de proyecto
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tipos_proyecto (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  nombre          VARCHAR(100) NOT NULL,
  orden           INT          NOT NULL DEFAULT 0,
  activo          TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_tipos_proyecto_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tipos_proyecto (id, nombre, orden) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'SEO',     0),
  ('c0000000-0000-4000-8000-000000000002', 'Boostiq', 1),
  ('c0000000-0000-4000-8000-000000000003', 'Web',     2),
  ('c0000000-0000-4000-8000-000000000004', 'Ads',     3)
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  orden  = VALUES(orden),
  actualizado_en = CURRENT_TIMESTAMP(3);

-- ---------------------------------------------------------------------------
-- 5. Proyectos
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS proyectos (
  id               CHAR(36)     NOT NULL PRIMARY KEY,
  ambito           ENUM('interno', 'externo') NOT NULL DEFAULT 'interno',
  nombre           VARCHAR(160) NULL,
  cliente_id       CHAR(36)     NULL,
  tipo_id          CHAR(36)     NULL,
  fee_mensual      DECIMAL(10,2) NULL,
  -- Obligatorio a nivel de app (crear/editar). NULL solo por datos legacy.
  fin_contrato     DATE         NULL,
  responsable_id   CHAR(36)     NULL,
  prioridad        ENUM('baja', 'media', 'alta', 'urgente') NOT NULL DEFAULT 'media',
  estado           ENUM('activo', 'terminado', 'archivado') NOT NULL DEFAULT 'activo',
  -- Proyecto oculto "Personal" por usuario (pantalla /tareas); NULL = proyecto normal.
  personal_de_id   CHAR(36)     NULL,
  creado_en        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                 ON UPDATE CURRENT_TIMESTAMP(3),
  KEY ix_proyectos_cliente (cliente_id),
  KEY ix_proyectos_tipo (tipo_id),
  KEY ix_proyectos_responsable (responsable_id),
  KEY ix_proyectos_estado (estado),
  UNIQUE KEY uq_proyectos_personal (personal_de_id),
  CONSTRAINT fk_proyectos_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes (id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_proyectos_tipo
    FOREIGN KEY (tipo_id) REFERENCES tipos_proyecto (id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_proyectos_responsable
    FOREIGN KEY (responsable_id) REFERENCES usuarios (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_proyectos_personal
    FOREIGN KEY (personal_de_id) REFERENCES usuarios (id)
    ON DELETE CASCADE,
  CONSTRAINT chk_proyectos_ambito_cliente CHECK (
    (ambito = 'interno' AND cliente_id IS NULL)
    OR (ambito = 'externo' AND cliente_id IS NOT NULL)
  ),
  CONSTRAINT chk_proyectos_titulo CHECK (
    (ambito = 'interno' AND nombre IS NOT NULL AND tipo_id IS NULL)
    OR (ambito = 'externo' AND tipo_id IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 6. Miembros de proyecto
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS proyecto_miembros (
  proyecto_id  CHAR(36) NOT NULL,
  usuario_id   CHAR(36) NOT NULL,
  asignado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (proyecto_id, usuario_id),
  KEY ix_proyecto_miembros_usuario (usuario_id),
  CONSTRAINT fk_proyecto_miembros_proyecto
    FOREIGN KEY (proyecto_id) REFERENCES proyectos (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_proyecto_miembros_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 7. Columnas del tablero
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS columnas (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  proyecto_id     CHAR(36)     NOT NULL,
  nombre          VARCHAR(255) NOT NULL,
  fija            TINYINT(1)   NOT NULL DEFAULT 0,
  orden           INT          NOT NULL DEFAULT 0,
  creado_en       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                ON UPDATE CURRENT_TIMESTAMP(3),
  KEY ix_columnas_proyecto_orden (proyecto_id, orden),
  CONSTRAINT fk_columnas_proyecto
    FOREIGN KEY (proyecto_id) REFERENCES proyectos (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Preferencia por usuario: ocultar apartado en el tablero (no borra datos).
CREATE TABLE IF NOT EXISTS columnas_ocultas_usuario (
  usuario_id CHAR(36) NOT NULL,
  columna_id CHAR(36) NOT NULL,
  PRIMARY KEY (usuario_id, columna_id),
  KEY ix_cou_columna (columna_id),
  CONSTRAINT fk_cou_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_cou_columna
    FOREIGN KEY (columna_id) REFERENCES columnas (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 8. Tareas (responsable_ids = JSON array de UUID; validar en la app)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tareas (
  id                CHAR(36)     NOT NULL PRIMARY KEY,
  proyecto_id       CHAR(36)     NOT NULL,
  columna_id        CHAR(36)     NOT NULL,
  nombre            VARCHAR(500) NOT NULL,
  fecha_prevista    DATE         NULL,
  fecha_maxima      DATE         NULL,
  sync_calendar     TINYINT(1)   NOT NULL DEFAULT 0,
  notificar_asignado TINYINT(1)  NOT NULL DEFAULT 0,
  calendar_event_id VARCHAR(255) NULL,
  mandada_por_id    CHAR(36)     NULL,
  responsable_ids   JSON         NOT NULL,
  prioridad         ENUM('baja', 'media', 'alta', 'urgente') NOT NULL DEFAULT 'media',
  dificultad        TINYINT UNSIGNED NOT NULL DEFAULT 3,
  notas             TEXT         NULL,
  notas_autor_id    CHAR(36)     NULL,
  notas_creado_en   DATETIME(3)  NULL,
  completada_en     DATETIME(3)  NULL,
  orden             INT          NOT NULL DEFAULT 0,
  creado_en         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                  ON UPDATE CURRENT_TIMESTAMP(3),
  KEY ix_tareas_proyecto (proyecto_id),
  KEY ix_tareas_columna_orden (columna_id, orden),
  KEY ix_tareas_mandada_por (mandada_por_id),
  KEY ix_tareas_notas_autor (notas_autor_id),
  CONSTRAINT fk_tareas_proyecto
    FOREIGN KEY (proyecto_id) REFERENCES proyectos (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_tareas_columna
    FOREIGN KEY (columna_id) REFERENCES columnas (id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_tareas_mandada_por
    FOREIGN KEY (mandada_por_id) REFERENCES usuarios (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_tareas_notas_autor
    FOREIGN KEY (notas_autor_id) REFERENCES usuarios (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 9. Checklist de tarea
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 10. Comunicaciones (dm | grupo | cliente)
-- ---------------------------------------------------------------------------

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
  tarea_id        CHAR(36)     NULL,
  gcs_object      VARCHAR(512) NOT NULL,
  nombre          VARCHAR(500) NOT NULL,
  mime            VARCHAR(255) NULL,
  tamano_bytes    BIGINT       NULL,
  creado_en       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_adjuntos_gcs_object (gcs_object),
  KEY ix_adjuntos_mensaje (mensaje_id),
  KEY ix_adjuntos_tarea (tarea_id),
  CONSTRAINT fk_adjuntos_mensaje
    FOREIGN KEY (mensaje_id) REFERENCES mensajes (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_adjuntos_tarea
    FOREIGN KEY (tarea_id) REFERENCES tareas (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 10b. Chat local de tarea (no aparece en Comunicaciones)
-- ---------------------------------------------------------------------------

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

CREATE TABLE IF NOT EXISTS tarea_chat_vistos (
  tarea_id    CHAR(36)    NOT NULL,
  usuario_id  CHAR(36)    NOT NULL,
  visto_en    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (tarea_id, usuario_id),
  KEY ix_tcv_usuario (usuario_id),
  CONSTRAINT fk_tcv_tarea
    FOREIGN KEY (tarea_id) REFERENCES tareas (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_tcv_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS asignaciones_vistas (
  proyecto_id CHAR(36)    NOT NULL,
  usuario_id  CHAR(36)    NOT NULL,
  visto_en    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (proyecto_id, usuario_id),
  KEY ix_av_usuario (usuario_id),
  CONSTRAINT fk_av_proyecto
    FOREIGN KEY (proyecto_id) REFERENCES proyectos (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_av_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Digest por correo (prefs + log de envíos)
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Notas de proyecto / cliente
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notas (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  texto           TEXT         NOT NULL,
  autor_id        CHAR(36)     NOT NULL,
  creado_en       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                 ON UPDATE CURRENT_TIMESTAMP(3),
  -- Proyecto: proyecto_id + cliente_id desnormalizado (NULL si interno).
  -- Cliente (futuro): cliente_id, proyecto_id NULL.
  proyecto_id     CHAR(36)     NULL,
  cliente_id      CHAR(36)     NULL,
  KEY ix_notas_proyecto (proyecto_id),
  KEY ix_notas_cliente (cliente_id),
  KEY ix_notas_autor (autor_id),
  KEY ix_notas_creado (creado_en),
  CONSTRAINT fk_notas_autor
    FOREIGN KEY (autor_id) REFERENCES usuarios (id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_notas_proyecto
    FOREIGN KEY (proyecto_id) REFERENCES proyectos (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_notas_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes (id)
    ON DELETE CASCADE,
  CONSTRAINT chk_notas_ambito CHECK (
    proyecto_id IS NOT NULL OR cliente_id IS NOT NULL
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 5. Auditoría panel admin
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS admin_logs (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  actor_id        CHAR(36)     NULL,
  actor_correo    VARCHAR(255) NOT NULL,
  accion          VARCHAR(64)  NOT NULL,
  detalle         VARCHAR(500) NULL,
  meta_json       JSON         NULL,
  creado_en       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  nota            TEXT         NULL,
  nota_autor_id   CHAR(36)     NULL,
  nota_creado_en  DATETIME(3)  NULL,
  KEY ix_admin_logs_creado (creado_en),
  KEY ix_admin_logs_accion (accion),
  KEY ix_admin_logs_nota_autor (nota_autor_id),
  CONSTRAINT fk_admin_logs_nota_autor
    FOREIGN KEY (nota_autor_id) REFERENCES usuarios (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 6. Ajustes globales (clave/valor)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ajustes (
  clave           VARCHAR(64)  NOT NULL PRIMARY KEY,
  valor           VARCHAR(255) NOT NULL,
  actualizado_en  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  actualizado_por CHAR(36)     NULL,
  CONSTRAINT fk_ajustes_usuario
    FOREIGN KEY (actualizado_por) REFERENCES usuarios(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO ajustes (clave, valor) VALUES ('proyectos_url_abierta', '0');
INSERT IGNORE INTO ajustes (clave, valor) VALUES ('agente_ia_activo', '0');
INSERT IGNORE INTO ajustes (clave, valor) VALUES ('apartado_correo', '1');

-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- Sugerencias de producto (inbox admin → tarea en Órbita / Por hacer)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sugerencias (
  id          CHAR(36)     NOT NULL PRIMARY KEY,
  autor_id    CHAR(36)     NOT NULL,
  titulo      VARCHAR(200) NOT NULL,
  texto       TEXT         NULL,
  tarea_id    CHAR(36)     NULL,
  proyecto_id CHAR(36)     NOT NULL,
  estado      ENUM('pendiente', 'convertida') NOT NULL DEFAULT 'pendiente',
  creado_en   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_sugerencias_creado (creado_en),
  KEY ix_sugerencias_autor (autor_id),
  KEY ix_sugerencias_estado (estado),
  CONSTRAINT fk_sugerencias_autor
    FOREIGN KEY (autor_id) REFERENCES usuarios (id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_sugerencias_tarea
    FOREIGN KEY (tarea_id) REFERENCES tareas (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_sugerencias_proyecto
    FOREIGN KEY (proyecto_id) REFERENCES proyectos (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 14. Asistente IA
-- ---------------------------------------------------------------------------

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
  cache_creation_tokens INT UNSIGNED NOT NULL DEFAULT 0,
  cache_read_tokens INT UNSIGNED   NOT NULL DEFAULT 0,
  web_search_requests INT UNSIGNED NOT NULL DEFAULT 0,
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

-- ---------------------------------------------------------------------------
-- Papelera (undo de tareas / proyectos / clientes; retención 30 días)
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Acciones reversibles (deshacer UI + asistente; retención 7 días)
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Notas de diseño
-- - Filtrar usuarios: WHERE rol = 'interna' (no hace falta JOIN).
-- - Ámbito de proyecto sigue siendo interno/externo (distinto del rol).
-- - Permisos finos: perfiles (plantilla) + usuario_permisos (efectivos por persona).
-- - Calendar: tokens en usuarios; event id por tarea en calendar_event_id.
-- - Notas: un texto por tarea (columnas notas_*); sin historial multi-nota.
-- - Comunicaciones: un modelo para dm/grupo/cliente; adjuntos vía GCS (gcs_object).
-- - Proyecto Personal: proyectos.personal_de_id (uno por usuario); oculto en listados.
-- - Chat de tarea: tarea_mensajes (local); adjuntos.tarea_id para archivos de tarea.
-- - Novedades: asignaciones_vistas + tarea_chat_vistos (+ tareas_vistas en migración 022).
-- - mensaje_referencias enlaza clientes/proyectos sin FK rígida (entidad polimórfica).
-- - admin_logs: auditoría + historial de ficha (clientes); nota_* = anotación opcional por evento.
-- - notas: anotaciones de proyecto (y futuro cliente); cliente_id desnormalizado para agregación.
-- - ajustes: flags globales (p. ej. acceso por URL a proyectos ajenos).
-- - sugerencias: pendientes en admin; al confirmar → tarea en Órbita / Por hacer.
-- - columnas_ocultas_usuario: preferencia sync de apartados ocultos por persona.
-- - ia_*: conversaciones del asistente, mensajes y uso/coste por turno.
-- - eliminaciones: papelera con snapshot JSON; undo 30 días (tarea/proyecto/cliente).
-- - acciones_reversibles: deshacer acciones UI/asistente (~7 días); UI /ajustes/deshacer.
-- - usuarios.timezone: IANA (default Europe/Madrid); display vía lib/formato + preferencia Ajustes.
-- ---------------------------------------------------------------------------
