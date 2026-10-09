import { supabase } from "@/lib/supabase/client";
import type { Property } from "@/types/database";

export type PropertySearchPreferences = {
  preferredLocation?: string | null;
  minBedrooms?: number | null;
  maxBedrooms?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  propertyType?: string | null;
};

export type PropertyMatch = {
  property: Property;
  score: number;
  reasons: string[];
};

export type LocationSearchInfo = {
  requestedLocation: string | null;
  recognizedLocation: string | null;
  suggestedLocation: string | null;
  availableLocations: string[];
  message: string | null;
};

type SearchResult = {
  success: boolean;
  matches?: PropertyMatch[];
  locationInfo?: LocationSearchInfo;
  error?: string;
};

const LOCATION_SCORE = 30;
const PROPERTY_TYPE_SCORE = 20;
const BEDROOM_SCORE = 25;
const PRICE_SCORE = 25;

const OVER_BUDGET_10_PERCENT_PENALTY = 10;
const OVER_BUDGET_20_PERCENT_PENALTY = 20;
const UNDER_OFFER_PENALTY = 15;

const KNOWN_LOCATIONS = [
  "Avondale",
  "Borrowdale",
  "Borrowdale Brooke",
  "Eastlea",
  "Gunhill",
  "Highlands",
];

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function levenshteinDistance(
  first: string,
  second: string
): number {
  const a = normalize(first);
  const b = normalize(second);

  const previous = Array.from(
    { length: b.length + 1 },
    (_, index) => index
  );

  for (let i = 1; i <= a.length; i++) {
    const current = [i];

    for (let j = 1; j <= b.length; j++) {
      const insertion = current[j - 1] + 1;
      const deletion = previous[j] + 1;
      const substitution =
        previous[j - 1] +
        (a[i - 1] === b[j - 1] ? 0 : 1);

      current.push(
        Math.min(insertion, deletion, substitution)
      );
    }

    for (let j = 0; j <= b.length; j++) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function findSuggestedLocation(
  requestedLocation: string,
  availableLocations: string[]
): string | null {
  const requested = normalize(requestedLocation);

  if (!requested) {
    return null;
  }

  const ranked = availableLocations
    .map((location) => ({
      location,
      distance: levenshteinDistance(
        requested,
        location
      ),
    }))
    .sort((a, b) => a.distance - b.distance);

  const best = ranked[0];

  if (!best) {
    return null;
  }

  // Short inputs need particularly close matches to
  // avoid suggesting unrelated locations.
  const maximumDistance =
    requested.length <= 4
      ? 1
      : requested.length <= 8
        ? 2
        : 3;

  if (best.distance > maximumDistance) {
    return null;
  }

  // If two locations are equally plausible, don't guess.
  const secondBest = ranked[1];

  if (
    secondBest &&
    secondBest.distance === best.distance
  ) {
    return null;
  }

  return best.location;
}

function resolveLocation(
  requestedLocation: string | null | undefined,
  availableLocations: string[]
): LocationSearchInfo {
  const requested = requestedLocation?.trim() ?? "";

  if (!requested) {
    return {
      requestedLocation: null,
      recognizedLocation: null,
      suggestedLocation: null,
      availableLocations,
      message: null,
    };
  }

  const exactMatch = availableLocations.find(
    (location) =>
      normalize(location) === normalize(requested)
  );

  if (exactMatch) {
    return {
      requestedLocation: requested,
      recognizedLocation: exactMatch,
      suggestedLocation: null,
      availableLocations,
      message: null,
    };
  }

  const suggestion = findSuggestedLocation(
    requested,
    availableLocations
  );

  if (suggestion) {
    return {
      requestedLocation: requested,
      recognizedLocation: null,
      suggestedLocation: suggestion,
      availableLocations,
      message: `We couldn't find "${requested}". Did you mean ${suggestion}?`,
    };
  }

  return {
    requestedLocation: requested,
    recognizedLocation: null,
    suggestedLocation: null,
    availableLocations,
    message: `We couldn't find "${requested}" in our listed locations. You can choose another area or explore matching properties elsewhere.`,
  };
}

function scoreLocation(
  propertyLocation: string | null,
  preferredLocation: string | null | undefined
): {
  score: number;
  reason?: string;
} {
  if (!preferredLocation || !propertyLocation) {
    return { score: 0 };
  }

  const property = normalize(propertyLocation);
  const preferred = normalize(preferredLocation);

  if (property === preferred) {
    return {
      score: LOCATION_SCORE,
      reason: "Exact location match",
    };
  }

  if (
    property.includes(preferred) ||
    preferred.includes(property)
  ) {
    return {
      score: LOCATION_SCORE * 0.6,
      reason: "Close location match",
    };
  }

  return {
    score: 0,
    reason: "Different location",
  };
}

function scorePropertyType(
  propertyType: string,
  preferredType: string | null | undefined
): {
  score: number;
  reason?: string;
} {
  if (!preferredType) {
    return { score: 0 };
  }

  if (
    normalize(propertyType) === normalize(preferredType)
  ) {
    return {
      score: PROPERTY_TYPE_SCORE,
      reason: "Property type matches",
    };
  }

  return {
    score: 0,
    reason: "Different property type",
  };
}

function scoreBedrooms(
  bedrooms: number | null,
  minBedrooms: number | null | undefined,
  maxBedrooms: number | null | undefined
): {
  score: number;
  reason?: string;
  excluded?: boolean;
} {
  if (
    (minBedrooms === null || minBedrooms === undefined) &&
    (maxBedrooms === null || maxBedrooms === undefined)
  ) {
    return { score: 0 };
  }

  if (bedrooms === null) {
    return {
      score: 0,
      reason: "Bedroom count unavailable",
    };
  }

  if (
    minBedrooms !== null &&
    minBedrooms !== undefined &&
    bedrooms < minBedrooms
  ) {
    return {
      score: 0,
      reason: "Below requested bedroom range",
      excluded: true,
    };
  }

  if (
    maxBedrooms !== null &&
    maxBedrooms !== undefined &&
    bedrooms > maxBedrooms
  ) {
    return {
      score: 0,
      reason: "Above requested bedroom range",
      excluded: true,
    };
  }

  return {
    score: BEDROOM_SCORE,
    reason: "Bedroom requirement matches",
  };
}

function scorePrice(
  price: number | null,
  minPrice: number | null | undefined,
  maxPrice: number | null | undefined
): {
  score: number;
  reason?: string;
  excluded?: boolean;
} {
  if (
    (minPrice === null || minPrice === undefined) &&
    (maxPrice === null || maxPrice === undefined)
  ) {
    return { score: 0 };
  }

  if (price === null) {
    return {
      score: 0,
      reason: "Price unavailable",
    };
  }

  if (
    minPrice !== null &&
    minPrice !== undefined &&
    price < minPrice
  ) {
    return {
      score: PRICE_SCORE,
      reason: "Within maximum budget",
    };
  }

  if (maxPrice === null || maxPrice === undefined) {
    return {
      score: PRICE_SCORE,
      reason: "Price meets budget criteria",
    };
  }

  if (price <= maxPrice) {
    return {
      score: PRICE_SCORE,
      reason: "Within budget",
    };
  }

  const overBudgetPercentage =
    ((price - maxPrice) / maxPrice) * 100;

  if (overBudgetPercentage <= 10) {
    return {
      score:
        PRICE_SCORE -
        OVER_BUDGET_10_PERCENT_PENALTY,
      reason: "Slightly above budget",
    };
  }

  if (overBudgetPercentage <= 20) {
    return {
      score:
        PRICE_SCORE -
        OVER_BUDGET_20_PERCENT_PENALTY,
      reason:
        "Above budget but potentially worth considering",
    };
  }

  return {
    score: 0,
    reason: "Far above budget",
    excluded: true,
  };
}

function scoreAvailabilityStatus(
  status: Property["status"]
): {
  score: number;
  reason?: string;
} {
  if (status === "AVAILABLE") {
    return {
      score: 0,
      reason: "Currently available",
    };
  }

  if (status === "UNDER_OFFER") {
    return {
      score: -UNDER_OFFER_PENALTY,
      reason: "Currently under offer",
    };
  }

  return {
    score: 0,
  };
}

export const PropertySearchService = {
  async search(
    agencyId: string,
    preferences: PropertySearchPreferences
  ): Promise<SearchResult> {
    const hasPreferences =
      Boolean(preferences.preferredLocation) ||
      (preferences.minBedrooms !== null &&
        preferences.minBedrooms !== undefined) ||
      (preferences.maxBedrooms !== null &&
        preferences.maxBedrooms !== undefined) ||
      (preferences.minPrice !== null &&
        preferences.minPrice !== undefined) ||
      (preferences.maxPrice !== null &&
        preferences.maxPrice !== undefined) ||
      Boolean(preferences.propertyType);

    let query = supabase
      .from("properties")
      .select("*")
      .eq("agency_id", agencyId);

    if (hasPreferences) {
      query = query.in("status", [
        "AVAILABLE",
        "UNDER_OFFER",
      ]);
    } else {
      query = query.eq("status", "AVAILABLE");
    }

    const { data, error } = await query;

    if (error) {
      return {
        success: false,
        error: `Failed to search properties: ${error.message}`,
      };
    }

    const properties = (data ?? []) as Property[];

    const databaseLocations = [
      ...new Set(
        properties
          .map((property) => property.location?.trim())
          .filter((location): location is string =>
            Boolean(location)
          )
      ),
    ].sort((a, b) => a.localeCompare(b));

    // Use the actual database locations rather than assuming
    // every agency has the same locations.
    const locationInfo = resolveLocation(
      preferences.preferredLocation,
      databaseLocations.length > 0
        ? databaseLocations
        : KNOWN_LOCATIONS
    );

    const effectiveLocation =
      locationInfo.recognizedLocation ??
      preferences.preferredLocation;

    const matches: PropertyMatch[] = [];

    for (const property of properties) {
      const location = scoreLocation(
        property.location,
        effectiveLocation
      );

      const propertyType = scorePropertyType(
        property.property_type,
        preferences.propertyType
      );

      const bedrooms = scoreBedrooms(
        property.bedrooms,
        preferences.minBedrooms,
        preferences.maxBedrooms
      );

      const price = scorePrice(
        property.price,
        preferences.minPrice,
        preferences.maxPrice
      );

      if (bedrooms.excluded || price.excluded) {
        continue;
      }

      const availability = scoreAvailabilityStatus(
        property.status
      );

      const score =
        location.score +
        propertyType.score +
        bedrooms.score +
        price.score +
        availability.score;

      const reasons = [
        location.reason,
        propertyType.reason,
        bedrooms.reason,
        price.reason,
        availability.reason,
      ].filter(
        (reason): reason is string =>
          Boolean(reason)
      );

      if (score > 0 || !hasPreferences) {
        matches.push({
          property,
          score,
          reasons:
            reasons.length > 0
              ? reasons
              : ["Available property"],
        });
      }
    }

    matches.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      if (a.property.status !== b.property.status) {
        return a.property.status === "AVAILABLE"
          ? -1
          : 1;
      }

      return 0;
    });

    return {
      success: true,
      matches,
      locationInfo,
    };
  },
};