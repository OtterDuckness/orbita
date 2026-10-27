-- Migración: nombre propio en proyectos (internos sin tipo)
-- Ejecutar en Cloud SQL Studio (base `orbita`) si el schema ya estaba aplicado.

ALTER TABLE proyectos
  ADD COLUMN nombre VARCHAR(160) NULL AFTER ambito;

ALTER TABLE proyectos
  MODIFY COLUMN tipo_id CHAR(36) NULL;

-- Los internos existentes conservan su título actual (nombre del tipo)
UPDATE proyectos p
JOIN tipos_proyecto t ON t.id = p.tipo_id
SET p.nombre = t.nombre, p.tipo_id = NULL
WHERE p.ambito = 'interno';

ALTER TABLE proyectos
  ADD CONSTRAINT chk_proyectos_titulo CHECK (
    (ambito = 'interno' AND nombre IS NOT NULL AND tipo_id IS NULL)
    OR (ambito = 'externo' AND tipo_id IS NOT NULL)
  );
