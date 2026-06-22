import type { NormalizedRestaurant, RestaurantSearchInput, RestaurantSearchProvider } from "./RestaurantSearchProvider.js";
import { normalizeKey } from "../utils/normalize.js";

const charlestonSeedRestaurants: NormalizedRestaurant[] = [
  seed("FIG", "Charleston", "SC", "29401", ["American"], "$$$", ["date-night", "upscale"]),
  seed("Husk", "Charleston", "SC", "29401", ["American"], "$$$", ["date-night", "upscale"]),
  seed("The Ordinary", "Charleston", "SC", "29403", ["Seafood"], "$$$", ["date-night", "cocktails"]),
  seed("Leon's Oyster Shop", "Charleston", "SC", "29403", ["Seafood"], "$$", ["casual", "outdoor-seating"]),
  seed("Xiao Bao Biscuit", "Charleston", "SC", "29403", ["Asian"], "$$", ["casual", "cocktails"]),
  seed("Chubby Fish", "Charleston", "SC", "29403", ["Seafood"], "$$$", ["date-night", "worth-the-drive"]),
  seed("Bertha's Kitchen", "North Charleston", "SC", "29405", ["American"], "$", ["casual", "quick-bite"]),
  seed("Jackrabbit Filly", "North Charleston", "SC", "29405", ["Asian"], "$$", ["date-night", "cocktails"]),
  seed("EVO Pizzeria", "North Charleston", "SC", "29405", ["Italian"], "$$", ["casual", "family-friendly"]),
  seed("The Obstinate Daughter", "Sullivan's Island", "SC", "29482", ["Italian"], "$$$", ["date-night", "worth-the-drive"]),
  seed("Post House", "Mount Pleasant", "SC", "29464", ["American"], "$$$", ["date-night", "quiet"]),
  seed("Page's Okra Grill", "Mount Pleasant", "SC", "29464", ["American"], "$$", ["brunch", "family-friendly"]),
  seed("Red Drum", "Mount Pleasant", "SC", "29464", ["American"], "$$$", ["date-night", "cocktails"]),
  seed("Tavern & Table", "Mount Pleasant", "SC", "29464", ["American"], "$$", ["outdoor-seating", "cocktails"]),
  seed("Bowens Island Restaurant", "James Island", "SC", "29412", ["Seafood"], "$$", ["casual", "worth-the-drive"]),
  seed("The Royal Tern", "Johns Island", "SC", "29455", ["Seafood"], "$$$", ["date-night", "cocktails"]),
  seed("Wild Olive", "Johns Island", "SC", "29455", ["Italian"], "$$$", ["date-night", "worth-the-drive"]),
  seed("Minero", "Johns Island", "SC", "29455", ["Mexican"], "$$", ["casual", "cocktails"])
];

const charlestonCountyAreas = ["charleston county", "charleston", "north charleston", "mount pleasant", "mt pleasant", "james island", "johns island"];

export class ManualSearchProvider implements RestaurantSearchProvider {
  async searchRestaurants(input: RestaurantSearchInput): Promise<NormalizedRestaurant[]> {
    const areaQuery = `${input.area ?? ""} ${input.query ?? ""}`.toLowerCase();
    const seeded = charlestonSeedRestaurants.filter((restaurant) => matchesAreaOrZip(restaurant, areaQuery));
    if (seeded.length) return seeded;
    if (!input.query) return [];
    return [{
      restaurantId: `manual-${normalizeKey([input.query, input.area].filter(Boolean).join("-"))}`,
      name: input.query,
      area: input.area ?? "Unknown",
      address: input.area ? `${input.area} area` : undefined,
      cuisineCategories: [],
      priceLevel: "$$",
      tags: [],
      publicRating: undefined,
      reviewCount: undefined,
      externalIds: { manual: input.query.toLowerCase().replace(/\s+/g, "-") }
    }];
  }

  async getRestaurantDetails() {
    return undefined;
  }
}

function seed(
  name: string,
  city: string,
  state: string,
  zipCode: string,
  cuisineCategories: string[],
  priceLevel: NormalizedRestaurant["priceLevel"],
  tags: string[]
): NormalizedRestaurant {
  const area = `${city}, ${state}`;
  return {
    restaurantId: `seed-${normalizeKey(`${name}-${city}-${state}`)}`,
    name,
    area,
    city,
    state,
    zipCode,
    address: `${name}, ${area} ${zipCode}`,
    cuisineCategories,
    priceLevel,
    tags,
    externalIds: { seed: normalizeKey(`${name}-${city}-${state}`) }
  };
}

function matchesAreaOrZip(restaurant: NormalizedRestaurant, query: string) {
  if (!query.trim()) return false;
  if (restaurant.zipCode && query.includes(restaurant.zipCode)) return true;
  const city = restaurant.city?.toLowerCase() ?? "";
  const target = query.split(",")[0]?.trim() ?? query.trim();
  if (target === "charleston county") return restaurant.state === "SC";
  if (city && target === city) return true;
  if (city === "mount pleasant" && target === "mt pleasant") return true;
  return charlestonCountyAreas.includes(target) && city === target;
}
