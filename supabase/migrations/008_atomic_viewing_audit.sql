-- ============================================================
-- 008_atomic_viewing_audit.sql
--
-- Makes viewing mutations and their audit records atomic.
-- ============================================================

-- ============================================================
-- CREATE VIEWING + AUDIT
-- ============================================================

create or replace function create_viewing_atomic(
    p_agency_id uuid,
    p_lead_id uuid,
    p_property_id uuid,
    p_agent_id uuid,
    p_scheduled_start timestamptz,
    p_scheduled_end timestamptz,
    p_notes text default null
)
returns setof viewings
language plpgsql
as $$
declare
    v_viewing viewings%rowtype;
begin

    if p_scheduled_start >= p_scheduled_end then
        raise exception 'Viewing end time must be after start time.';
    end if;

    insert into viewings (
        agency_id,
        lead_id,
        property_id,
        agent_id,
        scheduled_start,
        scheduled_end,
        status,
        notes
    )
    values (
        p_agency_id,
        p_lead_id,
        p_property_id,
        p_agent_id,
        p_scheduled_start,
        p_scheduled_end,
        'REQUESTED',
        p_notes
    )
    returning *
    into v_viewing;

    insert into activities (
        agency_id,
        entity_type,
        entity_id,
        action,
        actor_type,
        metadata
    )
    values (
        p_agency_id,
        'VIEWING',
        v_viewing.id,
        'CREATED',
        'SYSTEM',
        jsonb_build_object(
            'leadId', v_viewing.lead_id,
            'propertyId', v_viewing.property_id,
            'agentId', v_viewing.agent_id,
            'scheduledStart', v_viewing.scheduled_start,
            'scheduledEnd', v_viewing.scheduled_end,
            'status', v_viewing.status
        )
    );

    return next v_viewing;
end;
$$;

-- ============================================================
-- CANCEL VIEWING + AUDIT
-- ============================================================

create or replace function cancel_viewing_atomic(
    p_agency_id uuid,
    p_viewing_id uuid,
    p_reason text default null
)
returns setof viewings
language plpgsql
as $$
declare
    v_original viewings%rowtype;
    v_cancelled viewings%rowtype;
begin

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
        raise exception 'This viewing is already cancelled.';
    end if;

    if v_original.status = 'COMPLETED' then
        raise exception 'A completed viewing cannot be cancelled.';
    end if;

    if v_original.status = 'NO_SHOW' then
        raise exception 'A no-show viewing cannot be cancelled.';
    end if;

    update viewings
    set
        status = 'CANCELLED',
        cancellation_reason = p_reason,
        cancelled_at = now(),
        updated_at = now()
    where id = p_viewing_id
      and agency_id = p_agency_id
    returning *
    into v_cancelled;

    insert into activities (
        agency_id,
        entity_type,
        entity_id,
        action,
        actor_type,
        metadata
    )
    values (
        p_agency_id,
        'VIEWING',
        v_cancelled.id,
        'CANCELLED',
        'SYSTEM',
        jsonb_build_object(
            'reason', p_reason,
            'previousStatus', v_original.status,
            'cancelledAt', v_cancelled.cancelled_at
        )
    );

    return next v_cancelled;
end;
$$;

-- ============================================================
-- RESCHEDULE VIEWING + AUDIT
-- ============================================================

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

    update viewings
    set
        status = 'RESCHEDULED',
        updated_at = now()
    where id = v_original.id
      and agency_id = v_original.agency_id;

    insert into activities (
        agency_id,
        entity_type,
        entity_id,
        action,
        actor_type,
        metadata
    )
    values (
        p_agency_id,
        'VIEWING',
        v_new.id,
        'RESCHEDULED',
        'SYSTEM',
        jsonb_build_object(
            'originalViewingId', v_original.id,
            'newViewingId', v_new.id,
            'newScheduledStart', v_new.scheduled_start,
            'newScheduledEnd', v_new.scheduled_end,
            'notes', p_notes
        )
    );

    return next v_new;
end;
$$;