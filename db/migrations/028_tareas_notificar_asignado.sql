-- Migración: toggle por tarea para notificar por correo a los asignados.
-- Apagado por defecto. Solo el solicitante lo activa desde la UI.
-- Ejecutar en Cloud SQL Studio (base `orbita`) si el schema ya estaba aplicado.

ALTER TABLE tareas
  ADD COLUMN notificar_asignado TINYINT(1) NOT NULL DEFAULT 0
  AFTER sync_calendar;
