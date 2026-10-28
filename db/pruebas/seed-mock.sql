-- Datos mock (nombres y correos falsos). Idempotente (INSERT IGNORE + UPDATE al final).
-- Ejecutar contra `orbita` después de db/schema.sql.
-- Responsables y colaboradores se reparten entre las internas del schema.

USE orbita;

SET @dev = (SELECT id FROM usuarios WHERE correo = 'mikhailtolub@gmail.com' LIMIT 1);
SET @miguel = (SELECT id FROM usuarios WHERE correo = 'nora.vidal@example.com' LIMIT 1);
SET @dev = COALESCE(
  @dev,
  @miguel,
  (SELECT id FROM usuarios WHERE rol = 'interna' ORDER BY creado_en ASC LIMIT 1)
);
SET @miguel = COALESCE(@miguel, @dev);

SET @tipo_seo = (SELECT id FROM tipos_proyecto WHERE nombre = 'SEO' LIMIT 1);
SET @tipo_web = (SELECT id FROM tipos_proyecto WHERE nombre = 'Web' LIMIT 1);
SET @tipo_ads = (SELECT id FROM tipos_proyecto WHERE nombre = 'Ads' LIMIT 1);
SET @tipo_boostiq = (SELECT id FROM tipos_proyecto WHERE nombre = 'Boostiq' LIMIT 1);

-- ---------------------------------------------------------------------------
-- Clientes (20). responsable_id provisional; se reasigna al final.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO clientes (
  id, nombre, correo_acceso, telefono, responsable_id, origen
) VALUES
  ('e1000000-0000-4000-8000-000000000001', 'Acme Retail (pruebas)', 'mock-acme@example.com', '+34 611 100 001', @miguel, 'manual'),
  ('e1000000-0000-4000-8000-000000000002', 'Norte Lab (pruebas)', 'mock-norte@example.com', '+34 611 100 002', @dev, 'manual'),
  ('e1000000-0000-4000-8000-000000000003', 'Helios Retail (pruebas)', 'mock-helios@example.com', '+34 611 100 003', @dev, 'manual'),
  ('e1000000-0000-4000-8000-000000000004', 'Costa Verde Hotel (pruebas)', 'mock-costa@example.com', '+34 611 100 004', @dev, 'manual'),
  ('e1000000-0000-4000-8000-000000000005', 'Atlas Formación (pruebas)', 'mock-atlas@example.com', '+34 611 100 005', @dev, 'manual'),
  ('e1000000-0000-4000-8000-000000000006', 'Luna Clínica (pruebas)', 'mock-luna@example.com', '+34 611 100 006', @dev, 'manual'),
  ('e1000000-0000-4000-8000-000000000007', 'Pico Analytics (pruebas)', 'mock-pico@example.com', '+34 611 100 007', @dev, 'manual'),
  ('e1000000-0000-4000-8000-000000000008', 'Vega Digital (pruebas)', 'mock-vega@example.com', '+34 611 100 008', @dev, 'manual'),
  ('e1000000-0000-4000-8000-000000000009', 'Orion Media (pruebas)', 'mock-orion@example.com', '+34 611 100 009', @miguel, 'manual'),
  ('e1000000-0000-4000-8000-000000000010', 'Nexo Salud (pruebas)', 'mock-nexo@example.com', '+34 611 100 010', @dev, 'manual'),
  ('e1000000-0000-4000-8000-000000000011', 'Faro Legal (pruebas)', 'mock-faro@example.com', '+34 611 100 011', @dev, 'manual'),
  ('e1000000-0000-4000-8000-000000000012', 'Coral Fitness (pruebas)', 'mock-coral@example.com', '+34 611 100 012', @dev, 'manual'),
  ('e1000000-0000-4000-8000-000000000013', 'Sol Energía (pruebas)', 'mock-sol@example.com', '+34 611 100 013', @dev, 'manual'),
  ('e1000000-0000-4000-8000-000000000014', 'Mirador Gastro (pruebas)', 'mock-mirador@example.com', '+34 611 100 014', @dev, 'manual'),
  ('e1000000-0000-4000-8000-000000000015', 'Quimera Soft (pruebas)', 'mock-quimera@example.com', '+34 611 100 015', @dev, 'manual'),
  ('e1000000-0000-4000-8000-000000000016', 'Brisa Homes (pruebas)', 'mock-brisa@example.com', '+34 611 100 016', @dev, 'manual'),
  ('e1000000-0000-4000-8000-000000000017', 'Taller Norte (pruebas)', 'mock-taller@example.com', '+34 611 100 017', @dev, 'manual'),
  ('e1000000-0000-4000-8000-000000000018', 'Aura Cosmética (pruebas)', 'mock-aura@example.com', '+34 611 100 018', @dev, 'manual'),
  ('e1000000-0000-4000-8000-000000000019', 'Delta Logística (pruebas)', 'mock-delta@example.com', '+34 611 100 019', @dev, 'manual'),
  ('e1000000-0000-4000-8000-000000000020', 'Prisma Educa (pruebas)', 'mock-prisma@example.com', '+34 611 100 020', @dev, 'manual');

INSERT IGNORE INTO usuarios (id, nombre, correo, rol, es_admin, cliente_id) VALUES
  (
    'e5000000-0000-4000-8000-000000000001',
    'Ana Acme (mock)',
    'mock-ana-acme@example.com',
    'externa',
    0,
    'e1000000-0000-4000-8000-000000000001'
  ),
  (
    'e5000000-0000-4000-8000-000000000002',
    'Luis Helios (mock)',
    'mock-luis-helios@example.com',
    'externa',
    0,
    'e1000000-0000-4000-8000-000000000003'
  ),
  (
    'e5000000-0000-4000-8000-000000000003',
    'Carla Coral (mock)',
    'mock-carla-coral@example.com',
    'externa',
    0,
    'e1000000-0000-4000-8000-000000000012'
  );

