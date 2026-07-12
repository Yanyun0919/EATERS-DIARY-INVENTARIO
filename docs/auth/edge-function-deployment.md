# Edge Function Deployment Guide

Standard procedure for deploying and maintaining Supabase Edge Functions in this project. `invite-user` (`supabase/functions/invite-user/`) is the first one — this document is the template for every one after it.

## Prerequisites

- A Supabase account with access to the Eaters Diary project (Owner or Admin role — deploying functions and setting secrets requires elevated project access).
- Node.js installed locally (already required for this project) — used to run the CLI via `npx`, no separate install needed.
- The project's Supabase **project ref** — find it in the Dashboard URL (`https://supabase.com/dashboard/project/<project-ref>`) or under Project Settings → General → Reference ID.

This repository has never been initialized with the Supabase CLI before now — confirmed by the absence of `supabase/config.toml`. The `supabase/` directory here (`functions/`, `migrations/`) was built by hand, not scaffolded by `supabase init`. Step 3 below creates that missing config.

## 1. Supabase CLI installation

The CLI is not installed globally on this machine. Two options:

**Option A — no install, run via npx (recommended, simplest):**
```
npx supabase --version
```
This downloads and runs the CLI on demand. Every command below can be run as `npx supabase ...` with no separate install step. Confirmed working on this machine (`2.109.1` at time of writing).

**Option B — persistent local install**, if you'll be running CLI commands often enough that re-fetching via npx each time is annoying:
```
npm install --save-dev supabase
```
Then run commands as `npx supabase ...` (same invocation — npx will now use the locally installed version instead of downloading one each time).

Global `npm install -g supabase` is **not supported** by Supabase for this CLI — don't use it, it will fail or install an unsupported version.

## 2. Login procedure

```
npx supabase login
```

This opens a browser window for OAuth against your Supabase account and stores a session token locally (not in the repository — this is a per-machine, per-user credential, never commit it). Run this once per machine; the session persists across terminal sessions until it expires or you explicitly log out.

## 3. Project linking

Since this repo has no `supabase/config.toml` yet:

```
npx supabase init
```
(safe to run even though `supabase/functions/` and `supabase/migrations/` already exist by hand — it only adds the missing config file, it won't touch or overwrite those directories)

Then link to the actual project:

```
npx supabase link --project-ref <your-project-ref>
```

You'll be prompted for the database password (Project Settings → Database, or reset it there if you don't have it recorded). This writes `supabase/.temp/project-ref` locally (gitignored — every developer/machine links independently, it's not shared via the repo).

Verify the link succeeded:
```
npx supabase projects list
```
The linked project should be marked in the output.

## 4. Deployment command

```
npx supabase functions deploy invite-user
```

Once linked, `--project-ref` doesn't need repeating — the CLI reads it from `supabase/.temp/project-ref`. If you ever need to target a different project without re-linking, add `--project-ref <ref>` explicitly to override.

**Do not add `--no-verify-jwt`.** Leave JWT verification at its default (on). `invite-user`'s client-side caller (`supabase.functions.invoke()`) already sends the current session's real access token as the `Authorization` header automatically — the platform-level check confirms it's a valid Supabase session before the function even runs, as an extra layer in front of the function's own, stricter internal check (caller must be an active Administrator). Disabling platform verification would remove that outer layer for no benefit.

This command bundles and type-checks the function before publishing — a syntax or type error in `index.ts` fails the deploy immediately, with the error printed to the terminal. There isn't a separate "build-only, don't publish" step in this CLI version; the deploy command's own bundling step is the build verification.

## 5. Verification procedure

**In the terminal**, confirm the deploy command reported success (look for a deployed function URL in the output, no error text).

**Via the CLI:**
```
npx supabase functions list
```
`invite-user` should appear, with a status/version indicating it's active.

**In the Supabase Dashboard:** Edge Functions → `invite-user` should be listed, showing the deployment timestamp.

**Runtime check — trigger it once and read the logs**, rather than assuming a clean deploy means clean behavior. `npx supabase functions logs <name>` **does not exist in CLI `2.109.1`** (confirmed directly — returns "Unknown subcommand"); the only working path on this CLI version is the Dashboard: **Edge Functions → `invite-user` → click into an individual invocation row in the list → the detail view that opens (not a separate "Logs" tab)**. That's where this project's Dashboard actually surfaces a function's `console.log`/`console.error` output, which doesn't match Supabase's general documented layout — confirmed by direct trial during this project's own debugging session, not assumed. Do this *after* attempting UAT Scenario 1's employee creation — you're looking for the function actually executing without an uncaught exception, distinct from the function's own `{success: false, ...}` responses, which are normal, expected control flow, not errors.

## Configuration — what needs setting up manually, and what doesn't

Verified against the function's actual code (`supabase/functions/invite-user/index.ts`), not assumed:

- **`SUPABASE_URL`** — provided automatically to every Edge Function in every Supabase project. No manual configuration.
- **`SUPABASE_SERVICE_ROLE_KEY`** — also provided automatically, same as above. No manual configuration.
- **JWT verification** — handled two ways simultaneously, neither needing extra setup: the platform's default verification (see the deploy command note above, don't disable it) plus the function's own code, which independently re-validates the JWT via `adminClient.auth.getUser(jwt)` and checks the resulting user against `staff_profiles` for `role = 'administrator' AND is_active = true`. No secret or config value backs this — it's a live database query against your actual project data.
- **`redirectTo`** — not a secret or server config at all. It's supplied by the client on every request (`src/features/staff/api/staff.ts` sends `${window.location.origin}${ROUTES.SET_PASSWORD}`), validated inside the function (must be a well-formed `http`/`https` URL), and passed straight to `inviteUserByEmail()`. Nothing to configure here either.

