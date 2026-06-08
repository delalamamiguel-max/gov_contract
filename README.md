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
groups — **Eligibility (40%)**, **Fit (35%)**, **Edge (25%)**. Hard-requirement
gaps (missing a required set-aside certification, out-of-radius on-site work) cap
the score so a real blocker can never read as a high match. Scores map to labels:

| Score | Label |
|-------|-------|
| 80–100 | Strong Match |
| 60–79 | Good Match |
| 40–59 | Possible Match |
| 0–39 | Weak Match |

### Recommendations (`src/lib/recommendations.ts`)

The "Recommended for you" feed scores the **full** California opportunity set and
splits results into:

- **Recommended** — Good Match and above (≥60), further split into "new since
  your last visit" vs. the rest for returning users.
- **Other opportunities** — Possible Matches (40–59), shown in a visually
  subordinate block so users can see how many more opportunities exist without
  diluting the top picks.

### Contextual search (`src/lib/opportunities.ts`)

Search is contextual, not literal. A query is expanded into related concepts
before hitting Postgres full-text search — e.g. `PR` → `public relations`,
`communications`, `media relations`, `outreach`; `marketing` → `advertising`,
`outreach`, `branding`, `campaign`. If full-text search returns nothing for a
specific (≥4 char) term, it falls back to a broad substring match so users still
get the closest hits. The UI notes when a search was expanded or broadened.

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