-- ---------------------------------------------------------------------------
-- Proyectos (28). responsable_id provisional; se reasigna al final.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO proyectos (
  id, ambito, nombre, cliente_id, tipo_id, fee_mensual, fin_contrato,
  responsable_id, prioridad, estado
) VALUES
  ('e2000000-0000-4000-8000-000000000001', 'externo', 'SEO Acme Retail', 'e1000000-0000-4000-8000-000000000001', @tipo_seo, 1200.00, DATE_ADD(CURRENT_DATE, INTERVAL 6 MONTH), @miguel, 'media', 'activo'),
  ('e2000000-0000-4000-8000-000000000002', 'externo', 'Web Norte Lab', 'e1000000-0000-4000-8000-000000000002', @tipo_web, 900.00, DATE_ADD(CURRENT_DATE, INTERVAL 4 MONTH), @dev, 'alta', 'activo'),
  ('e2000000-0000-4000-8000-000000000003', 'interno', 'Campamento de pruebas', NULL, NULL, NULL, DATE_ADD(CURRENT_DATE, INTERVAL 12 MONTH), @miguel, 'baja', 'activo'),
  ('e2000000-0000-4000-8000-000000000004', 'externo', 'Ads Helios Retail', 'e1000000-0000-4000-8000-000000000003', @tipo_ads, 1500.00, DATE_ADD(CURRENT_DATE, INTERVAL 8 MONTH), @dev, 'urgente', 'activo'),
  ('e2000000-0000-4000-8000-000000000005', 'externo', 'SEO Helios Retail', 'e1000000-0000-4000-8000-000000000003', @tipo_seo, 800.00, DATE_ADD(CURRENT_DATE, INTERVAL 10 MONTH), @dev, 'media', 'activo'),
  ('e2000000-0000-4000-8000-000000000006', 'externo', 'Web Costa Verde', 'e1000000-0000-4000-8000-000000000004', @tipo_web, 2160.00, DATE_ADD(CURRENT_DATE, INTERVAL 3 MONTH), @dev, 'alta', 'activo'),
  ('e2000000-0000-4000-8000-000000000007', 'externo', 'Boostiq Atlas', 'e1000000-0000-4000-8000-000000000005', @tipo_boostiq, 650.00, DATE_ADD(CURRENT_DATE, INTERVAL 5 MONTH), @dev, 'media', 'activo'),
  ('e2000000-0000-4000-8000-000000000008', 'externo', 'SEO Luna Clínica', 'e1000000-0000-4000-8000-000000000006', @tipo_seo, 450.00, NULL, @dev, 'baja', 'activo'),
  ('e2000000-0000-4000-8000-000000000009', 'externo', 'Ads Pico Analytics', 'e1000000-0000-4000-8000-000000000007', @tipo_ads, 1100.00, DATE_SUB(CURRENT_DATE, INTERVAL 1 MONTH), @dev, 'media', 'terminado'),
  ('e2000000-0000-4000-8000-000000000010', 'interno', 'Playbook onboarding (mock)', NULL, NULL, NULL, DATE_ADD(CURRENT_DATE, INTERVAL 2 MONTH), @dev, 'media', 'activo'),
  ('e2000000-0000-4000-8000-000000000011', 'interno', 'Archivo de pruebas', NULL, NULL, NULL, DATE_SUB(CURRENT_DATE, INTERVAL 6 MONTH), @dev, 'baja', 'archivado'),
  ('e2000000-0000-4000-8000-000000000012', 'externo', 'Ads Vega Digital', 'e1000000-0000-4000-8000-000000000008', @tipo_ads, 1300.00, DATE_ADD(CURRENT_DATE, INTERVAL 7 MONTH), @dev, 'alta', 'activo'),
  ('e2000000-0000-4000-8000-000000000013', 'externo', 'Web Orion Media', 'e1000000-0000-4000-8000-000000000009', @tipo_web, 1800.00, DATE_ADD(CURRENT_DATE, INTERVAL 5 MONTH), @miguel, 'urgente', 'activo'),
  ('e2000000-0000-4000-8000-000000000014', 'externo', 'SEO Nexo Salud', 'e1000000-0000-4000-8000-000000000010', @tipo_seo, 950.00, DATE_ADD(CURRENT_DATE, INTERVAL 9 MONTH), @dev, 'media', 'activo'),
  ('e2000000-0000-4000-8000-000000000015', 'externo', 'Boostiq Faro Legal', 'e1000000-0000-4000-8000-000000000011', @tipo_boostiq, 700.00, DATE_ADD(CURRENT_DATE, INTERVAL 4 MONTH), @dev, 'media', 'activo'),
  ('e2000000-0000-4000-8000-000000000016', 'externo', 'Ads Faro Legal', 'e1000000-0000-4000-8000-000000000011', @tipo_ads, 1100.00, DATE_ADD(CURRENT_DATE, INTERVAL 6 MONTH), @miguel, 'alta', 'activo'),
  ('e2000000-0000-4000-8000-000000000017', 'interno', 'Kit plantillas mock', NULL, NULL, NULL, DATE_ADD(CURRENT_DATE, INTERVAL 3 MONTH), @dev, 'baja', 'activo'),
  ('e2000000-0000-4000-8000-000000000018', 'externo', 'Web Coral Fitness', 'e1000000-0000-4000-8000-000000000012', @tipo_web, 1400.00, DATE_ADD(CURRENT_DATE, INTERVAL 5 MONTH), @dev, 'alta', 'activo'),
  ('e2000000-0000-4000-8000-000000000019', 'externo', 'Ads Sol Energía', 'e1000000-0000-4000-8000-000000000013', @tipo_ads, 1750.00, DATE_ADD(CURRENT_DATE, INTERVAL 8 MONTH), @dev, 'urgente', 'activo'),
  ('e2000000-0000-4000-8000-000000000020', 'externo', 'SEO Sol Energía', 'e1000000-0000-4000-8000-000000000013', @tipo_seo, 720.00, DATE_ADD(CURRENT_DATE, INTERVAL 11 MONTH), @dev, 'media', 'activo'),
  ('e2000000-0000-4000-8000-000000000021', 'externo', 'Boostiq Mirador', 'e1000000-0000-4000-8000-000000000014', @tipo_boostiq, 580.00, DATE_ADD(CURRENT_DATE, INTERVAL 4 MONTH), @dev, 'media', 'activo'),
  ('e2000000-0000-4000-8000-000000000022', 'externo', 'Web Quimera Soft', 'e1000000-0000-4000-8000-000000000015', @tipo_web, 2400.00, DATE_ADD(CURRENT_DATE, INTERVAL 6 MONTH), @dev, 'alta', 'activo'),
  ('e2000000-0000-4000-8000-000000000023', 'externo', 'SEO Brisa Homes', 'e1000000-0000-4000-8000-000000000016', @tipo_seo, 880.00, DATE_ADD(CURRENT_DATE, INTERVAL 7 MONTH), @dev, 'media', 'activo'),
  ('e2000000-0000-4000-8000-000000000024', 'externo', 'Ads Taller Norte', 'e1000000-0000-4000-8000-000000000017', @tipo_ads, 980.00, DATE_ADD(CURRENT_DATE, INTERVAL 3 MONTH), @dev, 'alta', 'activo'),
  ('e2000000-0000-4000-8000-000000000025', 'externo', 'Boostiq Aura', 'e1000000-0000-4000-8000-000000000018', @tipo_boostiq, 620.00, DATE_ADD(CURRENT_DATE, INTERVAL 5 MONTH), @dev, 'baja', 'activo'),
  ('e2000000-0000-4000-8000-000000000026', 'externo', 'Web Delta Logística', 'e1000000-0000-4000-8000-000000000019', @tipo_web, 1950.00, DATE_ADD(CURRENT_DATE, INTERVAL 9 MONTH), @dev, 'urgente', 'activo'),
  ('e2000000-0000-4000-8000-000000000027', 'externo', 'SEO Prisma Educa', 'e1000000-0000-4000-8000-000000000020', @tipo_seo, 540.00, DATE_ADD(CURRENT_DATE, INTERVAL 6 MONTH), @dev, 'media', 'activo'),
  ('e2000000-0000-4000-8000-000000000028', 'externo', 'Ads Acme Retail', 'e1000000-0000-4000-8000-000000000001', @tipo_ads, 1600.00, DATE_ADD(CURRENT_DATE, INTERVAL 4 MONTH), @dev, 'alta', 'activo');

