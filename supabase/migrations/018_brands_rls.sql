-- Fixes Brand creation failing with an RLS violation.
--
-- Root cause (confirmed by inspecting every migration that touches `brands`, not guessed):
-- migration 001 created `brands` with row level security ENABLED but never added a single
-- policy for it. Migration 003 grants select/insert/update at the table level, but its own
-- comment says outright: "brands: no RLS policy exists yet (out of scope for 002), so these
-- grants are inert until [policies exist]". No migration since (004 through 017) ever added
-- those policies. In Postgres, a table with RLS enabled and zero policies for a given command
-- rejects every row for that command, regardless of table-level GRANTs -- so both the Store
-- form's Brand dropdown (SELECT) and the "Nueva Marca" dialog (INSERT) have been blocked
-- outright since the table was created; the dialog just surfaced it first because reading an
-- empty result set silently looks like "no brands yet" while an INSERT throws.
--
-- Smallest possible fix: add exactly the two policies actually used today (SELECT for the
-- dropdown, INSERT for the dialog), matching the same is_active_staff()/is_active_staff_writer()
-- shape already used for `stores` (migration 011). No UPDATE policy -- nothing in the app calls
-- update on brands, so none is added (Brand's API layer intentionally has no updateBrand()).

create policy "staff can read brands" on brands for select using (is_active_staff());
create policy "administrators can insert brands" on brands for insert with check (is_active_staff_writer());
