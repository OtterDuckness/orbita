-- Estado de ciclo de vida del proyecto: activo | terminado | archivado.

ALTER TABLE proyectos
  ADD COLUMN estado ENUM('activo', 'terminado', 'archivado')
    NOT NULL DEFAULT 'activo'
    AFTER prioridad;

ALTER TABLE proyectos
  ADD KEY ix_proyectos_estado (estado);
