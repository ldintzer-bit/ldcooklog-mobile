-- The shared FireBoard credential is available only to its existing cook owner.
BEGIN;
CREATE TABLE public.fireboard_account_access (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fireboard_account_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fireboard_account_access FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.fireboard_account_access TO authenticated;
CREATE POLICY fireboard_account_access_self ON public.fireboard_account_access
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DO $seed$
DECLARE account_owner uuid;
BEGIN
  SELECT owner_id INTO STRICT account_owner FROM public.cooks
    WHERE id = '7a765ed3-d946-465b-9a98-e437f99af8a8' AND cook_id = '20261001-001';
  IF account_owner IS NULL THEN RAISE EXCEPTION 'Existing FireBoard owner could not be verified'; END IF;
  INSERT INTO public.fireboard_account_access(user_id) VALUES(account_owner);
END $seed$;
COMMIT;
