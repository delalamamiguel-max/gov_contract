-- Opportunity Intelligence pipeline — schema applied to Supabase (project
-- pdvwwowtlmdajweolbfj) June 2026. Recorded here for reproducibility since the
-- repo has no supabase/migrations workflow; these were applied via the Supabase
-- MCP. Re-applying is idempotent.

-- Phase 0 — marketing relevance gate (shadow): columns on opportunities.
alter table public.opportunities
  add column if not exists is_marketing boolean,
  add column if not exists marketing_category text,
  add column if not exists relevance_confidence text,
  add column if not exists relevance_model text,
  add column if not exists relevance_checked_at timestamptz;

create index if not exists opportunities_relevance_unchecked_idx
  on public.opportunities (source)
  where relevance_checked_at is null;

-- Phase 1 — extracted attachment text (one row per file), pgvector enabled.
create extension if not exists vector;

create table if not exists public.opportunity_documents (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'caleprocure',
  source_id text not null,
  file_name text not null,
  file_index int,
  description text,
  mime text,
  byte_size bigint,
  content_hash text,
  char_count int,
  text text,
  extraction_method text,
  status text not null default 'extracted',
  error text,
  extracted_at timestamptz default now(),
  created_at timestamptz default now(),
  unique (source, source_id, file_name)
);
create index if not exists opportunity_documents_source_id_idx
  on public.opportunity_documents (source, source_id);

-- Phase 2 — structured intelligence per opportunity.
create table if not exists public.opportunity_intel (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'caleprocure',
  source_id text not null,
  scope_summary text,
  entities jsonb,
  content_hash text,
  model text,
  doc_count int,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (source, source_id)
);
create index if not exists opportunity_intel_source_id_idx
  on public.opportunity_intel (source, source_id);

-- Phase 3 — semantic matching (all-MiniLM-L6-v2, 384-dim).
alter table public.opportunity_intel
  add column if not exists embedding vector(384);

create table if not exists public.profile_embeddings (
  profile_hash text primary key,
  embedding vector(384) not null,
  updated_at timestamptz default now()
);
