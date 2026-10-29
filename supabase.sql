-- Tabela da sincronização do Rumo ao Revalida.
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run.
create table if not exists public.progresso (
  user_id uuid primary key references auth.users (id) on delete cascade,
  dados jsonb not null,
  atualizado_em timestamptz not null default now()
);

alter table public.progresso enable row level security;

-- Cada pessoa só lê e grava o próprio progresso.
create policy "ler o próprio progresso" on public.progresso
  for select using (auth.uid() = user_id);
create policy "criar o próprio progresso" on public.progresso
  for insert with check (auth.uid() = user_id);
create policy "atualizar o próprio progresso" on public.progresso
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
