-- Migración: tokens Google Calendar en usuarios
-- (si la columna ya existe, omite el ALTER correspondiente)
ALTER TABLE usuarios ADD COLUMN google_refresh_token TEXT NULL;
ALTER TABLE usuarios ADD COLUMN google_access_token TEXT NULL;
ALTER TABLE usuarios ADD COLUMN google_token_expiry DATETIME(3) NULL;
