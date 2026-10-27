-- Migración: deduplicar columnas fijas del tablero
-- Ejecutar en Cloud SQL Studio (base `orbita`) si el schema ya estaba aplicado.
-- Causa: columnasDe + tareasDe llamaban asegurarColumnas en paralelo e insertaban 2×.

-- 1) Mover tareas de columnas fijas duplicadas a la copia que se conserva (MIN(id))
UPDATE tareas t
JOIN columnas d ON d.id = t.columna_id AND d.fija = 1
JOIN (
  SELECT proyecto_id, nombre, MIN(id) AS keep_id
  FROM columnas WHERE fija = 1
  GROUP BY proyecto_id, nombre HAVING COUNT(*) > 1
) k ON k.proyecto_id = d.proyecto_id AND k.nombre = d.nombre
SET t.columna_id = k.keep_id
WHERE d.id <> k.keep_id;

-- 2) Borrar columnas fijas duplicadas (la FK tareas.columna_id es RESTRICT)
DELETE c FROM columnas c
JOIN (
  SELECT proyecto_id, nombre, MIN(id) AS keep_id
  FROM columnas WHERE fija = 1
  GROUP BY proyecto_id, nombre HAVING COUNT(*) > 1
) k ON k.proyecto_id = c.proyecto_id AND k.nombre = c.nombre
WHERE c.fija = 1 AND c.id <> k.keep_id;

-- Verificación (debe devolver 0 filas):
-- SELECT proyecto_id, nombre, COUNT(*) AS n
-- FROM columnas WHERE fija = 1
-- GROUP BY proyecto_id, nombre HAVING COUNT(*) > 1;
