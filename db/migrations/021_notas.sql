-- Migración: notas de proyecto/cliente (independientes del historial de logs)
-- Ejecutar en Cloud SQL Studio (base `orbita`) si el schema ya estaba aplicado.
--
-- - Nota de proyecto: proyecto_id obligatorio; cliente_id desnormalizado (NULL si interno).
-- - Nota de cliente (futuro): cliente_id obligatorio, proyecto_id NULL.
-- - Agregación en ficha de cliente: WHERE cliente_id = ? (incluye notas de sus proyectos).

CREATE TABLE IF NOT EXISTS notas (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  texto           TEXT         NOT NULL,
  autor_id        CHAR(36)     NOT NULL,
  creado_en       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  actualizado_en  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                 ON UPDATE CURRENT_TIMESTAMP(3),
  proyecto_id     CHAR(36)     NULL,
  cliente_id      CHAR(36)     NULL,
  KEY ix_notas_proyecto (proyecto_id),
  KEY ix_notas_cliente (cliente_id),
  KEY ix_notas_autor (autor_id),
  KEY ix_notas_creado (creado_en),
  CONSTRAINT fk_notas_autor
    FOREIGN KEY (autor_id) REFERENCES usuarios (id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_notas_proyecto
    FOREIGN KEY (proyecto_id) REFERENCES proyectos (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_notas_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes (id)
    ON DELETE CASCADE,
  CONSTRAINT chk_notas_ambito CHECK (
    proyecto_id IS NOT NULL OR cliente_id IS NOT NULL
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
