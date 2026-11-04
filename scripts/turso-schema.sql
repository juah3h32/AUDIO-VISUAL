-- Schema Turso para AV Control (migracion desde Firestore).
-- Arrays simples (string[]) se guardan como columnas TEXT con JSON.
-- IDs son TEXT (crypto.randomUUID() en servidor), igual de opacos que los docId de Firestore.
--
-- SIN foreign keys reales: Firestore nunca forzo integridad referencial (un entregable puede
-- seguir apuntando a un proyectoId que ya no existe — ver "Proyecto eliminado" en
-- ArchivosPage.tsx, o el checkbox "dejar huerfanos" al borrar un proyecto en ProyectosPage.tsx).
-- Ademas Turso via HTTP no mantiene PRAGMA foreign_keys entre llamadas separadas, asi que
-- declarar REFERENCES no se podria hacer cumplir de todos modos. Los *_id son solo texto libre;
-- el cascade de comentarios (antes ON DELETE CASCADE) se hace a mano en cada endpoint DELETE.

CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL,
  rol TEXT NOT NULL,
  puesto TEXT,
  especialidades TEXT,
  avatar_url TEXT,
  gestor_requisiciones TEXT,
  password_hash TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invitaciones (
  correo TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL,
  gestor_requisiciones TEXT,
  creado_por_id TEXT NOT NULL,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contadores (
  nombre TEXT PRIMARY KEY,
  siguiente INTEGER NOT NULL
);

-- Freno a fuerza bruta en /api/auth/login (ver api/_shared/rateLimit.ts). Ventana corta a
-- proposito: un bloqueo largo convierte el candado en un arma para negarle acceso a otra
-- persona (bastan unos intentos fallidos a su correo para dejarla fuera un buen rato).
CREATE TABLE IF NOT EXISTS intentos_login (
  correo TEXT PRIMARY KEY,
  intentos INTEGER NOT NULL DEFAULT 0,
  bloqueado_hasta TEXT
);

CREATE TABLE IF NOT EXISTS marcas (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  colores TEXT NOT NULL,
  tipografia TEXT,
  manual_url TEXT,
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assets_marca (
  id TEXT PRIMARY KEY,
  marca_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  url TEXT NOT NULL,
  file_id TEXT
);

CREATE TABLE IF NOT EXISTS requisiciones (
  id TEXT PRIMARY KEY,
  folio TEXT UNIQUE NOT NULL,
  titulo TEXT NOT NULL,
  departamento_solicitante TEXT NOT NULL,
  nombre_solicitante TEXT NOT NULL,
  solicitante_id TEXT NOT NULL,
  responsable_venta_id TEXT,
  responsable_venta_correo TEXT,
  tipo_contenido TEXT NOT NULL,
  objetivo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  publico_objetivo TEXT,
  formato_solicitado TEXT,
  cantidad_entregables INTEGER NOT NULL,
  fecha_requerida TEXT NOT NULL,
  prioridad TEXT NOT NULL,
  referencias_visuales TEXT,
  archivos_adjuntos TEXT,
  ubicacion TEXT,
  necesita_grabacion INTEGER NOT NULL,
  observaciones TEXT,
  estado TEXT NOT NULL,
  lider_audiovisual_correo TEXT,
  aprobado_por TEXT,
  aprobado_en TEXT,
  proyectos_vinculados TEXT,
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS proyectos (
  id TEXT PRIMARY KEY,
  folio TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  requisiciones_vinculadas TEXT NOT NULL,
  marca_id TEXT,
  responsable_principal_id TEXT,
  colaboradores_ids TEXT NOT NULL,
  departamento_solicitante TEXT NOT NULL,
  prioridad TEXT NOT NULL,
  fecha_inicio TEXT,
  fecha_compromiso TEXT,
  etapa_actual TEXT NOT NULL,
  etapas_omitidas TEXT,
  porcentaje_avance INTEGER NOT NULL,
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS guiones (
  id TEXT PRIMARY KEY,
  folio TEXT UNIQUE NOT NULL,
  proyecto_id TEXT,
  titulo TEXT NOT NULL,
  objetivo TEXT NOT NULL,
  contenido TEXT NOT NULL,
  responsable_id TEXT NOT NULL,
  gestor_responsable_id TEXT,
  estado TEXT NOT NULL,
  aprobador_id TEXT,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS guiones_comentarios (
  id TEXT PRIMARY KEY,
  guion_id TEXT NOT NULL,
  autor_id TEXT NOT NULL,
  autor_nombre TEXT NOT NULL,
  texto TEXT NOT NULL,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entregables (
  id TEXT PRIMARY KEY,
  proyecto_id TEXT,
  marca_id TEXT,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL,
  formato TEXT,
  orientacion_video TEXT,
  resolucion TEXT,
  duracion TEXT,
  responsable_id TEXT NOT NULL,
  fecha_compromiso TEXT NOT NULL,
  version TEXT NOT NULL,
  estado TEXT NOT NULL,
  url_revision TEXT,
  url_final TEXT,
  orientacion_video_alt TEXT,
  url_revision_alt TEXT,
  url_final_alt TEXT,
  fotos TEXT,
  carpeta_fotos_url TEXT,
  fotos_para_borrar TEXT,
  guion_id TEXT,
  dialogo_texto TEXT,
  materiales_apoyo TEXT,
  aprobador_id TEXT,
  creado_en TEXT NOT NULL,
  porcentaje_avance INTEGER,
  avance_actualizado_en TEXT,
  fecha_enviado TEXT,
  fecha_entregado TEXT,
  fecha_aprobado TEXT
);

CREATE TABLE IF NOT EXISTS entregables_comentarios (
  id TEXT PRIMARY KEY,
  entregable_id TEXT NOT NULL,
  autor_id TEXT NOT NULL,
  autor_nombre TEXT NOT NULL,
  texto TEXT NOT NULL,
  momento TEXT,
  creado_en TEXT NOT NULL,
  corregido INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS salidas (
  id TEXT PRIMARY KEY,
  folio TEXT UNIQUE NOT NULL,
  nombre_jornada TEXT NOT NULL,
  proyectos_relacionados TEXT NOT NULL,
  tipo_actividad TEXT NOT NULL,
  planta TEXT NOT NULL,
  direccion TEXT,
  contacto_planta TEXT,
  telefono_contacto TEXT,
  fecha TEXT NOT NULL,
  hora_salida TEXT NOT NULL,
  hora_estimada_llegada TEXT NOT NULL,
  hora_inicio_grabacion TEXT,
  hora_estimada_finalizacion TEXT,
  hora_regreso TEXT,
  personal_asignado TEXT NOT NULL,
  responsable_produccion_id TEXT NOT NULL,
  equipo_requerido TEXT NOT NULL,
  transporte TEXT,
  estado_autorizacion TEXT NOT NULL,
  observaciones TEXT,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plantas (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  direccion TEXT,
  contacto_planta TEXT,
  telefono_contacto TEXT,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS equipo_av (
  id TEXT PRIMARY KEY,
  codigo_interno TEXT NOT NULL,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL,
  marca TEXT,
  modelo TEXT,
  numero_serie TEXT,
  estado TEXT NOT NULL,
  responsable_id TEXT,
  ubicacion TEXT,
  disponibilidad INTEGER NOT NULL,
  ultimo_mantenimiento TEXT,
  proximo_mantenimiento TEXT
);

CREATE TABLE IF NOT EXISTS colaboradores (
  id TEXT PRIMARY KEY,
  tiene_cuenta INTEGER NOT NULL DEFAULT 0,
  nombre TEXT NOT NULL,
  puesto TEXT NOT NULL,
  especialidades TEXT NOT NULL,
  disponibilidad TEXT NOT NULL,
  proyectos_asignados TEXT NOT NULL,
  tareas_pendientes INTEGER NOT NULL DEFAULT 0,
  carga_estimada INTEGER NOT NULL DEFAULT 0,
  carga_real INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notificaciones (
  id TEXT PRIMARY KEY,
  para_usuario_id TEXT NOT NULL,
  texto TEXT NOT NULL,
  entregable_id TEXT,
  guion_id TEXT,
  leida INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS metas (
  id TEXT PRIMARY KEY,
  responsabilidad TEXT NOT NULL,
  metas_semanales TEXT NOT NULL,
  proyectos_a_cargo TEXT NOT NULL,
  actualizado_en TEXT
);

CREATE INDEX IF NOT EXISTS idx_requisiciones_solicitante ON requisiciones(solicitante_id);
CREATE INDEX IF NOT EXISTS idx_requisiciones_responsable_venta ON requisiciones(responsable_venta_id);
CREATE INDEX IF NOT EXISTS idx_entregables_proyecto ON entregables(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_entregables_responsable ON entregables(responsable_id);
CREATE INDEX IF NOT EXISTS idx_guiones_proyecto ON guiones(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones(para_usuario_id);
CREATE INDEX IF NOT EXISTS idx_assets_marca_marca ON assets_marca(marca_id);
CREATE INDEX IF NOT EXISTS idx_entregables_comentarios_entregable ON entregables_comentarios(entregable_id);
CREATE INDEX IF NOT EXISTS idx_guiones_comentarios_guion ON guiones_comentarios(guion_id);
