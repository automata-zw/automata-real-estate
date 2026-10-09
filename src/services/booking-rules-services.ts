import { supabase } from "@/lib/supabase/client";
import { AvailabilityService } from "@/services/availability-service";

export type BookingValidationInput = {
  agencyId: string;
  propertyId: string;
  agentId: string;
  scheduledStart: string;
  scheduledEnd: string;
};

export type BookingValidationResult = {
  valid: boolean;
  reason?: string;
};

export const BookingRulesService = {
  async validate(
    input: BookingValidationInput
  ): Promise<BookingValidationResult> {
    const start = new Date(input.scheduledStart);
    const end = new Date(input.scheduledEnd);
    const now = new Date();

    // Basic date validation
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return {
        valid: false,
        reason: "Invalid viewing date or time.",
      };
    }

    if (start >= end) {
      return {
        valid: false,
        reason: "Viewing end time must be after start time.",
      };
    }

    if (start <= now) {
      return {
        valid: false,
        reason: "Viewing must be scheduled for a future time.",
      };
    }

    // Load agency booking settings
    const { data: settings, error: settingsError } = await supabase
      .from("agency_settings")
      .select("*")
      .eq("agency_id", input.agencyId)
      .maybeSingle();

    if (settingsError) {
      return {
        valid: false,
        reason: `Could not load agency booking settings: ${settingsError.message}`,
      };
    }

    if (!settings) {
      return {
        valid: false,
        reason: "Agency booking settings could not be found.",
      };
    }

    // Booking feature enabled?
    if (!settings.booking_enabled) {
      return {
        valid: false,
        reason: "Online viewing bookings are currently disabled.",
      };
    }

    // Minimum booking notice
    const minimumNoticeMinutes =
      settings.minimum_booking_notice ?? 0;

    const earliestAllowedTime = new Date(
      now.getTime() + minimumNoticeMinutes * 60 * 1000
    );

    if (start < earliestAllowedTime) {
      return {
        valid: false,
        reason: `Viewing must be booked at least ${minimumNoticeMinutes} minutes in advance.`,
      };
    }

    // Verify property belongs to this agency
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id, agency_id, status")
      .eq("id", input.propertyId)
      .eq("agency_id", input.agencyId)
      .maybeSingle();

    if (propertyError) {
      return {
        valid: false,
        reason: `Could not verify property: ${propertyError.message}`,
      };
    }

    if (!property) {
      return {
        valid: false,
        reason: "Property was not found.",
      };
    }

    // Property must be viewable
    if (!["AVAILABLE", "UNDER_OFFER"].includes(property.status)) {
      return {
        valid: false,
        reason: "This property is not currently available for viewings.",
      };
    }

    // Verify agent belongs to this agency
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id, agency_id, status")
      .eq("id", input.agentId)
      .eq("agency_id", input.agencyId)
      .maybeSingle();

    if (agentError) {
      return {
        valid: false,
        reason: `Could not verify agent: ${agentError.message}`,
      };
    }

    if (!agent) {
      return {
        valid: false,
        reason: "Agent was not found.",
      };
    }

    // Agent must be active
    if (agent.status !== "ACTIVE") {
      return {
        valid: false,
        reason: "The selected agent is not currently active.",
      };
    }

    // Verify agent is assigned to this property
    const { data: assignment, error: assignmentError } =
      await supabase
        .from("property_agents")
        .select("property_id")
        .eq("agency_id", input.agencyId)
        .eq("property_id", input.propertyId)
        .eq("agent_id", input.agentId)
        .maybeSingle();

    if (assignmentError) {
      return {
        valid: false,
        reason: `Could not verify property-agent assignment: ${assignmentError.message}`,
      };
    }

    if (!assignment) {
      return {
        valid: false,
        reason: "This agent is not assigned to this property.",
      };
    }

    // Delegate all schedule/availability checks
    // to AvailabilityService.
    const availability = await AvailabilityService.check({
      agencyId: input.agencyId,
      propertyId: input.propertyId,
      agentId: input.agentId,
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
    });

    if (!availability.available) {
      return {
        valid: false,
        reason: availability.reason,
      };
    }

    // All booking rules passed.
    return {
      valid: true,
    };
  },
};