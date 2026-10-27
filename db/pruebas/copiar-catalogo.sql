-- Copia roles/perfiles/tipos y usuarios internas desde orbita → orbita_pruebas.
-- No copia clientes, proyectos ni tareas reales. Sin tokens Google.
-- Requiere: CREATE DATABASE + schema.sql ya aplicados en orbita_pruebas.
--
-- Solo borra usuarios seed con el mismo correo y distinto id (schema.sql vs prod).
-- No borra usuarios que ya tienen el id de orbita: si no, el FK deja responsable_id a NULL.

INSERT INTO orbita_pruebas.roles (codigo, nombre, creado_en, actualizado_en)
SELECT codigo, nombre, creado_en, actualizado_en
FROM orbita.roles
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  actualizado_en = VALUES(actualizado_en);

INSERT INTO orbita_pruebas.perfiles (id, nombre, descripcion, creado_en, actualizado_en)
SELECT id, nombre, descripcion, creado_en, actualizado_en
FROM orbita.perfiles
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  descripcion = VALUES(descripcion),
  actualizado_en = VALUES(actualizado_en);

INSERT INTO orbita_pruebas.perfil_permisos (perfil_id, permiso)
SELECT perfil_id, permiso
FROM orbita.perfil_permisos
ON DUPLICATE KEY UPDATE permiso = VALUES(permiso);

INSERT INTO orbita_pruebas.tipos_proyecto (id, nombre, orden, activo, creado_en, actualizado_en)
SELECT id, nombre, orden, activo, creado_en, actualizado_en
FROM orbita.tipos_proyecto
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  orden = VALUES(orden),
  activo = VALUES(activo),
  actualizado_en = VALUES(actualizado_en);

DELETE up FROM orbita_pruebas.usuario_permisos up
INNER JOIN orbita_pruebas.usuarios p ON p.id = up.usuario_id
INNER JOIN orbita.usuarios o ON o.correo = p.correo AND o.rol = 'interna' AND o.id <> p.id;

DELETE p FROM orbita_pruebas.usuarios p
INNER JOIN orbita.usuarios o ON o.correo = p.correo AND o.rol = 'interna' AND o.id <> p.id;

INSERT INTO orbita_pruebas.usuarios (
  id, nombre, correo, rol, es_admin, cliente_id, perfil_id, avatar_gcs
)
SELECT id, nombre, correo, rol, es_admin, NULL, perfil_id, avatar_gcs
FROM orbita.usuarios
WHERE rol = 'interna'
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  correo = VALUES(correo),
  rol = VALUES(rol),
  es_admin = VALUES(es_admin),
  perfil_id = VALUES(perfil_id),
  avatar_gcs = VALUES(avatar_gcs),
  actualizado_en = CURRENT_TIMESTAMP(3);

INSERT INTO orbita_pruebas.usuario_permisos (usuario_id, permiso)
SELECT up.usuario_id, up.permiso
FROM orbita.usuario_permisos up
INNER JOIN orbita.usuarios u ON u.id = up.usuario_id
INNER JOIN orbita_pruebas.usuarios p ON p.id = up.usuario_id
WHERE u.rol = 'interna'
ON DUPLICATE KEY UPDATE permiso = VALUES(permiso);