-- Columnas estándar por proyecto mock (ids estables: proy_num*10 + 1..5).
INSERT IGNORE INTO columnas (id, proyecto_id, nombre, fija, orden)
SELECT
  CONCAT(
    'e3000000-0000-4000-8000-',
    LPAD(CAST(RIGHT(p.id, 12) AS UNSIGNED) * 10 + s.orden + 1, 12, '0')
  ),
  p.id,
  s.nombre,
  1,
  s.orden
FROM proyectos p
CROSS JOIN (
  SELECT 0 AS orden, 'Por hacer' AS nombre
  UNION ALL SELECT 1, 'En curso'
  UNION ALL SELECT 2, 'En revisión'
  UNION ALL SELECT 3, 'Terminadas'
  UNION ALL SELECT 4, 'Rechazadas / eliminadas'
) s
WHERE p.id LIKE 'e2000000-0000-4000-8000-%';

-- Tareas seed originales (001–020). Responsables provisionales; se reasignan al final.
INSERT IGNORE INTO tareas (
  id, proyecto_id, columna_id, nombre, fecha_prevista, fecha_maxima,
  sync_calendar, notificar_asignado, mandada_por_id, responsable_ids,
  prioridad, dificultad, notas, completada_en, orden
) VALUES
  (
    'e4000000-0000-4000-8000-000000000001',
    'e2000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000011',
    'Auditoría de palabras clave (mock)',
    DATE_ADD(CURRENT_DATE, INTERVAL 3 DAY),
    DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY),
    0, 0, @dev, JSON_ARRAY(@dev),
    'media', 2,
    'Tarea de prueba. No hay cliente real detrás.',
    NULL, 0
  ),
  (
    'e4000000-0000-4000-8000-000000000002',
    'e2000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000012',
    'Informe mensual ficticio',
    CURRENT_DATE,
    DATE_ADD(CURRENT_DATE, INTERVAL 2 DAY),
    0, 0, @dev, JSON_ARRAY(@dev),
    'alta', 3, NULL, NULL, 0
  ),
  (
    'e4000000-0000-4000-8000-000000000003',
    'e2000000-0000-4000-8000-000000000002',
    'e3000000-0000-4000-8000-000000000021',
    'Wireframe de home (mock)',
    DATE_ADD(CURRENT_DATE, INTERVAL 5 DAY),
    DATE_ADD(CURRENT_DATE, INTERVAL 10 DAY),
    0, 0, @dev, JSON_ARRAY(@dev),
    'media', 3, NULL, NULL, 0
  ),
  (
    'e4000000-0000-4000-8000-000000000004',
    'e2000000-0000-4000-8000-000000000003',
    'e3000000-0000-4000-8000-000000000031',
    'Probar el interruptor de sandbox',
    CURRENT_DATE,
    DATE_ADD(CURRENT_DATE, INTERVAL 1 DAY),
    0, 0, @dev, JSON_ARRAY(@dev),
    'baja', 1,
    'Nota de la base de demostración. No hay datos reales.',
    NULL, 0
  ),
  (
    'e4000000-0000-4000-8000-000000000005',
    'e2000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000013',
    'Revisar metadatos de fichas (mock)',
    DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY),
    DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY),
    0, 0, @dev, JSON_ARRAY(@dev),
    'alta', 2, NULL, NULL, 0
  ),
  (
    'e4000000-0000-4000-8000-000000000006',
    'e2000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000014',
    'Kickoff SEO Acme (mock)',
    DATE_SUB(CURRENT_DATE, INTERVAL 20 DAY),
    DATE_SUB(CURRENT_DATE, INTERVAL 14 DAY),
    0, 0, @dev, JSON_ARRAY(@dev),
    'media', 1, NULL,
    DATE_SUB(NOW(3), INTERVAL 12 DAY),
    0
  ),
  (
    'e4000000-0000-4000-8000-000000000007',
    'e2000000-0000-4000-8000-000000000002',
    'e3000000-0000-4000-8000-000000000022',
    'Maquetar listado de habitaciones (mock)',
    DATE_ADD(CURRENT_DATE, INTERVAL 2 DAY),
    DATE_ADD(CURRENT_DATE, INTERVAL 8 DAY),
    0, 0, @dev, JSON_ARRAY(@dev, @miguel),
    'alta', 4, NULL, NULL, 0
  ),
  (
    'e4000000-0000-4000-8000-000000000008',
    'e2000000-0000-4000-8000-000000000004',
    'e3000000-0000-4000-8000-000000000041',
    'Estructura de campañas Shopping (mock)',
    DATE_ADD(CURRENT_DATE, INTERVAL 1 DAY),
    DATE_ADD(CURRENT_DATE, INTERVAL 4 DAY),
    0, 0, @dev, JSON_ARRAY(@dev),
    'urgente', 3, NULL, NULL, 0
  ),
  (
    'e4000000-0000-4000-8000-000000000009',
    'e2000000-0000-4000-8000-000000000004',
    'e3000000-0000-4000-8000-000000000042',
    'Ajustar pujas de remarketing (mock)',
    CURRENT_DATE,
    CURRENT_DATE,
    0, 0, @dev, JSON_ARRAY(@dev),
    'alta', 2, NULL, NULL, 0
  ),
  (
    'e4000000-0000-4000-8000-000000000010',
    'e2000000-0000-4000-8000-000000000004',
    'e3000000-0000-4000-8000-000000000044',
    'Pixel y conversiones Helios (mock)',
    DATE_SUB(CURRENT_DATE, INTERVAL 10 DAY),
    DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY),
    0, 0, @dev, JSON_ARRAY(@dev),
    'media', 2, NULL,
    DATE_SUB(NOW(3), INTERVAL 6 DAY),
    0
  ),
  (
    'e4000000-0000-4000-8000-000000000011',
    'e2000000-0000-4000-8000-000000000005',
    'e3000000-0000-4000-8000-000000000051',
    'Mapa de contenidos Helios (mock)',
    DATE_ADD(CURRENT_DATE, INTERVAL 6 DAY),
    DATE_ADD(CURRENT_DATE, INTERVAL 14 DAY),
    0, 0, @dev, JSON_ARRAY(@dev),
    'media', 3, NULL, NULL, 0
  ),
  (
    'e4000000-0000-4000-8000-000000000012',
    'e2000000-0000-4000-8000-000000000006',
    'e3000000-0000-4000-8000-000000000062',
    'Formulario de reservas (mock)',
    DATE_ADD(CURRENT_DATE, INTERVAL 4 DAY),
    DATE_ADD(CURRENT_DATE, INTERVAL 9 DAY),
    0, 0, @dev, JSON_ARRAY(@dev),
    'alta', 4,
    'Hotel ficticio. No enviar nada al cliente.',
    NULL, 0
  ),
  (
    'e4000000-0000-4000-8000-000000000013',
    'e2000000-0000-4000-8000-000000000006',
    'e3000000-0000-4000-8000-000000000061',
    'Fotos hero y galería (mock)',
    DATE_SUB(CURRENT_DATE, INTERVAL 3 DAY),
    DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY),
    0, 0, @dev, JSON_ARRAY(@dev),
    'media', 2, NULL, NULL, 1
  ),
  (
    'e4000000-0000-4000-8000-000000000014',
    'e2000000-0000-4000-8000-000000000007',
    'e3000000-0000-4000-8000-000000000071',
    'Configurar embudo Boostiq Atlas (mock)',
    DATE_ADD(CURRENT_DATE, INTERVAL 8 DAY),
    DATE_ADD(CURRENT_DATE, INTERVAL 15 DAY),
    0, 0, @dev, JSON_ARRAY(@dev),
    'media', 3, NULL, NULL, 0
  ),
  (
    'e4000000-0000-4000-8000-000000000015',
    'e2000000-0000-4000-8000-000000000007',
    'e3000000-0000-4000-8000-000000000073',
    'Copy de landing de cursos (mock)',
    DATE_ADD(CURRENT_DATE, INTERVAL 1 DAY),
    DATE_ADD(CURRENT_DATE, INTERVAL 3 DAY),
    0, 0, @dev, JSON_ARRAY(@dev),
    'alta', 2, NULL, NULL, 0
  ),
  (
    'e4000000-0000-4000-8000-000000000016',
    'e2000000-0000-4000-8000-000000000008',
    'e3000000-0000-4000-8000-000000000081',
    'Auditoría técnica Luna (mock)',
    NULL, NULL,
    0, 0, @dev, JSON_ARRAY(@dev),
    'baja', 2, NULL, NULL, 0
  ),
  (
    'e4000000-0000-4000-8000-000000000017',
    'e2000000-0000-4000-8000-000000000009',
    'e3000000-0000-4000-8000-000000000094',
    'Cierre de campañas Pico (mock)',
    DATE_SUB(CURRENT_DATE, INTERVAL 40 DAY),
    DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY),
    0, 0, @dev, JSON_ARRAY(@dev),
    'media', 1, NULL,
    DATE_SUB(NOW(3), INTERVAL 28 DAY),
    0
  ),
  (
    'e4000000-0000-4000-8000-000000000018',
    'e2000000-0000-4000-8000-000000000010',
    'e3000000-0000-4000-8000-000000000101',
    'Redactar checklist de onboarding (mock)',
    DATE_ADD(CURRENT_DATE, INTERVAL 2 DAY),
    DATE_ADD(CURRENT_DATE, INTERVAL 5 DAY),
    0, 0, @dev, JSON_ARRAY(@dev),
    'media', 2, NULL, NULL, 0
  ),
  (
    'e4000000-0000-4000-8000-000000000019',
    'e2000000-0000-4000-8000-000000000010',
    'e3000000-0000-4000-8000-000000000102',
    'Grabar vídeo de bienvenida (mock)',
    CURRENT_DATE,
    DATE_ADD(CURRENT_DATE, INTERVAL 3 DAY),
    0, 0, @dev, JSON_ARRAY(@dev),
    'baja', 3, NULL, NULL, 0
  ),
  (
    'e4000000-0000-4000-8000-000000000020',
    'e2000000-0000-4000-8000-000000000002',
    'e3000000-0000-4000-8000-000000000025',
    'Propuesta descartada de blog (mock)',
    DATE_SUB(CURRENT_DATE, INTERVAL 5 DAY),
    DATE_SUB(CURRENT_DATE, INTERVAL 4 DAY),
    0, 0, @dev, JSON_ARRAY(@dev),
    'baja', 1, NULL, NULL, 0
  );

