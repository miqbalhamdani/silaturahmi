# Supabase Integration — Technical Specification

Target: turn `silaturahmi` from an in-memory demo into a multi-tenant app with
owner accounts, unguessable public namespace URLs, and photo storage.

- **Auth + database**: Supabase
- **Object storage**: Supabase Storage (private bucket)
- **Hosting**: Vercel
- **Framework**: Next.js 16.3.2 / React 19.2.8

Companion file: `supabase/migrations/0001_init.sql` — the complete schema.

---

## 0. Where the app is today

No database, no auth wiring, no API routes. All state lives in
`FamilyTreeApp`'s `useState`, seeded from the hardcoded `lib/data.ts`. Two pure
functions in `lib/family.tsx` already carry the comments *"The single mutation
seam — swap this for a DB call later"* and *"The update seam"*. This spec fills
those seams.

**Status: all six phases in §9 are implemented.** What follows is the design and
its reasoning; where the build diverged from an earlier draft of this document,
the divergence is called out inline rather than quietly edited away.

Three features named in the brief turned out smaller than their names suggest,
and §5.1 maps each to what it actually needs from the database:

| Feature | What it actually is |
|---|---|
| Family overview | A popover in `Toolbar.tsx` showing four counts for the current family. Not a dashboard, not a list. |
| Share family | One icon button. `navigator.share` → clipboard fallback. Currently builds a slug-less URL. |
| Edit profile | Editing a **person in the tree**, via `DetailPanel` → `AddPersonPanel` edit mode. Not a user-account screen. |

`familyName` is a hardcoded `export const familyName = "Santoso"` in
`lib/data.ts`. It becomes `families.name`.

### The product flow being built

1. User registers and logs in.
2. User creates a family and receives a unique namespace URL.
3. Anyone holding that URL can view the graph **and** add or edit people, with
   no account.
4. After login the user lands on an empty page and must create: Family Settings
   (name, description, cover image) and the first person.

### Decisions locked before writing this

| Decision | Choice |
|---|---|
| URL secrecy | **Slug = view + edit.** One unguessable slug grants both. The owner can rotate it. |
| Anonymous writes | **Live + audit log.** Applied immediately, every change recorded, owner can revert. |
| Remarriage | **DB general, UI limited.** The schema allows multiple unions and multiple roots; `lib/layout.ts` keeps its single-union invariant until it becomes a DAG layout. |

### Constraints inherited from the existing code

Read these before changing the schema — every one of them is load-bearing.

- `layoutTree()` in `lib/layout.ts` **throws `"no root union found"`** unless
  exactly one root union exists, and assumes each person is a partner in at most
  one union. The schema does not enforce this; the write paths do (§6).
- Person ids are name-derived slugs (`ahmad`, `budi`), used by the
  `data-person-id` focus-return selectors. They must survive the move to UUID
  primary keys, which is why `lib/mappers.ts` maps `Person.id` to `people.slug`
  rather than to the uuid.
- Years are integers, not dates. `birthYear` required, `deathYear` optional
  (`undefined` = living). `gender?: "male" | "female"` was added to `Person`
  since the first draft of this spec — `AddPersonPanel` captures it and the
  family-overview popover counts on it. No events, no notes. **Do not add
  fields the UI does not have**, and update this document when the UI grows
  one.
- `AddPersonPanel.tsx` stores uploaded photos as base64 `data:` URLs. This is
  replaced, not migrated — data URLs in a `text` column bloat every row of every
  read.
- `Union.marriedYear` exists in seed data but is never entered or displayed.
  Keep the column; leave the UI alone.
- **No delete path exists anywhere in the app.** The schema supports delete; the
  UI for it is out of scope.

---

## 1. Architecture

```
Browser (React 19 canvas)
   │  Server Actions (mutations)          ┌─────────────────┐
   ├──────────────────────────────────────┤  Next.js 16     │
   │  RSC payload (initial graph)         │  on Vercel      │
   │                                      └────────┬────────┘
   │                                               │
   │  PUT to signed upload URL (bytes, direct)     │ service-role key
   ▼                                               ▼
┌──────────────────────────────────────────────────────────────┐
│                         Supabase                             │
│  Storage (private bucket) │ Postgres + RLS │ Auth            │
└──────────────────────────────────────────────────────────────┘
```

**The load-bearing rule: the browser never talks to Supabase for family data.**

RLS grants the `anon` role nothing at all. Public read and write flow through
Server Actions that hold the service-role key and validate the slug themselves —
because RLS cannot see a URL. Only the owner dashboard uses the user's JWT
directly through `@supabase/ssr`, gated by owner policies.

