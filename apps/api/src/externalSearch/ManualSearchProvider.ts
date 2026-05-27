import type { NormalizedRestaurant, RestaurantSearchInput, RestaurantSearchProvider } from "./RestaurantSearchProvider.js";

export class ManualSearchProvider implements RestaurantSearchProvider {
  async searchRestaurants(input: RestaurantSearchInput): Promise<NormalizedRestaurant[]> {
    if (!input.query) return [];
    return [{
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
