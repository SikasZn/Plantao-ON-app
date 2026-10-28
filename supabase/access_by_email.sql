-- Acesso liberado POR E-MAIL, valendo mesmo antes da pessoa criar a conta.
-- Rode uma vez no SQL Editor do Supabase (depois de access_overrides.sql).
--
-- Quem tem o e-mail nesta lista (ou já está em access_overrides) entra direto
-- no app, sem paywall, assim que criar a conta / fizer login com esse e-mail.

create table if not exists public.access_emails (
  email      text primary key,
  note       text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.access_emails enable row level security;
revoke all on public.access_emails from anon, authenticated;
-- sem policies: o app não lê nem escreve direto; só pela função abaixo.

create or replace function public.has_free_access()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    exists (
      select 1 from public.access_overrides o
      where o.user_id = auth.uid()
        and (o.expires_at is null or o.expires_at > now())
    )
    or exists (
      select 1 from public.access_emails e
      where lower(e.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and (e.expires_at is null or e.expires_at > now())
    );
$$;

revoke all on function public.has_free_access() from public, anon;
grant execute on function public.has_free_access() to authenticated;

-- Passa para a lista por e-mail quem já foi liberado antes em access_overrides
-- não é necessário: a função já olha as duas tabelas.

-- COMO USAR:
--   insert into public.access_emails (email, note) values
--     ('pessoa1@exemplo.com', 'convidado'),
--     ('pessoa2@exemplo.com', 'marketing')
--   on conflict (email) do nothing;
--
--   remover: delete from public.access_emails where lower(email) = 'pessoa1@exemplo.com';
