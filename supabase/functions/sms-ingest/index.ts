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

// NOTE: these sender-id allowlists are best-effort starting points.
// Each one should be confirmed against a real SMS from that provider
// before relying on it for actual verification — sender names/short
// codes can vary or change over time.
const OFFICIAL_SENDERS: Record<string, string[]> = {
  bkash: ["bkash", "16247"],
  nagad: ["nagad", "16167"],
  rocket: ["rocket", "dbbl", "16216"],
  upay: ["upay"],
  tap: ["tap"],
  cellfin: ["cellfin", "islami bank", "ibbl"],
  surecash: ["surecash"],
  okwallet: ["ok wallet", "okwallet"],
  mcash: ["mcash", "mercantile"],
  meghnapay: ["meghna"],
};

function parseSms(raw: string) {
  const amountMatch = raw.match(/Tk\s?\.?\s?([\d,]+\.?\d*)/i);
  const trxMatch = raw.match(/TrxID[:\s]+([A-Za-z0-9]+)/i);
  const senderMatch = raw.match(/from\s+(\d{7,11})/i);
  return {
    amount: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : null,
    trxid: trxMatch ? trxMatch[1].toUpperCase() : null,
    senderLast4: senderMatch ? senderMatch[1].slice(-4) : null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return json({ error: "missing x-api-key" }, 401);

  const { data: merchant, error: merchantErr } = await supabase
    .from("merchants")
    .select("*")
    .eq("api_key", apiKey)
    .single();

  if (merchantErr || !merchant) return json({ error: "invalid api key" }, 401);

  const body = await req.json().catch(() => null);
  if (!body?.provider || !body?.sender_id || !body?.raw_text || !body?.signature) {
    return json({ error: "provider, sender_id, raw_text, signature are required" }, 400);
  }

  const expectedSig = await hmacHex(merchant.webhook_secret, body.raw_text);
  const signatureOk = expectedSig === body.signature;
  if (!signatureOk) return json({ error: "invalid signature" }, 401);

  const provider = String(body.provider).toLowerCase();
  const senderId = String(body.sender_id).toLowerCase();
  const isOfficial = (OFFICIAL_SENDERS[provider] || []).some((s) => senderId.includes(s));

  const parsed = parseSms(body.raw_text);

  const { data: smsRow, error: smsErr } = await supabase
    .from("sms_events")
    .insert({
      merchant_id: merchant.id,
      provider,
      sender_id: body.sender_id,
      raw_text: body.raw_text,
      parsed_trxid: parsed.trxid,
      parsed_amount: parsed.amount,
      parsed_sender_last4: parsed.senderLast4,
      is_official_sender: isOfficial,
      hmac_signature: body.signature,
    })
    .select()
    .single();

  if (smsErr) return json({ error: smsErr.message }, 500);

  if (!isOfficial || !parsed.trxid) {
    return json({ stored: true, matched: false, reason: !isOfficial ? "sender_rejected" : "unparsed" });
  }

  const { data: pr } = await supabase
    .from("payment_requests")
    .select("*")
    .eq("merchant_id", merchant.id)
    .eq("provider", provider)
    .eq("claimed_trxid", parsed.trxid)
    .eq("amount", parsed.amount)
    .eq("status", "awaiting_trxid")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!pr) {
    return json({ stored: true, matched: false, reason: "no_pending_request" });
  }

  await supabase
    .from("payment_requests")
    .update({ status: "verified", verified_at: new Date().toISOString() })
    .eq("id", pr.id);

  await supabase.from("sms_events").update({ matched_payment_request_id: pr.id }).eq("id", smsRow.id);

  await supabase.from("verification_log").insert({
    payment_request_id: pr.id,
    sms_event_id: smsRow.id,
    outcome: "verified",
  });

  if (merchant.webhook_url) {
    const payload = {
      event: "payment.verified",
      payment_request_id: pr.id,
      order_reference: pr.order_reference,
      amount: pr.amount,
      provider: pr.provider,
    };
    const payloadStr = JSON.stringify(payload);
    const sig = await hmacHex(merchant.webhook_secret, payloadStr);
    let httpStatus = 0;
    try {
      const res = await fetch(merchant.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-signature": sig },
        body: payloadStr,
      });
      httpStatus = res.status;
    } catch (_e) {
      httpStatus = 0;
    }
    await supabase.from("webhook_deliveries").insert({
      payment_request_id: pr.id,
      payload,
      http_status: httpStatus,
      delivered_at: httpStatus > 0 ? new Date().toISOString() : null,
    });
  }

  return json({ stored: true, matched: true, payment_request_id: pr.id });
});
