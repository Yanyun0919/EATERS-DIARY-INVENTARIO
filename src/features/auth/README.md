# auth

Sign-in UI for the app. Session state, guards, and the Supabase client itself live in
`src/core/auth` and `src/core/supabase` (cross-cutting infra), not here — this feature only owns
the login page and anything else user-facing about authenticating (e.g. a future
"forgot password" flow).
