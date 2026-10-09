import { supabase } from "@/lib/supabase/client";
import type { Property } from "@/types/database";

export type PropertyFilters = {
  agencyId: string;
  status?: Property["status"];
  location?: string;
  propertyType?: string;
  minBedrooms?: number;
  maxBedrooms?: number;
  minPrice?: number;
  maxPrice?: number;
};

export const PropertyService = {
  async getById(
    agencyId: string,
    propertyId: string
  ): Promise<Property | null> {
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("agency_id", agencyId)
      .eq("id", propertyId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch property: ${error.message}`);
    }

    return data as Property | null;
  },

  async list(filters: PropertyFilters): Promise<Property[]> {
    let query = supabase
      .from("properties")
      .select("*")
      .eq("agency_id", filters.agencyId);

    if (filters.status) {
      query = query.eq("status", filters.status);
    }

    if (filters.location) {
      query = query.ilike("location", `%${filters.location}%`);
    }

    if (filters.propertyType) {
      query = query.eq("property_type", filters.propertyType);
    }

    if (filters.minBedrooms !== undefined) {
      query = query.gte("bedrooms", filters.minBedrooms);
    }

    if (filters.maxBedrooms !== undefined) {
      query = query.lte("bedrooms", filters.maxBedrooms);
    }

    if (filters.minPrice !== undefined) {
      query = query.gte("price", filters.minPrice);
    }

    if (filters.maxPrice !== undefined) {
      query = query.lte("price", filters.maxPrice);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      throw new Error(`Failed to list properties: ${error.message}`);
    }

    return (data ?? []) as Property[];
  },
};