-- ~150 tareas extra repartidas por proyecto e internas (ids 021–170).
INSERT IGNORE INTO tareas (
  id, proyecto_id, columna_id, nombre, fecha_prevista, fecha_maxima,
  sync_calendar, notificar_asignado, mandada_por_id, responsable_ids,
  prioridad, dificultad, notas, completada_en, orden
)
WITH digitos AS (
  SELECT 0 AS d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
  UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
),
nums AS (
  SELECT (a.d + b.d * 10 + c.d * 100) AS n
  FROM digitos a
  CROSS JOIN digitos b
  CROSS JOIN digitos c
  WHERE (a.d + b.d * 10 + c.d * 100) BETWEEN 0 AND 149
),
equipo AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY correo) - 1 AS idx,
    COUNT(*) OVER () AS total
  FROM usuarios
  WHERE rol = 'interna'
),
proy AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY id) - 1 AS idx,
    COUNT(*) OVER () AS total
  FROM proyectos
  WHERE id LIKE 'e2000000-0000-4000-8000-%'
    AND estado <> 'archivado'
),
base AS (
  SELECT
    n.n,
    p.id AS proyecto_id,
    e.id AS responsable_id,
    e2.id AS co_responsable_id,
    e3.id AS mandada_por_id,
    MOD(n.n, 5) AS col_slot,
    CAST(RIGHT(p.id, 12) AS UNSIGNED) AS proy_num
  FROM nums n
  INNER JOIN proy p ON p.idx = MOD(n.n, p.total)
  INNER JOIN equipo e ON e.idx = MOD(n.n, e.total)
  INNER JOIN equipo e2 ON e2.idx = MOD(n.n + 1, e2.total)
  INNER JOIN equipo e3 ON e3.idx = MOD(n.n + 2, e3.total)
)
SELECT
  CONCAT('e4000000-0000-4000-8000-', LPAD(21 + b.n, 12, '0')),
  b.proyecto_id,
  CONCAT(
    'e3000000-0000-4000-8000-',
    LPAD(b.proy_num * 10 + 1 + b.col_slot, 12, '0')
  ),
  ELT(
    1 + MOD(b.n, 28),
    'Auditoría de palabras clave (mock)',
    'Informe mensual de rendimiento (mock)',
    'Wireframe de landing (mock)',
    'Maquetar ficha de producto (mock)',
    'Revisar metadatos y titles (mock)',
    'Estructura de campañas Search (mock)',
    'Ajustar pujas de remarketing (mock)',
    'Pixel y eventos de conversión (mock)',
    'Mapa de contenidos del mes (mock)',
    'Copy de email nurture (mock)',
    'Formulario de captación (mock)',
    'Optimizar Core Web Vitals (mock)',
    'Brief creativo display (mock)',
    'QA de tracking en staging (mock)',
    'Propuesta de keywords long-tail (mock)',
    'Checklist de onboarding cliente (mock)',
    'Grabar walkthrough interno (mock)',
    'Revisión de backlinks tóxicos (mock)',
    'Configurar embudo Boostiq (mock)',
    'A/B test de CTA principal (mock)',
    'Migración de URLs canónicas (mock)',
    'Informe de competencia (mock)',
    'Setup Search Console + Analytics (mock)',
    'Diseño de hero y galería (mock)',
    'Calendario editorial Q (mock)',
    'Limpieza de campañas pausadas (mock)',
    'Documentar playbook del proyecto (mock)',
    'Reunión de alineación semanal (mock)'
  ),
  CASE MOD(b.n, 8)
    WHEN 0 THEN DATE_ADD(CURRENT_DATE, INTERVAL (1 + MOD(b.n, 14)) DAY)
    WHEN 1 THEN CURRENT_DATE
    WHEN 2 THEN DATE_ADD(CURRENT_DATE, INTERVAL (2 + MOD(b.n, 10)) DAY)
    WHEN 3 THEN DATE_SUB(CURRENT_DATE, INTERVAL (1 + MOD(b.n, 5)) DAY)
    WHEN 4 THEN DATE_ADD(CURRENT_DATE, INTERVAL (7 + MOD(b.n, 21)) DAY)
    WHEN 5 THEN NULL
    WHEN 6 THEN DATE_SUB(CURRENT_DATE, INTERVAL (10 + MOD(b.n, 20)) DAY)
    ELSE DATE_ADD(CURRENT_DATE, INTERVAL MOD(b.n, 4) DAY)
  END,
  CASE MOD(b.n, 8)
    WHEN 0 THEN DATE_ADD(CURRENT_DATE, INTERVAL (5 + MOD(b.n, 14)) DAY)
    WHEN 1 THEN DATE_ADD(CURRENT_DATE, INTERVAL 2 DAY)
    WHEN 2 THEN DATE_ADD(CURRENT_DATE, INTERVAL (8 + MOD(b.n, 12)) DAY)
    WHEN 3 THEN DATE_SUB(CURRENT_DATE, INTERVAL MOD(b.n, 3) DAY)
    WHEN 4 THEN DATE_ADD(CURRENT_DATE, INTERVAL (14 + MOD(b.n, 21)) DAY)
    WHEN 5 THEN NULL
    WHEN 6 THEN DATE_SUB(CURRENT_DATE, INTERVAL (3 + MOD(b.n, 10)) DAY)
    ELSE DATE_ADD(CURRENT_DATE, INTERVAL (3 + MOD(b.n, 6)) DAY)
  END,
  0,
  0,
  b.mandada_por_id,
  IF(
    MOD(b.n, 7) = 0 AND b.responsable_id <> b.co_responsable_id,
    JSON_ARRAY(b.responsable_id, b.co_responsable_id),
    JSON_ARRAY(b.responsable_id)
  ),
  ELT(1 + MOD(b.n, 4), 'baja', 'media', 'alta', 'urgente'),
  1 + MOD(b.n, 5),
  IF(MOD(b.n, 11) = 0, 'Nota mock generada para pruebas de volumen.', NULL),
  IF(
    b.col_slot = 3,
    DATE_SUB(NOW(3), INTERVAL (2 + MOD(b.n, 25)) DAY),
    NULL
  ),
  MOD(b.n, 6)
