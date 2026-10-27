-- Apartado Correo (Gmail) + permisos correo.ver / correo.editar.
-- Solo perfil Completo (+ admins vía es_admin). Usuarios con ese perfil
-- reciben la denormalización en usuario_permisos.

INSERT IGNORE INTO ajustes (clave, valor) VALUES ('apartado_correo', '1');

INSERT INTO perfil_permisos (perfil_id, permiso)
SELECT 'a0000000-0000-4000-8000-000000000001', 'correo.ver'
WHERE NOT EXISTS (
  SELECT 1 FROM perfil_permisos
  WHERE perfil_id = 'a0000000-0000-4000-8000-000000000001'
    AND permiso = 'correo.ver'
);

INSERT INTO perfil_permisos (perfil_id, permiso)
SELECT 'a0000000-0000-4000-8000-000000000001', 'correo.editar'
WHERE NOT EXISTS (
  SELECT 1 FROM perfil_permisos
  WHERE perfil_id = 'a0000000-0000-4000-8000-000000000001'
    AND permiso = 'correo.editar'
);

INSERT IGNORE INTO usuario_permisos (usuario_id, permiso)
SELECT u.id, 'correo.ver'
FROM usuarios u
WHERE u.perfil_id = 'a0000000-0000-4000-8000-000000000001';

INSERT IGNORE INTO usuario_permisos (usuario_id, permiso)
SELECT u.id, 'correo.editar'
FROM usuarios u
WHERE u.perfil_id = 'a0000000-0000-4000-8000-000000000001';
