# Data Model

Persistence runs on **Supabase (Postgres)** with an **httpOnly cookie fallback**, so
the app works even before `SUPABASE_SERVICE_ROLE_KEY` is configured. The cookie is a
cache/fallback; Supabase is the source of truth once the service-role key is set.

All tables have **RLS enabled** and are accessed only server-side via the service role.
Rows are keyed by an opaque `profile_key` (the `agency_pid` cookie today; map to an auth
uid when real auth is wired).

## Tables (Supabase project `govcontract-app` / `pdvwwowtlmdajweolbfj`)

### `agency_profiles`
One row per agency. Stores the onboarding profile.
- Structured columns (`services`, `industries`, `certifications`, `keywords`,
  `location`, `service_radius_miles`, `min_contract`, `max_contract`, …) for future
  SQL filtering/analytics.
- `data jsonb` — the **full normalized profile** (source of truth on read).
- The structured columns are a denormalized projection of `data`, written for
  queryability. This is intentional, not accidental duplication: reads use `data`,
  so the two never diverge (both are written from the same normalized object).

### `alerts`
Saved opportunity-search criteria. `criteria jsonb` holds services, keywords,
location, radius, remote, value range, buyer, industries, opportunity types,
certifications, and deadline window. `enabled`, `last_run_at`, `last_match_count`.

### `rfp_feedback`
Post-RFP questionnaire answers (`answers jsonb`). Distilled into ranking signals
(prioritized services, size bias) that nudge future assessments.

### `saved_opportunities`
Pipeline/saved items, keyed `(profile_key, notice_id)`. Foundation for the pipeline
board (UI wiring pending).

## Opportunity sources (multi-source ingestion)
Opportunities are deduped per `(source, source_id)` and ingested by backend jobs only:
- **`sam.gov`** — live federal opportunities (open to bid). `status='active'`. Ingested by `lib/ingest.ts`.
- **`dgs-ncb`** — California DGS Approved Non-Competitive Bids (awarded sole-source contracts; market intelligence). `status='awarded'`, so they are **excluded from the active search/recommendations feed** (which filters `status='active'`). Ingested by `lib/sources/dgs.ts` via the CKAN DataStore API (data.ca.gov), resource id resolved at runtime. Standalone analysis utility: `scripts/dgs_ncb.py`.

Both run via the daily `/api/cron/ingest` job (`?source=sam|dgs` runs one; `?force=1` bypasses the SAM throttle). Each run is logged to `sync_runs` (with its `source`).

## Derived, NOT stored
- **Opportunity assessments** (Eligibility/Fit/Edge) and **proposal checklists** are
  computed deterministically on demand from the profile + opportunity. They are not
  persisted, so they never go stale when the profile changes.

## Deprecated
- **Firebase Data Connect** (`src/lib/dataconnect/`) is no longer used for the agency
  profile (migrated to Supabase). It remains only as a legacy fallback for the
  opportunities list/search and the demo token ledger, and is not relied upon.
  No app code writes the profile to Data Connect (single write path = Supabase + cookie).

## Dedup status
- Profile has a **single write path** (`/api/profile` → `saveProfileToSupabase` + cookie).
- No competing Firebase Data Connect profile write remains.
