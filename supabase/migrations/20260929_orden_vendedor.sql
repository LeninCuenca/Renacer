ALTER TABLE public.ordenes
  ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ordenes_vendedor_id ON public.ordenes(vendedor_id);