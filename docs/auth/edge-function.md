# `invite-user` Edge Function

## Why `auth.admin.inviteUserByEmail()` instead of `auth.signUp()`

Employee account creation in this app is **administrator-provisioned**, not public self-registration. `auth.signUp()` is built for the opposite case — a person signing themselves up — and using it for admin-provisioned accounts caused three real, observed problems during UAT:

- **Ambiguous duplicate-email handling.** `signUp()` has anti-enumeration protection: calling it with an email that already has an account returns a response shaped like success, without a clear signal that nothing was actually created. That protection exists to stop an anonymous attacker from probing which emails are registered — it doesn't apply when the caller is a verified, authenticated Administrator, and coding around it (checking `identities.length`) was a workaround for a security feature that didn't even fit the use case. In production this surfaced as a foreign key violation when the client tried to insert a `staff_profiles` row referencing a `user_id` that wasn't actually a new, committed row.
- **Session hijack risk.** `signUp()` logs the newly created user in. Calling it from the Administrator's own browser session would silently replace their session with the new employee's — this required a throwaway Supabase client (`persistSession: false`) purely to avoid it.
- **Redundant email.** With email confirmation enabled, `signUp()` sends its own confirmation email, and the flow also needed a separate `resetPasswordForEmail()` call to get the employee set up — two emails per creation, which directly caused a Supabase Auth rate-limit failure during testing.

`auth.admin.inviteUserByEmail()` is Supabase's documented, purpose-built mechanism for "an administrator creates an account on someone else's behalf": it returns an unambiguous duplicate-email error, never touches the caller's session, and sends exactly one email using Supabase's actual Invite template.

## Responsibility boundary

`invite-user` is **authentication infrastructure only**. It does exactly three things:

1. Verifies the caller is an active Administrator.
2. Calls `auth.admin.inviteUserByEmail()`.
3. Returns the result as `{ success: true, userId, email }` or `{ success: false, code, message }`.

It never creates `staff_profiles`, `staff_permissions`, or `staff_stores` rows, and never contains any business rule (role assignment, Locale assignment, permission checks beyond "is this caller an active Administrator"). If a future change needs this function to know anything about "staff" as a business concept, that need belongs in the client flow instead — not here.

Response codes are a closed set (`INVALID_REQUEST`, `NOT_ADMINISTRATOR`, `INVALID_REDIRECT_URL`, `EMAIL_ALREADY_EXISTS`, `INVITATION_FAILED`, `UNKNOWN_ERROR`); the client switches on `code`, never parses `message` (message is English, for logs only — the client maps each code to its own Spanish-language text).

## Why business data stays protected by RLS, not the function

The function returns only a `userId`. Everything that actually matters from a business-data perspective — the employee's name, role, Staff Permissions, and Locale assignments — is written by the *existing client-side code* immediately afterward, through the same RLS policies and database triggers that protect every other write in this app (`022_staff_management.sql`: `is_administrator()`-gated inserts on `staff_profiles`, the `enforce_role_change_requires_admin` and `enforce_last_administrator` triggers, `is_administrator()`-only writes on `staff_permissions`).

This split is deliberate. The function needs the Supabase service role key, which bypasses RLS entirely — so the *less* it does, the smaller the surface that operates outside the database's own access-control layer. Keeping it to a single, narrow, auditable operation (invite an Auth user) means every actual business rule about who can do what stays defined in exactly one place: the database.

## Deploying

```
supabase functions deploy invite-user
```

No secrets need configuring — `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to every Edge Function in a Supabase project.

## Maintaining it

- **Before adding anything to this function, ask: does this belong to "who is allowed to create an Auth user," or does it belong to "what happens to a staff record"?** Only the first belongs here. If you're tempted to insert into `staff_profiles`/`staff_permissions`/`staff_stores` from inside this function, that's a sign the change belongs in `src/features/staff/api/staff.ts` instead.
- **New failure cases get a new named code**, not a reused generic one and not a raw Supabase error forwarded to the client. Add it to the `FailureCode` union in `index.ts` and the matching `InviteUserFailureCode` union + Spanish message map in `src/features/staff/api/staff.ts` — both sides need to stay in sync by hand, since the Edge Function and the main app are separate deployable units with no shared type import between them.
- **The authorization check (`role = 'administrator' AND is_active = true`) is the only thing standing between the service role key and an unauthenticated request**, since service-role access bypasses `staff_profiles`' RLS entirely. Any change to this function must preserve that check running first, before any Admin API call.
