import { NextResponse } from "next/server";
import { LeadService } from "@/services/lead-service";
import { PropertyInterestService } from "@/services/property-interest-service";

const AGENCY_ID =
  "00000000-0000-0000-0000-000000000001";

const PROPERTY_ID =
  "00000000-0000-0000-0000-000000001001";

export async function GET() {
  const testPhone = `+263777${Date.now()
    .toString()
    .slice(-6)}`;

  const leadResult = await LeadService.create({
    agencyId: AGENCY_ID,
    name: "Property Interest Lifecycle Test",
    phone: testPhone,
    source: "WEBSITE",
  });

  if (!leadResult.success || !leadResult.lead) {
    return NextResponse.json({
      success: false,
      step: "create_lead",
      leadResult,
    });
  }

  const leadId = leadResult.lead.id;

  const interestResult =
    await PropertyInterestService.create({
      agencyId: AGENCY_ID,
      leadId,
      propertyId: PROPERTY_ID,
    });

  if (
    !interestResult.success ||
    !interestResult.data
  ) {
    return NextResponse.json({
      success: false,
      step: "create_interest",
      interestResult,
    });
  }

  const interestId = interestResult.data.id;

  const viewingRequested =
    await PropertyInterestService.updateStatus(
      AGENCY_ID,
      interestId,
      "VIEWING_REQUESTED"
    );

  const viewed =
    await PropertyInterestService.updateStatus(
      AGENCY_ID,
      interestId,
      "VIEWED"
    );

  const noLongerInterested =
    await PropertyInterestService.updateStatus(
      AGENCY_ID,
      interestId,
      "NO_LONGER_INTERESTED"
    );

  const finalInterest =
    await PropertyInterestService.getById(
      AGENCY_ID,
      interestId
    );

  return NextResponse.json({
    success: true,
    lead: leadResult.lead,
    initialInterest: interestResult,
    viewingRequested,
    viewed,
    noLongerInterested,
    finalInterest,
  });
}