The consequence worth stating plainly: a leaked `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(public by definition — it ships in the JS bundle) exposes zero family data. The
slug is the only capability in the system.

---

## 2. Database schema

Postgres 15+ on Supabase. The migration is `supabase/migrations/0001_init.sql`;
this section explains it.

Creation order matters — `people` and `unions` reference each other, so the
`people.parent_union_id` foreign key is added after `unions` exists.

### 2.1 `families`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `slug` | `text` NOT NULL UNIQUE | The capability. See §3. |
| `name` | `text` NOT NULL | "Family Name" from the setup form |
| `description` | `text` NULL | |
| `cover_key` | `text` NULL | Storage object path, not a URL |
| `owner_id` | `uuid` NOT NULL | `auth.users(id)`, `on delete cascade` |
| `created_at` / `updated_at` | `timestamptz` NOT NULL | `updated_at` via trigger |

`slug` is UNIQUE, so its lookup index comes for free.

### 2.2 `people`

Maps 1:1 to the `Person` interface in `lib/types.ts`, plus tenancy, ordering,
and provenance.

| Column | Type | Maps to | Notes |
|---|---|---|---|
| `id` | `uuid` PK | `Person.id` (replaced) | |
| `family_id` | `uuid` NOT NULL | — | `on delete cascade` |
| `slug` | `text` NOT NULL | `Person.id` (preserved) | unique per family; feeds `?person=` |
| `name` | `text` NOT NULL | `Person.name` | trimmed, 1–120 chars |
| `birth_year` | `smallint` NOT NULL | `Person.birthYear` | |
| `death_year` | `smallint` NULL | `Person.deathYear` | NULL = living |
| `bio` | `text` NULL | `Person.bio` | `''` coerced to NULL, as the form does today |
| `gender` | `text` NULL | `Person.gender` | `check (gender in ('male','female'))`; NULL = unknown |
| `photo_key` | `text` NULL | `Person.photoUrl` (replaced) | Storage object path; NULL → initials |
| `parent_union_id` | `uuid` NULL | `Union.children[]` (inverted) | the union this person is a child of |
| `sibling_order` | `int` NOT NULL | `Union.children[]` order | left→right render order |
| `created_by` | `uuid` NULL | — | NULL = anonymous editor |
| `created_at` / `updated_at` | `timestamptz` | — | |

**Why `birth_year between 1200 and 2200` and not "≤ current year".** Postgres
CHECK constraints must be IMMUTABLE, and `extract(year from now())` is only
STABLE — a `birth_year <= current year` check is rejected at DDL time. The
"not in the future" rule stays where it already lives, in `validate()` in
`AddPersonPanel.tsx`, and is re-run server-side. The DB check is the outer
sanity rail only.

**Why `gender` is a CHECK and not a Postgres enum.** Widening a CHECK is a
one-line `alter table … drop constraint … add constraint`. Widening an enum is a
migration with its own failure modes, and this column will very likely need a
third value one day. NULL carries `undefined` from the TS type — unknown, not
unstated-as-a-third-gender.

**Why `parent_union_id` on `people` instead of a `union_children` join table.**
A person has at most one set of parents, so the foreign key *is* the
relationship. One column beats a join table plus a uniqueness constraint plus an
extra query on every read. `sibling_order` carries what the `children[]` array
order carried.

### 2.3 `unions`

`partner_a` / `partner_b` are ordinal, not roles — they preserve the left/right
render order that `Union.partners: [string, string]` encodes today. **Do not
reorder them on write.**

`partner_b` is nullable so a single parent can head a line. `applyAddPerson`'s
spouse branch always fills both, so today's UI never produces one; the column
costs nothing now and removes a migration later.

Three constraints carry real weight:

```sql
-- A partner must belong to the same family as the union.
constraint unions_partner_a_fk foreign key (partner_a, family_id)
  references public.people (id, family_id) on delete cascade
```

That composite foreign key — paired with `unique (id, family_id)` on `people` —
makes cross-family contamination structurally impossible without writing a
single trigger. The same trick pins `people.parent_union_id` to its family.

```sql
-- One union per unordered pair.
create unique index unions_pair_uniq on public.unions (
  family_id,
  least(partner_a, coalesce(partner_b, partner_a)),
  greatest(partner_a, coalesce(partner_b, partner_a))
);
```

`coalesce` is needed because `least(x, NULL)` is NULL, and NULLs do not conflict
in a unique index — without it, single-parent unions would deduplicate to
nothing.

### 2.4 Cycle guard

An untrusted public editor can otherwise make someone their own ancestor, which
sends `layoutTree`'s recursion into a loop and 500s the whole family page. This
is the one hand-written trigger worth having.

```sql
create trigger people_no_cycle
  before insert or update of parent_union_id on public.people
  for each row execute function public.assert_no_ancestor_cycle();
