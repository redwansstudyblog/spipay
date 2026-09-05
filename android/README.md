# SpidPay Agent (Android)

This is the SMS-listener companion app. It runs on the merchant's dedicated
Android phone, watches for official mobile-banking SMS, and forwards
matching ones to the SpidPay backend's `sms-ingest` endpoint.

## What it does

- Registers a `BroadcastReceiver` for incoming SMS (`SmsReceiver.kt`)
- Locally pre-filters by sender (bKash, Nagad, Rocket, Upay, Tap, CellFin,
  SureCash, OK Wallet, mCash, Meghna Pay) just to reduce noise — the real
  sender verification happens server-side
- Signs each forwarded SMS with HMAC-SHA256 using the merchant's
  webhook secret, matching the scheme in the `sms-ingest` Edge Function
- Never blocks or removes the SMS from the phone's normal inbox — it only
  reads a copy of it

## How to build

1. Open this folder in Android Studio (Giraffe or newer)
2. Let Gradle sync (it will download dependencies — needs internet access
   to `google()` and `mavenCentral()`)
3. Run → Image Asset wizard (optional but recommended) to generate a
   full launcher icon set for older Android versions; a basic adaptive
   icon is already included for Android 8+
4. Build → Run on a real device (SMS broadcasts don't reliably fire on
   the emulator) — or `./gradlew assembleDebug` for an APK

## Setup on the phone

1. Install the APK on the dedicated payment phone
2. Open the app, fill in:
   - **API Base URL** — your Supabase functions URL
     (`https://<project-ref>.supabase.co/functions/v1`)
   - **Merchant API Key** — from the `merchants.api_key` column
   - **Webhook Secret** — from the `merchants.webhook_secret` column
3. Tap "সেভ করুন" (Save)
4. Tap "SMS পড়ার অনুমতি দিন" (Grant SMS permission) and allow it
5. Status should show "চালু আছে, SMS শোনা হচ্ছে ✅"

## Known limitations (be aware before relying on this for real money)

- **Sender-ID allowlists are best-effort guesses** for everything except
  bKash/Nagad/Rocket, which are also unverified assumptions. Send a real
  test transaction for every provider you plan to support and confirm
  the sender ID and message format before trusting it in production.
- **No local retry queue yet** — if the phone has no internet when an
  SMS arrives, that forward attempt is lost (the SMS itself is NOT lost,
  just the forward). A production version should persist unsent events
  in a local database and retry on reconnect.
- **Doze mode / battery optimization** can delay broadcast delivery on
  some phones. Consider asking the user to disable battery optimization
  for this app specifically.
- This app requests `RECEIVE_SMS` / `READ_SMS`, which Google Play
  restricts heavily for apps not published through their normal review
  flow for SMS-handling apps. This is intended to be **sideloaded**
  (installed directly via APK), not distributed through the Play Store.
