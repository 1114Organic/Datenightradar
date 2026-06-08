import type { RecommendationRequest, Restaurant, UserProfile, UserRestaurantState, Visit } from "../models/types.js";
import type { RestaurantRepository } from "./RestaurantRepository.js";

export class InMemoryRestaurantRepository implements RestaurantRepository {
  private profiles = new Map<string, UserProfile>();
  private restaurants = new Map<string, Restaurant>();
  private states = new Map<string, UserRestaurantState>();
  private visits: Visit[] = [];

  constructor() {
    this.seed();
  }

  async getUserProfile(userId: string) {
    return this.profiles.get(userId);
  }

  async putUserProfile(profile: UserProfile) {
    this.profiles.set(profile.userId, profile);
    return profile;
  }

  async listRestaurants(filters: { area?: string; cuisine?: string; priceLevel?: string; tag?: string } = {}) {
    return Array.from(this.restaurants.values()).filter((restaurant) => {
      const areaMatch = !filters.area || restaurant.area.toLowerCase().includes(filters.area.toLowerCase());
      const cuisineMatch = !filters.cuisine || restaurant.cuisineCategories.some((c) => c.toLowerCase() === filters.cuisine?.toLowerCase());
      const priceMatch = !filters.priceLevel || restaurant.priceLevel === filters.priceLevel;
      const tagMatch = !filters.tag || restaurant.tags.includes(filters.tag);
      return areaMatch && cuisineMatch && priceMatch && tagMatch;
    });
  }

  async getRestaurant(restaurantId: string) {
    return this.restaurants.get(restaurantId);
  }

  async putRestaurant(restaurant: Restaurant) {
    this.restaurants.set(restaurant.restaurantId, restaurant);
    return restaurant;
  }

  async getUserRestaurantState(userId: string, restaurantId: string) {
    return this.states.get(`${userId}:${restaurantId}`);
  }

  async putUserRestaurantState(state: UserRestaurantState) {
    this.states.set(`${state.userId}:${state.restaurantId}`, state);
    return state;
  }

  async listUserRestaurantStates(userId: string, status?: string) {
    return Array.from(this.states.values()).filter((state) => state.userId === userId && (!status || state.status === status));
  }

  async putVisit(visit: Visit) {
    this.visits.push(visit);
    return visit;
  }

  async listVisits(userId: string, filters: { restaurantId?: string; rating?: string; occasion?: string } = {}) {
    return this.visits.filter((visit) => {
      return visit.userId === userId
        && (!filters.restaurantId || visit.restaurantId === filters.restaurantId)
        && (!filters.rating || visit.rating === filters.rating)
        && (!filters.occasion || visit.occasion === filters.occasion);
    });
  }

  async listRecommendationCandidates(userId: string, request: RecommendationRequest) {
    const restaurants = await this.listRestaurants({ area: request.area });
    if (request.includeWantToTry) {
      const wantToTry = await this.listUserRestaurantStates(userId, "want_to_try");
      const saved = wantToTry.map((state) => this.restaurants.get(state.restaurantId)).filter(Boolean) as Restaurant[];
      return Array.from(new Map([...restaurants, ...saved].map((r) => [r.restaurantId, r])).values());
    }
    return restaurants;
  }

  private seed() {
    const timestamp = new Date().toISOString();
    [
      ["r-1", "Maple & Main", "Charleston, SC", "Charleston", "SC", "29401", ["American"], "$$$", ["date-night", "cocktails", "quiet"], 4.6, 180],
      ["r-2", "Saffron House", "Mount Pleasant, SC", "Mount Pleasant", "SC", "29464", ["Indian"], "$$", ["casual", "worth-the-drive"], 4.5, 220],
      ["r-3", "Khao Corner", "Charleston, SC", "Charleston", "SC", "29403", ["Thai"], "$$", ["date-night", "good-parking"], 4.4, 95],
      ["r-4", "Luna Verde", "North Charleston, SC", "North Charleston", "SC", "29405", ["Mexican"], "$$", ["outdoor-seating", "cocktails"], 4.3, 145],
      ["r-5", "Barrel Room", "Charleston, SC", "Charleston", "SC", "29401", ["Italian"], "$$$", ["upscale", "date-night", "cocktails"], 4.2, 70]
    ].forEach(([restaurantId, name, area, city, state, zipCode, cuisines, priceLevel, tags, publicRating, reviewCount]) => {
      this.restaurants.set(String(restaurantId), {
        entityType: "Restaurant",
        restaurantId: String(restaurantId),
        name: String(name),
        area: String(area),
        city: String(city),
        state: String(state),
        zipCode: String(zipCode),
        address: `${name} Ave, ${area}`,
        cuisineCategories: cuisines as string[],
        priceLevel: priceLevel as Restaurant["priceLevel"],
        tags: tags as string[],
        publicRating: Number(publicRating),
        reviewCount: Number(reviewCount),
        createdAt: timestamp,
        updatedAt: timestamp
      });
    });
  }
}
