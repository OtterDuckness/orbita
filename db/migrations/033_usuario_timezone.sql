-- Migración: zona horaria preferida por usuario (IANA). Default Europe/Madrid.
-- Ejecutar en Cloud SQL Studio (base `orbita`).

ALTER TABLE usuarios
  ADD COLUMN timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Madrid'
    AFTER avatar_gcs;