**No Function Secrets need to be manually created for this function.** If a future function needs a *third-party* credential (a payment provider key, an external API token — something Supabase doesn't provide by default), that's when `supabase secrets set` becomes necessary; `invite-user` has no such dependency.

## Updating the function

Edit `supabase/functions/invite-user/index.ts` locally, then redeploy with the same command:
```
npx supabase functions deploy invite-user
```
There's no separate "update" command — deploy always publishes the current local file as the new active version. There's no staging/preview slot in this setup — a deploy goes live immediately. Test logic changes carefully before deploying (the function has no automated test suite; manual verification via the Dashboard's Logs after a real invocation is the only feedback loop today).

## Troubleshooting

- **`supabase: command not found`** — you're missing the `npx` prefix, or trying a global install that isn't supported. Use `npx supabase ...`.
- **Deploy fails with a TypeScript/syntax error** — read the printed error; it references the exact line in `index.ts`. Fix locally, redeploy.
- **Deploy succeeds but every call returns `NOT_ADMINISTRATOR`** — check that the account you're testing with actually has an active `staff_profiles` row with `role = 'administrator'` and `is_active = true`; the function's authorization check is a live query, not a guess.
- **Deploy succeeds but the client gets a network/CORS error, not a JSON response** — check the `corsHeaders` block in `index.ts` is still present and that `req.method === 'OPTIONS'` is still handled first in `Deno.serve` — a preflight failure looks like a generic network error in the browser, not a clean `{success: false}`.
- **`email rate limit exceeded` reappears** — this function only ever sends one email per call (`inviteUserByEmail`, no separate `signUp`/`resetPasswordForEmail` combination like the old flow had). If this recurs, it's a genuine volume/rate-limit issue on the Supabase project's email service, not a code regression — check Dashboard → Authentication → Rate Limits.
- **Logs show the function was invoked but nothing happened** — check the Dashboard invocation detail view (see the Verification section above — there is no working CLI `logs` command on this project's CLI version) for the actual `console.error`/exception output; the top-level `try/catch` in `Deno.serve` guarantees a `{success: false, code: 'UNKNOWN_ERROR', ...}` response even on an unexpected failure, but the *cause* is what needs reading in the logs, not just the generic response.
- **Can't find where logs are shown at all** — this project's Dashboard UI didn't match the standard documented layout during initial setup. If the invocation-detail-view approach above doesn't show anything, check for a separate top-level **Logs** or **Logs & Analytics** section in the left sidebar (distinct from Edge Functions), which lets you select "Edge Functions" as a log source and filter by function name — this turned out to be where logs live on some Dashboard versions.

## How to deploy future Edge Functions

1. Create `supabase/functions/<function-name>/index.ts`.
2. Follow `invite-user`'s architecture-boundary comment pattern at the top of the file — state plainly what the function is and is not responsible for, especially for anything touching business data versus infrastructure.
3. `npx supabase functions deploy <function-name>` — same command shape, just a different name. No per-function CLI setup beyond this.
4. Add its own "why this exists" doc under `docs/` if it's non-trivial, following this file and `docs/auth/edge-function.md` as the pattern.
5. Verify the same way: `npx supabase functions list`, check the Dashboard, check logs after a real invocation — don't consider a function "done" from a clean deploy alone.
