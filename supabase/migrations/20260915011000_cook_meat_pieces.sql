-- LDCookLog Complete Cook Record — Stage 1
-- One cook can contain one or more individually described pieces of meat.

CREATE TABLE IF NOT EXISTS public.cook_meat_pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id uuid NOT NULL REFERENCES public.cooks(id) ON DELETE CASCADE,
  piece_number integer NOT NULL CHECK (piece_number > 0),
  meat_cut text,
  package_weight numeric CHECK (package_weight IS NULL OR package_weight >= 0),
  cook_weight numeric CHECK (cook_weight IS NULL OR cook_weight >= 0),
  weight_unit text NOT NULL DEFAULT 'lb',
  bone_status text CHECK (bone_status IS NULL OR bone_status IN ('bone-in','boneless')),
  brand_producer text,
  store_source text,
  total_price numeric CHECK (total_price IS NULL OR total_price >= 0),
  price_per_lb numeric CHECK (price_per_lb IS NULL OR price_per_lb >= 0),
  grade_type text,
  meat_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cook_id, piece_number)
);

CREATE INDEX IF NOT EXISTS cook_meat_pieces_cook_id_idx
  ON public.cook_meat_pieces(cook_id);

ALTER TABLE public.cook_meat_pieces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own cook meat pieces"
ON public.cook_meat_pieces FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.cooks c WHERE c.id = public.cook_meat_pieces.cook_id)
);

CREATE POLICY "Users can insert own cook meat pieces"
ON public.cook_meat_pieces FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.cooks c WHERE c.id = public.cook_meat_pieces.cook_id)
);

CREATE POLICY "Users can update own cook meat pieces"
ON public.cook_meat_pieces FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.cooks c WHERE c.id = public.cook_meat_pieces.cook_id)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.cooks c WHERE c.id = public.cook_meat_pieces.cook_id)
);

CREATE POLICY "Users can delete own cook meat pieces"
ON public.cook_meat_pieces FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.cooks c WHERE c.id = public.cook_meat_pieces.cook_id)
);

COMMENT ON TABLE public.cook_meat_pieces IS
  'Complete Cook Record: individually described meat pieces belonging to one cook. Stage 1 intentionally keeps all descriptive/purchase fields optional.';
