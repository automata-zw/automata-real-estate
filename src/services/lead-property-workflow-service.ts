import { LeadService } from "@/services/lead-service";
import {
  LeadPreferencesService,
  type SaveLeadPreferencesInput,
} from "@/services/lead-preferences-service";
import {
  PropertySearchService,
  type PropertySearchPreferences,
} from "@/services/property-search-service";
import { PropertyInterestService } from "@/services/property-interest-service";

type CreateLeadAndPreferencesInput = {
  agencyId: string;
  name: string;
  phone: string;
  email?: string;
  source:
    | "WEBSITE"
    | "WHATSAPP"
    | "PHONE"
    | "INSTAGRAM"
    | "FACEBOOK"
    | "REFERRAL"
    | "WALK_IN"
    | "OTHER";
  notes?: string;
  preferences: SaveLeadPreferencesInput;
};

type WorkflowResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export const LeadPropertyWorkflowService = {
  async createLeadAndPreferences(
    input: CreateLeadAndPreferencesInput
  ): Promise<
    WorkflowResult<{
      lead: NonNullable<
        Awaited<ReturnType<typeof LeadService.create>>["lead"]
      >;
      preferences: SaveLeadPreferencesInput;
    }>
  > {
    const leadResult = await LeadService.create({
      agencyId: input.agencyId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      source: input.source,
      notes: input.notes,
    });

    if (!leadResult.success || !leadResult.lead) {
      return {
        success: false,
        error:
          leadResult.error ??
          "Failed to create lead.",
      };
    }

    const preferencesResult =
      await LeadPreferencesService.save(
        input.agencyId,
        {
          ...input.preferences,
          leadId: leadResult.lead.id,
        }
      );

    if (!preferencesResult.success) {
      return {
        success: false,
        error:
          preferencesResult.error ??
          "Failed to save lead preferences.",
      };
    }

    return {
      success: true,
      data: {
        lead: leadResult.lead,
        preferences: {
          ...input.preferences,
          leadId: leadResult.lead.id,
        },
      },
    };
  },

  async findMatchingProperties(
    agencyId: string,
    preferences: PropertySearchPreferences
  ) {
    return PropertySearchService.search(
      agencyId,
      preferences
    );
  },

  async expressInterest(
    agencyId: string,
    leadId: string,
    propertyId: string
  ) {
    return PropertyInterestService.create({
      agencyId,
      leadId,
      propertyId,
      status: "INTERESTED",
    });
  },
};