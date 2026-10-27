-- Tipo de cuenta opcional: B2B o Kit Digital (NULL = sin clasificar).

ALTER TABLE clientes
  ADD COLUMN tipo_cuenta ENUM('b2b', 'kit_digital') NULL AFTER responsable_id;
