-- Permiso asistente.web: búsqueda / lectura web vía el agente IA.
-- Perfil Completo + usuarios con ese perfil (usuario_permisos denormalizado).
-- 028/029 los usa origin/dev (notificar_asignado / dificultad).

INSERT INTO perfil_permisos (perfil_id, permiso)
SELECT 'a0000000-0000-4000-8000-000000000001', 'asistente.web'
WHERE NOT EXISTS (
  SELECT 1 FROM perfil_permisos
  WHERE perfil_id = 'a0000000-0000-4000-8000-000000000001'
    AND permiso = 'asistente.web'
);

INSERT IGNORE INTO usuario_permisos (usuario_id, permiso)
SELECT u.id, 'asistente.web'
FROM usuarios u
WHERE u.perfil_id = 'a0000000-0000-4000-8000-000000000001';
