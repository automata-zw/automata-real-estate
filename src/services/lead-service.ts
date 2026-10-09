import { supabase } from "@/lib/supabase/client";
import type { Lead, LeadSource, LeadStatus } from "@/types/database";

export type CreateLeadInput = {
  agencyId: string;
  name: string;
  phone: string;
  email?: string;
  source: LeadSource;
  notes?: string;
};

export type UpdateLeadInput = {
  name?: string;
  phone?: string;
  email?: string | null;
  source?: LeadSource;
  status?: LeadStatus;
  notes?: string | null;
};

export type LeadResult = {
  success: boolean;
  lead?: Lead;
  error?: string;
};

export const LeadService = {
  async getById(
    agencyId: string,
    leadId: string
  ): Promise<Lead | null> {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("agency_id", agencyId)
      .eq("id", leadId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch lead: ${error.message}`);
    }

    return data as Lead | null;
  },

  async findByPhone(
    agencyId: string,
    phone: string
  ): Promise<Lead | null> {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("agency_id", agencyId)
      .eq("phone", phone)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to find lead by phone: ${error.message}`
      );
    }

    return data as Lead | null;
  },

  async create(
    input: CreateLeadInput
  ): Promise<LeadResult> {
    const existingLead = await this.findByPhone(
      input.agencyId,
      input.phone
    );

    if (existingLead) {
      return {
        success: false,
        lead: existingLead,
        error: "A lead with this phone number already exists.",
      };
    }

    const { data, error } = await supabase
      .from("leads")
      .insert({
        agency_id: input.agencyId,
        name: input.name,
        phone: input.phone,
        email: input.email ?? null,
        source: input.source,
        status: "NEW",
        notes: input.notes ?? null,
        last_interaction_at: new Date().toISOString(),
      })
      .select("*")
      .single();

if (error) {
  if (error.code === "23505") {
    const existingLead = await this.findByPhone(
      input.agencyId,
      input.phone
    );

    return {
      success: false,
      lead: existingLead ?? undefined,
      error: "A lead with this phone number already exists.",
    };
  }

  return {
    success: false,
    error: `Failed to create lead: ${error.message}`,
  };
}

    return {
      success: true,
      lead: data as Lead,
    };
  },

  async update(
    agencyId: string,
    leadId: string,
    input: UpdateLeadInput
  ): Promise<LeadResult> {
    const { data, error } = await supabase
      .from("leads")
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq("agency_id", agencyId)
      .eq("id", leadId)
      .select("*")
      .single();

    if (error) {
      return {
        success: false,
        error: `Failed to update lead: ${error.message}`,
      };
    }

    return {
      success: true,
      lead: data as Lead,
    };
  },

  async updateStatus(
    agencyId: string,
    leadId: string,
    status: LeadStatus
  ): Promise<LeadResult> {
    return this.update(agencyId, leadId, {
      status,
    });
  },

  async touch(
    agencyId: string,
    leadId: string
  ): Promise<LeadResult> {
    const { data, error } = await supabase
      .from("leads")
      .update({
        last_interaction_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("agency_id", agencyId)
      .eq("id", leadId)
      .select("*")
      .single();

    if (error) {
      return {
        success: false,
        error: `Failed to update lead interaction: ${error.message}`,
      };
    }

    return {
      success: true,
      lead: data as Lead,
    };
  },

  async listByAgency(
    agencyId: string
  ): Promise<Lead[]> {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("agency_id", agencyId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      throw new Error(
        `Failed to fetch leads: ${error.message}`
      );
    }

    return (data ?? []) as Lead[];
  },
};