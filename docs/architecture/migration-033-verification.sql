-- Migration 033 verification -- schema only, same pattern as Migrations 029/031/032: constraint
-- existence, function signature, execute grants. No functional RPC calls against real Store
-- Goods Receipts -- functional/business acceptance testing is deferred to UAT.

-- 1. idempotency_key column exists on store_goods_receipts
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'store_goods_receipts' and column_name = 'idempotency_key';

-- 2. UNIQUE constraint exists on idempotency_key
select conname, contype
from pg_constraint
where conrelid = 'store_goods_receipts'::regclass
  and conname = 'store_goods_receipts_idempotency_key_key';

-- 3. Only the new 3-parameter signature exists (no legacy 2-parameter overload remains)
select p.oid::regprocedure as signature
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'submit_store_goods_receipt';
-- Expect exactly one row: submit_store_goods_receipt(uuid, jsonb, uuid)

-- 4. Execute grants on the new signature: PUBLIC revoked, authenticated granted, service_role not granted
select
  has_function_privilege('public', p.oid, 'EXECUTE') as public_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'submit_store_goods_receipt';
-- Expect: public_can_execute = false, authenticated_can_execute = true,
-- service_role_can_execute = false (no current caller, per Minimum Necessary API Surface)
