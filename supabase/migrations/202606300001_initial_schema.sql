create table if not exists public.subscriptions (
  id text primary key default ('sub_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  plan text not null default '',
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('weekly', 'monthly', 'quarterly', 'annual')),
  next_charge_date date not null,
  status text not null default 'active' check (status in ('active', 'trial', 'paused', 'cancelled')),
  category text not null default 'other' check (category in ('ai', 'devtools', 'design', 'productivity', 'cloud', 'media', 'finance', 'other')),
  owner text not null default 'me' check (owner in ('me', 'agent', 'team')),
  payment_method text not null default '',
  website text not null default '',
  notes text not null default '',
  usefulness integer not null default 3 check (usefulness between 1 and 5),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_next_charge_idx
  on public.subscriptions (user_id, next_charge_date);

alter table public.subscriptions enable row level security;

drop policy if exists "Users can read their subscriptions" on public.subscriptions;
create policy "Users can read their subscriptions"
  on public.subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their subscriptions" on public.subscriptions;
create policy "Users can insert their subscriptions"
  on public.subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their subscriptions" on public.subscriptions;
create policy "Users can update their subscriptions"
  on public.subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their subscriptions" on public.subscriptions;
create policy "Users can delete their subscriptions"
  on public.subscriptions for delete
  using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();