```

The function walks up the parent chain, depth-capped at 200, and raises if the
row being written appears as a partner in any union along the way.

> `ponytail:` it follows `partner_a`'s line only. Upgrade to a recursive CTE
> over both partners if a missed cycle is ever reported.

### 2.5 `person_edits` — the audit log

Every mutation, from every actor, structured so the owner can review and revert.

| Column | Notes |
|---|---|
| `family_id` | scope. **No foreign key** — see below |
| `entity` | `person` / `union` / `family` |
| `entity_id` | likewise no foreign key — the row must survive deletion of its subject |
| `action` | `insert` / `update` / `delete` / `revert` |
| `before` / `after` | `jsonb` row snapshots |
| `actor_id` | `auth.users(id)`; **NULL = anonymous slug holder** |
| `actor_hash` | `sha256(ip ‖ user_agent ‖ EDIT_ACTOR_SALT)` |
| `reverted_at` | set when a later revert undoes this entry |

**Neither id column has a foreign key.** On `family_id` this is not just
preference: a family delete cascades the parent row away *before* its children
delete, so an FK there would make the audit insert fired by those child deletes
fail and block deletion outright. Purging a family means deleting its log rows
explicitly.

**Revert** = write `before` back over the row and log a second entry with
`action = 'revert'`. History is never deleted.

**`actor_hash`, not an IP column.** It gives per-visitor attribution and rate
limiting without storing a raw IP address. Raw IPs are personal data under GDPR
and Indonesia's UU PDP, and there is nothing here a hash cannot do.

**Anonymous rate limiting reuses this table** rather than adding a throttle
table: count rows for `(family_id, actor_hash)` in the last hour, reject over
60. One query, no new schema. `person_edits_throttle_idx` covers it.

### 2.6 Audit is a trigger, not a caller responsibility

Writing the log row from the Server Action means every future code path has to
remember to do it — and the one that forgets is the one that corrupts data.
Instead, an `after insert or update or delete` trigger on `families`, `people`,
and `unions` writes it, reading the actor from transaction-local settings:

```sql
nullif(current_setting('app.actor_id', true), '')::uuid
```

This makes the audit atomic by construction (same transaction, no way to skip
it) and it degrades safely: a direct service-role write that never set the GUCs
is still logged, just with a NULL actor.

### 2.7 Write RPCs

PostgREST runs one RPC call in one transaction, so setting the actor and doing
the write must happen inside a **single** call. Two RPCs ship, matching the only
two write paths the UI has today:

```
app_add_person(p_family_id, p_slug, p_name, p_birth_year, p_death_year, p_bio,
               p_gender, p_photo_key, p_rel_kind, p_rel_target,
               p_actor_id, p_actor_hash)
app_update_person(p_person_id, p_name, p_birth_year, p_death_year, p_bio,
                  p_gender, p_photo_key, p_actor_id, p_actor_hash)
```

`p_rel_kind` mirrors the `Relation` union type in `lib/family.tsx`, plus a
`root` case for the family wizard:

| `p_rel_kind` | `p_rel_target` | Effect |
|---|---|---|
| `root` | NULL | Person with no parents and no spouse. Wizard only. |
| `child` | union id | `parent_union_id` set, `sibling_order` = max + 1 |
| `spouse` | person id | New union `(target, new person)` created |

`app_add_person` owns two things that must not race, both under `select … for
update`:

1. Computing `sibling_order` as `max + 1` within the target union.
2. Rejecting a `spouse` target who is already partnered.

Doing either check in JavaScript is a TOCTOU bug the moment two anonymous
editors act at once.

Execute is revoked from `public`, `anon`, and `authenticated` — only the service
role calls them. **Those `revoke` statements name full argument signatures**, so
adding a parameter to an RPC without updating its revoke is a silent hole: the
revoke matches no function, raises nothing, and the new overload stays callable
by `anon`. Change the two together, always. `delete` and `revert` RPCs follow the same shape and land in
phase 6 with the UI that needs them.

---

## 3. The namespace slug

Format: `<name-slug>-<12-char nanoid>`

```
/f/keluarga-santoso-8fk2n4qp7wzx
```

- The readable prefix is cosmetic. **All entropy is the suffix** — 12 characters
  of a 36-symbol alphabet is roughly 62 bits, infeasible to guess and short
  enough to send over WhatsApp.
- Generated server-side only. Never derived from the family name alone.
- **Rotation**: `/f/[slug]/settings` regenerates the suffix and the old URL 404s
  immediately. This is the only revocation mechanism — say so in the settings
  copy, so the owner understands what sharing the link commits them to.

Two headers are mandatory on `/f/:path*`:

```ts
// next.config.ts
async headers() {
  return [{
    source: '/f/:path*',
    headers: [
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
    ],
  }]
}
```

Without `Referrer-Policy: no-referrer`, any outbound link a visitor clicks leaks
the secret URL to a third party in the `Referer` header. Without `X-Robots-Tag`,
one accidental public link puts the family in a search index.

---

## 4. Auth

Supabase Auth via `@supabase/ssr`. Four entry paths, all landing on one callback.

### How the forms are wired

`app/(auth)/` was finished markup with no `name` attributes and
`onSubmit={(e) => e.preventDefault()}` stubs. All of it is connected now:

- Every field carries a `name`, and both forms use `action={formAction}` with
  `useActionState`. This is the failure mode worth remembering: an input with no
  `name` yields an empty `FormData`, and Supabase answers "invalid credentials",
  which reads as a wrong password rather than a wiring bug. `signInWithPassword`
  checks for empty values first and says so.
- The login form has **three submit buttons** — sign in, magic link, reset — each
  carrying a different `intent`. One `loginAction` dispatches on it, so a single
  `useActionState` drives one message area instead of three competing states.
- `GoogleButton` is a real submit inside its own `<form action={signInWithGoogle}>`.
- Pending state comes from `useFormStatus` in child components, which is the only
  place it can be read. `primaryButtonClass` gained a `disabled:` variant, and
  errors render in `#c1694f` — the palette's terracotta, matching
  `AddPersonPanel`'s `text-accent`. A true red would have been a new colour.
