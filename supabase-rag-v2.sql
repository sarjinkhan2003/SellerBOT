-- Drop old tables and recreate with 1024 dims
-- Run this in Supabase SQL Editor, then re-sync products and zones in SellerBot.

drop table if exists product_embeddings cascade;
drop table if exists zone_embeddings cascade;
drop function if exists match_products;
drop function if exists match_zones;

create extension if not exists vector;

create table product_embeddings (
  id uuid primary key default gen_random_uuid(),
  seller_uid text not null,
  product_id text not null,
  product_name text not null,
  bangla_name text,
  price numeric,
  cost_price numeric,
  tags text[],
  embedding vector(1024),
  created_at timestamp default now(),
  constraint product_embeddings_seller_product_unique
    unique (seller_uid, product_id)
);

create table zone_embeddings (
  id uuid primary key default gen_random_uuid(),
  seller_uid text not null,
  zone_id text not null,
  area text not null,
  bangla_area text,
  charge numeric,
  keywords text[],
  embedding vector(1024),
  created_at timestamp default now(),
  constraint zone_embeddings_seller_zone_unique
    unique (seller_uid, zone_id)
);

create or replace function match_products(
  query_embedding vector(1024),
  seller_uid_filter text,
  match_threshold float default 0.5,
  match_count int default 5
)
returns table (
  product_id text,
  product_name text,
  bangla_name text,
  price numeric,
  cost_price numeric,
  tags text[],
  similarity float
)
language sql stable
as $$
  select
    product_id,
    product_name,
    bangla_name,
    price,
    cost_price,
    tags,
    1 - (embedding <=> query_embedding) as similarity
  from product_embeddings
  where seller_uid = seller_uid_filter
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

create or replace function match_zones(
  query_embedding vector(1024),
  seller_uid_filter text,
  match_threshold float default 0.4,
  match_count int default 3
)
returns table (
  zone_id text,
  area text,
  bangla_area text,
  charge numeric,
  keywords text[],
  similarity float
)
language sql stable
as $$
  select
    zone_id,
    area,
    bangla_area,
    charge,
    keywords,
    1 - (embedding <=> query_embedding) as similarity
  from zone_embeddings
  where seller_uid = seller_uid_filter
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

create index product_embeddings_embedding_idx
  on product_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index zone_embeddings_embedding_idx
  on zone_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

alter table product_embeddings enable row level security;
alter table zone_embeddings enable row level security;

create policy "Sellers own product embeddings"
  on product_embeddings for all
  using (seller_uid = auth.uid()::text);

create policy "Sellers own zone embeddings"
  on zone_embeddings for all
  using (seller_uid = auth.uid()::text);
