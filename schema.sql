-- ==============================================================================
-- SISTEMA RENACER - ESQUEMA COMPLETO Y SCRIPT DE RESTABLECIMIENTO (RESET)
-- ==============================================================================
-- Este script:
-- 1. Elimina (DROP) todas las tablas, triggers, funciones y tipos existentes
--    de forma segura en orden inverso de dependencias (CASCADE).
-- 2. Vuelve a crear toda la estructura limpia y actualizada:
--    - Perfiles y roles (con soporte para administrador de planta y supervisores)
--    - Planificaciones semanales y auditoría de ediciones
--    - Clientes, órdenes, ítems, abonos y evaluaciones de llantas
-- 3. Configura índices de alto rendimiento y políticas RLS libres para migración.
-- 4. Re-sincroniza automáticamente cualquier usuario ya registrado en auth.users.
-- ==============================================================================

-- ==============================================================================
-- PASO 1: LIMPIEZA COMPLETA / RESET DE LA BASE DE DATOS
-- ==============================================================================

-- 1.1 Desvincular triggers en esquemas del sistema (auth)
DROP TRIGGER IF EXISTS usuario_crea_perfil ON auth.users;

-- 1.2 Eliminar tablas con CASCADE (elimina FKs, políticas e índices asociados)
DROP TABLE IF EXISTS public.evaluaciones_llantas CASCADE;
DROP TABLE IF EXISTS public.ediciones_planificacion CASCADE;
DROP TABLE IF EXISTS public.planificaciones_semanales CASCADE;
DROP TABLE IF EXISTS public.abonos CASCADE;
DROP TABLE IF EXISTS public.items CASCADE;
DROP TABLE IF EXISTS public.ordenes CASCADE;
DROP TABLE IF EXISTS public.clientes CASCADE;
DROP TABLE IF EXISTS public.perfiles CASCADE;

-- 1.3 Eliminar funciones de la aplicación
DROP FUNCTION IF EXISTS public.crear_perfil_usuario() CASCADE;
DROP FUNCTION IF EXISTS public.actualizar_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.es_jefe() CASCADE;
DROP FUNCTION IF EXISTS public.puede_ver_equipo() CASCADE;
DROP FUNCTION IF EXISTS public.es_admin_planta() CASCADE;

-- 1.4 Eliminar tipos ENUM personalizados
DROP TYPE IF EXISTS public.evaluacion_llanta_estado CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;

-- NOTA: Si deseas también borrar todas las cuentas de usuario de Supabase Auth
-- para empezar desde cero absoluto, descomenta la siguiente línea:
-- DELETE FROM auth.users;

-- ==============================================================================
-- PASO 2: TIPOS ENUM PERSONALIZADOS
-- ==============================================================================
CREATE TYPE public.app_role AS ENUM (
  'vendedor',
  'supervisor',
  'jefe',
  'contador',
  'administrador_planta'
);

CREATE TYPE public.evaluacion_llanta_estado AS ENUM (
  'pendiente',
  'valida',
  'no_valida'
);

-- ==============================================================================
-- PASO 3: FUNCIONES AUXILIARES GLOBALES
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.actualizar_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ==============================================================================
-- PASO 4: AUTENTICACIÓN Y PERFILES DE USUARIO
-- ==============================================================================
CREATE TABLE public.perfiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL CHECK (char_length(trim(nombre)) >= 2),
  nombres TEXT,
  apellidos TEXT,
  cedula TEXT NOT NULL UNIQUE CHECK (char_length(trim(cedula)) >= 5),
  correo TEXT NOT NULL,
  telefono TEXT,
  rol public.app_role NOT NULL DEFAULT 'vendedor',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER perfiles_updated_at
  BEFORE UPDATE ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_updated_at();

-- Trigger que auto-crea el perfil cuando se registra un usuario en Supabase Auth
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
    COALESCE((NEW.raw_user_meta_data->>'rol')::public.app_role, 'vendedor'::public.app_role)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER usuario_crea_perfil
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.crear_perfil_usuario();

-- Índices de perfiles
CREATE INDEX idx_perfiles_rol_activo ON public.perfiles(rol, activo);
CREATE INDEX idx_perfiles_cedula ON public.perfiles(cedula);

-- Funciones de verificación de rol
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

CREATE OR REPLACE FUNCTION public.puede_ver_equipo()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND activo = true AND rol IN ('supervisor', 'jefe')
  );
$$;

CREATE OR REPLACE FUNCTION public.es_admin_planta()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND rol::text = 'administrador_planta' AND activo = true
  );
$$;

