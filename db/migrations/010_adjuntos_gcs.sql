-- Adjuntos: Google Cloud Storage (object key) en lugar de Drive.

ALTER TABLE adjuntos
  DROP INDEX uq_adjuntos_drive_file;

ALTER TABLE adjuntos
  CHANGE COLUMN drive_file_id gcs_object VARCHAR(512) NOT NULL;

ALTER TABLE adjuntos
  ADD UNIQUE KEY uq_adjuntos_gcs_object (gcs_object);
