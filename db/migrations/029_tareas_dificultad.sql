-- Migración: dificultad de tarea (escala 1–5; 5 = más difícil).
-- Default 3 (media). Ejecutar en Cloud SQL Studio (base `orbita`) si el schema ya estaba aplicado.

ALTER TABLE tareas
  ADD COLUMN dificultad TINYINT UNSIGNED NOT NULL DEFAULT 3
  AFTER prioridad;
