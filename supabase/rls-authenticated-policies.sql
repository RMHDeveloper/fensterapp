-- Fenster App — RLS cutover, step 1 of 2 (Phase C1)
-- Adds real, session-scoped policies for the `authenticated` Postgres role.
-- Deliberately ADDITIVE — the existing "Allow all for anon" policies are left
-- in place here so the currently-deployed frontend (which still uses the
-- anon key with no real session) keeps working without interruption. Once
-- the new frontend (real Supabase Auth login) is deployed and confirmed
-- working, run rls-drop-anon.sql separately to actually lock anon out.
--
-- Every rule below mirrors an existing client-side check so behavior doesn't
-- change for legitimate users — see the file/line cited in each comment.

-- ─── Helpers ─────────────────────────────────────────────────────────────────

-- The managed-user id (fenster_managed_users.id) linked to the calling session.
CREATE OR REPLACE FUNCTION fenster_my_id() RETURNS TEXT AS $$
  SELECT id FROM fenster_managed_users WHERE auth_user_id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Every role the calling session holds (mirrors src/utils/permissions.ts hasRole,
-- which checks `user.roles ?? [user.role]`), normalized so the legacy aliases
-- (production_team, installation_incharge) count as their modern equivalent —
-- mirrors src/data/permissions.ts ROLE_PERMISSIONS treating them identically.
CREATE OR REPLACE FUNCTION fenster_my_roles() RETURNS TEXT[] AS $$
  SELECT ARRAY(
    SELECT CASE WHEN r = 'production_team' THEN 'production_manager'
                WHEN r = 'installation_incharge' THEN 'technician'
                ELSE r END
    FROM (
      SELECT jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(u.data->'roles') = 'array' AND jsonb_array_length(u.data->'roles') > 0
             THEN u.data->'roles'
             ELSE to_jsonb(ARRAY[u.role])
        END
      ) AS r
      FROM fenster_managed_users u
      WHERE u.auth_user_id = auth.uid()
    ) roles
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION fenster_has_role(want TEXT) RETURNS BOOLEAN AS $$
  SELECT want = ANY(fenster_my_roles())
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Mirrors src/utils/stageHelpers.ts getProjectFilterStage — the project's active
-- (non-completed) flow task's stage/status, bucketed the same way.
CREATE OR REPLACE FUNCTION fenster_project_stage_bucket(p_project_id TEXT) RETURNS TEXT AS $$
  SELECT CASE
    WHEN t.flow_stage IN ('production_assign', 'production_check') THEN 'pre_production'
    WHEN t.flow_stage = 'production_work' THEN
      CASE WHEN t.data->>'flowStatus' = 'ready_to_pack' THEN 'ready_to_dispatch' ELSE 'production' END
    WHEN t.flow_stage IN ('dispatch_assign','admin_availability_check','site_lead_approval','installation_assign') THEN 'ready_to_dispatch'
    WHEN t.flow_stage = 'installation_update' THEN 'installation'
    WHEN t.flow_stage IN ('final_payment','final_completion') THEN 'collection'
    ELSE NULL
  END
  FROM fenster_tasks t
  WHERE t.project_id = p_project_id AND t.flow_stage IS NOT NULL AND t.flow_stage <> '' AND t.flow_stage <> 'completed'
  LIMIT 1
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Mirrors src/screens/Projects/ProjectsScreen.tsx matchesRoleVisibility exactly.
CREATE OR REPLACE FUNCTION fenster_can_see_project(p_project_id TEXT) RETURNS BOOLEAN AS $$
  SELECT
    CASE
      WHEN fenster_has_role('owner') THEN true
      WHEN fenster_has_role('viewer') THEN true
      WHEN fenster_has_role('lead_manager') THEN p.data->>'ownerId' = fenster_my_id()
      WHEN fenster_has_role('site_engineer') THEN EXISTS (
        SELECT 1 FROM fenster_tasks t
        WHERE t.project_id = p_project_id
          AND (t.data->>'type' = 'site_visit' OR t.flow_stage IN ('site_assign','site_visit'))
          AND fenster_my_id() = ANY(ARRAY[
            (SELECT id FROM fenster_managed_users WHERE full_name = t.data->>'assignedTo'),
            (SELECT id FROM fenster_managed_users WHERE full_name = t.data->>'assignee'),
            (SELECT id FROM fenster_managed_users WHERE full_name = t.data->>'siteEngineerName')
          ])
      )
      WHEN fenster_has_role('production_admin') THEN
        p.status = 'completed' OR p.current_stage = 'completed' OR (p.data->>'isCompleted')::boolean IS TRUE
        OR fenster_project_stage_bucket(p_project_id) IN ('pre_production', 'production')
      WHEN fenster_has_role('production_manager') THEN
        p.status = 'completed' OR p.current_stage = 'completed' OR (p.data->>'isCompleted')::boolean IS TRUE
        OR fenster_project_stage_bucket(p_project_id) IN ('pre_production', 'production', 'ready_to_dispatch')
      WHEN fenster_has_role('technician') OR fenster_has_role('site_engineer_lead') THEN
        p.status = 'completed' OR p.current_stage = 'completed' OR (p.data->>'isCompleted')::boolean IS TRUE
        OR fenster_project_stage_bucket(p_project_id) IN ('ready_to_dispatch', 'installation')
      ELSE false
    END
  FROM fenster_projects p WHERE p.id = p_project_id
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ─── fenster_managed_users ──────────────────────────────────────────────────
-- Own row always readable; owner can read/write every row (User Management).
-- Self UPDATE is allowed but a trigger below blocks changes to role/status —
-- otherwise a user could grant themselves 'owner' by editing their own row.
CREATE POLICY "authenticated select own or owner all" ON fenster_managed_users
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR fenster_has_role('owner'));

