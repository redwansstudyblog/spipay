import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Headphones,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import spipayLogo from "@/assets/spipay-logo.png";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────
   MERCHANT CONFIG — এই অবজেক্টটাই সবকিছু নিয়ন্ত্রণ করে।
   প্রতিটা merchant শুধু এখানকার মান বদলে নিজের ব্র্যান্ডিং বসাবে।
   ──────────────────────────────────────────────────────────────── */
const merchantConfig = {
  brandName: "spipay", // প্ল্যাটফর্মের নাম (টেক্সট)
  brandTagline: "সিকিউর চেকআউট",
  businessName: "Redwan's Method", // merchant-এর ব্যবসার নাম
  invoiceId: "SP-1042",
  amount: "৳ 2,990.00",
  currencyHint: "ঠিক এই পরিমাণ",
  countdownSeconds: 5 * 60, // ৫ মিনিট
  supportLabel: "সমস্যা হলে যোগাযোগ করুন",
  supportHref: "mailto:support@example.com", // merchant নিজের নম্বর/লিংক বসাবে
  footerNote: "আমরা কখনো PIN, পাসওয়ার্ড বা OTP চাই না",
};

/* প্রতিটা পেমেন্ট মাধ্যম — নাম, ব্র্যান্ড কালার, নম্বর, placeholder ব্যাজ।
   merchant চাইলে logoUrl দিয়ে নিজের লোগো বসাতে পারবে। */
type Provider = {
  id: string;
  name: string;
  short: string;
  color: string; // ব্র্যান্ড কালার (পেমেন্ট পেজের থিম)
  number: string; // merchant-এর পেমেন্ট নম্বর
  logoUrl?: string; // optional: merchant-এর আপলোড করা লোগো
};

const providers: Provider[] = [
  { id: "bkash", name: "বিকাশ", short: "bKash", color: "#E2136E", number: "01712 345 678" },
  { id: "nagad", name: "নগদ", short: "Nagad", color: "#F7941D", number: "01812 345 678" },
  { id: "rocket", name: "রকেট", short: "Rocket", color: "#8C3494", number: "01912 345 678" },
];

type Step = "select" | "pay";
type Status = "idle" | "checking" | "confirmed" | "unconfirmed";

// spipay ব্যাকএন্ড। এই ফাইলটাই একমাত্র জায়গা যেখানে এটা বদলাতে হবে।
const API_BASE = "https://nihvxjmshnzxzffnrdst.supabase.co/functions/v1";

