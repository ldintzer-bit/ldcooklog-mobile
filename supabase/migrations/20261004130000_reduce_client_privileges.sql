-- REST clients need ownership-protected data operations, not DDL privileges.
BEGIN;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM authenticated;
DO $check$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    IF has_table_privilege('anon', format('public.%I', t.tablename), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
      RAISE EXCEPTION 'Anonymous table privileges remain for %', t.tablename;
    END IF;
    IF has_table_privilege('authenticated', format('public.%I', t.tablename), 'TRUNCATE,REFERENCES,TRIGGER') THEN
      RAISE EXCEPTION 'Unneeded client privileges remain for %', t.tablename;
    END IF;
  END LOOP;
END $check$;
COMMIT;
