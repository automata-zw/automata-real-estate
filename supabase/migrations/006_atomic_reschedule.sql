create or replace function reschedule_viewing_atomic(
    p_agency_id uuid,
    p_viewing_id uuid,
    p_new_scheduled_start timestamptz,
    p_new_scheduled_end timestamptz,
    p_notes text default null
)
returns setof viewings
language plpgsql
as $$
declare
    v_original viewings%rowtype;
    v_new viewings%rowtype;
begin
    -- Lock the original viewing so another operation
    -- cannot modify it simultaneously.
    select *
    into v_original
    from viewings
    where id = p_viewing_id
      and agency_id = p_agency_id
    for update;

    if not found then
        raise exception 'Viewing was not found.';
    end if;

    if v_original.status = 'CANCELLED' then
        raise exception 'A cancelled viewing cannot be rescheduled.';
    end if;

    if v_original.status = 'COMPLETED' then
        raise exception 'A completed viewing cannot be rescheduled.';
    end if;

    if v_original.status = 'NO_SHOW' then
        raise exception 'A no-show viewing cannot be rescheduled.';
    end if;

    if v_original.status = 'RESCHEDULED' then
        raise exception 'This viewing has already been rescheduled.';
    end if;

    if p_new_scheduled_start >= p_new_scheduled_end then
        raise exception 'Viewing end time must be after start time.';
    end if;

    -- Create the replacement viewing.
    -- PostgreSQL exclusion constraints protect this insert
    -- against overlapping active bookings.
    insert into viewings (
        agency_id,
        lead_id,
        property_id,
        agent_id,
        scheduled_start,
        scheduled_end,
        status,
        notes,
        rescheduled_from_id
    )
    values (
        v_original.agency_id,
        v_original.lead_id,
        v_original.property_id,
        v_original.agent_id,
        p_new_scheduled_start,
        p_new_scheduled_end,
        'REQUESTED',
        coalesce(p_notes, v_original.notes),
        v_original.id
    )
    returning *
    into v_new;

    -- Only mark the original as RESCHEDULED
    -- after the replacement was successfully created.
    update viewings
    set
        status = 'RESCHEDULED',
        updated_at = now()
    where id = v_original.id
      and agency_id = v_original.agency_id;

    return next v_new;
end;
$$;