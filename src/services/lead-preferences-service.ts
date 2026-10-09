import { supabase } from "@/lib/supabase/client";

export type LeadPreferences = {
  lead_id: string;
  preferred_location: string | null;
  min_bedrooms: number | null;
  max_bedrooms: number | null;
  min_price: number | null;
  max_price: number | null;
  property_type: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SaveLeadPreferencesInput = {
  leadId: string;
  preferredLocation?: string | null;
  minBedrooms?: number | null;
  maxBedrooms?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  propertyType?: string | null;
  notes?: string | null;
};

export type LeadPreferencesResult = {
  success: boolean;
  preferences?: LeadPreferences;
  error?: string;
};

export const LeadPreferencesService = {
  async getByLead(
    agencyId: string,
    leadId: string
  ): Promise<LeadPreferences | null> {
    const { data, error } = await supabase
      .from("lead_preferences")
      .select("*")
      .eq("lead_id", leadId)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to fetch lead preferences: ${error.message}`
      );
    }

    if (!data) {
      return null;
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id")
      .eq("id", leadId)
      .eq("agency_id", agencyId)
      .maybeSingle();

    if (leadError) {
      throw new Error(
        `Failed to verify lead agency: ${leadError.message}`
      );
    }

    if (!lead) {
      return null;
    }

    return data as LeadPreferences;
  },

  async save(
    agencyId: string,
    input: SaveLeadPreferencesInput
  ): Promise<LeadPreferencesResult> {
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id")
      .eq("id", input.leadId)
      .eq("agency_id", agencyId)
      .maybeSingle();

    if (leadError) {
      return {
        success: false,
        error: `Failed to verify lead: ${leadError.message}`,
      };
    }

    if (!lead) {
      return {
        success: false,
        error: "Lead not found.",
      };
    }

    if (
      input.minBedrooms !== null &&
      input.minBedrooms !== undefined &&
      input.maxBedrooms !== null &&
      input.maxBedrooms !== undefined &&
      input.minBedrooms > input.maxBedrooms
    ) {
      return {
        success: false,
        error: "Minimum bedrooms cannot exceed maximum bedrooms.",
      };
    }

    if (
      input.minPrice !== null &&
      input.minPrice !== undefined &&
      input.maxPrice !== null &&
      input.maxPrice !== undefined &&
      input.minPrice > input.maxPrice
    ) {
      return {
        success: false,
        error: "Minimum price cannot exceed maximum price.",
      };
    }

    const { data, error } = await supabase
      .from("lead_preferences")
      .upsert(
        {
          lead_id: input.leadId,
          preferred_location:
            input.preferredLocation ?? null,
          min_bedrooms: input.minBedrooms ?? null,
          max_bedrooms: input.maxBedrooms ?? null,
          min_price: input.minPrice ?? null,
          max_price: input.maxPrice ?? null,
          property_type: input.propertyType ?? null,
          notes: input.notes ?? null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "lead_id",
        }
      )
      .select("*")
      .single();

    if (error) {
      return {
        success: false,
        error: `Failed to save lead preferences: ${error.message}`,
      };
    }

    return {
      success: true,
      preferences: data as LeadPreferences,
    };
  },
};