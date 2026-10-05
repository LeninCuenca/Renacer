-- ========================================
-- AUTENTICACION Y PERFILES
-- ========================================
CREATE TYPE app_role AS ENUM ('vendedor', 'supervisor', 'jefe', 'contador', 'administrador_planta');

CREATE TABLE perfiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL CHECK (char_length(trim(nombre)) >= 2),
  nombres TEXT,
  apellidos TEXT,
  cedula TEXT NOT NULL UNIQUE CHECK (char_length(trim(cedula)) >= 5),
  correo TEXT NOT NULL,
  telefono TEXT,
  rol app_role NOT NULL DEFAULT 'vendedor',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.actualizar_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER perfiles_updated_at
  BEFORE UPDATE ON perfiles
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_updated_at();

CREATE OR REPLACE FUNCTION public.crear_perfil_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, nombres, apellidos, cedula, correo, telefono, rol)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(trim(concat_ws(' ', NEW.raw_user_meta_data->>'nombres', NEW.raw_user_meta_data->>'apellidos')), ''), split_part(NEW.email, '@', 1)),
    NULLIF(trim(NEW.raw_user_meta_data->>'nombres'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'apellidos'), ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'cedula', ''), 'PENDIENTE-' || left(NEW.id::text, 8)),
    NEW.email,
    NULLIF(trim(NEW.raw_user_meta_data->>'telefono'), ''),
    COALESCE((NEW.raw_user_meta_data->>'rol')::app_role, 'vendedor'::app_role)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER usuario_crea_perfil
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.crear_perfil_usuario();

CREATE OR REPLACE FUNCTION public.es_jefe()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND rol = 'jefe' AND activo = true
  );
$$;

ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY perfiles_select_propio_o_jefe ON perfiles
  FOR SELECT USING (id = auth.uid() OR public.es_jefe());

CREATE POLICY perfiles_update_jefe ON perfiles
  FOR UPDATE USING (public.es_jefe())
  WITH CHECK (public.es_jefe());

CREATE INDEX idx_perfiles_rol_activo ON perfiles(rol, activo);

-- Migración para bases creadas con una versión anterior del esquema.
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS nombres TEXT;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS apellidos TEXT;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS telefono TEXT;

-- ========================================
-- PLANIFICACION SEMANAL DE VENDEDORES
-- ========================================
CREATE TABLE IF NOT EXISTS planificaciones_semanales (
  id BIGSERIAL PRIMARY KEY,
  vendedor_id UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  semana_inicio DATE NOT NULL,
  dia SMALLINT NOT NULL CHECK (dia BETWEEN 1 AND 5),
  ubicacion TEXT NOT NULL CHECK (char_length(trim(ubicacion)) >= 2),
  notas TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vendedor_id, semana_inicio, dia)
);

CREATE INDEX IF NOT EXISTS idx_planificaciones_semana ON planificaciones_semanales(semana_inicio);
CREATE INDEX IF NOT EXISTS idx_planificaciones_vendedor ON planificaciones_semanales(vendedor_id);
ALTER TABLE planificaciones_semanales ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.puede_ver_equipo()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND activo = true AND rol IN ('supervisor', 'jefe'));
$$;

CREATE POLICY planificacion_vendedor_propia ON planificaciones_semanales
  FOR ALL USING (vendedor_id = auth.uid()) WITH CHECK (vendedor_id = auth.uid());

CREATE POLICY planificacion_supervision_lectura ON planificaciones_semanales
  FOR SELECT USING (public.puede_ver_equipo());

CREATE POLICY perfiles_select_supervisor ON perfiles
  FOR SELECT USING (public.puede_ver_equipo());

