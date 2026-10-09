"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  PropertySearchService,
  type PropertyMatch,
  type PropertySearchPreferences,
  type LocationSearchInfo,
} from "@/services/property-search-service";

const AGENCY_ID = "00000000-0000-0000-0000-000000000001";

type SearchForm = {
  location: string;
  propertyType: string;
  minBedrooms: string;
  maxBudget: string;
};

const INITIAL_FORM: SearchForm = {
  location: "",
  propertyType: "",
  minBedrooms: "",
  maxBudget: "",
};

function formatPrice(price: number | null, currency: string) {
  if (price === null) {
    return "Price on request";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${currency} ${price.toLocaleString()}`;
  }
}

function buildPreferences(
  form: SearchForm,
  locationOverride?: string
): PropertySearchPreferences {
  return {
    preferredLocation:
      locationOverride !== undefined
        ? locationOverride || null
        : form.location.trim() || null,
    propertyType: form.propertyType || null,
    minBedrooms: form.minBedrooms
      ? Number(form.minBedrooms)
      : null,
    maxPrice: form.maxBudget
      ? Number(form.maxBudget)
      : null,
  };
}

export default function Home() {
  const [form, setForm] = useState<SearchForm>(INITIAL_FORM);
  const [matches, setMatches] = useState<PropertyMatch[]>([]);
  const [locationInfo, setLocationInfo] =
    useState<LocationSearchInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  async function searchProperties(
    preferences: PropertySearchPreferences,
    initialLoad = false
  ) {
    if (initialLoad) {
      setLoading(true);
    } else {
      setSearching(true);
    }

    setError("");

    try {
      const result = await PropertySearchService.search(
        AGENCY_ID,
        preferences
      );

      if (!result.success) {
        setMatches([]);
        setLocationInfo(null);
        setError(
          result.error ?? "We couldn't load properties."
        );
        return;
      }

      setMatches(result.matches ?? []);
      setLocationInfo(result.locationInfo ?? null);
    } catch {
      setMatches([]);
      setLocationInfo(null);
      setError(
        "We couldn't connect to the property service. Please try again."
      );
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }

  useEffect(() => {
    void searchProperties({}, true);
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasSearched(true);

    void searchProperties(buildPreferences(form));
  }

  function chooseLocation(location: string) {
    const updatedForm = {
      ...form,
      location,
    };

    setForm(updatedForm);
    setHasSearched(true);

    void searchProperties(
      buildPreferences(updatedForm, location)
    );
  }

  function resetSearch() {
    setForm(INITIAL_FORM);
    setHasSearched(false);
    setLocationInfo(null);
    void searchProperties({});
  }

  const requestedLocation =
    locationInfo?.requestedLocation ?? null;

  function isAlternativeLocation(property: PropertyMatch) {
    if (!requestedLocation) {
      return false;
    }

    return property.reasons.includes("Different location");
  }

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#202820]">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <a href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#234b39] text-lg font-bold text-white">
              P
            </div>

            <div>
              <p className="text-lg font-bold tracking-tight">
                PropertyFlow
              </p>
              <p className="text-xs text-gray-500">
                Harare Property Group
              </p>
            </div>
          </a>

          <a
            href="#properties"
            className="rounded-full bg-[#234b39] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#193829]"
          >
            Explore properties
          </a>
        </div>
      </header>

      <section className="relative overflow-hidden bg-[#173b2d]">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/5" />
        <div className="absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-white/5" />

        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="mb-6 inline-flex rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
              Your next move starts here
            </p>

            <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-6xl">
              Find a place
              <br />
              <span className="text-emerald-200">
                that feels like yours.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-8 text-emerald-50/80 sm:text-lg">
              Tell us what you're looking for. Explore properties
              across Harare and discover the homes that best match
              your needs.
            </p>

            <div className="mt-9 flex flex-wrap gap-6 text-sm text-emerald-50/90">
              <span>✓ Personalised property matches</span>
              <span>✓ Viewing requests</span>
              <span>✓ Local listings</span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white p-6 shadow-2xl sm:p-8">
            <div className="mb-7">
              <p className="text-sm font-semibold uppercase tracking-widest text-[#64816e]">
                Property finder
              </p>

              <h2 className="mt-2 text-2xl font-bold tracking-tight">
                What are you looking for?
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Add your preferences to find suitable properties.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="location"
                  className="mb-2 block text-sm font-semibold"
                >
                  Preferred location
                </label>

                <input
                  id="location"
                  type="text"
                  placeholder="e.g. Borrowdale, Avondale"
                  value={form.location}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      location: event.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm outline-none transition focus:border-[#234b39] focus:bg-white"
                />
              </div>

              <div>
                <label
                  htmlFor="propertyType"
                  className="mb-2 block text-sm font-semibold"
                >
                  Property type
                </label>

                <select
                  id="propertyType"
                  value={form.propertyType}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      propertyType: event.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm outline-none transition focus:border-[#234b39] focus:bg-white"
                >
                  <option value="">Any property type</option>
                  <option value="HOUSE">House</option>
                  <option value="APARTMENT">Apartment</option>
                  <option value="TOWNHOUSE">Townhouse</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="bedrooms"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Minimum bedrooms
                  </label>

                  <select
                    id="bedrooms"
                    value={form.minBedrooms}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        minBedrooms: event.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3.5 text-sm outline-none transition focus:border-[#234b39] focus:bg-white"
                  >
                    <option value="">Any</option>
                    <option value="1">1+</option>
                    <option value="2">2+</option>
                    <option value="3">3+</option>
                    <option value="4">4+</option>
                    <option value="5">5+</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="budget"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Maximum budget
                  </label>

                  <select
                    id="budget"
                    value={form.maxBudget}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        maxBudget: event.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3.5 text-sm outline-none transition focus:border-[#234b39] focus:bg-white"
                  >
                    <option value="">Any budget</option>
                    <option value="100000">$100k</option>
                    <option value="200000">$200k</option>
                    <option value="300000">$300k</option>
                    <option value="400000">$400k</option>
                    <option value="500000">$500k</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={searching}
                className="w-full rounded-xl bg-[#234b39] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#193829] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {searching
                  ? "Finding your matches..."
                  : "Find my properties →"}
              </button>

              <p className="text-center text-xs leading-5 text-gray-400">
                Your preferences help us rank properties that may
                suit your needs.
              </p>
            </form>
          </div>
        </div>
      </section>

      <section
        id="properties"
        className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 sm:py-20"
      >
        <div className="mb-9 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-[#64816e]">
              Explore Harare
            </p>

            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              {hasSearched
                ? "Your property matches"
                : "Discover available properties"}
            </h2>

            <p className="mt-3 text-sm leading-6 text-gray-500">
              {hasSearched
                ? "Here are the properties ranked against your preferences."
                : "Explore properties currently listed with our demo agency."}
            </p>
          </div>

          {!loading && !error && (
            <p className="text-sm font-medium text-gray-500">
              {matches.length}{" "}
              {matches.length === 1 ? "property" : "properties"} found
            </p>
          )}
        </div>

        {!loading && !error && locationInfo?.message && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-semibold text-amber-950">
              {locationInfo.message}
            </p>

            {locationInfo.suggestedLocation && (
              <button
                type="button"
                disabled={searching}
                onClick={() =>
                  chooseLocation(locationInfo.suggestedLocation!)
                }
                className="mt-3 rounded-xl bg-[#234b39] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#193829] disabled:opacity-60"
              >
                Search {locationInfo.suggestedLocation} →
              </button>
            )}

            {!locationInfo.suggestedLocation &&
              locationInfo.availableLocations.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-sm text-amber-900">
                    Choose an available location:
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {locationInfo.availableLocations.map(
                      (location) => (
                        <button
                          key={location}
                          type="button"
                          disabled={searching}
                          onClick={() => chooseLocation(location)}
                          className="rounded-full border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-950 transition hover:border-[#234b39] hover:text-[#234b39] disabled:opacity-60"
                        >
                          {location}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
          </div>
        )}

        {loading && (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
            <p className="font-semibold">Loading properties...</p>
            <p className="mt-2 text-sm text-gray-500">
              Connecting to our property database.
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <h3 className="font-semibold text-red-800">
              We couldn't load the properties
            </h3>

            <p className="mt-2 text-sm text-red-700">{error}</p>

            <button
              onClick={() =>
                void searchProperties(
                  hasSearched ? buildPreferences(form) : {}
                )
              }
              className="mt-4 rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold text-white"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && matches.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center">
            <div className="text-4xl">⌂</div>

            <h3 className="mt-4 text-xl font-bold">
              No matching properties found
            </h3>

            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-gray-500">
              Try a different location, remove a filter, or increase
              your budget to explore more options.
            </p>

            <button
              onClick={resetSearch}
              className="mt-6 rounded-xl bg-[#234b39] px-5 py-3 text-sm font-semibold text-white hover:bg-[#193829]"
            >
              Show all available properties
            </button>
          </div>
        )}

        {!loading && !error && matches.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map(({ property, score, reasons }) => {
              const alternative = isAlternativeLocation({
                property,
                score,
                reasons,
              });

              return (
                <article
                  key={property.id}
                  className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white transition duration-200 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="relative flex h-48 items-end overflow-hidden bg-gradient-to-br from-[#dce8df] via-[#b6cbbb] to-[#6c9277] p-5">
                    <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full border-[22px] border-white/20" />
                    <div className="absolute right-12 top-10 h-24 w-24 rounded-full bg-white/10" />

                    <span className="relative rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-[#234b39]">
                      {property.reference_code}
                    </span>

                    <span
                      className={`absolute right-4 top-4 rounded-full px-3 py-1.5 text-xs font-semibold ${
                        property.status === "AVAILABLE"
                          ? "bg-white text-[#234b39]"
                          : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {property.status === "AVAILABLE"
                        ? "Available"
                        : property.status === "UNDER_OFFER"
                          ? "Under offer"
                          : property.status}
                    </span>
                  </div>

                  <div className="p-5">
                    {alternative && (
                      <p className="mb-3 inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">
                        Alternative location
                      </p>
                    )}

                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-[#64816e]">
                          {property.property_type.replaceAll("_", " ")}
                        </p>

                        <h3 className="mt-2 text-lg font-bold leading-snug">
                          {property.title}
                        </h3>
                      </div>

                      {hasSearched && (
                        <div className="shrink-0 rounded-lg bg-[#edf4ee] px-2.5 py-1.5 text-xs font-bold text-[#234b39]">
                          {Math.round(score)} pts
                        </div>
                      )}
                    </div>

                    <p className="mt-2 text-sm text-gray-500">
                      {property.location || property.address || "Harare"}
                    </p>

                    <p className="mt-4 text-2xl font-bold tracking-tight text-[#234b39]">
                      {formatPrice(property.price, property.currency)}
                    </p>

                    <div className="my-5 flex flex-wrap gap-4 border-y border-gray-100 py-4 text-sm text-gray-600">
                      {property.bedrooms !== null && (
                        <span>
                          <strong className="text-gray-900">
                            {property.bedrooms}
                          </strong>{" "}
                          beds
                        </span>
                      )}

                      {property.bathrooms !== null && (
                        <span>
                          <strong className="text-gray-900">
                            {property.bathrooms}
                          </strong>{" "}
                          baths
                        </span>
                      )}

                      <span className="text-xs text-gray-400">
                        Ref: {property.reference_code}
                      </span>
                    </div>

                    {hasSearched && reasons.length > 0 && (
                      <div className="mb-5">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                          Match details
                        </p>

                        <ul className="space-y-1.5">
                          {reasons.slice(0, 3).map((reason) => (
                            <li
                              key={reason}
                              className="text-xs leading-5 text-gray-600"
                            >
                              <span className="mr-2 text-[#64816e]">
                                ✓
                              </span>
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={property.status !== "AVAILABLE"}
                      onClick={() => {
                        alert(
                          `Viewing requests for ${property.reference_code} will be connected in the next step.`
                        );
                      }}
                      className="w-full rounded-xl border border-[#234b39] px-4 py-3 text-sm font-bold text-[#234b39] transition hover:bg-[#234b39] hover:text-white disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-white"
                    >
                      {property.status === "AVAILABLE"
                        ? "Request a viewing →"
                        : "Currently under offer"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            <span className="font-bold text-[#234b39]">PropertyFlow</span>{" "}
            · Property search and viewing management
          </p>

          <p>Demonstration platform · Harare Property Group</p>
        </div>
      </footer>
    </main>
  );
}