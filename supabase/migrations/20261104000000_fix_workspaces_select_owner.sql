-- Allow a workspace owner to read their own workspace row directly.
-- Needed because can_access_workspace(id) cannot see a row inserted in the
-- same statement, which broke INSERT ... RETURNING (select=*) in PostgREST.
-- Already applied manually to the live project; idempotent so re-running is safe.
begin;

drop policy if exists workspaces_select_accessible on workspaces;

create policy workspaces_select_accessible
on workspaces
for select
to authenticated
using (
  user_id = auth.uid()
  or can_access_workspace(id)
);

commit;
