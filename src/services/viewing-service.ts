import { supabase } from "@/lib/supabase/client";
import type { Viewing, ViewingStatus } from "@/types/database";
import { BookingRulesService } from "@/services/booking-rules-services";
import { ActivityService } from "@/services/activity-service";

export type CreateViewingInput = {
  agencyId: string;
  leadId: string;
  propertyId: string;
  agentId: string;
  scheduledStart: string;
  scheduledEnd: string;
  notes?: string;
};

export type CancelViewingInput = {
  agencyId: string;
  viewingId: string;
  reason?: string;
};

export type RescheduleViewingInput = {
  agencyId: string;
  viewingId: string;
  newScheduledStart: string;
  newScheduledEnd: string;
  notes?: string;
};

export type ViewingResult = {
  success: boolean;
  viewing?: Viewing;
  error?: string;
};

export const ViewingService = {
  async getById(
    agencyId: string,
    viewingId: string
  ): Promise<Viewing | null> {
    const { data, error } = await supabase
      .from("viewings")
      .select("*")
      .eq("agency_id", agencyId)
      .eq("id", viewingId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch viewing: ${error.message}`);
    }

    return data as Viewing | null;
  },

  async listByLead(
    agencyId: string,
    leadId: string
  ): Promise<Viewing[]> {
    const { data, error } = await supabase
      .from("viewings")
      .select("*")
      .eq("agency_id", agencyId)
      .eq("lead_id", leadId)
      .order("scheduled_start", { ascending: true });

    if (error) {
      throw new Error(
        `Failed to fetch lead viewings: ${error.message}`
      );
    }

    return (data ?? []) as Viewing[];
  },

  async listByProperty(
    agencyId: string,
    propertyId: string
  ): Promise<Viewing[]> {
    const { data, error } = await supabase
      .from("viewings")
      .select("*")
      .eq("agency_id", agencyId)
      .eq("property_id", propertyId)
      .order("scheduled_start", { ascending: true });

    if (error) {
      throw new Error(
        `Failed to fetch property viewings: ${error.message}`
      );
    }

    return (data ?? []) as Viewing[];
  },

  async create(input: CreateViewingInput): Promise<ViewingResult> {
  const validation = await BookingRulesService.validate({
    agencyId: input.agencyId,
    propertyId: input.propertyId,
    agentId: input.agentId,
    scheduledStart: input.scheduledStart,
    scheduledEnd: input.scheduledEnd,
  });

  if (!validation.valid) {
    return {
      success: false,
      error: validation.reason,
    };
  }

  const { data, error } = await supabase.rpc(
    "create_viewing_atomic",
    {
      p_agency_id: input.agencyId,
      p_lead_id: input.leadId,
      p_property_id: input.propertyId,
      p_agent_id: input.agentId,
      p_scheduled_start: input.scheduledStart,
      p_scheduled_end: input.scheduledEnd,
      p_notes: input.notes ?? null,
    }
  );

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  const viewing = data?.[0];

  if (!viewing) {
    return {
      success: false,
      error: "Viewing was created but no viewing was returned.",
    };
  }

  return {
    success: true,
    viewing: viewing as Viewing,
  };
},

  async cancel(input: CancelViewingInput): Promise<ViewingResult> {
  const { data, error } = await supabase.rpc(
    "cancel_viewing_atomic",
    {
      p_agency_id: input.agencyId,
      p_viewing_id: input.viewingId,
      p_reason: input.reason ?? null,
    }
  );

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  const viewing = data?.[0];

  if (!viewing) {
    return {
      success: false,
      error: "Viewing was cancelled but no viewing was returned.",
    };
  }

  return {
    success: true,
    viewing: viewing as Viewing,
  };
},

  async reschedule(
  input: RescheduleViewingInput
): Promise<ViewingResult> {
  const { data, error } = await supabase.rpc(
    "reschedule_viewing_atomic",
    {
      p_agency_id: input.agencyId,
      p_viewing_id: input.viewingId,
      p_new_scheduled_start: input.newScheduledStart,
      p_new_scheduled_end: input.newScheduledEnd,
      p_notes: input.notes ?? null,
    }
  );

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  const viewing = data?.[0];

  if (!viewing) {
    return {
      success: false,
      error: "Reschedule completed but no new viewing was returned.",
    };
  }

  return {
    success: true,
    viewing: viewing as Viewing,
  };
},
  async updateStatus(
    agencyId: string,
    viewingId: string,
    status: ViewingStatus
  ): Promise<ViewingResult> {
    const { data, error } = await supabase
      .from("viewings")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("agency_id", agencyId)
      .eq("id", viewingId)
      .select("*")
      .single();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    const viewing = data as Viewing;

    let action: "STATUS_CHANGED" | "COMPLETED" | "NO_SHOW" =
      "STATUS_CHANGED";

    if (status === "COMPLETED") {
      action = "COMPLETED";
    } else if (status === "NO_SHOW") {
      action = "NO_SHOW";
    }

    await ActivityService.create({
      agencyId,
      entityType: "VIEWING",
      entityId: viewing.id,
      action,
      actorType: "SYSTEM",
      metadata: {
        newStatus: status,
      },
    });

    return {
      success: true,
      viewing,
    };
  },
};