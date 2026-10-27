-- Migración: métricas de prompt cache y web_search en ia_uso
-- Ejecutar en Cloud SQL Studio (bases `orbita` y `orbita_pruebas` si aplica).

ALTER TABLE ia_uso
  ADD COLUMN cache_creation_tokens INT UNSIGNED NOT NULL DEFAULT 0
    AFTER output_tokens,
  ADD COLUMN cache_read_tokens INT UNSIGNED NOT NULL DEFAULT 0
    AFTER cache_creation_tokens,
  ADD COLUMN web_search_requests INT UNSIGNED NOT NULL DEFAULT 0
    AFTER cache_read_tokens;
