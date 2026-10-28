-- Migración: perfiles de permisos
-- Ejecutar en Cloud SQL Studio (base `orbita`) si el schema ya estaba aplicado.

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

ALTER TABLE usuarios ADD COLUMN perfil_id CHAR(36) NULL AFTER es_admin;
ALTER TABLE usuarios ADD KEY ix_usuarios_perfil (perfil_id);
ALTER TABLE usuarios
  ADD CONSTRAINT fk_usuarios_perfil
    FOREIGN KEY (perfil_id) REFERENCES perfiles (id)
    ON DELETE SET NULL;

-- Perfil Completo (todos los permisos del catálogo app)
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
  ('a0000000-0000-4000-8000-000000000001', 'comunicaciones.editar')
ON DUPLICATE KEY UPDATE permiso = VALUES(permiso);

UPDATE usuarios
SET perfil_id = 'a0000000-0000-4000-8000-000000000001'
WHERE rol = 'interna';
