-- Ejecutar una sola vez en Supabase SQL Editor.
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS nombres TEXT;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS apellidos TEXT;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS telefono TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS perfiles_cedula_unica ON public.perfiles (cedula);