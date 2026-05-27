import { randomUUID } from "node:crypto";
import type { RecommendationRequest, Restaurant, RestaurantStatus, UserProfile, Visit, VisitRating } from "../models/types.js";
import type { RestaurantRepository } from "../repositories/RestaurantRepository.js";
import type { RestaurantSearchProvider } from "../externalSearch/RestaurantSearchProvider.js";
import { nowIso, sanitizeNote, unique } from "../utils/normalize.js";
import { recommendRestaurants } from "../recommendation/scoring.js";

export class AppService {
  constructor(private repo: RestaurantRepository, private searchProvider: RestaurantSearchProvider) {}

  async getProfile(userId: string) {
    return (await this.repo.getUserProfile(userId)) ?? this.putProfile(userId, {
      name: "Robert",
      homeArea: "Reston",
      favoriteCuisines: ["Italian", "Mexican", "Thai"],
      dislikedCuisines: [],
      preferredPriceLevels: ["$$", "$$$"],
      preferredTags: ["date-night", "cocktails", "good-parking"],
      dealBreakers: []
    });
  }

  async putProfile(userId: string, input: Partial<UserProfile>) {
    const current = await this.repo.getUserProfile(userId);
    const timestamp = nowIso();
    return this.repo.putUserProfile({
      entityType: "UserProfile",
      userId,
      name: input.name ?? current?.name ?? "",
      homeArea: input.homeArea ?? current?.homeArea ?? "",
      favoriteCuisines: input.favoriteCuisines ?? current?.favoriteCuisines ?? [],
      dislikedCuisines: input.dislikedCuisines ?? current?.dislikedCuisines ?? [],
      preferredPriceLevels: input.preferredPriceLevels ?? current?.preferredPriceLevels ?? [],
      preferredTags: input.preferredTags ?? current?.preferredTags ?? [],
      dealBreakers: input.dealBreakers ?? current?.dealBreakers ?? [],
      createdAt: current?.createdAt ?? timestamp,
      updatedAt: timestamp
    });
  }

  async createRestaurant(input: Partial<Restaurant>) {
    const timestamp = nowIso();
    const restaurant: Restaurant = {
      entityType: "Restaurant",
      restaurantId: input.restaurantId ?? randomUUID(),
      name: required(input.name, "name"),
      area: required(input.area, "area"),
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      cuisineCategories: input.cuisineCategories ?? [],
      priceLevel: input.priceLevel ?? "$$",
      publicRating: input.publicRating,
      reviewCount: input.reviewCount,
      externalIds: input.externalIds,
      tags: input.tags ?? [],
      createdAt: timestamp,
      updatedAt: timestamp
    };
    return this.repo.putRestaurant(restaurant);
  }

  async updateRestaurant(restaurantId: string, input: Partial<Restaurant>) {
    const current = await this.repo.getRestaurant(restaurantId);
    if (!current) throw new Error("restaurant not found");
    return this.repo.putRestaurant({
      ...current,
      ...input,
      restaurantId,
      entityType: "Restaurant",
      updatedAt: nowIso()
    });
  }

  listRestaurants(filters: { area?: string; cuisine?: string; status?: string; priceLevel?: string; tag?: string }) {
    return this.repo.listRestaurants(filters);
  }

  getRestaurant(restaurantId: string) {
    return this.repo.getRestaurant(restaurantId);
  }

  async searchRestaurants(input: { query?: string; area?: string; latitude?: number | string; longitude?: number | string; radiusMiles?: number | string }) {
    const cached = await this.repo.listRestaurants({ area: input.area });
    const matching = cached.filter((restaurant) => !input.query || restaurant.name.toLowerCase().includes(input.query.toLowerCase()));
    if (matching.length) return matching;
    const normalized = await this.searchProvider.searchRestaurants({
      query: input.query,
      area: input.area,
      latitude: input.latitude == null ? undefined : Number(input.latitude),
      longitude: input.longitude == null ? undefined : Number(input.longitude),
      radiusMiles: input.radiusMiles == null ? undefined : Number(input.radiusMiles)
    });
    return Promise.all(normalized.map((restaurant) => this.createRestaurant(restaurant)));
  }

  async markRestaurant(userId: string, restaurantId: string, status: RestaurantStatus) {
    const current = await this.repo.getUserRestaurantState(userId, restaurantId);
    const timestamp = nowIso();
    return this.repo.putUserRestaurantState({
      entityType: "UserRestaurantState",
      userId,
      restaurantId,
      status,
      personalTags: current?.personalTags ?? [],
      lastVisitDate: current?.lastVisitDate,
      bestRating: current?.bestRating,
      wouldReturn: current?.wouldReturn,
      createdAt: current?.createdAt ?? timestamp,
      updatedAt: timestamp
    });
  }

  listUserRestaurants(userId: string, status?: string) {
    return this.repo.listUserRestaurantStates(userId, status);
  }

  async createVisit(userId: string, input: { restaurantId: string; visitDate?: string; occasion: string; rating: VisitRating; wouldReturn: boolean; tags?: string[]; notes?: string }) {
    const timestamp = nowIso();
    const visit: Visit = {
      entityType: "Visit",
      visitId: randomUUID(),
      userId,
      restaurantId: required(input.restaurantId, "restaurantId"),
      visitDate: input.visitDate ?? timestamp,
      occasion: input.occasion,
      rating: input.rating,
      wouldReturn: input.wouldReturn,
      tags: input.tags ?? [],
      notes: sanitizeNote(input.notes),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.repo.putVisit(visit);
    const current = await this.repo.getUserRestaurantState(userId, visit.restaurantId);
    await this.repo.putUserRestaurantState({
      entityType: "UserRestaurantState",
      userId,
      restaurantId: visit.restaurantId,
      status: "visited",
      personalTags: unique([...(current?.personalTags ?? []), ...visit.tags]),
      lastVisitDate: visit.visitDate,
      bestRating: visit.rating,
      wouldReturn: visit.wouldReturn,
      createdAt: current?.createdAt ?? timestamp,
      updatedAt: timestamp
    });
    return visit;
  }

  listVisits(userId: string, filters: { restaurantId?: string; rating?: string; occasion?: string }) {
    return this.repo.listVisits(userId, filters);
  }

  async getRecommendations(userId: string, request: RecommendationRequest) {
    const profile = await this.getProfile(userId);
    const visits = await this.repo.listVisits(userId);
    const states = await this.repo.listUserRestaurantStates(userId);
    const candidates = await this.repo.listRecommendationCandidates(userId, request);
    return { recommendations: recommendRestaurants(candidates, profile, visits, states, request).slice(0, 3) };
  }
}

function required(value: string | undefined, field: string): string {
  if (!value?.trim()) throw new Error(`${field} is required`);
  return value.trim();
}
