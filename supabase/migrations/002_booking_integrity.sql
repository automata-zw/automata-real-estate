-- ============================================================
-- AUTOMATA REAL ESTATE
-- Migration 002: Booking Integrity
-- ============================================================

create extension if not exists btree_gist;

alter table viewings
add constraint no_overlapping_agent_viewings
exclude using gist (
    agent_id with =,
    tstzrange(scheduled_start, scheduled_end, '[)') with &&
)
where (
    status in ('REQUESTED', 'CONFIRMED')
);

alter table viewings
add constraint no_overlapping_property_viewings
exclude using gist (
    property_id with =,
    tstzrange(scheduled_start, scheduled_end, '[)') with &&
)
where (
    status in ('REQUESTED', 'CONFIRMED')
);