CREATE POLICY "authenticated insert owner only" ON fenster_managed_users
  FOR INSERT TO authenticated
  WITH CHECK (fenster_has_role('owner'));

CREATE POLICY "authenticated update own or owner" ON fenster_managed_users
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid() OR fenster_has_role('owner'))
  WITH CHECK (auth_user_id = auth.uid() OR fenster_has_role('owner'));

CREATE POLICY "authenticated delete owner only" ON fenster_managed_users
  FOR DELETE TO authenticated
  USING (fenster_has_role('owner'));

CREATE OR REPLACE FUNCTION fenster_protect_privileged_user_fields() RETURNS TRIGGER AS $$
BEGIN
  IF fenster_has_role('owner') THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.status IS DISTINCT FROM OLD.status
     OR (NEW.data->'roles') IS DISTINCT FROM (OLD.data->'roles')
     OR (NEW.data->>'role') IS DISTINCT FROM (OLD.data->>'role')
     OR (NEW.data->>'status') IS DISTINCT FROM (OLD.data->>'status') THEN
    RAISE EXCEPTION 'Only an owner can change role or status.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS fenster_managed_users_protect_privileged ON fenster_managed_users;
CREATE TRIGGER fenster_managed_users_protect_privileged
  BEFORE UPDATE ON fenster_managed_users
  FOR EACH ROW EXECUTE FUNCTION fenster_protect_privileged_user_fields();

-- ─── fenster_projects ────────────────────────────────────────────────────────
-- src/screens/Projects/ProjectsScreen.tsx matchesRoleVisibility (see fenster_can_see_project)
CREATE POLICY "authenticated select visible projects" ON fenster_projects
  FOR SELECT TO authenticated USING (fenster_can_see_project(id));

-- Create project: owner or lead_manager (matches create_project permission)
CREATE POLICY "authenticated insert projects" ON fenster_projects
  FOR INSERT TO authenticated
  WITH CHECK (fenster_has_role('owner') OR fenster_has_role('lead_manager'));

-- Update: anyone who can see the project can act on it at their stage — the
-- app's own can()/PermissionGate checks already restrict which UI actions are
-- offered; this just keeps people who can't see the project from writing to it.
CREATE POLICY "authenticated update visible projects" ON fenster_projects
  FOR UPDATE TO authenticated
  USING (fenster_can_see_project(id)) WITH CHECK (fenster_can_see_project(id));

CREATE POLICY "authenticated delete owner only" ON fenster_projects
  FOR DELETE TO authenticated USING (fenster_has_role('owner'));

-- ─── fenster_leads ───────────────────────────────────────────────────────────
-- src/screens/Leads/LeadsScreen.tsx :234 (own leads) + permissions.ts (view_leads roles)
CREATE POLICY "authenticated select visible leads" ON fenster_leads
  FOR SELECT TO authenticated
  USING (
    fenster_has_role('owner') OR fenster_has_role('site_engineer_lead')
    OR (fenster_has_role('lead_manager') AND (owner_id = fenster_my_id() OR owner_id IS NULL))
  );

CREATE POLICY "authenticated insert leads" ON fenster_leads
  FOR INSERT TO authenticated
  WITH CHECK (fenster_has_role('owner') OR fenster_has_role('lead_manager') OR fenster_has_role('site_engineer_lead'));

CREATE POLICY "authenticated update leads" ON fenster_leads
  FOR UPDATE TO authenticated
  USING (fenster_has_role('owner') OR (fenster_has_role('lead_manager') AND (owner_id = fenster_my_id() OR owner_id IS NULL)))
  WITH CHECK (fenster_has_role('owner') OR (fenster_has_role('lead_manager') AND (owner_id = fenster_my_id() OR owner_id IS NULL)));

CREATE POLICY "authenticated delete leads owner only" ON fenster_leads
  FOR DELETE TO authenticated USING (fenster_has_role('owner'));