-- Seguridad RLS para perfiles
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY perfiles_select_autenticados ON public.perfiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY perfiles_update_jefe_o_propio ON public.perfiles
  FOR UPDATE TO authenticated
  USING (public.es_jefe() OR id = auth.uid())
  WITH CHECK (public.es_jefe() OR id = auth.uid());

CREATE POLICY perfiles_insert_jefe ON public.perfiles
  FOR INSERT TO authenticated
  WITH CHECK (public.es_jefe() OR id = auth.uid());

-- ==============================================================================
-- PASO 5: PLANIFICACIÓN SEMANAL Y AUDITORÍA DE EDICIONES
-- ==============================================================================
CREATE TABLE public.planificaciones_semanales (
  id BIGSERIAL PRIMARY KEY,
  vendedor_id UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  semana_inicio DATE NOT NULL,
  dia SMALLINT NOT NULL CHECK (dia BETWEEN 1 AND 5),
  ubicacion TEXT NOT NULL CHECK (char_length(trim(ubicacion)) >= 2),
  notas TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vendedor_id, semana_inicio, dia)
);

CREATE INDEX idx_planificaciones_semana ON public.planificaciones_semanales(semana_inicio);
CREATE INDEX idx_planificaciones_vendedor ON public.planificaciones_semanales(vendedor_id);

ALTER TABLE public.planificaciones_semanales ENABLE ROW LEVEL SECURITY;

CREATE POLICY planificacion_vendedor_propia ON public.planificaciones_semanales
  FOR ALL TO authenticated
  USING (vendedor_id = auth.uid())
  WITH CHECK (vendedor_id = auth.uid());

CREATE POLICY planificacion_supervision_lectura ON public.planificaciones_semanales
  FOR SELECT TO authenticated
  USING (public.puede_ver_equipo());

