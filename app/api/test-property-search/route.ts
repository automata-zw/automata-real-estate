import { NextResponse } from "next/server";
import { PropertySearchService } from "@/services/property-search-service";

const AGENCY_ID =
  "00000000-0000-0000-0000-000000000001";

export async function GET() {
  const scenarios = {
    normalBuyer: await PropertySearchService.search(
      AGENCY_ID,
      {
        preferredLocation: "Gunhill",
        minBedrooms: 3,
        maxBedrooms: 4,
        maxPrice: 350000,
        propertyType: "HOUSE",
      }
    ),

    flexibleBuyer: await PropertySearchService.search(
      AGENCY_ID,
      {
        preferredLocation: "Borrowdale",
        minBedrooms: 4,
        maxPrice: 400000,
        propertyType: "HOUSE",
      }
    ),

    budgetBuyer: await PropertySearchService.search(
      AGENCY_ID,
      {
        minBedrooms: 3,
        maxBedrooms: 3,
        maxPrice: 200000,
      }
    ),

    noPreferences: await PropertySearchService.search(
      AGENCY_ID,
      {}
    ),
  };

  return NextResponse.json(scenarios);
}