-- ============================================================
-- AUTOMATA REAL ESTATE
-- Migration 001: Initial Database Schema
-- ============================================================

-- 1. AGENCIES
create table agencies (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null unique,
    logo_url text,
    phone text,
    whatsapp_number text,
    email text,
    address text,
    currency text not null default 'USD',
    timezone text not null default 'Africa/Harare',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2. AGENCY SETTINGS
create table agency_settings (
    agency_id uuid primary key references agencies(id) on delete cascade,
    booking_enabled boolean not null default true,
    minimum_booking_notice_minutes integer not null default 120
        check (minimum_booking_notice_minutes >= 0),
    cancellation_window_minutes integer not null default 120
        check (cancellation_window_minutes >= 0),
    default_viewing_duration_minutes integer not null default 60
        check (default_viewing_duration_minutes > 0),
    allow_rescheduling boolean not null default true,
    allow_customer_cancellation boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 3. AGENCY BUSINESS HOURS
create table agency_business_hours (
    id uuid primary key default gen_random_uuid(),
    agency_id uuid not null references agencies(id) on delete cascade,
    day_of_week smallint not null
        check (day_of_week between 0 and 6),
    start_time time not null,
    end_time time not null,
    is_active boolean not null default true,
    check (start_time < end_time),
    unique (agency_id, day_of_week, start_time, end_time)
);

-- 4. AGENTS
create table agents (
    id uuid primary key default gen_random_uuid(),
    agency_id uuid not null references agencies(id) on delete cascade,
    name text not null,
    phone text,
    email text,
    status text not null default 'ACTIVE'
        check (status in ('ACTIVE', 'INACTIVE')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique (id, agency_id)
);

-- 5. AGENT AVAILABILITY
create table agent_availability (
    id uuid primary key default gen_random_uuid(),
    agent_id uuid not null references agents(id) on delete cascade,
    day_of_week smallint not null
        check (day_of_week between 0 and 6),
    start_time time not null,
    end_time time not null,
    check (start_time < end_time),
    unique (agent_id, day_of_week, start_time, end_time)
);

-- 6. AGENT AVAILABILITY EXCEPTIONS
create table agent_availability_exceptions (
    id uuid primary key default gen_random_uuid(),
    agent_id uuid not null references agents(id) on delete cascade,
    date date not null,
    start_time time not null,
    end_time time not null,
    is_available boolean not null default false,
    reason text,
    check (start_time < end_time)
);

-- 7. PROPERTIES
create table properties (
    id uuid primary key default gen_random_uuid(),
    agency_id uuid not null references agencies(id) on delete cascade,
    reference_code text not null,
    title text not null,
    property_type text not null,
    status text not null default 'AVAILABLE'
        check (
            status in (
                'AVAILABLE',
                'UNDER_OFFER',
                'SOLD',
                'RENTED',
                'UNAVAILABLE',
                'ARCHIVED'
            )
        ),
    price numeric(14,2),
    currency text not null default 'USD',
    address text,
    location text,
    bedrooms integer
        check (bedrooms >= 0),
    bathrooms numeric(4,1)
        check (bathrooms >= 0),
    description text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique (agency_id, reference_code),
    unique (id, agency_id)
);

-- 8. PROPERTY IMAGES
create table property_images (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null references properties(id) on delete cascade,
    url text not null,
    alt_text text,
    sort_order integer not null default 0
        check (sort_order >= 0)
);

-- 9. PROPERTY FEATURES
create table property_features (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null references properties(id) on delete cascade,
    feature text not null
);

-- 10. PROPERTY AVAILABILITY
create table property_availability (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null references properties(id) on delete cascade,
    day_of_week smallint not null
        check (day_of_week between 0 and 6),
    start_time time not null,
    end_time time not null,
    check (start_time < end_time),
    unique (property_id, day_of_week, start_time, end_time)
);

-- 11. PROPERTY AVAILABILITY EXCEPTIONS
create table property_availability_exceptions (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null references properties(id) on delete cascade,
    date date not null,
    start_time time not null,
    end_time time not null,
    is_available boolean not null default false,
    reason text,
    check (start_time < end_time)
);

-- 12. PROPERTY ↔ AGENT ASSIGNMENTS
create table property_agents (
    property_id uuid not null,
    agent_id uuid not null,
    created_at timestamptz not null default now(),

    primary key (property_id, agent_id),

    foreign key (property_id)
        references properties(id)
        on delete cascade,

    foreign key (agent_id)
        references agents(id)
        on delete cascade
);

-- 13. LEADS
create table leads (
    id uuid primary key default gen_random_uuid(),
    agency_id uuid not null references agencies(id) on delete cascade,
    name text not null,
    phone text not null,
    email text,
    source text not null default 'OTHER'
        check (
            source in (
                'WEBSITE',
                'WHATSAPP',
                'PHONE',
                'INSTAGRAM',
                'FACEBOOK',
                'REFERRAL',
                'WALK_IN',
                'OTHER'
            )
        ),
    status text not null default 'NEW'
        check (
            status in (
                'NEW',
                'CONTACTED',
                'VIEWING_SCHEDULED',
                'VIEWING_COMPLETED',
                'INTERESTED',
                'NEGOTIATING',
                'CLOSED',
                'LOST'
            )
        ),
    notes text,
    last_interaction_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique (id, agency_id)
);

-- 14. LEAD PROPERTY PREFERENCES
create table lead_preferences (
    lead_id uuid primary key references leads(id) on delete cascade,
    preferred_location text,
    min_bedrooms integer check (min_bedrooms >= 0),
    max_bedrooms integer check (max_bedrooms >= 0),
    min_price numeric(14,2) check (min_price >= 0),
    max_price numeric(14,2) check (max_price >= 0),
    property_type text,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    check (
        min_bedrooms is null
        or max_bedrooms is null
        or min_bedrooms <= max_bedrooms
    ),

    check (
        min_price is null
        or max_price is null
        or min_price <= max_price
    )
);

-- 15. PROPERTY INTERESTS
create table property_interests (
    id uuid primary key default gen_random_uuid(),
    agency_id uuid not null references agencies(id) on delete cascade,
    lead_id uuid not null,
    property_id uuid not null,
    status text not null default 'INTERESTED'
        check (
            status in (
                'INTERESTED',
                'VIEWING_REQUESTED',
                'VIEWED',
                'NO_LONGER_INTERESTED'
            )
        ),
    created_at timestamptz not null default now(),

    unique (lead_id, property_id),

    foreign key (lead_id, agency_id)
        references leads(id, agency_id)
        on delete cascade,

    foreign key (property_id, agency_id)
        references properties(id, agency_id)
        on delete cascade
);

-- 16. VIEWINGS
create table viewings (
    id uuid primary key default gen_random_uuid(),
    agency_id uuid not null references agencies(id) on delete cascade,
    lead_id uuid not null,
    property_id uuid not null,
    agent_id uuid not null,
    scheduled_start timestamptz not null,
    scheduled_end timestamptz not null,
    status text not null default 'REQUESTED'
        check (
            status in (
                'REQUESTED',
                'CONFIRMED',
                'COMPLETED',
                'CANCELLED',
                'RESCHEDULED',
                'NO_SHOW'
            )
        ),
    notes text,
    cancellation_reason text,
    rescheduled_from_id uuid references viewings(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    cancelled_at timestamptz,
    completed_at timestamptz,

    check (scheduled_start < scheduled_end),

    foreign key (lead_id, agency_id)
        references leads(id, agency_id),

    foreign key (property_id, agency_id)
        references properties(id, agency_id),

    foreign key (agent_id, agency_id)
        references agents(id, agency_id)
);

-- 17. CONVERSATIONS
create table conversations (
    id uuid primary key default gen_random_uuid(),
    agency_id uuid not null references agencies(id) on delete cascade,
    lead_id uuid not null,
    channel text not null
        check (channel in ('WHATSAPP', 'WEBSITE', 'SIMULATOR')),
    status text not null default 'OPEN'
        check (status in ('OPEN', 'CLOSED')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    foreign key (lead_id, agency_id)
        references leads(id, agency_id)
        on delete cascade
);

-- 18. MESSAGES
create table messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null
        references conversations(id) on delete cascade,
    direction text not null
        check (direction in ('INBOUND', 'OUTBOUND')),
    sender text,
    content text not null,
    message_type text not null default 'TEXT',
    external_message_id text,
    created_at timestamptz not null default now()
);

-- 19. ACTIVITY / AUDIT LOG
create table activities (
    id uuid primary key default gen_random_uuid(),
    agency_id uuid not null references agencies(id) on delete cascade,
    entity_type text not null,
    entity_id uuid not null,
    action text not null,
    actor_type text not null
        check (actor_type in ('CUSTOMER', 'AGENT', 'ADMIN', 'SYSTEM')),
    actor_id uuid,
    metadata jsonb,
    created_at timestamptz not null default now()
);

-- INDEXES
create index idx_properties_agency
    on properties(agency_id);

create index idx_properties_status
    on properties(agency_id, status);

create index idx_agents_agency
    on agents(agency_id);

create index idx_leads_agency
    on leads(agency_id);

create index idx_leads_phone
    on leads(agency_id, phone);

create index idx_property_interests_lead
    on property_interests(lead_id);

create index idx_property_interests_property
    on property_interests(property_id);

create index idx_viewings_agency
    on viewings(agency_id);

create index idx_viewings_lead
    on viewings(lead_id);

create index idx_viewings_property
    on viewings(property_id);

create index idx_viewings_agent
    on viewings(agent_id);

create index idx_viewings_schedule
    on viewings(scheduled_start, scheduled_end);

create index idx_conversations_lead
    on conversations(lead_id);

create index idx_messages_conversation
    on messages(conversation_id, created_at);

create index idx_activities_entity
    on activities(entity_type, entity_id);

create index idx_activities_agency
    on activities(agency_id, created_at);