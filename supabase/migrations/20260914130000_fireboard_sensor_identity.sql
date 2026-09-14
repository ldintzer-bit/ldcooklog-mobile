-- V1.23.6: a FireBoard sensor stream is identified by device UUID + FireBoard channel_id.
-- The existing channel_index column is retained for compatibility, but from V1.23.6 onward
-- it stores FireBoard's actual channel_id rather than the chart-array position.

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.fireboard_temperature_samples'::regclass
      AND c.contype = 'u'
      AND (
        SELECT array_agg(a.attname::text ORDER BY u.ordinality)
        FROM unnest(c.conkey) WITH ORDINALITY AS u(attnum, ordinality)
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid
         AND a.attnum = u.attnum
      ) = ARRAY['cook_fireboard_session_id','channel_index','observed_at']::text[]
  LOOP
    EXECUTE format('ALTER TABLE public.fireboard_temperature_samples DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

DROP INDEX IF EXISTS public.fireboard_temperature_samples_sensor_observed_key;

CREATE UNIQUE INDEX fireboard_temperature_samples_sensor_observed_key
  ON public.fireboard_temperature_samples
  (cook_fireboard_session_id, device_uuid, channel_index, observed_at)
  NULLS NOT DISTINCT;

COMMENT ON COLUMN public.fireboard_temperature_samples.channel_index IS
  'FireBoard channel_id. Before LDCookLog V1.23.6 this column held chart-array position for imported samples.';
