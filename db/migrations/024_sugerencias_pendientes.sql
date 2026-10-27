-- Migración: sugerencias pendientes (sin tarea hasta confirmación en admin).
-- Ejecutar en Cloud SQL Studio (base `orbita`) si el schema ya estaba aplicado.
--
-- Antes: enviar sugerencia creaba tarea en «Por pensar».
-- Ahora: se guarda pendiente; el admin confirma → tarea en «Por hacer».

ALTER TABLE sugerencias
  DROP FOREIGN KEY fk_sugerencias_tarea;

ALTER TABLE sugerencias
  MODIFY COLUMN tarea_id CHAR(36) NULL;

ALTER TABLE sugerencias
  ADD CONSTRAINT fk_sugerencias_tarea
    FOREIGN KEY (tarea_id) REFERENCES tareas (id)
    ON DELETE SET NULL;

ALTER TABLE sugerencias
  ADD COLUMN estado ENUM('pendiente', 'convertida')
    NOT NULL DEFAULT 'pendiente'
    AFTER proyecto_id;

UPDATE sugerencias
SET estado = 'convertida'
WHERE tarea_id IS NOT NULL;

ALTER TABLE sugerencias
  ADD KEY ix_sugerencias_estado (estado);
