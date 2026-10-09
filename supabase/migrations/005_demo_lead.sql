-- ============================================================
-- AUTOMATA REAL ESTATE
-- Migration 005: Demo Lead
-- ============================================================

insert into leads (
    agency_id,
    name,
    phone,
    email,
    source,
    status,
    notes
)
select
    id,
    'Kundai Moyo',
    '+263774444444',
    'kundai.demo@example.com',
    'WEBSITE',
    'NEW',
    'Demo lead for PropertyFlow booking tests.'
from agencies
where slug = 'harare-property-group'
and not exists (
    select 1
    from leads
    where phone = '+263774444444'
);