FROM base b;

INSERT IGNORE INTO tarea_checklist (id, tarea_id, texto, hecho, orden) VALUES
  ('e4100000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000001', 'Exportar Search Console (mock)', 1, 0),
  ('e4100000-0000-4000-8000-000000000002', 'e4000000-0000-4000-8000-000000000001', 'Agrupar clusters', 0, 1),
  ('e4100000-0000-4000-8000-000000000003', 'e4000000-0000-4000-8000-000000000001', 'Priorizar 10 URLs', 0, 2),
  ('e4100000-0000-4000-8000-000000000004', 'e4000000-0000-4000-8000-000000000008', 'Cuenta MCC de pruebas', 1, 0),
  ('e4100000-0000-4000-8000-000000000005', 'e4000000-0000-4000-8000-000000000008', 'Feed de productos ficticio', 0, 1),
  ('e4100000-0000-4000-8000-000000000006', 'e4000000-0000-4000-8000-000000000018', 'Accesos y herramientas', 1, 0),
  ('e4100000-0000-4000-8000-000000000007', 'e4000000-0000-4000-8000-000000000018', 'Plantilla de kickoff', 0, 1);

INSERT IGNORE INTO notas (id, texto, autor_id, proyecto_id, cliente_id) VALUES
  (
    'e4200000-0000-4000-8000-000000000001',
    'Cliente ficticio: reunión de kickoff el próximo martes.',
    @dev,
    'e2000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001'
  ),
  (
    'e4200000-0000-4000-8000-000000000002',
    'Helios: dos proyectos (Ads + SEO). Datos 100% mock.',
    @miguel,
    'e2000000-0000-4000-8000-000000000004',
    'e1000000-0000-4000-8000-000000000003'
  ),
  (
    'e4200000-0000-4000-8000-000000000003',
    'Cuenta de hotel de prueba. No hay reservas reales.',
    @dev,
    NULL,
    'e1000000-0000-4000-8000-000000000004'
  ),
  (
    'e4200000-0000-4000-8000-000000000004',
    'Coral Fitness: web + posible Ads en Q3. Mock.',
    @miguel,
    'e2000000-0000-4000-8000-000000000018',
    'e1000000-0000-4000-8000-000000000012'
  );

