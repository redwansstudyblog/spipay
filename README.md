# Spidpay

Free, open-source auto payment verification system — a self-hosted alternative to SSLCommerz for bKash, Nagad, and Rocket.

## How it works

1. A merchant registers and gets an `api_key`.
2. Their checkout page calls `create-payment-request` to start an order and get a pay-to number.
3. The customer sends money manually via bKash/Nagad/Rocket and submits the TrxID via `submit-trxid`.
4. An Android app on the merchant's phone listens for the official SMS and forwards it to `sms-ingest`.
5. Whichever of steps 3/4 happens second completes the match (amount + provider + TrxID), marks the order `verified`, and fires a signed webhook to the merchant's site.

## Supported payment methods

Mobile wallet MFS only, via SMS verification: bKash, Nagad, Rocket, Upay,
Tap, CellFin, SureCash, OK Wallet, mCash, Meghna Pay.

Cards and net/internet banking are intentionally **not** supported — they
need a licensed payment gateway/aggregator relationship (PCI-DSS,
bank agreements), which is a different business than this project. The
plan is to route those through an existing licensed gateway partner
later rather than build card processing in-house.

## Structure

```
supabase/
  migrations/          -- database schema (Postgres/Supabase)
  functions/
    create-payment-request/   -- merchant creates a pending order
    submit-trxid/             -- customer submits their TrxID
    sms-ingest/                -- Android app forwards parsed SMS
    payment-status/            -- checkout page polls order status
checkout/
  index.html            -- hosted checkout page (provider select, TrxID submit, live status)
android/
  SpidPay Agent          -- Android Studio project, the SMS-listener companion app
                             (see android/README.md for build + setup steps)
dashboard/
  index.html             -- merchant self-service dashboard (signup/login,
                             manage numbers, view API keys, test payments,
                             recent transactions)
```

## Merchant dashboard

`dashboard/index.html` uses Supabase Auth (email/password) so merchants can
sign up without any manual setup — a `merchants` row is created
automatically via a database trigger on signup. Row Level Security ensures
each merchant only ever sees their own numbers, API key, and transactions.

## Security

- SMS is only trusted from an allowlisted official sender ID per provider
- Every SMS forwarded from the Android app is HMAC-signed and verified server-side
- Matching requires TrxID + amount + provider to agree (not amount alone)
- TrxID is unique per merchant — a used TrxID can't be replayed
- Orders expire after 20 minutes
- Outgoing webhooks to the merchant are HMAC-signed so the merchant's site can verify they came from Spidpay

## Status

Early development. Backend (schema + Edge Functions) and the checkout page are live. Android SMS listener app is next.
