# Spidpay

Free, open-source auto payment verification system — a self-hosted alternative to SSLCommerz for bKash, Nagad, and Rocket.

## How it works

1. A merchant registers and gets an `api_key`.
2. Their checkout page calls `create-payment-request` to start an order and get a pay-to number.
3. The customer sends money manually via bKash/Nagad/Rocket and submits the TrxID via `submit-trxid`.
4. An Android app on the merchant's phone listens for the official SMS and forwards it to `sms-ingest`.
5. Whichever of steps 3/4 happens second completes the match (amount + provider + TrxID), marks the order `verified`, and fires a signed webhook to the merchant's site.

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
```

## Security

- SMS is only trusted from an allowlisted official sender ID per provider
- Every SMS forwarded from the Android app is HMAC-signed and verified server-side
- Matching requires TrxID + amount + provider to agree (not amount alone)
- TrxID is unique per merchant — a used TrxID can't be replayed
- Orders expire after 20 minutes
- Outgoing webhooks to the merchant are HMAC-signed so the merchant's site can verify they came from Spidpay

## Status

Early development. Backend (schema + Edge Functions) and the checkout page are live. Android SMS listener app is next.
