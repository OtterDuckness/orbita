-- Migración: proyectos favoritos por usuario (submenú del sidemenu).
-- Ejecutar en Cloud SQL Studio (base `orbita`) si el schema ya estaba aplicado.
--
-- Fila presente = ese usuario quiere ver el proyecto en el desplegable de Proyectos.
-- Preferencia personal: no afecta a otros usuarios.

CREATE TABLE IF NOT EXISTS proyecto_favoritos (
  usuario_id  CHAR(36) NOT NULL,
  proyecto_id CHAR(36) NOT NULL,
  creado_en   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (usuario_id, proyecto_id),
  KEY ix_pf_proyecto (proyecto_id),
  CONSTRAINT fk_pf_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_pf_proyecto
    FOREIGN KEY (proyecto_id) REFERENCES proyectos (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
