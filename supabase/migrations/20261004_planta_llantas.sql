ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'administrador_planta';

DO $$
BEGIN
  CREATE TYPE evaluacion_llanta_estado AS ENUM ('pendiente', 'valida', 'no_valida');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.evaluaciones_llantas (
  id BIGSERIAL PRIMARY KEY,
  item_id BIGINT NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  orden_id BIGINT NOT NULL REFERENCES public.ordenes(id) ON DELETE CASCADE,
  evaluado_por UUID NOT NULL REFERENCES public.perfiles(id),
  numero_llanta INTEGER NOT NULL DEFAULT 1 CHECK (numero_llanta > 0),
  estado evaluacion_llanta_estado NOT NULL,
  observaciones TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.evaluaciones_llantas ADD COLUMN IF NOT EXISTS numero_llanta INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.evaluaciones_llantas DROP CONSTRAINT IF EXISTS evaluaciones_llantas_item_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS evaluaciones_llantas_item_numero_key ON public.evaluaciones_llantas(item_id, numero_llanta);

CREATE INDEX IF NOT EXISTS idx_evaluaciones_llantas_orden ON public.evaluaciones_llantas(orden_id);
ALTER TABLE public.evaluaciones_llantas ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.es_admin_planta()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol::text = 'administrador_planta' AND activo = true);
$$;

DROP POLICY IF EXISTS evaluaciones_planta_gestion ON public.evaluaciones_llantas;
CREATE POLICY evaluaciones_planta_gestion ON public.evaluaciones_llantas
  FOR ALL USING (public.es_admin_planta()) WITH CHECK (public.es_admin_planta());

DROP POLICY IF EXISTS evaluaciones_vendedor_lectura ON public.evaluaciones_llantas;
CREATE POLICY evaluaciones_vendedor_lectura ON public.evaluaciones_llantas
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.ordenes WHERE ordenes.id = evaluaciones_llantas.orden_id AND ordenes.vendedor_id = auth.uid()));

DROP POLICY IF EXISTS evaluaciones_supervision_lectura ON public.evaluaciones_llantas;
CREATE POLICY evaluaciones_supervision_lectura ON public.evaluaciones_llantas
  FOR SELECT USING (public.puede_ver_equipo());