- "Keep me signed in" is `defaultChecked` and inert: Supabase persists sessions
  anyway, so the checkbox reflects reality rather than pretending to toggle it.

| Flow | Call |
|---|---|
| Register | `signUp({ email, password, options: { data: { full_name } } })` → confirmation email |
| Password login | `signInWithPassword({ email, password })` |
| Magic link | `signInWithOtp({ email })` → `/auth/callback` |
| Google | `signInWithOAuth({ provider: 'google', options: { redirectTo } })` → `/auth/callback` |

### Register form: `name`, `email`, `password`

No confirm-password field.

`name` is stored as `raw_user_meta_data.full_name` on `auth.users` via
`signUp`'s `options.data` — the same key Google OAuth already populates, so both
paths land in one place and read back identically from
`user.user_metadata.full_name`. Validate 1–120 chars, trimmed, server-side; it
is user-supplied metadata, so escape it wherever it renders.

**No `profiles` table.** `families.owner_id` references `auth.users` directly
and the owner's name lives in user metadata. Add one the day a family has more
than one editor account, or the day the name needs to be queryable or joinable —
user metadata is not indexable.

### Supabase dashboard configuration

- **Enable "Confirm email."** Without it `signUp` returns a session immediately
  and the email-verification step in the flow is decorative.
- Site URL = the production origin. Redirect URLs must include
  `http://localhost:3000/auth/callback` and the Vercel preview wildcard.
- Google provider: client ID and secret from Google Cloud Console. The
  authorized redirect URI there is the **Supabase** callback
  (`https://<ref>.supabase.co/auth/v1/callback`), not the app's.

### Next.js 16 — where the Supabase docs are wrong

This is the section that will cost the most time if skipped.

1. **`middleware.ts` is now `proxy.ts`.** Next 16 renamed it; see
   `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`. Every
   Supabase SSR guide still says `middleware.ts`, and that file is **inert** in
   this version — it fails silently, which is the worst failure mode. Export
   `proxy` (named or default) from `proxy.ts` at the repo root.
2. **`cookies()` is async** — `const cookieStore = await cookies()`.
3. **`params` is a Promise** — `const { slug } = await params`.

