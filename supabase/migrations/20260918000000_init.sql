-- mymainpage schema
--
-- There are no accounts. Each visitor gets a page at /p/<slug> plus a secret
-- edit_token. Only the Next.js server (service role) touches these tables, and
-- it checks the token before any write, so RLS denies everything to anon/auth
-- clients as a second line of defence.

create extension if not exists pgcrypto;

create table if not exists public.pages (
  slug          text primary key,
  edit_token    uuid not null default gen_random_uuid(),
  display_name  text not null default '',
  prefs         jsonb not null default '{}'::jsonb,
  widgets       jsonb not null default '[]'::jsonb,
  is_listed     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.market_items (
  id            uuid primary key default gen_random_uuid(),
  author_slug   text not null references public.pages (slug) on delete cascade,
  author_name   text not null default 'anonymous',
  title         text not null,
  description   text not null default '',
  icon          text not null default '✨',
  tags          text[] not null default '{}',
  spec          jsonb not null,
  installs      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint market_items_title_len check (char_length(title) between 1 and 80),
  constraint market_items_desc_len check (char_length(description) <= 400)
);

create index if not exists market_items_installs_idx on public.market_items (installs desc);
create index if not exists market_items_created_idx on public.market_items (created_at desc);
create index if not exists market_items_author_idx on public.market_items (author_slug);
create index if not exists market_items_search_idx
  on public.market_items using gin (to_tsvector('english', title || ' ' || description));

-- A page may not publish the same widget twice; re-publishing updates the row.
-- Plain columns (not lower(title)) so the publish upsert can target it with ON CONFLICT.
create unique index if not exists market_items_author_title_idx
  on public.market_items (author_slug, title);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pages_touch on public.pages;
create trigger pages_touch before update on public.pages
  for each row execute function public.touch_updated_at();

drop trigger if exists market_items_touch on public.market_items;
create trigger market_items_touch before update on public.market_items
  for each row execute function public.touch_updated_at();

create or replace function public.increment_installs(item uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  update public.market_items set installs = installs + 1 where id = item returning installs;
$$;

alter table public.pages enable row level security;
alter table public.market_items enable row level security;

-- No policies on purpose: anon and authenticated roles get nothing, the
-- service-role key used by the server bypasses RLS.
revoke all on public.pages from anon, authenticated;
revoke all on public.market_items from anon, authenticated;
revoke all on function public.increment_installs(uuid) from anon, authenticated;
