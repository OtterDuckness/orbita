-- Migración: foto de perfil en usuarios (GCS).
-- Ejecutar en Cloud SQL Studio (base `orbita`) si el schema ya estaba aplicado.

ALTER TABLE usuarios
  ADD COLUMN avatar_gcs VARCHAR(512) NULL AFTER google_token_expiry;
