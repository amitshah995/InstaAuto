-- Allow automations with trigger_source = 'live' (Live comment trigger). Idempotent.
-- Why: migrations/add_trigger_source.sql limited the column to ('comment','dm','story'), so saving a rule from the Live
-- tab was rejected by the database even though the API and UI accept 'live'.
-- Run once in the Supabase SQL editor; safe to run again.
DO $$
DECLARE
  c record;
BEGIN
  -- Drop whatever CHECK constraint currently guards automations.trigger_source (its generated name can differ per project).
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.automations'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%trigger_source%'
  LOOP
    EXECUTE format('ALTER TABLE public.automations DROP CONSTRAINT %I', c.conname);
  END LOOP;

  ALTER TABLE public.automations
    ADD CONSTRAINT automations_trigger_source_check
    CHECK (trigger_source IN ('comment', 'dm', 'story', 'live'));
END $$;
