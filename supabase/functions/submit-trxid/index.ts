import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fireWebhook(merchant: any, pr: any) {
  if (!merchant.webhook_url) return;
  const payload = {
    event: "payment.verified",
    payment_request_id: pr.id,
    order_reference: pr.order_reference,
    amount: pr.amount,
    provider: pr.provider,
  };
  const body = JSON.stringify(payload);
  const signature = await hmacHex(merchant.webhook_secret, body);

  let status = 0;
  try {
    const res = await fetch(merchant.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-signature": signature },
      body,
    });
    status = res.status;
  } catch (_e) {
    status = 0;
  }

  await supabase.from("webhook_deliveries").insert({
    payment_request_id: pr.id,
    payload,
    http_status: status,
    delivered_at: status > 0 ? new Date().toISOString() : null,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const body = await req.json().catch(() => null);
  if (!body?.payment_request_id || !body?.trxid) {
    return json({ error: "payment_request_id and trxid are required" }, 400);
  }

  const { data: pr, error: prErr } = await supabase
    .from("payment_requests")
    .select("*, merchants(*)")
    .eq("id", body.payment_request_id)
    .single();

  if (prErr || !pr) return json({ error: "payment request not found" }, 404);
  if (pr.status === "verified") return json({ status: "verified" });
  if (new Date(pr.expires_at) < new Date()) {
    await supabase.from("payment_requests").update({ status: "expired" }).eq("id", pr.id);
    return json({ status: "expired" });
  }

  const trxid = String(body.trxid).trim().toUpperCase();

  await supabase
    .from("payment_requests")
    .update({ claimed_trxid: trxid, status: "awaiting_trxid" })
    .eq("id", pr.id);

  const { data: smsMatch } = await supabase
    .from("sms_events")
    .select("*")
    .eq("merchant_id", pr.merchant_id)
    .eq("parsed_trxid", trxid)
    .eq("is_official_sender", true)
    .is("matched_payment_request_id", null)
    .eq("provider", pr.provider)
    .eq("parsed_amount", pr.amount)
    .limit(1)
    .maybeSingle();

  if (!smsMatch) {
    return json({ status: "awaiting_trxid" });
  }

  await supabase
    .from("payment_requests")
    .update({ status: "verified", verified_at: new Date().toISOString() })
    .eq("id", pr.id);

  await supabase
    .from("sms_events")
    .update({ matched_payment_request_id: pr.id })
    .eq("id", smsMatch.id);

  await supabase.from("verification_log").insert({
    payment_request_id: pr.id,
    sms_event_id: smsMatch.id,
    outcome: "verified",
  });

  await fireWebhook(pr.merchants, pr);

  return json({ status: "verified" });
});
