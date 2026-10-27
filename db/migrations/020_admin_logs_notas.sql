-- Migración: notas anotables en eventos de historial (admin_logs)
-- Ejecutar en Cloud SQL Studio (base `orbita`) si el schema ya estaba aplicado.

ALTER TABLE admin_logs ADD COLUMN nota TEXT NULL;
ALTER TABLE admin_logs ADD COLUMN nota_autor_id CHAR(36) NULL;
ALTER TABLE admin_logs ADD COLUMN nota_creado_en DATETIME(3) NULL;

ALTER TABLE admin_logs ADD KEY ix_admin_logs_nota_autor (nota_autor_id);

ALTER TABLE admin_logs
  ADD CONSTRAINT fk_admin_logs_nota_autor
    FOREIGN KEY (nota_autor_id) REFERENCES usuarios (id)
    ON DELETE SET NULL;
