# spipay checkout — standalone static build

This is a plain, dependency-light Vite + React copy of the checkout page,
extracted from the Lovable "checkout-app" project so it can be built and
deployed anywhere (no Cloudflare Workers / TanStack Start SSR required).

Lovable's project (`checkout-app/`) is the one to keep *editing* visually
(via Lovable's own UI) — after making changes there, port them over here
by copying the relevant JSX/logic from `checkout-app/src/routes/index.tsx`
into `checkout-static-src/src/App.tsx` (strip the `createFileRoute` bits).

## Build

```
npm install
npm run build
```

Output lands in `dist/` — copy its contents into `../checkout/` to
redeploy on GitHub Pages.
