CREATE TABLE IF NOT EXISTS public.planificaciones_semanales (
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

CREATE INDEX IF NOT EXISTS idx_planificaciones_semana ON public.planificaciones_semanales(semana_inicio);
CREATE INDEX IF NOT EXISTS idx_planificaciones_vendedor ON public.planificaciones_semanales(vendedor_id);
ALTER TABLE public.planificaciones_semanales ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.puede_ver_equipo()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND activo = true AND rol IN ('supervisor', 'jefe'));
$$;

CREATE POLICY planificacion_vendedor_propia ON public.planificaciones_semanales
  FOR ALL USING (vendedor_id = auth.uid()) WITH CHECK (vendedor_id = auth.uid());

CREATE POLICY planificacion_supervision_lectura ON public.planificaciones_semanales
  FOR SELECT USING (public.puede_ver_equipo());

CREATE POLICY perfiles_select_supervisor ON public.perfiles
  FOR SELECT USING (public.puede_ver_equipo());

CREATE TABLE IF NOT EXISTS public.ediciones_planificacion (
  id BIGSERIAL PRIMARY KEY,
  vendedor_id UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  editado_por UUID NOT NULL REFERENCES public.perfiles(id),
  semana_inicio DATE NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ediciones_planificacion_busqueda
  ON public.ediciones_planificacion(vendedor_id, semana_inicio, version DESC);
ALTER TABLE public.ediciones_planificacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY ediciones_planificacion_vendedor_insert ON public.ediciones_planificacion
  FOR INSERT WITH CHECK (editado_por = auth.uid() AND vendedor_id = auth.uid());

CREATE POLICY ediciones_planificacion_supervision_lectura ON public.ediciones_planificacion
  FOR SELECT USING (public.puede_ver_equipo());