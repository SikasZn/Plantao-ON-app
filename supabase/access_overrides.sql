-- Acesso liberado sem assinatura (contas internas, demonstração, revisores
-- da loja, clientes convidados).
--
-- Quem está nesta tabela entra no app sem passar pelo paywall. Cada usuário
-- só consegue LER a própria linha; ninguém pelo app consegue inserir, alterar
-- ou apagar — só quem acessa o banco com privilégio (SQL Editor / Table
-- Editor do painel do Supabase, ou service_role).
--
-- Rode este arquivo uma vez no SQL Editor do Supabase.

create table if not exists public.access_overrides (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  note       text,
  -- null = sem prazo; com data = o acesso liberado expira nela
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.access_overrides enable row level security;

drop policy if exists "access_overrides_select_own" on public.access_overrides;
create policy "access_overrides_select_own"
  on public.access_overrides
  for select
  to authenticated
  using (user_id = auth.uid());

-- sem policies de insert/update/delete de propósito: o app (anon/authenticated)
-- não pode escrever aqui.
revoke all on public.access_overrides from anon;
revoke insert, update, delete on public.access_overrides from authenticated;

-- ---------------------------------------------------------------------------
-- COMO USAR (rode no SQL Editor quando quiser liberar alguém)
--
-- Liberar por e-mail (a conta já precisa existir):
--   insert into public.access_overrides (user_id, note)
--   select id, 'demonstração cliente'
--   from auth.users
--   where email = 'pessoa@exemplo.com'
--   on conflict (user_id) do nothing;
--
-- Liberar com prazo (ex.: 30 dias):
--   insert into public.access_overrides (user_id, note, expires_at)
--   select id, 'revisor Google Play', now() + interval '30 days'
--   from auth.users where email = 'revisor@exemplo.com'
--   on conflict (user_id) do update set expires_at = excluded.expires_at;
--
-- Remover a liberação:
--   delete from public.access_overrides
--   where user_id = (select id from auth.users where email = 'pessoa@exemplo.com');
--
-- Ver quem está liberado:
--   select u.email, o.note, o.expires_at
--   from public.access_overrides o join auth.users u on u.id = o.user_id;
-- ---------------------------------------------------------------------------
