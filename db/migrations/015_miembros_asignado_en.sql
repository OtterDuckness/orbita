-- Migración: fecha de asignación de colaborador a proyecto
-- Ejecutar en Cloud SQL Studio (base `orbita`) si el schema ya estaba aplicado.
-- Filas existentes quedan con la fecha en que se ejecuta esta migración.

ALTER TABLE proyecto_miembros
  ADD COLUMN asignado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
