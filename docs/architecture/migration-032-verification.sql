-- Migration 032 verification -- schema only, same pattern as Migrations 029/031: constraint
-- existence, function signature, execute grants. No functional RPC calls against real Purchase
-- Orders -- functional/business acceptance testing is deferred to UAT.

-- 1. idempotency_key column exists on purchase_orders
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'purchase_orders' and column_name = 'idempotency_key';

-- 2. UNIQUE constraint exists on idempotency_key
select conname, contype
from pg_constraint
where conrelid = 'purchase_orders'::regclass
  and conname = 'purchase_orders_idempotency_key_key';

-- 3. Only the new 5-parameter signature exists (no legacy 4-parameter overload remains)
select p.oid::regprocedure as signature
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'create_purchase_order';
-- Expect exactly one row: create_purchase_order(uuid, uuid, text, jsonb, uuid)

-- 4. Execute grants on the new signature: PUBLIC revoked, authenticated granted, service_role not granted
select
  has_function_privilege('public', p.oid, 'EXECUTE') as public_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'create_purchase_order';
-- Expect: public_can_execute = false, authenticated_can_execute = true,
-- service_role_can_execute = false (no current caller, per Minimum Necessary API Surface)
