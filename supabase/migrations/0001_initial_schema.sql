-- ============================================================
-- Auto Payment Verification System — Supabase schema
-- ============================================================

-- Merchants: platform owners who sign up to use the system
create table merchants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  api_key text unique not null default encode(gen_random_bytes(24), 'hex'),
  webhook_url text,
  webhook_secret text not null default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now()
);

-- Merchant's registered mobile banking numbers (bKash/Nagad/Rocket)
create table merchant_numbers (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  provider text not null check (provider in ('bkash', 'nagad', 'rocket')),
  phone_number text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (merchant_id, provider, phone_number)
);

-- Payment requests: created when a customer starts checkout
create table payment_requests (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  order_reference text not null,          -- merchant's own order id
  amount numeric(12,2) not null,
  provider text not null check (provider in ('bkash', 'nagad', 'rocket')),
  merchant_number_id uuid not null references merchant_numbers(id),
  status text not null default 'pending'
    check (status in ('pending', 'awaiting_trxid', 'verified', 'mismatch', 'expired', 'manual_review')),
  claimed_trxid text,                     -- what the customer typed in
  claimed_sender_last4 text,
  expires_at timestamptz not null default (now() + interval '20 minutes'),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index on payment_requests (merchant_id, status);
create index on payment_requests (order_reference);

-- Raw SMS events forwarded from the Android app on the merchant's phone
create table sms_events (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  provider text not null check (provider in ('bkash', 'nagad', 'rocket')),
  sender_id text not null,                -- must match official short sender id
  raw_text text not null,
  parsed_trxid text,
  parsed_amount numeric(12,2),
  parsed_sender_last4 text,
  received_at timestamptz not null default now(),
  matched_payment_request_id uuid references payment_requests(id),
  is_official_sender boolean not null default false,
  hmac_signature text not null            -- signed by the Android app's secret
);

create index on sms_events (merchant_id, parsed_trxid);
create unique index on sms_events (merchant_id, parsed_trxid) where parsed_trxid is not null;

-- Verification log: every match attempt, success or fail, for audit/debugging
create table verification_log (
  id uuid primary key default gen_random_uuid(),
  payment_request_id uuid not null references payment_requests(id) on delete cascade,
  sms_event_id uuid references sms_events(id),
  outcome text not null check (outcome in ('sender_rejected', 'amount_mismatch', 'trxid_duplicate', 'verified', 'expired')),
  detail text,
  created_at timestamptz not null default now()
);

-- Webhook delivery log: what we told the merchant's site, and whether it succeeded
create table webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  payment_request_id uuid not null references payment_requests(id) on delete cascade,
  payload jsonb not null,
  http_status int,
  attempt int not null default 1,
  delivered_at timestamptz
);

-- ============================================================
-- Row Level Security — merchants only see their own data
-- ============================================================
alter table merchants enable row level security;
alter table merchant_numbers enable row level security;
alter table payment_requests enable row level security;
alter table sms_events enable row level security;
alter table verification_log enable row level security;
alter table webhook_deliveries enable row level security;

-- Policies are enforced at the Edge Function layer using the service role,
-- since customers and the Android app authenticate via api_key / hmac,
-- not Supabase auth. Add auth.uid()-based policies here if you later
-- add a merchant dashboard with Supabase Auth login.
