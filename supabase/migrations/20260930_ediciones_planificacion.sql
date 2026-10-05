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

DROP POLICY IF EXISTS ediciones_planificacion_vendedor_insert ON public.ediciones_planificacion;
CREATE POLICY ediciones_planificacion_vendedor_insert ON public.ediciones_planificacion
  FOR INSERT WITH CHECK (editado_por = auth.uid() AND vendedor_id = auth.uid());

DROP POLICY IF EXISTS ediciones_planificacion_supervision_lectura ON public.ediciones_planificacion;
CREATE POLICY ediciones_planificacion_supervision_lectura ON public.ediciones_planificacion
  FOR SELECT USING (public.puede_ver_equipo());
