import type { NormalizedRestaurant, RestaurantSearchInput, RestaurantSearchProvider } from "./RestaurantSearchProvider.js";
import { normalizeKey } from "../utils/normalize.js";

const searchTextEndpoint = "https://places.googleapis.com/v1/places:searchText";
const placeDetailsEndpoint = "https://places.googleapis.com/v1/places";
const fieldMask = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
  "places.priceLevel",
  "places.rating",
  "places.types",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.websiteUri",
  "places.nationalPhoneNumber"
].join(",");

export class GooglePlacesSearchProvider implements RestaurantSearchProvider {
  constructor(private apiKey: string, private pageSize = 10) {}

  async searchRestaurants(input: RestaurantSearchInput): Promise<NormalizedRestaurant[]> {
    const body: Record<string, unknown> = {
      textQuery: buildTextQuery(input),
      includedType: "restaurant",
      pageSize: clampPageSize(this.pageSize)
    };
    if (input.latitude != null && input.longitude != null) {
      body.locationBias = {
        circle: {
          center: { latitude: input.latitude, longitude: input.longitude },
          radius: milesToMeters(input.radiusMiles ?? 10)
        }
      };
    }

    const response = await fetch(searchTextEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": this.apiKey,
        "x-goog-fieldmask": fieldMask
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`Google Places search failed: ${response.status} ${await response.text()}`);
    const payload = await response.json() as GooglePlacesTextSearchResponse;
    return (payload.places ?? []).map(toRestaurant).filter(Boolean) as NormalizedRestaurant[];
  }

  async getRestaurantDetails(externalId: string) {
    const placeId = externalId.replace(/^places\//, "");
    const response = await fetch(`${placeDetailsEndpoint}/${encodeURIComponent(placeId)}`, {
      headers: {
        "x-goog-api-key": this.apiKey,
        "x-goog-fieldmask": fieldMask.replaceAll("places.", "")
      }
    });
    if (!response.ok) throw new Error(`Google Places details failed: ${response.status} ${await response.text()}`);
    return toRestaurant(await response.json() as GooglePlace);
  }
}

interface GooglePlacesTextSearchResponse {
  places?: GooglePlace[];
}

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: GoogleAddressComponent[];
  location?: { latitude?: number; longitude?: number };
  priceLevel?: string;
  rating?: number;
  types?: string[];
  userRatingCount?: number;
  googleMapsUri?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
}

interface GoogleAddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

function toRestaurant(place: GooglePlace): NormalizedRestaurant | undefined {
  const name = place.displayName?.text?.trim();
  const city = addressComponent(place, "locality")
    ?? addressComponent(place, "postal_town")
    ?? addressComponent(place, "sublocality")
    ?? addressComponent(place, "administrative_area_level_3");
  const state = addressComponent(place, "administrative_area_level_1", "shortText")?.toUpperCase();
  const zipCode = addressComponent(place, "postal_code");
  if (!name || !city || !state || !zipCode) return undefined;

  const googlePlaceId = place.id;
  return {
    restaurantId: googlePlaceId ? `google-${normalizeKey(googlePlaceId)}` : undefined,
    name,
    area: `${city}, ${state}`,
    city,
    state,
    zipCode,
    address: place.formattedAddress,
    latitude: place.location?.latitude,
    longitude: place.location?.longitude,
    cuisineCategories: cuisineCategoriesFromTypes(place.types ?? []),
    priceLevel: priceLevelFromGoogle(place.priceLevel),
    publicRating: place.rating,
    reviewCount: place.userRatingCount,
    tags: tagsFromTypes(place.types ?? []),
    externalIds: {
      ...(googlePlaceId ? { googlePlaceId } : {}),
      ...(place.googleMapsUri ? { googleMapsUri: place.googleMapsUri } : {}),
      ...(place.websiteUri ? { websiteUri: place.websiteUri } : {}),
      ...(place.nationalPhoneNumber ? { phoneNumber: place.nationalPhoneNumber } : {})
    }
  };
}

function buildTextQuery(input: RestaurantSearchInput) {
  const query = input.query?.trim();
  const area = input.area?.trim();
  if (!query || ["area", "city", "county", "zip"].includes(query.toLowerCase())) {
    return area ? `restaurants in ${area}` : "restaurants";
  }
  return area ? `${query} restaurants in ${area}` : `${query} restaurants`;
}

function addressComponent(place: GooglePlace, type: string, field: "longText" | "shortText" = "longText") {
  return place.addressComponents?.find((component) => component.types?.includes(type))?.[field]?.trim();
}

function cuisineCategoriesFromTypes(types: string[]) {
  const categories = new Set<string>();
  const typeText = types.join(" ");
  if (/seafood/.test(typeText)) categories.add("Seafood");
  if (/italian/.test(typeText)) categories.add("Italian");
  if (/mexican/.test(typeText)) categories.add("Mexican");
  if (/thai/.test(typeText)) categories.add("Thai");
  if (/indian/.test(typeText)) categories.add("Indian");
  if (/japanese|sushi/.test(typeText)) categories.add("Japanese");
  if (/mediterranean/.test(typeText)) categories.add("Mediterranean");
  if (/american/.test(typeText)) categories.add("American");
  return Array.from(categories);
}

function tagsFromTypes(types: string[]) {
  const tags = new Set<string>();
  if (types.includes("bar")) tags.add("cocktails");
  if (types.includes("cafe")) tags.add("casual");
  if (types.includes("meal_takeaway")) tags.add("quick-bite");
  return Array.from(tags);
}

function priceLevelFromGoogle(priceLevel?: string): NormalizedRestaurant["priceLevel"] {
  switch (priceLevel) {
    case "PRICE_LEVEL_INEXPENSIVE":
      return "$";
    case "PRICE_LEVEL_MODERATE":
      return "$$";
    case "PRICE_LEVEL_EXPENSIVE":
      return "$$$";
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return "$$$$";
    default:
      return "$$";
  }
}

function clampPageSize(pageSize: number) {
  return Math.min(Math.max(Math.floor(pageSize) || 10, 1), 20);
}

function milesToMeters(miles: number) {
  return Math.min(Math.max(miles, 0.1), 31) * 1609.344;
}
