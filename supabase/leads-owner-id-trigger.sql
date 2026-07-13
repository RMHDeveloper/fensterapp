-- Keeps fenster_leads.owner_id in sync with data->>'assignee' going forward,
-- so newly-created/reassigned leads stay correctly scoped under the leads RLS
-- policy without any app-code change — mirrors the one-time backfill logic in
-- auth-migration.sql exactly (unique-name match against active lead_managers).
CREATE OR REPLACE FUNCTION fenster_leads_sync_owner_id() RETURNS TRIGGER AS $$
DECLARE
  v_owner_id TEXT;
  v_count INT;
BEGIN
  SELECT COUNT(*), MIN(m.id) INTO v_count, v_owner_id
  FROM fenster_managed_users m
  WHERE m.role = 'lead_manager' AND m.full_name = (NEW.data->>'assignee');
  NEW.owner_id := CASE WHEN v_count = 1 THEN v_owner_id ELSE NULL END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS fenster_leads_sync_owner_id_trigger ON fenster_leads;
CREATE TRIGGER fenster_leads_sync_owner_id_trigger
  BEFORE INSERT OR UPDATE ON fenster_leads
  FOR EACH ROW EXECUTE FUNCTION fenster_leads_sync_owner_id();