-- ─── fenster_tasks ───────────────────────────────────────────────────────────
-- src/screens/ProjectDetail/ProjectDetailScreen.tsx shows every task on a
-- project it can show at all — task visibility mirrors project visibility.
CREATE POLICY "authenticated select tasks on visible projects" ON fenster_tasks
  FOR SELECT TO authenticated USING (fenster_can_see_project(project_id));

CREATE POLICY "authenticated insert tasks on visible projects" ON fenster_tasks
  FOR INSERT TO authenticated WITH CHECK (fenster_can_see_project(project_id));

CREATE POLICY "authenticated update tasks on visible projects" ON fenster_tasks
  FOR UPDATE TO authenticated
  USING (fenster_can_see_project(project_id)) WITH CHECK (fenster_can_see_project(project_id));

CREATE POLICY "authenticated delete tasks owner only" ON fenster_tasks
  FOR DELETE TO authenticated USING (fenster_has_role('owner'));

-- ─── fenster_payments / fenster_mistakes / fenster_files / fenster_activity_logs ─
-- All scoped transitively through their parent project's visibility.
CREATE POLICY "authenticated select payments on visible projects" ON fenster_payments
  FOR SELECT TO authenticated USING (fenster_can_see_project(project_id));
CREATE POLICY "authenticated write payments on visible projects" ON fenster_payments
  FOR INSERT TO authenticated WITH CHECK (fenster_can_see_project(project_id));
CREATE POLICY "authenticated update payments on visible projects" ON fenster_payments
  FOR UPDATE TO authenticated USING (fenster_can_see_project(project_id)) WITH CHECK (fenster_can_see_project(project_id));
CREATE POLICY "authenticated delete payments owner only" ON fenster_payments
  FOR DELETE TO authenticated USING (fenster_has_role('owner'));

CREATE POLICY "authenticated select mistakes on visible projects" ON fenster_mistakes
  FOR SELECT TO authenticated USING (fenster_can_see_project(project_id));
CREATE POLICY "authenticated write mistakes on visible projects" ON fenster_mistakes
  FOR INSERT TO authenticated WITH CHECK (fenster_can_see_project(project_id));
CREATE POLICY "authenticated update mistakes on visible projects" ON fenster_mistakes
  FOR UPDATE TO authenticated USING (fenster_can_see_project(project_id)) WITH CHECK (fenster_can_see_project(project_id));
CREATE POLICY "authenticated delete mistakes owner only" ON fenster_mistakes
  FOR DELETE TO authenticated USING (fenster_has_role('owner'));

CREATE POLICY "authenticated select files on visible projects" ON fenster_files
  FOR SELECT TO authenticated USING (fenster_can_see_project(project_id));
CREATE POLICY "authenticated write files on visible projects" ON fenster_files
  FOR INSERT TO authenticated WITH CHECK (fenster_can_see_project(project_id));
CREATE POLICY "authenticated update files on visible projects" ON fenster_files
  FOR UPDATE TO authenticated USING (fenster_can_see_project(project_id)) WITH CHECK (fenster_can_see_project(project_id));
CREATE POLICY "authenticated delete files on visible projects" ON fenster_files
  FOR DELETE TO authenticated USING (fenster_can_see_project(project_id));

CREATE POLICY "authenticated select activity logs on visible projects" ON fenster_activity_logs
  FOR SELECT TO authenticated USING (project_id IS NULL OR fenster_can_see_project(project_id));
CREATE POLICY "authenticated write activity logs on visible projects" ON fenster_activity_logs
  FOR INSERT TO authenticated WITH CHECK (project_id IS NULL OR fenster_can_see_project(project_id));

-- ─── fenster_production ──────────────────────────────────────────────────────
-- Same project-visibility scoping as tasks (production items always tie to a project).
CREATE POLICY "authenticated select production on visible projects" ON fenster_production
  FOR SELECT TO authenticated USING (fenster_can_see_project(project_id));
CREATE POLICY "authenticated write production on visible projects" ON fenster_production
  FOR INSERT TO authenticated WITH CHECK (fenster_can_see_project(project_id));
CREATE POLICY "authenticated update production on visible projects" ON fenster_production
  FOR UPDATE TO authenticated USING (fenster_can_see_project(project_id)) WITH CHECK (fenster_can_see_project(project_id));

-- ─── fenster_dashboard_targets ───────────────────────────────────────────────
-- Single global config row — any authenticated user can read it, only owner sets it.
CREATE POLICY "authenticated select dashboard targets" ON fenster_dashboard_targets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write dashboard targets owner only" ON fenster_dashboard_targets
  FOR INSERT TO authenticated WITH CHECK (fenster_has_role('owner'));
CREATE POLICY "authenticated update dashboard targets owner only" ON fenster_dashboard_targets
  FOR UPDATE TO authenticated USING (fenster_has_role('owner')) WITH CHECK (fenster_has_role('owner'));
