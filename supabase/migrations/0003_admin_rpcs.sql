-- Owner-only RPCs backing /f/[slug]/settings: delete a person, revert an edit.
-- Same shape as the write RPCs in 0001: set the actor, then mutate, so the
-- audit trigger records who did it, all in one PostgREST transaction.

create or replace function public.app_delete_person(
  p_person_id  uuid,
  p_actor_id   uuid default null,
  p_actor_hash text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.app_set_actor(p_actor_id, p_actor_hash);

  -- Unions referencing this person cascade via unions_partner_*_fk, and any
  -- children of those unions have parent_union_id set to null rather than
  -- being deleted — losing a grandparent must not delete the grandchildren.
  delete from public.people where id = p_person_id;

  if not found then
    raise exception 'person % not found', p_person_id
      using errcode = 'no_data_found';
  end if;
end;
$$;

/*
 * Revert one audit entry by writing its `before` snapshot back over the row.
 *
 * Only people and unions are revertible: `families` rows carry the slug, and
 * silently restoring an old slug through the edit log would resurrect a URL the
 * owner deliberately rotated away.
 */
create or replace function public.app_revert_edit(
  p_edit_id    bigint,
  p_actor_id   uuid default null,
  p_actor_hash text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_edit public.person_edits;
begin
  perform public.app_set_actor(p_actor_id, p_actor_hash);

  select * into v_edit from public.person_edits where id = p_edit_id for update;
  if not found then
    raise exception 'edit % not found', p_edit_id using errcode = 'no_data_found';
  end if;
  if v_edit.reverted_at is not null then
    raise exception 'edit % is already reverted', p_edit_id using errcode = 'invalid_parameter_value';
  end if;
  if v_edit.entity not in ('person', 'union') then
    raise exception 'only person and union edits can be reverted'
      using errcode = 'invalid_parameter_value';
  end if;

  if v_edit.action = 'insert' then
    -- undo a create by deleting the row it made
    if v_edit.entity = 'person' then
      delete from public.people where id = v_edit.entity_id;
    else
      delete from public.unions where id = v_edit.entity_id;
    end if;

  elsif v_edit.action = 'delete' then
    -- undo a delete by re-inserting the snapshot
    if v_edit.entity = 'person' then
      insert into public.people select * from jsonb_populate_record(null::public.people, v_edit.before);
    else
      insert into public.unions select * from jsonb_populate_record(null::public.unions, v_edit.before);
    end if;

  elsif v_edit.action = 'update' then
    if v_edit.entity = 'person' then
      update public.people p
         set name            = b.name,
             birth_year      = b.birth_year,
             death_year      = b.death_year,
             bio             = b.bio,
             gender          = b.gender,
             photo_key       = b.photo_key,
             parent_union_id = b.parent_union_id,
             sibling_order   = b.sibling_order
        from jsonb_populate_record(null::public.people, v_edit.before) b
       where p.id = v_edit.entity_id;
    else
      update public.unions u
         set partner_a    = b.partner_a,
             partner_b    = b.partner_b,
             married_year = b.married_year
        from jsonb_populate_record(null::public.unions, v_edit.before) b
       where u.id = v_edit.entity_id;
    end if;

  else
    raise exception 'cannot revert a % entry', v_edit.action
      using errcode = 'invalid_parameter_value';
  end if;

  -- History is append-only: mark the entry, never delete it. The write above
  -- fired the audit trigger, so the revert itself is recorded too.
  update public.person_edits set reverted_at = now() where id = p_edit_id;
end;
$$;

-- Service role only, same as the 0001 RPCs. These signatures must be kept in
-- step with the argument lists above — a revoke that matches no function
-- raises nothing and silently leaves the overload callable by anon.
revoke execute on function public.app_delete_person(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.app_revert_edit(bigint, uuid, text) from public, anon, authenticated;
