import type { RecommendationRequest, Restaurant, UserProfile, UserRestaurantState, Visit } from "../models/types.js";

export interface RestaurantRepository {
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  putUserProfile(profile: UserProfile): Promise<UserProfile>;
  listRestaurants(filters?: { area?: string; cuisine?: string; priceLevel?: string; tag?: string }): Promise<Restaurant[]>;
  getRestaurant(restaurantId: string): Promise<Restaurant | undefined>;
  putRestaurant(restaurant: Restaurant): Promise<Restaurant>;
  deleteRestaurant(restaurantId: string): Promise<void>;
  getUserRestaurantState(userId: string, restaurantId: string): Promise<UserRestaurantState | undefined>;
  putUserRestaurantState(state: UserRestaurantState): Promise<UserRestaurantState>;
  listUserRestaurantStates(userId: string, status?: string): Promise<UserRestaurantState[]>;
  putVisit(visit: Visit): Promise<Visit>;
  listVisits(userId: string, filters?: { restaurantId?: string; rating?: string; occasion?: string }): Promise<Visit[]>;
  listRecommendationCandidates(userId: string, request: RecommendationRequest): Promise<Restaurant[]>;
}