INSERT IGNORE INTO conversaciones (id, tipo, nombre, cliente_id, dm_clave, creado_por_id) VALUES
  (
    'e4300000-0000-4000-8000-000000000001',
    'cliente',
    'Acme Retail (mock)',
    'e1000000-0000-4000-8000-000000000001',
    NULL,
    @dev
  ),
  (
    'e4300000-0000-4000-8000-000000000002',
    'grupo',
    'Squad pruebas',
    NULL,
    NULL,
    @miguel
  );

INSERT IGNORE INTO conversacion_miembros (conversacion_id, usuario_id, rol) VALUES
  ('e4300000-0000-4000-8000-000000000001', @dev, 'admin'),
  ('e4300000-0000-4000-8000-000000000002', @miguel, 'admin');

INSERT IGNORE INTO conversacion_miembros (conversacion_id, usuario_id, rol)
SELECT 'e4300000-0000-4000-8000-000000000001', @miguel, 'miembro'
WHERE @miguel IS NOT NULL AND @miguel <> @dev;

INSERT IGNORE INTO conversacion_miembros (conversacion_id, usuario_id, rol)
SELECT 'e4300000-0000-4000-8000-000000000002', @dev, 'miembro'
WHERE @miguel IS NOT NULL AND @miguel <> @dev;

INSERT IGNORE INTO conversacion_miembros (conversacion_id, usuario_id, rol)
SELECT 'e4300000-0000-4000-8000-000000000002', u.id, 'miembro'
FROM usuarios u
WHERE u.rol = 'interna'
  AND u.id NOT IN (@dev, @miguel)
ORDER BY u.correo
LIMIT 4;

