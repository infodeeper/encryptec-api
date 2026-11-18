-- ENCRYPTEC billing and wallet persistence foundation.
-- All billing data is server-owned. Browser roles receive no table access.

create extension if not exists pgcrypto;

create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  external_customer_ref text unique,
  email text,
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_wallets (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'turnkey' check (provider = 'turnkey'),
  organization_id text not null,
  provider_wallet_id text not null unique,
  wallet_name text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.derivation_counters (
  family text primary key check (family in ('evm', 'tron')),
  next_index bigint not null default 0 check (next_index >= 0 and next_index <= 2147483647),
  updated_at timestamptz not null default now()
);

insert into public.derivation_counters (family, next_index)
values ('evm', 0), ('tron', 0)
on conflict (family) do nothing;

create table if not exists public.wallet_accounts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.billing_customers(id),
  company_wallet_id uuid not null references public.company_wallets(id),
  family text not null check (family in ('evm', 'tron')),
  derivation_index bigint not null check (derivation_index >= 0 and derivation_index <= 2147483647),
  derivation_path text not null,
  address text not null,
  provider_account_id text,
  provider_activity_id text,
  status text not null default 'pending' check (status in ('pending', 'active', 'failed', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, family),
  unique (family, derivation_index)
);

create unique index if not exists wallet_accounts_address_lower_uidx
  on public.wallet_accounts (family, lower(address));

create table if not exists public.supported_assets (
  id uuid primary key default gen_random_uuid(),
  network_key text not null,
  network_name text not null,
  address_family text not null check (address_family in ('evm', 'tron')),
  chain_id bigint,
  token_symbol text not null check (token_symbol in ('USDT', 'USDC')),
  token_contract_address text,
  token_decimals smallint not null default 6 check (token_decimals between 0 and 36),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (network_key, token_symbol),
  check (token_contract_address is null or length(trim(token_contract_address)) > 0),
  check (enabled = false or token_contract_address is not null)
);

insert into public.supported_assets
  (network_key, network_name, address_family, chain_id, token_symbol, token_decimals, enabled)
values
  ('tron', 'TRON', 'tron', null, 'USDT', 6, false),
  ('bsc', 'BNB Smart Chain', 'evm', 56, 'USDT', 6, false),
  ('arbitrum', 'Arbitrum One', 'evm', 42161, 'USDT', 6, false),
  ('arbitrum', 'Arbitrum One', 'evm', 42161, 'USDC', 6, false),
  ('polygon', 'Polygon PoS', 'evm', 137, 'USDT', 6, false),
  ('polygon', 'Polygon PoS', 'evm', 137, 'USDC', 6, false),
  ('base', 'Base', 'evm', 8453, 'USDC', 6, false),
  ('ethereum', 'Ethereum Mainnet', 'evm', 1, 'USDT', 6, false),
  ('ethereum', 'Ethereum Mainnet', 'evm', 1, 'USDC', 6, false)
on conflict (network_key, token_symbol) do nothing;

create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.billing_customers(id),
  wallet_account_id uuid not null references public.wallet_accounts(id),
  invoice_reference text not null unique,
  idempotency_key text not null,
  plan_id text not null check (plan_id in ('professional', 'business')),
  billing_period_start date not null,
  billing_period_end date not null,
  amount_units numeric(78, 0) not null check (amount_units > 0),
  token_decimals smallint not null check (token_decimals between 0 and 36),
  token_symbol text not null check (token_symbol in ('USDT', 'USDC')),
  network_key text not null,
  token_contract_address text not null,
  destination_address text not null,
  status text not null default 'pending'
    check (status in ('pending', 'partially_paid', 'paid', 'overpaid', 'expired', 'cancelled')),
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, idempotency_key),
  check (billing_period_end > billing_period_start)
);

create index if not exists billing_invoices_customer_created_idx
  on public.billing_invoices (customer_id, created_at desc);
create index if not exists billing_invoices_status_expiry_idx
  on public.billing_invoices (status, expires_at);

create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.billing_invoices(id),
  network_key text not null,
  tx_hash text not null,
  transfer_index text not null default '0',
  sender_address text,
  destination_address text not null,
  token_contract_address text not null,
  amount_units numeric(78, 0) not null check (amount_units > 0),
  block_number numeric(78, 0) not null,
  block_hash text,
  confirmations integer not null default 0 check (confirmations >= 0),
  status text not null default 'observed'
    check (status in ('observed', 'confirmed', 'reorged', 'rejected')),
  raw_data jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (network_key, lower(tx_hash), transfer_index)
);

create index if not exists billing_payments_invoice_idx
  on public.billing_payments (invoice_id, created_at);

create table if not exists public.customer_subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.billing_customers(id),
  plan_id text not null default 'free' check (plan_id in ('free', 'professional', 'business')),
  status text not null default 'active' check (status in ('active', 'past_due', 'cancelled', 'suspended')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  latest_invoice_id uuid references public.billing_invoices(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.billing_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('system', 'operator', 'customer', 'chain_monitor')),
  actor_ref text,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists billing_audit_entity_idx
  on public.billing_audit_events (entity_type, entity_id, created_at desc);

-- Atomic allocator: concurrent serverless invocations cannot reserve the same index.
create or replace function public.reserve_derivation_index(p_family text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_index bigint;
begin
  if p_family not in ('evm', 'tron') then
    raise exception 'Unsupported derivation family' using errcode = '22023';
  end if;

  update public.derivation_counters
     set next_index = next_index + 1,
         updated_at = now()
   where family = p_family
     and next_index < 2147483647
  returning next_index - 1 into v_index;

  if v_index is null then
    raise exception 'Derivation counter missing or exhausted for family %', p_family
      using errcode = '22003';
  end if;

  return v_index;
end;
$$;

revoke all on function public.reserve_derivation_index(text) from public, anon, authenticated;
grant execute on function public.reserve_derivation_index(text) to service_role;

-- Billing data is private by default. Only the trusted backend service role can access it.
alter table public.billing_customers enable row level security;
alter table public.company_wallets enable row level security;
alter table public.derivation_counters enable row level security;
alter table public.wallet_accounts enable row level security;
alter table public.supported_assets enable row level security;
alter table public.billing_invoices enable row level security;
alter table public.billing_payments enable row level security;
alter table public.customer_subscriptions enable row level security;
alter table public.billing_audit_events enable row level security;

revoke all on public.billing_customers, public.company_wallets, public.derivation_counters,
  public.wallet_accounts, public.supported_assets, public.billing_invoices,
  public.billing_payments, public.customer_subscriptions, public.billing_audit_events
from anon, authenticated;

grant select, insert, update, delete on public.billing_customers, public.company_wallets,
  public.derivation_counters, public.wallet_accounts, public.supported_assets,
  public.billing_invoices, public.billing_payments, public.customer_subscriptions
to service_role;

grant select, insert on public.billing_audit_events to service_role;
