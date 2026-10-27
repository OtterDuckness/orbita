-- Migración: proyecto "Personal" oculto por usuario (pantalla /tareas).
-- Ejecutar en Cloud SQL Studio (base `orbita`) si el schema ya estaba aplicado.

ALTER TABLE proyectos
  ADD COLUMN personal_de_id CHAR(36) NULL AFTER estado;

ALTER TABLE proyectos
  ADD UNIQUE KEY uq_proyectos_personal (personal_de_id);

ALTER TABLE proyectos
  ADD CONSTRAINT fk_proyectos_personal
    FOREIGN KEY (personal_de_id) REFERENCES usuarios (id)
    ON DELETE CASCADE;
