CREATE TABLE IF NOT EXISTS public.fireboard_probe_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id uuid NOT NULL REFERENCES public.cooks(id) ON DELETE CASCADE,
  device_uuid text NOT NULL,
  channel_id integer NOT NULL,
  source_label text,
  cook_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cook_id, device_uuid, channel_id)
);

ALTER TABLE public.fireboard_probe_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own FireBoard probe roles"
ON public.fireboard_probe_roles FOR SELECT
USING (EXISTS (SELECT 1 FROM public.cooks c WHERE c.id = cook_id AND c.user_id = auth.uid()));

CREATE POLICY "Users can insert own FireBoard probe roles"
ON public.fireboard_probe_roles FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.cooks c WHERE c.id = cook_id AND c.user_id = auth.uid()));

CREATE POLICY "Users can update own FireBoard probe roles"
ON public.fireboard_probe_roles FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.cooks c WHERE c.id = cook_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.cooks c WHERE c.id = cook_id AND c.user_id = auth.uid()));

CREATE POLICY "Users can delete own FireBoard probe roles"
ON public.fireboard_probe_roles FOR DELETE
USING (EXISTS (SELECT 1 FROM public.cooks c WHERE c.id = cook_id AND c.user_id = auth.uid()));

COMMENT ON TABLE public.fireboard_probe_roles IS 'V1.24.0 cook-specific semantic roles layered over permanent FireBoard device UUID + channel ID sensor identity.';
