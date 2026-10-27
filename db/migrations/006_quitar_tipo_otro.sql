-- Quita el tipo seed «Otro» (sustituido por la opción de UI «Otro…»).
-- Reasigna proyectos que lo usaran a SEO; luego borra el tipo.

UPDATE proyectos
SET tipo_id = 'c0000000-0000-4000-8000-000000000001'
WHERE tipo_id = 'c0000000-0000-4000-8000-000000000005'
   OR tipo_id IN (SELECT id FROM (SELECT id FROM tipos_proyecto WHERE nombre = 'Otro') AS t);

DELETE FROM tipos_proyecto
WHERE id = 'c0000000-0000-4000-8000-000000000005'
   OR nombre = 'Otro';