INSERT IGNORE INTO mensajes (id, conversacion_id, autor_id, cuerpo) VALUES
  (
    'e4400000-0000-4000-8000-000000000001',
    'e4300000-0000-4000-8000-000000000001',
    @dev,
    'Hola, esto es un hilo de prueba con Acme. No se envían correos.'
  ),
  (
    'e4400000-0000-4000-8000-000000000002',
    'e4300000-0000-4000-8000-000000000002',
    @miguel,
    'Canal interno mock para probar Comunicaciones.'
  );

INSERT IGNORE INTO tarea_mensajes (id, tarea_id, autor_id, cuerpo) VALUES
  (
    'e4500000-0000-4000-8000-000000000001',
    'e4000000-0000-4000-8000-000000000002',
    @dev,
    'Borrador del informe listo para revisar (mock).'
  );

-- ---------------------------------------------------------------------------
-- Reasignación (INSERT IGNORE no toca filas ya existentes).
-- ---------------------------------------------------------------------------

-- Nombres / teléfonos / correos de clientes existentes.
UPDATE clientes
SET
  nombre = CASE id
    WHEN 'e1000000-0000-4000-8000-000000000001' THEN 'Acme Retail (pruebas)'
    WHEN 'e1000000-0000-4000-8000-000000000002' THEN 'Norte Lab (pruebas)'
    WHEN 'e1000000-0000-4000-8000-000000000003' THEN 'Helios Retail (pruebas)'
    WHEN 'e1000000-0000-4000-8000-000000000004' THEN 'Costa Verde Hotel (pruebas)'
    WHEN 'e1000000-0000-4000-8000-000000000005' THEN 'Atlas Formación (pruebas)'
    WHEN 'e1000000-0000-4000-8000-000000000006' THEN 'Luna Clínica (pruebas)'
    WHEN 'e1000000-0000-4000-8000-000000000007' THEN 'Pico Analytics (pruebas)'
    WHEN 'e1000000-0000-4000-8000-000000000008' THEN 'Vega Digital (pruebas)'
    WHEN 'e1000000-0000-4000-8000-000000000009' THEN 'Orion Media (pruebas)'
    WHEN 'e1000000-0000-4000-8000-000000000010' THEN 'Nexo Salud (pruebas)'
    WHEN 'e1000000-0000-4000-8000-000000000011' THEN 'Faro Legal (pruebas)'
    WHEN 'e1000000-0000-4000-8000-000000000012' THEN 'Coral Fitness (pruebas)'
    WHEN 'e1000000-0000-4000-8000-000000000013' THEN 'Sol Energía (pruebas)'
    WHEN 'e1000000-0000-4000-8000-000000000014' THEN 'Mirador Gastro (pruebas)'
    WHEN 'e1000000-0000-4000-8000-000000000015' THEN 'Quimera Soft (pruebas)'
    WHEN 'e1000000-0000-4000-8000-000000000016' THEN 'Brisa Homes (pruebas)'
    WHEN 'e1000000-0000-4000-8000-000000000017' THEN 'Taller Norte (pruebas)'
    WHEN 'e1000000-0000-4000-8000-000000000018' THEN 'Aura Cosmética (pruebas)'
    WHEN 'e1000000-0000-4000-8000-000000000019' THEN 'Delta Logística (pruebas)'
    WHEN 'e1000000-0000-4000-8000-000000000020' THEN 'Prisma Educa (pruebas)'
    ELSE nombre
  END,
  telefono = CONCAT('+34 611 100 ', LPAD(CAST(RIGHT(id, 12) AS UNSIGNED), 3, '0')),
  correo_acceso = CASE id
    WHEN 'e1000000-0000-4000-8000-000000000001' THEN 'mock-acme@example.com'
    WHEN 'e1000000-0000-4000-8000-000000000002' THEN 'mock-norte@example.com'
    WHEN 'e1000000-0000-4000-8000-000000000003' THEN 'mock-helios@example.com'
    WHEN 'e1000000-0000-4000-8000-000000000004' THEN 'mock-costa@example.com'
    WHEN 'e1000000-0000-4000-8000-000000000005' THEN 'mock-atlas@example.com'
    WHEN 'e1000000-0000-4000-8000-000000000006' THEN 'mock-luna@example.com'
    WHEN 'e1000000-0000-4000-8000-000000000007' THEN 'mock-pico@example.com'
    WHEN 'e1000000-0000-4000-8000-000000000008' THEN 'mock-vega@example.com'
    WHEN 'e1000000-0000-4000-8000-000000000009' THEN 'mock-orion@example.com'
    WHEN 'e1000000-0000-4000-8000-000000000010' THEN 'mock-nexo@example.com'
    WHEN 'e1000000-0000-4000-8000-000000000011' THEN 'mock-faro@example.com'
    WHEN 'e1000000-0000-4000-8000-000000000012' THEN 'mock-coral@example.com'
    WHEN 'e1000000-0000-4000-8000-000000000013' THEN 'mock-sol@example.com'
    WHEN 'e1000000-0000-4000-8000-000000000014' THEN 'mock-mirador@example.com'
    WHEN 'e1000000-0000-4000-8000-000000000015' THEN 'mock-quimera@example.com'
    WHEN 'e1000000-0000-4000-8000-000000000016' THEN 'mock-brisa@example.com'
    WHEN 'e1000000-0000-4000-8000-000000000017' THEN 'mock-taller@example.com'
    WHEN 'e1000000-0000-4000-8000-000000000018' THEN 'mock-aura@example.com'
    WHEN 'e1000000-0000-4000-8000-000000000019' THEN 'mock-delta@example.com'
    WHEN 'e1000000-0000-4000-8000-000000000020' THEN 'mock-prisma@example.com'
    ELSE correo_acceso
  END
WHERE id LIKE 'e1000000-0000-4000-8000-%';

