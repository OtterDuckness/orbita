-- Migración: Mi Zona (Holded HR) — mapping empleado + equipo jefes + perfiles RRHH.
-- Cloud SQL Studio: ejecutar TODO el archivo de una vez.
-- Idempotente. Sin PREPARE (Studio a veces corta el script).

-- ---------------------------------------------------------------------------
-- 0) Diagnóstico (opcional; no falla)
-- ---------------------------------------------------------------------------
-- SELECT id, nombre FROM perfiles ORDER BY nombre;

-- ---------------------------------------------------------------------------
-- 1) Columna holded_employee_id
-- Si ya existe: error "Duplicate column" → ignóralo y sigue con el resto.
-- ---------------------------------------------------------------------------
ALTER TABLE usuarios
  ADD COLUMN holded_employee_id VARCHAR(64) NULL AFTER perfil_id;

-- ---------------------------------------------------------------------------
-- 2) Tabla equipo jefes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuario_holded_equipo (
  jefe_usuario_id       CHAR(36) NOT NULL,
  trabajador_usuario_id CHAR(36) NOT NULL,
  creado_en             DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (jefe_usuario_id, trabajador_usuario_id),
  KEY ix_uhe_trabajador (trabajador_usuario_id),
  CONSTRAINT fk_uhe_jefe
    FOREIGN KEY (jefe_usuario_id) REFERENCES usuarios (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_uhe_trabajador
    FOREIGN KEY (trabajador_usuario_id) REFERENCES usuarios (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 3) Si ya hay perfiles con el mismo nombre pero otro id, renombrar los viejos
--    para liberar uq_perfiles_nombre y poder crear los ids fijos.
-- ---------------------------------------------------------------------------
UPDATE perfiles
SET nombre = CONCAT(nombre, ' (antiguo)')
WHERE nombre IN ('Trabajador', 'Jefe', 'Admin RRHH')
  AND id NOT IN (
    'a0000000-0000-4000-8000-000000000010',
    'a0000000-0000-4000-8000-000000000011',
    'a0000000-0000-4000-8000-000000000012'
  );

-- ---------------------------------------------------------------------------
-- 4) Perfiles (ids fijos) — uno a uno
-- ---------------------------------------------------------------------------
INSERT INTO perfiles (id, nombre, descripcion) VALUES (
  'a0000000-0000-4000-8000-000000000010',
  'Trabajador',
  'Mi Zona: fichaje, ausencias y nóminas propias.'
)
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  descripcion = VALUES(descripcion),
  actualizado_en = CURRENT_TIMESTAMP(3);

INSERT INTO perfiles (id, nombre, descripcion) VALUES (
  'a0000000-0000-4000-8000-000000000011',
  'Jefe',
  'Mi Zona propia + ver equipo y cola de ausencias (aprobar si Holded lo permite).'
)
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  descripcion = VALUES(descripcion),
  actualizado_en = CURRENT_TIMESTAMP(3);

INSERT INTO perfiles (id, nombre, descripcion) VALUES (
  'a0000000-0000-4000-8000-000000000012',
  'Admin RRHH',
  'Mi Zona a nivel organización + mapping de empleados Holded.'
)
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  descripcion = VALUES(descripcion),
  actualizado_en = CURRENT_TIMESTAMP(3);

-- Comprobar que existen (debe devolver 3 filas; Completo es aparte)
-- SELECT id, nombre FROM perfiles
-- WHERE id IN (
--   'a0000000-0000-4000-8000-000000000010',
--   'a0000000-0000-4000-8000-000000000011',
--   'a0000000-0000-4000-8000-000000000012'
-- );

-- ---------------------------------------------------------------------------
-- 5) Permisos vía INSERT…SELECT (0 filas si el perfil no existe → sin error 1452)
-- ---------------------------------------------------------------------------
INSERT INTO perfil_permisos (perfil_id, permiso)
SELECT p.id, x.permiso
FROM perfiles p
INNER JOIN (
  SELECT 'mi_zona.ver' AS permiso UNION ALL
  SELECT 'mi_zona.fichar' UNION ALL
  SELECT 'mi_zona.ausencias' UNION ALL
  SELECT 'mi_zona.nominas'
) x
WHERE p.id = 'a0000000-0000-4000-8000-000000000010'
ON DUPLICATE KEY UPDATE permiso = VALUES(permiso);

INSERT INTO perfil_permisos (perfil_id, permiso)
SELECT p.id, x.permiso
FROM perfiles p
INNER JOIN (
  SELECT 'mi_zona.ver' AS permiso UNION ALL
  SELECT 'mi_zona.fichar' UNION ALL
  SELECT 'mi_zona.ausencias' UNION ALL
  SELECT 'mi_zona.nominas' UNION ALL
  SELECT 'mi_zona.equipo' UNION ALL
  SELECT 'mi_zona.aprobar_ausencias'
) x
WHERE p.id = 'a0000000-0000-4000-8000-000000000011'
ON DUPLICATE KEY UPDATE permiso = VALUES(permiso);

INSERT INTO perfil_permisos (perfil_id, permiso)
SELECT p.id, x.permiso
FROM perfiles p
INNER JOIN (
  SELECT 'mi_zona.ver' AS permiso UNION ALL
  SELECT 'mi_zona.fichar' UNION ALL
  SELECT 'mi_zona.ausencias' UNION ALL
  SELECT 'mi_zona.nominas' UNION ALL
  SELECT 'mi_zona.equipo' UNION ALL
  SELECT 'mi_zona.aprobar_ausencias' UNION ALL
  SELECT 'mi_zona.admin'
) x
WHERE p.id = 'a0000000-0000-4000-8000-000000000012'
ON DUPLICATE KEY UPDATE permiso = VALUES(permiso);

-- Completo (solo si existe ese id)
INSERT INTO perfil_permisos (perfil_id, permiso)
SELECT p.id, x.permiso
FROM perfiles p
INNER JOIN (
  SELECT 'mi_zona.ver' AS permiso UNION ALL
  SELECT 'mi_zona.fichar' UNION ALL
  SELECT 'mi_zona.ausencias' UNION ALL
  SELECT 'mi_zona.nominas' UNION ALL
  SELECT 'mi_zona.equipo' UNION ALL
  SELECT 'mi_zona.aprobar_ausencias' UNION ALL
  SELECT 'mi_zona.admin'
) x
WHERE p.id = 'a0000000-0000-4000-8000-000000000001'
ON DUPLICATE KEY UPDATE permiso = VALUES(permiso);

-- ---------------------------------------------------------------------------
-- 6) Propagar mi_zona.* a usuarios con overrides de perfil
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO usuario_permisos (usuario_id, permiso)
SELECT u.id, pp.permiso
FROM usuarios u
INNER JOIN perfil_permisos pp ON pp.perfil_id = u.perfil_id
WHERE pp.permiso LIKE 'mi_zona.%'
  AND EXISTS (
    SELECT 1 FROM usuario_permisos up WHERE up.usuario_id = u.id
  );
