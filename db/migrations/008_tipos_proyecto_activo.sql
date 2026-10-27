-- Soft-delete de tipos: se retiran del catálogo pero permanecen
-- referenciables por proyectos terminados/archivados.

ALTER TABLE tipos_proyecto
  ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1
    AFTER orden;
