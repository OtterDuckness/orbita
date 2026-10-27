-- Visibilidad global de los apartados del menú para quien no es admin.
-- El asistente sigue en agente_ia_activo (034). Si la fila no existe, el código
-- usa el mismo defecto: Mi Zona y Herramientas apagados, el resto encendidos.

INSERT IGNORE INTO ajustes (clave, valor) VALUES
  ('apartado_panel', '1'),
  ('apartado_mi_zona', '0'),
  ('apartado_clientes', '1'),
  ('apartado_proyectos', '1'),
  ('apartado_tareas', '1'),
  ('apartado_calendario', '1'),
  ('apartado_comunicaciones', '1'),
  ('apartado_herramientas', '0');
