# Website demo on Vercel

Address: https://flexikeys.vercel.app (Vercel project `flexikeys`, on Bekzod's personal Hobby account).

## What runs there

Only the website (`apps/web`) runs there, in **mock mode**: the site uses demo data kept in the visitor's browser.
There is no server, database or file storage behind it, and nothing a visitor types leaves their browser.
The server (`apps/api`) and the real production setup (`deploy/`, Contabo, Caddy) are not on Vercel.

## Settings (Vercel → Project → Settings → Environment Variables)

Set for Production and Preview:

| Name | Value | Why |
|---|---|---|
| `NEXT_PUBLIC_API_MODE` | `mock` | Demo data in the browser; no server needed |
| `FK_DEV_PAGES` | `0` | Hides the `/dev/design` gallery |
| `NEXT_PUBLIC_SITE_URL` | `https://flexikeys.vercel.app` | Canonical links, sitemap and Open Graph use this address, not `flexikeys.uz` |

Do not set `FK_API_ORIGIN`, `FK_STORAGE_ORIGIN` or `NEXT_PUBLIC_API_MODE=live`: they are for the real server only.
`NEXT_PUBLIC_` values are built into the code, so after changing one, deploy again.

## Redeploy

From `apps/web/`, signed in to the Vercel account (`npx vercel@latest whoami`; if not, `npx vercel@latest login`):

```
npx vercel@latest deploy --prod
```

Vercel runs `npm run build` (including `postbuild`) on its own Linux machines, so it works from Windows too.

The first `vercel link` on a new computer writes a short-lived Vercel token into `apps/web/.env.local`. Git ignores
the file, but delete it: the website does not need it.

## Pushes to `main` do not redeploy

The GitHub repository is not connected to Vercel yet, so a push to `main` changes nothing on the demo until someone
runs the command above. To deploy every push automatically, Azim (the repository owner) connects it in Vercel:
Project → Settings → Git → connect `azimrkhmv/flexikeysweb`, with Root Directory `apps/web`.

## Before real families use it

Vercel's free Hobby plan is for personal, non-commercial use only. A demo with fake data is fine. Before FlexiKeys
takes money or real families' data, the website moves to Vercel Pro or to the Contabo server in `deploy/`.