CREATE TABLE IF NOT EXISTS ediciones_planificacion (
  id BIGSERIAL PRIMARY KEY,
  vendedor_id UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  editado_por UUID NOT NULL REFERENCES perfiles(id),
  semana_inicio DATE NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE ediciones_planificacion ENABLE ROW LEVEL SECURITY;
CREATE POLICY ediciones_planificacion_vendedor_insert ON ediciones_planificacion
  FOR INSERT WITH CHECK (editado_por = auth.uid() AND vendedor_id = auth.uid());
CREATE POLICY ediciones_planificacion_supervision_lectura ON ediciones_planificacion
  FOR SELECT USING (public.puede_ver_equipo());

-- ========================================
-- TABLA: clientes
-- ========================================
CREATE TABLE clientes (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  cedula TEXT NOT NULL UNIQUE,
  telefono TEXT,
  direccion TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- TABLA: ordenes
-- ========================================
CREATE TABLE ordenes (
  id BIGSERIAL PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  cliente_id BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  vendedor_id UUID REFERENCES perfiles(id) ON DELETE SET NULL,
  estado TEXT NOT NULL DEFAULT 'Recepcion',
  fecha_rc TIMESTAMP WITH TIME ZONE,
  fecha_ef TIMESTAMP WITH TIME ZONE,
  fecha_rf TIMESTAMP WITH TIME ZONE,
  fecha_bodega TIMESTAMP WITH TIME ZONE,
  fecha_ec TIMESTAMP WITH TIME ZONE,
  tipo_pago TEXT,
  fecha_vencimiento TIMESTAMP WITH TIME ZONE,
  monto_total NUMERIC(12, 2) DEFAULT 0,
  monto_abonado NUMERIC(12, 2) DEFAULT 0,
  monto_pendiente NUMERIC(12, 2) DEFAULT 0,
  pagado_completo BOOLEAN DEFAULT FALSE,
  activo_vigente BOOLEAN DEFAULT FALSE,
  observaciones TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- TABLA: items
-- ========================================
CREATE TABLE items (
  id BIGSERIAL PRIMARY KEY,
  orden_id BIGINT NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
  marca TEXT,
  n_serie TEXT,
  media TEXT,
  diseno TEXT,
  cantidad INTEGER NOT NULL DEFAULT 1,
  valor_unitario NUMERIC(12, 2) DEFAULT 0,
  rechazo BOOLEAN DEFAULT FALSE,
  observaciones TEXT DEFAULT '',
  fecha_ingreso TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- TABLA: abonos
-- ========================================
CREATE TABLE abonos (
  id BIGSERIAL PRIMARY KEY,
  orden_id BIGINT NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
  monto NUMERIC(12, 2) NOT NULL,
  fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  descripcion TEXT
);

-- ========================================
-- ÍNDICES
-- ========================================
CREATE INDEX idx_ordenes_cliente_id ON ordenes(cliente_id);
CREATE INDEX idx_ordenes_vendedor_id ON ordenes(vendedor_id);

-- ========================================
-- EVALUACION DE LLANTAS EN PLANTA
-- ========================================
CREATE TYPE evaluacion_llanta_estado AS ENUM ('pendiente', 'valida', 'no_valida');

CREATE TABLE IF NOT EXISTS evaluaciones_llantas (
  id BIGSERIAL PRIMARY KEY,
  item_id BIGINT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  orden_id BIGINT NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
  evaluado_por UUID NOT NULL REFERENCES perfiles(id),
  numero_llanta INTEGER NOT NULL DEFAULT 1 CHECK (numero_llanta > 0),
  estado evaluacion_llanta_estado NOT NULL,
  observaciones TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS evaluaciones_llantas_item_numero_key ON evaluaciones_llantas(item_id, numero_llanta);

CREATE INDEX IF NOT EXISTS idx_evaluaciones_llantas_orden ON evaluaciones_llantas(orden_id);
ALTER TABLE evaluaciones_llantas ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.es_admin_planta()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'administrador_planta' AND activo = true);
$$;

CREATE POLICY evaluaciones_planta_gestion ON evaluaciones_llantas
  FOR ALL USING (public.es_admin_planta()) WITH CHECK (public.es_admin_planta());

CREATE POLICY evaluaciones_vendedor_lectura ON evaluaciones_llantas
  FOR SELECT USING (EXISTS (SELECT 1 FROM ordenes WHERE ordenes.id = evaluaciones_llantas.orden_id AND ordenes.vendedor_id = auth.uid()));

CREATE POLICY evaluaciones_supervision_lectura ON evaluaciones_llantas
  FOR SELECT USING (public.puede_ver_equipo());
CREATE INDEX idx_items_orden_id ON items(orden_id);
CREATE INDEX idx_abonos_orden_id ON abonos(orden_id);

-- ========================================
-- SEGURIDAD DE DATOS
-- ========================================
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE abonos ENABLE ROW LEVEL SECURITY;

CREATE POLICY clientes_autenticados ON clientes
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY ordenes_autenticados ON ordenes
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY items_autenticados ON items
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY abonos_autenticados ON abonos
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
