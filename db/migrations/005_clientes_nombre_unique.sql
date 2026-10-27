-- UNIQUE nombre de cliente (además de correo_acceso).
-- Si falla por duplicados, revisar antes:
--   SELECT nombre, COUNT(*) AS n FROM clientes GROUP BY nombre HAVING n > 1;

ALTER TABLE clientes
  ADD UNIQUE KEY uq_clientes_nombre (nombre);
