-- Migración: ajustes globales (clave/valor)
-- Ejecutar en Cloud SQL Studio (base `orbita`) si el schema ya estaba aplicado.

CREATE TABLE IF NOT EXISTS ajustes (
  clave           VARCHAR(64)  NOT NULL PRIMARY KEY,
  valor           VARCHAR(255) NOT NULL,
  actualizado_en  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  actualizado_por CHAR(36)     NULL,
  CONSTRAINT fk_ajustes_usuario
    FOREIGN KEY (actualizado_por) REFERENCES usuarios(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Por defecto cerrado: no se puede abrir por URL un proyecto ajeno.
INSERT IGNORE INTO ajustes (clave, valor) VALUES ('proyectos_url_abierta', '0');
