-- RPC execute permission hardening -- dedicated, single-purpose migration. Root cause: Postgres
-- grants EXECUTE to PUBLIC by default on every newly created function unless explicitly
-- revoked. Every security-definer RPC in this project's Supply Fulfillment layer added
-- `grant execute ... to authenticated` on top of that default without ever revoking the PUBLIC
-- grant underneath it -- confirmed by reading every RPC-creating migration (014, 017, 026, 027,
-- 029), not assumed. This affects all six functions identically; fixed here in one pass rather
-- than folded into whichever feature migration happened to be active, matching the precedent
-- already set by migration 023 (service_role_table_grants.sql) for exactly this shape of
-- project-wide, incidentally-discovered permissions gap.
--
-- Scope, deliberately narrow: revoke EXECUTE from PUBLIC, re-affirm EXECUTE for authenticated
-- (already granted everywhere; re-stating is a safe no-op, per this project's established
-- idempotent-GRANT convention) on every Supply Fulfillment RPC. No other schema or business
-- change.
--
-- postgres (the function owner): needs no explicit grant -- function ownership already implies
-- full EXECUTE rights, independent of PUBLIC/authenticated grants. Nothing to do here.
--
-- service_role: deliberately NOT granted. No Edge Function or other service_role caller invokes
-- any of these six RPCs anywhere in the approved architecture today (the project's only Edge
-- Function, invite-user, is unrelated -- authentication only). Revoking PUBLIC removes
-- service_role's previously-implicit access the same as everyone else's; not restoring it
-- speculatively for a caller that doesn't exist, per Minimum Necessary API Surface. If a future
-- Edge Function genuinely needs to call one of these, that grant should be added explicitly,
-- alongside that function, when that need is real.

revoke execute on function complete_stock_count(uuid) from public;
grant execute on function complete_stock_count(uuid) to authenticated;

revoke execute on function create_purchase_order(uuid, uuid, text, jsonb) from public;
grant execute on function create_purchase_order(uuid, uuid, text, jsonb) to authenticated;

revoke execute on function submit_store_purchase_request(uuid, text, jsonb) from public;
grant execute on function submit_store_purchase_request(uuid, text, jsonb) to authenticated;

revoke execute on function submit_store_goods_receipt(uuid, jsonb) from public;
grant execute on function submit_store_goods_receipt(uuid, jsonb) to authenticated;

revoke execute on function update_store_purchase_request(uuid, jsonb) from public;
grant execute on function update_store_purchase_request(uuid, jsonb) to authenticated;
