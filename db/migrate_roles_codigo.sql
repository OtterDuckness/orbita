-- Migración v1 → v1.1: roles por codigo (no UUID)
-- Ejecutar UNA VEZ en Cloud SQL Studio (base `orbita`) si ya aplicaste schema v1
-- con roles.id + usuarios.rol_id.
--
-- Comprueba antes:
--   SHOW COLUMNS FROM roles;
--   SHOW COLUMNS FROM usuarios;
-- Si roles ya no tiene `id` y usuarios tiene `rol` (no `rol_id`), no hace falta esto.

-- 1) Nueva columna en usuarios
ALTER TABLE usuarios ADD COLUMN rol VARCHAR(32) NULL AFTER correo;

-- 2) Copiar codigo desde roles
UPDATE usuarios u
INNER JOIN roles r ON r.id = u.rol_id
SET u.rol = r.codigo;

-- 3) Quitar FK e índice antiguos sobre rol_id
ALTER TABLE usuarios DROP FOREIGN KEY fk_usuarios_rol;
ALTER TABLE usuarios DROP KEY ix_usuarios_rol;
ALTER TABLE usuarios DROP COLUMN rol_id;

-- 4) roles: PK pasa a ser codigo; se elimina id
ALTER TABLE roles DROP PRIMARY KEY;
ALTER TABLE roles DROP INDEX uq_roles_codigo;
ALTER TABLE roles DROP COLUMN id;
ALTER TABLE roles ADD PRIMARY KEY (codigo);

-- 5) FK nueva + índice
ALTER TABLE usuarios
  ADD KEY ix_usuarios_rol (rol),
  ADD CONSTRAINT fk_usuarios_rol
    FOREIGN KEY (rol) REFERENCES roles (codigo);

-- 6) Verificación
-- SELECT codigo, nombre FROM roles;
-- SELECT nombre, correo, rol, es_admin FROM usuarios;
-- SELECT * FROM usuarios WHERE rol = 'interna';
