-- Crea la base de pruebas y deja la sesión apuntando a ella.
-- En Cloud SQL Studio:
--   1. Ejecuta ESTE archivo (el selector de base debe quedar en orbita_pruebas).
--   2. Sin cambiar de base, pega y ejecuta db/schema.sql.
--   3. db/pruebas/copiar-catalogo.sql y db/pruebas/seed-mock.sql
-- Si un intento anterior dejó la base a medias, descomenta el DROP y vuelve a empezar.

-- DROP DATABASE IF EXISTS orbita_pruebas;

CREATE DATABASE IF NOT EXISTS orbita_pruebas
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE orbita_pruebas;
