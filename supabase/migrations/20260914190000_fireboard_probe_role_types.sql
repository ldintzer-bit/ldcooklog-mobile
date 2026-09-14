ALTER TABLE public.fireboard_probe_roles
ADD COLUMN IF NOT EXISTS role_type text;

ALTER TABLE public.fireboard_probe_roles
DROP CONSTRAINT IF EXISTS fireboard_probe_roles_role_type_check;

ALTER TABLE public.fireboard_probe_roles
ADD CONSTRAINT fireboard_probe_roles_role_type_check
CHECK (role_type IS NULL OR role_type IN ('food', 'chamber', 'other'));

COMMENT ON COLUMN public.fireboard_probe_roles.role_type IS 'User-selected semantic sensor purpose for analysis: food, chamber, or other. No automatic guessing.';
