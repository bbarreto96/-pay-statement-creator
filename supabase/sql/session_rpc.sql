-- Transactional replace RPC for session entries
-- Creates or replaces a function to replace all entries for a given session_id in a single transaction.

create or replace function app_replace_session_entries(
  p_session_id uuid,
  p_rows jsonb
) returns void
language plpgsql
security definer
as $$
begin
  -- wrap in a transaction implicitly by function body
  delete from app_pay_session_entries where session_id = p_session_id;

  if jsonb_array_length(p_rows) > 0 then
    insert into app_pay_session_entries (session_id, contractor_id, contractor_name, amount)
    select
      (elem->>'session_id')::uuid,
      (elem->>'contractor_id')::text,
      (elem->>'contractor_name')::text,
      coalesce((elem->>'amount')::numeric, 0)
    from jsonb_array_elements(p_rows) as elem;
  end if;
end;
$$;

-- Optional: grant execute to anon if using client-side RPC
grant execute on function app_replace_session_entries(uuid, jsonb) to anon;
