-- Run once in Supabase Dashboard > SQL Editor as the project owner/postgres role.
-- Kawal performs these writes only from the Bun backend using SUPABASE_SERVICE_ROLE_KEY.

begin;

grant usage on schema public to service_role;
grant select on table public.warning to service_role;
grant select on table public.environment_condition to service_role;
grant select on table public.work_hours to service_role;
grant select on table public.inactivity_log to service_role;
grant select, update on table public.rest_break to service_role;

commit;

-- Refresh PostgREST's schema/privilege cache immediately.
notify pgrst, 'reload schema';
