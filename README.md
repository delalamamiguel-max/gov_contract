# BidFlare

BidFlare helps small marketing & communications agencies find and win California
public-sector contracts. It ingests opportunities from public sources (Cal
eProcure, DGS, Caltrans, SAM.gov), scores each one against the agency's profile
with a transparent deterministic engine, and surfaces the best-fit matches with
plain-English explanations.

- **App:** https://app.bidflare.io
- **Landing page:** https://bidflare.io (separate repo:
  [`bid-signal`](https://github.com/nava-aaron/bid-signal))

## Stack

- **Next.js 16** (App Router) — note: `middleware.ts` is renamed to `proxy.ts`
  with a named `proxy` export in this version.
- **Supabase** — Postgres (opportunities + profiles) and Auth (`@supabase/ssr`,
  PKCE). Browser auth is proxied through a same-origin `/sb` rewrite to dodge
  DNS adblockers on `*.supabase.co`.
- **next-intl** — `en` / `es` localization.
- **Stripe** — subscription billing.
- **Vercel** — hosting, cron-driven ingestion.

## Getting Started

```bash
npm install
npm run dev      # http://localhost:3000
```

Create `.env.local` with at least:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## How matching works

### Opportunity Assessment (`src/lib/assessment.ts`)

Every opportunity is scored 0–100 by a deterministic engine across three weighted
groups:

- **Eligibility (40%)** — can the agency legally compete and deliver? Service
  capability, set-aside certification match (hard gate), location serviceability
  (hard gate), insurance, and submission readiness.
- **Fit (35%)** — does the specific contract fit the agency's sweet spot?
  Contract value range, service depth, industry experience, marketing scope,
  delivery capacity, and remote/local alignment.
- **Edge (25%)** — does the agency have a competitive advantage? Certifications
  held, prior government experience, differentiators, priority-keyword hits, and
  proposal-readiness depth.

```
matchScore = round(eligibility × 0.40 + fit × 0.35 + edge × 0.25)
```

**Hard gates** cap the score at **39** (so a real blocker can never read as a
high match): a missing required set-aside certification, or on-site work beyond
the service area. An explicitly excluded keyword caps the score at 20. Scores map
to labels:

| Score | Label |
|-------|-------|
| 80–100 | Strong Match |
| 60–79 | Good Match |
| 40–59 | Possible Match |
| 0–39 | Weak Match |

Opportunities scoring **below 50%** get a red left-border in the UI so weak
matches are scannable at a glance.

### Location matching (`src/lib/geo.ts`)

Distance is estimated state-to-state via state centroids + haversine (no
geocoding dependency). Location gating respects the agency's work preference:

- **remote** preference or genuinely remote-deliverable work → distance is
  irrelevant.
- **hybrid** → serviceable within **2× the stated radius** (willing to travel
  some, not cross-country). This fixed a bug where a hybrid agency saw far
  out-of-state on-site contracts as high matches.
- **local** → strict radius.

Work is treated as remote-eligible only when the place of performance is
nationwide/unspecified *or* the scope contains specific digital-delivery terms
(website, web/app development, SEO, social media, email marketing, graphic
design, video production, copywriting). A **blank** place of performance is
treated as *unknown* (the distance check applies), not remote.

### AI nuance layer — Kimi (`src/lib/aiScoring.ts`)

The deterministic engine scores on keyword overlap and field values; it can't
read intent, industry context, implicit on-site requirements, or staffing scale
from prose. The top candidates by deterministic score are reviewed by **Kimi**
(`kimi-k2-thinking` via Ollama Cloud, OpenAI-compatible) for a **bounded
adjustment of −15 to +15** — never a re-score. Kimi returns `0` when the score is
already appropriate, so it only intervenes when it has genuine signal.

- **Hard gates are immutable** — Kimi can never lift a capped (≤39) score.
- **Cached** in the `opportunity_ai_scores` table keyed by `(source_id,
  profile_hash)` with a 7-day TTL; the profile hash invalidates the cache when
  scoring-relevant profile fields change. Repeat loads are cache hits (no model
  call).
- **Selective** — only opportunities scoring ≥30 with a real description are
  reviewed; recommendations review the top 20, search the top 10. Safe no-op when
  AI is unconfigured or unreachable.

AI-adjusted cards show a wand icon and an "AI review note" explaining what nuance
changed the score. Configure via `OLLAMA_API_KEY` (or `KIMI_API_KEY`),
`KIMI_BASE_URL`, `KIMI_MODEL`, `KIMI_MAX_TOKENS`.

### Recommendations (`src/lib/recommendations.ts`)

The "Recommended for you" feed scores the **full** California opportunity set and
splits results into:

- **Recommended** — Good Match and above (≥60), further split into "new since
  your last visit" vs. the rest for returning users.
- **Other opportunities** — Possible Matches (40–59), shown in a visually
  subordinate block so users can see how many more opportunities exist without
  diluting the top picks.

Each block is sorted highest-to-lowest and uses a **"Show more"** button so the
feed stays scannable (first few shown, the rest one click away).

### Contextual search (`src/lib/opportunities.ts`)

Search is contextual, not literal. A query is expanded into related concepts
before hitting Postgres full-text search — e.g. `PR` → `public relations`,
`communications`, `media relations`, `outreach`; `marketing` → `advertising`,
`outreach`, `branding`, `campaign`. If full-text search returns nothing for a
specific (≥4 char) term, it falls back to a broad substring match so users still
get the closest hits. The UI notes when a search was expanded or broadened.

Results are split into a **Top matches** section (≥60) shown immediately and an
**Other opportunities** section (<60) behind a "Show all" button — both sorted
highest-score-first.

All user-facing reads go through the Supabase store only (never SAM.gov live), so
search stays fast and resilient even when upstream sources are down.

## Routing & auth

- `proxy.ts` handles i18n routing and refreshes the Supabase session on every
  request. The bare app URL (`/`, `/en`, `/es`) routes returning users (with a
  session cookie) straight to their dashboard, and everyone else to login.
- `src/app/[locale]/dashboard/layout.tsx` is the real auth gate — it validates
  the session server-side and bounces unauthenticated users to login, and
  not-yet-onboarded users to onboarding.
- OAuth callback lands on `/auth/callback`; email confirmation on `/auth/confirm`.

## Deploy

Deployed on Vercel. Production deploys:

```bash
vercel deploy --prod
```

DNS for `bidflare.io` / `app.bidflare.io` is managed in Cloudflare (CNAME →
`cname.vercel-dns.com`, DNS-only). Both hostnames are attached to their
respective Vercel projects with auto-provisioned SSL.
