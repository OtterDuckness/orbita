-- Override de tope de gasto IA por usuario y mes UTC (YYYY-MM).
-- Sin fila → se usa IA_COSTE_MAX_USD_MES (default $5).
-- tope_usd = 0 → sin tope ese mes para ese usuario.

CREATE TABLE IF NOT EXISTS ia_tope_mensual (
  usuario_id   CHAR(36)       NOT NULL,
  mes_utc      CHAR(7)        NOT NULL COMMENT 'YYYY-MM en UTC',
  tope_usd     DECIMAL(12, 4) NOT NULL,
  actualizado_en DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                              ON UPDATE CURRENT_TIMESTAMP(3),
  actualizado_por CHAR(36)    NULL,
  PRIMARY KEY (usuario_id, mes_utc),
  KEY ix_ia_tope_mes (mes_utc),
  CONSTRAINT fk_ia_tope_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_ia_tope_actor
    FOREIGN KEY (actualizado_por) REFERENCES usuarios(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
