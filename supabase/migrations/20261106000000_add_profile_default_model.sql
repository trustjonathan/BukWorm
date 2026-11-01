ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS default_model TEXT;
