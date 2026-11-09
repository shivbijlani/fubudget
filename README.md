# fubudget

A Conscious Spending Plan dashboard (in the style of Ramit Sethi's *I Will Teach You To Be Rich*), published at [fubudget.com](https://fubudget.com/).

It shows every monthly dollar sorted into the four IWT buckets (fixed costs, investments, savings, guilt-free spending), compares each bucket to its target band, and draws a Sankey of income sources, total base, buckets, and envelopes.

## Your data never lives in this repo

The repo ships only the app and a clearly fictional demo household. A real plan arrives in the URL:

```
https://fubudget.com/?plan=<encoded payload>
```

Nothing is stored on a server or in the browser. To keep a plan, keep its link. The page sets `Referrer-Policy: no-referrer` so the link is not leaked to other sites. Query strings do reach the static host's request logs, so treat a plan link like any other private link.

### Payload

The `plan` param (or `scenario`, matching the lifetime app) holds a versioned payload:

```json
{ "version": 1, "params": { "title": "...", "incomes": [], "buckets": [], "envelopes": [] } }
```

It may be encoded three ways; the app accepts all of them:

| Form | Example | Notes |
| --- | --- | --- |
| Compressed | `z1.<base64url>` | `deflate-raw`, then base64url. What "Copy share link" produces. Keeps a full plan around 5 KB. |
| Base64 JSON | `eyJ2ZXJzaW9uIjox...` | UTF-8 JSON, base64. Same style as lifetime. |
| Raw JSON | `{"version":1,...}` | URL-encoded. Handy for quick tests. |

`params` fields (all optional, unknown keys are dropped):

| Field | Shape |
| --- | --- |
| `title`, `subtitle`, `updated`, `baseNote`, `headline`, `numbersNote`, `sankeyNote`, `investmentsNote`, `incomeNote` | strings |
| `incomes` | `[{ label, amount, group?, color?, note? }]`, $/mo. Each one is its own node in the left column of the Sankey; sources in the same `group` share a color. |
| `sankeyCenterLabel`, `sankeyCenterTotal` | Label and value of the center Sankey node. The value defaults to the larger of total income and total outflow. |
| `sankeyFlows` | `[{ name, amount, color?, note? }]`, right column of the Sankey. When empty, the buckets are used. |
| `sankeyUnallocated` | $/mo not planned anywhere, shown as its own right-side node |
| `incomeDetail` | `[{ label, rows: [{ source, ytd?, projected?, basis? }] }]`, optional income breakdown tables |
| `buckets` | `[{ id, label?, targetMin?, targetMax?, color?, amount?, note? }]` (`targetMin`/`targetMax` may be `null` for a bucket with no IWT target), merged by `id` over the four standard buckets (`fixed`, `investments`, `savings`, `guilt`). `amount` defaults to the sum of the bucket's envelopes; `note` defaults to a generated comparison with the target band. |
| `envelopes` | `[{ bucket, name, amount }]`, $/mo |
| `investments` | `[{ component, perYear?, perMonth?, note?, total? }]`, the detailed investments table |
| `appendix` | `[{ source, location?, usedFor?, version? }]` |
| `sources` | `string[]`, sources and caveats |

Make a link from a JSON file:

```bash
npm run encode -- path/to/plan.json            # https://fubudget.com/?plan=z1....
npm run encode -- path/to/plan.json http://localhost:3000/
```

Or open the site, paste JSON into **Edit data**, press **Apply**, then **Copy share link**.

## Develop

```bash
npm install
npm run dev       # http://localhost:3000
npm run export    # static site in out/
npm run lint
```

## Deploy

Same mechanics as lifetime: pushing to `main` runs `.github/workflows/deploy-pages.yml`, which builds the static export at the root path and publishes `out/` to the `gh-pages` branch. `public/CNAME` points GitHub Pages at `fubudget.com`, served over HTTPS. Old `shivbijlani.github.io/fubudget/` links redirect to `fubudget.com` with their query string.

DNS for `fubudget.com` (at the registrar): apex `A` records to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`, and `www` pointing at GitHub Pages (a `CNAME` to `shivbijlani.github.io` is preferred).

### Serving from shivbijlani.github.io/fubudget instead

1. Delete `public/CNAME`.
2. In the workflow's build step, add `env: NEXT_PUBLIC_BASE_PATH: /fubudget`.
3. Remove the custom domain in repo Settings, Pages.
4. Update the default `baseUrl` in `scripts/encode-plan.mjs`.