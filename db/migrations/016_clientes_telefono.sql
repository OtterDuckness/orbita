-- Teléfono opcional en formato fijo +34 XXX XXX XXX (16 caracteres).

ALTER TABLE clientes
  ADD COLUMN telefono VARCHAR(16) NULL AFTER correo_acceso;
