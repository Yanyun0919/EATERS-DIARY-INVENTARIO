# Service Role Table Privileges — Investigation and Fix

Full investigation record behind `023_service_role_table_grants.sql`. The migration itself stays concise; this document holds the detailed trail for anyone who needs to understand *why* it exists later.

## Symptom

UAT Scenario 1 (Personal → Nuevo Empleado → Crear Empleado) failed with a generic "Algo salió mal." in the frontend. The `invite-user` Edge Function had already been confirmed deployed and reachable (Dashboard showed it `ACTIVE`, invocations returning HTTP 200).

## Investigation, in order

1. **Temporary diagnostic logging** was added to both `createStaffAccount()` (client) and `invite-user` (Edge Function), covering every step from request receipt through to the final returned payload.
2. **Frontend evidence** showed `functions.invoke()` completing successfully (no transport-level `error`), with `data` containing `{ success: false, code: "UNKNOWN_ERROR", message: "Could not verify the caller." }` — meaning the function ran to completion and returned a controlled failure, not a crash.
3. Tracing the Edge Function's own branching logic for that exact code/message pair, by construction, ruled out several candidate causes with certainty (not guessed): the `Authorization` header was present, the required environment variables were present, and `auth.getUser(jwt)` successfully resolved the caller's identity. The only remaining branch that produces that exact message is a genuine Postgres error (`profileError`) from the `staff_profiles` lookup query — not a "zero rows / not an administrator" case, which returns a different message entirely.
4. A **temporary `debug` field** was added to the caller-verification failure responses only (never touching `inviteUserByEmail()` or any business logic) to surface the exact Postgres error without needing Dashboard navigation (which turned out to differ from the standard documented layout for this project's Dashboard UI version).
5. The debug payload revealed the exact error: **`permission denied for table staff_profiles` (PostgreSQL `42501`)**, with the hint `GRANT SELECT ON public.staff_profiles TO service_role`.
6. This ruled out the JWT/Authorization/caller-resolution path entirely — `42501` is a **grant-level** error, evaluated *before* Row Level Security, distinct from an RLS rejection (which returns zero rows silently, never an error).
7. A direct, read-only privilege audit (`has_table_privilege('service_role', ...)`) confirmed the gap was not isolated to `staff_profiles` — every table in `public` returned `false` for `SELECT`, and a follow-up audit confirmed the same for `INSERT`, `UPDATE`, and `DELETE`.
8. Before concluding this was abnormal, official Supabase documentation was checked directly (not relied on from memory) to confirm the expected baseline.

## Official documentation findings

- [Postgres Roles | Supabase Docs](https://supabase.com/docs/guides/database/postgres/roles): *"By default on existing projects, tables and functions you create in public are automatically granted SELECT, INSERT, UPDATE, DELETE (or EXECUTE for functions) to `anon`, `authenticated`, and `service_role`."*
- `BYPASSRLS` (which `service_role` has) and table-level `GRANT` are independent Postgres layers. `BYPASSRLS` only skips row-level security, evaluated *after* the table-level grant check already passed. A role can have `BYPASSRLS` and still be denied outright with no grant at all — which is exactly what was happening here.
- [Understanding API keys](https://supabase.com/docs/guides/getting-started/api-keys) confirms the service-role key is meant to authorize access via the `service_role` Postgres role by design.
- [Troubleshooting: service role key client getting RLS errors](https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z) documents a *separate*, unrelated failure pattern (certain auth methods on a client silently swapping which `Authorization` header subsequent requests use) — worth keeping in mind if a *different* symptom ever appears after this fix, but not what was observed here: the privilege audit is independent of any specific request's identity, since it queries the role's static grant state directly.

## Root cause

This project's `service_role` was found to be missing the documented baseline grants (`SELECT`/`INSERT`/`UPDATE`/`DELETE`) on every table in `public`. Confirmed not caused by anything in this project's own migration history: all 22 prior migrations (001–022) were read in full during this investigation, and none of them ever grants to or revokes from `service_role` — every explicit `GRANT`/`REVOKE` in this schema targets `authenticated` or `anon` only. The gap predates and is independent of this project's own migrations; nothing in this codebase caused it, and nothing in this codebase could have prevented it without knowing to check for it.

`invite-user` is the first Edge Function in this project — the first thing to ever actually exercise `service_role`'s table-level privileges through PostgREST. Every prior migration and verification query in this project's history ran through the SQL Editor, which connects as a privileged owner role, not `service_role` — so the gap had no prior opportunity to surface.

## Fix

`023_service_role_table_grants.sql` — a single `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;`. Scoped deliberately narrow: exactly the four documented default privilege types (not `ALL PRIVILEGES`), existing tables only (not `ALTER DEFAULT PRIVILEGES`), no schema-level `USAGE` grant (no evidence gathered that it was missing), no RLS/policy/function/trigger/`anon`/`authenticated` change.

## Deliberately out of scope

Whether *future* tables should automatically receive the same `service_role` grants (via `ALTER DEFAULT PRIVILEGES`) is a separate architectural decision, not bundled into this bug-fix migration. To be evaluated and decided explicitly later, as its own migration, if the project determines it's needed.
