CREATE TABLE IF NOT EXISTS public.cook_preparation (
  cook_id uuid PRIMARY KEY REFERENCES public.cooks(id) ON DELETE CASCADE,
  trim_level text CHECK (trim_level IS NULL OR trim_level IN ('None','Light','Moderate','Heavy')),
  brine_marinade text CHECK (brine_marinade IS NULL OR brine_marinade IN ('None','Dry brine','Wet brine','Marinade')),
  injection text CHECK (injection IS NULL OR injection IN ('No','Yes')),
  prep_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cook_preparation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own cook preparation" ON public.cook_preparation
FOR SELECT USING (EXISTS (SELECT 1 FROM public.cooks c WHERE c.id = public.cook_preparation.cook_id));

CREATE POLICY "Users can insert own cook preparation" ON public.cook_preparation
FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.cooks c WHERE c.id = public.cook_preparation.cook_id));

CREATE POLICY "Users can update own cook preparation" ON public.cook_preparation
FOR UPDATE USING (EXISTS (SELECT 1 FROM public.cooks c WHERE c.id = public.cook_preparation.cook_id))
WITH CHECK (EXISTS (SELECT 1 FROM public.cooks c WHERE c.id = public.cook_preparation.cook_id));

CREATE POLICY "Users can delete own cook preparation" ON public.cook_preparation
FOR DELETE USING (EXISTS (SELECT 1 FROM public.cooks c WHERE c.id = public.cook_preparation.cook_id));