-- Historial de versiones de planificación semanal
CREATE TABLE public.ediciones_planificacion (
  id BIGSERIAL PRIMARY KEY,
  vendedor_id UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  editado_por UUID NOT NULL REFERENCES public.perfiles(id),
  semana_inicio DATE NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ediciones_planificacion_busqueda
  ON public.ediciones_planificacion(vendedor_id, semana_inicio, version DESC);

ALTER TABLE public.ediciones_planificacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY ediciones_planificacion_vendedor_insert ON public.ediciones_planificacion
  FOR INSERT TO authenticated
  WITH CHECK (editado_por = auth.uid() AND vendedor_id = auth.uid());

CREATE POLICY ediciones_planificacion_supervision_lectura ON public.ediciones_planificacion
  FOR SELECT TO authenticated
  USING (public.puede_ver_equipo());

-- ==============================================================================
-- PASO 6: CLIENTES
-- ==============================================================================
CREATE TABLE public.clientes (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  cedula TEXT NOT NULL UNIQUE,
  telefono TEXT,
  direccion TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clientes_cedula ON public.clientes(cedula);
CREATE INDEX idx_clientes_nombre ON public.clientes(nombre);

-- ==============================================================================
-- PASO 7: ÓRDENES
-- ==============================================================================
CREATE TABLE public.ordenes (
  id BIGSERIAL PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  cliente_id BIGINT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  vendedor_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
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
  factura_emitida BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_factura TIMESTAMP WITH TIME ZONE,
  numero_factura TEXT,
  observaciones TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ordenes_cliente_id ON public.ordenes(cliente_id);
CREATE INDEX idx_ordenes_vendedor_id ON public.ordenes(vendedor_id);
CREATE INDEX idx_ordenes_numero ON public.ordenes(numero);
CREATE INDEX idx_ordenes_estado ON public.ordenes(estado);
CREATE INDEX idx_ordenes_created_at ON public.ordenes(created_at);
CREATE INDEX idx_ordenes_factura_emitida ON public.ordenes(factura_emitida);

-- Compatibilidad para bases existentes sin recrear:
ALTER TABLE public.ordenes ADD COLUMN IF NOT EXISTS factura_emitida BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.ordenes ADD COLUMN IF NOT EXISTS fecha_factura TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.ordenes ADD COLUMN IF NOT EXISTS numero_factura TEXT;
UPDATE public.ordenes SET factura_emitida = TRUE WHERE estado IN ('En bodega', 'Entregado al cliente');

-- ==============================================================================
-- PASO 8: ÍTEMS DE ÓRDENES (LLANTAS)
-- ==============================================================================
CREATE TABLE public.items (
  id BIGSERIAL PRIMARY KEY,
  orden_id BIGINT NOT NULL REFERENCES public.ordenes(id) ON DELETE CASCADE,
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

CREATE INDEX idx_items_orden_id ON public.items(orden_id);

-- ==============================================================================
-- PASO 9: ABONOS
-- ==============================================================================
CREATE TABLE public.abonos (
  id BIGSERIAL PRIMARY KEY,
  orden_id BIGINT NOT NULL REFERENCES public.ordenes(id) ON DELETE CASCADE,
  monto NUMERIC(12, 2) NOT NULL,
  fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  descripcion TEXT
);

CREATE INDEX idx_abonos_orden_id ON public.abonos(orden_id);

-- ==============================================================================
-- PASO 10: EVALUACIONES DE LLANTAS EN PLANTA
-- ==============================================================================
CREATE TABLE public.evaluaciones_llantas (
  id BIGSERIAL PRIMARY KEY,
  item_id BIGINT NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  orden_id BIGINT NOT NULL REFERENCES public.ordenes(id) ON DELETE CASCADE,
  evaluado_por UUID NOT NULL REFERENCES public.perfiles(id),
  numero_llanta INTEGER NOT NULL DEFAULT 1 CHECK (numero_llanta > 0),
  estado public.evaluacion_llanta_estado NOT NULL,
  observaciones TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_evaluaciones_llantas_item_numero ON public.evaluaciones_llantas(item_id, numero_llanta);
CREATE INDEX idx_evaluaciones_llantas_orden ON public.evaluaciones_llantas(orden_id);

ALTER TABLE public.evaluaciones_llantas ENABLE ROW LEVEL SECURITY;

CREATE POLICY evaluaciones_planta_gestion ON public.evaluaciones_llantas
  FOR ALL TO authenticated
  USING (public.es_admin_planta() OR public.es_jefe())
  WITH CHECK (public.es_admin_planta() OR public.es_jefe());

CREATE POLICY evaluaciones_vendedor_lectura ON public.evaluaciones_llantas
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ordenes WHERE ordenes.id = evaluaciones_llantas.orden_id AND ordenes.vendedor_id = auth.uid()));

CREATE POLICY evaluaciones_supervision_lectura ON public.evaluaciones_llantas
  FOR SELECT TO authenticated
  USING (public.puede_ver_equipo());

-- ==============================================================================
-- PASO 11: POLÍTICAS DE SEGURIDAD (RLS) LIBRES PARA MIGRACIÓN Y OPERACIÓN
-- ==============================================================================
-- Habilitamos RLS en las tablas operativas y permitimos acceso abierto
-- para que scripts de migración externos (ej. migración desde Excel) puedan
-- insertar clientes, órdenes, ítems y abonos sin errores de permisos 42501.
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abonos ENABLE ROW LEVEL SECURITY;

CREATE POLICY clientes_politica_abierta ON public.clientes
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY ordenes_politica_abierta ON public.ordenes
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY items_politica_abierta ON public.items
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY abonos_politica_abierta ON public.abonos
  FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- PASO 12: AUTO-RECONEXIÓN DE USUARIOS EXISTENTES EN SUPABASE AUTH
-- ==============================================================================
-- Si ya tenías usuarios creados en Supabase Auth (auth.users), este bloque
-- re-inserta sus perfiles automáticamente con rol 'jefe' si no tienen asignado uno,
-- para que nunca te quedes bloqueado al reiniciar el esquema.
INSERT INTO public.perfiles (id, nombre, nombres, apellidos, cedula, correo, telefono, rol, activo)
SELECT 
  u.id,
  COALESCE(
    NULLIF(trim(concat_ws(' ', u.raw_user_meta_data->>'nombres', u.raw_user_meta_data->>'apellidos')), ''),
    split_part(u.email, '@', 1),
    'Administrador'
  ) AS nombre,
  NULLIF(trim(u.raw_user_meta_data->>'nombres'), '') AS nombres,
  NULLIF(trim(u.raw_user_meta_data->>'apellidos'), '') AS apellidos,
  COALESCE(NULLIF(u.raw_user_meta_data->>'cedula', ''), 'CED-' || left(u.id::text, 8)) AS cedula,
  COALESCE(u.email, 'sin-correo@empresa.com') AS correo,
  NULLIF(trim(u.raw_user_meta_data->>'telefono'), '') AS telefono,
  COALESCE((u.raw_user_meta_data->>'rol')::public.app_role, 'jefe'::public.app_role) AS rol,
  true AS activo
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET
  correo = EXCLUDED.correo;

-- ==============================================================================
-- UTILIDADES ADICIONALES PARA MIGRACIÓN
-- ==============================================================================
-- Si en el futuro solo deseas vaciar todos los datos de clientes/ordenes/items/abonos
-- sin borrar las tablas ni la estructura, puedes ejecutar esta sola línea:
--
-- TRUNCATE TABLE public.abonos, public.items, public.evaluaciones_llantas, public.ordenes, public.clientes RESTART IDENTITY CASCADE;
-- ==============================================================================
