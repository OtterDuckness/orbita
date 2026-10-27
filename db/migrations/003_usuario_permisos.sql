-- Migración: permisos efectivos por usuario (overrides del perfil)
CREATE TABLE IF NOT EXISTS usuario_permisos (
  usuario_id  CHAR(36)    NOT NULL,
  permiso     VARCHAR(64) NOT NULL,
  PRIMARY KEY (usuario_id, permiso),
  CONSTRAINT fk_usuario_permisos_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Copiar permisos del perfil actual a cada usuario que tenga perfil (solo si aún no tiene overrides)
INSERT IGNORE INTO usuario_permisos (usuario_id, permiso)
SELECT u.id, pp.permiso
FROM usuarios u
INNER JOIN perfil_permisos pp ON pp.perfil_id = u.perfil_id
WHERE u.perfil_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM usuario_permisos up WHERE up.usuario_id = u.id
  );
