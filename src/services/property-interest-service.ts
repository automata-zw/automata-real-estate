import { supabase } from "@/lib/supabase/client";

export type PropertyInterestStatus =
  | "INTERESTED"
  | "VIEWING_REQUESTED"
  | "VIEWED"
  | "NO_LONGER_INTERESTED";

export type PropertyInterest = {
  id: string;
  agency_id: string;
  lead_id: string;
  property_id: string;
  status: PropertyInterestStatus;
  created_at: string;
};

type CreatePropertyInterestInput = {
  agencyId: string;
  leadId: string;
  propertyId: string;
  status?: PropertyInterestStatus;
};

type ServiceResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export const PropertyInterestService = {
  async getById(
    agencyId: string,
    interestId: string
  ): Promise<ServiceResult<PropertyInterest>> {
    const { data, error } = await supabase
      .from("property_interests")
      .select("*")
      .eq("agency_id", agencyId)
      .eq("id", interestId)
      .maybeSingle();

    if (error) {
      return {
        success: false,
        error: `Failed to get property interest: ${error.message}`,
      };
    }

    if (!data) {
      return {
        success: false,
        error: "Property interest not found.",
      };
    }

    return {
      success: true,
      data: data as PropertyInterest,
    };
  },

  async getByLead(
    agencyId: string,
    leadId: string
  ): Promise<ServiceResult<PropertyInterest[]>> {
    const { data, error } = await supabase
      .from("property_interests")
      .select("*")
      .eq("agency_id", agencyId)
      .eq("lead_id", leadId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      return {
        success: false,
        error: `Failed to get property interests: ${error.message}`,
      };
    }

    return {
      success: true,
      data: (data ?? []) as PropertyInterest[],
    };
  },

  async getByProperty(
    agencyId: string,
    propertyId: string
  ): Promise<ServiceResult<PropertyInterest[]>> {
    const { data, error } = await supabase
      .from("property_interests")
      .select("*")
      .eq("agency_id", agencyId)
      .eq("property_id", propertyId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      return {
        success: false,
        error: `Failed to get property interests: ${error.message}`,
      };
    }

    return {
      success: true,
      data: (data ?? []) as PropertyInterest[],
    };
  },

  async create(
    input: CreatePropertyInterestInput
  ): Promise<ServiceResult<PropertyInterest>> {
    const {
      agencyId,
      leadId,
      propertyId,
      status = "INTERESTED",
    } = input;

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("id", leadId)
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

    const { data: property, error: propertyError } =
      await supabase
        .from("properties")
        .select("id, status")
        .eq("agency_id", agencyId)
        .eq("id", propertyId)
        .maybeSingle();

    if (propertyError) {
      return {
        success: false,
        error: `Failed to verify property: ${propertyError.message}`,
      };
    }

    if (!property) {
      return {
        success: false,
        error: "Property not found.",
      };
    }

    if (
      property.status !== "AVAILABLE" &&
      property.status !== "UNDER_OFFER"
    ) {
      return {
        success: false,
        error:
          "This property is no longer available for customer interest.",
      };
    }

    const { data, error } = await supabase
      .from("property_interests")
      .insert({
        agency_id: agencyId,
        lead_id: leadId,
        property_id: propertyId,
        status,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          error:
            "This lead is already interested in this property.",
        };
      }

      return {
        success: false,
        error: `Failed to create property interest: ${error.message}`,
      };
    }

    return {
      success: true,
      data: data as PropertyInterest,
    };
  },

  async updateStatus(
    agencyId: string,
    interestId: string,
    status: PropertyInterestStatus
  ): Promise<ServiceResult<PropertyInterest>> {
    const { data, error } = await supabase
      .from("property_interests")
      .update({
        status,
      })
      .eq("agency_id", agencyId)
      .eq("id", interestId)
      .select("*")
      .single();

    if (error) {
      return {
        success: false,
        error: `Failed to update property interest: ${error.message}`,
      };
    }

    return {
      success: true,
      data: data as PropertyInterest,
    };
  },
};