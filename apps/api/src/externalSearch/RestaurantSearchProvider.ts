import type { Restaurant } from "../models/types.js";

export interface RestaurantSearchInput {
  query?: string;
  area?: string;
  latitude?: number;
  longitude?: number;
  radiusMiles?: number;
}

export type NormalizedRestaurant = Omit<Restaurant, "entityType" | "restaurantId" | "createdAt" | "updatedAt"> & {
  externalIds?: Record<string, string>;
};

export interface RestaurantSearchProvider {
  searchRestaurants(input: RestaurantSearchInput): Promise<NormalizedRestaurant[]>;
  getRestaurantDetails(externalId: string): Promise<NormalizedRestaurant | undefined>;
}