```ts
// proxy.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options))
        },
      },
    },
  )

  // Refreshes the session cookie. Read-only — no database calls here:
  // proxy runs on prefetches too.
  const { data } = await supabase.auth.getClaims()

  if (!data && request.nextUrl.pathname.startsWith('/app')) {
    return NextResponse.redirect(new URL('/login', request.nextUrl))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

The redirect above is an *optimistic* check, in the sense the Next.js auth guide
uses: cheap, cookie-only, and not a security boundary. Real authorization lives
in the Server Actions.

---

## 5. Routes

| Route | Access | Purpose |
|---|---|---|
| `/` | public | The demo tree, seeded from `lib/data.ts`. No slug, so edits live in React state and vanish on reload. |
| `/login` | public | Password, magic link, reset, and Google |
| `/register` | public | Name, email, password → confirmation email |
| `/auth/callback` | public | Route Handler: PKCE code → session |
| `/auth/confirm` | public | Email confirmation and recovery links (`verifyOtp`) |
| `/app` | owner | Families list, or the empty state |
| `/app/new` | owner | The wizard: family settings + first person |
| `/f/[slug]` | slug holder | The graph. View, add, edit. |
| `/f/[slug]/settings` | owner | Name, description, share link, rotate slug, edit log, revert |

**There is no landing page and no separate `/demo`** — `/` is the demo, which is
what the "link to a demo page" in the auth flow points at. Because nothing else
links to sign-in, the family-overview popover carries a "Sign in to build your
own" link when no slug is present.

`/app`'s empty state is step 3 of the product flow: Family Settings and Add
First Person, in one wizard. The first person is created with
`p_rel_kind = 'root'`; the root union appears when their spouse is added.

**`?person=<slug>` deep links are new.** An earlier draft of this document said
`FamilyTreeApp` already read that param on mount. It did not — nothing in the
app read `searchParams`, and `DetailPanel` had no share button. It is built now:
`app/f/[slug]/page.tsx` reads `searchParams` (a Promise in Next 16) and passes
`initialPersonSlug`, which the canvas hands to its existing `jumpTo` once the
layout contains that person. A `didDeepLink` ref makes it fire once, so a later
edit does not yank the view back.

### 5.1 Family overview, share, and edit profile

Three features that sound like they need backend work. Two of them do not.

#### Family overview — no database work

The popover in `Toolbar.tsx` renders a `FamilyStats`:

```ts
export interface FamilyStats {
  members: number;
  generations: number;
  male: number;
  female: number;
}
```

**Keep computing this client-side.** `FamilyTreeApp` already derives it from
`data.people` and `layout.positions`, and the family page loads every person in
the family regardless — a SQL aggregate would be a second round-trip for numbers
already sitting in memory. `generations` is `max(gen) + 1` over the *layout*, so
it is geometry, not data; SQL cannot produce it without reimplementing
`layoutTree`.

The only change: `familyName` stops being a `lib/data.ts` constant and arrives as
`families.name` on the same props as `initialData`. `male` / `female` count the
new `gender` column, and people with NULL gender fall out of both counts —
intentional, since the popover has no "unknown" row.

Revisit only if a family grows past a few thousand people, at which point the
whole read path needs pagination and this counter is the least of it.

#### Share family — one line of code, one line of copy

`shareFamily()` builds `window.location.origin + window.location.pathname`. Once
the canvas moves to `/f/[slug]`, that expression starts producing the right URL
on its own, with no change to the function.

What does need changing is the **copy**. The locked decision is *slug = view +
edit*: whoever holds this link can add and edit people. The share sheet currently
says `"${familyName} family tree"`, which reads as view-only. This is the single
moment a user decides who gets edit rights on their family, and it should say so
— `"Anyone with this link can view and edit the ${familyName} family tree"`.

No QR, no expiry, no per-recipient tokens. Revocation is `rotateSlug` (§3), and
the settings copy should say that too.

#### Edit profile — already specified

"Edit profile" in `DetailPanel` opens `AddPersonPanel` in edit mode against a
`Person`. It is `updatePerson` (§6) and nothing else. Fields are Photo, Full
name, Birth year, Death year, Gender, Bio — note that **relationship fields are
hidden in edit mode**, so `app_update_person` correctly takes no relation
parameters, and a person's parents or spouse cannot be changed once set.

There is no user-account settings surface anywhere in the app — no display-name,
avatar, password-change, or email-change screen. **Do not build one for this
spec.** The owner's name lives in `user_metadata` (§4) and nothing renders it
yet.

---

## 6. Mutations

All mutations are **Server Actions**, not Route Handlers. They are callable
directly from the existing client canvas, they get `revalidateTag` for free, and
it keeps the API surface to one file. The only Route Handler in the app is
`/auth/callback`.

`lib/actions/family.ts`:

```
addPerson(slug, draft)        → { person, union? }
updatePerson(slug, id, patch) → person
deletePerson(slug, id)        → void        (schema-ready; no UI yet)
updateFamily(slug, settings)  → family      (owner only)
rotateSlug(slug)              → newSlug     (owner only)
revertEdit(slug, editId)      → void        (owner only)
createPhotoUploadUrl(slug, contentType, bytes) → { url, token, path }
```

Every action runs the same preamble:

1. Look up `families` by slug with the service-role client → 404 if absent.
   **This is the authorization check.** There is no other one for public
   traffic.
2. Owner-only actions additionally require `auth.uid() === family.owner_id`.
3. Re-run the validation from `validate()` in `AddPersonPanel.tsx` server-side:
   name non-empty, `birth_year` between 1200 and the current year, `death_year`
   ≤ current year and ≥ `birth_year`. Client validation is a UX affordance, not
   a boundary.
4. Anonymous rate-limit check against `person_edits` (§2.5).
5. Call the RPC (§2.7) rather than writing tables directly — that is what makes
   the mutation and its audit row one transaction, and the sibling-order and
   already-partnered checks race-free.
6. `revalidateTag('family:' + family.id)`.

```ts
'use server'

