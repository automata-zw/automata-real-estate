-- ============================================================
-- AUTOMATA REAL ESTATE
-- Migration 004: Property-Agent Tenant Integrity
-- ============================================================

-- Add agency_id so the relationship itself belongs to an agency.
alter table property_agents
add column agency_id uuid;

-- Populate existing assignments from the property.
update property_agents pa
set agency_id = p.agency_id
from properties p
where p.id = pa.property_id;

-- Make agency_id mandatory.
alter table property_agents
alter column agency_id set not null;

-- Ensure the property belongs to the same agency.
alter table property_agents
add constraint property_agents_property_agency_fk
foreign key (property_id, agency_id)
references properties(id, agency_id)
on delete cascade;

-- Ensure the agent belongs to the same agency.
alter table property_agents
add constraint property_agents_agent_agency_fk
foreign key (agent_id, agency_id)
references agents(id, agency_id)
on delete cascade;

-- Replace the old primary key with an agency-aware key.
alter table property_agents
drop constraint property_agents_pkey;

alter table property_agents
add constraint property_agents_pkey
primary key (agency_id, property_id, agent_id);

-- Useful lookup index.
create index idx_property_agents_agency
on property_agents(agency_id);