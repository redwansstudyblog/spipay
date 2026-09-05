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

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return json({ error: "missing x-api-key" }, 401);

  const { data: merchant, error: merchantErr } = await supabase
    .from("merchants")
    .select("id")
    .eq("api_key", apiKey)
    .single();

  if (merchantErr || !merchant) return json({ error: "invalid api key" }, 401);

  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "invalid json body" }, 400);

  const { order_reference, amount, provider } = body;
  if (!order_reference || !amount || !provider) {
    return json({ error: "order_reference, amount, and provider are required" }, 400);
  }
  if (!["bkash", "nagad", "rocket"].includes(provider)) {
    return json({ error: "provider must be bkash, nagad, or rocket" }, 400);
  }

  const { data: number, error: numberErr } = await supabase
    .from("merchant_numbers")
    .select("id, phone_number")
    .eq("merchant_id", merchant.id)
    .eq("provider", provider)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (numberErr || !number) {
    return json({ error: `no active ${provider} number configured for this merchant` }, 400);
  }

  const { data: pr, error: prErr } = await supabase
    .from("payment_requests")
    .insert({
      merchant_id: merchant.id,
      order_reference,
      amount,
      provider,
      merchant_number_id: number.id,
    })
    .select("id, amount, provider, expires_at")
    .single();

  if (prErr) return json({ error: prErr.message }, 500);

  return json({
    payment_request_id: pr.id,
    amount: pr.amount,
    provider: pr.provider,
    pay_to_number: number.phone_number,
    expires_at: pr.expires_at,
  });
});