export async function addPerson(slug: string, draft: PersonDraft) {
  const db = serviceClient()

  const { data: family } = await db
    .from('families').select('id').eq('slug', slug).single()
  if (!family) notFound()                       // step 1

  assertValidPerson(draft)                      // step 3
  const actorHash = await hashActor()           // sha256(ip ‖ ua ‖ salt)
  await assertUnderRateLimit(db, family.id, actorHash)   // step 4

  const { data, error } = await db.rpc('app_add_person', {  // step 5
    p_family_id: family.id,
    p_slug: uniqueSlug(draft.name),
    p_name: draft.name.trim(),
    p_birth_year: draft.birthYear,
    p_death_year: draft.deathYear ?? null,
    p_bio: draft.bio ?? null,
    p_gender: draft.gender ?? null,
    p_photo_key: draft.photoKey ?? null,
    p_rel_kind: draft.relation.kind,
    p_rel_target: relTargetId(draft.relation),
    p_actor_id: (await currentUserId()) ?? null,
    p_actor_hash: actorHash,
  })
  if (error) throw mapPgError(error)

  revalidateTag(`family:${family.id}`)          // step 6
  return data
}
```

### Preserving the layout invariants

The schema deliberately allows what `lib/layout.ts` cannot render, so the write
paths hold the line:

- **One union per person** — a `spouse` relation must reject a target who is
  already a partner. `unmarriedPeople()` in `lib/family.tsx` already filters the
  dropdown; `app_add_person` re-checks it inside the transaction.
- **Exactly one root union** — structurally safe. After the wizard, every write
  is either "child of an existing union" or "spouse of an existing person", and
  neither can produce a second root. The wizard is the only path that creates a
  rootless person, and it runs once per family.

The day the layout becomes a DAG, both guards are deleted. No migration.

### Reads

`app/f/[slug]/page.tsx` is a Server Component doing two selects, assembled into
the exact shapes `FamilyTreeApp` already consumes by a new `lib/mappers.ts`:

```sql
select * from people where family_id = $1 order by sibling_order, created_at;
select * from unions where family_id = $1;
```

- `Person.photoUrl` = a signed Storage URL, minted for the whole page in one
  batched call (§7). NULL `photo_key` → `undefined` → initials.
- `Person.gender` = `gender`, NULL → `undefined`
- `Union.partners` = `[partner_a, partner_b]`, order preserved
- `Union.children` = people grouped by `parent_union_id`, ordered by
  `sibling_order`

`FamilyTreeApp` takes `initialData`, `familyName`, and an optional `familySlug`
as props instead of importing `lib/data`. When `familySlug` is absent it runs
the local reducers exactly as before — that is what keeps the demo tree on `/`
alive on one component. `applyAddPerson` and `applyUpdatePerson` keep their
signatures, so the `npx tsx lib/family.tsx` self-check still passes.

The context turns **async** (`addPerson` returns `Promise<Person>`), because a
Server Action cannot satisfy the synchronous `onSaved(addPerson(draft).id)` that
`AddPersonPanel` relied on. Each action returns the family's **whole**
`FamilyData`, so the canvas swaps one `useState` value with no merge logic and
no id reconciliation. `AddPersonPanel` gains a pending flag; nothing prevented a
double submit before, and a doubled submit is a duplicate person.

`Canvas.tsx`, `PersonCard.tsx`, `DetailPanel.tsx`, and `Panel.tsx` are untouched.

**`lib/layout.ts` is not.** An earlier draft claimed it was. `layoutTree` threw
`"no root union found"` whenever `unions` was empty, and the family wizard
produces exactly that — one person, no union — so every newly created family
500'd on its first page load. It now throws only when a non-empty union set has
no root, places people the root subtree never reached, and returns zeroed
`bounds` for an empty family instead of `Infinity`. The self-check covers all
three cases.

---

## 7. Supabase Storage

One **private** bucket, `family-media`, holding person photos and family cover
images. No second vendor, no extra credentials, no `@aws-sdk/*` dependency —
Storage reuses the Supabase URL and service-role key the app already has.

### Bucket configuration

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'family-media', 'family-media', false,
  5242880,                                        -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
);
```

`file_size_limit` and `allowed_mime_types` are enforced **by Storage itself**, on
the bytes as received. This is a real gain over a presigned-PUT design, where the
same two limits could only be pinned into a signature and believed — a client
that lied about its content type got in. Here it does not, so the app-side checks
in `createPhotoUploadUrl` become a fast-fail courtesy rather than the boundary.

RLS on `storage.objects` follows the same posture as the data tables: **`anon`
gets no policies.** Every read and write is service-role, brokered by a Server
Action that has already validated the slug.

### Upload

This replaces the `FileReader.readAsDataURL` path in `AddPersonPanel.tsx`.

1. Client picks a file → calls `createPhotoUploadUrl(slug, file.type, file.size)`.
2. The action validates the slug, the MIME type, `size ≤ 5 MB`, and the anon rate
   limit, then mints a one-shot upload token for a path it chooses.
3. Client uploads **straight to Storage**. The bytes never pass through Vercel,
   so the 4.5 MB Server Action body limit stays irrelevant.
4. Client submits the form with the path; `addPerson` / `updatePerson` writes
   `photo_key`.

```ts
// server — service role
const { data, error } = await supabase
  .storage.from('family-media')
  .createSignedUploadUrl(path)          // { signedUrl, token, path }

// client
await supabase.storage.from('family-media')
  .uploadToSignedUrl(path, token, file)
```

The token is single-use and scoped to that exact path, so a leaked one cannot be
replayed to overwrite a different object.

### Read — signed URLs, batched

The bucket is private, so every render mints short-lived signed URLs. Use the
**plural** form, once per page:

```ts
const { data } = await supabase
  .storage.from('family-media')
  .createSignedUrls(paths, 3600)        // one call, not one per person
```

`createSignedUrl` (singular) in a `.map()` over a 200-person family is 200 round
trips on every page load. The plural form is one.

Say the cost out loud, because it is the price of the private-bucket choice:

- **Signed URLs defeat CDN caching.** Each render produces different URLs, so
  browsers and edge caches treat every photo as a new object.
- **They expire.** One hour is long enough that a session rarely outlives it; a
  tab left open overnight will show broken images until reload. `DetailPanel`'s
  existing `onError` → initials fallback degrades that to "initials", not a
  broken-image icon, with no new code.

If either cost starts to hurt, the upgrade is a public bucket — the paths already
contain two UUIDs, so they are unguessable on their own.

### Paths

```
families/<family_id>/photos/<nanoid>.<ext>
families/<family_id>/cover/<nanoid>.<ext>
```

An earlier draft put `<person_id>` in the photo path. It cannot go there: the
photo is uploaded from the add form **before** the person row exists, so there
is no id to name it with. `photo_key` on the row is the only link needed, and
the family prefix still means purging a family is one prefix delete. Deleting a
single object is `storage.from('family-media').remove([path])`.

### `next.config.ts`

That file is still the empty create-next-app stub, so `next/image` will reject
Storage URLs until this lands:

```ts
images: {
  remotePatterns: [{
    protocol: 'https',
    hostname: '<ref>.supabase.co',
    pathname: '/storage/v1/object/sign/**',
  }],
}
```

### Deliberately not done

**Image transforms.** Supabase can resize on the fly (`?width=400`), which would
suit `PersonCard`'s small avatars, but it is a paid-plan feature. The spec
assumes free tier: originals are served, capped at 5 MB. If the project moves to
Pro, add `width`/`quality` to the card requests and leave the detail hero at full
size — it is a per-call option, not a migration.

**Orphan cleanup.** An upload URL that is minted and never submitted leaves an
unreferenced object. Add a weekly Vercel Cron reconciling Storage paths against
`photo_key` and `cover_key` when storage cost becomes visible — not before.

### Environment variables

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Also the Storage host |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Public by design; grants nothing (§8) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Bypasses RLS and signs Storage URLs. Never `NEXT_PUBLIC_`. Vercel: Production + Preview only. |
| `EDIT_ACTOR_SALT` | server only | Random 32 bytes. Rotating it just resets rate-limit buckets. |

Four variables, down from nine. That is the clearest argument for the swap.

---

## 8. Row Level Security

RLS is enabled on all four tables. **The `anon` role gets no policies at all** —
default-deny. Public traffic never reaches Postgres except through a
service-role Server Action that has already checked the slug, because RLS cannot
see a URL.

Policies exist only for `authenticated`, covering the owner dashboard:

```sql
create policy people_owner_all on public.people
  for all to authenticated
  using (public.is_family_owner(family_id))
  with check (public.is_family_owner(family_id));
```

Two details in `is_family_owner` are not stylistic:

- **`(select auth.uid())`, not bare `auth.uid()`.** The subquery form is
  evaluated once as an InitPlan instead of once per row. This starts mattering
  as soon as a family has a few hundred people.
- **`security definer` with `set search_path = ''`.** A mutable search_path on a
  definer function is a privilege-escalation path. The empty search_path is why
  every reference inside is schema-qualified.

`person_edits` gets `select` only — history is append-only from the app's
perspective, and reverts write new rows rather than editing old ones.

---

## 9. Build order

| Phase | Ships |
|---|---|
| 0 | `0001_init.sql` tables/triggers/RPCs/RLS, `0002_storage.sql` bucket, `0003_admin_rpcs.sql` delete + revert |
| 1 | `@supabase/ssr` clients, `proxy.ts`, **wire the existing** `/login` + `/register` (add `name` attrs, handlers, magic-link entry point), `/auth/callback`, `/auth/confirm` |
| 2 | `/app` empty state + family wizard, slug generation |
| 3 | `/f/[slug]` read path: `lib/mappers.ts`, `FamilyTreeApp` takes props, `?person=` deep links, `familyName` + `FamilyStats` fed from the DB |
| 4 | Server Actions for add/update, audit wiring, anon rate limit |
| 5 | `family-media` bucket, signed upload + batched signed reads, `AddPersonPanel` upload rewrite, cover image, `next.config.ts` |
| 6 | `/f/[slug]/settings`: edit log, revert, rotate slug, share-sheet copy (§5.1) |

Phase 1 edits `app/(auth)/**`; phases 3 and 5 touch the canvas components.
Everything else is new files.

---

## 10. Verification

### Schema (phase 0)

The migration must apply cleanly to a fresh local database. Then, in a SQL
console:

- Two families; make a union whose `partner_a` belongs to the other family →
  must fail on `unions_partner_a_fk`.
- A person who is a partner in union U; set their `parent_union_id` to U →
  must fail with `ancestor cycle`.
- Insert the same partner pair in reverse order → must fail on
  `unions_pair_uniq`.
- `birth_year = 1100` → must fail the range check.
- `death_year < birth_year` → must fail `people_death_after_birth`.
- `gender = 'other'` → must fail the CHECK; `gender = null` must be accepted.
  Then round-trip a person through `app_add_person` and `app_update_person` and
  confirm `gender` survives both — a parameter missing from the `update … set`
  list fails silently, which is exactly how the edit-profile path would lose it.
- `set role anon; select * from people;` → **0 rows**, no error. Same as an
  authenticated non-owner.
- A bare `update people set bio = 'x'` with no `set_config` → still produces a
  `person_edits` row, with `actor_id IS NULL` and `before.bio` holding the old
  value.
- Two concurrent `app_add_person` calls adding children to the same union → two
  distinct `sibling_order` values, not a duplicate.
- `delete from families where id = …` on a family with people and unions →
  succeeds, and its `person_edits` rows are still there afterwards. This is the
  case the missing foreign key exists for; if it errors, the FK is back.

### Layout compatibility (phase 3)

Port the 14 seed people and 4 unions from `lib/data.ts` into the database, load
`/f/<slug>`, and confirm the rendered tree is identical to the demo at `/`.
`lib/layout.ts` already carries an argv-guarded self-check asserting no card
overlap (`npx tsx lib/layout.ts`) — run it against DB-sourced data too.

### Auth (phase 1)

All four flows must end with a session cookie and a redirect to `/app`:
password (after clicking the confirmation email), magic link, Google, and the
already-signed-in case. Verify `proxy.ts` actually runs — a `console.log` that
never appears means the file is still named `middleware.ts`.

Because the forms started as markup, check the boring thing first: submit login
with valid credentials and confirm the action **receives non-empty values**. An
input with no `name` attribute yields an empty `FormData` and an auth error that
looks like wrong credentials.

### Write path (phase 4)

From a private window holding only the slug: add a child, add a spouse, edit a
bio. Each produces a `person_edits` row with `actor_id IS NULL` and a populated
`actor_hash`. Then:

- Add a spouse to someone already partnered → rejected with a field error, not
  a 500.
- Fire 70 writes in a loop → the last ten are rate-limited.

### Photos (phase 5)

The point of these checks is that Storage enforces the limits, not the app — so
test them by going around the app.

- 6 MB file → rejected. Then upload the same file **straight to a signed upload
  URL**, bypassing `createPhotoUploadUrl`'s own size check: Storage must still
  reject it on `file_size_limit`.
- `.txt` renamed to `.jpg` with `Content-Type: image/jpeg` → Storage rejects it
  on `allowed_mime_types`.
- Valid JPEG → lands under `families/<family_id>/people/…`, renders in
  `DetailPanel`, and the row stores a path, not a data URL.
- Mint a signed read URL with a 5-second expiry, wait, then load it → the image
  fails and `DetailPanel` shows initials rather than a broken-image icon.
- A 14-person family page → **one** `createSignedUrls` call in the network log,
  not 14.

### Secrecy (phase 3+)

- `curl -I /f/<slug>` shows `X-Robots-Tag: noindex, nofollow` and
  `Referrer-Policy: no-referrer`.
- After `rotateSlug`, the old URL returns 404.