UPDATE proyectos
SET nombre = CASE id
  WHEN 'e2000000-0000-4000-8000-000000000001' THEN 'SEO Acme Retail'
  WHEN 'e2000000-0000-4000-8000-000000000006' THEN 'Web Costa Verde'
  WHEN 'e2000000-0000-4000-8000-000000000018' THEN 'Web Coral Fitness'
  WHEN 'e2000000-0000-4000-8000-000000000019' THEN 'Ads Sol Energía'
  WHEN 'e2000000-0000-4000-8000-000000000020' THEN 'SEO Sol Energía'
  WHEN 'e2000000-0000-4000-8000-000000000021' THEN 'Boostiq Mirador'
  WHEN 'e2000000-0000-4000-8000-000000000022' THEN 'Web Quimera Soft'
  WHEN 'e2000000-0000-4000-8000-000000000023' THEN 'SEO Brisa Homes'
  WHEN 'e2000000-0000-4000-8000-000000000024' THEN 'Ads Taller Norte'
  WHEN 'e2000000-0000-4000-8000-000000000025' THEN 'Boostiq Aura'
  WHEN 'e2000000-0000-4000-8000-000000000026' THEN 'Web Delta Logística'
  WHEN 'e2000000-0000-4000-8000-000000000027' THEN 'SEO Prisma Educa'
  WHEN 'e2000000-0000-4000-8000-000000000028' THEN 'Ads Acme Retail'
  ELSE nombre
END
WHERE id LIKE 'e2000000-0000-4000-8000-%';

-- Clientes: rotación por internas.
UPDATE clientes c
INNER JOIN (
  WITH equipo AS (
    SELECT
      id,
      ROW_NUMBER() OVER (ORDER BY correo) - 1 AS idx,
      COUNT(*) OVER () AS total
    FROM usuarios
    WHERE rol = 'interna'
  ),
  cli AS (
    SELECT
      id,
      ROW_NUMBER() OVER (ORDER BY id) - 1 AS idx
    FROM clientes
    WHERE id LIKE 'e1000000-0000-4000-8000-%'
  )
  SELECT cli.id, e.id AS responsable_id
  FROM cli
  INNER JOIN equipo e ON e.idx = MOD(cli.idx, e.total)
) m ON m.id = c.id
SET c.responsable_id = m.responsable_id;

-- Proyectos: rotación (desfase distinto al de clientes).
UPDATE proyectos p
INNER JOIN (
  WITH equipo AS (
    SELECT
      id,
      ROW_NUMBER() OVER (ORDER BY correo) - 1 AS idx,
      COUNT(*) OVER () AS total
    FROM usuarios
    WHERE rol = 'interna'
  ),
  proy AS (
    SELECT
      id,
      ROW_NUMBER() OVER (ORDER BY id) - 1 AS idx
    FROM proyectos
    WHERE id LIKE 'e2000000-0000-4000-8000-%'
  )
  SELECT proy.id, e.id AS responsable_id
  FROM proy
  INNER JOIN equipo e ON e.idx = MOD(proy.idx + 3, e.total)
) m ON m.id = p.id
SET p.responsable_id = m.responsable_id;

-- Colaboradores: subconjuntos distintos (3–4 internas + responsable), no todo el equipo.
DELETE pm
FROM proyecto_miembros pm
INNER JOIN proyectos p ON p.id = pm.proyecto_id
WHERE p.id LIKE 'e2000000-0000-4000-8000-%';

INSERT INTO proyecto_miembros (proyecto_id, usuario_id)
WITH equipo AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY correo) - 1 AS idx,
    COUNT(*) OVER () AS total
  FROM usuarios
  WHERE rol = 'interna'
),
proy AS (
  SELECT
    id,
    responsable_id,
    ROW_NUMBER() OVER (ORDER BY id) - 1 AS idx
  FROM proyectos
  WHERE id LIKE 'e2000000-0000-4000-8000-%'
),
offsets AS (
  SELECT 0 AS off
  UNION ALL SELECT 1
  UNION ALL SELECT 2
  UNION ALL SELECT 4
)
SELECT DISTINCT x.proyecto_id, x.usuario_id
FROM (
  SELECT
    p.id AS proyecto_id,
    e.id AS usuario_id
  FROM proy p
  CROSS JOIN offsets o
  INNER JOIN equipo e ON e.idx = MOD(p.idx + o.off, e.total)
  WHERE o.off < 3 OR MOD(p.idx, 2) = 0
  UNION ALL
  SELECT p.id, p.responsable_id
  FROM proy p
  WHERE p.responsable_id IS NOT NULL
) x;

-- Todas las tareas mock: rotación de responsables y mandada_por.
UPDATE tareas t
INNER JOIN (
  WITH digitos AS (
    SELECT 0 AS d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
    UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
  ),
  nums AS (
    SELECT (a.d + b.d * 10 + c.d * 100) AS n
    FROM digitos a
    CROSS JOIN digitos b
    CROSS JOIN digitos c
    WHERE (a.d + b.d * 10 + c.d * 100) BETWEEN 0 AND 169
  ),
  equipo AS (
    SELECT
      id,
      ROW_NUMBER() OVER (ORDER BY correo) - 1 AS idx,
      COUNT(*) OVER () AS total
    FROM usuarios
    WHERE rol = 'interna'
  )
  SELECT
    CONCAT('e4000000-0000-4000-8000-', LPAD(1 + n.n, 12, '0')) AS id,
    e3.id AS mandada_por_id,
    IF(
      MOD(n.n, 7) = 0 AND e.id <> e2.id,
      JSON_ARRAY(e.id, e2.id),
      JSON_ARRAY(e.id)
    ) AS responsable_ids
  FROM nums n
  INNER JOIN equipo e ON e.idx = MOD(n.n, e.total)
  INNER JOIN equipo e2 ON e2.idx = MOD(n.n + 1, e2.total)
  INNER JOIN equipo e3 ON e3.idx = MOD(n.n + 2, e3.total)
) m ON m.id = t.id
SET
  t.mandada_por_id = m.mandada_por_id,
  t.responsable_ids = m.responsable_ids;
