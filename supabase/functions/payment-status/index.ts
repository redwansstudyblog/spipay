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
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "id query param required" }, 400);

  const { data: pr, error } = await supabase
    .from("payment_requests")
    .select("id, status, amount, provider, order_reference, expires_at")
    .eq("id", id)
    .single();

  if (error || !pr) return json({ error: "not found" }, 404);

  return json(pr);
});
