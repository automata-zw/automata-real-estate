import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabase/server";
import { BookingRulesService } from "@/services/booking-rules-services";

export const runtime = "nodejs";

const AGENCY_ID = "00000000-0000-0000-0000-000000000001";

const viewingRequestSchema = z.object({
  propertyId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  phone: z
    .string()
    .trim()
    .min(7)
    .max(25)
    .regex(/^[+0-9()\s-]+$/, "Enter a valid phone number."),
  email: z
    .union([
      z.string().trim().email().max(254),
      z.literal(""),
    ])
    .optional(),
  scheduledStart: z.string().datetime({ offset: true }),
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = viewingRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Please check your details and try again.",
          fields: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const start = new Date(input.scheduledStart);

    // Demo viewing duration: 60 minutes.
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    // Confirm the property belongs to this demo agency.
    const { data: property, error: propertyError } =
      await supabaseAdmin
        .from("properties")
        .select("id, title, status")
        .eq("agency_id", AGENCY_ID)
        .eq("id", input.propertyId)
        .maybeSingle();

    if (propertyError) {
      console.error("Property lookup failed:", propertyError.message);

      return NextResponse.json(
        {
          success: false,
          error: "We couldn't verify this property. Please try again.",
        },
        { status: 500 }
      );
    }

    if (!property) {
      return NextResponse.json(
        {
          success: false,
          error: "This property could not be found.",
        },
        { status: 404 }
      );
    }

    if (property.status !== "AVAILABLE") {
      return NextResponse.json(
        {
          success: false,
          error: "This property is no longer available for viewing requests.",
        },
        { status: 409 }
      );
    }

    // Find an active agent assigned to the property.
    const { data: assignments, error: assignmentError } =
      await supabaseAdmin
        .from("property_agents")
        .select("agent_id")
        .eq("agency_id", AGENCY_ID)
        .eq("property_id", property.id);

    if (assignmentError) {
      console.error("Agent assignment lookup failed:", assignmentError.message);

      return NextResponse.json(
        {
          success: false,
          error: "We couldn't check viewing availability. Please try again.",
        },
        { status: 500 }
      );
    }

    let agentId: string | null = null;

    for (const assignment of assignments ?? []) {
      const { data: agent, error: agentError } =
        await supabaseAdmin
          .from("agents")
          .select("id")
          .eq("agency_id", AGENCY_ID)
          .eq("id", assignment.agent_id)
          .eq("status", "ACTIVE")
          .maybeSingle();

      if (agentError) {
        console.error("Agent lookup failed:", agentError.message);

        return NextResponse.json(
          {
            success: false,
            error: "We couldn't check viewing availability. Please try again.",
          },
          { status: 500 }
        );
      }

      if (agent) {
        agentId = agent.id;
        break;
      }
    }

    if (!agentId) {
      return NextResponse.json(
        {
          success: false,
          error: "No active viewing agent is assigned to this property.",
        },
        { status: 409 }
      );
    }

    // Validate the booking before creating a lead.
    const validation = await BookingRulesService.validate({
      agencyId: AGENCY_ID,
      propertyId: property.id,
      agentId,
      scheduledStart: start.toISOString(),
      scheduledEnd: end.toISOString(),
    });

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error:
            validation.reason ??
            "This viewing time is unavailable. Please choose another time.",
        },
        { status: 409 }
      );
    }

    // Normalize the phone number for consistent duplicate detection.
    const phone = input.phone.replace(/[\s()-]/g, "");
    const email = input.email?.trim() || undefined;

    // Reuse an existing lead with the same phone number.
    const { data: existingLead, error: leadLookupError } =
      await supabaseAdmin
        .from("leads")
        .select("id")
        .eq("agency_id", AGENCY_ID)
        .eq("phone", phone)
        .maybeSingle();

    if (leadLookupError) {
      console.error("Lead lookup failed:", leadLookupError.message);

      return NextResponse.json(
        {
          success: false,
          error: "We couldn't process your details. Please try again.",
        },
        { status: 500 }
      );
    }

    let leadId = existingLead?.id;

    if (!leadId) {
      const { data: newLead, error: createLeadError } =
        await supabaseAdmin
          .from("leads")
          .insert({
            agency_id: AGENCY_ID,
            name: input.name.trim(),
            phone,
            email: email ?? null,
            source: "WEBSITE",
            status: "NEW",
            notes: `Viewing request for ${property.title}`,
            last_interaction_at: new Date().toISOString(),
          })
          .select("id")
          .single();

      if (createLeadError) {
        // Another request may have created this lead simultaneously.
        if (createLeadError.code === "23505") {
          const { data: duplicateLead, error: duplicateError } =
            await supabaseAdmin
              .from("leads")
              .select("id")
              .eq("agency_id", AGENCY_ID)
              .eq("phone", phone)
              .maybeSingle();

          if (duplicateError || !duplicateLead) {
            console.error(
              "Duplicate lead recovery failed:",
              duplicateError?.message
            );

            return NextResponse.json(
              {
                success: false,
                error: "We couldn't process your details. Please try again.",
              },
              { status: 500 }
            );
          }

          leadId = duplicateLead.id;
        } else {
          console.error("Lead creation failed:", createLeadError.message);

          return NextResponse.json(
            {
              success: false,
              error: "We couldn't save your enquiry. Please try again.",
            },
            { status: 500 }
          );
        }
      } else {
        leadId = newLead.id;
      }
    }

    // The atomic database function remains responsible for the final booking.
    const { data: viewingRows, error: viewingError } =
      await supabaseAdmin.rpc("create_viewing_atomic", {
        p_agency_id: AGENCY_ID,
        p_lead_id: leadId,
        p_property_id: property.id,
        p_agent_id: agentId,
        p_scheduled_start: start.toISOString(),
        p_scheduled_end: end.toISOString(),
        p_notes: "Requested through the PropertyFlow demo website.",
      });

    if (viewingError) {
      console.error("Atomic viewing creation failed:", viewingError.message);

      return NextResponse.json(
        {
          success: false,
          error:
            "We couldn't confirm this viewing. The slot may have just been taken. Please try another time.",
        },
        { status: 409 }
      );
    }

    const viewing = viewingRows?.[0];

    if (!viewing) {
      return NextResponse.json(
        {
          success: false,
          error: "No viewing confirmation was returned. Please try again.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Your viewing request has been submitted successfully.",
        viewing: {
          id: viewing.id,
          propertyId: viewing.property_id,
          scheduledStart: viewing.scheduled_start,
          scheduledEnd: viewing.scheduled_end,
          status: viewing.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected viewing request error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Something went wrong. Please try again.",
      },
      { status: 500 }
    );
  }
}