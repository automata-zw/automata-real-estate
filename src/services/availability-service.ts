import { supabase } from "@/lib/supabase/client";

export type AvailabilityCheckInput = {
  agencyId: string;
  propertyId: string;
  agentId: string;
  scheduledStart: string;
  scheduledEnd: string;
};

export type AvailabilityResult = {
  available: boolean;
  reason?: string;
};

export const AvailabilityService = {
  async check(
    input: AvailabilityCheckInput
  ): Promise<AvailabilityResult> {
    const start = new Date(input.scheduledStart);
    const end = new Date(input.scheduledEnd);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return {
        available: false,
        reason: "Invalid viewing date or time.",
      };
    }

    const dayOfWeek = start.getDay();

    const startTime = start.toTimeString().slice(0, 8);
    const endTime = end.toTimeString().slice(0, 8);

    // --------------------------------------------------
    // Agency business hours
    // --------------------------------------------------

    const { data: businessHours, error: businessHoursError } =
      await supabase
        .from("agency_business_hours")
        .select("start_time, end_time")
        .eq("agency_id", input.agencyId)
        .eq("day_of_week", dayOfWeek)
        .eq("is_active", true)
        .maybeSingle();

    if (businessHoursError) {
      return {
        available: false,
        reason: `Could not check agency hours: ${businessHoursError.message}`,
      };
    }

    if (!businessHours) {
      return {
        available: false,
        reason: "The agency is closed on this day.",
      };
    }

    if (
      startTime < businessHours.start_time ||
      endTime > businessHours.end_time
    ) {
      return {
        available: false,
        reason: "The requested time is outside agency business hours.",
      };
    }

    // --------------------------------------------------
    // Agent weekly availability
    // --------------------------------------------------

    const { data: agentSlots, error: agentSlotsError } =
      await supabase
        .from("agent_availability")
        .select("start_time, end_time")
        .eq("agent_id", input.agentId)
        .eq("day_of_week", dayOfWeek);

    if (agentSlotsError) {
      return {
        available: false,
        reason: `Could not check agent availability: ${agentSlotsError.message}`,
      };
    }

    const agentAvailable = (agentSlots ?? []).some(
      (slot) =>
        startTime >= slot.start_time &&
        endTime <= slot.end_time
    );

    if (!agentAvailable) {
      return {
        available: false,
        reason: "The agent is not available at this time.",
      };
    }

    // --------------------------------------------------
    // Agent exceptions
    // --------------------------------------------------

    const date = start.toISOString().slice(0, 10);

    const { data: agentExceptions, error: agentExceptionError } =
      await supabase
        .from("agent_availability_exceptions")
        .select("start_time, end_time, is_available")
        .eq("agent_id", input.agentId)
        .eq("date", date);

    if (agentExceptionError) {
      return {
        available: false,
        reason: `Could not check agent exceptions: ${agentExceptionError.message}`,
      };
    }

    const blockedByAgentException = (agentExceptions ?? []).some(
      (exception) =>
        exception.is_available === false &&
        startTime < exception.end_time &&
        endTime > exception.start_time
    );

    if (blockedByAgentException) {
      return {
        available: false,
        reason: "The agent is unavailable during the requested time.",
      };
    }

    // --------------------------------------------------
    // Property weekly availability
    // --------------------------------------------------

    const { data: propertySlots, error: propertySlotsError } =
      await supabase
        .from("property_availability")
        .select("start_time, end_time")
        .eq("property_id", input.propertyId)
        .eq("day_of_week", dayOfWeek);

    if (propertySlotsError) {
      return {
        available: false,
        reason: `Could not check property availability: ${propertySlotsError.message}`,
      };
    }

    const propertyAvailable = (propertySlots ?? []).some(
      (slot) =>
        startTime >= slot.start_time &&
        endTime <= slot.end_time
    );

    if (!propertyAvailable) {
      return {
        available: false,
        reason: "The property is not available at this time.",
      };
    }

    // --------------------------------------------------
    // Property exceptions
    // --------------------------------------------------

    const { data: propertyExceptions, error: propertyExceptionError } =
      await supabase
        .from("property_availability_exceptions")
        .select("start_time, end_time, is_available")
        .eq("property_id", input.propertyId)
        .eq("date", date);

    if (propertyExceptionError) {
      return {
        available: false,
        reason: `Could not check property exceptions: ${propertyExceptionError.message}`,
      };
    }

    const blockedByPropertyException = (propertyExceptions ?? []).some(
      (exception) =>
        exception.is_available === false &&
        startTime < exception.end_time &&
        endTime > exception.start_time
    );

    if (blockedByPropertyException) {
      return {
        available: false,
        reason: "The property is unavailable during the requested time.",
      };
    }

    // --------------------------------------------------
    // Existing bookings
    // --------------------------------------------------

    const { data: conflicts, error: conflictError } = await supabase
      .from("viewings")
      .select("id, agent_id, property_id")
      .eq("agency_id", input.agencyId)
      .in("status", ["REQUESTED", "CONFIRMED"])
      .or(
        `agent_id.eq.${input.agentId},property_id.eq.${input.propertyId}`
      )
      .lt("scheduled_start", input.scheduledEnd)
      .gt("scheduled_end", input.scheduledStart);

    if (conflictError) {
      return {
        available: false,
        reason: `Could not check existing bookings: ${conflictError.message}`,
      };
    }

    const agentConflict = (conflicts ?? []).some(
      (viewing) => viewing.agent_id === input.agentId
    );

    const propertyConflict = (conflicts ?? []).some(
      (viewing) => viewing.property_id === input.propertyId
    );

    if (agentConflict && propertyConflict) {
      return {
        available: false,
        reason: "Both the agent and property are already booked at this time.",
      };
    }

    if (agentConflict) {
      return {
        available: false,
        reason: "The agent is already booked at this time.",
      };
    }

    if (propertyConflict) {
      return {
        available: false,
        reason: "The property is already booked at this time.",
      };
    }

    return {
      available: true,
    };
  },
};