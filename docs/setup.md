# Running silaturahmi locally

Design and reasoning live in [supabase-integration.md](./supabase-integration.md).
This is just what to type.

## Option A — a hosted Supabase project

If `NEXT_PUBLIC_SUPABASE_URL` points at `*.supabase.co`, the migrations still
have to be applied; creating the project does not create the tables.

```bash
supabase link --project-ref <ref>   # the subdomain of your project URL
supabase db push                    # applies 0001, 0002, 0003
```

Keys come from Studio → Project Settings → API keys. Either key format works:

| Env var | Legacy | Current |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` JWT | `sb_publishable_…` |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` JWT | `sb_secret_…` |

Getting these two the wrong way round is the classic failure: every write is
refused by RLS, because the publishable key has no permissions of its own. The
app now says so explicitly instead of reporting a generic failure.

Then skip to step 2 below for `EDIT_ACTOR_SALT`, and to step 3 for auth setup
(with Site URL and redirect URLs set to your deployed origin).

## Option B — local Supabase

## 1. Start Supabase

```bash
supabase init      # only if supabase/config.toml does not exist — it leaves migrations/ alone
supabase start
supabase db reset  # applies 0001, 0002, 0003
```

`supabase start` prints an API URL, an anon key, and a service-role key. Keep the
terminal open; you need all three.

## 2. Environment

```bash
cp .env.local.example .env.local
```

Fill in the two keys from step 1, then generate the salt:

```bash
openssl rand -hex 32   # -> EDIT_ACTOR_SALT
```

`EDIT_ACTOR_SALT` is what lets the app rate-limit anonymous editors without
storing anyone's IP address. Rotating it resets every rate-limit bucket, which is
harmless.

## 3. Auth settings

In Studio (`http://127.0.0.1:54323`) → Authentication → Providers:

- **Enable "Confirm email."** Without it `signUp` returns a session immediately
  and the verification step in the product flow does nothing.
- Google is optional locally. To enable it, the authorized redirect URI in Google
  Cloud Console is the **Supabase** callback (`.../auth/v1/callback`), not the
  app's `/auth/callback`.

Local mail does not leave your machine — every confirmation and magic link lands
in Inbucket at **http://127.0.0.1:54324**.

## 4. Run

```bash
npm run dev
```

## 5. Walk the flow

1. `/` — the demo tree. Edits here live in React state and vanish on reload.
2. `/register` → confirm from Inbucket → `/app`.
3. `/app` is empty → **Create a family** → family name plus one person.
4. You land on `/f/<slug>`. That URL is the capability: anyone holding it can
   view *and edit*. Rotating it in settings is the only way to take that back.
5. Add a spouse, then a child. Open the overview popover → **Family settings** to
   see the edit log, with an Undo on each entry.

## Checks worth running

```bash
npx tsc --noEmit        # types
npm run build           # production build
npx tsx lib/layout.ts   # tidy-tree self-check: no overlaps, lone person, empty family
npx tsx lib/family.tsx  # reducer self-check
```

The two `tsx` self-checks are plain `console.assert` blocks at the bottom of
those files. The layout one is the load-bearing check — it covers the case that
used to crash every newly created family.

For the database, security, and Storage assertions, see §10 of
[supabase-integration.md](./supabase-integration.md). They need a running
database and are not covered by the commands above.
