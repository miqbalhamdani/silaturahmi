-- silaturahmi — initial schema
-- Family tree with owner accounts and unguessable public namespace URLs.
--
-- Read docs/supabase-integration.md for the reasoning behind each decision.
--
-- Creation order matters: people and unions reference each other, so the
-- people -> unions FK is added after unions exists.

-- ---------------------------------------------------------------------------
-- 1. families
-- ---------------------------------------------------------------------------

create table public.families (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null check (length(trim(name)) between 1 and 120),
  description text check (length(description) <= 2000),
  cover_key   text,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index families_owner_id_idx on public.families (owner_id);

comment on column public.families.slug is
  'Namespace URL segment. Holding it grants view AND edit. Rotate to revoke.';
comment on column public.families.cover_key is
  'Supabase Storage object path in the private family-media bucket, not a URL. '
  'Serve via createSignedUrl.';

-- ---------------------------------------------------------------------------
-- 2. people
-- ---------------------------------------------------------------------------
-- Mirrors the Person interface in lib/types.ts. birth_year / death_year are
-- years, not dates, because that is all the UI captures.

create table public.people (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families(id) on delete cascade,
  slug            text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name            text not null check (length(trim(name)) between 1 and 120),
  birth_year      smallint not null check (birth_year between 1200 and 2200),
  death_year      smallint check (death_year between 1200 and 2200),
  bio             text check (length(bio) <= 4000),
  gender          text check (gender in ('male', 'female')),
  photo_key       text,
  parent_union_id uuid,                      -- FK added in section 3
  sibling_order   int not null default 0,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint people_slug_unique unique (family_id, slug),
  constraint people_death_after_birth
    check (death_year is null or death_year >= birth_year)
);

create index people_family_id_idx on public.people (family_id);
create index people_parent_union_idx on public.people (parent_union_id);

-- Target for the composite FKs that pin rows to a single family.
alter table public.people
  add constraint people_id_family_key unique (id, family_id);

comment on column public.people.slug is
  'Name-derived, unique per family. Feeds the ?person= share link.';
comment on column public.people.death_year is 'NULL = living.';
comment on column public.people.gender is
  'NULL = unknown, matching `gender?: "male" | "female"` in lib/types.ts. A CHECK '
  'rather than an enum: widening a CHECK is a one-line alter, widening an enum is not.';
comment on column public.people.photo_key is
  'Supabase Storage object path in the private family-media bucket. NULL renders '
  'initials, per the existing onError fallback in DetailPanel.tsx.';
comment on column public.people.parent_union_id is
  'The union this person is a child of. NULL = no recorded parents.';
comment on column public.people.sibling_order is
  'Left-to-right render order among siblings.';
comment on column public.people.created_by is 'NULL = created anonymously via the slug.';

-- The "not in the future" rule cannot live in a CHECK constraint: those must be
-- IMMUTABLE and extract(year from now()) is only STABLE. It is enforced in
-- validate() in components/AddPersonPanel.tsx and re-checked server-side.

-- ---------------------------------------------------------------------------
-- 3. unions
-- ---------------------------------------------------------------------------
-- partner_a / partner_b are ordinal, not roles: they preserve the left/right
-- render order that Union.partners: [string, string] encodes today.

create table public.unions (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families(id) on delete cascade,
  partner_a    uuid not null,
  partner_b    uuid,                          -- nullable: single-parent lines
  married_year smallint check (married_year between 1200 and 2200),
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint unions_distinct_partners
    check (partner_b is null or partner_a <> partner_b),
  -- Composite FKs: a partner must belong to the same family as the union.
  -- This makes cross-family contamination structurally impossible.
  constraint unions_partner_a_fk foreign key (partner_a, family_id)
    references public.people (id, family_id) on delete cascade,
  constraint unions_partner_b_fk foreign key (partner_b, family_id)
    references public.people (id, family_id) on delete cascade
);

create index unions_family_id_idx on public.unions (family_id);
create index unions_partner_a_idx on public.unions (partner_a);
create index unions_partner_b_idx on public.unions (partner_b);

alter table public.unions
  add constraint unions_id_family_key unique (id, family_id);

-- One union per unordered pair.
create unique index unions_pair_uniq on public.unions (
  family_id,
  least(partner_a, coalesce(partner_b, partner_a)),
  greatest(partner_a, coalesce(partner_b, partner_a))
);

-- Close the people -> unions cycle, same-family enforced.
alter table public.people
  add constraint people_parent_union_fk
  foreign key (parent_union_id, family_id)
  references public.unions (id, family_id) on delete set null;

-- ---------------------------------------------------------------------------
-- 4. person_edits — audit log
-- ---------------------------------------------------------------------------

create table public.person_edits (
  id          bigint generated always as identity primary key,
  -- No FK on family_id, deliberately. A family delete cascades the parent row
  -- away before its children delete, so an FK here would make the audit insert
  -- fired by those child deletes fail and block deletion outright. The log is
  -- meant to outlive its subject; delete it explicitly when purging a family.
  family_id   uuid not null,
  entity      text not null check (entity in ('person', 'union', 'family')),
  entity_id   uuid,                    -- likewise no FK: survives deletion
  action      text not null check (action in ('insert', 'update', 'delete', 'revert')),
  before      jsonb,                   -- NULL on insert
  after       jsonb,                   -- NULL on delete
  actor_id    uuid references auth.users(id) on delete set null,
  actor_hash  text,
  reverted_at timestamptz,
  created_at  timestamptz not null default now()
);

create index person_edits_family_created_idx
  on public.person_edits (family_id, created_at desc);
create index person_edits_throttle_idx
  on public.person_edits (family_id, actor_hash, created_at desc);

comment on column public.person_edits.actor_id is 'NULL = anonymous slug holder.';
comment on column public.person_edits.actor_hash is
  'sha256(ip || user_agent || EDIT_ACTOR_SALT). Attribution and rate limiting '
  'without storing a raw IP.';

-- ---------------------------------------------------------------------------
-- 5. Triggers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger families_touch before update on public.families
  for each row execute function public.touch_updated_at();
create trigger people_touch before update on public.people
  for each row execute function public.touch_updated_at();
create trigger unions_touch before update on public.unions
  for each row execute function public.touch_updated_at();

-- Cycle guard -----------------------------------------------------------------
-- Without this, a public editor can make someone their own ancestor, which
-- sends layoutTree()'s recursion in lib/layout.ts into a loop and 500s the
-- whole family page.
--
-- ponytail: walks partner_a's line only, depth-capped at 200. Upgrade to a
-- recursive CTE over both partners if a missed cycle is ever reported.

create or replace function public.assert_no_ancestor_cycle()
returns trigger
language plpgsql
as $$
declare
  cur   uuid;
  depth int := 0;
begin
  if new.parent_union_id is null then
    return new;
  end if;

  cur := new.parent_union_id;

  while cur is not null and depth < 200 loop
    if exists (
      select 1 from public.unions u
       where u.id = cur
         and new.id in (u.partner_a, u.partner_b)
    ) then
      raise exception 'ancestor cycle: person % would be their own ancestor', new.id
        using errcode = 'check_violation';
    end if;

    select p.parent_union_id
      into cur
      from public.unions u
      join public.people p on p.id = u.partner_a
     where u.id = cur;

    depth := depth + 1;
  end loop;

  return new;
end;
$$;

create trigger people_no_cycle
  before insert or update of parent_union_id on public.people
  for each row execute function public.assert_no_ancestor_cycle();

-- Audit -----------------------------------------------------------------------
-- Attached to the tables rather than called from the app, so no write path can
-- forget to log. Actor comes from transaction-local settings that the app_*
-- RPCs below populate; a direct service-role write is still logged, just with a
-- NULL actor.

create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after  jsonb;
  v_row    jsonb;
begin
  -- NEW is unassigned on DELETE and OLD is unassigned on INSERT: touching a
  -- field of either raises "record is not assigned yet". Branch, never coalesce.
  if tg_op = 'DELETE' then
    v_before := to_jsonb(old);
  elsif tg_op = 'INSERT' then
    v_after := to_jsonb(new);
  else
    v_before := to_jsonb(old);
    v_after  := to_jsonb(new);
  end if;

  v_row := coalesce(v_after, v_before);

  insert into public.person_edits (
    family_id, entity, entity_id, action, before, after, actor_id, actor_hash
  )
  values (
    (case tg_argv[0]
       when 'family' then v_row ->> 'id'
       else v_row ->> 'family_id'
     end)::uuid,
    tg_argv[0],
    (v_row ->> 'id')::uuid,
    lower(tg_op),
    v_before,
    v_after,
    nullif(current_setting('app.actor_id', true), '')::uuid,
    nullif(current_setting('app.actor_hash', true), '')
  );
  return null;
end;
$$;

create trigger families_audit after insert or update or delete on public.families
  for each row execute function public.audit_row('family');
create trigger people_audit after insert or update or delete on public.people
  for each row execute function public.audit_row('person');
create trigger unions_audit after insert or update or delete on public.unions
  for each row execute function public.audit_row('union');

-- ---------------------------------------------------------------------------
-- 6. Write RPCs
-- ---------------------------------------------------------------------------
-- PostgREST runs one RPC call in one transaction, so setting the actor and
-- doing the write must happen in a single call. These also own the checks that
-- must not race under concurrent anonymous editors.

create or replace function public.app_set_actor(p_actor_id uuid, p_actor_hash text)
returns void
language sql
as $$
  select
    set_config('app.actor_id',   coalesce(p_actor_id::text, ''), true),
    set_config('app.actor_hash', coalesce(p_actor_hash,     ''), true);
  select null::void;
$$;

-- p_rel_kind: 'root'   -> no parents, no spouse (family wizard only)
--             'child'  -> p_rel_target is a union id
--             'spouse' -> p_rel_target is a person id; a new union is created
create or replace function public.app_add_person(
  p_family_id  uuid,
  p_slug       text,
  p_name       text,
  p_birth_year smallint,
  p_death_year smallint,
  p_bio        text,
  p_gender     text,
  p_photo_key  text,
  p_rel_kind   text,
  p_rel_target uuid,
  p_actor_id   uuid   default null,
  p_actor_hash text   default null
)
returns public.people
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_person public.people;
  v_order  int := 0;
  v_parent uuid := null;
begin
  perform public.app_set_actor(p_actor_id, p_actor_hash);

  if p_rel_kind not in ('root', 'child', 'spouse') then
    raise exception 'unknown relation kind: %', p_rel_kind
      using errcode = 'invalid_parameter_value';
  end if;

  if p_rel_kind = 'child' then
    -- Lock the union so two concurrent adds cannot claim the same slot.
    perform 1 from public.unions
      where id = p_rel_target and family_id = p_family_id
      for update;
    if not found then
      raise exception 'union % not found in family %', p_rel_target, p_family_id
        using errcode = 'foreign_key_violation';
    end if;

    select coalesce(max(sibling_order) + 1, 0)
      into v_order
      from public.people
     where parent_union_id = p_rel_target;

    v_parent := p_rel_target;

  elsif p_rel_kind = 'spouse' then
    perform 1 from public.people
      where id = p_rel_target and family_id = p_family_id
      for update;
    if not found then
      raise exception 'person % not found in family %', p_rel_target, p_family_id
        using errcode = 'foreign_key_violation';
    end if;

    -- Layout invariant: lib/layout.ts cannot render a person in two unions.
    -- Checked here rather than in JS to close the TOCTOU window.
    if exists (
      select 1 from public.unions
       where p_rel_target in (partner_a, partner_b)
    ) then
      raise exception 'person % is already a partner in a union', p_rel_target
        using errcode = 'unique_violation';
    end if;
  end if;

  insert into public.people (
    family_id, slug, name, birth_year, death_year, bio, gender, photo_key,
    parent_union_id, sibling_order, created_by
  )
  values (
    p_family_id, p_slug, p_name, p_birth_year, p_death_year,
    nullif(btrim(p_bio), ''), nullif(p_gender, ''), p_photo_key,
    v_parent, v_order, p_actor_id
  )
  returning * into v_person;

  if p_rel_kind = 'spouse' then
    insert into public.unions (family_id, partner_a, partner_b, created_by)
    values (p_family_id, p_rel_target, v_person.id, p_actor_id);
  end if;

  return v_person;
end;
$$;

create or replace function public.app_update_person(
  p_person_id  uuid,
  p_name       text,
  p_birth_year smallint,
  p_death_year smallint,
  p_bio        text,
  p_gender     text,
  p_photo_key  text,
  p_actor_id   uuid default null,
  p_actor_hash text default null
)
returns public.people
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_person public.people;
begin
  perform public.app_set_actor(p_actor_id, p_actor_hash);

  update public.people
     set name       = p_name,
         birth_year = p_birth_year,
         death_year = p_death_year,
         bio        = nullif(btrim(p_bio), ''),
         gender     = nullif(p_gender, ''),
         photo_key  = p_photo_key
   where id = p_person_id
  returning * into v_person;

  if not found then
    raise exception 'person % not found', p_person_id
      using errcode = 'no_data_found';
  end if;

  return v_person;
end;
$$;

-- Only the server (service role) may call these. Anonymous traffic reaches them
-- through a Server Action that has already validated the family slug.
revoke execute on function public.app_set_actor(uuid, text) from public, anon, authenticated;
revoke execute on function public.app_add_person(uuid, text, text, smallint, smallint, text, text, text, text, uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.app_update_person(uuid, text, smallint, smallint, text, text, text, uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Row Level Security
-- ---------------------------------------------------------------------------
-- The anon role gets no policies at all: default-deny. Public traffic never
-- reaches Postgres except through a service-role Server Action that has already
-- checked the slug, because RLS cannot see a URL.
--
-- A leaked NEXT_PUBLIC_SUPABASE_ANON_KEY therefore exposes zero family data.

alter table public.families     enable row level security;
alter table public.people       enable row level security;
alter table public.unions       enable row level security;
alter table public.person_edits enable row level security;

-- security definer + an empty search_path is mandatory: a mutable search_path
-- on a definer function is a privilege-escalation path.
create or replace function public.is_family_owner(fid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.families f
     where f.id = fid
       and f.owner_id = (select auth.uid())
  );
$$;

-- (select auth.uid()) rather than bare auth.uid(): the subquery form is
-- evaluated once as an InitPlan instead of once per row.

create policy families_owner_all on public.families
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy people_owner_all on public.people
  for all to authenticated
  using (public.is_family_owner(family_id))
  with check (public.is_family_owner(family_id));

create policy unions_owner_all on public.unions
  for all to authenticated
  using (public.is_family_owner(family_id))
  with check (public.is_family_owner(family_id));

-- History is append-only from the app's perspective; reverts write new rows.
create policy person_edits_owner_read on public.person_edits
  for select to authenticated
  using (public.is_family_owner(family_id));
