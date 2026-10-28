-- Restaura responsables en mock tras un sync que borró usuarios (FK ON DELETE SET NULL).
-- Reparte entre internas en lugar de asignarlo todo a un solo admin.
-- Ejecutar contra `orbita` si un sync dejó responsables a NULL.

USE orbita;

UPDATE clientes c
INNER JOIN (
  WITH equipo AS (
    SELECT
      id,
      ROW_NUMBER() OVER (ORDER BY correo) - 1 AS idx,
      COUNT(*) OVER () AS total
    FROM usuarios
    WHERE rol = 'interna'
  ),
  cli AS (
    SELECT
      id,
      ROW_NUMBER() OVER (ORDER BY id) - 1 AS idx
    FROM clientes
    WHERE responsable_id IS NULL
  )
  SELECT cli.id, e.id AS responsable_id
  FROM cli
  INNER JOIN equipo e ON e.idx = MOD(cli.idx, e.total)
) m ON m.id = c.id
SET c.responsable_id = m.responsable_id;

UPDATE proyectos p
INNER JOIN (
  WITH equipo AS (
    SELECT
      id,
      ROW_NUMBER() OVER (ORDER BY correo) - 1 AS idx,
      COUNT(*) OVER () AS total
    FROM usuarios
    WHERE rol = 'interna'
  ),
  proy AS (
    SELECT
      id,
      ROW_NUMBER() OVER (ORDER BY id) - 1 AS idx
    FROM proyectos
    WHERE responsable_id IS NULL
      AND personal_de_id IS NULL
  )
  SELECT proy.id, e.id AS responsable_id
  FROM proy
  INNER JOIN equipo e ON e.idx = MOD(proy.idx + 3, e.total)
) m ON m.id = p.id
SET p.responsable_id = m.responsable_id;

INSERT IGNORE INTO proyecto_miembros (proyecto_id, usuario_id)
SELECT id, responsable_id
FROM proyectos
WHERE responsable_id IS NOT NULL
  AND personal_de_id IS NULL;
