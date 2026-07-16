-- Migration 031 verification -- schema only, per the same pattern established for Migration 029:
-- constraint existence, function signature, execute grants. No functional RPC calls against
-- real Store Purchase Requests -- functional/business acceptance testing is deferred to UAT.

-- 1. idempotency_key column + unique constraint exist on store_purchase_requests
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'store_purchase_requests' and column_name = 'idempotency_key';

select conname, contype
from pg_constraint
where conrelid = 'store_purchase_requests'::regclass
  and conname = 'store_purchase_requests_idempotency_key_key';

-- 2. Old 3-parameter signature is gone; new 4-parameter signature exists
select p.oid::regprocedure as signature
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'submit_store_purchase_request';
-- Expect exactly one row: submit_store_purchase_request(uuid, text, jsonb, uuid)

-- 3. Execute grants on the new signature: PUBLIC revoked, authenticated granted
select
  has_function_privilege('public', p.oid, 'EXECUTE') as public_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'submit_store_purchase_request';
-- Expect: public_can_execute = false, authenticated_can_execute = true,
-- service_role_can_execute = false (no current caller, per Minimum Necessary API Surface)
