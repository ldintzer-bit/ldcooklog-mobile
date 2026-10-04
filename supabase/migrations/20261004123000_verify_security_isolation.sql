-- Read-only assertions: no cook rows are changed or printed.
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $check$
DECLARE table_name text; row_count bigint;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['cooks','events','cook_fireboard_sessions','fireboard_temperature_samples','fireboard_probe_roles','cook_meat_pieces','cook_preparation','cook_evaluations','locations','equipment','cook_equipment','rubs','cook_rubs','cook_methods','sauces','cook_sauces','weather','fireboard_account_access']
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', table_name) INTO row_count;
    IF row_count <> 0 THEN RAISE EXCEPTION 'Cross-account read isolation failed for %', table_name; END IF;
  END LOOP;
  IF has_table_privilege(current_user, 'public.fireboard_account_access', 'INSERT')
    OR has_table_privilege(current_user, 'public.fireboard_account_access', 'UPDATE')
    OR has_table_privilege(current_user, 'public.fireboard_account_access', 'DELETE') THEN
    RAISE EXCEPTION 'FireBoard self-enrollment must be forbidden';
  END IF;
END $check$;
RESET ROLE;
-- Set the existing owner's claims internally, without emitting their ID.
DO $owner$ BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT owner_id FROM public.cooks WHERE id='7a765ed3-d946-465b-9a98-e437f99af8a8'), 'role', 'authenticated')::text, true);
END $owner$;
SET LOCAL ROLE authenticated;
DO $check$ BEGIN
  IF (SELECT count(*) FROM public.fireboard_account_access) <> 1 THEN RAISE EXCEPTION 'Existing FireBoard owner access failed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.cooks WHERE id='7a765ed3-d946-465b-9a98-e437f99af8a8') THEN RAISE EXCEPTION 'Existing owner cook access failed'; END IF;
END $check$;
RESET ROLE;
COMMIT;
