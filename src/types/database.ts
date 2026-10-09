export type PropertyStatus =
  | "AVAILABLE"
  | "UNDER_OFFER"
  | "SOLD"
  | "RENTED"
  | "UNAVAILABLE"
  | "ARCHIVED";

export type Property = {
  id: string;
  agency_id: string;
  reference_code: string;
  title: string;
  property_type: string;
  status: PropertyStatus;
  price: number | null;
  currency: string;
  address: string | null;
  location: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "VIEWING_SCHEDULED"
  | "VIEWING_COMPLETED"
  | "INTERESTED"
  | "NEGOTIATING"
  | "CLOSED"
  | "LOST";

export type LeadSource =
  | "WEBSITE"
  | "WHATSAPP"
  | "PHONE"
  | "INSTAGRAM"
  | "FACEBOOK"
  | "REFERRAL"
  | "WALK_IN"
  | "OTHER";

export type Lead = {
  id: string;
  agency_id: string;
  name: string;
  phone: string;
  email: string | null;
  source: LeadSource;
  status: LeadStatus;
  notes: string | null;
  last_interaction_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentStatus = "ACTIVE" | "INACTIVE";

export type Agent = {
  id: string;
  agency_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: AgentStatus;
  created_at: string;
  updated_at: string;
};

export type ViewingStatus =
  | "REQUESTED"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "RESCHEDULED"
  | "NO_SHOW";

export type Viewing = {
  id: string;
  agency_id: string;
  lead_id: string;
  property_id: string;
  agent_id: string;
  scheduled_start: string;
  scheduled_end: string;
  status: ViewingStatus;
  notes: string | null;
  cancellation_reason: string | null;
  rescheduled_from_id: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  completed_at: string | null;
};

export type Agency = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  email: string | null;
  address: string | null;
  currency: string;
  timezone: string;
  created_at: string;
  updated_at: string;
};