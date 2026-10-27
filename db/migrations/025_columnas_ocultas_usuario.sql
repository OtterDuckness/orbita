-- Migración: apartados ocultos por usuario (preferencia sync del tablero).
-- Ejecutar en Cloud SQL Studio (base `orbita`) si el schema ya estaba aplicado.
--
-- Fila presente = ese usuario tiene oculto ese apartado en el tablero del proyecto.
-- No afecta a otros usuarios ni mueve/borra tareas.

CREATE TABLE IF NOT EXISTS columnas_ocultas_usuario (
  usuario_id CHAR(36) NOT NULL,
  columna_id CHAR(36) NOT NULL,
  PRIMARY KEY (usuario_id, columna_id),
  KEY ix_cou_columna (columna_id),
  CONSTRAINT fk_cou_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_cou_columna
    FOREIGN KEY (columna_id) REFERENCES columnas (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
