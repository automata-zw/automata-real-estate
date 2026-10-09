import { supabase } from "@/lib/supabase/client";

export type ActivityEntityType =
  | "AGENCY"
  | "PROPERTY"
  | "LEAD"
  | "AGENT"
  | "VIEWING"
  | "CONVERSATION"
  | "MESSAGE";

export type ActivityAction =
  | "CREATED"
  | "UPDATED"
  | "STATUS_CHANGED"
  | "CANCELLED"
  | "RESCHEDULED"
  | "COMPLETED"
  | "NO_SHOW"
  | "MESSAGE_SENT"
  | "MESSAGE_RECEIVED";

export type ActivityActorType =
  | "CUSTOMER"
  | "AGENT"
  | "ADMIN"
  | "SYSTEM";

export type CreateActivityInput = {
  agencyId: string;
  entityType: ActivityEntityType;
  entityId: string;
  action: ActivityAction;
  actorType: ActivityActorType;
  actorId?: string;
  metadata?: Record<string, unknown>;
};

export const ActivityService = {
  async create(
    input: CreateActivityInput
  ) {
    const { data, error } = await supabase
      .from("activities")
      .insert({
        agency_id: input.agencyId,
        entity_type: input.entityType,
        entity_id: input.entityId,
        action: input.action,
        actor_type: input.actorType,
        actor_id: input.actorId ?? null,
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(
        `Failed to create activity: ${error.message}`
      );
    }

    return data;
  },

  async listForEntity(
    agencyId: string,
    entityType: ActivityEntityType,
    entityId: string
  ) {
    const { data, error } = await supabase
      .from("activities")
      .select("*")
      .eq("agency_id", agencyId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      throw new Error(
        `Failed to fetch activities: ${error.message}`
      );
    }

    return data ?? [];
  },
};