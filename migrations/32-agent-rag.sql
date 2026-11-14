-- AI Sales Agent: retrieval (RAG) over the owner's own knowledge. Idempotent: safe to run more than once.
-- Run after migration 31. Needs the pgvector extension (available on Supabase: Database > Extensions > vector).
-- Same design as AiSend's knowledge base: OpenAI text-embedding-3-small, 1536 dimensions, cosine similarity. A chunk with no
-- vector is still searchable by keyword, so a missing OPENAI_API_KEY or a failed embeddings call never loses knowledge.
-- Tenant safety: every row has user_id and every query filters on it. Row-level security is NOT relied on.

create extension if not exists vector;

-- One row per thing the owner added: a Reel's offer, a Reel's caption, a Reel's FAQs (one source for all FAQs of that Reel),
-- a pasted document, or an imported web page. media_id null = business-wide (used for every Reel).
create table if not exists agent_kb_sources (
  id             uuid primary key default gen_random_uuid(),
  user_id        bigint not null,
  media_id       text,
  kind           text not null check (kind in ('reel_offer', 'reel_caption', 'reel_faq', 'document', 'website')),
  title          text not null default '',
  source_url     text,                                   -- website imports only
  raw_text       text,                                   -- documents only: lets "Re-index" rebuild the chunks (max 60k chars, enforced in code)
  status         text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  chunk_count    int not null default 0,
  embedded_count int not null default 0,
  error          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, user_id)                                   -- lets chunks reference (source, owner) so a chunk can never point at another account's source
);
create index if not exists agent_kb_sources_user_idx on agent_kb_sources (user_id, media_id);
-- A Reel has at most one source of each reel_* kind (re-saving the Reel replaces it).
create unique index if not exists agent_kb_sources_reel_uniq on agent_kb_sources (user_id, media_id, kind) where kind like 'reel\_%';

create table if not exists agent_kb_chunks (
  id             uuid primary key default gen_random_uuid(),
  user_id        bigint not null,
  media_id       text,                                   -- null = business-wide
  source_id      uuid not null,
  source_kind    text not null check (source_kind in ('reel_offer', 'reel_caption', 'reel_faq', 'document', 'website')),
  title          text not null default '',
  content        text not null,
  chunk_index    int not null default 0,
  token_estimate int not null default 0,
  embedding      vector(1536),                           -- null when no key / the embeddings call failed
  -- 'simple' config: no language-specific stemming, so Hindi, Hinglish and English words are all indexed as typed.
  tsv            tsvector generated always as (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, ''))) stored,
  created_at     timestamptz not null default now(),
  foreign key (source_id, user_id) references agent_kb_sources (id, user_id) on delete cascade
);
create index if not exists agent_kb_chunks_scope_idx on agent_kb_chunks (user_id, media_id);
create index if not exists agent_kb_chunks_source_idx on agent_kb_chunks (source_id);
-- One chunk per position in a source: lets re-indexing upsert, so two overlapping re-indexes cannot duplicate chunks.
-- (Duplicates from an earlier run are removed first so this also works on a database where the first version of this file ran.)
delete from agent_kb_chunks a using agent_kb_chunks b where a.source_id = b.source_id and a.chunk_index = b.chunk_index and a.ctid < b.ctid;
create unique index if not exists agent_kb_chunks_source_pos_uniq on agent_kb_chunks (source_id, chunk_index);
create index if not exists agent_kb_chunks_tsv_idx on agent_kb_chunks using gin (tsv);

-- Vector index: hnsw (pgvector 0.5+, what Supabase ships); falls back to ivfflat on an older pgvector.
do $$
begin
  begin
    create index if not exists agent_kb_chunks_embedding_idx on agent_kb_chunks using hnsw (embedding vector_cosine_ops);
  exception when others then
    create index if not exists agent_kb_chunks_embedding_idx on agent_kb_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
  end;
end $$;

-- Nearest chunks for one account. p_media_id picks that Reel's chunks PLUS business-wide chunks (media_id is null); a null
-- p_media_id means business-wide only. user_id is always part of the filter. similarity = 1 - cosine distance.
create or replace function match_agent_chunks(
  p_user_id bigint,
  p_media_id text,
  p_query_embedding vector(1536),
  p_match_count int,
  p_min_similarity float
)
returns table (id uuid, user_id bigint, source_id uuid, media_id text, source_kind text, title text, content text, chunk_index int, similarity float)
language sql stable
as $$
  select c.id, c.user_id, c.source_id, c.media_id, c.source_kind, c.title, c.content, c.chunk_index,
         (1 - (c.embedding <=> p_query_embedding))::float as similarity
    from agent_kb_chunks c
   where c.user_id = p_user_id
     and c.embedding is not null
     and (c.media_id is null or (p_media_id is not null and c.media_id = p_media_id))
     and (1 - (c.embedding <=> p_query_embedding)) >= p_min_similarity
   order by c.embedding <=> p_query_embedding
   limit greatest(1, least(p_match_count, 20));
$$;
