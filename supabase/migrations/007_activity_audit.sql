create table if not exists activities (
    id uuid primary key default gen_random_uuid(),

    agency_id uuid not null,

    entity_type text not null,
    entity_id uuid not null,

    action text not null,

    actor_type text not null,
    actor_id uuid,

    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now(),

    constraint activities_entity_type_check
        check (
            entity_type in (
                'AGENCY',
                'PROPERTY',
                'LEAD',
                'AGENT',
                'VIEWING',
                'CONVERSATION',
                'MESSAGE'
            )
        ),

    constraint activities_actor_type_check
        check (
            actor_type in (
                'CUSTOMER',
                'AGENT',
                'ADMIN',
                'SYSTEM'
            )
        )
);

create index if not exists activities_agency_id_idx
    on activities (agency_id);

create index if not exists activities_entity_idx
    on activities (entity_type, entity_id);

create index if not exists activities_created_at_idx
    on activities (created_at desc);

create index if not exists activities_action_idx
    on activities (action);

alter table activities
add constraint activities_agency_fk
foreign key (agency_id)
references agencies(id)
on delete cascade;