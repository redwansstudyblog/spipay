# spipay — প্রজেক্ট ব্যাকগ্রাউন্ড

## এটা কী

**spipay** একটা ফ্রি, ওপেন-সোর্স পেমেন্ট ভেরিফিকেশন সিস্টেম — SSLCommerz-এর একটা বিকল্প, যেটা বাংলাদেশের mobile financial service (bKash, Nagad, Rocket, Upay, Tap, CellFin ইত্যাদি) দিয়ে চলা ব্যবসাগুলোর জন্য বানানো।

## সমস্যাটা কী ছিল

SSLCommerz-এর মতো payment gateway ব্যবহার করতে হলে merchant account, KYC, আর প্রতি transaction-এ ফি (২-৩%) দিতে হয়। ছোট ব্যবসা, ফ্রিল্যান্সার, স্টুডেন্ট-ডেভেলপার — যারা শুধু নিজেদের bKash/Nagad নম্বরে টাকা নিতে চায়, তাদের জন্য এটা অপ্রয়োজনীয় জটিল আর ব্যয়বহুল।

## সমাধান কী

Merchant-এর একটা ডেডিকেটেড ফোনে (শুধু পেমেন্ট SMS receive করার জন্য) একটা Android app চলে, যেটা bKash/Nagad/Rocket ইত্যাদির অফিসিয়াল SMS পড়ে, ব্যাকএন্ডে পাঠায়। কাস্টমার যখন checkout page-এ টাকা পাঠিয়ে TrxID জমা দেয়, সিস্টেম সেটা SMS-এর সাথে মিলিয়ে (amount + TrxID + provider) স্বয়ংক্রিয়ভাবে ভেরিফাই করে দেয় — কোনো manual চেক লাগে না, কোনো fee লাগে না।

## কীভাবে কাজ করে (ধাপে ধাপে)

1. Merchant আমাদের dashboard-এ সাইন আপ করে, নিজের bKash/Nagad/ইত্যাদি নম্বর যোগ করে, একটা API key পায়
2. Merchant-এর ফোনে spipay-এর Android app ইনস্টল থাকে, যেটা payment SMS শোনে
3. কাস্টমার merchant-এর সাইটে checkout page-এ যায়, টাকা পাঠায়, TrxID জমা দেয়
4. Backend TrxID + amount + provider মিলিয়ে দেখে — SMS থেকে পাওয়া তথ্যের সাথে মিললে payment "verified" হয়ে যায়
5. Merchant-এর সাইটে signed webhook পাঠানো হয়, অর্ডার confirm হয়ে যায়

## সিকিউরিটি

- SMS শুধু অফিসিয়াল sender ID থেকে আসলেই গ্রহণযোগ্য (fake SMS ঠেকাতে)
- প্রতিটা SMS HMAC দিয়ে সাইন করা থাকে (app ↔ server communication tamper-proof)
- Amount + TrxID + provider — তিনটাই মিলতে হয়, শুধু একটা না (multi-factor matching)
- একই TrxID দ্বিতীয়বার ব্যবহার করা যায় না (duplicate/replay ঠেকাতে)
- Webhook-ও HMAC সাইন করা, merchant নিশ্চিত হতে পারে confirmation আসলেই spipay থেকে এসেছে

## কারা সাপোর্ট করে

**Mobile wallet (SMS-ভিত্তিক):** bKash, Nagad, Rocket, Upay, Tap, CellFin, SureCash, OK Wallet, mCash, Meghna Pay

**সাপোর্ট করে না (ইচ্ছাকৃতভাবে):** Card ও Net/Internet Banking — এগুলোর জন্য লাইসেন্সপ্রাপ্ত payment gateway/ব্যাংক পার্টনারশিপ লাগে, এটা সম্পূর্ণ ভিন্ন ব্যবসা। ভবিষ্যতে একটা existing gateway-কে fallback হিসেবে ব্যবহার করার পরিকল্পনা আছে।

## এখন পর্যন্ত কী বানানো হয়েছে

- **Backend** — Supabase-এ পুরো database schema আর ৪টা API (Edge Function): অর্ডার তৈরি, TrxID জমা, SMS verification, status check
- **Android app** — SMS শোনার জন্য, GitHub Actions দিয়ে APK build হয় (Android Studio ছাড়াই)
- **Merchant dashboard** — সাইন আপ, নম্বর ম্যানেজমেন্ট, API key, transaction history
- **Checkout page** — ডিজাইন চলছে (Lovable AI দিয়ে)

## টার্গেট ইউজার

প্রথমে বাংলাদেশ — ছোট ব্যবসা, ফ্রিল্যান্সার, ইনডি ডেভেলপার/vibe-coder যারা কোড করে সাইড প্রজেক্ট বানায় কিন্তু SSLCommerz-এর ঝামেলায় যেতে চায় না। সাকসেস হলে পরে ইন্টারন্যাশনালি স্কেল করার পরিকল্পনা।
