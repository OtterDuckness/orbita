-- Responsable comercial de la cuenta (usuario del equipo).

ALTER TABLE clientes
  ADD COLUMN responsable_id CHAR(36) NULL AFTER telefono,
  ADD KEY ix_clientes_responsable (responsable_id),
  ADD CONSTRAINT fk_clientes_responsable
    FOREIGN KEY (responsable_id) REFERENCES usuarios (id)
    ON DELETE SET NULL;
