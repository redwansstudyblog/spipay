# spipay — API contract (for frontend/Lovable use)

Backend base URL (Edge Functions):
```
https://nihvxjmshnzxzffnrdst.supabase.co/functions/v1
```

Supabase project (for Auth + direct table reads with RLS):
```
URL:      https://nihvxjmshnzxzffnrdst.supabase.co
Anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5paHZ4am1zaG56eHpmZm5yZHN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NDI0NjEsImV4cCI6MjEwNDExODQ2MX0.CJJZBxUxWOyb8JXI1MaIkLWFldLWbuzVAEqgUDS6zxs
```
The anon key is safe to use in frontend code — it only allows what Row
Level Security policies permit (each merchant sees only their own data).

---

## 1. Merchant auth (dashboard)

Use `@supabase/supabase-js` directly:

```js
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

await supabase.auth.signUp({ email, password })
await supabase.auth.signInWithPassword({ email, password })
await supabase.auth.signOut()
```

Signing up automatically creates a row in `merchants` (via a database
trigger) — no separate "create merchant" call needed.

After login, fetch the merchant's own profile:
```js
const { data: { user } } = await supabase.auth.getUser()
const { data: merchant } = await supabase
  .from('merchants')
  .select('*')
  .eq('auth_user_id', user.id)
  .single()
// merchant.api_key and merchant.webhook_secret are only visible to this merchant (RLS)
```

## 2. Merchant numbers (dashboard)

```js
// list
await supabase.from('merchant_numbers').select('*').eq('merchant_id', merchant.id)

// add
await supabase.from('merchant_numbers').insert({
  merchant_id: merchant.id, provider: 'bkash', phone_number: '01712345678'
})
```
`provider` must be one of: `bkash`, `nagad`, `rocket`, `upay`, `tap`, `cellfin`, `surecash`, `okwallet`, `mcash`, `meghnapay`.

## 3. Create a payment request (called from the MERCHANT's own backend, not the browser)

```
POST /create-payment-request
Headers: x-api-key: <merchant.api_key>
Body: { "order_reference": "ORD-1042", "amount": 500.00, "provider": "bkash" }

200 → { payment_request_id, amount, provider, pay_to_number, expires_at }
400/401 → { error }
```
⚠️ `api_key` is a secret — never call this endpoint from a customer's
browser. It's meant to be called from the merchant's own server, or from
the spipay dashboard's "test payment" button (which already has the
logged-in merchant's key).

## 4. Checkout page — read a payment request's status

```
GET /payment-status?id=<payment_request_id>

200 → {
  id, status, amount, provider, order_reference, expires_at,
  merchant_name, pay_to_number
}
```
`status` is one of: `pending`, `awaiting_trxid`, `verified`, `expired`, `mismatch`, `manual_review`.

Poll this every few seconds while status is `pending`/`awaiting_trxid` to
detect when a payment becomes `verified`.

## 5. Checkout page — customer submits their TrxID

```
POST /submit-trxid
Body: { "payment_request_id": "...", "trxid": "CGH4K7P9Q2" }

200 → { status: "verified" | "awaiting_trxid" | "expired" }
```
No `x-api-key` needed here — this is public, keyed only by the (hard to
guess) `payment_request_id`.

## 6. Webhook (delivered TO the merchant's own server, not something you call)

When a payment is verified, spipay POSTs to the merchant's `webhook_url`:
```
POST <merchant.webhook_url>
Header: x-signature: <hex HMAC-SHA256 of the JSON body, using merchant.webhook_secret>
Body: { "event": "payment.verified", "payment_request_id", "order_reference", "amount", "provider" }
```
The merchant's server should recompute the HMAC and compare, to confirm
the webhook really came from spipay.

---

## Pages Lovable needs to build

1. **Landing/marketing page** — explains spipay, links to sign-up
2. **Dashboard** (auth-gated) — sign up / login, profile (business name,
   webhook URL), manage mobile wallet numbers, reveal API key/secret,
   "create test payment" button, recent transactions list
   *(a working reference version already exists at `dashboard/index.html`
   in the repo — Lovable can restyle it, the logic can stay)*
3. **Checkout page** — public, no login. Reads `?id=` from the URL, calls
   `payment-status` then `submit-trxid`, polls for verification
   *(already in progress as the "sweet-companion" Lovable project — just
   needs its `verify()` function wired to steps 4–5 above)*