export default function App() {
  const [step, setStep] = useState<Step>("select");
  const [selectedId, setSelectedId] = useState<string>(providers[0]?.id ?? "");
  const [seconds, setSeconds] = useState(merchantConfig.countdownSeconds);
  const [copied, setCopied] = useState(false);
  const [trxId, setTrxId] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  // --- Real backend wiring ---
  // দুই মোডে চলে: (ক) URL-এ ?id=<payment_request_id> থাকলে — merchant
  // আগেই একটা নির্দিষ্ট provider দিয়ে অর্ডার বানিয়ে রেখেছে, সরাসরি পে স্ক্রিনে
  // যাবে। (খ) ?merchant_id=...&amount=...&order_reference=... থাকলে —
  // কাস্টমার নিজে provider বেছে নেবে, বাছার সময় অর্ডার তৈরি হবে।
  // কোনোটাই না থাকলে (Lovable প্রিভিউ/ডিজাইন মোড) উপরের demo config দেখাবে।
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const existingId = params.get("id");
  const publicMerchantId = params.get("merchant_id");
  const publicAmount = params.get("amount");
  const publicOrderRef = params.get("order_reference");

  const [live, setLive] = useState<{
    paymentRequestId: string | null;
    businessName: string;
    invoiceId: string;
    amount: string;
    payToNumber: string | null;
    liveProviders: Provider[] | null;
  }>({
    paymentRequestId: null,
    businessName: merchantConfig.businessName,
    invoiceId: merchantConfig.invoiceId,
    amount: merchantConfig.amount,
    payToNumber: null,
    liveProviders: null,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // মোড (ক): id দিয়ে সরাসরি — status লোড করে পে স্ক্রিনে চলে যাও
  useEffect(() => {
    if (!existingId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/payment-status?id=${existingId}`);
        const data = await res.json();
        if (!res.ok) return;
        setLive((prev) => ({
          ...prev,
          paymentRequestId: data.id,
          businessName: data.merchant_name ?? prev.businessName,
          invoiceId: data.order_reference ?? prev.invoiceId,
          amount: `৳ ${data.amount}`,
          payToNumber: data.pay_to_number,
        }));
        setSelectedId(data.provider);
        setStep("pay");
        if (data.status === "verified") setStatus("confirmed");
        if (data.status === "expired") setStatus("unconfirmed");
      } catch (_e) {
        // নেটওয়ার্ক সমস্যা — demo config-এই থাকবে
      }
    })();
  }, [existingId]);

  // মোড (খ): merchant_id দিয়ে — real provider লিস্ট আনো selection স্ক্রিনের জন্য
  useEffect(() => {
    if (!publicMerchantId || existingId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/merchant-info?merchant_id=${publicMerchantId}`);
        const data = await res.json();
        if (!res.ok) return;
        const brandColors: Record<string, string> = {
          bkash: "#E2136E", nagad: "#F7941D", rocket: "#8C3494",
          upay: "#00A651", tap: "#0072BC", cellfin: "#1C7C54",
          surecash: "#2E7D32", okwallet: "#F9A825", mcash: "#C62828", meghnapay: "#00695C",
        };
        const nameLabels: Record<string, string> = {
          bkash: "বিকাশ", nagad: "নগদ", rocket: "রকেট", upay: "Upay", tap: "Tap",
          cellfin: "CellFin", surecash: "SureCash", okwallet: "OK Wallet", mcash: "mCash", meghnapay: "Meghna Pay",
        };
        const mapped: Provider[] = (data.providers || []).map((p: { provider: string; number: string }) => ({
          id: p.provider,
          name: nameLabels[p.provider] ?? p.provider,
          short: p.provider,
          color: brandColors[p.provider] ?? "#334155",
          number: p.number,
        }));
        if (mapped.length > 0) {
          setLive((prev) => ({
            ...prev,
            businessName: data.business_name ?? prev.businessName,
            invoiceId: publicOrderRef ?? prev.invoiceId,
            amount: publicAmount ? `৳ ${publicAmount}` : prev.amount,
            liveProviders: mapped,
          }));
          setSelectedId(mapped[0].id);
        }
      } catch (_e) {
        // নেটওয়ার্ক সমস্যা — demo config-এই থাকবে
      }
    })();
  }, [publicMerchantId, existingId, publicOrderRef, publicAmount]);

  const activeProviders = live.liveProviders ?? providers;

  const selected: Provider = useMemo(
    () => activeProviders.find((provider) => provider.id === selectedId) ?? (activeProviders[0] as Provider),
    [selectedId, activeProviders],
  );

  const displayNumber = live.payToNumber ?? selected.number;

  const copyNumber = async () => {
    await navigator.clipboard?.writeText(displayNumber.replaceAll(" ", ""));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  // ধাপ ১ → ২: যদি এখনো কোনো real payment request তৈরি না হয়ে থাকে
  // (মোড খ), এই মুহূর্তে merchant_id + বাছাই করা provider দিয়ে তৈরি করো।
  const proceedToPay = async () => {
    if (!publicMerchantId || live.paymentRequestId || existingId) {
      setStep("pay");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/create-payment-request-public`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant_id: publicMerchantId,
          order_reference: publicOrderRef ?? `ORD-${Date.now()}`,
          amount: publicAmount ?? "0",
          provider: selected.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setLive((prev) => ({ ...prev, paymentRequestId: data.payment_request_id, payToNumber: data.pay_to_number }));
      }
    } catch (_e) {
      // ব্যর্থ হলেও পে স্ক্রিনে যাবে, submit-এর সময় আবার চেষ্টা হবে না —
      // তাই এই কেসে ব্যবহারকারীকে জানানো ভালো, কিন্তু ডেমো ভাঙবে না
    }
    setStep("pay");
  };

  const pollStatus = (paymentRequestId: string) => {
    const poll = window.setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/payment-status?id=${paymentRequestId}`);
        const data = await res.json();
        if (data.status === "verified") {
          setStatus("confirmed");
          window.clearInterval(poll);
        } else if (data.status === "expired") {
          setStatus("unconfirmed");
          window.clearInterval(poll);
        }
      } catch (_e) {
        // পরের পোলে আবার চেষ্টা হবে
      }
    }, 4000);
  };

  const confirmPayment = async () => {
    if (trxId.trim().length < 6) {
      setStatus("unconfirmed");
      return;
    }

    if (!live.paymentRequestId) {
      // real backend connect করা নেই (ডেমো মোড) — আগের মতো simulate করো
      setStatus("checking");
      window.setTimeout(() => setStatus("confirmed"), 1800);
      return;
    }

    setStatus("checking");
    try {
      const res = await fetch(`${API_BASE}/submit-trxid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_request_id: live.paymentRequestId, trxid: trxId.trim() }),
      });
      const data = await res.json();
      if (data.status === "verified") {
        setStatus("confirmed");
      } else if (data.status === "expired") {
        setStatus("unconfirmed");
      } else {
        // awaiting_trxid — SMS এখনো আসেনি, poll করে অপেক্ষা করো
        pollStatus(live.paymentRequestId);
      }
    } catch (_e) {
      setStatus("unconfirmed");
    }
  };

  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remaining = (seconds % 60).toString().padStart(2, "0");

  return (
    <main className="flex min-h-screen flex-col bg-canvas text-foreground">
      {/* Top brand header */}
      <header className="mx-auto flex w-full max-w-[480px] items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center overflow-hidden rounded-lg shadow-lg shadow-brand/20">
            <img src={spipayLogo} alt={`${merchantConfig.brandName} logo`} className="size-full object-cover" />
          </div>
          <div>
            <p className="font-display text-lg font-bold leading-none">{merchantConfig.brandName}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{merchantConfig.brandTagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <ShieldCheck className="size-4 text-brand" />
          <span className="hidden sm:inline">Secure checkout · SSL protected</span>
        </div>
      </header>

      <div className="flex flex-1 justify-center px-3 pb-10">
      {/* মোবাইল-সাইজ কার্ড — সব স্ক্রিনে এই প্রস্থই থাকবে */}
      <div className="h-fit w-full max-w-[420px] overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl shadow-brand/10">
        {/* Header: merchant identity */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          {step === "pay" ? (
            <Button variant="ghost" size="icon" aria-label="ফিরে যান" onClick={() => { setStep("select"); setStatus("idle"); }}>
              <ArrowLeft />
            </Button>
          ) : (
            <span className="size-9" />
          )}
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg">
              <img src={spipayLogo} alt={`${merchantConfig.brandName} logo`} className="size-full object-cover" />
            </div>
            <div className="min-w-0 text-center">
              <h1 className="truncate font-display text-sm font-bold">{merchantConfig.businessName}</h1>
              <p className="truncate text-[11px] text-muted-foreground">ইনভয়েস #{merchantConfig.invoiceId}</p>
            </div>
          </div>
          <span className="size-9" />
        </div>

        {/* Amount + countdown */}
        <div className="flex items-end justify-between gap-3 bg-muted/50 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">পরিশোধযোগ্য</p>
            <p className="mt-1 font-display text-3xl font-bold leading-none">{merchantConfig.amount}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">সময় বাকি</p>
            <p className="mt-1 flex items-center justify-end gap-1 font-semibold tabular-nums text-brand">
              <Clock3 className="size-3.5" />
              {minutes}:{remaining}
            </p>
          </div>
        </div>

        {step === "select" ? (
          /* ── ধাপ ১: মোবাইল ব্যাংকিং মাধ্যম নির্বাচন ── */
          <div className="checkout-rise p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-brand/10 text-brand"><Smartphone className="size-4" /></span>
              <div>
                <p className="text-sm font-bold">মোবাইল ব্যাংকিং</p>
                <p className="text-[11px] text-muted-foreground">কোন মাধ্যমে পেমেন্ট করবেন বেছে নিন</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {providers.map((provider) => {
                const active = selected.id === provider.id;
                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => setSelectedId(provider.id)}
                    className={cn(
                      "relative flex h-[92px] flex-col items-center justify-center gap-2 rounded-xl border bg-panel px-2 transition-all",
                      active ? "border-transparent shadow-md ring-2" : "border-border hover:border-muted-foreground/30",
                    )}
                    style={active ? { borderColor: provider.color, boxShadow: `0 0 0 2px ${provider.color}` } : undefined}
                  >
                    {provider.logoUrl ? (
                      <img src={provider.logoUrl} alt={`${provider.name} লোগো`} className="size-9 rounded-lg object-contain" />
                    ) : (
                      <span
                        className="grid size-9 place-items-center rounded-lg text-[10px] font-bold text-white"
                        style={{ backgroundColor: provider.color }}
                      >
                        {provider.short.slice(0, 2)}
                      </span>
                    )}
                    <span className="w-full truncate text-center text-xs font-semibold">{provider.name}</span>
                    {active && (
                      <span
                        className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full text-white"
                        style={{ backgroundColor: provider.color }}
                      >
                        <Check className="size-2.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <Button
              onClick={() => setStep("pay")}
              className="mt-4 h-11 w-full rounded-xl bg-brand font-semibold text-primary-foreground shadow-lg shadow-brand/20 hover:bg-brand-strong"
            >
              {selected.name} দিয়ে এগিয়ে যান
              <ChevronRight />
            </Button>
          </div>
        ) : (
          /* ── ধাপ ২: পেমেন্ট নিশ্চিতকরণ — provider ব্র্যান্ড কালারে থিম ── */
          <div key={selected.id} className="checkout-rise p-4 sm:p-5" style={{ "--provider": selected.color } as React.CSSProperties}>
            <div
              className="rounded-xl p-4 text-white"
              style={{ background: `linear-gradient(135deg, ${selected.color}, ${selected.color}CC)` }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display text-base font-bold">{selected.name} পেমেন্ট</p>
                  <p className="mt-0.5 text-[11px] text-white/80">Send Money — Personal</p>
                </div>
                {selected.logoUrl ? (
                  <img src={selected.logoUrl} alt={`${selected.name} লোগো`} className="size-10 rounded-lg bg-white object-contain p-1" />
                ) : (
                  <span className="grid size-10 place-items-center rounded-lg bg-white/20 text-xs font-bold">{selected.short.slice(0, 2)}</span>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-white/15 p-3 backdrop-blur">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-white/75">এই নম্বরে {merchantConfig.currencyHint} {merchantConfig.amount} পাঠান</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums tracking-wide">{selected.number}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={copyNumber} className="shrink-0 bg-white text-foreground hover:bg-white/90">
                  {copied ? <Check /> : <Copy />}
                  {copied ? "কপি হয়েছে" : "কপি"}
                </Button>
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              উপরের নম্বরে <strong className="text-foreground">{merchantConfig.amount}</strong> Send Money করে SMS-এ পাওয়া
              Transaction ID টি নিচে দিন।
            </p>

            <label className="mt-3 block text-[11px] font-medium text-muted-foreground">
              Transaction ID (TrxID)
              <Input
                value={trxId}
                onChange={(event) => { setTrxId(event.target.value.toUpperCase()); setStatus("idle"); }}
                placeholder="যেমন 9H4K7P2QXC"
                className="mt-1 h-11 bg-panel uppercase tracking-widest text-foreground"
                disabled={status === "checking" || status === "confirmed"}
              />
            </label>

            {status === "checking" && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-brand/10 p-3 text-xs text-brand">
                <LoaderCircle className="size-4 animate-spin" />
                নিশ্চিত করা হচ্ছে... কয়েক সেকেন্ড অপেক্ষা করুন
              </div>
            )}

            {status === "confirmed" && (
              <div className="checkout-rise mt-3 flex items-start gap-2.5 rounded-lg border border-provider-upay/30 bg-provider-upay/10 p-3 text-xs text-provider-upay">
                <BadgeCheck className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-bold">পেমেন্ট নিশ্চিত হয়েছে ✓</p>
                  <p className="mt-0.5 text-provider-upay/80">আপনার অর্ডার সফলভাবে সম্পন্ন হয়েছে। ধন্যবাদ!</p>
                </div>
              </div>
            )}

            {status === "unconfirmed" && (
              <div className="checkout-rise mt-3 rounded-lg border border-border bg-muted/50 p-3 text-xs">
                <p className="font-semibold text-foreground">এখনো নিশ্চিত করা যায়নি</p>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  TrxID টি ঠিক আছে কিনা দেখে আবার চেষ্টা করুন। সমস্যা থাকলে নিচের ঠিকানায় যোগাযোগ করুন।
                </p>
                <a href={merchantConfig.supportHref} className="mt-2 inline-flex items-center gap-1.5 font-medium text-brand hover:underline">
                  <Headphones className="size-3.5" />
                  {merchantConfig.supportLabel}
                </a>
              </div>
            )}

            {status !== "confirmed" && (
              <Button
                onClick={confirmPayment}
                disabled={status === "checking" || trxId.trim().length === 0}
                className="mt-4 h-11 w-full rounded-xl font-semibold text-white shadow-lg"
                style={{ backgroundColor: selected.color }}
              >
                {status === "checking" ? (
                  <><LoaderCircle className="animate-spin" /> যাচাই চলছে</>
                ) : (
                  <>পেমেন্ট যাচাই করুন<ChevronRight /></>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Footer */}
        <footer className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <LockKeyhole className="size-3.5 text-brand" />
            {merchantConfig.footerNote}
          </span>
          <a href={merchantConfig.supportHref} className="flex items-center gap-1 font-medium hover:text-foreground">
            <Headphones className="size-3.5" />
            সহায়তা
          </a>
        </footer>
      </div>

      <p className="fixed bottom-2 left-0 right-0 text-center text-[10px] text-muted-foreground">
        Powered by <strong className="text-foreground">{merchantConfig.brandName}</strong> · <ShieldCheck className="inline size-3 text-brand" /> সুরক্ষিত
      </p>
      </div>
    </main>
  );
}
