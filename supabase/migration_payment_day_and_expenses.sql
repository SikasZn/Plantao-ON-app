-- 1) Dia do pagamento do local de trabalho (1 a 31, opcional)
alter table public.hospitals
  add column if not exists payment_day smallint
  check (payment_day is null or (payment_day between 1 and 31));

-- 2) Gastos mensais do usuário
--    recurrence = 'monthly' → entra em todo mês de start_month até end_month
--                             (end_month nulo = sem fim)
--    recurrence = 'once'    → vale só no mês de start_month
--    start_month / end_month guardam sempre o dia 1 do mês (YYYY-MM-01)
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  amount      numeric(12,2) not null check (amount > 0),
  recurrence  text not null check (recurrence in ('monthly', 'once')),
  start_month date not null,
  end_month   date,
  created_at  timestamptz not null default now()
);

create index if not exists expenses_user_idx on public.expenses (user_id);

alter table public.expenses enable row level security;

drop policy if exists "expenses_select_own" on public.expenses;
create policy "expenses_select_own" on public.expenses
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "expenses_insert_own" on public.expenses;
create policy "expenses_insert_own" on public.expenses
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "expenses_update_own" on public.expenses;
create policy "expenses_update_own" on public.expenses
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "expenses_delete_own" on public.expenses;
create policy "expenses_delete_own" on public.expenses
  for delete to authenticated using (user_id = auth.uid());
