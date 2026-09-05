import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "id query param required" }, 400);

  const { data: pr, error } = await supabase
    .from("payment_requests")
    .select(
      "id, status, amount, provider, order_reference, expires_at, merchants(name), merchant_numbers(phone_number)"
    )
    .eq("id", id)
    .single();

  if (error || !pr) return json({ error: "not found" }, 404);

  return json({
    id: pr.id,
    status: pr.status,
    amount: pr.amount,
    provider: pr.provider,
    order_reference: pr.order_reference,
    expires_at: pr.expires_at,
    merchant_name: (pr as any).merchants?.name ?? null,
    pay_to_number: (pr as any).merchant_numbers?.phone_number ?? null,
  });
});
